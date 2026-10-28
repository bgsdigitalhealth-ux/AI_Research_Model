import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import ConfigDict, Field
from app.schemas.common import BaseSchema


class StudyCreateRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(..., min_length=3, max_length=255)
    protocol_number: str = Field(..., min_length=2, max_length=100, alias="protocolNumber")
    description: Optional[str] = None
    phase: Optional[str] = Field(None, max_length=50)
    principal_investigator_id: Optional[uuid.UUID] = Field(None, alias="principalInvestigatorId")
    principal_investigator: Optional[str] = Field(None, alias="principalInvestigator")
    organization_id: Optional[uuid.UUID] = Field(None, alias="organizationId")
    target_participants: int = Field(0, ge=0, alias="targetParticipants")
    start_date: Optional[datetime] = Field(None, alias="startDate")
    end_date: Optional[datetime] = Field(None, alias="endDate")
    irb_approval_number: Optional[str] = Field(None, alias="irbApprovalNumber")
    irb_approval_date: Optional[datetime] = Field(None, alias="irbApprovalDate")
    governance_notes: Optional[str] = Field(None, alias="governanceNotes")


class StudyUpdateRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    phase: Optional[str] = None
    target_participants: Optional[int] = Field(None, ge=0, alias="targetParticipants")
    enrolled_participants: Optional[int] = Field(None, ge=0, alias="enrolledParticipants")
    start_date: Optional[datetime] = Field(None, alias="startDate")
    end_date: Optional[datetime] = Field(None, alias="endDate")
    status: Optional[str] = None
    irb_approval_number: Optional[str] = Field(None, alias="irbApprovalNumber")
    irb_approval_date: Optional[datetime] = Field(None, alias="irbApprovalDate")
    governance_approved: Optional[bool] = Field(None, alias="governanceApproved")
    consent_framework_approved: Optional[bool] = Field(None, alias="consentFrameworkApproved")
    governance_notes: Optional[str] = Field(None, alias="governanceNotes")
    design_family: Optional[str] = Field(None, alias="designFamily")
    research_aims: Optional[Any] = Field(None, alias="researchAims")
    eligibility_criteria: Optional[Any] = Field(None, alias="eligibilityCriteria")
    primary_outcomes: Optional[Any] = Field(None, alias="primaryOutcomes")
    secondary_outcomes: Optional[Any] = Field(None, alias="secondaryOutcomes")
    variables_spec: Optional[Any] = Field(None, alias="variablesSpec")
    recruitment_target: Optional[int] = Field(None, alias="recruitmentTarget")
    planned_analyses: Optional[Any] = Field(None, alias="plannedAnalyses")


class StudyResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    title: str
    protocol_number: str = Field(..., alias="protocolNumber")
    status: str
    phase: Optional[str] = None
    principal_investigator: Optional[str] = Field(None, alias="principalInvestigator")
    principal_investigator_id: Optional[uuid.UUID] = Field(None, alias="principalInvestigatorId")
    organization_id: Optional[uuid.UUID] = Field(None, alias="organizationId")
    target_participants: int = Field(0, alias="targetParticipants")
    enrolled_participants: int = Field(0, alias="enrolledParticipants")
    start_date: Optional[datetime] = Field(None, alias="startDate")
    end_date: Optional[datetime] = Field(None, alias="endDate")
    completion_percentage: float = Field(0.0, alias="completionPercentage")
    governance_approved: bool = Field(False, alias="governanceApproved")
    consent_framework_approved: bool = Field(False, alias="consentFrameworkApproved")
    irb_approval_number: Optional[str] = Field(None, alias="irbApprovalNumber")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")


class StudyMemberAddRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    user_id: Optional[uuid.UUID] = Field(None, alias="userId")
    email: Optional[str] = None
    role_name: str = Field(..., alias="roleName")  # e.g. "principal_investigator", "researcher", "statistician", "collector"


class StudyMemberResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    study_id: uuid.UUID = Field(..., alias="studyId")
    user_id: uuid.UUID = Field(..., alias="userId")
    user_email: str = Field(..., alias="userEmail")
    user_full_name: str = Field(..., alias="userFullName")
    role_name: str = Field(..., alias="roleName")
    is_active: bool = Field(True, alias="isActive")
    created_at: datetime = Field(..., alias="createdAt")


class StudyGovernanceUpdateRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    governance_approved: bool = Field(..., alias="governanceApproved")
    consent_framework_approved: bool = Field(..., alias="consentFrameworkApproved")
    irb_approval_number: Optional[str] = Field(None, alias="irbApprovalNumber")
    irb_approval_date: Optional[datetime] = Field(None, alias="irbApprovalDate")
    governance_notes: Optional[str] = Field(None, alias="governanceNotes")


class StudyStatusCount(BaseSchema):
    status: str
    label: str
    count: int
    color: Optional[str] = None


class StudyStatusSummaryResponse(BaseSchema):
    total: int
    by_status: List[StudyStatusCount] = Field(..., serialization_alias="byStatus")
