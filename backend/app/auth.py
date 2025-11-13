# backend/app/auth.py - VERSÃO COMPLETA REVISADA E CORRIGIDA
from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.responses import RedirectResponse, JSONResponse, HTMLResponse
from sqlmodel import Session, select
import os
import requests
import json
import logging
from urllib.parse import urlencode
import secrets
from datetime import datetime, timedelta

from .db import get_session
from .security import create_user_token, verify_token
from .models import User

router = APIRouter()
logger = logging.getLogger(__name__)

# Store temporary auth states (in production, use Redis)
auth_states = {}

def get_backend_url():
    """Get backend URL with fallback"""
    return os.getenv("RAILWAY_STATIC_URL", "https://voice-expense-app-production-production.up.railway.app")

def get_frontend_url():
    """Get frontend URL with fallback"""
    return os.getenv("FRONTEND_URL", "https://voice-expense-app-production.vercel.app")

@router.get("/api/auth/google/login")
async def google_login(request: Request):
    """Inicia o fluxo OAuth do Google com state parameter"""
    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        
        if not client_id:
            logger.error("❌ Google OAuth not configured - GOOGLE_CLIENT_ID missing")
            return HTMLResponse("""
            <html>
                <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                    <h1 style="color: #dc2626;">❌ Erro de Configuração</h1>
                    <p>Google OAuth não está configurado corretamente.</p>
                    <button onclick="window.close()">Fechar</button>
                </body>
            </html>
            """)

        # ✅ Generate secure state parameter
        state = secrets.token_urlsafe(32)
        auth_states[state] = {
            "created_at": datetime.utcnow(),
            "used": False
        }

        # ✅ CRITICAL FIX: Use BACKEND URL as redirect_uri for OAuth flow
        backend_url = get_backend_url()
        redirect_uri = f"{backend_url}/api/auth/google/callback"

        logger.info(f"🔗 OAuth Configuration:")
        logger.info(f"   Client ID: {client_id[:10]}...")
        logger.info(f"   Redirect URI: {redirect_uri}")
        logger.info(f"   State: {state}")

        # ✅ Google OAuth URL with proper parameters
        auth_url = (
            "https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={client_id}&"
            f"redirect_uri={requests.utils.quote(redirect_uri)}&"
            f"response_type=code&"
            f"scope=email profile&"
            f"state={state}&"
            f"access_type=offline&"
            f"prompt=consent"
        )

        logger.info("🚀 Redirecting to Google OAuth")
        return RedirectResponse(auth_url)

    except Exception as e:
        logger.error(f"💥 Google login error: {str(e)}")
        return HTMLResponse(f"""
        <html>
            <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                <h1 style="color: #dc2626;">❌ Erro no Login</h1>
                <p>Erro ao iniciar autenticação com Google: {str(e)}</p>
                <button onclick="window.close()">Fechar</button>
            </body>
        </html>
        """)

