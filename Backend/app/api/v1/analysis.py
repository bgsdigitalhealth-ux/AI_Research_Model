import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.analysis import (
    AnalysisMethodResponse,
    AnalysisRunConfig,
    AnalysisRunResponse,
    DataQualityReportResponse,
    DatasetSnapshotCreateRequest,
    DatasetSnapshotResponse,
    StatisticalResultResponse,
    VariableDefinition,
)
from app.services.analysis_service import AnalysisService
from app.services.docker_r_engine import DockerREngine

router = APIRouter(prefix="/analysis", tags=["Statistical Analysis & Snapshots"])



@router.get(
    "/runtime",
    status_code=status.HTTP_200_OK,
    summary="Retrieve current containerized R statistical computing runtime status",
)
async def get_analysis_runtime(
    current_user: User = Depends(get_current_user),
):
    return DockerREngine.get_runtime_versions()

# =============================================================================
# DATASET SNAPSHOTS
# =============================================================================

@router.get(
    "/datasets",
    response_model=List[DatasetSnapshotResponse],
    status_code=status.HTTP_200_OK,
    summary="List available frozen dataset snapshots with cryptographic checksums",
)
async def list_datasets(
    study_id: Optional[uuid.UUID] = Query(None, alias="studyId"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.list_snapshots(current_user=current_user, study_id=study_id)


@router.post(
    "/datasets",
    response_model=DatasetSnapshotResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Freeze study intake responses into an immutable analysis snapshot with checksum",
)
async def create_dataset_snapshot(
    payload: DatasetSnapshotCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.create_snapshot(
        study_id=payload.study_id,
        name=payload.name,
        description=payload.description,
        questionnaire_id=payload.questionnaire_id,
        current_user=current_user,
    )


@router.get(
    "/datasets/{dataset_id}",
    response_model=DatasetSnapshotResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve dataset snapshot metadata and freeze provenance",
)
async def get_dataset_by_id(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.get_snapshot_by_id(dataset_id, current_user)


@router.get(
    "/datasets/{dataset_id}/variables",
    response_model=List[VariableDefinition],
    status_code=status.HTTP_200_OK,
    summary="Retrieve variable dictionary with data types, roles, and baseline summary stats",
)
async def get_dataset_variables(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.get_variable_dictionary(dataset_id, current_user)


@router.get(
    "/datasets/{dataset_id}/quality",
    response_model=DataQualityReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve data quality, complete-case metrics, and missingness patterns",
)
async def get_data_quality_report(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.get_data_quality_report(dataset_id, current_user)


# =============================================================================
# STATISTICAL ANALYSIS RUNS
# =============================================================================

@router.get(
    "/methods",
    response_model=List[AnalysisMethodResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve supported and independently validated statistical analysis methods",
)
async def get_supported_methods(
    study_id: Optional[uuid.UUID] = Query(None, alias="studyId"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.get_supported_methods(current_user=current_user, study_id=study_id)


@router.post(
    "/runs",
    response_model=AnalysisRunResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Execute validated statistical analysis using isolated Python mathematical runtime",
)
async def submit_analysis_run(
    config: AnalysisRunConfig,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.run_analysis(config, current_user)


@router.get(
    "/runs",
    response_model=List[AnalysisRunResponse],
    status_code=status.HTTP_200_OK,
    summary="List analysis execution history with status, parameters, and duration",
)
async def list_analysis_runs(
    study_id: Optional[uuid.UUID] = Query(None, alias="studyId"),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.list_runs(
        current_user=current_user,
        study_id=study_id,
        status=status_filter,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/runs/{run_id}",
    response_model=AnalysisRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve execution status and progress of an analysis run",
)
async def get_analysis_run_by_id(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.get_run_by_id(run_id, current_user)


@router.get(
    "/runs/{run_id}/results",
    response_model=StatisticalResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve authoritative statistical estimates, p-values, CIs, diagnostics, and AI interpretation",
)
async def get_analysis_results(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.get_analysis_results(run_id, current_user)


@router.post(
    "/runs/{run_id}/cancel",
    status_code=status.HTTP_200_OK,
    summary="Cancel an active analysis execution run",
)
async def cancel_analysis_run(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.cancel_run(run_id, current_user)

