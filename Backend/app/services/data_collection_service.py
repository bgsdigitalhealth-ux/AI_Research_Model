import hashlib

import re

import secrets

import uuid

from datetime import datetime, timedelta, timezone

from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import select

from sqlalchemy.ext.asyncio import AsyncSession



from app.core.exceptions import (

    ConflictError,

    GovernanceNotMetError,

    InvalidQuestionnaireError,

    NotFoundError,

    PermissionDeniedError,

    VersionImmutableError,

)

from app.core.rbac import Permission, RoleName, check_permission

from app.models.consent_record import ConsentRecord

from app.models.data_quality_issue import DataQualityIssue

from app.models.participant import Participant, ParticipantIdentityMapping

from app.models.question_item import QuestionItemModel

from app.models.questionnaire import Questionnaire

from app.models.response_correction_history import ResponseCorrectionHistory

from app.models.study import Study

from app.models.survey_invitation import SurveyInvitation

from app.models.survey_response import SurveyResponse

from app.models.survey_response_answer import SurveyResponseAnswer

from app.models.sync_batch import SyncBatch

from app.models.user import User

from app.repositories.audit_repository import AuditRepository

from app.repositories.consent_repository import ConsentRepository

from app.repositories.participant_repository import ParticipantRepository

from app.repositories.questionnaire_repository import QuestionnaireRepository

from app.repositories.study_repository import StudyMembershipRepository, StudyRepository

from app.repositories.survey_invitation_repository import SurveyInvitationRepository

from app.repositories.survey_response_repository import SurveyResponseRepository

from app.schemas.data_collection import (

    CollectionMonitoringMetrics,

    ConsentRecordSchema,

    ConsentResponse,

    ConsentWordingPayload,

    DataQualityIssueSchema,

    ResponseCorrectionHistorySchema,

    ResponseCorrectionRequest,

    ServerSyncAcknowledgement,

    SurveyInvitationCreateRequest,

    SurveyInvitationResponse,

    SurveyResponseAnswerSchema,

    SurveyResponseDetail,

    SurveySubmissionRequest,

    SyncBatchRequest,

    SyncBatchResult,

)

from app.schemas.participant import (
    ParticipantCreateRequest,

    ParticipantCreateRequest,

    ParticipantMetrics,

    ParticipantResponse,

    ParticipantWithdrawRequest,

)

from app.schemas.questionnaire import QuestionnaireResponse





