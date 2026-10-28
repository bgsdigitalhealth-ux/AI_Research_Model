import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import ConfigDict, Field
from app.schemas.common import BaseSchema


class ConsentWordingPayload(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    study_id: Optional[uuid.UUID] = Field(None, alias="studyId")
    study_title: Optional[str] = Field(None, alias="studyTitle")
    questionnaire_id: uuid.UUID = Field(..., alias="questionnaireId")
    questionnaire_version: str = Field(..., alias="questionnaireVersion")
    ethics_approval_number: Optional[str] = Field(None, alias="ethicsApprovalNumber")
    principal_investigator: Optional[str] = Field(None, alias="principalInvestigator")
    institution: Optional[str] = None
    information_sheet_html: str = Field(..., alias="informationSheetHtml")
    consent_statements: List[str] = Field(default_factory=list, alias="consentStatements")
    data_retention_policy_summary: str = Field(..., alias="dataRetentionPolicySummary")
    withdrawn_policy_summary: str = Field(..., alias="withdrawnPolicySummary")


class ConsentRecordSchema(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[uuid.UUID] = None
    study_id: Optional[uuid.UUID] = Field(None, alias="studyId")
    questionnaire_id: Optional[uuid.UUID] = Field(None, alias="questionnaireId")
    questionnaire_version: str = Field(..., alias="questionnaireVersion")
    participant_identifier: str = Field(..., alias="participantIdentifier")
    consented_at: Optional[datetime] = Field(None, alias="consentedAt")
    agreed_to_participate: bool = Field(..., alias="agreedToParticipate")
    agreed_to_data_storage: bool = Field(..., alias="agreedToDataStorage")
    agreed_to_contact: bool = Field(False, alias="agreedToContact")
    agreed_statements: List[str] = Field(default_factory=list, alias="agreedStatements")


class ConsentResponse(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    consent_id: uuid.UUID = Field(..., alias="consentId")
    confirmation_code: str = Field(..., alias="confirmationCode")


class SurveySubmissionRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    submission_id: uuid.UUID = Field(..., alias="submissionId")
    questionnaire_id: Optional[uuid.UUID] = Field(None, alias="questionnaireId")
    questionnaire_version: str = Field(..., alias="questionnaireVersion")
    participant_identifier: str = Field(..., alias="participantIdentifier")
    answers: Dict[str, Any] = Field(default_factory=dict)
    consent_record: Optional[ConsentRecordSchema] = Field(None, alias="consentRecord")
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")


class ServerSyncAcknowledgement(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    confirmation_id: str = Field(..., alias="confirmationId")
    received_at: datetime = Field(..., alias="receivedAt")
    status_code: int = Field(200, alias="statusCode")


class SyncBatchRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    submissions: List[SurveySubmissionRequest] = Field(default_factory=list)


class SyncBatchResult(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    successful: List[Dict[str, Any]] = Field(default_factory=list)
    conflicts: List[Dict[str, Any]] = Field(default_factory=list)
    failed: List[Dict[str, Any]] = Field(default_factory=list)


class CollectionMonitoringMetrics(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    total_target_responses: int = Field(0, alias="totalTargetResponses")
    completed_online: int = Field(0, alias="completedOnline")
    pending_offline_queue: int = Field(0, alias="pendingOfflineQueue")
    synced_successfully: int = Field(0, alias="syncedSuccessfully")
    sync_failed: int = Field(0, alias="syncFailed")
    active_surveys_count: int = Field(0, alias="activeSurveysCount")
    last_sync_timestamp: Optional[datetime] = Field(None, alias="lastSyncTimestamp")


class SurveyResponseAnswerSchema(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    question_id: str = Field(..., alias="questionId")
    variable_name: str = Field(..., alias="variableName")
    raw_value: Optional[Any] = Field(None, alias="rawValue")
    is_missing: bool = Field(False, alias="isMissing")
    is_valid: bool = Field(True, alias="isValid")


class DataQualityIssueSchema(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    study_id: uuid.UUID = Field(..., alias="studyId")
    response_id: uuid.UUID = Field(..., alias="responseId")
    question_id: Optional[str] = Field(None, alias="questionId")
    variable_name: Optional[str] = Field(None, alias="variableName")
    issue_type: str = Field(..., alias="issueType")
    severity: str
    description: str
    status: str
    resolution_notes: Optional[str] = Field(None, alias="resolutionNotes")
    resolved_by: Optional[str] = Field(None, alias="resolvedBy")
    resolved_at: Optional[datetime] = Field(None, alias="resolvedAt")
    created_at: datetime = Field(..., alias="createdAt")


class ResolveQualityIssueRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    resolution_notes: str = Field(..., min_length=3, max_length=1000, alias="resolutionNotes")
    status: Optional[str] = Field("resolved")


class ResponseCorrectionRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    question_id: str = Field(..., alias="questionId")
    variable_name: str = Field(..., alias="variableName")
    corrected_value: Any = Field(..., alias="correctedValue")
    reason: str = Field(..., min_length=3, max_length=1000)


class ResponseCorrectionHistorySchema(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    response_id: uuid.UUID = Field(..., alias="responseId")
    question_id: str = Field(..., alias="questionId")
    variable_name: str = Field(..., alias="variableName")
    original_value: Optional[Any] = Field(None, alias="originalValue")
    corrected_value: Optional[Any] = Field(None, alias="correctedValue")
    reason: str
    corrected_by: Optional[str] = Field(None, alias="correctedBy")
    corrected_at: datetime = Field(..., alias="correctedAt")


class SurveyResponseDetail(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    study_id: uuid.UUID = Field(..., alias="studyId")
    questionnaire_id: uuid.UUID = Field(..., alias="questionnaireId")
    questionnaire_version: str = Field(..., alias="questionnaireVersion")
    participant_identifier: str = Field(..., alias="participantIdentifier")
    status: str
    confirmation_id: str = Field(..., alias="confirmationId")
    sync_source: str = Field(..., alias="syncSource")
    answers: List[SurveyResponseAnswerSchema] = Field(default_factory=list)
    quality_issues: List[DataQualityIssueSchema] = Field(default_factory=list, alias="qualityIssues")
    corrections: List[ResponseCorrectionHistorySchema] = Field(default_factory=list)
    client_submitted_at: datetime = Field(..., alias="clientSubmittedAt")
    server_received_at: datetime = Field(..., alias="serverReceivedAt")


class SurveyInvitationCreateRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    questionnaire_id: Optional[uuid.UUID] = Field(None, alias="questionnaireId")
    participant_identifier: Optional[str] = Field(None, alias="participantIdentifier")
    access_mode: Optional[str] = Field("invitation_only", alias="accessMode")
    max_uses: Optional[int] = Field(1, ge=1, le=1000, alias="maxUses")
    expires_in_days: Optional[int] = Field(30, ge=1, le=365, alias="expiresInDays")


class SurveyInvitationResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    token: Optional[str] = None
    token_prefix: str = Field(..., alias="tokenPrefix")
    access_mode: str = Field(..., alias="accessMode")
    max_uses: int = Field(..., alias="maxUses")
    uses_count: int = Field(..., alias="usesCount")
    expires_at: Optional[datetime] = Field(None, alias="expiresAt")
    is_revoked: bool = Field(False, alias="isRevoked")
