from typing import List, Optional
from pydantic import AnyHttpUrl, EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Research Flow API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Database Configuration (PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_research_flow"
    SYNC_DATABASE_URL: Optional[str] = None
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    DATABASE_POOL_TIMEOUT: int = 30

    @field_validator("SYNC_DATABASE_URL", mode="before")
    def assemble_sync_db_url(cls, v: Optional[str], info) -> str:
        if v:
            return v
        db_url = info.data.get("DATABASE_URL", "")
        if "asyncpg" in db_url:
            return db_url.replace("postgresql+asyncpg://", "postgresql://")
        return db_url

    # Security & JWT Tokens
    SECRET_KEY: str = "INSECURE_DEFAULT_DEV_KEY_CHANGE_IN_PRODUCTION_ENV_FILE_ONLY_128_BITS"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    # Rate Limiting
    RATE_LIMIT_LOGIN_MAX_ATTEMPTS: int = 5
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = 300

    # MFA Configuration
    MFA_ISSUER_NAME: str = "AI Research Flow"

    # Storage Configuration (Object Storage)
    STORAGE_PROVIDER: str = "local"
    STORAGE_LOCAL_DIR: str = "uploads/protocols"
    STORAGE_MAX_FILE_SIZE_MB: int = 50
    ALLOWED_PROTOCOL_EXTENSIONS: List[str] = [".pdf", ".docx"]
    ALLOWED_PROTOCOL_MIME_TYPES: List[str] = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/octet-stream",
    ]

    # AI Provider Adapter Configuration
    AI_PROVIDER: str = "unconfigured"  # Options: "gemini", "openai", "unconfigured"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-pro"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o"
    AI_DATA_TRANSMISSION_POLICY_APPROVED: bool = True
    AI_STRIP_PARTICIPANT_IDENTIFIERS: bool = True

    # Email / Notification Mock or SMTP configuration
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@airesearchflow.org"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