class DataCollectionService:

    def __init__(self, session: AsyncSession):

        self.session = session

        self.response_repo = SurveyResponseRepository(session)

        self.participant_repo = ParticipantRepository(session)

        self.consent_repo = ConsentRepository(session)

        self.invitation_repo = SurveyInvitationRepository(session)

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

            return None



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



    # =========================================================================

    # 1. PUBLISHED SURVEYS RETRIEVAL

    # =========================================================================

    async def get_published_surveys(self, current_user: User) -> List[QuestionnaireResponse]:

        accessible_ids = await self._get_accessible_study_ids(current_user)

        items, _ = await self.questionnaire_repo.list_questionnaires(

            accessible_study_ids=accessible_ids,

            limit=100,

        )

        # Return all active instruments available for data intake or preview testing

        active_items = [q for q in items if q.status in ("published", "under_review", "draft")]

        from app.services.questionnaire_service import QuestionnaireService

        q_service = QuestionnaireService(self.session)

        return [q_service.serialize_questionnaire(q) for q in active_items]



    # =========================================================================

    # 2. CONSENT MANAGEMENT

    # =========================================================================

    async def get_survey_consent(

        self, questionnaire_id: uuid.UUID, current_user: User

    ) -> ConsentWordingPayload:

        q = await self.questionnaire_repo.get_questionnaire_by_id(questionnaire_id)

        if not q:

            raise NotFoundError("Questionnaire", str(questionnaire_id))



        if q.status not in ("published", "under_review", "draft"):

            raise VersionImmutableError("Archived questionnaires cannot present participant consent.")



        study = await self.study_repo.get_study_by_id(q.study_id)

        pi_name = study.principal_investigator.full_name if study and study.principal_investigator else "Study Principal Investigator"

        institution_name = study.organization.name if study and study.organization else "Clinical Research Center"

        ethics_num = study.irb_approval_number if study else "IRB-PENDING"



        info_html = (

            f"<h3>Participant Information Sheet</h3>"

            f"<p>You are invited to participate in the research study <strong>{study.title if study else q.title}</strong>, "

            f"led by {pi_name} at {institution_name}.</p>"

            f"<p>Your participation is completely voluntary. You may withdraw at any time without penalty.</p>"

        )



        consent_statements = [

            f"I have read and understood the participant information sheet for {q.title}.",

            "I have had the opportunity to ask questions and discuss this study.",

            "I understand that my participation is voluntary and I am free to withdraw at any time.",

            "I consent to the collection, processing, and pseudonymised storage of my responses for research purposes.",

        ]



        return ConsentWordingPayload(

            study_id=q.study_id,

            study_title=study.title if study else q.title,

            questionnaire_id=q.id,

            questionnaire_version=q.version,

            ethics_approval_number=ethics_num,

            principal_investigator=pi_name,

            institution=institution_name,

            information_sheet_html=info_html,

            consent_statements=consent_statements,

            data_retention_policy_summary="Responses are pseudonymised and securely retained in compliance with clinical research governance standards.",

            withdrawn_policy_summary="Participants may request consent withdrawal at any time. Previously analysed anonymised aggregates are retained.",

        )



    async def submit_consent(

        self, payload: ConsentRecordSchema, current_user: User

    ) -> ConsentResponse:

        q = await self.questionnaire_repo.get_questionnaire_by_id(payload.questionnaire_id)

        if not q:

            raise NotFoundError("Questionnaire", str(payload.questionnaire_id))



        if q.status not in ("published", "under_review", "draft"):

            raise VersionImmutableError("Cannot submit consent for an inactive or archived questionnaire.")



        if not payload.agreed_to_participate or not payload.agreed_to_data_storage:

            raise GovernanceNotMetError(

                "Informed consent declined: agreement to participate and consent for research data storage are required."

            )



        # Ensure participant record exists

        participant = await self.participant_repo.get_or_create(

            study_id=q.study_id,

            identifier_code=payload.participant_identifier,

            created_by_user_id=current_user.id if current_user else None,

        )



        # Generate unique confirmation code and text hash

        confirmation_code = f"CONS-{uuid.uuid4().hex[:10].upper()}"

        consent_hash = hashlib.sha256(

            f"{q.id}:{payload.participant_identifier}:{payload.questionnaire_version}".encode("utf-8")

        ).hexdigest()



        consent_record = ConsentRecord(

            id=payload.id or uuid.uuid4(),

            study_id=q.study_id,

            questionnaire_id=q.id,

            questionnaire_version=payload.questionnaire_version,

            participant_id=participant.id,

            participant_identifier=payload.participant_identifier.strip(),

            consented_at=payload.consented_at or datetime.now(timezone.utc),

            agreed_to_participate=payload.agreed_to_participate,

            agreed_to_data_storage=payload.agreed_to_data_storage,

            agreed_to_contact=payload.agreed_to_contact,

            agreed_statements=payload.agreed_statements or [],

            wording_version=f"IRB-{q.version}",

            consent_text_hash=consent_hash,

            confirmation_code=confirmation_code,

            status="active",

        )

        self.session.add(consent_record)

        if self.session.in_nested_transaction():

            await self.session.flush()

        else:

            await self.session.commit()



        await self.audit_repo.log_event(

            event_type="survey:consent_recorded",

            action="survey:consent_recorded",

            user_id=current_user.id if current_user else None,

            study_id=q.study_id,

            entity_type="consent_record",

            entity_id=str(consent_record.id),

            details={

                "participant_identifier": payload.participant_identifier,

                "confirmation_code": confirmation_code,

                "version": payload.questionnaire_version,

            },

        )



        return ConsentResponse(

            consent_id=consent_record.id,

            confirmation_code=confirmation_code,

        )



    # =========================================================================

    # 3. QUESTION VALIDATION & CONDITIONAL VISIBILITY HELPER

    # =========================================================================

    def _is_question_visible(

        self, question: QuestionItemModel, answers: Dict[str, Any], question_id_to_var: Dict[str, str]

    ) -> bool:

        if not question.conditional_logic or not question.conditional_logic.get("rules"):

            return True



        logic = question.conditional_logic

        action = logic.get("action", "show")

        match_type = logic.get("match", "all")

        rules = logic.get("rules", [])



        rule_results: List[bool] = []

        for r in rules:

            target_id = r.get("targetQuestionId")

            target_var = question_id_to_var.get(target_id, target_id)

            # Find answer by target question ID or variable name

            ans_val = answers.get(target_id)

            if ans_val is None and target_var:

                ans_val = answers.get(target_var)



            op = r.get("operator", "equals")

            expected = r.get("value")



            res = False

            if op == "is_empty":

                res = ans_val is None or ans_val == "" or ans_val == []

            elif op == "is_not_empty":

                res = ans_val is not None and ans_val != "" and ans_val != []

            elif ans_val is not None:

                if op == "equals":

                    res = str(ans_val).strip().lower() == str(expected).strip().lower()

                elif op == "not_equals":

                    res = str(ans_val).strip().lower() != str(expected).strip().lower()

                elif op == "contains":

                    if isinstance(ans_val, list):

                        res = str(expected) in [str(x) for x in ans_val]

                    else:

                        res = str(expected).lower() in str(ans_val).lower()

                elif op == "greater_than":

                    try:

                        res = float(ans_val) > float(expected)

                    except (ValueError, TypeError):

                        res = False

                elif op == "less_than":

                    try:

                        res = float(ans_val) < float(expected)

                    except (ValueError, TypeError):

                        res = False

            rule_results.append(res)



        condition_matched = all(rule_results) if match_type == "all" else any(rule_results)

        return condition_matched if action == "show" else not condition_matched



    def validate_answers_and_find_issues(

        self,

        questionnaire: Questionnaire,

        answers: Dict[str, Any],

        response_id: uuid.UUID,

    ) -> Tuple[List[SurveyResponseAnswer], List[DataQualityIssue]]:

        """

        Validates answers against published questionnaire questions, choices, and rules.

        Produces persistent answer rows and flags data quality issues.

        """

        parsed_answers: List[SurveyResponseAnswer] = []

        quality_issues: List[DataQualityIssue] = []



        q_map: Dict[str, QuestionItemModel] = {str(q.id): q for q in questionnaire.questions}

        var_to_id: Dict[str, str] = {q.variable_name.lower(): str(q.id) for q in questionnaire.questions}

        id_to_var: Dict[str, str] = {str(q.id): q.variable_name for q in questionnaire.questions}



        for q_item in questionnaire.questions:

            qid_str = str(q_item.id)

            var_name = q_item.variable_name

            validation = q_item.validation or {}

            is_required = validation.get("required", False)



            # Check conditional visibility

            is_visible = self._is_question_visible(q_item, answers, id_to_var)



            # Look up answer by question ID or variable name

            raw_val = answers.get(qid_str)

            if raw_val is None:

                raw_val = answers.get(var_name)

            if raw_val is None:

                raw_val = answers.get(var_name.lower())



            is_missing = raw_val is None or raw_val == "" or raw_val == []

            is_valid = True



            if is_visible and is_required and is_missing and q_item.type != "section_heading":

                is_valid = False

                quality_issues.append(

                    DataQualityIssue(

                        study_id=questionnaire.study_id,

                        response_id=response_id,

                        question_id=qid_str,

                        variable_name=var_name,

                        issue_type="missing_required",

                        severity="high",

                        description=f"Required variable '{var_name}' is missing.",

                        status="open",

                    )

                )



            # If answer is present, validate constraints by type

            if not is_missing and q_item.type != "section_heading":

                # Numeric bounds

                if q_item.type in ("integer", "decimal"):

                    try:

                        num_val = float(raw_val) if q_item.type == "decimal" else int(raw_val)

                        min_val = validation.get("min")

                        max_val = validation.get("max")

                        if min_val is not None and num_val < min_val:

                            is_valid = False

                            quality_issues.append(

                                DataQualityIssue(

                                    study_id=questionnaire.study_id,

                                    response_id=response_id,

                                    question_id=qid_str,

                                    variable_name=var_name,

                                    issue_type="range_violation",

                                    severity="medium",

                                    description=f"Value {num_val} for '{var_name}' is below minimum threshold of {min_val}.",

                                    status="open",

                                )

                            )

                        if max_val is not None and num_val > max_val:

                            is_valid = False

                            quality_issues.append(

                                DataQualityIssue(

                                    study_id=questionnaire.study_id,

                                    response_id=response_id,

                                    question_id=qid_str,

                                    variable_name=var_name,

                                    issue_type="range_violation",

                                    severity="medium",

                                    description=f"Value {num_val} for '{var_name}' exceeds maximum threshold of {max_val}.",

                                    status="open",

                                )

                            )

                    except (ValueError, TypeError):

                        is_valid = False

                        quality_issues.append(

                            DataQualityIssue(

                                study_id=questionnaire.study_id,

                                response_id=response_id,

                                question_id=qid_str,

                                variable_name=var_name,

                                issue_type="type_mismatch",

                                severity="high",

                                description=f"Value '{raw_val}' for '{var_name}' cannot be parsed as numeric {q_item.type}.",

                                status="open",

                            )

                        )



                # Choice options

                elif q_item.type in ("single_choice", "multiple_choice", "rating_5", "likert_5"):

                    valid_codes = {str(c.get("code", "")).strip().lower() for c in (q_item.choices or [])}

                    if valid_codes:

                        if q_item.type == "multiple_choice":

                            submitted_codes = raw_val if isinstance(raw_val, list) else [raw_val]

                            for code in submitted_codes:

                                if str(code).strip().lower() not in valid_codes:

                                    is_valid = False

                                    quality_issues.append(

                                        DataQualityIssue(

                                            study_id=questionnaire.study_id,

                                            response_id=response_id,

                                            question_id=qid_str,

                                            variable_name=var_name,

                                            issue_type="invalid_choice",

                                            severity="medium",

                                            description=f"Selection '{code}' for '{var_name}' is not in configured choice set.",

                                            status="open",

                                        )

                                    )

                        else:

                            code_to_eval = raw_val.get("code") or raw_val.get("choice") or raw_val.get("value") if isinstance(raw_val, dict) else raw_val

                            if str(code_to_eval).strip().lower() not in valid_codes:

                                is_valid = False

                                quality_issues.append(

                                    DataQualityIssue(

                                        study_id=questionnaire.study_id,

                                        response_id=response_id,

                                        question_id=qid_str,

                                        variable_name=var_name,

                                        issue_type="invalid_choice",

                                        severity="medium",

                                        description=f"Selection '{raw_val}' for '{var_name}' is not in configured choice set.",

                                        status="open",

                                    )

                                )



                # Text constraints

                elif q_item.type in ("short_text", "long_text"):

                    str_val = str(raw_val)

                    min_len = validation.get("minLength")

                    max_len = validation.get("maxLength")

                    regex = validation.get("regexPattern")

                    if min_len is not None and len(str_val) < min_len:

                        is_valid = False

                        quality_issues.append(

                            DataQualityIssue(

                                study_id=questionnaire.study_id,

                                response_id=response_id,

                                question_id=qid_str,

                                variable_name=var_name,

                                issue_type="range_violation",

                                severity="low",

                                description=f"Length {len(str_val)} of '{var_name}' is shorter than minLength {min_len}.",

                                status="open",

                            )

                        )

                    if max_len is not None and len(str_val) > max_len:

                        is_valid = False

                        quality_issues.append(

                            DataQualityIssue(

                                study_id=questionnaire.study_id,

                                response_id=response_id,

                                question_id=qid_str,

                                variable_name=var_name,

                                issue_type="range_violation",

                                severity="low",

                                description=f"Length {len(str_val)} of '{var_name}' exceeds maxLength {max_len}.",

                                status="open",

                            )

                        )

                    if regex:

                        try:

                            if not re.search(regex, str_val):

                                is_valid = False

                                quality_issues.append(

                                    DataQualityIssue(

                                        study_id=questionnaire.study_id,

                                        response_id=response_id,

                                        question_id=qid_str,

                                        variable_name=var_name,

                                        issue_type="range_violation",

                                        severity="medium",

                                        description=f"Value for '{var_name}' does not match pattern {regex}.",

                                        status="open",

                                    )

                                )

                        except re.error:

                            pass



            if q_item.type != "section_heading":

                parsed_answers.append(

                    SurveyResponseAnswer(

                        response_id=response_id,

                        question_id=qid_str,

                        variable_name=var_name,

                        raw_value=raw_val,

                        is_missing=is_missing,

                        is_valid=is_valid,

                    )

                )



        return parsed_answers, quality_issues



    # =========================================================================

    # 4. SINGLE SURVEY RESPONSE SUBMISSION (ONLINE IDEMPOTENT)

    # =========================================================================

    async def submit_response(

        self,

        payload: SurveySubmissionRequest,

        current_user: Optional[User] = None,

        sync_source: str = "online",

        batch_id: Optional[uuid.UUID] = None,

    ) -> ServerSyncAcknowledgement:

        # 1. Idempotency Check: if submissionId already persisted, safely return confirmation

        existing = await self.response_repo.get_by_submission_id(payload.submission_id)

        if existing:

            return ServerSyncAcknowledgement(

                confirmation_id=existing.confirmation_id,

                received_at=existing.server_received_at,

                status_code=200,

            )



        # 2. Check questionnaire status and version

        q = await self.questionnaire_repo.get_questionnaire_by_id(payload.questionnaire_id)

        if not q:

            raise NotFoundError("Questionnaire", str(payload.questionnaire_id))



        # Allow submissions for published instruments as well as active/preview questionnaires

        if q.status not in ("published", "under_review", "draft"):

            raise VersionImmutableError(

                "Cannot submit responses to an archived or inactive questionnaire."

            )



        # 3. Check / Record Consent (with automatic participant consent recording for preview/intake)

        participant_code = payload.participant_identifier.strip()

        consent = await self.consent_repo.get_active_consent(q.id, participant_code)

        if not consent:

            if payload.consent_record and payload.consent_record.agreed_to_participate:

                c_resp = await self.submit_consent(payload.consent_record, current_user)

                consent = await self.consent_repo.get(c_resp.consent_id)

            else:

                from app.schemas.data_collection import ConsentRecordSchema

                auto_consent = ConsentRecordSchema(

                    study_id=q.study_id,

                    questionnaire_id=q.id,

                    participant_identifier=participant_code,

                    agreed_to_participate=True,

                    participant_signature=f"Participant {participant_code}",

                )

                c_resp = await self.submit_consent(auto_consent, current_user)

                consent = await self.consent_repo.get(c_resp.consent_id)



        # 4. Ensure participant record exists

        participant = await self.participant_repo.get_or_create(

            study_id=q.study_id,

            identifier_code=participant_code,

            created_by_user_id=current_user.id if current_user else None,

        )



        now = datetime.now(timezone.utc)

        confirmation_id = f"ACK-{uuid.uuid4().hex[:12].upper()}"



        # 5. Parse and Validate Answers against exact published questions

        answers, quality_issues = self.validate_answers_and_find_issues(

            questionnaire=q,

            answers=payload.answers or {},

            response_id=payload.submission_id,

        )



        # Store user details metadata if provided

        user_meta = (payload.answers or {}).get("__user_details__")

        if user_meta:

            answers.append(

                SurveyResponseAnswer(

                    response_id=payload.submission_id,

                    question_id="__user_details__",

                    variable_name="__user_details__",

                    raw_value=user_meta,

                    is_missing=False,

                    is_valid=True,

                )

            )



        response_status = "flagged_quality" if quality_issues else "completed"



        response_obj = SurveyResponse(

            id=payload.submission_id,

            study_id=q.study_id,

            questionnaire_id=q.id,

            questionnaire_version=q.version,

            participant_id=participant.id,

            participant_identifier=participant_code,

            consent_record_id=consent.id if consent else None,

            status=response_status,

            confirmation_id=confirmation_id,

            sync_source=sync_source,

            sync_batch_id=batch_id,

            client_submitted_at=payload.submitted_at or now,

            server_received_at=now,

        )

        self.session.add(response_obj)

        await self.session.flush()



        for ans in answers:

            self.session.add(ans)



        for qi in quality_issues:

            self.session.add(qi)



        # Update participant enrolled responses count

        if participant.status == "screened":

            participant.status = "enrolled"



        if self.session.in_nested_transaction():

            await self.session.flush()

        else:

            await self.session.commit()



        await self.audit_repo.log_event(

            event_type="survey:response_submitted",

            action="survey:response_submitted",

            user_id=current_user.id if current_user else None,

            study_id=q.study_id,

            entity_type="survey_response",

            entity_id=str(response_obj.id),

            details={

                "confirmation_id": confirmation_id,

                "sync_source": sync_source,

                "quality_issues_count": len(quality_issues),

            },

        )



        return ServerSyncAcknowledgement(

            confirmation_id=confirmation_id,

            received_at=now,

            status_code=201,

        )



    # =========================================================================

    # 5. OFFLINE BATCH SYNCHRONISATION

    # =========================================================================

    async def sync_batch(

        self, payload: SyncBatchRequest, current_user: User

    ) -> SyncBatchResult:

        successful: List[Dict[str, Any]] = []

        conflicts: List[Dict[str, Any]] = []

        failed: List[Dict[str, Any]] = []



        batch_id = uuid.uuid4()

        primary_study_id: Optional[uuid.UUID] = None



        for item in payload.submissions:

            sub_id_str = str(item.submission_id)

            try:

                # Sub-transaction savepoint per item so that one bad record doesn't invalidate others

                async with self.session.begin_nested():

                    ack = await self.submit_response(

                        payload=item,

                        current_user=current_user,

                        sync_source="offline_batch",

                        batch_id=batch_id,

                    )

                    successful.append(

                        {

                            "submissionId": sub_id_str,

                            "confirmationId": ack.confirmation_id,

                            "receivedAt": ack.received_at.isoformat(),

                        }

                    )

            except ConflictError as ce:

                q = await self.questionnaire_repo.get_questionnaire_by_id(item.questionnaire_id)

                server_ver = q.version if q else "Unknown"

                conflicts.append(

                    {

                        "submissionId": sub_id_str,

                        "serverVersion": server_ver,

                        "localVersion": item.questionnaire_version,

                        "message": ce.message,

                    }

                )

            except Exception as exc:

                failed.append(

                    {

                        "submissionId": sub_id_str,

                        "errorMessage": str(getattr(exc, "message", str(exc))),

                    }

                )



        # Log SyncBatch summary

        sync_batch_record = SyncBatch(

            id=batch_id,

            study_id=primary_study_id,

            submitted_by_user_id=current_user.id if current_user else None,

            total_items=len(payload.submissions),

            accepted_count=len(successful),

            conflict_count=len(conflicts),

            rejected_count=len(failed),

            results_summary={

                "successful_ids": [s["submissionId"] for s in successful],

                "failed_ids": [f["submissionId"] for f in failed],

                "conflict_ids": [c["submissionId"] for c in conflicts],

            },

        )

        self.session.add(sync_batch_record)

        await self.session.commit()



        return SyncBatchResult(

            successful=successful,

            conflicts=conflicts,

            failed=failed,

        )



    # =========================================================================

    # 6. COLLECTION MONITORING METRICS

    # =========================================================================

    async def get_monitoring_metrics(self, current_user: User) -> CollectionMonitoringMetrics:

        accessible_ids = await self._get_accessible_study_ids(current_user)

        metrics = await self.response_repo.get_monitoring_metrics(accessible_study_ids=accessible_ids)



        return CollectionMonitoringMetrics(

            total_target_responses=metrics["total_target_responses"],

            completed_online=metrics["completed_online"],

            pending_offline_queue=0,

            synced_successfully=metrics["synced_successfully"],

            sync_failed=metrics["sync_failed"],

            active_surveys_count=metrics["active_surveys_count"],

            last_sync_timestamp=metrics["last_sync_timestamp"],

        )



    # =========================================================================

    # 7. DATA QUALITY & CORRECTIONS

    # =========================================================================

    async def list_responses(

        self,

        current_user: User,

        study_id: Optional[uuid.UUID] = None,

        questionnaire_id: Optional[uuid.UUID] = None,

        status: Optional[str] = None,

        limit: int = 50,

        offset: int = 0,

    ) -> List[SurveyResponseDetail]:

        if study_id:

            await self._verify_study_permission(study_id, current_user, Permission.DATA_QUALITY_VIEW)

        accessible_ids = await self._get_accessible_study_ids(current_user)



        items, _ = await self.response_repo.list_responses(

            study_id=study_id,

            questionnaire_id=questionnaire_id,

            accessible_study_ids=accessible_ids,

            status=status,

            limit=limit,

            offset=offset,

        )



        return [

            SurveyResponseDetail(

                id=r.id,

                study_id=r.study_id,

                questionnaire_id=r.questionnaire_id,

                questionnaire_version=r.questionnaire_version,

                participant_identifier=r.participant_identifier,

                status=r.status,

                confirmation_id=r.confirmation_id,

                sync_source=r.sync_source,

                answers=[

                    SurveyResponseAnswerSchema(

                        question_id=a.question_id,

                        variable_name=a.variable_name,

                        raw_value=a.raw_value,

                        is_missing=a.is_missing,

                        is_valid=a.is_valid,

                    )

                    for a in (r.answers or [])

                ],

                quality_issues=[

                    DataQualityIssueSchema(

                        id=qi.id,

                        study_id=qi.study_id,

                        response_id=qi.response_id,

                        question_id=qi.question_id,

                        variable_name=qi.variable_name,

                        issue_type=qi.issue_type,

                        severity=qi.severity,

                        description=qi.description,

                        status=qi.status,

                        resolution_notes=qi.resolution_notes,

                        resolved_by=qi.resolved_by.full_name if qi.resolved_by else None,

                        resolved_at=qi.resolved_at,

                        created_at=qi.created_at,

                    )

                    for qi in (r.quality_issues or [])

                ],

                corrections=[

                    ResponseCorrectionHistorySchema(

                        id=c.id,

                        response_id=c.response_id,

                        question_id=c.question_id,

                        variable_name=c.variable_name,

                        original_value=c.original_value,

                        corrected_value=c.corrected_value,

                        reason=c.reason,

                        corrected_by=c.corrected_by.full_name if c.corrected_by else None,

                        corrected_at=c.corrected_at,

                    )

                    for c in (r.corrections or [])

                ],

                client_submitted_at=r.client_submitted_at,

                server_received_at=r.server_received_at,

            )

            for r in items

        ]



    async def get_response_detail(

        self, response_id: uuid.UUID, current_user: User

    ) -> SurveyResponseDetail:

        r = await self.response_repo.get_by_submission_id(response_id)

        if not r:

            raise NotFoundError("SurveyResponse", str(response_id))



        await self._verify_study_permission(r.study_id, current_user, Permission.DATA_QUALITY_VIEW)



        return SurveyResponseDetail(

            id=r.id,

            study_id=r.study_id,

            questionnaire_id=r.questionnaire_id,

            questionnaire_version=r.questionnaire_version,

            participant_identifier=r.participant_identifier,

            status=r.status,

            confirmation_id=r.confirmation_id,

            sync_source=r.sync_source,

            answers=[

                SurveyResponseAnswerSchema(

                    question_id=a.question_id,

                    variable_name=a.variable_name,

                    raw_value=a.raw_value,

                    is_missing=a.is_missing,

                    is_valid=a.is_valid,

                )

                for a in (r.answers or [])

            ],

            quality_issues=[

                DataQualityIssueSchema(

                    id=qi.id,

                    study_id=qi.study_id,

                    response_id=qi.response_id,

                    question_id=qi.question_id,

                    variable_name=qi.variable_name,

                    issue_type=qi.issue_type,

                    severity=qi.severity,

                    description=qi.description,

                    status=qi.status,

                    resolution_notes=qi.resolution_notes,

                    resolved_by=qi.resolved_by.full_name if qi.resolved_by else None,

                    resolved_at=qi.resolved_at,

                    created_at=qi.created_at,

                )

                for qi in (r.quality_issues or [])

            ],

            corrections=[

                ResponseCorrectionHistorySchema(

                    id=c.id,

                    response_id=c.response_id,

                    question_id=c.question_id,

                    variable_name=c.variable_name,

                    original_value=c.original_value,

                    corrected_value=c.corrected_value,

                    reason=c.reason,

                    corrected_by=c.corrected_by.full_name if c.corrected_by else None,

                    corrected_at=c.corrected_at,

                )

                for c in (r.corrections or [])

            ],

            client_submitted_at=r.client_submitted_at,

            server_received_at=r.server_received_at,

        )



    async def record_correction(

        self,

        response_id: uuid.UUID,

        payload: ResponseCorrectionRequest,

        current_user: User,

    ) -> ResponseCorrectionHistorySchema:

        r = await self.response_repo.get_by_submission_id(response_id)

        if not r:

            raise NotFoundError("SurveyResponse", str(response_id))



        await self._verify_study_permission(r.study_id, current_user, Permission.DATA_QUALITY_VIEW)



        # Locate answer

        ans = next((a for a in r.answers if a.question_id == payload.question_id or a.variable_name == payload.variable_name), None)

        if not ans:

            raise NotFoundError("SurveyResponseAnswer", f"{payload.question_id}/{payload.variable_name}")



        orig_val = ans.raw_value

        ans.raw_value = payload.corrected_value

        ans.is_missing = payload.corrected_value is None or payload.corrected_value == ""

        ans.is_valid = True



        history = ResponseCorrectionHistory(

            response_id=r.id,

            question_id=ans.question_id,

            variable_name=ans.variable_name,

            original_value=orig_val,

            corrected_value=payload.corrected_value,

            reason=payload.reason,

            corrected_by_user_id=current_user.id,

            corrected_at=datetime.now(timezone.utc),

        )

        self.session.add(history)

        await self.session.commit()



        await self.audit_repo.log_event(

            event_type="survey:answer_corrected",

            action="survey:answer_corrected",

            user_id=current_user.id,

            study_id=r.study_id,

            entity_type="survey_response",

            entity_id=str(r.id),

            details={

                "variable_name": ans.variable_name,

                "reason": payload.reason,

            },

        )



        return ResponseCorrectionHistorySchema(

            id=history.id,

            response_id=history.response_id,

            question_id=history.question_id,

            variable_name=history.variable_name,

            original_value=history.original_value,

            corrected_value=history.corrected_value,

            reason=history.reason,

            corrected_by=current_user.full_name,

            corrected_at=history.corrected_at,

        )



    async def resolve_quality_issue(

        self,

        issue_id: uuid.UUID,

        resolution_notes: str,

        status: str,

        current_user: User,

    ) -> DataQualityIssueSchema:

        stmt = select(DataQualityIssue).where(DataQualityIssue.id == issue_id)

        res = await self.session.execute(stmt)

        issue = res.scalars().first()

        if not issue:

            raise NotFoundError("DataQualityIssue", str(issue_id))



        await self._verify_study_permission(issue.study_id, current_user, Permission.DATA_QUALITY_VIEW)



        issue.status = status

        issue.resolution_notes = resolution_notes

        issue.resolved_by_user_id = current_user.id

        issue.resolved_at = datetime.now(timezone.utc)

        await self.session.commit()



        return DataQualityIssueSchema(

            id=issue.id,

            study_id=issue.study_id,

            response_id=issue.response_id,

            question_id=issue.question_id,

            variable_name=issue.variable_name,

            issue_type=issue.issue_type,

            severity=issue.severity,

            description=issue.description,

            status=issue.status,

            resolution_notes=issue.resolution_notes,

            resolved_by=current_user.full_name,

            resolved_at=issue.resolved_at,

            created_at=issue.created_at,

        )



    async def list_quality_issues(

        self,

        current_user: User,

        study_id: Optional[uuid.UUID] = None,

        response_id: Optional[uuid.UUID] = None,

        status: Optional[str] = None,

        limit: int = 50,

        offset: int = 0,

    ) -> List[DataQualityIssueSchema]:

        if study_id:

            await self._verify_study_permission(study_id, current_user, Permission.DATA_QUALITY_VIEW)

        accessible_ids = await self._get_accessible_study_ids(current_user)



        items, _ = await self.response_repo.list_quality_issues(

            study_id=study_id,

            response_id=response_id,

            accessible_study_ids=accessible_ids,

            status=status,

            limit=limit,

            offset=offset,

        )



        return [

            DataQualityIssueSchema(

                id=qi.id,

                study_id=qi.study_id,

                response_id=qi.response_id,

                question_id=qi.question_id,

                variable_name=qi.variable_name,

                issue_type=qi.issue_type,

                severity=qi.severity,

                description=qi.description,

                status=qi.status,

                resolution_notes=qi.resolution_notes,

                resolved_by=qi.resolved_by.full_name if qi.resolved_by else None,

                resolved_at=qi.resolved_at,

                created_at=qi.created_at,

            )

            for qi in items

        ]



    # =========================================================================

    # 8. SURVEY INVITATIONS & ACCESS TOKENS

    # =========================================================================

    async def create_invitation(

        self, payload: SurveyInvitationCreateRequest, current_user: User

    ) -> SurveyInvitationResponse:

        q = await self.questionnaire_repo.get_questionnaire_by_id(payload.questionnaire_id)

        if not q:

            raise NotFoundError("Questionnaire", str(payload.questionnaire_id))



        await self._verify_study_permission(q.study_id, current_user, Permission.SURVEY_INTAKE)



        raw_token = secrets.token_urlsafe(32)

        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

        token_prefix = raw_token[:8]



        expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days or 30)



        participant = None

        if payload.participant_identifier:

            participant = await self.participant_repo.get_or_create(

                study_id=q.study_id,

                identifier_code=payload.participant_identifier,

                created_by_user_id=current_user.id,

            )



        invitation = SurveyInvitation(

            study_id=q.study_id,

            questionnaire_id=q.id,

            participant_id=participant.id if participant else None,

            token_hash=token_hash,

            token_prefix=token_prefix,

            access_mode=payload.access_mode or "invitation_only",

            max_uses=payload.max_uses or 1,

            uses_count=0,

            expires_at=expires_at,

            is_revoked=False,

            created_by_user_id=current_user.id,

        )

        self.session.add(invitation)

        await self.session.commit()



        return SurveyInvitationResponse(

            id=invitation.id,

            token=raw_token,

            token_prefix=token_prefix,

            access_mode=invitation.access_mode,

            max_uses=invitation.max_uses,

            uses_count=invitation.uses_count,

            expires_at=invitation.expires_at,

            is_revoked=invitation.is_revoked,

        )



    # =========================================================================

    # 9. PARTICIPANTS MANAGEMENT & METRICS

    # =========================================================================

    async def list_participants(

        self,

        current_user: User,

        study_id: Optional[uuid.UUID] = None,

        status: Optional[str] = None,

        limit: int = 50,

        offset: int = 0,

    ) -> List[ParticipantResponse]:

        if study_id:

            await self._verify_study_permission(study_id, current_user, Permission.STUDY_VIEW)

        accessible_ids = await self._get_accessible_study_ids(current_user)



        items, _ = await self.participant_repo.list_participants(

            study_id=study_id,

            accessible_study_ids=accessible_ids,

            status=status,

            limit=limit,

            offset=offset,

        )

        return [

            ParticipantResponse(

                id=p.id,

                study_id=p.study_id,

                identifier_code=p.identifier_code,

                status=p.status,

                enrollment_date=p.enrollment_date,

                cohort=p.cohort,

                site_location=p.site_location,

                is_active=p.is_active,

                withdrawn_at=p.withdrawn_at,

            )

            for p in items

        ]



    async def get_participant_metrics(self, current_user: User) -> ParticipantMetrics:

        accessible_ids = await self._get_accessible_study_ids(current_user)

        metrics = await self.participant_repo.get_metrics(accessible_study_ids=accessible_ids)

        return ParticipantMetrics(**metrics)



    async def withdraw_participant(

        self, participant_id: uuid.UUID, payload: ParticipantWithdrawRequest, current_user: User

    ) -> ParticipantResponse:

        p = await self.participant_repo.get(participant_id)

        if not p:

            raise NotFoundError("Participant", str(participant_id))



        await self._verify_study_permission(p.study_id, current_user, Permission.SURVEY_CONSENT)



        now = datetime.now(timezone.utc)

        p.status = "withdrawn"

        p.is_active = False

        p.withdrawn_at = now

        p.withdrawal_reason = payload.reason



        # Mark active consent records as withdrawn

        stmt = (

            select(ConsentRecord)

            .where(

                ConsentRecord.participant_id == p.id,

                ConsentRecord.status == "active",

            )

        )

        res = await self.session.execute(stmt)

        for c in res.scalars().all():

            c.status = "withdrawn"

            c.withdrawn_at = now

            c.withdrawal_reason = payload.reason



        await self.session.commit()



        await self.audit_repo.log_event(

            event_type="participant:withdrawn",

            action="participant:withdrawn",

            user_id=current_user.id,

            study_id=p.study_id,

            entity_type="participant",

            entity_id=str(p.id),

            details={"identifier_code": p.identifier_code, "reason": payload.reason},

        )



        return ParticipantResponse(

            id=p.id,

            study_id=p.study_id,

            identifier_code=p.identifier_code,

            status=p.status,

            enrollment_date=p.enrollment_date,

            cohort=p.cohort,

            site_location=p.site_location,

            is_active=p.is_active,

            withdrawn_at=p.withdrawn_at,

        )

    async def enroll_participant(
        self, payload: ParticipantCreateRequest, current_user: User
    ) -> ParticipantResponse:
        await self._verify_study_permission(payload.study_id, current_user, Permission.SURVEY_CONSENT)
        existing = await self.participant_repo.get_by_identifier(payload.study_id, payload.identifier_code)
        if existing:
            return ParticipantResponse(
                id=existing.id,
                study_id=existing.study_id,
                identifier_code=existing.identifier_code,
                status=existing.status,
                enrollment_date=existing.enrollment_date,
                cohort=existing.cohort,
                site_location=existing.site_location,
                is_active=existing.is_active,
                withdrawn_at=existing.withdrawn_at,
            )

        p = Participant(
            study_id=payload.study_id,
            identifier_code=payload.identifier_code.strip(),
            status="enrolled",
            cohort=payload.cohort,
            site_location=payload.site_location,
            created_by_user_id=current_user.id,
            is_active=True,
        )
        self.session.add(p)
        await self.session.commit()
        await self.session.refresh(p)

        await self.audit_repo.log_event(
            event_type="participant:enrolled",
            action="participant:enrolled",
            user_id=current_user.id,
            study_id=p.study_id,
            entity_type="participant",
            entity_id=str(p.id),
            details={"identifier_code": p.identifier_code, "cohort": p.cohort},
        )

        return ParticipantResponse(
            id=p.id,
            study_id=p.study_id,
            identifier_code=p.identifier_code,
            status=p.status,
            enrollment_date=p.enrollment_date,
            cohort=p.cohort,
            site_location=p.site_location,
            is_active=p.is_active,
            withdrawn_at=p.withdrawn_at,
        )

