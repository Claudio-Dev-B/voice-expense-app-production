from pydantic_settings import BaseSettings
from pydantic import AnyUrl

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./database.db"
    MAX_UPLOAD_MB: int = 10  # proteção contra uploads enormes
    WHISPER_MODEL: str = "base"  # usado se estiver usando openai-whisper
    # futuro: WHISPER_CPP_PATH, etc.

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
