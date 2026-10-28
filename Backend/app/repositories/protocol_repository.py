import uuid
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.protocol import Protocol
from app.models.protocol_extraction import ProtocolExtraction
from app.models.protocol_version import ProtocolVersion
from app.repositories.base import BaseRepository


class ProtocolRepository(BaseRepository[Protocol]):
    def __init__(self, session: AsyncSession):
        super().__init__(Protocol, session)

    async def get_protocol_by_id(self, protocol_id: uuid.UUID) -> Optional[Protocol]:
        stmt = (
            select(Protocol)
            .options(
                selectinload(Protocol.study),
                selectinload(Protocol.uploaded_by),
                selectinload(Protocol.approved_by),
                selectinload(Protocol.extraction).selectinload(ProtocolExtraction.fields),
                selectinload(Protocol.versions),
            )
            .where(Protocol.id == protocol_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_protocols(
        self,
        accessible_study_ids: Optional[List[uuid.UUID]] = None,
        study_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Protocol], int]:
        """
        Lists protocols accessible to the user with optional filters for study, status, and title search.
        """
        query = select(Protocol).options(
            selectinload(Protocol.study),
            selectinload(Protocol.uploaded_by),
        )

        if study_id:
            query = query.where(Protocol.study_id == study_id)
        elif accessible_study_ids is not None:
            query = query.where(Protocol.study_id.in_(accessible_study_ids))

        if status:
            query = query.where(Protocol.status == status)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                (Protocol.title.ilike(search_term)) | (Protocol.file_name.ilike(search_term))
            )

        # Count total
        count_stmt = select(func.count()).select_from(query.order_by(None).subquery())
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        query = query.order_by(Protocol.created_at.desc()).limit(limit).offset(offset)
        result = await self.session.execute(query)
        items = list(result.scalars().all())

        return items, total

    async def get_latest_protocol_for_study(self, study_id: uuid.UUID) -> Optional[Protocol]:
        stmt = (
            select(Protocol)
            .where(Protocol.study_id == study_id, Protocol.is_latest == True)
            .order_by(Protocol.version_number.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create_version_snapshot(
        self,
        protocol: Protocol,
        uploaded_by_user_id: uuid.UUID,
        changes_summary: Optional[str] = None,
    ) -> ProtocolVersion:
        """
        Creates an immutable historical snapshot entry of a protocol version.
        """
        version = ProtocolVersion(
            protocol_id=protocol.id,
            study_id=protocol.study_id,
            version_number=protocol.version,
            file_name=protocol.file_name,
            file_path=protocol.file_path,
            file_size_bytes=protocol.file_size_bytes,
            checksum_sha256=protocol.checksum_sha256,
            status=protocol.status,
            changes_summary=changes_summary,
            uploaded_by_user_id=uploaded_by_user_id,
        )
        self.session.add(version)
        await self.session.flush()
        return version

    async def list_versions(self, protocol_id: uuid.UUID) -> List[ProtocolVersion]:
        stmt = (
            select(ProtocolVersion)
            .options(selectinload(ProtocolVersion.uploaded_by))
            .where(ProtocolVersion.protocol_id == protocol_id)
            .order_by(ProtocolVersion.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

