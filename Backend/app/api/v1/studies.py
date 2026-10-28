import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_client_ip, get_current_user, get_user_agent
from app.core.database import get_db
from app.models.user import User
from app.schemas.common import PaginatedResponse, StandardResponse
from app.schemas.protocol import StudyMethodAnalysisConfigurationSchema
from app.schemas.study import (
    StudyCreateRequest,
    StudyGovernanceUpdateRequest,
    StudyMemberAddRequest,
    StudyMemberResponse,
    StudyResponse,
    StudyStatusSummaryResponse,
    StudyUpdateRequest,
)
from app.services.study_service import StudyService

router = APIRouter(prefix="/studies", tags=["Study Management"])


@router.post(
    "",
    response_model=StudyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new research study",
)
async def create_study(
    payload: StudyCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    service = StudyService(db)
    return await service.create_study(payload, current_user, ip, ua)


@router.get(
    "",
    response_model=List[StudyResponse],
    status_code=status.HTTP_200_OK,
    summary="List studies accessible to authenticated user",
)
async def list_studies(
    status: Optional[str] = Query(None, description="Filter by study lifecycle status"),
    search: Optional[str] = Query(None, description="Search by title or protocol number"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StudyService(db)
    items, _ = await service.list_studies(
        current_user=current_user,
        status=status,
        search=search,
        page=page,
        limit=limit,
    )
    return items


@router.get(
    "/status-summary",
    response_model=StudyStatusSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Study status summary count distribution",
)
async def get_study_status_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StudyService(db)
    return await service.get_status_summary(current_user)


@router.get(
    "/{study_id}",
    response_model=StudyResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve study details by ID",
)
async def get_study_by_id(
    study_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StudyService(db)
    return await service.get_study_by_id(study_id, current_user)


@router.patch(
    "/{study_id}",
    response_model=StudyResponse,
    status_code=status.HTTP_200_OK,
    summary="Update authorized study fields",
)
async def update_study(
    study_id: uuid.UUID,
    payload: StudyUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    service = StudyService(db)
    return await service.update_study(study_id, payload, current_user, ip, ua)


@router.get(
    "/{study_id}/members",
    response_model=List[StudyMemberResponse],
    status_code=status.HTTP_200_OK,
    summary="List team members of a study",
)
async def list_study_members(
    study_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StudyService(db)
    return await service.list_study_members(study_id, current_user)


@router.post(
    "/{study_id}/members",
    response_model=StudyMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a team member to a study",
)
async def add_study_member(
    study_id: uuid.UUID,
    payload: StudyMemberAddRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    service = StudyService(db)
    return await service.add_study_member(study_id, payload, current_user, ip, ua)


@router.delete(
    "/{study_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a team member from a study",
)
async def remove_study_member(
    study_id: uuid.UUID,
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    service = StudyService(db)
    await service.remove_study_member(study_id, user_id, current_user, ip, ua)


@router.patch(
    "/{study_id}/governance",
    response_model=StudyResponse,
    status_code=status.HTTP_200_OK,
    summary="Update governance and consent framework metadata",
)
async def update_governance(
    study_id: uuid.UUID,
    payload: StudyGovernanceUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    service = StudyService(db)
    return await service.update_governance(study_id, payload, current_user, ip, ua)

