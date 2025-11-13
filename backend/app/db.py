# backend/app/db.py
from sqlmodel import create_engine, SQLModel, Session
import os
from sqlalchemy.orm import sessionmaker
from typing import Generator
from sqlalchemy.pool import StaticPool
import logging

logger = logging.getLogger(__name__)

# CORREÇÃO CRÍTICA PARA RAILWAY
def get_database_url():
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        # Fallback para SQLite em desenvolvimento
        logger.warning("DATABASE_URL não encontrada, usando SQLite como fallback")
        return "sqlite:///./database.db"
    
    # Railway usa postgres://, SQLModel precisa de postgresql://
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
        logger.info("URL do banco convertida para formato PostgreSQL")
    
    return database_url

DATABASE_URL = get_database_url()

# CONFIGURAÇÃO OTIMIZADA PARA AMBIENTES
if DATABASE_URL.startswith('sqlite'):
    # Configuração para SQLite (desenvolvimento)
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    logger.info("✅ Engine SQLite criada")
else:
    # Configuração para PostgreSQL (Railway)
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        pool_pre_ping=True,  # 👈 Reconecta automaticamente
        pool_recycle=300,    # 👈 Evita conexões stale
    )
    logger.info("✅ Engine PostgreSQL criada")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Inicializa o banco de dados com tratamento de erro"""
    try:
        SQLModel.metadata.create_all(bind=engine)
        logger.info("✅ Banco de dados inicializado com sucesso")
        return True
    except Exception as e:
        logger.error(f"❌ Erro ao inicializar banco: {e}")
        # Não quebra a aplicação completamente
        return False

def get_session() -> Generator[Session, None, None]:
    """Dependency para obter sessão do banco com tratamento robusto"""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro na sessão do banco: {e}")
        raise e
    finally:
        db.close()

def check_database_connection():
    """Verifica se a conexão com o banco está funcionando"""
    try:
        with Session(engine) as session:
            session.execute("SELECT 1")
            logger.info("✅ Conexão com banco de dados estabelecida")
            return True
    except Exception as e:
        logger.error(f"❌ Falha na conexão com banco: {e}")
        return False