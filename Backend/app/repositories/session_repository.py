import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.session import UserSession
from app.models.user import User
from app.repositories.base import BaseRepository


class SessionRepository(BaseRepository[UserSession]):
    def __init__(self, session: AsyncSession):
        super().__init__(UserSession, session)

    async def get_active_by_hash(self, token_hash: str) -> Optional[UserSession]:
        now = datetime.now(timezone.utc)
        stmt = (
            select(UserSession)
            .options(
                selectinload(UserSession.user).selectinload(User.global_role),
                selectinload(UserSession.user).selectinload(User.organization),
            )
            .where(
                UserSession.token_hash == token_hash,
                UserSession.is_revoked == False,
                UserSession.expires_at > now,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def revoke_session_by_hash(self, token_hash: str) -> bool:
        stmt = (
            update(UserSession)
            .where(UserSession.token_hash == token_hash)
            .values(is_revoked=True)
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0

    async def revoke_all_user_sessions(self, user_id: uuid.UUID) -> int:
        stmt = (
            update(UserSession)
            .where(UserSession.user_id == user_id, UserSession.is_revoked == False)
            .values(is_revoked=True)
        )
        result = await self.session.execute(stmt)
        return result.rowcount
