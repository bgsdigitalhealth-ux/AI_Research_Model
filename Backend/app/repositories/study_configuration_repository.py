import uuid
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.study_configuration import StudyConfiguration
from app.repositories.base import BaseRepository


class StudyConfigurationRepository(BaseRepository[StudyConfiguration]):
    def __init__(self, session: AsyncSession):
        super().__init__(StudyConfiguration, session)

    async def get_by_study_id(self, study_id: uuid.UUID) -> Optional[StudyConfiguration]:
        stmt = (
            select(StudyConfiguration)
            .options(selectinload(StudyConfiguration.configured_by))
            .where(StudyConfiguration.study_id == study_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_protocol_id(self, protocol_id: uuid.UUID) -> Optional[StudyConfiguration]:
        stmt = (
            select(StudyConfiguration)
            .options(selectinload(StudyConfiguration.configured_by))
            .where(StudyConfiguration.protocol_id == protocol_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def upsert_configuration(
        self,
        study_id: uuid.UUID,
        protocol_id: Optional[uuid.UUID],
        data: Dict[str, Any],
        user_id: uuid.UUID,
    ) -> StudyConfiguration:
        config = await self.get_by_study_id(study_id)
        if not config:
            config = StudyConfiguration(
                study_id=study_id,
                protocol_id=protocol_id,
                configured_by_user_id=user_id,
                **data,
            )
            self.session.add(config)
        else:
            if protocol_id:
                config.protocol_id = protocol_id
            config.configured_by_user_id = user_id
            for k, v in data.items():
                if hasattr(config, k) and v is not None:
                    setattr(config, k, v)

        await self.session.flush()
        return config

