import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.token import VerificationToken
from app.models.user import User
from app.repositories.base import BaseRepository


class TokenRepository(BaseRepository[VerificationToken]):
    def __init__(self, session: AsyncSession):
        super().__init__(VerificationToken, session)

    async def get_valid_token(
        self, token_hash: str, token_type: str
    ) -> Optional[VerificationToken]:
        now = datetime.now(timezone.utc)
        stmt = (
            select(VerificationToken)
            .options(
                selectinload(VerificationToken.user).selectinload(User.global_role),
            )
            .where(
                VerificationToken.token_hash == token_hash,
                VerificationToken.token_type == token_type,
                VerificationToken.is_used == False,
                VerificationToken.expires_at > now,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def mark_used(self, token_id: uuid.UUID) -> bool:
        stmt = (
            update(VerificationToken)
            .where(VerificationToken.id == token_id)
            .values(is_used=True)
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0

    async def invalidate_previous_tokens(
        self, user_id: uuid.UUID, token_type: str
    ) -> int:
        stmt = (
            update(VerificationToken)
            .where(
                VerificationToken.user_id == user_id,
                VerificationToken.token_type == token_type,
                VerificationToken.is_used == False,
            )
            .values(is_used=True)
        )
        result = await self.session.execute(stmt)
        return result.rowcount
