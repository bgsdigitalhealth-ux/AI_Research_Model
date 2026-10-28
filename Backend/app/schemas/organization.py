import uuid
from datetime import datetime
from typing import Optional
from pydantic import Field
from app.schemas.common import BaseSchema


class OrganizationResponse(BaseSchema):
    id: uuid.UUID
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class OrganizationCreate(BaseSchema):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
