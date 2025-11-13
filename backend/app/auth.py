# backend/app/auth.py - VERSÃO SEGURA E VERIFICADA
from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.responses import RedirectResponse, JSONResponse
from sqlmodel import Session, select
import os
import requests
import secrets
from datetime import datetime, timedelta
import logging

from .db import get_session
from .security import create_user_token, verify_token
from .models import User

router = APIRouter()
logger = logging.getLogger(__name__)

# Store temporary auth states
auth_states = {}

def get_backend_url():
    """Get backend URL with fallback"""
    return os.getenv("RAILWAY_STATIC_URL", "https://voice-expense-app-production-production.up.railway.app")

def get_frontend_url():
    """Get frontend URL with fallback"""
    return os.getenv("FRONTEND_URL", "https://voice-expense-app-production.vercel.app")

@router.get("/api/auth/google/login")
async def google_login(request: Request):
    """Inicia o fluxo OAuth do Google - VERSÃO SEGURA"""
    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        
        if not client_id:
            logger.error("❌ GOOGLE_CLIENT_ID não configurado")
            return JSONResponse(
                status_code=500,
                content={"error": "Google OAuth não configurado"}
            )

        # ✅ Generate secure state
        state = secrets.token_urlsafe(32)
        auth_states[state] = {
            "created_at": datetime.utcnow(),
            "used": False
        }

        # ✅ Use backend URL for OAuth flow
        backend_url = get_backend_url()
        redirect_uri = f"{backend_url}/api/auth/google/callback"

        logger.info(f"🔗 Iniciando OAuth com redirect_uri: {redirect_uri}")

        # ✅ Google OAuth URL with minimal, safe parameters
        auth_params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
            "state": state,
            "access_type": "online",  # Changed from offline to online
            "prompt": "select_account"  # Changed from consent to select_account
        }

        auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + "&".join(
            [f"{k}={requests.utils.quote(v)}" for k, v in auth_params.items()]
        )

        logger.info("🚀 Redirecionando para Google OAuth")
        return RedirectResponse(auth_url)

    except Exception as e:
        logger.error(f"💥 Erro no login Google: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Serviço de autenticação indisponível"}
        )

@router.get("/api/auth/google/callback")
async def google_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    error_description: str = None,
    session: Session = Depends(get_session)
):
    """Callback do Google OAuth - VERSÃO SEGURA"""
    try:
        logger.info(f"📨 Callback recebido - state: {state}")

        # ✅ Validate state
        if not state or state not in auth_states:
            logger.error("❌ State inválido ou ausente")
            return RedirectResponse(f"{get_frontend_url()}?auth_error=invalid_state")

        if auth_states[state]["used"]:
            logger.error("❌ State já utilizado")
            return RedirectResponse(f"{get_frontend_url()}?auth_error=state_reused")

        auth_states[state]["used"] = True

        # ✅ Handle Google errors
        if error:
            logger.error(f"❌ Erro do Google: {error} - {error_description}")
            return RedirectResponse(f"{get_frontend_url()}?auth_error=google_{error}")

        if not code:
            logger.error("❌ Código de autorização não recebido")
            return RedirectResponse(f"{get_frontend_url()}?auth_error=no_code")

        # ✅ Get credentials
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

        if not client_id or not client_secret:
            logger.error("❌ Credenciais do Google não configuradas")
            return RedirectResponse(f"{get_frontend_url()}?auth_error=misconfigured")

        # ✅ Use same redirect_uri as login
        backend_url = get_backend_url()
        redirect_uri = f"{backend_url}/api/auth/google/callback"

        logger.info("🔄 Trocando código por token...")

        # ✅ Exchange code for token
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30
        )

        if token_response.status_code != 200:
            error_data = token_response.json()
            error_msg = error_data.get('error_description', 'Falha na troca de token')
            logger.error(f"❌ Falha na troca de token: {error_msg}")
            return RedirectResponse(f"{get_frontend_url()}?auth_error=token_failed")

        token_data = token_response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            logger.error("❌ Access token não recebido")
            return RedirectResponse(f"{get_frontend_url()}?auth_error=no_token")

        logger.info("✅ Access token obtido")

        # ✅ Get user info
        userinfo_response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30
        )

        if userinfo_response.status_code != 200:
            logger.error("❌ Falha ao obter informações do usuário")
            return RedirectResponse(f"{get_frontend_url()}?auth_error=user_info")

        userinfo = userinfo_response.json()

        # ✅ Validate required fields
        if not all([userinfo.get("sub"), userinfo.get("email"), userinfo.get("name")]):
            logger.error("❌ Informações do usuário incompletas")
            return RedirectResponse(f"{get_frontend_url()}?auth_error=incomplete_info")

        # ✅ Find or create user
        user = session.execute(
            select(User).where(User.google_id == userinfo["sub"])
        ).scalar_one_or_none()

        if not user:
            user = session.execute(
                select(User).where(User.email == userinfo["email"])
            ).scalar_one_or_none()

            if user:
                user.google_id = userinfo["sub"]
                if userinfo.get("picture"):
                    user.picture = userinfo["picture"]
            else:
                user = User(
                    email=userinfo["email"],
                    name=userinfo["name"],
                    google_id=userinfo["sub"],
                    picture=userinfo.get("picture")
                )
                session.add(user)

        # Update user info
        if user.name != userinfo["name"]:
            user.name = userinfo["name"]

        if userinfo.get("picture") and user.picture != userinfo["picture"]:
            user.picture = userinfo["picture"]

        session.commit()
        session.refresh(user)

        # ✅ Create JWT token
        jwt_token = create_user_token(user)

        # ✅ Redirect to frontend with token
        frontend_url = get_frontend_url()
        success_url = f"{frontend_url}?auth_success=true&token={jwt_token}&user_id={user.id}"
        
        logger.info(f"✅ Autenticação bem-sucedida para: {user.email}")
        return RedirectResponse(success_url)

    except Exception as e:
        logger.error(f"💥 Erro crítico no callback: {str(e)}")
        return RedirectResponse(f"{get_frontend_url()}?auth_error=server_error")

@router.get("/api/auth/verify")
async def verify_token(
    token: str = None,
    session: Session = Depends(get_session)
):
    """Verify JWT token and return user info"""
    try:
        if not token:
            raise HTTPException(status_code=400, detail="Token necessário")
        
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        user = session.get(User, payload.get("user_id"))
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "onboarding_completed": user.onboarding_completed,
                "user_type": user.user_type
            }
        }
        
    except Exception as e:
        logger.error(f"Erro na verificação do token: {str(e)}")
        raise HTTPException(status_code=401, detail="Falha na verificação do token")

# Cleanup function
def cleanup_expired_states():
    """Remove expired auth states"""
    now = datetime.utcnow()
    expired_states = [
        state for state, data in auth_states.items()
        if now - data["created_at"] > timedelta(minutes=10)
    ]
    for state in expired_states:
        auth_states.pop(state, None)