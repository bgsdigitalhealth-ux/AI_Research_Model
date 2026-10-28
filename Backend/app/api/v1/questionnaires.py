import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.questionnaire import (
    AiGenerateQuestionnairePayload,
    ApproveQuestionnaireRequest,
    ObjectiveOutcomeMappingSchema,
    PublishQuestionnaireRequest,
    QuestionnaireCreateRequest,
    QuestionnaireMetricsResponse,
    QuestionnaireResponse,
    QuestionnaireUpdateRequest,
    QuestionnaireVersionItemResponse,
)
from app.services.questionnaire_service import QuestionnaireService

router = APIRouter(prefix="/questionnaires", tags=["Questionnaire Management"])


@router.get(
    "/metrics",
    response_model=QuestionnaireMetricsResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve aggregate questionnaire metrics",
)
async def get_questionnaire_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionnaireService(db)
    return await service.get_metrics(current_user)


@router.post(
    "/generate",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate candidate questionnaire using configured AI provider",
)
async def generate_ai_questionnaire(
    payload: AiGenerateQuestionnairePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionnaireService(db)
    return await service.generate_ai_questionnaire(payload, current_user)


@router.get(
    "",
    response_model=List[QuestionnaireResponse],
    status_code=status.HTTP_200_OK,
    summary="List questionnaires accessible to user",
)
async def list_questionnaires(
    studyId: Optional[uuid.UUID] = Query(None, alias="studyId", description="Filter by study ID"),
    status: Optional[str] = Query(None, description="Filter by questionnaire status"),
    search: Optional[str] = Query(None, description="Search term across title and description"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionnaireService(db)
    return await service.list_questionnaires(
        current_user=current_user,
        study_id=studyId,
        status=status,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new draft questionnaire",
)
async def create_questionnaire(
    payload: QuestionnaireCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionnaireService(db)
    return await service.create_questionnaire(payload, current_user)


@router.get(
    "/{questionnaire_id}",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve single questionnaire with sections and questions",
)
async def get_questionnaire(
    questionnaire_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionnaireService(db)
    return await service.get_questionnaire(questionnaire_id, current_user)


@router.put(
    "/{questionnaire_id}",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_200_OK,
    summary="Update questionnaire schema, sections, or questions",
)
async def update_questionnaire(
    questionnaire_id: uuid.UUID,
    payload: QuestionnaireUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionnaireService(db)
    return await service.update_questionnaire(questionnaire_id, payload, current_user)


@router.delete(
    "/{questionnaire_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a draft questionnaire",
)
async def delete_questionnaire(
    questionnaire_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionnaireService(db)
    await service.delete_questionnaire(questionnaire_id, current_user)


@router.post(
    "/{questionnaire_id}/submit-review",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit questionnaire for investigator review",
)
async def submit_for_review(
    questionnaire_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionnaireService(db)
    return await service.submit_for_review(questionnaire_id, current_user)


@router.post(
    "/{questionnaire_id}/approve",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve questionnaire metadata and structure",
)
async def approve_questionnaire(
    questionnaire_id: uuid.UUID,
    payload: Optional[ApproveQuestionnaireRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notes = payload.notes if payload else None
    service = QuestionnaireService(db)
    return await service.approve_questionnaire(questionnaire_id, notes, current_user)


@router.post(
    "/{questionnaire_id}/publish",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_200_OK,
    summary="Publish questionnaire, creating immutable version snapshot",
)
async def publish_questionnaire(
    questionnaire_id: uuid.UUID,
    payload: Optional[PublishQuestionnaireRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    change_summary = payload.change_summary if payload else None
    service = QuestionnaireService(db)
    return await service.publish_questionnaire(questionnaire_id, change_summary, current_user)


@router.post(
    "/{questionnaire_id}/new-version",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Branch published questionnaire into a new editable draft version",
)
async def create_new_version(
    questionnaire_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionnaireService(db)
    return await service.create_new_version(questionnaire_id, current_user)


@router.get(
    "/{questionnaire_id}/versions",
    response_model=List[QuestionnaireVersionItemResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve version audit history for questionnaire",
)
async def get_questionnaire_versions(
    questionnaire_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionnaireService(db)
    return await service.get_versions(questionnaire_id, current_user)


@router.get(
    "/{questionnaire_id}/mappings",
    response_model=List[ObjectiveOutcomeMappingSchema],
    status_code=status.HTTP_200_OK,
    summary="Retrieve objective-to-outcome question mappings",
)
async def get_questionnaire_mappings(
    questionnaire_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionnaireService(db)
    return await service.get_mappings(questionnaire_id, current_user)

