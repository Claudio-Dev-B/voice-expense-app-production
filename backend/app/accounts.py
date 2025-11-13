# backend/app/accounts.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select
from typing import List
import secrets
import string
from datetime import datetime, timedelta
import os

from .db import get_session
from .security import verify_token
from .models import SharedAccount, AccountMember, AccountInvite, User, Expense, CostCenter, Category
from .invite_manager import invite_manager
from .notification_service import notification_service

router = APIRouter()

# ===== UTILITÁRIOS =====

def check_account_access(account_id: int, user_id: int, session: Session, required_role: str = None):
    """Verifica se usuário tem acesso à conta"""
    membership = session.execute(
        select(AccountMember).where(
            AccountMember.account_id == account_id,
            AccountMember.user_id == user_id,
            AccountMember.is_active == True
        )
    ).first()
    
    if not membership:
        return False
    
    if required_role:
        role_hierarchy = {"viewer": 1, "member": 2, "admin": 3, "owner": 4}
        user_role_level = role_hierarchy.get(membership.role, 0)
        required_level = role_hierarchy.get(required_role, 0)
        return user_role_level >= required_level
    
    return True

def get_user_accounts(user_id: int, session: Session):
    """Retorna todas as contas do usuário"""
    # Contas onde é membro
    memberships = session.execute(
        select(AccountMember).where(
            AccountMember.user_id == user_id,
            AccountMember.is_active == True
        )
    ).all()
    
    accounts_data = []
    for membership in memberships:
        account = session.get(SharedAccount, membership.account_id)
        if account and account.is_active:
            # Contar membros
            member_count = session.execute(
                select(AccountMember).where(
                    AccountMember.account_id == account.id,
                    AccountMember.is_active == True
                )
            ).all()
            
            # Buscar estatísticas de despesas
            expenses_count = session.execute(
                select(Expense).where(Expense.shared_account_id == account.id)
            ).all()
            
            total_expenses = sum(exp.total_amount for exp in expenses_count)
            
            accounts_data.append({
                "id": account.id,
                "name": account.name,
                "role": membership.role,
                "is_owner": account.owner_id == user_id,
                "member_count": len(member_count),
                "expenses_count": len(expenses_count),
                "total_expenses": total_expenses,
                "created_at": account.created_at.isoformat()
            })
    
    return accounts_data

# ===== ENDPOINTS DE CONTAS COMPARTILHADAS =====

