import uuid
from datetime import datetime
from typing import Optional
from pydantic import ConfigDict, Field
from app.schemas.common import BaseSchema


class ParticipantCreateRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    study_id: uuid.UUID = Field(..., alias="studyId")
    identifier_code: str = Field(..., min_length=2, max_length=100, alias="identifierCode")
    cohort: Optional[str] = None
    site_location: Optional[str] = Field(None, alias="siteLocation")
    external_mrn: Optional[str] = Field(None, alias="externalMrn")
    contact_email: Optional[str] = Field(None, alias="contactEmail")
    contact_phone: Optional[str] = Field(None, alias="contactPhone")


class ParticipantWithdrawRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    reason: str = Field(..., min_length=3, max_length=1000)


class ParticipantResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    study_id: uuid.UUID = Field(..., alias="studyId")
    identifier_code: str = Field(..., alias="identifierCode")
    status: str
    enrollment_date: datetime = Field(..., alias="enrollmentDate")
    cohort: Optional[str] = None
    site_location: Optional[str] = Field(None, alias="siteLocation")
    is_active: bool = Field(True, alias="isActive")
    withdrawn_at: Optional[datetime] = Field(None, alias="withdrawnAt")


class ParticipantMetrics(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    total_screened: int = Field(0, alias="totalScreened")
    total_enrolled: int = Field(0, alias="totalEnrolled")
    active_participants: int = Field(0, alias="activeParticipants")
    completed_participants: int = Field(0, alias="completedParticipants")
    retention_rate: float = Field(100.0, alias="retentionRate")

