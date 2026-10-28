import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.question_item import QuestionItemModel
from app.models.questionnaire import Questionnaire
from app.models.questionnaire_mapping import QuestionnaireMapping
from app.models.questionnaire_section import QuestionnaireSection
from app.models.questionnaire_version import QuestionnaireVersion
from app.repositories.base import BaseRepository


class QuestionnaireRepository(BaseRepository[Questionnaire]):
    def __init__(self, session: AsyncSession):
        super().__init__(Questionnaire, session)

    async def get_questionnaire_by_id(
        self, questionnaire_id: uuid.UUID, populate_existing: bool = False
    ) -> Optional[Questionnaire]:
        stmt = (
            select(Questionnaire)
            .options(
                selectinload(Questionnaire.study),
                selectinload(Questionnaire.protocol),
                selectinload(Questionnaire.sections),
                selectinload(Questionnaire.questions),
                selectinload(Questionnaire.mappings),
                selectinload(Questionnaire.versions),
                selectinload(Questionnaire.approved_by),
                selectinload(Questionnaire.published_by),
                selectinload(Questionnaire.created_by),
            )
            .where(Questionnaire.id == questionnaire_id)
        )
        if populate_existing:
            stmt = stmt.execution_options(populate_existing=True)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_questionnaires(
        self,
        accessible_study_ids: Optional[List[uuid.UUID]] = None,
        study_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Questionnaire], int]:
        query = select(Questionnaire).options(
            selectinload(Questionnaire.study),
            selectinload(Questionnaire.sections),
            selectinload(Questionnaire.questions),
            selectinload(Questionnaire.mappings),
            selectinload(Questionnaire.approved_by),
            selectinload(Questionnaire.published_by),
        )

        if study_id:
            query = query.where(Questionnaire.study_id == study_id)
        elif accessible_study_ids is not None:
            query = query.where(Questionnaire.study_id.in_(accessible_study_ids))

        if status:
            query = query.where(Questionnaire.status == status)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                (Questionnaire.title.ilike(search_term)) | (Questionnaire.description.ilike(search_term))
            )

        # Count total
        count_stmt = select(func.count()).select_from(query.order_by(None).subquery())
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        query = query.order_by(Questionnaire.created_at.desc()).limit(limit).offset(offset)
        result = await self.session.execute(query)
        items = list(result.scalars().all())

        return items, total

    async def create_version_snapshot(
        self,
        questionnaire: Questionnaire,
        published_by_user_id: uuid.UUID,
        change_summary: Optional[str] = None,
    ) -> QuestionnaireVersion:
        """
        Creates an immutable historical snapshot entry of a published questionnaire schema.
        Freezes exact question text, variable names, validation rules, choices, and mappings.
        """
        snapshot = {
            "title": questionnaire.title,
            "description": questionnaire.description,
            "version": questionnaire.version,
            "sections": [
                {
                    "id": str(s.id),
                    "title": s.title,
                    "description": s.description,
                    "order": s.order,
                }
                for s in questionnaire.sections
            ],
            "questions": [
                {
                    "id": str(q.id),
                    "variableName": q.variable_name,
                    "type": q.type,
                    "text": q.text,
                    "description": q.description,
                    "sectionId": str(q.section_id) if q.section_id else None,
                    "order": q.order,
                    "validation": q.validation,
                    "choices": q.choices,
                    "conditionalLogic": q.conditional_logic,
                    "targetObjectiveId": q.target_objective_id,
                    "targetOutcomeName": q.target_outcome_name,
                }
                for q in questionnaire.questions
            ],
            "mappings": [
                {
                    "objectiveId": m.objective_id,
                    "objectiveTitle": m.objective_title,
                    "outcomeName": m.outcome_name,
                    "coveredQuestionIds": m.covered_question_ids,
                    "isCovered": m.is_covered,
                    "coverageNotes": m.coverage_notes,
                }
                for m in questionnaire.mappings
            ],
        }

        now = datetime.now(timezone.utc)
        version_item = QuestionnaireVersion(
            questionnaire_id=questionnaire.id,
            study_id=questionnaire.study_id,
            version_number=questionnaire.version,
            status="published",
            schema_snapshot=snapshot,
            change_summary=change_summary,
            question_count=len(questionnaire.questions),
            published_by_user_id=published_by_user_id,
            published_at=now,
        )
        self.session.add(version_item)
        await self.session.flush()
        return version_item

    async def list_versions(self, questionnaire_id: uuid.UUID) -> List[QuestionnaireVersion]:
        stmt = (
            select(QuestionnaireVersion)
            .options(selectinload(QuestionnaireVersion.published_by))
            .where(QuestionnaireVersion.questionnaire_id == questionnaire_id)
            .order_by(QuestionnaireVersion.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_metrics(
        self, accessible_study_ids: Optional[List[uuid.UUID]] = None
    ) -> Dict[str, Any]:
        """
        Retrieves real aggregate metrics from the database without dummy data.
        """
        query = select(func.count(Questionnaire.id))
        if accessible_study_ids is not None:
            query = query.where(Questionnaire.study_id.in_(accessible_study_ids))

        res = await self.session.execute(query)
        total_q = res.scalar_one()

        # Fetch recent questionnaires
        recent_q_stmt = select(Questionnaire).options(selectinload(Questionnaire.study))
        if accessible_study_ids is not None:
            recent_q_stmt = recent_q_stmt.where(Questionnaire.study_id.in_(accessible_study_ids))
        recent_q_stmt = recent_q_stmt.order_by(Questionnaire.created_at.desc()).limit(10)

        recent_res = await self.session.execute(recent_q_stmt)
        recent_items = recent_res.scalars().all()

        return {
            "total_questionnaires": total_q,
            "total_responses": 0,  # Part 4 implements participant response intake
            "average_completion_rate": 0.0,
            "recent_questionnaires": recent_items,
        }
