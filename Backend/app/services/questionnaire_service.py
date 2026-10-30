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
                explanation=qi.explanation,
                remark=qi.remark,
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
                explanation=q.explanation,
                remark=q.remark,
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
                    explanation=item.explanation,
                    remark=item.remark,
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
        from sqlalchemy import select, func

        # Determine target study dynamically
        study: Optional[Study] = None
        study_id = payload.study_id

        if study_id:
            study = await self._verify_study_permission(study_id, current_user, Permission.QUESTIONNAIRE_BUILD)
        else:
            # 1. Search for existing study matching title
            if payload.study_title:
                stmt = select(Study).where(func.lower(Study.title) == payload.study_title.strip().lower())
                res = await self.session.execute(stmt)
                study = res.scalars().first()

            # 2. Search for any accessible or latest existing study
            if not study:
                accessible = await self._get_accessible_study_ids(current_user)
                if accessible and len(accessible) > 0:
                    study = await self.study_repo.get_study_by_id(accessible[0])
                else:
                    stmt = select(Study).order_by(Study.created_at.desc()).limit(1)
                    res = await self.session.execute(stmt)
                    study = res.scalars().first()

            # 3. If no study exists at all, dynamically create a new study in PostgreSQL
            if not study:
                hex_id = uuid.uuid4().hex[:6].upper()
                protocol_num = f"AI-{hex_id}"
                study = Study(
                    title=payload.study_title or "AI Clinical Research Study",
                    protocol_number=protocol_num,
                    status="draft",
                    created_by_user_id=current_user.id,
                    principal_investigator_id=current_user.id,
                    target_participants=100,
                )
                self.session.add(study)
                await self.session.flush()

        study_id = study.id

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

        # Add sections with unique scoped primary keys
        section_ids_map: Dict[str, str] = {}
        for idx, sec in enumerate(gen_data.get("sections", [])):
            client_sec_id = sec.get("id") or f"sec_{idx + 1}"
            db_sec_id = f"{q.id.hex[:8]}_{client_sec_id}"
            section_ids_map[client_sec_id] = db_sec_id
            db_sec = QuestionnaireSection(
                id=db_sec_id,
                questionnaire_id=q.id,
                title=sec.get("title", f"Section {idx + 1}"),
                description=sec.get("description"),
                order=sec.get("order", idx),
            )
            self.session.add(db_sec)
        await self.session.flush()

        # Add questions with unique scoped primary keys
        question_ids_map: Dict[str, str] = {}
        for idx, item in enumerate(gen_data.get("questions", [])):
            client_q_id = item.get("id") or f"q_{idx + 1}"
            db_q_id = f"{q.id.hex[:8]}_{client_q_id}"
            question_ids_map[client_q_id] = db_q_id

            sec_ref = item.get("sectionId")
            target_sec = section_ids_map.get(sec_ref) if sec_ref else None

            cond_logic = item.get("conditionalLogic")
            if isinstance(cond_logic, dict) and "rules" in cond_logic:
                for r in cond_logic.get("rules", []):
                    if isinstance(r, dict) and "targetQuestionId" in r:
                        r["targetQuestionId"] = question_ids_map.get(r["targetQuestionId"], r["targetQuestionId"])

            import re
            q_type = item.get("type", "single_choice")
            if q_type in ("likert_5", "rating_5"):
                q_type = "single_choice"

            raw_choices = item.get("choices") or []
            if not raw_choices and q_type == "single_choice":
                raw_choices = [
                    {"code": "a", "label": "a) Strongly Disagree", "score": 1.0},
                    {"code": "b", "label": "b) Disagree", "score": 2.0},
                    {"code": "c", "label": "c) Neutral", "score": 3.0},
                    {"code": "d", "label": "d) Agree", "score": 4.0},
                    {"code": "e", "label": "e) Strongly Agree", "score": 5.0},
                ]
            elif raw_choices and isinstance(raw_choices, list):
                formatted_choices = []
                for c_idx, ch in enumerate(raw_choices):
                    letter = chr(97 + c_idx)
                    lbl = ch.get("label", "")
                    if not lbl.lower().startswith(f"{letter})"):
                        clean_lbl = re.sub(r"^[0-9a-zA-Z][\.\)\-]\s*", "", lbl)
                        lbl = f"{letter}) {clean_lbl}"
                    formatted_choices.append({
                        "id": ch.get("id") or f"c_{c_idx + 1}",
                        "code": letter,
                        "label": lbl,
                        "score": ch.get("score", float(c_idx + 1)),
                    })
                raw_choices = formatted_choices

            db_q = QuestionItemModel(
                id=db_q_id,
                questionnaire_id=q.id,
                section_id=target_sec,
                variable_name=item.get("variableName", f"VAR_{idx + 1}").strip(),
                type=q_type,
                text=item.get("text", f"Question {idx + 1}"),
                description=None,  # No subdescription for AI generated questions as requested
                explanation=item.get("explanation"),
                remark=item.get("remark"),
                order=item.get("order", idx),
                validation=item.get("validation", {"required": True}),
                choices=raw_choices,
                conditional_logic=cond_logic,
                is_ai_generated=True,
                verified_by_researcher=False,
                target_objective_id=item.get("targetObjectiveId"),
                target_outcome_name=item.get("targetOutcomeName"),
            )
            self.session.add(db_q)

        # Add mappings (defensively handle list of objects, list of strings, or dictionary)
        raw_mappings = gen_data.get("mappings", [])
        mapping_items = []
        if isinstance(raw_mappings, dict):
            for i, (k, v) in enumerate(raw_mappings.items()):
                mapping_items.append({
                    "objectiveId": f"OBJ-{i+1}",
                    "objectiveTitle": str(k),
                    "outcomeName": str(k),
                    "coveredQuestionIds": v if isinstance(v, list) else [str(v)],
                    "isCovered": True,
                    "coverageNotes": None,
                })
        elif isinstance(raw_mappings, list):
            for i, m in enumerate(raw_mappings):
                if isinstance(m, dict):
                    mapping_items.append(m)
                elif isinstance(m, str):
                    mapping_items.append({
                        "objectiveId": f"OBJ-{i+1}",
                        "objectiveTitle": m,
                        "outcomeName": m,
                        "coveredQuestionIds": [],
                        "isCovered": True,
                        "coverageNotes": None,
                    })

        for m in mapping_items:
            raw_cids = m.get("coveredQuestionIds", [])
            mapped_cids = [question_ids_map.get(cid, cid) for cid in raw_cids] if isinstance(raw_cids, list) else []
            db_m = QuestionnaireMapping(
                questionnaire_id=q.id,
                objective_id=m.get("objectiveId", "OBJ-1"),
                objective_title=m.get("objectiveTitle", "Primary Objective"),
                outcome_name=m.get("outcomeName", "Primary Outcome"),
                covered_question_ids=mapped_cids,
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
            details={"questions_generated": len(created.questions) if created else 0, "model": getattr(ai_provider, "model_name", "unknown")},
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
                explanation=q.explanation,
                remark=q.remark,
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

    async def create_questionnaire_from_file(
        self,
        file_bytes: bytes,
        filename: str,
        current_user: User,
        study_id: Optional[uuid.UUID] = None,
        title: Optional[str] = None,
    ) -> QuestionnaireResponse:
        from app.services.document_parser import DocumentParserService
        from app.core.exceptions import FileValidationError
        from sqlalchemy import select

        ai_provider = get_ai_provider()
        gen_data: Dict[str, Any] = {}

        if DocumentParserService.is_image_file(filename):
            image_uri = DocumentParserService.get_image_data_uri(file_bytes, filename)
            gen_data = await ai_provider.extract_questionnaire_from_image(image_uri, filename)
        else:
            full_text, _ = DocumentParserService.parse_document(filename, file_bytes)
            if not full_text or len(full_text.strip()) < 5:
                raise FileValidationError(f"Could not extract readable text or questions from '{filename}'.")
            gen_data = await ai_provider.extract_questionnaire_from_document(full_text, filename)

        # Determine target study dynamically
        study: Optional[Study] = None
        if study_id:
            study = await self._verify_study_permission(study_id, current_user, Permission.QUESTIONNAIRE_BUILD)
        else:
            accessible = await self._get_accessible_study_ids(current_user)
            if accessible and len(accessible) > 0:
                study = await self.study_repo.get_study_by_id(accessible[0])
            else:
                stmt = select(Study).order_by(Study.created_at.desc()).limit(1)
                res = await self.session.execute(stmt)
                study = res.scalars().first()

            if not study:
                hex_id = uuid.uuid4().hex[:6].upper()
                protocol_num = f"AI-{hex_id}"
                clean_title = (title or filename.rsplit(".", 1)[0] or "Clinical Research Study").strip()
                study = Study(
                    title=f"{clean_title} Study",
                    protocol_number=protocol_num,
                    status="draft",
                    created_by_user_id=current_user.id,
                    principal_investigator_id=current_user.id,
                    target_participants=100,
                )
                self.session.add(study)
                await self.session.flush()

        doc_title = title or gen_data.get("title") or filename.rsplit(".", 1)[0]
        description = gen_data.get("description") or f"Questions extracted from {filename}."

        q = Questionnaire(
            study_id=study.id,
            title=doc_title,
            description=description,
            version="1.0",
            version_number=1,
            status="draft",
            is_ai_generated=True,
            ai_generation_metadata={
                "provider": getattr(ai_provider, "model_name", "ai-adapter"),
                "sourceFile": filename,
                "fileSize": len(file_bytes),
            },
            scientific_validation_claim="Questions extracted from source device file.",
            is_published_immutable=False,
            created_by_user_id=current_user.id,
        )
        self.session.add(q)
        await self.session.flush()

        # Sections
        section_ids_map: Dict[str, str] = {}
        raw_sections = gen_data.get("sections") or [{"id": "sec_1", "title": "General Assessment", "order": 0}]
        for idx, sec in enumerate(raw_sections):
            client_sec_id = sec.get("id") or f"sec_{idx + 1}"
            db_sec_id = f"{q.id.hex[:8]}_{client_sec_id}"
            section_ids_map[client_sec_id] = db_sec_id
            db_sec = QuestionnaireSection(
                id=db_sec_id,
                questionnaire_id=q.id,
                title=sec.get("title", f"Section {idx + 1}"),
                description=sec.get("description"),
                order=sec.get("order", idx),
            )
            self.session.add(db_sec)
        await self.session.flush()

        # Questions
        raw_questions = gen_data.get("questions") or []
        for idx, item in enumerate(raw_questions):
            client_q_id = item.get("id") or f"q_{idx + 1}"
            db_q_id = f"{q.id.hex[:8]}_{client_q_id}"

            sec_ref = item.get("sectionId") or item.get("section_id")
            target_sec = section_ids_map.get(sec_ref) if sec_ref else None
            if not target_sec and sec_ref:
                for sec_item in raw_sections:
                    if str(sec_item.get("title", "")).strip().lower() == str(sec_ref).strip().lower():
                        target_sec = section_ids_map.get(sec_item.get("id"))
                        break
            if not target_sec and section_ids_map:
                target_sec = list(section_ids_map.values())[0]

            # Choices in a), b), c), d) format
            import re
            raw_choices = item.get("choices") or []
            formatted_choices = []
            if raw_choices and isinstance(raw_choices, list):
                for c_idx, ch in enumerate(raw_choices):
                    letter = chr(97 + c_idx)
                    lbl = ch.get("label", "") if isinstance(ch, dict) else str(ch)
                    if not lbl.lower().startswith(f"{letter})"):
                        clean_lbl = re.sub(r"^[0-9a-zA-Z][\.\)\-]\s*", "", lbl)
                        lbl = f"{letter}) {clean_lbl}"
                    # Determine score based on 6-option benchmark scale: 0, 2, 4, 6, 8, 10
                    ch_score = ch.get("score") if isinstance(ch, dict) else None
                    if ch_score is None:
                        if len(raw_choices) == 6:
                            benchmark_scores = [0.0, 2.0, 4.0, 6.0, 8.0, 10.0]
                            ch_score = benchmark_scores[c_idx] if c_idx < len(benchmark_scores) else float(c_idx * 2)
                        else:
                            ch_score = float(c_idx + 1)

                    formatted_choices.append({
                        "id": ch.get("id") if isinstance(ch, dict) else f"c_{c_idx + 1}",
                        "code": letter,
                        "label": lbl,
                        "score": float(ch_score),
                    })
            else:
                formatted_choices = [
                    {"id": "c_1", "code": "a", "label": "a) 1. Not available", "score": 0.0},
                    {"id": "c_2", "code": "b", "label": "b) 2. Initial", "score": 2.0},
                    {"id": "c_3", "code": "c", "label": "c) 3. Partially implemented", "score": 4.0},
                    {"id": "c_4", "code": "d", "label": "d) 4. Implemented", "score": 6.0},
                    {"id": "c_5", "code": "e", "label": "e) 5. Consistently implemented", "score": 8.0},
                    {"id": "c_6", "code": "f", "label": "f) 6. Mature / exemplary", "score": 10.0},
                ]

            q_text = item.get("text", f"Question {idx + 1}")
            explanation = item.get("explanation")
            remark = item.get("remark")

            db_q = QuestionItemModel(
                id=db_q_id,
                questionnaire_id=q.id,
                section_id=target_sec,
                variable_name=item.get("variableName", f"Q_{idx + 1}").strip(),
                type="single_choice",
                text=q_text,
                description=None,
                explanation=explanation,
                remark=remark,
                order=item.get("order", idx),
                validation={"required": True},
                choices=formatted_choices,
                conditional_logic=None,
                is_ai_generated=True,
                verified_by_researcher=False,
            )
            self.session.add(db_q)

        await self.session.commit()
        created = await self.questionnaire_repo.get_questionnaire_by_id(q.id)

        await self.audit_repo.log_event(
            event_type="questionnaire:file_upload",
            action="questionnaire:file_upload",
            user_id=current_user.id,
            study_id=q.study_id,
            entity_type="questionnaire",
            entity_id=str(q.id),
            details={"questions_extracted": len(created.questions) if created else 0, "file": filename},
        )
        return self.serialize_questionnaire(created)

    async def create_questionnaire_from_pdf(
        self,
        file_bytes: bytes,
        filename: str,
        current_user: User,
        study_id: Optional[uuid.UUID] = None,
        title: Optional[str] = None,
    ) -> QuestionnaireResponse:
        return await self.create_questionnaire_from_file(
            file_bytes=file_bytes,
            filename=filename,
            current_user=current_user,
            study_id=study_id,
            title=title,
        )


    async def export_responses_excel(
        self,
        questionnaire_id: uuid.UUID,
        responses: Dict[str, Any],
        remarks: Dict[str, str],
        participant_id: Optional[str] = None,
    ) -> bytes:
        import io
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

        q = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire_id)
        if not q:
            raise NotFoundError("Questionnaire", str(questionnaire_id))

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Score Report"
        ws.views.sheetView[0].showGridLines = True

        # Styles definition
        font_title = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
        font_subtitle = Font(name="Calibri", size=10, italic=True, color="475569")
        font_header = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        font_data = Font(name="Calibri", size=10, color="0F172A")
        font_total = Font(name="Calibri", size=11, bold=True, color="1E3A8A")

        fill_header = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        fill_alt_row = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
        fill_total = PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid")
        fill_benchmark = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")

        align_center = Alignment(horizontal="center", vertical="top", wrap_text=True)
        align_left = Alignment(horizontal="left", vertical="top", wrap_text=True)
        align_right = Alignment(horizontal="right", vertical="top", wrap_text=True)

        thin_side = Side(border_style="thin", color="CBD5E1")
        double_side = Side(border_style="double", color="1E3A8A")
        border_cell = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
        border_total = Border(top=thin_side, bottom=double_side, left=thin_side, right=thin_side)

        # Title Block
        ws.merge_cells("A1:E1")
        ws["A1"] = f"{q.title.upper()} - ASSESSMENT REPORT"
        ws["A1"].font = font_title
        ws["A1"].alignment = Alignment(horizontal="left", vertical="center")

        subtitle_parts = []
        if participant_id:
            subtitle_parts.append(f"Participant: {participant_id}")
        subtitle_parts.append(f"Version: v{q.version}")
        subtitle_parts.append(f"Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")

        ws.merge_cells("A2:E2")
        ws["A2"] = " | ".join(subtitle_parts)
        ws["A2"].font = font_subtitle
        ws["A2"].alignment = Alignment(horizontal="left", vertical="center")

        # Table Column Headers (Row 4) matching Image 1
        headers = ["No.", "Question", "Response (select one)", "Score", "Remarks"]
        for col_idx, text in enumerate(headers, 1):
            cell = ws.cell(row=4, column=col_idx, value=text)
            cell.font = font_header
            cell.fill = fill_header
            cell.border = border_cell
            cell.alignment = align_center if text in ("No.", "Score") else align_left

        current_row = 5
        total_score = 0.0
        max_possible_score = 0.0
        q_counter = 0

        sorted_questions = sorted(q.questions or [], key=lambda x: getattr(x, "order", 0))

        for item in sorted_questions:
            if item.type == "section_heading":
                continue

            q_counter += 1
            user_selected_code = responses.get(str(item.id))
            user_remark = remarks.get(str(item.id)) or item.remark or ""

            selected_choice_label = "(No response selected)"
            selected_score = 0.0
            item_max_score = 0.0

            is_answered = False
            if item.choices:
                for c_idx, ch in enumerate(item.choices):
                    fallback_score = float(c_idx * 2) if len(item.choices) == 6 else float(c_idx + 1)
                    c_score = ch.get("score") if (isinstance(ch, dict) and ch.get("score") is not None) else fallback_score
                    if c_score > item_max_score:
                        item_max_score = c_score

                    c_code = ch.get("code") if isinstance(ch, dict) else str(ch)
                    if user_selected_code is not None and str(user_selected_code).lower() == str(c_code).lower():
                        selected_choice_label = ch.get("label", str(ch)) if isinstance(ch, dict) else str(ch)
                        selected_score = float(c_score)
                        is_answered = True

            # Show score only if question was selected/answered
            score_to_display = selected_score if is_answered else ""
            if is_answered:
                total_score += selected_score
            max_possible_score += (item_max_score if item_max_score > 0 else 10.0)

            # Assign row values
            ws.cell(row=current_row, column=1, value=q_counter).alignment = align_center
            ws.cell(row=current_row, column=2, value=item.text).alignment = align_left
            ws.cell(row=current_row, column=3, value=selected_choice_label).alignment = align_left
            ws.cell(row=current_row, column=4, value=score_to_display).alignment = align_center
            ws.cell(row=current_row, column=5, value=user_remark).alignment = align_left

            # Apply fonts and borders
            is_alt = (q_counter % 2 == 0)
            for c in range(1, 6):
                cell = ws.cell(row=current_row, column=c)
                cell.font = font_data
                cell.border = border_cell
                if is_alt:
                    cell.fill = fill_alt_row

            current_row += 1

        start_score_row = 5
        end_score_row = current_row - 1

        # Summary Row 1: Total Score
        ws.merge_cells(f"A{current_row}:C{current_row}")
        total_label = ws.cell(row=current_row, column=1, value="TOTAL SCORE")
        total_label.font = font_total
        total_label.alignment = align_right

        score_cell = ws.cell(row=current_row, column=4, value=f"=SUM(D{start_score_row}:D{end_score_row})")
        score_cell.font = font_total
        score_cell.alignment = align_center

        rem_summary = ws.cell(row=current_row, column=5, value=f"Earned {total_score:g} out of {max_possible_score:g} maximum possible points")
        rem_summary.font = font_total
        rem_summary.alignment = align_left

        for c in range(1, 6):
            cell = ws.cell(row=current_row, column=c)
            cell.fill = fill_total
            cell.border = border_total

        current_row += 1

        # Summary Row 2: Percentage
        percentage = (total_score / max_possible_score * 100) if max_possible_score > 0 else 0.0
        ws.merge_cells(f"A{current_row}:C{current_row}")
        pct_label = ws.cell(row=current_row, column=1, value="PERCENTAGE ACHIEVED")
        pct_label.font = font_total
        pct_label.alignment = align_right

        pct_cell = ws.cell(row=current_row, column=4, value=f"{percentage:.1f}%")
        pct_cell.font = font_total
        pct_cell.alignment = align_center

        ws.cell(row=current_row, column=5, value="").alignment = align_left

        for c in range(1, 6):
            cell = ws.cell(row=current_row, column=c)
            cell.fill = fill_total
            cell.border = border_cell

        current_row += 1

        # Summary Row 3: Overall Maturity Level Benchmark (based on Image 2)
        if percentage >= 90.0:
            benchmark_level = "Mature / exemplary (Score 10)"
        elif percentage >= 70.0:
            benchmark_level = "Consistently implemented (Score 8)"
        elif percentage >= 50.0:
            benchmark_level = "Implemented (Score 6)"
        elif percentage >= 30.0:
            benchmark_level = "Partially implemented (Score 4)"
        elif percentage >= 10.0:
            benchmark_level = "Initial (Score 2)"
        else:
            benchmark_level = "Not available (Score 0)"

        ws.merge_cells(f"A{current_row}:C{current_row}")
        bench_label = ws.cell(row=current_row, column=1, value="OVERALL MATURITY LEVEL")
        bench_label.font = font_total
        bench_label.alignment = align_right

        bench_val = ws.cell(row=current_row, column=4, value=benchmark_level)
        bench_val.font = font_total
        bench_val.alignment = align_center

        ws.cell(row=current_row, column=5, value="Standardized 6-Level Maturity Framework Benchmark").alignment = align_left

        for c in range(1, 6):
            cell = ws.cell(row=current_row, column=c)
            cell.fill = fill_benchmark
            cell.border = border_total

        # Column widths auto-adjustment
        ws.column_dimensions["A"].width = 8
        ws.column_dimensions["B"].width = 52
        ws.column_dimensions["C"].width = 30
        ws.column_dimensions["D"].width = 16
        ws.column_dimensions["E"].width = 38

        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

