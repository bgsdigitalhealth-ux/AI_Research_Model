import uuid
from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.data_collection import (
    ConsentRecordSchema,
    ConsentResponse,
    ConsentWordingPayload,
    ServerSyncAcknowledgement,
    SurveyInvitationCreateRequest,
    SurveyInvitationResponse,
    SurveySubmissionRequest,
)
from app.services.data_collection_service import DataCollectionService

router = APIRouter(prefix="/surveys", tags=["Surveys & Participant Intake"])


@router.get(
    "/{questionnaire_id}/consent",
    response_model=ConsentWordingPayload,
    status_code=status.HTTP_200_OK,
    summary="Retrieve approved participant information sheet and consent text for a survey",
)
async def get_survey_consent(
    questionnaire_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    return await service.get_survey_consent(questionnaire_id, current_user)


@router.post(
    "/{questionnaire_id}/consent",
    response_model=ConsentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record explicit participant informed consent with cryptographically hashed wording reference",
)
async def submit_survey_consent(
    questionnaire_id: uuid.UUID,
    payload: ConsentRecordSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    if not payload.questionnaire_id:
        payload.questionnaire_id = questionnaire_id
    return await service.submit_consent(payload, current_user)


@router.post(
    "/{questionnaire_id}/submit",
    response_model=ServerSyncAcknowledgement,
    status_code=status.HTTP_200_OK,
    summary="Submit survey response with idempotent UUID verification, rule validation, and data quality check",
)
async def submit_survey_response(
    questionnaire_id: uuid.UUID,
    payload: SurveySubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    if not payload.questionnaire_id:
        payload.questionnaire_id = questionnaire_id
    return await service.submit_response(payload, current_user, sync_source="online")


@router.post(
    "/{questionnaire_id}/invitations",
    response_model=SurveyInvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a cryptographically secure, rate-limited survey invitation token",
)
async def create_survey_invitation(
    questionnaire_id: uuid.UUID,
    payload: SurveyInvitationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DataCollectionService(db)
    if not payload.questionnaire_id:
        payload.questionnaire_id = questionnaire_id
    return await service.create_invitation(payload, current_user)

