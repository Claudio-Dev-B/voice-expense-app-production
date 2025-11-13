# backend/app/security.py
import jwt
from datetime import datetime, timedelta
from typing import Optional
import os
import requests

# Configurações JWT
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "sua-chave-secreta-padrao-mude-em-producao")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_user_token(user):
    """
    Cria JWT token para usuário
    
    Args:
        user: Objeto User do SQLModel
    
    Returns:
        str: JWT token codificado
    """
    try:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode = {
            "user_id": user.id,
            "email": user.email,
            "exp": expire
        }
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    except Exception as e:
        print(f"Erro ao criar token JWT: {e}")
        raise

def verify_token(token: str) -> Optional[dict]:
    """
    Verifica e decodifica JWT token
    
    Args:
        token (str): JWT token a ser verificado
    
    Returns:
        Optional[dict]: Payload decodificado ou None se inválido
    """
    try:
        if not token:
            return None
            
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Verificar se o token expirou
        exp_timestamp = payload.get("exp")
        if exp_timestamp is None:
            return None
            
        exp_datetime = datetime.fromtimestamp(exp_timestamp)
        if datetime.utcnow() > exp_datetime:
            return None
            
        return payload
        
    except jwt.ExpiredSignatureError:
        print("Token JWT expirado")
        return None
    except jwt.InvalidTokenError:
        print("Token JWT inválido")
        return None
    except Exception as e:
        print(f"Erro ao verificar token: {e}")
        return None

async def verify_google_token(access_token: str) -> dict:
    """
    Verifica token do Google OAuth e retorna informações do usuário
    
    Args:
        access_token (str): Access token do Google OAuth
    
    Returns:
        dict: Informações do usuário do Google
    
    Raises:
        Exception: Se a verificação falhar
    """
    try:
        response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            error_detail = response.json().get('error_description', 'Erro desconhecido')
            raise Exception(f"Falha na verificação do Google: {error_detail}")
        
        user_info = response.json()
        
        # Validar campos obrigatórios
        required_fields = ['sub', 'email', 'name']
        for field in required_fields:
            if field not in user_info:
                raise Exception(f"Campo obrigatório '{field}' não encontrado na resposta do Google")
        
        return {
            "email": user_info["email"],
            "name": user_info["name"],
            "google_id": user_info["sub"],
            "picture": user_info.get("picture")
        }
        
    except requests.exceptions.Timeout:
        raise Exception("Timeout ao conectar com Google OAuth")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Erro de rede ao verificar token Google: {str(e)}")
    except Exception as e:
        raise Exception(f"Erro ao verificar token Google: {str(e)}")

def log_auth_attempt(email: str, success: bool, ip: str):
    """
    Log de tentativas de autenticação
    
    Args:
        email (str): Email do usuário
        success (bool): Se a autenticação foi bem-sucedida
        ip (str): Endereço IP do cliente
    """
    status = "SUCESSO" if success else "FALHA"
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"AUTH {status} - Email: {email} - IP: {ip} - Time: {timestamp}")

def get_current_user_from_token(token: str, session):
    """
    Obtém o usuário atual baseado no token JWT
    
    Args:
        token (str): JWT token
        session: Sessão do banco de dados
    
    Returns:
        User: Objeto User ou None se não encontrado
    """
    from .models import User
    
    payload = verify_token(token)
    if not payload:
        return None
        
    user_id = payload.get("user_id")
    if not user_id:
        return None
        
    try:
        user = session.get(User, user_id)
        return user
    except Exception as e:
        print(f"Erro ao buscar usuário: {e}")
        return None

# Função de compatibilidade para manter o código existente
def get_current_user(session, token: str = None):
    """
    Função de compatibilidade para Depends do FastAPI
    
    Args:
        session: Sessão do banco de dados
        token (str): JWT token (opcional)
    
    Returns:
        User: Objeto User
    """
    from fastapi import HTTPException, Depends
    from .db import get_session
    
    if token is None:
        # Para uso com Depends
        async def dependency(sess: Session = Depends(get_session), token: str = Depends(verify_token_from_header)):
            return get_current_user_from_token(token, sess)
        return Depends(dependency)
    else:
        # Para uso direto
        user = get_current_user_from_token(token, session)
        if not user:
            raise HTTPException(status_code=401, detail="Token inválido ou expirado")
        return user

async def verify_token_from_header(request):
    """
    Extrai e verifica token do header Authorization
    
    Args:
        request: Request do FastAPI
    
    Returns:
        str: Token se válido
    
    Raises:
        HTTPException: Se o token for inválido ou não fornecido
    """
    from fastapi import HTTPException
    
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(status_code=401, detail="Token de autorização não fornecido")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Esquema de autenticação inválido")
        
        if not verify_token(token):
            raise HTTPException(status_code=401, detail="Token inválido ou expirado")
            
        return token
        
    except ValueError:
        raise HTTPException(status_code=401, detail="Header Authorization mal formatado")