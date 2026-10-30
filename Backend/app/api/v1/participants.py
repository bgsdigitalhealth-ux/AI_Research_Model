import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.participant import (
    ParticipantCreateRequest,
    ParticipantMetrics,
    ParticipantResponse,
    ParticipantWithdrawRequest,
)
from app.services.data_collection_service import DataCollectionService

router = APIRouter(prefix="/participants", tags=["Participant Management"])


@router.get(
    "/metrics",
    response_model=ParticipantMetrics,
    status_code=status.HTTP_200_OK,
    summary="Retrieve aggregate participant recruitment and retention metrics",
)
async def get_participant_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.get_participant_metrics(current_user)


@router.get(
    "",
    response_model=List[ParticipantResponse],
    status_code=status.HTTP_200_OK,
    summary="List pseudonymised participants for accessible research studies",
)
async def list_participants(
    study_id: Optional[uuid.UUID] = Query(None, alias="studyId"),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.list_participants(
        current_user=current_user,
        study_id=study_id,
        status=status_filter,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=ParticipantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enroll a new subject into a research study",
)
async def enroll_participant(
    payload: ParticipantCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.enroll_participant(payload, current_user)


@router.post(
    "/{participant_id}/withdraw",
    response_model=ParticipantResponse,
    status_code=status.HTTP_200_OK,
    summary="Process participant informed consent withdrawal with audited governance reason",
)
async def withdraw_participant(
    participant_id: uuid.UUID,
    payload: ParticipantWithdrawRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.withdraw_participant(
        participant_id=participant_id,
        payload=payload,
        current_user=current_user,
    )