@router.post("/api/accounts")
async def create_shared_account(
    account_data: dict,
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Cria uma nova conta compartilhada"""
    try:
        name = account_data.get("name")
        if not name:
            raise HTTPException(status_code=400, detail="Nome da conta é obrigatório")
        
        # Verificar se já existe conta com mesmo nome para este usuário
        existing_account = session.execute(
            select(SharedAccount).where(
                SharedAccount.owner_id == current_user["user_id"],
                SharedAccount.name == name,
                SharedAccount.is_active == True
            )
        ).first()
        
        if existing_account:
            raise HTTPException(status_code=400, detail="Você já tem uma conta com este nome")
        
        # Criar conta
        account = SharedAccount(
            name=name,
            owner_id=current_user["user_id"]
        )
        session.add(account)
        session.commit()
        session.refresh(account)
        
        # Adicionar criador como membro owner
        owner_member = AccountMember(
            account_id=account.id,
            user_id=current_user["user_id"],
            role="owner"
        )
        session.add(owner_member)
        session.commit()
        
        return {
            "status": "success",
            "message": "Conta compartilhada criada com sucesso",
            "account": {
                "id": account.id,
                "name": account.name,
                "role": "owner",
                "is_owner": True,
                "member_count": 1,
                "expenses_count": 0,
                "total_expenses": 0,
                "created_at": account.created_at.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar conta: {str(e)}")

@router.get("/api/users/accounts")
async def get_user_accounts_list(
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Retorna todas as contas do usuário"""
    try:
        accounts = get_user_accounts(current_user["user_id"], session)
        return {"accounts": accounts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar contas: {str(e)}")

@router.get("/api/accounts/{account_id}")
async def get_account_details(
    account_id: int,
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Retorna detalhes de uma conta específica"""
    try:
        if not check_account_access(account_id, current_user["user_id"], session):
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        account = session.get(SharedAccount, account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Conta não encontrada")
        
        # Buscar membros
        members = session.execute(
            select(AccountMember, User)
            .join(User, AccountMember.user_id == User.id)
            .where(
                AccountMember.account_id == account_id,
                AccountMember.is_active == True
            )
        ).all()
        
        # Buscar estatísticas
        expenses_count = session.execute(
            select(Expense).where(Expense.shared_account_id == account_id)
        ).all()
        
        total_expenses = sum(exp.total_amount for exp in expenses_count)
        
        # Buscar cost centers e categorias usados nesta conta
        cost_centers_used = session.execute(
            select(CostCenter)
            .join(Expense, Expense.cost_center_id == CostCenter.id)
            .where(Expense.shared_account_id == account_id)
            .distinct()
        ).all()
        
        categories_used = session.execute(
            select(Category)
            .join(Expense, Expense.category_id == Category.id)
            .where(Expense.shared_account_id == account_id)
            .distinct()
        ).all()
        
        members_data = []
        for member, user in members:
            members_data.append({
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "role": member.role,
                "joined_at": member.joined_at.isoformat(),
                "is_owner": account.owner_id == user.id
            })
        
        return {
            "account": {
                "id": account.id,
                "name": account.name,
                "owner_id": account.owner_id,
                "created_at": account.created_at.isoformat(),
                "total_expenses": total_expenses,
                "expenses_count": len(expenses_count),
                "members_count": len(members_data)
            },
            "members": members_data,
            "statistics": {
                "cost_centers_used": [cc.name for cc in cost_centers_used],
                "categories_used": [cat.name for cat in categories_used],
                "avg_expense_amount": total_expenses / len(expenses_count) if expenses_count else 0
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar detalhes da conta: {str(e)}")

@router.put("/api/accounts/{account_id}")
async def update_account(
    account_id: int,
    account_data: dict,
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Atualiza informações da conta (apenas owner/admin)"""
    try:
        if not check_account_access(account_id, current_user["user_id"], session, "admin"):
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        
        account = session.get(SharedAccount, account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Conta não encontrada")
        
        if "name" in account_data:
            new_name = account_data["name"].strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="Nome não pode ser vazio")
            
            # Verificar se já existe outra conta com mesmo nome
            existing_account = session.execute(
                select(SharedAccount).where(
                    SharedAccount.owner_id == account.owner_id,
                    SharedAccount.name == new_name,
                    SharedAccount.id != account_id,
                    SharedAccount.is_active == True
                )
            ).first()
            
            if existing_account:
                raise HTTPException(status_code=400, detail="Já existe uma conta com este nome")
            
            account.name = new_name
        
        session.add(account)
        session.commit()
        
        return {"status": "success", "message": "Conta atualizada com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar conta: {str(e)}")

@router.delete("/api/accounts/{account_id}")
async def delete_account(
    account_id: int,
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Exclui uma conta compartilhada (apenas owner)"""
    try:
        account = session.get(SharedAccount, account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Conta não encontrada")
        
        # Verificar se é o owner
        if account.owner_id != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Apenas o proprietário pode excluir a conta")
        
        # Marcar conta como inativa (soft delete)
        account.is_active = False
        
        # Marcar todos os membros como inativos
        members = session.execute(
            select(AccountMember).where(AccountMember.account_id == account_id)
        ).all()
        
        for member in members:
            member.is_active = False
        
        # Cancelar todos os convites pendentes
        pending_invites = session.execute(
            select(AccountInvite).where(
                AccountInvite.account_id == account_id,
                AccountInvite.status == "pending"
            )
        ).all()
        
        for invite in pending_invites:
            invite.status = "cancelled"
        
        session.commit()
        
        return {"status": "success", "message": "Conta excluída com sucesso"}
        
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao excluir conta: {str(e)}")

# ===== ENDPOINTS DE MEMBROS =====

@router.put("/api/accounts/{account_id}/members/{member_user_id}")
async def update_member_role(
    account_id: int,
    member_user_id: int,
    member_data: dict,
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Atualiza role de um membro (apenas owner/admin)"""
    try:
        if not check_account_access(account_id, current_user["user_id"], session, "admin"):
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        
        # Não permitir que admin altere owner
        if member_user_id == current_user["user_id"]:
            raise HTTPException(status_code=400, detail="Não é possível alterar sua própria role")
        
        account = session.get(SharedAccount, account_id)
        if account.owner_id == member_user_id:
            raise HTTPException(status_code=400, detail="Não é possível alterar a role do proprietário")
        
        member = session.execute(
            select(AccountMember).where(
                AccountMember.account_id == account_id,
                AccountMember.user_id == member_user_id,
                AccountMember.is_active == True
            )
        ).first()
        
        if not member:
            raise HTTPException(status_code=404, detail="Membro não encontrado")
        
        new_role = member_data.get("role")
        if new_role not in ["viewer", "member", "admin"]:
            raise HTTPException(status_code=400, detail="Role inválida")
        
        member.role = new_role
        session.add(member)
        session.commit()
        
        return {"status": "success", "message": "Role do membro atualizada com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar membro: {str(e)}")

@router.delete("/api/accounts/{account_id}/members/{member_user_id}")
async def remove_member(
    account_id: int,
    member_user_id: int,
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Remove um membro da conta (apenas owner/admin)"""
    try:
        if not check_account_access(account_id, current_user["user_id"], session, "admin"):
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        
        # Não permitir remover a si mesmo
        if member_user_id == current_user["user_id"]:
            raise HTTPException(status_code=400, detail="Não é possível remover a si mesmo")
        
        account = session.get(SharedAccount, account_id)
        if account.owner_id == member_user_id:
            raise HTTPException(status_code=400, detail="Não é possível remover o proprietário")
        
        member = session.execute(
            select(AccountMember).where(
                AccountMember.account_id == account_id,
                AccountMember.user_id == member_user_id,
                AccountMember.is_active == True
            )
        ).first()
        
        if not member:
            raise HTTPException(status_code=404, detail="Membro não encontrado")
        
        # Marcar como inativo
        member.is_active = False
        session.add(member)
        session.commit()
        
        return {"status": "success", "message": "Membro removido com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao remover membro: {str(e)}")

@router.post("/api/accounts/{account_id}/leave")
async def leave_account(
    account_id: int,
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Sai de uma conta compartilhada"""
    try:
        account = session.get(SharedAccount, account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Conta não encontrada")
        
        # Verificar se é o owner
        if account.owner_id == current_user["user_id"]:
            raise HTTPException(status_code=400, detail="Proprietário não pode sair da conta. Transfira a propriedade ou exclua a conta.")
        
        member = session.execute(
            select(AccountMember).where(
                AccountMember.account_id == account_id,
                AccountMember.user_id == current_user["user_id"],
                AccountMember.is_active == True
            )
        ).first()
        
        if not member:
            raise HTTPException(status_code=404, detail="Você não é membro desta conta")
        
        # Marcar como inativo
        member.is_active = False
        session.add(member)
        session.commit()
        
        return {"status": "success", "message": "Você saiu da conta com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao sair da conta: {str(e)}")

# ===== ENDPOINTS DE CONVITES =====

@router.post("/api/accounts/{account_id}/invites")
async def create_invite(
    account_id: int,
    invite_data: dict,
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Cria um convite para uma conta compartilhada - SISTEMA INTERNO"""
    try:
        if not check_account_access(account_id, current_user["user_id"], session, "admin"):
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        
        email = invite_data.get("email")
        role = invite_data.get("role", "member")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email é obrigatório")
        
        if role not in ["viewer", "member", "admin"]:
            raise HTTPException(status_code=400, detail="Role inválida")
        
        # Verificar se já existe convite pendente
        existing_invite = session.execute(
            select(AccountInvite).where(
                AccountInvite.account_id == account_id,
                AccountInvite.email == email,
                AccountInvite.status == "pending"
            )
        ).first()
        
        if existing_invite:
            raise HTTPException(status_code=400, detail="Já existe um convite pendente para este email")
        
        # Verificar se usuário já é membro
        existing_member = session.execute(
            select(AccountMember).where(
                AccountMember.account_id == account_id,
                AccountMember.user_id == User.id,
                User.email == email,
                AccountMember.is_active == True
            )
        ).first()
        
        if existing_member:
            raise HTTPException(status_code=400, detail="Usuário já é membro desta conta")
        
        # Usar InviteManager para criar o convite
        invite, message = invite_manager.create_invite(
            account_id, email, role, current_user["user_id"], session
        )
        
        if not invite:
            raise HTTPException(status_code=500, detail=f"Erro ao criar convite: {message}")
        
        # Buscar informações para notificação
        account = session.get(SharedAccount, account_id)
        inviter = session.get(User, current_user["user_id"])
        
        # Criar notificação/internal log
        notification_service.create_invite_notification(
            email, inviter.name, account.name, invite.token, session
        )
        
        # Gerar dados para compartilhamento
        share_data = invite_manager.get_invite_share_data(invite.token, session)
        
        return {
            "status": "success", 
            "message": "Convite criado com sucesso! Compartilhe o link ou código abaixo.",
            "invite": {
                "id": invite.id,
                "email": invite.email,
                "role": invite.role,
                "expires_at": invite.expires_at.isoformat(),
                "token": invite.token,
                **share_data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar convite: {str(e)}")

@router.get("/api/invites/{token}")
async def get_invite_info(
    token: str,
    session: Session = Depends(get_session)
):
    """Retorna informações do convite"""
    try:
        validation_result = invite_manager.validate_invite_token(token, session)
        
        if not validation_result["valid"]:
            raise HTTPException(
                status_code=400, 
                detail=validation_result["error"]
            )
        
        invite = validation_result["invite"]
        account = validation_result["account"]
        inviter = validation_result["inviter"]
        
        return {
            "invite": {
                "id": invite.id,
                "email": invite.email,
                "role": invite.role,
                "expires_at": invite.expires_at.isoformat(),
                "account_name": account.name,
                "inviter_name": inviter.name,
                "inviter_email": inviter.email
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar convite: {str(e)}")

@router.get("/api/invites/{token}/share-info")
async def get_invite_share_info(
    token: str, 
    session: Session = Depends(get_session)
):
    """Retorna informações para compartilhar o convite"""
    try:
        share_data = invite_manager.get_invite_share_data(token, session)
        
        if not share_data:
            raise HTTPException(status_code=404, detail="Convite não encontrado")
        
        return {"share_data": share_data}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar informações: {str(e)}")

@router.post("/api/invites/{token}/accept")
async def accept_invite(
    token: str,
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Aceita um convite para conta compartilhada"""
    try:
        validation_result = invite_manager.validate_invite_token(token, session)
        
        if not validation_result["valid"]:
            raise HTTPException(
                status_code=400, 
                detail=validation_result["error"]
            )
        
        invite = validation_result["invite"]
        account = validation_result["account"]
        
        # Verificar se o email do convite corresponde ao usuário logado
        if invite.email != current_user["email"]:
            raise HTTPException(
                status_code=403, 
                detail="Este convite não é para seu email"
            )
        
        # Verificar se já é membro
        existing_member = session.execute(
            select(AccountMember).where(
                AccountMember.account_id == invite.account_id,
                AccountMember.user_id == current_user["user_id"],
                AccountMember.is_active == True
            )
        ).first()
        
        if existing_member:
            # Marcar convite como aceito mesmo que já seja membro
            invite.status = "accepted"
            invite.accepted_by = current_user["user_id"]
            invite.accepted_at = datetime.utcnow()
            session.commit()
            
            return {
                "status": "success", 
                "message": "Você já é membro desta conta",
                "account_id": invite.account_id
            }
        
        # Adicionar como novo membro
        new_member = AccountMember(
            account_id=invite.account_id,
            user_id=current_user["user_id"],
            role=invite.role
        )
        
        # Atualizar convite
        invite.status = "accepted"
        invite.accepted_by = current_user["user_id"]
        invite.accepted_at = datetime.utcnow()
        
        session.add(new_member)
        session.commit()
        
        return {
            "status": "success",
            "message": "Convite aceito com sucesso!",
            "account_id": invite.account_id,
            "account_name": account.name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao aceitar convite: {str(e)}")

@router.post("/api/invites/{invite_id}/cancel")
async def cancel_invite(
    invite_id: int,
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Cancela um convite pendente"""
    try:
        invite = session.get(AccountInvite, invite_id)
        if not invite:
            raise HTTPException(status_code=404, detail="Convite não encontrado")
        
        # Verificar permissão (apenas admin da conta ou quem criou)
        account = session.get(SharedAccount, invite.account_id)
        is_admin = check_account_access(invite.account_id, current_user["user_id"], session, "admin")
        is_creator = invite.created_by == current_user["user_id"]
        
        if not (is_admin or is_creator):
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        
        if invite.status != "pending":
            raise HTTPException(status_code=400, detail="Convite não pode ser cancelado")
        
        invite.status = "cancelled"
        session.commit()
        
        return {"status": "success", "message": "Convite cancelado com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao cancelar convite: {str(e)}")

@router.get("/api/accounts/{account_id}/invites")
async def get_account_invites(
    account_id: int,
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Retorna todos os convites de uma conta"""
    try:
        if not check_account_access(account_id, current_user["user_id"], session, "admin"):
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        
        invites = session.execute(
            select(AccountInvite, User)
            .join(User, AccountInvite.created_by == User.id)
            .where(AccountInvite.account_id == account_id)
            .order_by(AccountInvite.created_at.desc())
        ).all()
        
        invites_data = []
        for invite, inviter in invites:
            accepted_by_user = None
            if invite.accepted_by:
                accepted_by_user = session.get(User, invite.accepted_by)
            
            invites_data.append({
                "id": invite.id,
                "email": invite.email,
                "role": invite.role,
                "status": invite.status,
                "created_at": invite.created_at.isoformat(),
                "expires_at": invite.expires_at.isoformat(),
                "inviter_name": inviter.name,
                "accepted_at": invite.accepted_at.isoformat() if invite.accepted_at else None,
                "accepted_by_name": accepted_by_user.name if accepted_by_user else None,
                "token": invite.token if invite.status == "pending" else None  # Só mostrar token para convites pendentes
            })
        
        return {"invites": invites_data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar convites: {str(e)}")

@router.get("/api/users/pending-invites")
async def get_user_pending_invites(
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Retorna convites pendentes para o usuário atual"""
    try:
        pending_invites = invite_manager.get_user_pending_invites(current_user["email"], session)
        return {"pending_invites": pending_invites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar convites pendentes: {str(e)}")

# ===== ENDPOINTS DE LIMPEZA E MANUTENÇÃO =====

@router.post("/api/admin/cleanup-expired-invites")
async def cleanup_expired_invites(
    session: Session = Depends(get_session),
    current_user: dict = Depends(verify_token)
):
    """Limpa convites expirados (apenas para admin/desenvolvimento)"""
    try:
        # Em produção, adicionar verificação de role de administrador
        cleaned_count = invite_manager.cleanup_expired_invites(session)
        
        return {
            "status": "success",
            "message": f"Limpeza concluída: {cleaned_count} convites expirados removidos"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na limpeza: {str(e)}")