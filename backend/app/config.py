from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://grader:grader_password@localhost:5432/notebook_grader"

    # Auth / JWT
    SECRET_KEY: str = "change-this-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALGORITHM: str = "HS256"

    # LLM Settings
    LLM_PROVIDER: str = "gemini"  # "gemini" or "anthropic"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-flash-latest"
    ANTHROPIC_API_KEY: str = ""

    # App
    ENVIRONMENT: str = "development"
    UPLOAD_DIR: str = "./uploads"

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
