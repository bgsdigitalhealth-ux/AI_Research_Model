import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.data_collection import (
    CollectionMonitoringMetrics,
    DataQualityIssueSchema,
    ResolveQualityIssueRequest,
    ResponseCorrectionHistorySchema,
    ResponseCorrectionRequest,
    SurveyResponseDetail,
    SyncBatchRequest,
    SyncBatchResult,
)
from app.schemas.questionnaire import QuestionnaireResponse
from app.services.data_collection_service import DataCollectionService

router = APIRouter(prefix="/data-collection", tags=["Data Collection & Quality"])


@router.get(
    "/published-surveys",
    response_model=List[QuestionnaireResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve published, immutable questionnaires ready for field participant intake",
)
async def get_published_surveys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.get_published_surveys(current_user)


@router.post(
    "/sync",
    response_model=SyncBatchResult,
    status_code=status.HTTP_200_OK,
    summary="Synchronise a batch of offline submissions with per-submission transactional isolation",
)
async def sync_offline_batch(
    payload: SyncBatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.sync_batch(payload, current_user)


@router.get(
    "/monitoring",
    response_model=CollectionMonitoringMetrics,
    status_code=status.HTTP_200_OK,
    summary="Retrieve real-time field data collection monitoring metrics",
)
async def get_collection_monitoring(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.get_monitoring_metrics(current_user)


@router.get(
    "/responses",
    response_model=List[SurveyResponseDetail],
    status_code=status.HTTP_200_OK,
    summary="List submitted survey responses with answers, data quality issues, and corrections",
)
async def list_responses(
    study_id: Optional[uuid.UUID] = Query(None, alias="studyId"),
    questionnaire_id: Optional[uuid.UUID] = Query(None, alias="questionnaireId"),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.list_responses(
        current_user=current_user,
        study_id=study_id,
        questionnaire_id=questionnaire_id,
        status=status_filter,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/responses/{response_id}",
    response_model=SurveyResponseDetail,
    status_code=status.HTTP_200_OK,
    summary="Retrieve detailed survey response by submission ID",
)
async def get_response_detail(
    response_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.get_response_detail(response_id, current_user)


@router.post(
    "/responses/{response_id}/corrections",
    response_model=ResponseCorrectionHistorySchema,
    status_code=status.HTTP_201_CREATED,
    summary="Record an audited data quality correction for a survey response item",
)
async def record_response_correction(
    response_id: uuid.UUID,
    payload: ResponseCorrectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.record_correction(response_id, payload, current_user)


@router.get(
    "/quality-issues",
    response_model=List[DataQualityIssueSchema],
    status_code=status.HTTP_200_OK,
    summary="List data quality issues flagged during response intake",
)
async def list_data_quality_issues(
    study_id: Optional[uuid.UUID] = Query(None, alias="studyId"),
    response_id: Optional[uuid.UUID] = Query(None, alias="responseId"),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.list_quality_issues(
        current_user=current_user,
        study_id=study_id,
        response_id=response_id,
        status=status_filter,
        limit=limit,
        offset=offset,
    )


@router.put(
    "/quality-issues/{issue_id}/resolve",
    response_model=DataQualityIssueSchema,
    status_code=status.HTTP_200_OK,
    summary="Resolve or dismiss a data quality issue with resolution notes",
)
async def resolve_quality_issue(
    issue_id: uuid.UUID,
    payload: ResolveQualityIssueRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.resolve_quality_issue(
        issue_id=issue_id,
        resolution_notes=payload.resolution_notes,
        status=payload.status or "resolved",
        current_user=current_user,
    )

