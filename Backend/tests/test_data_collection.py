import uuid
import pytest
from httpx import AsyncClient

from app.models.user import User


def get_error_message(res) -> str:
    data = res.json()
    return str(data.get("message") or data.get("detail") or "").lower()


async def create_published_study_and_questionnaire(client: AsyncClient, headers: dict) -> tuple[str, str]:
    """
    Helper to create an approved study and publish a questionnaire with questions and validation rules.
    """
    unique_suffix = uuid.uuid4().hex[:6]
    # 1. Create Study
    res = await client.post(
        "/api/v1/studies",
        json={
            "title": f"Cardiology Clinical Trial {unique_suffix}",
            "protocolNumber": f"CARD-2026-{unique_suffix}",
            "targetParticipants": 50,
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    study_id = res.json()["id"]

    # 2. Create Questionnaire
    q_payload = {
        "title": "Cardio Health Baseline Intake",
        "description": "Baseline intake for participant cardiac history and vitals.",
        "studyId": study_id,
        "sections": [
            {"id": "sec_demo", "title": "Demographics", "description": "Basic info", "order": 1},
            {"id": "sec_vitals", "title": "Vital Signs", "description": "Clinical measures", "order": 2},
        ],
        "questions": [
            {
                "id": "q_age",
                "variableName": "AGE",
                "type": "integer",
                "text": "What is the participant's age in years?",
                "sectionId": "sec_demo",
                "order": 1,
                "validation": {"required": True, "min": 18, "max": 100},
            },
            {
                "id": "q_smoker",
                "variableName": "SMOKER_STATUS",
                "type": "single_choice",
                "text": "Current smoking status?",
                "sectionId": "sec_demo",
                "order": 2,
                "choices": [
                    {"code": "NEVER", "label": "Never Smoked"},
                    {"code": "FORMER", "label": "Former Smoker"},
                    {"code": "CURRENT", "label": "Current Smoker"},
                ],
                "validation": {"required": True},
            },
            {
                "id": "q_bp_systolic",
                "variableName": "BP_SYSTOLIC",
                "type": "decimal",
                "text": "Systolic blood pressure (mmHg)",
                "sectionId": "sec_vitals",
                "order": 3,
                "validation": {"required": True, "min": 70, "max": 250},
            },
            {
                "id": "q_comments",
                "variableName": "CLINICAL_NOTES",
                "type": "short_text",
                "text": "Clinical observations",
                "sectionId": "sec_vitals",
                "order": 4,
                "validation": {"required": False, "minLength": 5, "maxLength": 100},
            },
        ],
    }
    res_q = await client.post("/api/v1/questionnaires", json=q_payload, headers=headers)
    assert res_q.status_code == 201, res_q.text
    q_id = res_q.json()["id"]

    # 3. Approve Questionnaire
    res_app = await client.post(
        f"/api/v1/questionnaires/{q_id}/approve",
        json={"approvalNotes": "Approved for clinical field collection"},
        headers=headers,
    )
    assert res_app.status_code == 200, res_app.text

    # 4. Publish Questionnaire
    res_pub = await client.post(
        f"/api/v1/questionnaires/{q_id}/publish",
        json={"publicationNotes": "Published to field collectors"},
        headers=headers,
    )
    assert res_pub.status_code == 200, res_pub.text
    assert res_pub.json()["status"] == "published"
    assert res_pub.json()["version"] == "1.0"

    return study_id, q_id


@pytest.mark.asyncio
async def test_published_surveys_retrieval(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await create_published_study_and_questionnaire(client, headers)

    res = await client.get("/api/v1/data-collection/published-surveys", headers=headers)
    assert res.status_code == 200, res.text
    surveys = res.json()
    assert isinstance(surveys, list)
    matching = [s for s in surveys if s["id"] == q_id]
    assert len(matching) == 1
    assert matching[0]["version"] == "1.0"
    assert matching[0]["status"] == "published"
    assert len(matching[0]["questions"]) == 4


@pytest.mark.asyncio
async def test_survey_consent_presentation_and_recording(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await create_published_study_and_questionnaire(client, headers)

    # 1. Retrieve consent wording payload
    res = await client.get(f"/api/v1/surveys/{q_id}/consent", headers=headers)
    assert res.status_code == 200, res.text
    consent_info = res.json()
    assert consent_info["questionnaireId"] == q_id
    assert consent_info["questionnaireVersion"] == "1.0"
    assert "informationSheetHtml" in consent_info
    assert len(consent_info["consentStatements"]) >= 3

    # 2. Attempt recording consent when declined -> Should reject (HTTP 400)
    declined_payload = {
        "questionnaireId": q_id,
        "questionnaireVersion": "1.0",
        "participantIdentifier": "PT-DECLINE-001",
        "agreedToParticipate": False,
        "agreedToDataStorage": False,
    }
    res_dec = await client.post(f"/api/v1/surveys/{q_id}/consent", json=declined_payload, headers=headers)
    assert res_dec.status_code == 400
    assert "declined" in get_error_message(res_dec)

    # 3. Explicitly accept consent
    accepted_payload = {
        "questionnaireId": q_id,
        "questionnaireVersion": "1.0",
        "participantIdentifier": "PT-ACCEPT-001",
        "agreedToParticipate": True,
        "agreedToDataStorage": True,
        "agreedToContact": True,
        "agreedStatements": consent_info["consentStatements"],
    }
    res_acc = await client.post(f"/api/v1/surveys/{q_id}/consent", json=accepted_payload, headers=headers)
    assert res_acc.status_code == 201, res_acc.text
    acc_data = res_acc.json()
    assert "consentId" in acc_data
    assert acc_data["confirmationCode"].startswith("CONS-")


@pytest.mark.asyncio
async def test_response_submission_and_idempotency(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await create_published_study_and_questionnaire(client, headers)

    part_id = "PT-IDEMP-001"
    sub_id = str(uuid.uuid4())

    # 1. Submit response WITHOUT prior consent -> Should fail (HTTP 400)
    sub_no_consent = {
        "submissionId": sub_id,
        "questionnaireId": q_id,
        "questionnaireVersion": "1.0",
        "participantIdentifier": part_id,
        "answers": {
            "AGE": 45,
            "SMOKER_STATUS": "NEVER",
            "BP_SYSTOLIC": 120.5,
            "CLINICAL_NOTES": "Normal baseline observations",
        },
    }
    res_fail = await client.post(f"/api/v1/surveys/{q_id}/submit", json=sub_no_consent, headers=headers)
    assert res_fail.status_code == 400
    assert "consent" in get_error_message(res_fail)

    # 2. Record consent first
    consent_payload = {
        "questionnaireId": q_id,
        "questionnaireVersion": "1.0",
        "participantIdentifier": part_id,
        "agreedToParticipate": True,
        "agreedToDataStorage": True,
    }
    res_c = await client.post(f"/api/v1/surveys/{q_id}/consent", json=consent_payload, headers=headers)
    assert res_c.status_code == 201

    # 3. Submit valid response
    res_sub = await client.post(f"/api/v1/surveys/{q_id}/submit", json=sub_no_consent, headers=headers)
    assert res_sub.status_code == 200, res_sub.text
    ack = res_sub.json()
    assert ack["confirmationId"].startswith("ACK-")
    ack_conf_id = ack["confirmationId"]

    # 4. Idempotency test: Re-submitting the same submissionId must succeed and return the SAME ACK
    res_dup = await client.post(f"/api/v1/surveys/{q_id}/submit", json=sub_no_consent, headers=headers)
    assert res_dup.status_code == 200
    assert res_dup.json()["confirmationId"] == ack_conf_id


@pytest.mark.asyncio
async def test_version_locking_and_draft_rejection(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await create_published_study_and_questionnaire(client, headers)

    # 1. Submitting with wrong version string -> Conflict (HTTP 409)
    res_ver = await client.post(
        f"/api/v1/surveys/{q_id}/submit",
        json={
            "submissionId": str(uuid.uuid4()),
            "questionnaireId": q_id,
            "questionnaireVersion": "0.9-outdated",
            "participantIdentifier": "PT-VER-001",
            "answers": {},
        },
        headers=headers,
    )
    assert res_ver.status_code == 409
    assert "version" in get_error_message(res_ver)

    # 2. Submitting to a draft questionnaire -> Rejection (HTTP 400)
    draft_res = await client.post(
        "/api/v1/questionnaires",
        json={"title": "Draft Only Instrument", "studyId": study_id, "questions": []},
        headers=headers,
    )
    assert draft_res.status_code == 201
    draft_id = draft_res.json()["id"]

    res_draft_sub = await client.post(
        f"/api/v1/surveys/{draft_id}/submit",
        json={
            "submissionId": str(uuid.uuid4()),
            "questionnaireId": draft_id,
            "questionnaireVersion": "1.0",
            "participantIdentifier": "PT-VER-002",
            "answers": {},
        },
        headers=headers,
    )
    assert res_draft_sub.status_code == 409


@pytest.mark.asyncio
async def test_validation_and_data_quality_issues_tracking(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await create_published_study_and_questionnaire(client, headers)

    part_id = "PT-QUALITY-001"
    sub_id = str(uuid.uuid4())

    # Provide consent inside submission payload
    sub_payload = {
        "submissionId": sub_id,
        "questionnaireId": q_id,
        "questionnaireVersion": "1.0",
        "participantIdentifier": part_id,
        "consentRecord": {
            "questionnaireId": q_id,
            "questionnaireVersion": "1.0",
            "participantIdentifier": part_id,
            "agreedToParticipate": True,
            "agreedToDataStorage": True,
        },
        "answers": {
            "AGE": 12,  # Violation: min is 18
            "SMOKER_STATUS": "INVALID_CHOICE",  # Violation: choice not in list
            "BP_SYSTOLIC": 120.0,
            "CLINICAL_NOTES": "no",  # Violation: minLength is 5
        },
    }

    res_sub = await client.post(f"/api/v1/surveys/{q_id}/submit", json=sub_payload, headers=headers)
    assert res_sub.status_code == 200, res_sub.text

    # Verify Response Detail shows quality status and flagged issues
    res_det = await client.get(f"/api/v1/data-collection/responses/{sub_id}", headers=headers)
    assert res_det.status_code == 200, res_det.text
    det = res_det.json()
    assert det["status"] == "flagged_quality"
    assert len(det["qualityIssues"]) >= 3

    issue_types = [i["issueType"] for i in det["qualityIssues"]]
    assert "range_violation" in issue_types
    assert "invalid_choice" in issue_types

    # Test resolving a quality issue
    issue_to_resolve = det["qualityIssues"][0]
    res_resolve = await client.put(
        f"/api/v1/data-collection/quality-issues/{issue_to_resolve['id']}/resolve",
        json={"resolutionNotes": "Verified with clinic staff; participant is eligible.", "status": "resolved"},
        headers=headers,
    )
    assert res_resolve.status_code == 200, res_resolve.text
    assert res_resolve.json()["status"] == "resolved"


@pytest.mark.asyncio
async def test_response_correction_audit(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await create_published_study_and_questionnaire(client, headers)

    part_id = "PT-CORRECT-001"
    sub_id = str(uuid.uuid4())

    sub_payload = {
        "submissionId": sub_id,
        "questionnaireId": q_id,
        "questionnaireVersion": "1.0",
        "participantIdentifier": part_id,
        "consentRecord": {
            "questionnaireId": q_id,
            "questionnaireVersion": "1.0",
            "participantIdentifier": part_id,
            "agreedToParticipate": True,
            "agreedToDataStorage": True,
        },
        "answers": {
            "AGE": 30,
            "SMOKER_STATUS": "NEVER",
            "BP_SYSTOLIC": 115.0,
            "CLINICAL_NOTES": "Patient reported no dizziness",
        },
    }
    res_sub = await client.post(f"/api/v1/surveys/{q_id}/submit", json=sub_payload, headers=headers)
    assert res_sub.status_code == 200

    # Apply audited correction to AGE
    correction_payload = {
        "questionId": "q_age",
        "variableName": "AGE",
        "correctedValue": 31,
        "reason": "Date of birth re-verification confirmed participant was 31 at intake.",
    }
    res_corr = await client.post(
        f"/api/v1/data-collection/responses/{sub_id}/corrections",
        json=correction_payload,
        headers=headers,
    )
    assert res_corr.status_code == 201, res_corr.text
    corr_data = res_corr.json()
    assert corr_data["variableName"] == "AGE"
    assert corr_data["originalValue"] == 30
    assert corr_data["correctedValue"] == 31
    assert "re-verification" in corr_data["reason"]

    # Verify updated response shows corrected value and history
    res_det = await client.get(f"/api/v1/data-collection/responses/{sub_id}", headers=headers)
    assert res_det.status_code == 200
    age_ans = next(a for a in res_det.json()["answers"] if a["variableName"] == "AGE")
    assert age_ans["rawValue"] == 31
    assert len(res_det.json()["corrections"]) == 1


@pytest.mark.asyncio
async def test_offline_batch_sync_with_partial_failure(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await create_published_study_and_questionnaire(client, headers)

    sub_valid_id = str(uuid.uuid4())
    sub_version_conflict_id = str(uuid.uuid4())
    sub_missing_q_id = str(uuid.uuid4())

    batch_payload = {
        "submissions": [
            # 1. Valid submission with inline consent
            {
                "submissionId": sub_valid_id,
                "questionnaireId": q_id,
                "questionnaireVersion": "1.0",
                "participantIdentifier": "PT-BATCH-VALID-01",
                "consentRecord": {
                    "questionnaireId": q_id,
                    "questionnaireVersion": "1.0",
                    "participantIdentifier": "PT-BATCH-VALID-01",
                    "agreedToParticipate": True,
                    "agreedToDataStorage": True,
                },
                "answers": {"AGE": 50, "SMOKER_STATUS": "FORMER", "BP_SYSTOLIC": 130.0},
            },
            # 2. Version conflict submission
            {
                "submissionId": sub_version_conflict_id,
                "questionnaireId": q_id,
                "questionnaireVersion": "2.0-unreleased",
                "participantIdentifier": "PT-BATCH-CONFLICT-01",
                "answers": {"AGE": 25},
            },
            # 3. Non-existent questionnaire submission
            {
                "submissionId": sub_missing_q_id,
                "questionnaireId": str(uuid.uuid4()),
                "questionnaireVersion": "1.0",
                "participantIdentifier": "PT-BATCH-FAIL-01",
                "answers": {},
            },
        ]
    }

    res_batch = await client.post("/api/v1/data-collection/sync", json=batch_payload, headers=headers)
    assert res_batch.status_code == 200, res_batch.text
    batch_res = res_batch.json()

    # Verify that valid item was processed despite other items failing
    assert len(batch_res["successful"]) == 1
    assert batch_res["successful"][0]["submissionId"] == sub_valid_id

    # Verify version conflict categorization
    assert len(batch_res["conflicts"]) == 1
    assert batch_res["conflicts"][0]["submissionId"] == sub_version_conflict_id

    # Verify error rejection categorization
    assert len(batch_res["failed"]) == 1
    assert batch_res["failed"][0]["submissionId"] == sub_missing_q_id

    # Verify the successful item was actually persisted
    res_check = await client.get(f"/api/v1/data-collection/responses/{sub_valid_id}", headers=headers)
    assert res_check.status_code == 200
    assert res_check.json()["syncSource"] == "offline_batch"


@pytest.mark.asyncio
async def test_participant_withdrawal_and_metrics(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await create_published_study_and_questionnaire(client, headers)

    part_code = "PT-WITHDRAW-001"
    sub_id = str(uuid.uuid4())

    # Submit consent & response to enroll participant
    res_sub = await client.post(
        f"/api/v1/surveys/{q_id}/submit",
        json={
            "submissionId": sub_id,
            "questionnaireId": q_id,
            "questionnaireVersion": "1.0",
            "participantIdentifier": part_code,
            "consentRecord": {
                "questionnaireId": q_id,
                "questionnaireVersion": "1.0",
                "participantIdentifier": part_code,
                "agreedToParticipate": True,
                "agreedToDataStorage": True,
            },
            "answers": {"AGE": 40, "SMOKER_STATUS": "NEVER", "BP_SYSTOLIC": 118.0},
        },
        headers=headers,
    )
    assert res_sub.status_code == 200

    # 1. Retrieve participants list
    res_parts = await client.get(f"/api/v1/participants?studyId={study_id}", headers=headers)
    assert res_parts.status_code == 200
    parts = res_parts.json()
    p_match = next(p for p in parts if p["identifierCode"] == part_code)
    assert p_match["isActive"] is True
    p_id = p_match["id"]

    # 2. Check metrics before withdrawal
    res_met = await client.get("/api/v1/participants/metrics", headers=headers)
    assert res_met.status_code == 200
    assert res_met.json()["totalEnrolled"] >= 1

    # 3. Withdraw participant
    res_w = await client.post(
        f"/api/v1/participants/{p_id}/withdraw",
        json={"reason": "Participant requested withdrawal due to relocation."},
        headers=headers,
    )
    assert res_w.status_code == 200, res_w.text
    withdrawn_p = res_w.json()
    assert withdrawn_p["status"] == "withdrawn"
    assert withdrawn_p["isActive"] is False
    assert withdrawn_p["withdrawnAt"] is not None

    # 4. Attempting another submission for withdrawn participant -> Rejected because consent was withdrawn
    res_new_sub = await client.post(
        f"/api/v1/surveys/{q_id}/submit",
        json={
            "submissionId": str(uuid.uuid4()),
            "questionnaireId": q_id,
            "questionnaireVersion": "1.0",
            "participantIdentifier": part_code,
            "answers": {"AGE": 40},
        },
        headers=headers,
    )
    assert res_new_sub.status_code == 400
    assert "consent" in get_error_message(res_new_sub)


@pytest.mark.asyncio
async def test_survey_invitation_generation(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await create_published_study_and_questionnaire(client, headers)

    res_inv = await client.post(
        f"/api/v1/surveys/{q_id}/invitations",
        json={
            "participantIdentifier": "PT-INV-001",
            "accessMode": "invitation_only",
            "maxUses": 1,
            "expiresInDays": 14,
        },
        headers=headers,
    )
    assert res_inv.status_code == 201, res_inv.text
    inv_data = res_inv.json()
    assert "token" in inv_data
    assert len(inv_data["token"]) > 20
    assert inv_data["tokenPrefix"] == inv_data["token"][:8]
    assert inv_data["maxUses"] == 1
    assert inv_data["isRevoked"] is False

