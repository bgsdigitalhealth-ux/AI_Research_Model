import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    InvalidQuestionnaireError,
    NotFoundError,
    PermissionDeniedError,
    VersionImmutableError,
)
from app.core.rbac import Permission, RoleName, check_permission
from app.models.question_item import QuestionItemModel
from app.models.questionnaire import Questionnaire
from app.models.questionnaire_mapping import QuestionnaireMapping
from app.models.questionnaire_section import QuestionnaireSection
from app.models.questionnaire_version import QuestionnaireVersion
from app.models.study import Study
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.questionnaire_repository import QuestionnaireRepository
from app.repositories.study_repository import StudyMembershipRepository, StudyRepository
from app.schemas.questionnaire import (
    AiGenerateQuestionnairePayload,
    ChoiceOptionSchema,
    ConditionalLogicSchema,
    ObjectiveOutcomeMappingSchema,
    QuestionItemSchema,
    QuestionnaireCreateRequest,
    QuestionnaireMetricsResponse,
    QuestionnaireResponse,
    QuestionnaireSectionSchema,
    QuestionnaireUpdateRequest,
    QuestionnaireVersionItemResponse,
    QuestionValidationRulesSchema,
)
from app.services.ai_adapter import get_ai_provider


class QuestionnaireService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.questionnaire_repo = QuestionnaireRepository(session)
        self.study_repo = StudyRepository(session)
        self.membership_repo = StudyMembershipRepository(session)
        self.audit_repo = AuditRepository(session)

    def _is_admin(self, user: User) -> bool:
        return bool(user.global_role and user.global_role.name == RoleName.ADMINISTRATOR)

    async def _verify_study_permission(
        self, study_id: uuid.UUID, user: User, required_permission: Permission
    ) -> Study:
        study = await self.study_repo.get_study_by_id(study_id)
        if not study:
            raise NotFoundError("Study", str(study_id))

        if self._is_admin(user):
            return study

        if study.created_by_user_id == user.id or study.principal_investigator_id == user.id:
            return study

        membership = await self.membership_repo.get_user_study_membership(study_id, user.id)
        if not membership or not membership.is_active:
            raise PermissionDeniedError(f"You do not have access to study '{study_id}'.")

        user_role = membership.role.name if membership.role else user.global_role.name
        if not check_permission(user_role, required_permission):
            raise PermissionDeniedError(f"Missing required permission: '{required_permission.value}'")

        return study

    async def _get_accessible_study_ids(self, user: User) -> Optional[List[uuid.UUID]]:
        if self._is_admin(user):
            return None  # Unrestricted access

        from sqlalchemy import select
        from app.models.study_membership import StudyMembership

        membership_subquery = select(StudyMembership.study_id).where(
            StudyMembership.user_id == user.id,
            StudyMembership.is_active == True,
        )
        stmt = select(Study.id).where(
            (Study.created_by_user_id == user.id)
            | (Study.principal_investigator_id == user.id)
            | (Study.id.in_(membership_subquery))
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    def validate_questions_and_logic(self, questions: List[QuestionItemSchema]) -> None:
        """
        Validates variable name uniqueness and checks for circular dependencies in conditional logic.
        """
        seen_vars: Set[str] = set()
        q_ids: Set[str] = set()

        for q in questions:
            var_norm = q.variable_name.strip().lower()
            if var_norm in seen_vars:
                raise InvalidQuestionnaireError(
                    f"Duplicate variable name '{q.variable_name}'. Each question variable must be unique."
                )
            seen_vars.add(var_norm)
            q_ids.add(str(q.id))

        # Directed graph for cycle detection: question -> list of target questions it depends on
        dep_graph: Dict[str, List[str]] = {str(q.id): [] for q in questions}

        for q in questions:
            qid_str = str(q.id)
            if q.conditional_logic and q.conditional_logic.rules:
                for rule in q.conditional_logic.rules:
                    target_id = str(rule.target_question_id)
                    if target_id not in q_ids:
                        raise InvalidQuestionnaireError(
                            f"Question '{q.variable_name}' has conditional logic referencing non-existent question ID '{target_id}'."
                        )
                    if target_id == qid_str:
                        raise InvalidQuestionnaireError(
                            f"Question '{q.variable_name}' cannot have conditional logic referencing itself."
                        )
                    dep_graph[qid_str].append(target_id)

        # Graph cycle detection (0: unvisited, 1: visiting, 2: visited)
        visit_state: Dict[str, int] = {qid: 0 for qid in q_ids}

        def check_cycle(u: str) -> bool:
            visit_state[u] = 1
            for v in dep_graph.get(u, []):
                if visit_state[v] == 1:
                    return True
                if visit_state[v] == 0:
                    if check_cycle(v):
                        return True
            visit_state[u] = 2
            return False

        for qid in q_ids:
            if visit_state[qid] == 0:
                if check_cycle(qid):
                    raise InvalidQuestionnaireError(
                        "Circular dependency detected in question conditional logic branching."
                    )

    def serialize_questionnaire(self, q: Questionnaire) -> QuestionnaireResponse:
        sections = [
            QuestionnaireSectionSchema(
                id=str(s.id),
                title=s.title,
                description=s.description,
                order=s.order,
            )
            for s in (q.sections or [])
        ]
        questions = [
            QuestionItemSchema(
                id=str(qi.id),
                variable_name=qi.variable_name,
                type=qi.type,
                text=qi.text,
                description=qi.description,
                section_id=str(qi.section_id) if qi.section_id else None,
                order=qi.order,
                validation=QuestionValidationRulesSchema(**(qi.validation or {})),
                choices=[ChoiceOptionSchema(**c) for c in qi.choices] if qi.choices else None,
                conditional_logic=ConditionalLogicSchema(**qi.conditional_logic) if qi.conditional_logic else None,
                is_ai_generated=qi.is_ai_generated,
                verified_by_researcher=qi.verified_by_researcher,
                target_objective_id=qi.target_objective_id,
                target_outcome_name=qi.target_outcome_name,
            )
            for qi in (q.questions or [])
        ]
        mappings = [
            ObjectiveOutcomeMappingSchema(
                objective_id=m.objective_id,
                objective_title=m.objective_title,
                outcome_name=m.outcome_name,
                covered_question_ids=m.covered_question_ids or [],
                is_covered=m.is_covered,
                coverage_notes=m.coverage_notes,
            )
            for m in (q.mappings or [])
        ]

        return QuestionnaireResponse(
            id=q.id,
            title=q.title,
            description=q.description,
            study_id=q.study_id,
            study_title=q.study.title if q.study else None,
            protocol_id=q.protocol_id,
            version=q.version,
            status=q.status,
            is_ai_generated=q.is_ai_generated,
            scientific_validation_claim=q.scientific_validation_claim,
            sections=sections,
            questions=questions,
            mappings=mappings,
            created_at=q.created_at,
            updated_at=q.updated_at,
            approved_by=q.approved_by.full_name if q.approved_by else None,
            approved_at=q.approved_at,
            published_by=q.published_by.full_name if q.published_by else None,
            published_at=q.published_at,
        )

    async def create_questionnaire(
        self, payload: QuestionnaireCreateRequest, current_user: User
    ) -> QuestionnaireResponse:
        await self._verify_study_permission(payload.study_id, current_user, Permission.QUESTIONNAIRE_BUILD)

        if payload.questions:
            self.validate_questions_and_logic(payload.questions)

        questionnaire = Questionnaire(
            study_id=payload.study_id,
            protocol_id=payload.protocol_id,
            title=payload.title,
            description=payload.description,
            version="1.0",
            version_number=1,
            status="draft",
            is_ai_generated=False,
            is_published_immutable=False,
            created_by_user_id=current_user.id,
        )
        self.session.add(questionnaire)
        await self.session.flush()

        # Add sections
        section_id_map: Dict[str, str] = {}
        for idx, sec in enumerate(payload.sections or []):
            sec_id = sec.id or uuid.uuid4().hex[:8]
            section_id_map[sec.id] = sec_id
            db_sec = QuestionnaireSection(
                id=sec_id,
                questionnaire_id=questionnaire.id,
                title=sec.title,
                description=sec.description,
                order=sec.order or idx,
            )
            self.session.add(db_sec)
        await self.session.flush()

        # Add questions
        for idx, q in enumerate(payload.questions or []):
            target_sec_id = section_id_map.get(q.section_id) if q.section_id else q.section_id
            db_q = QuestionItemModel(
                id=q.id or uuid.uuid4().hex[:8],
                questionnaire_id=questionnaire.id,
                section_id=target_sec_id,
                variable_name=q.variable_name.strip(),
                type=q.type,
                text=q.text,
                description=q.description,
                order=q.order or idx,
                validation=q.validation.model_dump(by_alias=True) if q.validation else {},
                choices=[c.model_dump(by_alias=True) for c in q.choices] if q.choices else None,
                conditional_logic=q.conditional_logic.model_dump(by_alias=True) if q.conditional_logic else None,
                is_ai_generated=q.is_ai_generated,
                verified_by_researcher=q.verified_by_researcher,
                target_objective_id=q.target_objective_id,
                target_outcome_name=q.target_outcome_name,
            )
            self.session.add(db_q)

        await self.session.commit()

        # Refresh
        saved = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire.id)
        await self.audit_repo.log_event(
            event_type="questionnaire:create",
            action="questionnaire:create",
            user_id=current_user.id,
            study_id=questionnaire.study_id,
            entity_type="questionnaire",
            entity_id=str(questionnaire.id),
            details={"title": questionnaire.title, "version": questionnaire.version},
        )
        return self.serialize_questionnaire(saved)

    async def get_questionnaire(self, questionnaire_id: uuid.UUID, current_user: User) -> QuestionnaireResponse:
        q = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire_id)
        if not q:
            raise NotFoundError("Questionnaire", str(questionnaire_id))

        await self._verify_study_permission(q.study_id, current_user, Permission.QUESTIONNAIRE_VIEW)
        return self.serialize_questionnaire(q)

    async def list_questionnaires(
        self,
        current_user: User,
        study_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[QuestionnaireResponse]:
        accessible_ids = await self._get_accessible_study_ids(current_user)

        if study_id:
            await self._verify_study_permission(study_id, current_user, Permission.QUESTIONNAIRE_VIEW)

        items, _ = await self.questionnaire_repo.list_questionnaires(
            accessible_study_ids=accessible_ids,
            study_id=study_id,
            status=status,
            search=search,
            limit=limit,
            offset=offset,
        )
        return [self.serialize_questionnaire(q) for q in items]

    async def update_questionnaire(
        self, questionnaire_id: uuid.UUID, payload: QuestionnaireUpdateRequest, current_user: User
    ) -> QuestionnaireResponse:
        q = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire_id)
        if not q:
            raise NotFoundError("Questionnaire", str(questionnaire_id))

        await self._verify_study_permission(q.study_id, current_user, Permission.QUESTIONNAIRE_BUILD)

        if q.is_published_immutable or q.status == "published":
            raise VersionImmutableError(
                "Published questionnaires are immutable and locked against modifications. "
                "Use 'new-version' to branch an editable draft."
            )

        if payload.questions is not None:
            self.validate_questions_and_logic(payload.questions)

        if payload.title is not None:
            q.title = payload.title
        if payload.description is not None:
            q.description = payload.description
        if payload.status is not None:
            q.status = payload.status

        # Update sections if supplied
        if payload.sections is not None:
            new_sections = []
            for idx, sec in enumerate(payload.sections):
                new_sec = QuestionnaireSection(
                    id=sec.id or uuid.uuid4().hex[:8],
                    questionnaire_id=q.id,
                    title=sec.title,
                    description=sec.description,
                    order=sec.order or idx,
                )
                new_sections.append(new_sec)
            q.sections = new_sections

        # Update questions if supplied
        if payload.questions is not None:
            new_questions = []
            for idx, item in enumerate(payload.questions):
                db_item = QuestionItemModel(
                    id=item.id or uuid.uuid4().hex[:8],
                    questionnaire_id=q.id,
                    section_id=item.section_id,
                    variable_name=item.variable_name.strip(),
                    type=item.type,
                    text=item.text,
                    description=item.description,
                    order=item.order or idx,
                    validation=item.validation.model_dump(by_alias=True) if item.validation else {},
                    choices=[c.model_dump(by_alias=True) for c in item.choices] if item.choices else None,
                    conditional_logic=item.conditional_logic.model_dump(by_alias=True)
                    if item.conditional_logic
                    else None,
                    is_ai_generated=item.is_ai_generated,
                    verified_by_researcher=item.verified_by_researcher,
                    target_objective_id=item.target_objective_id,
                    target_outcome_name=item.target_outcome_name,
                )
                new_questions.append(db_item)
            q.questions = new_questions

        # Update mappings if supplied
        if payload.mappings is not None:
            new_mappings = []
            for m in payload.mappings:
                db_map = QuestionnaireMapping(
                    questionnaire_id=q.id,
                    objective_id=m.objective_id,
                    objective_title=m.objective_title,
                    outcome_name=m.outcome_name,
                    covered_question_ids=m.covered_question_ids,
                    is_covered=m.is_covered,
                    coverage_notes=m.coverage_notes,
                )
                new_mappings.append(db_map)
            q.mappings = new_mappings

        q.updated_at = datetime.now(timezone.utc)
        await self.session.commit()

        updated = await self.questionnaire_repo.get_questionnaire_by_id(q.id, populate_existing=True)
        await self.audit_repo.log_event(
            event_type="questionnaire:update",
            action="questionnaire:update",
            user_id=current_user.id,
            study_id=q.study_id,
            entity_type="questionnaire",
            entity_id=str(q.id),
            details={"title": q.title, "question_count": len(q.questions)},
        )
        return self.serialize_questionnaire(updated)

    async def delete_questionnaire(self, questionnaire_id: uuid.UUID, current_user: User) -> None:
        q = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire_id)
        if not q:
            raise NotFoundError("Questionnaire", str(questionnaire_id))

        await self._verify_study_permission(q.study_id, current_user, Permission.QUESTIONNAIRE_BUILD)

        if q.is_published_immutable or q.status == "published":
            raise ConflictError(
                "Cannot delete a published questionnaire. It must be retained for regulatory compliance and data integrity."
            )

        study_id = q.study_id
        await self.session.delete(q)
        await self.session.commit()

        await self.audit_repo.log_event(
            event_type="questionnaire:delete",
            action="questionnaire:delete",
            user_id=current_user.id,
            study_id=study_id,
            entity_type="questionnaire",
            entity_id=str(questionnaire_id),
        )

    async def generate_ai_questionnaire(
        self, payload: AiGenerateQuestionnairePayload, current_user: User
    ) -> QuestionnaireResponse:
        # Determine target study
        study_id = payload.study_id
        if not study_id:
            # Check if user has an active study
            accessible = await self._get_accessible_study_ids(current_user)
            if accessible and len(accessible) > 0:
                study_id = accessible[0]
            else:
                raise InvalidQuestionnaireError("A valid study ID is required to generate an AI questionnaire draft.")

        study = await self._verify_study_permission(study_id, current_user, Permission.QUESTIONNAIRE_BUILD)

        ai_provider = get_ai_provider()
        gen_data = await ai_provider.generate_questionnaire(payload.model_dump(by_alias=True))

        title = gen_data.get("title") or f"{payload.study_title} Protocol Assessment"
        description = gen_data.get("description") or f"Synthesized research instrument for {payload.study_title}."

        q = Questionnaire(
            study_id=study.id,
            protocol_id=payload.protocol_id,
            title=title,
            description=description,
            version="1.0",
            version_number=1,
            status="draft",
            is_ai_generated=True,
            ai_generation_metadata={
                "provider": getattr(ai_provider, "model_name", "ai-adapter"),
                "instrumentType": payload.instrument_type,
                "researchAims": payload.research_aims,
                "targetPopulation": payload.target_population,
                "outcomes": payload.outcomes,
            },
            scientific_validation_claim="Candidate AI questionnaire draft. Requires clinical review and researcher verification before scientific claim.",
            is_published_immutable=False,
            created_by_user_id=current_user.id,
        )
        self.session.add(q)
        await self.session.flush()

        # Add sections
        section_ids_map: Dict[str, str] = {}
        for idx, sec in enumerate(gen_data.get("sections", [])):
            client_sec_id = sec.get("id") or f"sec_{idx + 1}"
            section_ids_map[client_sec_id] = client_sec_id
            db_sec = QuestionnaireSection(
                id=client_sec_id,
                questionnaire_id=q.id,
                title=sec.get("title", f"Section {idx + 1}"),
                description=sec.get("description"),
                order=sec.get("order", idx),
            )
            self.session.add(db_sec)
        await self.session.flush()

        # Add questions
        for idx, item in enumerate(gen_data.get("questions", [])):
            sec_ref = item.get("sectionId")
            target_sec = section_ids_map.get(sec_ref) if sec_ref else None
            db_q = QuestionItemModel(
                id=item.get("id") or f"q_{idx + 1}",
                questionnaire_id=q.id,
                section_id=target_sec,
                variable_name=item.get("variableName", f"VAR_{idx + 1}").strip(),
                type=item.get("type", "short_text"),
                text=item.get("text", f"Question {idx + 1}"),
                description=item.get("description"),
                order=item.get("order", idx),
                validation=item.get("validation", {"required": True}),
                choices=item.get("choices"),
                conditional_logic=item.get("conditionalLogic"),
                is_ai_generated=True,
                verified_by_researcher=False,
                target_objective_id=item.get("targetObjectiveId"),
                target_outcome_name=item.get("targetOutcomeName"),
            )
            self.session.add(db_q)

        # Add mappings
        for m in gen_data.get("mappings", []):
            db_m = QuestionnaireMapping(
                questionnaire_id=q.id,
                objective_id=m.get("objectiveId", "OBJ-1"),
                objective_title=m.get("objectiveTitle", "Primary Objective"),
                outcome_name=m.get("outcomeName", "Primary Outcome"),
                covered_question_ids=m.get("coveredQuestionIds", []),
                is_covered=m.get("isCovered", True),
                coverage_notes=m.get("coverageNotes"),
            )
            self.session.add(db_m)

        await self.session.commit()
        created = await self.questionnaire_repo.get_questionnaire_by_id(q.id)

        await self.audit_repo.log_event(
            event_type="questionnaire:ai_generate",
            action="questionnaire:ai_generate",
            user_id=current_user.id,
            study_id=q.study_id,
            entity_type="questionnaire",
            entity_id=str(q.id),
            details={"questions_generated": len(q.questions), "model": getattr(ai_provider, "model_name", "unknown")},
        )
        return self.serialize_questionnaire(created)

    async def submit_for_review(self, questionnaire_id: uuid.UUID, current_user: User) -> QuestionnaireResponse:
        q = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire_id)
        if not q:
            raise NotFoundError("Questionnaire", str(questionnaire_id))

        await self._verify_study_permission(q.study_id, current_user, Permission.QUESTIONNAIRE_BUILD)

        if q.is_published_immutable or q.status == "published":
            raise VersionImmutableError("Published questionnaires cannot be resubmitted for review.")

        if not q.questions or len(q.questions) == 0:
            raise InvalidQuestionnaireError("Cannot submit an empty questionnaire for review. Add at least one question.")

        q.status = "under_review"
        q.updated_at = datetime.now(timezone.utc)
        await self.session.commit()

        updated = await self.questionnaire_repo.get_questionnaire_by_id(q.id, populate_existing=True)
        await self.audit_repo.log_event(
            event_type="questionnaire:submit_review",
            action="questionnaire:submit_review",
            user_id=current_user.id,
            study_id=q.study_id,
            entity_type="questionnaire",
            entity_id=str(q.id),
        )
        return self.serialize_questionnaire(updated)

    async def approve_questionnaire(
        self, questionnaire_id: uuid.UUID, notes: Optional[str], current_user: User
    ) -> QuestionnaireResponse:
        q = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire_id)
        if not q:
            raise NotFoundError("Questionnaire", str(questionnaire_id))

        # Only PI or Admin can approve questionnaires
        await self._verify_study_permission(q.study_id, current_user, Permission.QUESTIONNAIRE_PUBLISH)

        if q.is_published_immutable or q.status == "published":
            raise VersionImmutableError("Published questionnaires are already approved and locked.")

        q.status = "approved"
        q.approved_by_user_id = current_user.id
        q.approved_at = datetime.now(timezone.utc)
        q.updated_at = datetime.now(timezone.utc)
        await self.session.commit()

        updated = await self.questionnaire_repo.get_questionnaire_by_id(q.id, populate_existing=True)
        await self.audit_repo.log_event(
            event_type="questionnaire:approve",
            action="questionnaire:approve",
            user_id=current_user.id,
            study_id=q.study_id,
            entity_type="questionnaire",
            entity_id=str(q.id),
            details={"notes": notes},
        )
        return self.serialize_questionnaire(updated)

    async def publish_questionnaire(
        self, questionnaire_id: uuid.UUID, change_summary: Optional[str], current_user: User
    ) -> QuestionnaireResponse:
        q = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire_id)
        if not q:
            raise NotFoundError("Questionnaire", str(questionnaire_id))

        # Check publishing permissions
        await self._verify_study_permission(q.study_id, current_user, Permission.QUESTIONNAIRE_PUBLISH)

        if q.is_published_immutable or q.status == "published":
            raise VersionImmutableError("This questionnaire version is already published and immutable.")

        # Ensure questionnaire has non-heading questions
        non_heading_questions = [item for item in q.questions if item.type != "section_heading"]
        if not non_heading_questions:
            raise InvalidQuestionnaireError(
                "Cannot publish a questionnaire without at least one collectable research question."
            )

        # Freeze immutable snapshot
        now = datetime.now(timezone.utc)
        await self.questionnaire_repo.create_version_snapshot(
            questionnaire=q,
            published_by_user_id=current_user.id,
            change_summary=change_summary,
        )

        # Lock questionnaire version
        q.status = "published"
        q.is_published_immutable = True
        q.published_by_user_id = current_user.id
        q.published_at = now
        q.updated_at = now
        await self.session.commit()

        updated = await self.questionnaire_repo.get_questionnaire_by_id(q.id, populate_existing=True)
        await self.audit_repo.log_event(
            event_type="questionnaire:publish",
            action="questionnaire:publish",
            user_id=current_user.id,
            study_id=q.study_id,
            entity_type="questionnaire",
            entity_id=str(q.id),
            details={"version": q.version, "change_summary": change_summary},
        )
        return self.serialize_questionnaire(updated)

    async def create_new_version(
        self, questionnaire_id: uuid.UUID, current_user: User
    ) -> QuestionnaireResponse:
        parent = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire_id)
        if not parent:
            raise NotFoundError("Questionnaire", str(questionnaire_id))

        await self._verify_study_permission(parent.study_id, current_user, Permission.QUESTIONNAIRE_BUILD)

        new_version_num = parent.version_number + 1
        new_version_str = f"v{new_version_num}.0"

        # Create new questionnaire draft branched from parent
        new_q = Questionnaire(
            study_id=parent.study_id,
            protocol_id=parent.protocol_id,
            title=parent.title,
            description=parent.description,
            version=new_version_str,
            version_number=new_version_num,
            status="draft",
            is_ai_generated=parent.is_ai_generated,
            scientific_validation_claim=parent.scientific_validation_claim,
            is_published_immutable=False,
            created_by_user_id=current_user.id,
        )
        self.session.add(new_q)
        await self.session.flush()

        # Copy sections with new IDs
        sec_id_map: Dict[str, str] = {}
        for sec in parent.sections or []:
            new_sec_id = f"sec_{uuid.uuid4().hex[:8]}"
            sec_id_map[str(sec.id)] = new_sec_id
            cloned_sec = QuestionnaireSection(
                id=new_sec_id,
                questionnaire_id=new_q.id,
                title=sec.title,
                description=sec.description,
                order=sec.order,
            )
            self.session.add(cloned_sec)
        await self.session.flush()

        # Copy questions with new IDs, updating section refs and conditional logic
        q_id_map: Dict[str, str] = {}
        # First generate all new question IDs
        for q in parent.questions or []:
            new_qid = f"q_{uuid.uuid4().hex[:8]}"
            q_id_map[str(q.id)] = new_qid

        for q in parent.questions or []:
            new_qid = q_id_map[str(q.id)]
            new_sec_id = sec_id_map.get(str(q.section_id)) if q.section_id else None

            # Map conditional logic target IDs
            updated_cond_logic = None
            if q.conditional_logic:
                updated_cond_logic = dict(q.conditional_logic)
                if "rules" in updated_cond_logic and isinstance(updated_cond_logic["rules"], list):
                    new_rules = []
                    for r in updated_cond_logic["rules"]:
                        r_copy = dict(r)
                        old_target = str(r_copy.get("targetQuestionId", ""))
                        if old_target in q_id_map:
                            r_copy["targetQuestionId"] = q_id_map[old_target]
                        new_rules.append(r_copy)
                    updated_cond_logic["rules"] = new_rules

            cloned_q = QuestionItemModel(
                id=new_qid,
                questionnaire_id=new_q.id,
                section_id=new_sec_id,
                variable_name=q.variable_name,
                type=q.type,
                text=q.text,
                description=q.description,
                order=q.order,
                validation=q.validation,
                choices=q.choices,
                conditional_logic=updated_cond_logic,
                is_ai_generated=q.is_ai_generated,
                verified_by_researcher=q.verified_by_researcher,
                target_objective_id=q.target_objective_id,
                target_outcome_name=q.target_outcome_name,
            )
            self.session.add(cloned_q)

        # Copy mappings with mapped question IDs
        for m in parent.mappings or []:
            mapped_qids = [q_id_map.get(str(qid), str(qid)) for qid in (m.covered_question_ids or [])]
            cloned_m = QuestionnaireMapping(
                questionnaire_id=new_q.id,
                objective_id=m.objective_id,
                objective_title=m.objective_title,
                outcome_name=m.outcome_name,
                covered_question_ids=mapped_qids,
                is_covered=m.is_covered,
                coverage_notes=m.coverage_notes,
            )
            self.session.add(cloned_m)

        await self.session.commit()
        created_draft = await self.questionnaire_repo.get_questionnaire_by_id(new_q.id)

        await self.audit_repo.log_event(
            event_type="questionnaire:branch_version",
            action="questionnaire:branch_version",
            user_id=current_user.id,
            study_id=new_q.study_id,
            entity_type="questionnaire",
            entity_id=str(new_q.id),
            details={"branched_from": str(parent.id), "new_version": new_q.version},
        )
        return self.serialize_questionnaire(created_draft)

    async def get_versions(
        self, questionnaire_id: uuid.UUID, current_user: User
    ) -> List[QuestionnaireVersionItemResponse]:
        q = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire_id)
        if not q:
            raise NotFoundError("Questionnaire", str(questionnaire_id))

        await self._verify_study_permission(q.study_id, current_user, Permission.QUESTIONNAIRE_VIEW)
        versions = await self.questionnaire_repo.list_versions(questionnaire_id)

        return [
            QuestionnaireVersionItemResponse(
                id=v.id,
                questionnaire_id=v.questionnaire_id,
                version_number=v.version_number,
                status=v.status,
                published_at=v.published_at,
                published_by=v.published_by.full_name if v.published_by else None,
                change_summary=v.change_summary,
                question_count=v.question_count,
            )
            for v in versions
        ]

    async def get_mappings(
        self, questionnaire_id: uuid.UUID, current_user: User
    ) -> List[ObjectiveOutcomeMappingSchema]:
        q = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire_id)
        if not q:
            raise NotFoundError("Questionnaire", str(questionnaire_id))

        await self._verify_study_permission(q.study_id, current_user, Permission.QUESTIONNAIRE_VIEW)
        return [
            ObjectiveOutcomeMappingSchema(
                objective_id=m.objective_id,
                objective_title=m.objective_title,
                outcome_name=m.outcome_name,
                covered_question_ids=m.covered_question_ids or [],
                is_covered=m.is_covered,
                coverage_notes=m.coverage_notes,
            )
            for m in (q.mappings or [])
        ]

    async def get_metrics(self, current_user: User) -> QuestionnaireMetricsResponse:
        accessible_ids = await self._get_accessible_study_ids(current_user)
        metrics_dict = await self.questionnaire_repo.get_metrics(accessible_study_ids=accessible_ids)

        recent_items = metrics_dict.get("recent_questionnaires", [])
        recent_models = [
            {
                "id": str(q.id),
                "study_id": str(q.study_id),
                "title": q.title,
                "total_assigned": 0,
                "total_completed": 0,
                "completion_rate": 0.0,
                "average_time_to_complete_minutes": None,
                "status": "active" if q.status == "published" else "draft",
                "last_response_at": None,
            }
            for q in recent_items
        ]

        return QuestionnaireMetricsResponse(
            total_questionnaires=metrics_dict.get("total_questionnaires", 0),
            total_responses=metrics_dict.get("total_responses", 0),
            average_completion_rate=metrics_dict.get("average_completion_rate", 0.0),
            recent_questionnaires=recent_models,
        )
