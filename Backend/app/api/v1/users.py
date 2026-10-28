import uuid
from typing import List
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user, require_role, get_client_ip, get_user_agent
from app.models.user import User
from app.services.user_service import UserService
from app.schemas.common import StandardResponse
from app.schemas.user import UserResponse, UserAdminUpdate

router = APIRouter(prefix="/users", tags=["User Management & Administration"])


@router.get(
    "",
    response_model=StandardResponse[List[UserResponse]],
    status_code=status.HTTP_200_OK,
    summary="List registered users (Admin / PI only)",
)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_role("administrator", "principal_investigator")),
    db: AsyncSession = Depends(get_db),
):
    user_service = UserService(db)
    users = await user_service.list_users(current_user, skip, limit)
    return StandardResponse(
        success=True,
        message=f"Retrieved {len(users)} users",
        data=[UserResponse.model_validate(u) for u in users],
    )


@router.get(
    "/{user_id}",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Get user details by ID (Admin only)",
)
async def get_user_by_id(
    user_id: uuid.UUID,
    current_user: User = Depends(require_role("administrator")),
    db: AsyncSession = Depends(get_db),
):
    user_service = UserService(db)
    user = await user_service.get_user_profile(user_id)
    return StandardResponse(
        success=True,
        message="User details retrieved",
        data=UserResponse.model_validate(user),
    )


@router.patch(
    "/{user_id}",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Modify user role or account status (Admin only)",
)
async def admin_update_user(
    user_id: uuid.UUID,
    payload: UserAdminUpdate,
    request: Request,
    current_user: User = Depends(require_role("administrator")),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    user_service = UserService(db)
    updated = await user_service.admin_update_user(user_id, payload, current_user, ip, ua)
    return StandardResponse(
        success=True,
        message="User updated successfully",
        data=UserResponse.model_validate(updated),
    )


@router.post(
    "/{user_id}/activate",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Reactivate a deactivated account (Admin only)",
)
async def activate_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role("administrator")),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    user_service = UserService(db)
    updated = await user_service.activate_user(user_id, current_user, ip, ua)
    return StandardResponse(
        success=True,
        message="Account has been activated",
        data=UserResponse.model_validate(updated),
    )


@router.post(
    "/{user_id}/deactivate",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Deactivate a user account (Admin only)",
)
async def deactivate_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role("administrator")),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    user_service = UserService(db)
    updated = await user_service.deactivate_user(user_id, current_user, ip, ua)
    return StandardResponse(
        success=True,
        message="Account has been deactivated",
        data=UserResponse.model_validate(updated),
    )
