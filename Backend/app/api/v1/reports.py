import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.reports import (
    ExportJobResponse,
    ExportOptions,
    ResearchReportCreateRequest,
    ResearchReportResponse,
    ResearchReportUpdateRequest,
)
from app.services.report_export_service import ReportExportService

reports_router = APIRouter(prefix="/reports", tags=["Research Reports"])
exports_router = APIRouter(prefix="/exports", tags=["Data & Report Exports"])


# =============================================================================
# RESEARCH REPORTS
# =============================================================================

@reports_router.get(
    "",
    response_model=List[ResearchReportResponse],
    status_code=status.HTTP_200_OK,
    summary="List compiled research reports and manuscripts",
)
async def list_reports(
    study_id: Optional[uuid.UUID] = Query(None, alias="studyId"),
    type_filter: Optional[str] = Query(None, alias="type"),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ReportExportService(db)
    return await service.list_reports(
        current_user=current_user,
        study_id=study_id,
        report_type=type_filter,
        status=status_filter,
    )


@reports_router.post(
    "",
    response_model=ResearchReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Draft a new clinical study report or manuscript linked to analysis runs",
)
async def create_report(
    payload: ResearchReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ReportExportService(db)
    return await service.create_report(payload, current_user)


@reports_router.get(
    "/new",
    response_model=ResearchReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Preview synthesized report draft for analysis run",
)
async def preview_new_report(
    analysis_run_id: Optional[uuid.UUID] = Query(None, alias="analysisRunId"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ReportExportService(db)
    return await service.synthesize_draft_report(analysis_run_id, current_user)


@reports_router.get(
    "/{report_id}",
    response_model=ResearchReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve structured research report with linked sections and metadata",
)
async def get_report_by_id(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ReportExportService(db)
    return await service.get_report_by_id(report_id, current_user)


@reports_router.put(
    "/{report_id}",
    response_model=ResearchReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an existing research report draft or sections",
)
async def update_report(
    report_id: uuid.UUID,
    payload: ResearchReportUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ReportExportService(db)
    return await service.update_report(report_id, payload, current_user)


# =============================================================================
# EXPORTS & DOWNLOADS
# =============================================================================

@exports_router.get(
    "/jobs",
    response_model=List[ExportJobResponse],
    status_code=status.HTTP_200_OK,
    summary="List data and report export jobs with governance status",
)
async def list_export_jobs(
    study_id: Optional[uuid.UUID] = Query(None, alias="studyId"),
    format_filter: Optional[str] = Query(None, alias="format"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ReportExportService(db)
    return await service.list_export_jobs(
        current_user=current_user, study_id=study_id, format_filter=format_filter
    )


@exports_router.post(
    "/jobs",
    response_model=ExportJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Request a new export package (CSV, XLSX, PDF, DOCX) with de-identification enforcement",
)
async def request_export(
    options: ExportOptions,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ReportExportService(db)
    return await service.request_export(options, current_user)


@exports_router.get(
    "/jobs/{job_id}",
    response_model=ExportJobResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve processing status and download metadata of an export job",
)
async def get_export_job_by_id(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ReportExportService(db)
    return await service.get_export_job_by_id(job_id, current_user)


@exports_router.get(
    "/jobs/{job_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Download the compiled export file (CSV, XLSX, PDF, DOCX)",
)
async def download_export_file(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ReportExportService(db)
    file_path, file_name, media_type = await service.get_export_file_for_download(job_id, current_user)
    return FileResponse(
        path=file_path,
        filename=file_name,
        media_type=media_type,
    )

