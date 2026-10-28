import uuid
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.role import Role
from app.models.study import Study
from app.models.study_membership import StudyMembership
from app.models.user import User
from app.repositories.base import BaseRepository


class StudyRepository(BaseRepository[Study]):
    def __init__(self, session: AsyncSession):
        super().__init__(Study, session)

    async def get_study_by_id(self, study_id: uuid.UUID) -> Optional[Study]:
        stmt = (
            select(Study)
            .options(
                selectinload(Study.principal_investigator),
                selectinload(Study.created_by),
                selectinload(Study.organization),
                selectinload(Study.configuration),
            )
            .where(Study.id == study_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_protocol_number(self, protocol_number: str) -> Optional[Study]:
        stmt = select(Study).where(Study.protocol_number == protocol_number)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_accessible_studies(
        self,
        user_id: uuid.UUID,
        is_global_admin: bool = False,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Study], int]:
        """
        Lists studies accessible to the user based on strict RBAC and study membership isolation.
        Global administrators see all studies in their system scope.
        Researchers and team members only see studies they lead, created, or belong to via active membership.
        """
        query = select(Study).options(
            selectinload(Study.principal_investigator),
            selectinload(Study.created_by),
        )

        if not is_global_admin:
            # Subquery of study IDs the user belongs to
            membership_subquery = (
                select(StudyMembership.study_id)
                .where(
                    StudyMembership.user_id == user_id,
                    StudyMembership.is_active == True,
                )
            )
            query = query.where(
                (Study.created_by_user_id == user_id)
                | (Study.principal_investigator_id == user_id)
                | (Study.id.in_(membership_subquery))
            )

        if status:
            query = query.where(Study.status == status)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                (Study.title.ilike(search_term)) | (Study.protocol_number.ilike(search_term))
            )

        # Count total
        count_stmt = select(func.count()).select_from(query.order_by(None).subquery())
        count_result = await self.session.execute(count_stmt)
        total = count_result.scalar_one()

        # Paginated results
        query = query.order_by(Study.created_at.desc()).limit(limit).offset(offset)
        result = await self.session.execute(query)
        items = list(result.scalars().all())

        return items, total

    async def check_user_study_access(
        self, study_id: uuid.UUID, user_id: uuid.UUID, is_global_admin: bool = False
    ) -> bool:
        """Checks if a user has permission to access a study."""
        if is_global_admin:
            return True

        stmt = select(Study).where(Study.id == study_id)
        res = await self.session.execute(stmt)
        study = res.scalars().first()
        if not study:
            return False

        if study.created_by_user_id == user_id or study.principal_investigator_id == user_id:
            return True

        membership_stmt = select(StudyMembership).where(
            StudyMembership.study_id == study_id,
            StudyMembership.user_id == user_id,
            StudyMembership.is_active == True,
        )
        membership_res = await self.session.execute(membership_stmt)
        return membership_res.scalars().first() is not None

    async def get_study_status_counts(
        self, user_id: uuid.UUID, is_global_admin: bool = False
    ) -> Dict[str, int]:
        """Returns study counts grouped by status."""
        query = select(Study.status, func.count(Study.id)).group_by(Study.status)

        if not is_global_admin:
            membership_subquery = select(StudyMembership.study_id).where(
                StudyMembership.user_id == user_id,
                StudyMembership.is_active == True,
            )
            query = query.where(
                (Study.created_by_user_id == user_id)
                | (Study.principal_investigator_id == user_id)
                | (Study.id.in_(membership_subquery))
            )

        result = await self.session.execute(query)
        counts = {row[0]: row[1] for row in result.all()}
        return counts


class StudyMembershipRepository(BaseRepository[StudyMembership]):
    def __init__(self, session: AsyncSession):
        super().__init__(StudyMembership, session)

    async def get_user_study_membership(
        self, study_id: uuid.UUID, user_id: uuid.UUID
    ) -> Optional[StudyMembership]:
        stmt = (
            select(StudyMembership)
            .options(
                selectinload(StudyMembership.role),
                selectinload(StudyMembership.user),
            )
            .where(
                StudyMembership.study_id == study_id,
                StudyMembership.user_id == user_id,
                StudyMembership.is_active == True,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_study_members(self, study_id: uuid.UUID) -> List[StudyMembership]:
        stmt = (
            select(StudyMembership)
            .options(
                selectinload(StudyMembership.role),
                selectinload(StudyMembership.user),
            )
            .where(
                StudyMembership.study_id == study_id,
                StudyMembership.is_active == True,
            )
            .order_by(StudyMembership.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_user_study_memberships(
        self, user_id: uuid.UUID
    ) -> List[StudyMembership]:
        stmt = (
            select(StudyMembership)
            .options(
                selectinload(StudyMembership.role),
            )
            .where(
                StudyMembership.user_id == user_id,
                StudyMembership.is_active == True,
            )
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
