import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from app.schemas.common import BaseSchema


class AuditEventResponse(BaseSchema):
    id: uuid.UUID
    event_type: str
    status: str
    user_id: Optional[uuid.UUID] = None
    study_id: Optional[uuid.UUID] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Dict[str, Any]
    created_at: datetime
