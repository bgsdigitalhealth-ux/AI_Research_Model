import uuid
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.participant import Participant, ParticipantIdentityMapping
from app.repositories.base import BaseRepository


class ParticipantRepository(BaseRepository[Participant]):
    def __init__(self, session: AsyncSession):
        super().__init__(Participant, session)

    async def get_by_identifier(
        self, study_id: uuid.UUID, identifier_code: str
    ) -> Optional[Participant]:
        stmt = (
            select(Participant)
            .options(selectinload(Participant.study))
            .where(
                Participant.study_id == study_id,
                Participant.identifier_code == identifier_code.strip(),
            )
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def get_or_create(
        self,
        study_id: uuid.UUID,
        identifier_code: str,
        created_by_user_id: Optional[uuid.UUID] = None,
    ) -> Participant:
        existing = await self.get_by_identifier(study_id, identifier_code)
        if existing:
            return existing

        participant = Participant(
            study_id=study_id,
            identifier_code=identifier_code.strip(),
            status="enrolled",
            created_by_user_id=created_by_user_id,
        )
        self.session.add(participant)
        await self.session.flush()
        return participant

    async def list_participants(
        self,
        study_id: Optional[uuid.UUID] = None,
        accessible_study_ids: Optional[List[uuid.UUID]] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Participant], int]:
        query = select(Participant).options(selectinload(Participant.study))

        if study_id:
            query = query.where(Participant.study_id == study_id)
        elif accessible_study_ids is not None:
            query = query.where(Participant.study_id.in_(accessible_study_ids))

        if status:
            query = query.where(Participant.status == status)

        count_stmt = select(func.count()).select_from(query.order_by(None).subquery())
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        query = query.order_by(Participant.created_at.desc()).limit(limit).offset(offset)
        res = await self.session.execute(query)
        items = list(res.scalars().all())
        return items, total

    async def get_metrics(
        self, accessible_study_ids: Optional[List[uuid.UUID]] = None
    ) -> Dict[str, Any]:
        """
        Calculates authoritative real participant enrollment metrics from the database.
        """
        query = select(Participant.status, func.count(Participant.id)).group_by(Participant.status)
        if accessible_study_ids is not None:
            query = query.where(Participant.study_id.in_(accessible_study_ids))

        res = await self.session.execute(query)
        status_counts = {row[0]: row[1] for row in res.all()}

        total_enrolled = sum(status_counts.values())
        active = status_counts.get("active", 0) + status_counts.get("enrolled", 0)
        completed = status_counts.get("completed", 0)
        screened = total_enrolled + status_counts.get("screened", 0)
        withdrawn = status_counts.get("withdrawn", 0) + status_counts.get("lost_to_follow_up", 0)

        retention = (
            round(((total_enrolled - withdrawn) / total_enrolled) * 100.0, 1)
            if total_enrolled > 0
            else 100.0
        )

        return {
            "total_screened": screened,
            "total_enrolled": total_enrolled,
            "active_participants": active,
            "completed_participants": completed,
            "retention_rate": retention,
        }

