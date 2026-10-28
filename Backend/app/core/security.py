import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import bcrypt
import jwt
from app.core.config import settings
from app.core.exceptions import AuthenticationError


def get_password_hash(password: str) -> str:
    """
    Hashes a password using bcrypt with a salt.
    Uses lightweight rounds in test environment for fast execution.
    """
    rounds = 4 if settings.ENVIRONMENT == "test" else 12
    salt = bcrypt.gensalt(rounds=rounds)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against the stored bcrypt hash.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def hash_token(token: str) -> str:
    """
    Computes SHA-256 hash of a raw token for safe persistence.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_secure_random_token(nbytes: int = 32) -> Tuple[str, str]:
    """
    Generates a cryptographically strong random token and its SHA-256 hash.
    Returns: (raw_token, token_hash)
    """
    raw_token = secrets.token_urlsafe(nbytes)
    return raw_token, hash_token(raw_token)


def create_access_token(
    subject: str,
    global_role: str,
    study_roles: Optional[Dict[str, str]] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Creates a signed JWT access token.
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(subject),
        "global_role": global_role,
        "study_roles": study_roles or {},
        "type": "access",
        "jti": secrets.token_hex(16),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
) -> Tuple[str, str, datetime]:
    """
    Generates a secure refresh token, its SHA-256 hash for database storage,
    and its expiration timestamp.
    Returns: (raw_refresh_token, token_hash, expires_at)
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expires_at = now + expires_delta
    else:
        expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    raw_token = f"rft_{secrets.token_urlsafe(48)}"
    token_hash = hash_token(raw_token)
    return raw_token, token_hash, expires_at


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a JWT access token.
    Raises AuthenticationError if invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["sub", "exp", "iat", "type"]},
        )
        if payload.get("type") != "access":
            raise AuthenticationError("Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Access token has expired")
    except (jwt.InvalidTokenError, Exception) as exc:
        raise AuthenticationError("Could not validate credentials") from exc
