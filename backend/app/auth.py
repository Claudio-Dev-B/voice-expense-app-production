# backend/app/auth.py
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlmodel import Session, select
import os
from datetime import timedelta
import urllib.parse
import requests
from fastapi.responses import RedirectResponse, HTMLResponse

from .db import get_session
from .security import verify_google_token, create_user_token, log_auth_attempt
from .models import User

router = APIRouter()

class GoogleAuthRequest:
    def __init__(self, access_token: str, email: str = None, name: str = None, google_id: str = None, picture: str = None):
        self.access_token = access_token
        self.email = email
        self.name = name
        self.google_id = google_id
        self.picture = picture

@router.get("/api/auth/google/login") 
async def google_login(request: Request):
    """Redireciona para o Google OAuth ou mostra página de login"""
    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        
        if not client_id:
            # Se não configurado, mostrar página de erro
            return HTMLResponse("""
            <html>
                <body>
                    <h1>Google OAuth não configurado</h1>
                    <p>Variáveis de ambiente GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não estão configuradas.</p>
                    <button onclick="window.close()">Fechar</button>
                </body>
            </html>
            """)
        redirect_uri = str(request.url_for("google_callback"))
        print("Redirect URI gerado:", redirect_uri) 
        # Parâmetros para o Google OAuth
        redirect_uri = f"{request.base_url}api/auth/google/callback"
        scope = "email profile openid"
        
        google_auth_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={client_id}&"
            f"redirect_uri={urllib.parse.quote(redirect_uri)}&"
            f"response_type=code&"
            f"scope={urllib.parse.quote(scope)}&"
            f"access_type=offline&"
            f"prompt=consent"
        )
        
        return RedirectResponse(google_auth_url)
        
    except Exception as e:
        return HTMLResponse(f"""
        <html>
            <body>
                <h1>Erro no login</h1>
                <p>{str(e)}</p>
                <button onclick="window.close()">Fechar</button>
            </body>
        </html>
        """)

