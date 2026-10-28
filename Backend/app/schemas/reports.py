import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import ConfigDict, Field
from app.schemas.common import BaseSchema

ReportType = Literal["csr", "manuscript", "interim_summary", "saf_report", "consort_flow"]
ReportStatus = Literal["draft", "under_review", "approved", "archived"]

ExportFormat = Literal["csv", "xlsx", "pdf", "docx"]
ExportType = Literal["raw_dataset", "curated_analysis", "formal_report", "variable_codebook"]
ExportJobStatus = Literal["pending", "processing", "ready", "failed", "expired"]


class ReportAuthor(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    email: str


class ReportSection(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    content: str
    linked_analysis_run_id: Optional[str] = Field(None, alias="linkedAnalysisRunId")
    tables_count: Optional[int] = Field(0, alias="tablesCount")
    figures_count: Optional[int] = Field(0, alias="figuresCount")
    is_ai_drafted: Optional[bool] = Field(False, alias="isAiDrafted")
    reviewed_by: Optional[str] = Field(None, alias="reviewedBy")


class ResearchReportCreateRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    study_id: uuid.UUID = Field(..., alias="studyId")
    title: str = Field(..., min_length=3, max_length=255)
    type: ReportType = Field("csr")
    sections: Optional[List[ReportSection]] = Field(default_factory=list)
    approved_analysis_run_ids: Optional[List[str]] = Field(default_factory=list, alias="approvedAnalysisRunIds")
    protocol_version: Optional[str] = Field("1.0", alias="protocolVersion")
    dataset_snapshot_id: Optional[uuid.UUID] = Field(None, alias="datasetSnapshotId")
    summary_executive: Optional[str] = Field(None, alias="summaryExecutive")


class ResearchReportUpdateRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = None
    type: Optional[ReportType] = None
    status: Optional[ReportStatus] = None
    sections: Optional[List[ReportSection]] = None
    approved_analysis_run_ids: Optional[List[str]] = Field(None, alias="approvedAnalysisRunIds")
    summary_executive: Optional[str] = Field(None, alias="summaryExecutive")


class ResearchReportResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    study_id: uuid.UUID = Field(..., alias="studyId")
    study_title: Optional[str] = Field(None, alias="studyTitle")
    title: str
    type: ReportType
    version: str
    status: ReportStatus
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    author: ReportAuthor
    sections: List[ReportSection] = Field(default_factory=list)
    approved_analysis_run_ids: List[str] = Field(default_factory=list, alias="approvedAnalysisRunIds")
    protocol_version: str = Field(..., alias="protocolVersion")
    dataset_snapshot_id: Optional[uuid.UUID] = Field(None, alias="datasetSnapshotId")
    summary_executive: Optional[str] = Field(None, alias="summaryExecutive")


class ExportOptions(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    study_id: uuid.UUID = Field(..., alias="studyId")
    format: ExportFormat
    type: ExportType
    dataset_snapshot_id: Optional[uuid.UUID] = Field(None, alias="datasetSnapshotId")
    analysis_run_id: Optional[uuid.UUID] = Field(None, alias="analysisRunId")
    report_id: Optional[uuid.UUID] = Field(None, alias="reportId")
    include_codebook: bool = Field(True, alias="includeCodebook")
    de_identify_data: bool = Field(True, alias="deIdentifyData")
    mask_direct_identifiers: bool = Field(True, alias="maskDirectIdentifiers")
    variable_filter: Optional[List[str]] = Field(default_factory=list, alias="variableFilter")


class ExportJobResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    study_id: uuid.UUID = Field(..., alias="studyId")
    study_title: Optional[str] = Field(None, alias="studyTitle")
    format: ExportFormat
    type: ExportType
    status: ExportJobStatus
    progress_percent: int = Field(0, alias="progressPercent")
    file_name: Optional[str] = Field(None, alias="fileName")
    file_size_bytes: Optional[int] = Field(None, alias="fileSizeBytes")
    file_url: Optional[str] = Field(None, alias="fileUrl")
    created_at: datetime = Field(..., alias="createdAt")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")
    expires_at: Optional[datetime] = Field(None, alias="expiresAt")
    error_message: Optional[str] = Field(None, alias="errorMessage")
    requested_by: ReportAuthor = Field(..., alias="requestedBy")
    de_identified_confirmed: bool = Field(True, alias="deIdentifiedConfirmed")
    governance_notice: Optional[str] = Field(None, alias="governanceNotice")

