import uuid
from datetime import datetime
from typing import Optional
from app.schemas.common import BaseSchema
from app.schemas.role import RoleResponse
from app.schemas.user import UserResponse


class StudyMembershipCreate(BaseSchema):
    study_id: uuid.UUID
    user_id: uuid.UUID
    role_id: uuid.UUID


class StudyMembershipResponse(BaseSchema):
    id: uuid.UUID
    study_id: uuid.UUID
    user_id: uuid.UUID
    role_id: uuid.UUID
    is_active: bool
    granted_by_user_id: Optional[uuid.UUID] = None
    role: Optional[RoleResponse] = None
    user: Optional[UserResponse] = None
    created_at: datetime
    updated_at: datetime
