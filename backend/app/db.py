from sqlmodel import create_engine, SQLModel, Session
import os
from sqlalchemy.orm import sessionmaker
from typing import Generator


DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:example@localhost:5432/expenses')


engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    SQLModel.metadata.create_all(bind=engine)


def get_session() -> Generator[Session, None, None]:
db = SessionLocal()
try:
yield db
finally:
db.close()