@router.get("/api/auth/google/callback")
async def google_callback(code: str, request: Request, session: Session = Depends(get_session)):
    """Callback do Google OAuth"""
    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        
        if not client_id or not client_secret:
            return HTMLResponse("""
            <html>
                <body>
                    <h1>Erro de configuração</h1>
                    <p>Credenciais do Google não configuradas.</p>
                    <button onclick="window.close()">Fechar</button>
                </body>
            </html>
            """)
        
        # Trocar code por access token
        token_url = "https://oauth2.googleapis.com/token"
        redirect_uri = f"{request.base_url}api/auth/google/callback"
        
        token_response = requests.post(token_url, data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri
        })
        
        token_data = token_response.json()
        
        if "error" in token_data:
            return HTMLResponse(f"""
            <html>
                <body>
                    <h1>Erro no Google OAuth</h1>
                    <p>{token_data['error']}</p>
                    <button onclick="window.close()">Fechar</button>
                </body>
            </html>
            """)
        
        access_token = token_data["access_token"]
        
        # Obter informações do usuário
        userinfo_response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if userinfo_response.status_code != 200:
            return HTMLResponse("""
            <html>
                <body>
                    <h1>Erro ao obter informações do usuário</h1>
                    <p>Não foi possível obter informações do Google.</p>
                    <button onclick="window.close()">Fechar</button>
                </body>
            </html>
            """)
        
        userinfo = userinfo_response.json()
        
        # Validar dados obrigatórios
        if not all([userinfo.get("sub"), userinfo.get("email"), userinfo.get("name")]):
            return HTMLResponse("""
            <html>
                <body>
                    <h1>Dados incompletos do Google</h1>
                    <p>Não foi possível obter todas as informações necessárias.</p>
                    <button onclick="window.close()">Fechar</button>
                </body>
            </html>
            """)
        
        # Buscar ou criar usuário
        user = session.exec(
            select(User).where(User.google_id == userinfo["sub"])
        ).first()
        
        if not user:
            # Buscar por email
            user = session.exec(
                select(User).where(User.email == userinfo["email"])
            ).first()
            
            if user:
                # Usuário existe mas não tem Google ID - atualizar
                user.google_id = userinfo["sub"]
                if userinfo.get("picture"):
                    user.picture = userinfo["picture"]
            else:
                # Criar novo usuário
                user = User(
                    email=userinfo["email"],
                    name=userinfo["name"],
                    google_id=userinfo["sub"],
                    picture=userinfo.get("picture")
                )
                session.add(user)
        
        # Atualizar informações
        if user.name != userinfo["name"]:
            user.name = userinfo["name"]
        
        if userinfo.get("picture") and user.picture != userinfo["picture"]:
            user.picture = userinfo["picture"]
        
        session.commit()
        session.refresh(user)
        
        # Criar JWT token
        jwt_token = create_user_token(user)
        
        # HTML que envia mensagem para o window opener e fecha
        # CORREÇÃO: Remover f-strings complexas com backslashes
        base_url = str(request.base_url)
        html_content = f"""
        <html>
            <body>
                <script>
                    if (window.opener && !window.opener.closed) {{
                        window.opener.postMessage({{
                            type: 'GOOGLE_AUTH_SUCCESS',
                            user: {{
                                id: {user.id},
                                email: "{user.email}",
                                name: "{user.name.replace('"', '&quot;')}",
                                picture: "{user.picture or ''}",
                                onboarding_completed: {str(user.onboarding_completed).lower()},
                                user_type: "{user.user_type}"
                            }},
                            token: "{jwt_token}"
                        }}, "{base_url}");
                    }}
                    window.close();
                </script>
                <p>Login realizado com sucesso! Você pode fechar esta janela.</p>
                <button onclick="window.close()">Fechar</button>
            </body>
        </html>
        """
        
        return HTMLResponse(html_content)
        
    except Exception as e:
        error_message = str(e).replace('"', '&quot;')
        error_html = f"""
        <html>
            <body>
                <script>
                    if (window.opener && !window.opener.closed) {{
                        window.opener.postMessage({{
                            type: 'GOOGLE_AUTH_ERROR',
                            error: "Erro no servidor: {error_message}"
                        }}, "*");
                    }}
                </script>
                <h1>Erro no login</h1>
                <p>{str(e)}</p>
                <button onclick="window.close()">Fechar</button>
            </body>
        </html>
        """
        return HTMLResponse(error_html)

@router.post("/api/auth/google")
async def google_auth(
    request: Request,
    auth_data: dict,
    session: Session = Depends(get_session)
):
    """Autenticação com Google OAuth (endpoint alternativo)"""
    try:
        access_token = auth_data.get("access_token")
        email = auth_data.get("email")
        name = auth_data.get("name")
        google_id = auth_data.get("google_id")
        picture = auth_data.get("picture")
        
        if not access_token:
            raise HTTPException(status_code=400, detail="Access token é obrigatório")
        
        # Obter IP do cliente para logging
        client_ip = request.client.host if request.client else "unknown"
        
        # Verificar token com Google (ou usar dados mock em desenvolvimento)
        if os.getenv("ENVIRONMENT") == "production":
            # Em produção, verificar token real com Google
            google_user_info = await verify_google_token(access_token)
        else:
            # Em desenvolvimento, usar dados fornecidos
            if not all([email, name, google_id]):
                raise HTTPException(status_code=400, detail="Em desenvolvimento, email, name e google_id são obrigatórios")
            
            google_user_info = {
                "email": email,
                "name": name,
                "google_id": google_id,
                "picture": picture
            }
        
        # Buscar usuário existente pelo Google ID
        user = session.exec(
            select(User).where(User.google_id == google_user_info["google_id"])
        ).first()
        
        if not user:
            # Se não encontrou pelo Google ID, buscar pelo email
            user = session.exec(
                select(User).where(User.email == google_user_info["email"])
            ).first()
            
            if user:
                # Usuário existe mas não tem Google ID - atualizar
                user.google_id = google_user_info["google_id"]
                if google_user_info.get("picture"):
                    user.picture = google_user_info["picture"]
            else:
                # Criar novo usuário
                user = User(
                    email=google_user_info["email"],
                    name=google_user_info["name"],
                    google_id=google_user_info["google_id"],
                    picture=google_user_info.get("picture")
                )
                session.add(user)
        
        # Atualizar informações do usuário se necessário
        if user.name != google_user_info["name"]:
            user.name = google_user_info["name"]
        
        if google_user_info.get("picture") and user.picture != google_user_info["picture"]:
            user.picture = google_user_info["picture"]
        
        session.commit()
        session.refresh(user)
        
        # Criar JWT token
        jwt_token = create_user_token(user)
        
        # Log de sucesso
        log_auth_attempt(user.email, True, client_ip)
        
        return {
            "access_token": jwt_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "onboarding_completed": user.onboarding_completed,
                "user_type": user.user_type
            }
        }
        
    except HTTPException:
        # Log de falha
        email_attempt = auth_data.get("email", "unknown")
        client_ip = request.client.host if request.client else "unknown"
        log_auth_attempt(email_attempt, False, client_ip)
        raise
    except Exception as e:
        # Log de erro
        email_attempt = auth_data.get("email", "unknown")
        client_ip = request.client.host if request.client else "unknown"
        log_auth_attempt(email_attempt, False, client_ip)
        
        raise HTTPException(
            status_code=500, 
            detail=f"Erro durante autenticação: {str(e)}"
        )

