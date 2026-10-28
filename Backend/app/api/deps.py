import uuid
from typing import Callable, List, Optional
from fastapi import Depends, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.exceptions import (
    AuthenticationError,
    AccountDeactivatedError,
    PermissionDeniedError,
)
from app.core.security import decode_access_token
from app.core.rbac import Permission, check_permission
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.study_repository import StudyMembershipRepository

security_scheme = HTTPBearer(auto_error=False)


def get_client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def get_user_agent(request: Request) -> Optional[str]:
    return request.headers.get("User-Agent")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extracts Bearer token from header, validates JWT signature and expiry,
    and retrieves active user from database with relations.
    """
    if not credentials or not credentials.credentials:
        raise AuthenticationError("Authentication token is missing")

    token = credentials.credentials
    payload = decode_access_token(token)

    # Disallow temporary MFA challenge tokens on regular endpoints
    if payload.get("stage") == "mfa_challenge":
        raise AuthenticationError("MFA challenge token cannot be used for authenticated endpoints")

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise AuthenticationError("Token payload missing subject")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise AuthenticationError("Invalid user ID in token")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id_with_relations(user_id)
    if not user:
        raise AuthenticationError("User not found or account removed")

    if not user.is_active or user.deactivated_at is not None:
        raise AccountDeactivatedError("Account is inactive or has been deactivated")

    return user


def require_role(*allowed_roles: str) -> Callable:
    """
    Dependency factory requiring user to possess one of the specified global roles.
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.global_role.name
        if user_role not in allowed_roles and user_role != "administrator":
            raise PermissionDeniedError(
                f"Role '{user_role}' does not have access to this resource. Required: {', '.join(allowed_roles)}"
            )
        return current_user

    return role_checker


def require_permission(*required_perms: Permission) -> Callable:
    """
    Dependency factory requiring user to possess all listed permissions.
    """
    async def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.global_role.name
        for perm in required_perms:
            if not check_permission(user_role, perm):
                raise PermissionDeniedError(
                    f"Action forbidden: missing required permission '{perm.value}'"
                )
        return current_user

    return permission_checker


async def check_study_access(
    study_id: uuid.UUID,
    user: User,
    db: AsyncSession,
    required_role: Optional[str] = None,
) -> bool:
    """
    Validates that user is either a global administrator or possesses an active
    membership in the specified study (with optional role check).
    """
    if user.global_role.name == "administrator":
        return True

    study_repo = StudyMembershipRepository(db)
    membership = await study_repo.get_user_study_membership(study_id, user.id)
    if not membership or not membership.is_active:
        raise PermissionDeniedError(f"Access denied: you are not an active member of study '{study_id}'")

    if required_role and membership.role.name != required_role:
        raise PermissionDeniedError(
            f"Insufficient study role '{membership.role.name}'. Required: '{required_role}'"
        )

    return True
