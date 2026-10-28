import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import ConfigDict, Field
from app.schemas.common import BaseSchema


class ExtractionSourceEvidenceSchema(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    page_number: Optional[int] = Field(None, alias="pageNumber")
    paragraph_number: Optional[int] = Field(None, alias="paragraphNumber")
    section_title: Optional[str] = Field(None, alias="sectionTitle")
    source_text_snippet: str = Field(..., alias="sourceTextSnippet")
    bounding_coordinates: Optional[Dict[str, float]] = Field(None, alias="boundingCoordinates")


class ExtractedFieldSchema(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    key: str
    label: str
    ai_value: Any = Field(None, alias="aiValue")
    verified_value: Optional[Any] = Field(None, alias="verifiedValue")
    status: str = "unreviewed"  # unreviewed, accepted, edited, rejected, flagged
    uncertainty: Optional[str] = None  # high, medium, low
    is_missing: bool = Field(False, alias="isMissing")
    confidence_score: Optional[float] = Field(None, alias="confidenceScore")
    evidence: Optional[ExtractionSourceEvidenceSchema] = None
    reviewer_notes: Optional[str] = Field(None, alias="reviewerNotes")
    flag_reason: Optional[str] = Field(None, alias="flagReason")
    verified_by: Optional[str] = Field(None, alias="verifiedBy")
    verified_at: Optional[datetime] = Field(None, alias="verifiedAt")


class ProtocolResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    study_id: uuid.UUID = Field(..., alias="studyId")
    study_title: Optional[str] = Field(None, alias="studyTitle")
    title: str
    version: str
    status: str
    file_name: str = Field(..., alias="fileName")
    file_size_bytes: int = Field(..., alias="fileSizeBytes")
    file_type: str = Field(..., alias="fileType")
    file_url: Optional[str] = Field(None, alias="fileUrl")
    uploaded_at: datetime = Field(..., alias="uploadedAt")
    uploaded_by: Optional[str] = Field(None, alias="uploadedBy")
    irb_approval_number: Optional[str] = Field(None, alias="irbApprovalNumber")
    approval_date: Optional[datetime] = Field(None, alias="approvalDate")
    extraction_status: str = Field("not_started", alias="extractionStatus")
    extraction_completed_at: Optional[datetime] = Field(None, alias="extractionCompletedAt")
    summary_notes: Optional[str] = Field(None, alias="summaryNotes")


class ProtocolExtractionDataResponse(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    protocol_id: uuid.UUID = Field(..., alias="protocolId", serialization_alias="protocolId")
    status: str
    error_message: Optional[str] = Field(None, alias="errorMessage", serialization_alias="errorMessage")
    model_metadata: Optional[Dict[str, Any]] = Field(None, alias="modelMetadata", serialization_alias="modelMetadata")
    fields: Dict[str, ExtractedFieldSchema]
    is_fully_verified: bool = Field(False, alias="isFullyVerified", serialization_alias="isFullyVerified")
    verified_at: Optional[datetime] = Field(None, alias="verifiedAt", serialization_alias="verifiedAt")
    verified_by: Optional[str] = Field(None, alias="verifiedBy", serialization_alias="verifiedBy")


class FieldVerificationUpdateRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(..., pattern="^(unreviewed|accepted|edited|rejected|flagged)$")
    verified_value: Optional[Any] = Field(None, alias="verifiedValue")
    reviewer_notes: Optional[str] = Field(None, alias="reviewerNotes")
    flag_reason: Optional[str] = Field(None, alias="flagReason")


class ProtocolApprovalRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    notes: Optional[str] = None
    irb_approval_number: Optional[str] = Field(None, alias="irbApprovalNumber")


class StudyMethodAnalysisConfigurationSchema(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    protocol_id: Optional[uuid.UUID] = Field(None, alias="protocolId", serialization_alias="protocolId")
    study_id: Optional[uuid.UUID] = Field(None, alias="studyId", serialization_alias="studyId")
    study_type: str = Field("interventional", alias="studyType", serialization_alias="studyType")
    randomization_method: Optional[str] = Field(None, alias="randomizationMethod", serialization_alias="randomizationMethod")
    allocation_ratio: Optional[str] = Field(None, alias="allocationRatio", serialization_alias="allocationRatio")
    blinding_type: str = Field("open_label", alias="blindingType", serialization_alias="blindingType")
    number_of_arms: int = Field(1, alias="numberOfArms", serialization_alias="numberOfArms")
    primary_hypothesis: str = Field("", alias="primaryHypothesis", serialization_alias="primaryHypothesis")
    significance_alpha: float = Field(0.05, alias="significanceAlpha", serialization_alias="significanceAlpha")
    power_threshold: float = Field(0.80, alias="powerThreshold", serialization_alias="powerThreshold")
    planned_statistical_test: str = Field("two_sample_t_test", alias="plannedStatisticalTest", serialization_alias="plannedStatisticalTest")
    missing_data_strategy: str = Field("complete_case", alias="missingDataStrategy", serialization_alias="missingDataStrategy")
    subgroup_analyses: Optional[str] = Field(None, alias="subgroupAnalyses", serialization_alias="subgroupAnalyses")
    interim_analyses_planned: bool = Field(False, alias="interimAnalysesPlanned", serialization_alias="interimAnalysesPlanned")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt", serialization_alias="updatedAt")
    configured_by: Optional[str] = Field(None, alias="configuredBy", serialization_alias="configuredBy")


class ProtocolVersionResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    protocol_id: uuid.UUID = Field(..., alias="protocolId")
    version_number: str = Field(..., alias="versionNumber")
    file_name: str = Field(..., alias="fileName")
    file_size_bytes: int = Field(..., alias="fileSizeBytes")
    uploaded_at: datetime = Field(..., alias="uploadedAt")
    uploaded_by: Optional[str] = Field(None, alias="uploadedBy")
    changes_summary: Optional[str] = Field(None, alias="changesSummary")
    status: str
    download_url: Optional[str] = Field(None, alias="downloadUrl")
