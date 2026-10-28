import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.consent_record import ConsentRecord
from app.repositories.base import BaseRepository


class ConsentRepository(BaseRepository[ConsentRecord]):
    def __init__(self, session: AsyncSession):
        super().__init__(ConsentRecord, session)

    async def get_by_confirmation_code(self, confirmation_code: str) -> Optional[ConsentRecord]:
        stmt = select(ConsentRecord).where(ConsentRecord.confirmation_code == confirmation_code)
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def get_active_consent(
        self, questionnaire_id: uuid.UUID, participant_identifier: str
    ) -> Optional[ConsentRecord]:
        stmt = (
            select(ConsentRecord)
            .where(
                ConsentRecord.questionnaire_id == questionnaire_id,
                ConsentRecord.participant_identifier == participant_identifier.strip(),
                ConsentRecord.status == "active",
                ConsentRecord.agreed_to_participate == True,
            )
            .order_by(ConsentRecord.consented_at.desc())
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

