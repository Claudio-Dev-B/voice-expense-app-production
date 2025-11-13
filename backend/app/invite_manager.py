# backend/app/invite_manager.py
import secrets
import string
import logging
from datetime import datetime, timedelta
from sqlmodel import Session, select
from typing import List, Dict, Optional, Tuple

from .models import AccountInvite, SharedAccount, User, AccountMember

logger = logging.getLogger(__name__)

class InviteManager:
    def __init__(self):
        self.token_length = 8
        self.default_expiry_days = 7
    
    def generate_invite_token(self) -> str:
        """Gera token curto, amigável e fácil de compartilhar"""
        # Usar apenas letras maiúsculas e números (evitar confusão com 0/O, 1/I)
        alphabet = string.ascii_uppercase.replace('O', '').replace('I', '') + string.digits.replace('0', '').replace('1', '')
        return ''.join(secrets.choice(alphabet) for _ in range(self.token_length))
    
    def create_invite(self, account_id: int, email: str, role: str, 
                     created_by: int, session: Session) -> Tuple[Optional[AccountInvite], str]:
        """Cria um novo convite com token único"""
        try:
            # Verificar se já existe convite pendente para este email
            existing_invite = session.exec(
                select(AccountInvite).where(
                    AccountInvite.account_id == account_id,
                    AccountInvite.email == email,
                    AccountInvite.status == "pending"
                )
            ).first()
            
            if existing_invite:
                return None, f"Já existe um convite pendente para {email}"

            # Gerar token único
            max_attempts = 5
            token = None
            
            for attempt in range(max_attempts):
                candidate_token = self.generate_invite_token()
                
                # Verificar se token já existe
                existing = session.exec(
                    select(AccountInvite).where(AccountInvite.token == candidate_token)
                ).first()
                
                if not existing:
                    token = candidate_token
                    break
            
            if not token:
                return None, "Não foi possível gerar token único após várias tentativas"
            
            # Criar convite
            invite = AccountInvite(
                account_id=account_id,
                email=email,
                token=token,
                role=role,
                expires_at=datetime.utcnow() + timedelta(days=self.default_expiry_days),
                created_by=created_by,
                status="pending"
            )
            
            session.add(invite)
            session.commit()
            session.refresh(invite)
            
            logger.info(f"✅ Convite criado: {token} para {email}")
            return invite, "success"
            
        except Exception as e:
            session.rollback()
            logger.error(f"❌ Erro ao criar convite: {str(e)}")
            return None, str(e)
    
    def validate_invite_token(self, token: str, session: Session) -> Dict:
        """Valida token de convite e retorna informações"""
        try:
            result = session.exec(
                select(AccountInvite, SharedAccount, User)
                .join(SharedAccount, AccountInvite.account_id == SharedAccount.id)
                .join(User, AccountInvite.created_by == User.id)
                .where(AccountInvite.token == token)
            ).first()
            
            if not result:
                return {
                    "valid": False, 
                    "error": "Convite não encontrado",
                    "error_code": "INVITE_NOT_FOUND"
                }
            
            invite_obj, account, inviter = result
            
            # Verificar status
            if invite_obj.status != "pending":
                return {
                    "valid": False,
                    "error": "Convite já utilizado",
                    "error_code": "INVITE_USED"
                }
            
            # Verificar expiração
            if invite_obj.expires_at < datetime.utcnow():
                invite_obj.status = "expired"
                session.commit()
                return {
                    "valid": False,
                    "error": "Convite expirado",
                    "error_code": "INVITE_EXPIRED"
                }
            
            return {
                "valid": True,
                "invite": invite_obj,
                "account": account,
                "inviter": inviter
            }
            
        except Exception as e:
            logger.error(f"Erro ao validar token: {str(e)}")
            return {
                "valid": False,
                "error": "Erro interno na validação",
                "error_code": "VALIDATION_ERROR"
            }
    
    def get_invite_share_data(self, token: str, session: Session) -> Optional[Dict]:
        """Retorna dados completos para compartilhamento do convite"""
        try:
            validation_result = self.validate_invite_token(token, session)
            
            if not validation_result["valid"]:
                return None
            
            invite = validation_result["invite"]
            account = validation_result["account"]
            inviter = validation_result["inviter"]
            
            frontend_url = "https://voice-expense-app-production.vercel.app"
            invite_url = f"{frontend_url}/accept-invite/{token}"
            
            # Calcular dias restantes
            days_remaining = (invite.expires_at - datetime.utcnow()).days
            days_remaining = max(0, days_remaining)  # Não permitir negativo
            
            # Dados para compartilhamento
            share_data = {
                # Informações básicas
                "token": token,
                "account_name": account.name,
                "inviter_name": inviter.name,
                "inviter_email": inviter.email,
                "target_email": invite.email,
                "role": invite.role,
                "expires_at": invite.expires_at.isoformat(),
                
                # URLs
                "invite_url": invite_url,
                "app_url": frontend_url,
                
                # Formatos de compartilhamento
                "share_text": self._generate_share_text(inviter.name, account.name, invite_url, token),
                "share_text_short": f"Convite VoiceExpense: {token} | {account.name}",
                
                # Para futuros QR Codes
                "qr_data": f"VOICEEXPENSE:{token}",
                
                # Metadados
                "created_at": invite.created_at.isoformat(),
                "days_remaining": days_remaining
            }
            
            return share_data
            
        except Exception as e:
            logger.error(f"Erro ao gerar dados de compartilhamento: {str(e)}")
            return None
    
    def _generate_share_text(self, inviter_name: str, account_name: str, invite_url: str, token: str) -> str:
        """Gera texto formatado para compartilhamento"""
        return f"""🎤 CONVITE VOICEEXPENSE

{inviter_name} convidou você para: {account_name}

🔗 Link direto: {invite_url}
🔢 Código: {token}

📱 COMO USAR:
1. Acesse o app: https://voice-expense-app-production.vercel.app
2. Faça login/cadastro
3. Use o código ou link acima

⏰ Válido por 7 dias""".strip()
    
    def accept_invite(self, token: str, user_id: int, session: Session) -> Dict:
        """Aceita um convite e adiciona usuário à conta"""
        try:
            validation_result = self.validate_invite_token(token, session)
            
            if not validation_result["valid"]:
                return {
                    "success": False,
                    "error": validation_result["error"],
                    "error_code": validation_result["error_code"]
                }
            
            invite = validation_result["invite"]
            account = validation_result["account"]
            
            # Verificar se o email do convite corresponde ao usuário
            user = session.get(User, user_id)
            if not user:
                return {
                    "success": False,
                    "error": "Usuário não encontrado",
                    "error_code": "USER_NOT_FOUND"
                }
            
            if invite.email.lower() != user.email.lower():
                return {
                    "success": False,
                    "error": "Este convite é para outro email",
                    "error_code": "EMAIL_MISMATCH"
                }
            
            # Verificar se usuário já é membro
            existing_member = session.exec(
                select(AccountMember).where(
                    AccountMember.account_id == invite.account_id,
                    AccountMember.user_id == user_id
                )
            ).first()
            
            if existing_member:
                # Marcar convite como aceito mesmo que já seja membro
                invite.status = "accepted"
                invite.accepted_at = datetime.utcnow()
                session.commit()
                
                return {
                    "success": True,
                    "message": "Você já é membro desta conta",
                    "account_id": account.id,
                    "account_name": account.name
                }
            
            # Adicionar usuário como membro
            member = AccountMember(
                account_id=invite.account_id,
                user_id=user_id,
                role=invite.role
            )
            session.add(member)
            
            # Atualizar status do convite
            invite.status = "accepted"
            invite.accepted_at = datetime.utcnow()
            
            session.commit()
            
            logger.info(f"✅ Convite aceito: {token} por usuário {user_id}")
            
            return {
                "success": True,
                "message": "Convite aceito com sucesso!",
                "account_id": account.id,
                "account_name": account.name,
                "role": invite.role
            }
            
        except Exception as e:
            session.rollback()
            logger.error(f"❌ Erro ao aceitar convite: {str(e)}")
            return {
                "success": False,
                "error": "Erro interno ao processar convite",
                "error_code": "INTERNAL_ERROR"
            }
    
    def get_user_pending_invites(self, user_email: str, session: Session) -> List[Dict]:
        """Retorna todos os convites pendentes de um usuário"""
        try:
            invites = session.exec(
                select(AccountInvite, SharedAccount, User)
                .join(SharedAccount, AccountInvite.account_id == SharedAccount.id)
                .join(User, AccountInvite.created_by == User.id)
                .where(
                    AccountInvite.email == user_email,
                    AccountInvite.status == "pending",
                    AccountInvite.expires_at > datetime.utcnow()
                )
            ).all()
            
            result = []
            for invite_obj, account, inviter in invites:
                result.append({
                    "id": invite_obj.id,
                    "token": invite_obj.token,
                    "account_name": account.name,
                    "account_id": account.id,
                    "inviter_name": inviter.name,
                    "inviter_email": inviter.email,
                    "role": invite_obj.role,
                    "expires_at": invite_obj.expires_at.isoformat(),
                    "created_at": invite_obj.created_at.isoformat(),
                    "days_remaining": (invite_obj.expires_at - datetime.utcnow()).days
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Erro ao buscar convites pendentes: {str(e)}")
            return []
    
    def cancel_invite(self, invite_id: int, session: Session) -> bool:
        """Cancela um convite pendente"""
        try:
            invite = session.get(AccountInvite, invite_id)
            if not invite:
                return False
            
            if invite.status != "pending":
                return False
            
            invite.status = "cancelled"
            session.commit()
            
            logger.info(f"✅ Convite cancelado: {invite.token}")
            return True
            
        except Exception as e:
            session.rollback()
            logger.error(f"❌ Erro ao cancelar convite: {str(e)}")
            return False
    
    def cleanup_expired_invites(self, session: Session) -> int:
        """Limpa convites expirados e retorna quantidade removida"""
        try:
            expired_invites = session.exec(
                select(AccountInvite).where(
                    AccountInvite.status == "pending",
                    AccountInvite.expires_at < datetime.utcnow()
                )
            ).all()
            
            count = 0
            for invite in expired_invites:
                invite.status = "expired"
                count += 1
            
            if count > 0:
                session.commit()
                logger.info(f"🧹 Limpos {count} convites expirados")
            
            return count
            
        except Exception as e:
            session.rollback()
            logger.error(f"Erro ao limpar convites expirados: {str(e)}")
            return 0

# Instância global
invite_manager = InviteManager()