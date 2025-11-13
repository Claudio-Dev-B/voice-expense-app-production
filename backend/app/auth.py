# backend/app/auth.py - SOLUÇÃO DEFINITIVA
from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.responses import RedirectResponse, JSONResponse
from sqlmodel import Session, select
import os
import requests
import json
import logging
from urllib.parse import urlencode
import secrets
from datetime import datetime, timedelta

from .db import get_session
from .security import create_user_token
from .models import User

router = APIRouter()
logger = logging.getLogger(__name__)

# ✅ Store temporary auth states (in production use Redis)
auth_states = {}

@router.get("/api/auth/google/login")
async def google_login(request: Request):
    """Inicia o fluxo OAuth do Google com state parameter"""
    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        
        if not client_id:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"error": "Google OAuth not configured"}
            )

        # ✅ Generate secure state parameter
        state = secrets.token_urlsafe(32)
        auth_states[state] = {
            "created_at": datetime.utcnow(),
            "used": False
        }

        # ✅ Use frontend URL for redirect (CRITICAL FIX)
        frontend_url = os.getenv("FRONTEND_URL", "https://voice-expense-app-production.vercel.app")
        redirect_uri = f"{frontend_url}/api/auth/google/callback"

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

        logger.info(f"🔗 Redirecting to Google OAuth with state: {state}")
        return RedirectResponse(auth_url)

    except Exception as e:
        logger.error(f"❌ Google login error: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Authentication service unavailable"}
        )

@router.get("/api/auth/google/callback")
async def google_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    session: Session = Depends(get_session)
):
    """Callback do Google OAuth - SOLUÇÃO DEFINITIVA"""
    try:
        logger.info(f"📨 Google callback received - state: {state}")

        # ✅ Validate state parameter
        if not state or state not in auth_states:
            logger.error("❌ Invalid or missing state parameter")
            return RedirectResponse("/auth-error?error=invalid_state")

        if auth_states[state]["used"]:
            logger.error("❌ State already used")
            return RedirectResponse("/auth-error?error=state_reused")

        # Mark state as used
        auth_states[state]["used"] = True

        # ✅ Handle OAuth errors
        if error:
            logger.error(f"❌ Google OAuth error: {error}")
            return RedirectResponse(f"/auth-error?error=oauth_{error}")

        if not code:
            logger.error("❌ No authorization code received")
            return RedirectResponse("/auth-error?error=no_code")

        # ✅ Exchange code for tokens
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        frontend_url = os.getenv("FRONTEND_URL", "https://voice-expense-app-production.vercel.app")

        if not client_id or not client_secret:
            logger.error("❌ Google credentials not configured")
            return RedirectResponse("/auth-error?error=misconfigured")

        # ✅ Use frontend URL as redirect_uri (MATCHING Google Cloud Console)
        redirect_uri = f"{frontend_url}/api/auth/google/callback"

        # Exchange code for access token
        token_data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri
        }

        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data=token_data,
            timeout=30
        )

        if token_response.status_code != 200:
            error_msg = token_response.json().get('error_description', 'Token exchange failed')
            logger.error(f"❌ Token exchange failed: {error_msg}")
            return RedirectResponse(f"/auth-error?error=token_exchange")

        token_json = token_response.json()
        access_token = token_json["access_token"]

        # ✅ Get user info from Google
        userinfo_response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30
        )

        if userinfo_response.status_code != 200:
            logger.error("❌ Failed to get user info from Google")
            return RedirectResponse("/auth-error?error=user_info")

        userinfo = userinfo_response.json()

        # ✅ Validate required fields
        if not all([userinfo.get("sub"), userinfo.get("email"), userinfo.get("name")]):
            logger.error("❌ Incomplete user info from Google")
            return RedirectResponse("/auth-error?error=incomplete_info")

        # ✅ Find or create user
        user = session.execute(
            select(User).where(User.google_id == userinfo["sub"])
        ).scalar_one_or_none()

        if not user:
            user = session.execute(
                select(User).where(User.email == userinfo["email"])
            ).scalar_one_or_none()

            if user:
                # Update existing user with Google ID
                user.google_id = userinfo["sub"]
                if userinfo.get("picture"):
                    user.picture = userinfo["picture"]
            else:
                # Create new user
                user = User(
                    email=userinfo["email"],
                    name=userinfo["name"],
                    google_id=userinfo["sub"],
                    picture=userinfo.get("picture")
                )
                session.add(user)

        # Update user information
        if user.name != userinfo["name"]:
            user.name = userinfo["name"]

        if userinfo.get("picture") and user.picture != userinfo["picture"]:
            user.picture = userinfo["picture"]

        session.commit()
        session.refresh(user)

        # ✅ Create JWT token
        jwt_token = create_user_token(user)

        # ✅ Redirect to frontend with success and token
        success_url = f"{frontend_url}/auth-success?token={jwt_token}&user_id={user.id}"
        
        logger.info(f"✅ Authentication successful for user: {user.email}")
        return RedirectResponse(success_url)

    except Exception as e:
        logger.error(f"💥 Critical error in Google callback: {str(e)}")
        frontend_url = os.getenv("FRONTEND_URL", "https://voice-expense-app-production.vercel.app")
        error_url = f"{frontend_url}/auth-error?error=server_error"
        return RedirectResponse(error_url)

@router.get("/api/auth/verify")
async def verify_token(
    token: str = None,
    session: Session = Depends(get_session)
):
    """Verify JWT token and return user info"""
    try:
        from .security import verify_token
        
        if not token:
            raise HTTPException(status_code=400, detail="Token required")
        
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = session.get(User, payload.get("user_id"))
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
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
        logger.error(f"Token verification error: {str(e)}")
        raise HTTPException(status_code=401, detail="Token verification failed")

# Cleanup expired states (run periodically)
def cleanup_expired_states():
    """Remove expired auth states"""
    now = datetime.utcnow()
    expired_states = [
        state for state, data in auth_states.items()
        if now - data["created_at"] > timedelta(minutes=10)
    ]
    for state in expired_states:
        auth_states.pop(state, None)