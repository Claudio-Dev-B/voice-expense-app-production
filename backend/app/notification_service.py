# backend/app/notification_service.py
import logging
from sqlmodel import Session, select
from datetime import datetime
from typing import List, Optional
from .models import User, AccountInvite, SharedAccount

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        self.enabled = True
    
    def create_invite_notification(self, invite_email: str, inviter_name: str, 
                                 account_name: str, token: str, session: Session) -> bool:
        """Cria notificação interna de convite - SEM EMAIL EXTERNO"""
        try:
            # Buscar usuário pelo email (se já existir)
            invited_user = session.execute(
                select(User).where(User.email == invite_email)
            ).first()
            
            # Registrar no log para o usuário compartilhar
            frontend_url = "https://voice-expense-app-production.vercel.app"
            invite_url = f"{frontend_url}/accept-invite/{token}"
            
            logger.info(f"""
            🎯 CONVITE CRIADO - COMPARTILHE MANUALMENTE
            
            📧 Para: {invite_email}
            🏢 Conta: {account_name}
            👤 Convidado por: {inviter_name}
            🔗 Link: {invite_url}
            🔢 Código: {token}
            
            ⚡ INSTRUÇÕES:
            1. Compartilhe o LINK acima com {invite_email}
            2. Ou compartilhe apenas o CÓDIGO: {token}
            3. A pessoa deve acessar o app e usar o código
            
            📱 URL do App: {frontend_url}
            """)
            
            # Se usuário já existe, podemos criar notificação interna
            if invited_user:
                self._create_in_app_notification(
                    user_id=invited_user.id,
                    title="🎤 Novo Convite",
                    message=f"{inviter_name} convidou você para '{account_name}'",
                    action_url=f"/accept-invite/{token}",
                    metadata={
                        "type": "invite",
                        "account_name": account_name,
                        "inviter_name": inviter_name,
                        "token": token
                    },
                    session=session
                )
                logger.info(f"📢 Notificação interna criada para usuário: {invite_email}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao criar notificação: {str(e)}")
            return False
    
    def _create_in_app_notification(self, user_id: int, title: str, message: str, 
                                  action_url: str, metadata: dict, session: Session):
        """Cria notificação interna no app (para implementação futura)"""
        # TODO: Implementar tabela Notification quando necessário
        # Por enquanto, apenas registro em log
        logger.info(f"💡 Notificação para usuário {user_id}: {title}")
        
        # Exemplo de estrutura futura:
        # notification = Notification(
        #     user_id=user_id,
        #     title=title,
        #     message=message,
        #     action_url=action_url,
        #     metadata=json.dumps(metadata),
        #     is_read=False,
        #     created_at=datetime.utcnow()
        # )
        # session.add(notification)
    
    def get_pending_invites_for_user(self, user_email: str, session: Session) -> List[dict]:
        """Retorna todos os convites pendentes para um email"""
        try:
            invites = session.execute(
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
            for invite, account, inviter in invites:
                result.append({
                    "id": invite.id,
                    "account_name": account.name,
                    "inviter_name": inviter.name,
                    "inviter_email": inviter.email,
                    "role": invite.role,
                    "created_at": invite.created_at.isoformat(),
                    "expires_at": invite.expires_at.isoformat(),
                    "token": invite.token
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Erro ao buscar convites pendentes: {str(e)}")
            return []
    
    def get_shareable_invite_data(self, token: str, session: Session) -> Optional[dict]:
        """Retorna dados formatados para compartilhamento do convite"""
        try:
            invite = session.execute(
                select(AccountInvite, SharedAccount, User)
                .join(SharedAccount, AccountInvite.account_id == SharedAccount.id)
                .join(User, AccountInvite.created_by == User.id)
                .where(AccountInvite.token == token)
            ).first()
            
            if not invite:
                return None
            
            invite_obj, account, inviter = invite
            
            frontend_url = "https://voice-expense-app-production.vercel.app"
            invite_url = f"{frontend_url}/accept-invite/{token}"
            
            return {
                "invite_url": invite_url,
                "token": token,
                "account_name": account.name,
                "inviter_name": inviter.name,
                "inviter_email": inviter.email,
                "expires_at": invite_obj.expires_at.isoformat(),
                "share_text": self._generate_share_text(inviter.name, account.name, invite_url, token),
                "qr_data": f"VOICEEXPENSE:{token}"  # Para futura implementação de QR Code
            }
            
        except Exception as e:
            logger.error(f"Erro ao gerar dados de compartilhamento: {str(e)}")
            return None
    
    def _generate_share_text(self, inviter_name: str, account_name: str, invite_url: str, token: str) -> str:
        """Gera texto formatado para compartilhamento"""
        return f"""
🎤 CONVITE VOICEEXPENSE

{inviter_name} convidou você para a conta: {account_name}

🔗 Link direto: {invite_url}
🔢 Código do convite: {token}

📱 COMO ACEITAR:
1. Acesse: https://voice-expense-app-production.vercel.app
2. Faça login ou crie sua conta
3. Vá para "Aceitar Convite" e use o código acima

💡 O convite expira em 7 dias
        """.strip()
    
    def mark_invite_notified(self, invite_id: int, session: Session) -> bool:
        """Marca convite como notificado (para futuras implementações)"""
        try:
            invite = session.get(AccountInvite, invite_id)
            if invite:
                # Podemos adicionar um campo 'notified_at' futuramente
                # invite.notified_at = datetime.utcnow()
                session.commit()
                return True
            return False
        except Exception as e:
            logger.error(f"Erro ao marcar convite como notificado: {str(e)}")
            return False

# Instância global para uso em toda a aplicação
notification_service = NotificationService()