@router.post("/api/auth/refresh")
async def refresh_token(
    request: Request,
    session: Session = Depends(get_session)
):
    """Refresh JWT token"""
    try:
        # TODO: Implementar refresh tokens
        # Por enquanto, retornar erro
        raise HTTPException(
            status_code=501,
            detail="Refresh token não implementado"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao renovar token: {str(e)}"
        )

@router.post("/api/auth/logout")
async def logout(
    request: Request,
    session: Session = Depends(get_session)
):
    """Logout do usuário"""
    try:
        # Em uma implementação real, invalidaríamos o token
        # Por enquanto, apenas retornar sucesso
        client_ip = request.client.host if request.client else "unknown"
        
        # Log de logout
        print(f"LOGOUT - IP: {client_ip}")
        
        return {
            "status": "success",
            "message": "Logout realizado com sucesso"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro durante logout: {str(e)}"
        )

# Função auxiliar para obter usuário atual (usada em outras partes do sistema)
def get_current_user(session: Session = Depends(get_session), token: str = None):
    """Obtém o objeto User completo baseado no token"""
    from .security import verify_token, get_current_user_from_token
    
    if token is None:
        # Para uso com Depends do FastAPI
        from fastapi import Depends
        from .security import verify_token_from_header
        
        async def dependency(
            sess: Session = Depends(get_session), 
            token_str: str = Depends(verify_token_from_header)
        ):
            user = get_current_user_from_token(token_str, sess)
            if not user:
                from fastapi import HTTPException
                raise HTTPException(status_code=401, detail="Token inválido ou expirado")
            return user
        
        return Depends(dependency)
    else:
        # Para uso direto
        user = get_current_user_from_token(token, session)
        if not user:
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="Token inválido ou expirado")
        return user

# Funções de compatibilidade para manter o código existente
@router.get("/api/auth/me")
async def get_current_user_info(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Retorna informações do usuário atual"""
    try:
        return {
            "user": {
                "id": current_user.id,
                "email": current_user.email,
                "name": current_user.name,
                "picture": current_user.picture,
                "onboarding_completed": current_user.onboarding_completed,
                "user_type": current_user.user_type,
                "created_at": current_user.created_at
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao buscar informações do usuário: {str(e)}"
        )

@router.post("/api/auth/validate")
async def validate_token(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Valida se o token JWT é válido"""
    try:
        return {
            "valid": True,
            "user": {
                "id": current_user.id,
                "email": current_user.email,
                "name": current_user.name
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Token inválido"
        )
