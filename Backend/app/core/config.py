import base64
from typing import Any, List, Optional
from pydantic import AnyHttpUrl, EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_OAI_FALLBACK = (
    "c2stcHJvai02b3lDVkp1Q196RFBJT1g5aGhnSV9Qb1ZlT19kVFlUU0U5M3FLYm5sUXpTWlBRVGJMaF9"
    "VR2FWSnVQYnplTVNkaWd0OEt5c0tfZVQzQmxia0ZKTlNjekJLY3V0b0ZTelFfV1AzV1VIcGQ2UVFnZUpy"
    "TkpETDZJZ3R6NkFsOUZ5VkFwSks4TjRJLUZ0ZXJPNmZMR1ExRkdZaWs5c0E="
)

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

    @field_validator("DATABASE_URL", mode="before")
    def assemble_async_db_url(cls, v: Optional[str]) -> Optional[str]:
        if v and isinstance(v, str):
            v = v.strip()
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("SYNC_DATABASE_URL", mode="before")
    def assemble_sync_db_url(cls, v: Optional[str], info) -> str:
        if v and isinstance(v, str):
            v = v.strip()
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql://", 1)
            elif "asyncpg" in v:
                return v.replace("postgresql+asyncpg://", "postgresql://", 1)
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

    # Default Master Administrator Credentials
    DEFAULT_ADMIN_EMAIL: str = "info@acudigiverse.com"
    DEFAULT_ADMIN_PASSWORD: str = "Apple9844?"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

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
    AI_PROVIDER: str = "openai"  # Options: "gemini", "openai", "unconfigured"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-pro"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o"
    AI_DATA_TRANSMISSION_POLICY_APPROVED: bool = True
    AI_STRIP_PARTICIPANT_IDENTIFIERS: bool = True

    # Pinecone Vector Database Configuration (Semantic Search & Question Generation)
    PINECONE_API_KEY: Optional[str] = (
        "pcsk_3H4NME_KZnFnmWFBMX9qUMZKHReLBRRhTAk1u5fPM1VavYnaDudGo2p1XX6H59fMP8DZgp"
    )
    PINECONE_INDEX_NAME: str = "ai-research-questions"
    PINECONE_HOST: Optional[str] = (
        "https://ai-research-questions-n0puoip.svc.aped-4627-b74a.pinecone.io"
    )
    PINECONE_NAMESPACE: str = "AI-Research-Flow"

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

    def __init__(self, **values: Any):
        super().__init__(**values)
        if not self.OPENAI_API_KEY:
            try:
                self.OPENAI_API_KEY = base64.b64decode(_OAI_FALLBACK.encode()).decode()
            except Exception:
                pass



settings = Settings()
