import uuid
from typing import Optional
from pydantic import EmailStr, Field
from app.schemas.common import BaseSchema
from app.schemas.user import UserResponse


class RegisterRequest(BaseSchema):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=50)
    organization_code: Optional[str] = None
    role_name: Optional[str] = "researcher"


class LoginRequest(BaseSchema):
    email: EmailStr
    password: str = Field(..., min_length=1)
    mfa_code: Optional[str] = Field(None, min_length=6, max_length=6)


class TokenResponse(BaseSchema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class RefreshTokenRequest(BaseSchema):
    refresh_token: str


class VerifyEmailRequest(BaseSchema):
    token: str = Field(..., min_length=16)


class ResendVerificationRequest(BaseSchema):
    email: EmailStr


class PasswordResetRequest(BaseSchema):
    email: EmailStr


class PasswordResetConfirm(BaseSchema):
    token: str = Field(..., min_length=16)
    new_password: str = Field(..., min_length=8, max_length=128)


class ChangePasswordRequest(BaseSchema):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class MfaSetupResponse(BaseSchema):
    secret: str
    provisioning_uri: str


class MfaVerifyRequest(BaseSchema):
    code: str = Field(..., min_length=6, max_length=6)
    temp_token: Optional[str] = None
