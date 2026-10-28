import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.survey_invitation import SurveyInvitation
from app.repositories.base import BaseRepository


class SurveyInvitationRepository(BaseRepository[SurveyInvitation]):
    def __init__(self, session: AsyncSession):
        super().__init__(SurveyInvitation, session)

    async def get_by_token_hash(self, token_hash: str) -> Optional[SurveyInvitation]:
        stmt = (
            select(SurveyInvitation)
            .where(
                SurveyInvitation.token_hash == token_hash,
                SurveyInvitation.is_revoked == False,
            )
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def increment_uses(self, invitation: SurveyInvitation) -> None:
        invitation.uses_count += 1
        await self.session.flush()