@router.get("/api/auth/google/callback")
async def google_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    error_description: str = None,
    session: Session = Depends(get_session)
):
    """Callback do Google OAuth - VERSÃO CORRIGIDA"""
    try:
        logger.info(f"📨 Google callback received - State: {state}")

        # ✅ Validate state parameter
        if not state:
            logger.error("❌ Missing state parameter")
            return RedirectResponse(f"{get_frontend_url()}/auth-error?error=missing_state")

        if state not in auth_states:
            logger.error(f"❌ Invalid state parameter: {state}")
            return RedirectResponse(f"{get_frontend_url()}/auth-error?error=invalid_state")

        if auth_states[state]["used"]:
            logger.error("❌ State already used")
            return RedirectResponse(f"{get_frontend_url()}/auth-error?error=state_reused")

        # Mark state as used
        auth_states[state]["used"] = True

        # ✅ Handle OAuth errors from Google
        if error:
            error_msg = error_description or error
            logger.error(f"❌ Google OAuth error: {error_msg}")
            return RedirectResponse(f"{get_frontend_url()}/auth-error?error=oauth_{error}")

        if not code:
            logger.error("❌ No authorization code received")
            return RedirectResponse(f"{get_frontend_url()}/auth-error?error=no_code")

        # ✅ Get Google credentials
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

        if not client_id or not client_secret:
            logger.error("❌ Google credentials not configured")
            return RedirectResponse(f"{get_frontend_url()}/auth-error?error=misconfigured")

        # ✅ CRITICAL: Use the SAME redirect_uri as in login step
        backend_url = get_backend_url()
        redirect_uri = f"{backend_url}/api/auth/google/callback"

        logger.info(f"🔄 Exchanging code for tokens...")
        logger.info(f"   Redirect URI: {redirect_uri}")
        logger.info(f"   Code length: {len(code)}")

        # ✅ Exchange code for access token
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri  # ✅ MUST MATCH login redirect_uri
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            },
            timeout=30
        )

        if token_response.status_code != 200:
            error_data = token_response.json()
            error_msg = error_data.get('error_description', error_data.get('error', 'Token exchange failed'))
            logger.error(f"❌ Token exchange failed: {error_msg}")
            logger.error(f"   Response: {error_data}")
            return RedirectResponse(f"{get_frontend_url()}/auth-error?error=token_exchange")

        token_json = token_response.json()
        access_token = token_json.get("access_token")
        
        if not access_token:
            logger.error("❌ No access token in response")
            return RedirectResponse(f"{get_frontend_url()}/auth-error?error=no_access_token")

        logger.info("✅ Access token obtained successfully")

        # ✅ Get user info from Google
        logger.info("👤 Getting user info from Google...")
        userinfo_response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json"
            },
            timeout=30
        )

        if userinfo_response.status_code != 200:
            logger.error(f"❌ Failed to get user info: {userinfo_response.status_code}")
            return RedirectResponse(f"{get_frontend_url()}/auth-error?error=user_info_failed")

        userinfo = userinfo_response.json()
        logger.info(f"✅ User info obtained: {userinfo.get('email', 'No email')}")

        # ✅ Validate required fields
        required_fields = ['sub', 'email', 'name']
        missing_fields = [field for field in required_fields if not userinfo.get(field)]
        
        if missing_fields:
            logger.error(f"❌ Incomplete user info. Missing: {missing_fields}")
            return RedirectResponse(f"{get_frontend_url()}/auth-error?error=incomplete_info")

        # ✅ Find or create user in database
        logger.info("💾 Processing user in database...")
        user = session.execute(
            select(User).where(User.google_id == userinfo["sub"])
        ).scalar_one_or_none()

        if not user:
            # Try to find by email as fallback
            user = session.execute(
                select(User).where(User.email == userinfo["email"])
            ).scalar_one_or_none()

            if user:
                logger.info(f"🔄 User found by email, updating Google ID: {userinfo['email']}")
                user.google_id = userinfo["sub"]
                if userinfo.get("picture"):
                    user.picture = userinfo["picture"]
                session.add(user)
            else:
                logger.info(f"🆕 Creating new user: {userinfo['email']}")
                user = User(
                    email=userinfo["email"],
                    name=userinfo["name"],
                    google_id=userinfo["sub"],
                    picture=userinfo.get("picture")
                )
                session.add(user)
        else:
            logger.info(f"✅ Existing user found: {user.email}")

        # ✅ Update user information if changed
        if user.name != userinfo["name"]:
            logger.info(f"✏️ Updating user name: {user.name} -> {userinfo['name']}")
            user.name = userinfo["name"]

        if userinfo.get("picture") and user.picture != userinfo["picture"]:
            logger.info("🖼️ Updating user picture")
            user.picture = userinfo["picture"]

        session.commit()
        session.refresh(user)

        logger.info(f"✅ User processed successfully: {user.email} (ID: {user.id})")

        # ✅ Create JWT token
        jwt_token = create_user_token(user)
        logger.info("✅ JWT token created successfully")

        # ✅ Redirect to frontend with success and token
        frontend_url = get_frontend_url()
        success_url = f"{frontend_url}/auth-success?token={jwt_token}&user_id={user.id}"
        
        logger.info(f"🎉 Authentication successful! Redirecting to: {frontend_url}")
        return RedirectResponse(success_url)

    except requests.exceptions.Timeout:
        logger.error("⏰ Request timeout during Google OAuth")
        return RedirectResponse(f"{get_frontend_url()}/auth-error?error=timeout")
    except requests.exceptions.RequestException as e:
        logger.error(f"🌐 Network error during Google OAuth: {str(e)}")
        return RedirectResponse(f"{get_frontend_url()}/auth-error?error=network_error")
    except Exception as e:
        logger.error(f"💥 Critical error in Google callback: {str(e)}", exc_info=True)
        return RedirectResponse(f"{get_frontend_url()}/auth-error?error=server_error")

@router.get("/api/auth/verify")
async def verify_token(
    token: str = None,
    session: Session = Depends(get_session)
):
    """Verify JWT token and return user info"""
    try:
        logger.info(f"🔐 Token verification requested")
        
        if not token:
            logger.error("❌ No token provided for verification")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token required")
        
        # Verify token
        payload = verify_token(token)
        if not payload:
            logger.error("❌ Invalid token provided")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        
        # Get user from database
        user_id = payload.get("user_id")
        if not user_id:
            logger.error("❌ No user_id in token payload")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        
        user = session.get(User, user_id)
        if not user:
            logger.error(f"❌ User not found for ID: {user_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        logger.info(f"✅ Token verified for user: {user.email}")
        
        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "onboarding_completed": user.onboarding_completed,
                "user_type": user.user_type.value if hasattr(user.user_type, 'value') else user.user_type
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Token verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Token verification failed"
        )

@router.get("/api/auth/health")
async def auth_health():
    """Health check for auth service"""
    return {
        "status": "healthy",
        "service": "auth",
        "timestamp": datetime.utcnow().isoformat(),
        "google_configured": bool(os.getenv("GOOGLE_CLIENT_ID")),
        "frontend_url": get_frontend_url(),
        "backend_url": get_backend_url()
    }

@router.post("/api/auth/logout")
async def logout(request: Request):
    """Logout endpoint"""
    try:
        client_ip = request.client.host if request.client else "unknown"
        logger.info(f"🔒 Logout requested from IP: {client_ip}")
        
        return {
            "status": "success", 
            "message": "Logout realizado com sucesso"
        }
    except Exception as e:
        logger.error(f"❌ Logout error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro durante logout"
        )

@router.get("/api/auth/debug")
async def debug_auth():
    """Debug endpoint for auth configuration"""
    return {
        "google_client_id": os.getenv("GOOGLE_CLIENT_ID", "Not configured"),
        "google_client_secret": "***" if os.getenv("GOOGLE_CLIENT_SECRET") else "Not configured",
        "frontend_url": get_frontend_url(),
        "backend_url": get_backend_url(),
        "active_states": len(auth_states),
        "timestamp": datetime.utcnow().isoformat()
    }

# Background task to cleanup expired states
def cleanup_expired_states():
    """Remove expired auth states (run this periodically)"""
    try:
        now = datetime.utcnow()
        expired_states = [
            state for state, data in auth_states.items()
            if now - data["created_at"] > timedelta(minutes=10)
        ]
        
        for state in expired_states:
            auth_states.pop(state, None)
            
        if expired_states:
            logger.info(f"🧹 Cleaned up {len(expired_states)} expired auth states")
            
    except Exception as e:
        logger.error(f"❌ Error cleaning up auth states: {str(e)}")