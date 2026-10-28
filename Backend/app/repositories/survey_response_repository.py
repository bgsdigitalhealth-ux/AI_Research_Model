import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.data_quality_issue import DataQualityIssue
from app.models.questionnaire import Questionnaire
from app.models.response_correction_history import ResponseCorrectionHistory
from app.models.study import Study
from app.models.survey_response import SurveyResponse
from app.models.survey_response_answer import SurveyResponseAnswer
from app.models.sync_batch import SyncBatch
from app.repositories.base import BaseRepository


class SurveyResponseRepository(BaseRepository[SurveyResponse]):
    def __init__(self, session: AsyncSession):
        super().__init__(SurveyResponse, session)

    async def get_by_submission_id(self, submission_id: uuid.UUID) -> Optional[SurveyResponse]:
        stmt = (
            select(SurveyResponse)
            .options(
                selectinload(SurveyResponse.answers),
                selectinload(SurveyResponse.consent),
                selectinload(SurveyResponse.quality_issues),
                selectinload(SurveyResponse.corrections),
            )
            .where(SurveyResponse.id == submission_id)
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def list_responses(
        self,
        study_id: Optional[uuid.UUID] = None,
        questionnaire_id: Optional[uuid.UUID] = None,
        accessible_study_ids: Optional[List[uuid.UUID]] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[SurveyResponse], int]:
        query = select(SurveyResponse).options(
            selectinload(SurveyResponse.answers),
            selectinload(SurveyResponse.consent),
            selectinload(SurveyResponse.quality_issues),
            selectinload(SurveyResponse.corrections),
        )

        if study_id:
            query = query.where(SurveyResponse.study_id == study_id)
        elif accessible_study_ids is not None:
            query = query.where(SurveyResponse.study_id.in_(accessible_study_ids))

        if questionnaire_id:
            query = query.where(SurveyResponse.questionnaire_id == questionnaire_id)

        if status:
            query = query.where(SurveyResponse.status == status)

        count_stmt = select(func.count()).select_from(query.order_by(None).subquery())
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        query = query.order_by(SurveyResponse.server_received_at.desc()).limit(limit).offset(offset)
        res = await self.session.execute(query)
        items = list(res.scalars().all())
        return items, total

    async def list_quality_issues(
        self,
        study_id: Optional[uuid.UUID] = None,
        response_id: Optional[uuid.UUID] = None,
        accessible_study_ids: Optional[List[uuid.UUID]] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[DataQualityIssue], int]:
        query = select(DataQualityIssue).options(
            selectinload(DataQualityIssue.resolved_by),
        )

        if study_id:
            query = query.where(DataQualityIssue.study_id == study_id)
        elif accessible_study_ids is not None:
            query = query.where(DataQualityIssue.study_id.in_(accessible_study_ids))

        if response_id:
            query = query.where(DataQualityIssue.response_id == response_id)

        if status:
            query = query.where(DataQualityIssue.status == status)

        count_stmt = select(func.count()).select_from(query.order_by(None).subquery())
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        query = query.order_by(DataQualityIssue.created_at.desc()).limit(limit).offset(offset)
        res = await self.session.execute(query)
        return list(res.scalars().all()), total

    async def get_monitoring_metrics(
        self, accessible_study_ids: Optional[List[uuid.UUID]] = None
    ) -> Dict[str, Any]:
        """
        Calculates real monitoring metrics from database records.
        """
        # 1. Total Target Responses from studies
        target_query = select(func.coalesce(func.sum(Study.target_participants), 0))
        if accessible_study_ids is not None:
            target_query = target_query.where(Study.id.in_(accessible_study_ids))
        target_res = await self.session.execute(target_query)
        target_total = int(target_res.scalar_one() or 0)

        # 2. Completed Online Responses
        online_query = select(func.count(SurveyResponse.id)).where(SurveyResponse.sync_source == "online")
        if accessible_study_ids is not None:
            online_query = online_query.where(SurveyResponse.study_id.in_(accessible_study_ids))
        online_res = await self.session.execute(online_query)
        online_count = int(online_res.scalar_one() or 0)

        # 3. Synced Successfully
        synced_query = select(func.count(SurveyResponse.id)).where(SurveyResponse.sync_source == "offline_batch")
        if accessible_study_ids is not None:
            synced_query = synced_query.where(SurveyResponse.study_id.in_(accessible_study_ids))
        synced_res = await self.session.execute(synced_query)
        synced_count = int(synced_res.scalar_one() or 0)

        # 4. Sync Failed (from sync_batches)
        batch_query = select(func.coalesce(func.sum(SyncBatch.rejected_count), 0))
        if accessible_study_ids is not None:
            batch_query = batch_query.where(SyncBatch.study_id.in_(accessible_study_ids))
        batch_res = await self.session.execute(batch_query)
        sync_failed = int(batch_res.scalar_one() or 0)

        # 5. Active Surveys Count (published questionnaires)
        surveys_query = select(func.count(Questionnaire.id)).where(
            Questionnaire.status == "published", Questionnaire.is_published_immutable == True
        )
        if accessible_study_ids is not None:
            surveys_query = surveys_query.where(Questionnaire.study_id.in_(accessible_study_ids))
        surveys_res = await self.session.execute(surveys_query)
        active_surveys = int(surveys_res.scalar_one() or 0)

        # 6. Latest received response timestamp
        latest_query = select(func.max(SurveyResponse.server_received_at))
        if accessible_study_ids is not None:
            latest_query = latest_query.where(SurveyResponse.study_id.in_(accessible_study_ids))
        latest_res = await self.session.execute(latest_query)
        last_sync = latest_res.scalar_one()

        return {
            "total_target_responses": target_total,
            "completed_online": online_count,
            "pending_offline_queue": 0,
            "synced_successfully": synced_count,
            "sync_failed": sync_failed,
            "active_surveys_count": active_surveys,
            "last_sync_timestamp": last_sync,
        }

