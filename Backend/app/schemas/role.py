import uuid
from datetime import datetime
from typing import List
from pydantic import Field
from app.schemas.common import BaseSchema


class RoleResponse(BaseSchema):
    id: uuid.UUID
    name: str
    description: str
    is_system_role: bool
    permissions: List[str]
    created_at: datetime


class RoleCreate(BaseSchema):
    name: str = Field(..., min_length=2, max_length=50)
    description: str = Field(..., min_length=3, max_length=255)
    permissions: List[str] = Field(default_factory=list)
