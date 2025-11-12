# backend/app/security.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlmodel import Session, select
import os

from .db import get_session
from .models import User

# Configurações JWT
SECRET_KEY = os.getenv("JWT_SECRET", "your-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 horas

security = HTTPBearer()

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Cria um JWT token de acesso"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str = Depends(security)):
    """Verifica e decodifica um JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        
        if email is None or user_id is None:
            raise credentials_exception
            
        return {"email": email, "user_id": user_id}
    except JWTError:
        raise credentials_exception

def get_current_user(
    token: str = Depends(security),
    session: Session = Depends(get_session)
):
    """Obtém o usuário atual baseado no token JWT"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        
        if email is None or user_id is None:
            raise credentials_exception
        
        # Buscar usuário no banco
        user = session.get(User, user_id)
        if user is None or user.email != email:
            raise credentials_exception
            
        return user
    except JWTError:
        raise credentials_exception

def create_user_token(user: User):
    """Cria token JWT para um usuário"""
    data = {
        "sub": user.email,
        "user_id": user.id,
        "name": user.name,
        "email": user.email
    }
    return create_access_token(data)

# Funções de utilidade para verificação de permissões
def require_owner(user_id: int, target_user_id: int):
    """Verifica se o usuário é o proprietário do recurso"""
    if user_id != target_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

def require_active_user(user: User):
    """Verifica se o usuário está ativo"""
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

# Google OAuth verification (será implementado posteriormente)
async def verify_google_token(access_token: str):
    """Verifica um token do Google OAuth"""
    # Esta função será implementada quando integrarmos o Google Auth real
    # Por enquanto, retorna dados mock para desenvolvimento
    try:
        # TODO: Implementar verificação real com Google API
        # from google.oauth2 import id_token
        # from google.auth.transport import requests
        
        # GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
        # idinfo = id_token.verify_oauth2_token(
        #     access_token, 
        #     requests.Request(), 
        #     GOOGLE_CLIENT_ID
        # )
        
        # return {
        #     "email": idinfo['email'],
        #     "name": idinfo['name'],
        #     "google_id": idinfo['sub'],
        #     "picture": idinfo.get('picture')
        # }
        
        # Mock data para desenvolvimento
        return {
            "email": "usuario@gmail.com",
            "name": "Usuário Google",
            "google_id": "google_123456",
            "picture": None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}"
        )

# Middleware para logging de autenticação
def log_auth_attempt(email: str, success: bool, ip: str = None):
    """Registra tentativas de autenticação"""
    # Em produção, integrar com sistema de logging
    status = "SUCCESS" if success else "FAILED"
    log_message = f"AUTH {status} - Email: {email}"
    if ip:
        log_message += f" - IP: {ip}"
    print(log_message)  # Substituir por logger apropriado

# Função para renovação de token
def refresh_access_token(refresh_token: str):
    """Renova um token de acesso usando refresh token"""
    # TODO: Implementar sistema de refresh tokens
    # Por enquanto, retorna erro
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Token refresh not implemented"
    )

# Validação de escopos (para futuras implementações)
def validate_scope(token_payload: dict, required_scope: str):
    """Valida se o token possui o escopo necessário"""
    # TODO: Implementar sistema de escopos quando necessário
    token_scopes = token_payload.get("scopes", [])
    if required_scope not in token_scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Required scope: {required_scope}"
        )

# Rate limiting helper (para futuras implementações)
def check_rate_limit(user_id: int, endpoint: str):
    """Verifica limites de taxa para usuário/endpoint"""
    # TODO: Implementar rate limiting com Redis
    # Por enquanto, sempre permite
    return True

# Security headers middleware (para ser usado no main.py)
def add_security_headers():
    """Retorna headers de segurança para respostas"""
    return {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
    }