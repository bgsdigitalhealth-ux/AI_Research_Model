import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.session_repository import SessionRepository
from app.repositories.audit_repository import AuditRepository
from app.schemas.user import UserProfileUpdate, UserAdminUpdate


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.session_repo = SessionRepository(session)
        self.audit_repo = AuditRepository(session)

    async def get_user_profile(self, user_id: uuid.UUID) -> User:
        user = await self.user_repo.get_by_id_with_relations(user_id)
        if not user:
            raise NotFoundError("User", str(user_id))
        return user

    async def update_user_profile(
        self,
        user_id: uuid.UUID,
        payload: UserProfileUpdate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        user = await self.user_repo.get_by_id_with_relations(user_id)
        if not user:
            raise NotFoundError("User", str(user_id))

        update_data = {}
        if payload.full_name is not None:
            update_data["full_name"] = payload.full_name.strip()
        if payload.phone_number is not None:
            update_data["phone_number"] = payload.phone_number.strip()

        if update_data:
            await self.user_repo.update(user.id, **update_data)
            await self.audit_repo.log_event(
                event_type="user.profile_update",
                status="success",
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
                details={"updated_fields": list(update_data.keys())},
            )

        updated_user = await self.user_repo.get_by_id_with_relations(user.id)
        return updated_user or user

    async def deactivate_user(
        self,
        target_user_id: uuid.UUID,
        requester: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        """
        Deactivates an account. Users can deactivate their own account, or admins can deactivate any user.
        """
        is_self = requester.id == target_user_id
        is_admin = requester.global_role.name == "administrator"

        if not (is_self or is_admin):
            raise PermissionDeniedError("You do not have permission to deactivate this account")

        user = await self.user_repo.get_by_id_with_relations(target_user_id)
        if not user:
            raise NotFoundError("User", str(target_user_id))

        now = datetime.now(timezone.utc)
        await self.user_repo.update(
            user.id,
            is_active=False,
            deactivated_at=now,
        )

        # Revoke all sessions for deactivated user
        await self.session_repo.revoke_all_user_sessions(user.id)

        await self.audit_repo.log_event(
            event_type="user.deactivated",
            status="success",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"initiated_by": str(requester.id)},
        )

        updated = await self.user_repo.get_by_id_with_relations(user.id)
        return updated or user

    async def activate_user(
        self,
        target_user_id: uuid.UUID,
        requester: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        """
        Reactivates an account. Administrator only.
        """
        if requester.global_role.name != "administrator":
            raise PermissionDeniedError("Only system administrators can reactivate accounts")

        user = await self.user_repo.get_by_id_with_relations(target_user_id)
        if not user:
            raise NotFoundError("User", str(target_user_id))

        await self.user_repo.update(
            user.id,
            is_active=True,
            deactivated_at=None,
        )

        await self.audit_repo.log_event(
            event_type="user.activated",
            status="success",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"initiated_by": str(requester.id)},
        )

        updated = await self.user_repo.get_by_id_with_relations(user.id)
        return updated or user

    async def list_users(
        self,
        requester: User,
        skip: int = 0,
        limit: int = 100,
    ) -> List[User]:
        if requester.global_role.name not in ["administrator", "principal_investigator"]:
            raise PermissionDeniedError("Insufficient permissions to list system users")
        return await self.user_repo.list_users(skip, limit)

    async def admin_update_user(
        self,
        target_user_id: uuid.UUID,
        payload: UserAdminUpdate,
        requester: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        if requester.global_role.name != "administrator":
            raise PermissionDeniedError("Administrator role required to modify user metadata")

        user = await self.user_repo.get_by_id_with_relations(target_user_id)
        if not user:
            raise NotFoundError("User", str(target_user_id))

        update_data = {}
        if payload.global_role_id is not None:
            update_data["global_role_id"] = payload.global_role_id
        if payload.is_active is not None:
            update_data["is_active"] = payload.is_active
            if not payload.is_active:
                update_data["deactivated_at"] = datetime.now(timezone.utc)
                await self.session_repo.revoke_all_user_sessions(user.id)
            else:
                update_data["deactivated_at"] = None
        if payload.is_verified is not None:
            update_data["is_verified"] = payload.is_verified
        if payload.organization_id is not None:
            update_data["organization_id"] = payload.organization_id

        if update_data:
            await self.user_repo.update(user.id, **update_data)
            await self.audit_repo.log_event(
                event_type="user.admin_update",
                status="success",
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
                details={"admin_id": str(requester.id), "fields": list(update_data.keys())},
            )

        updated = await self.user_repo.get_by_id_with_relations(user.id)
        return updated or user
