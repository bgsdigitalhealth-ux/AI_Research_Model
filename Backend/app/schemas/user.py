import uuid
from datetime import datetime
from typing import Optional
from pydantic import EmailStr, Field
from app.schemas.common import BaseSchema
from app.schemas.role import RoleResponse
from app.schemas.organization import OrganizationResponse


class UserResponse(BaseSchema):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    phone_number: Optional[str] = None
    organization_id: Optional[uuid.UUID] = None
    global_role_id: uuid.UUID
    global_role: Optional[RoleResponse] = None
    organization: Optional[OrganizationResponse] = None
    is_active: bool
    is_verified: bool
    mfa_enabled: bool
    last_login_at: Optional[datetime] = None
    deactivated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class UserProfileUpdate(BaseSchema):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=50)


class UserAdminUpdate(BaseSchema):
    global_role_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    organization_id: Optional[uuid.UUID] = None
