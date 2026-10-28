import uuid
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock

from app.models.user import User


async def create_test_study(client: AsyncClient, headers: dict, title: str = "Oncology QOL Study") -> str:
    unique_suffix = uuid.uuid4().hex[:6]
    res = await client.post(
        "/api/v1/studies",
        json={
            "title": f"{title} {unique_suffix}",
            "protocolNumber": f"ONC-2026-{unique_suffix}",
            "targetParticipants": 100,
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.asyncio
async def test_questionnaire_crud_and_lifecycle(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id = await create_test_study(client, headers)

    # 1. Create questionnaire draft
    create_payload = {
        "title": "Patient Reported Outcome Scale",
        "description": "Measures quality of life symptoms.",
        "studyId": study_id,
        "sections": [
            {"id": "sec_1", "title": "Physical Well-being", "description": "Questions on energy and mobility", "order": 1}
        ],
        "questions": [
            {
                "id": "q_1",
                "variableName": "ENERGY_LEVEL",
                "type": "likert_5",
                "text": "I felt energetic throughout the day.",
                "sectionId": "sec_1",
                "order": 1,
                "validation": {"required": True},
            },
            {
                "id": "q_2",
                "variableName": "DAILY_COMMENTS",
                "type": "long_text",
                "text": "Additional health notes or symptoms today.",
                "sectionId": "sec_1",
                "order": 2,
                "validation": {"required": False, "maxLength": 500},
            },
        ],
    }

    res = await client.post("/api/v1/questionnaires", json=create_payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    q_id = data["id"]
    assert data["title"] == "Patient Reported Outcome Scale"
    assert data["status"] == "draft"
    assert data["version"] == "1.0"
    assert len(data["sections"]) == 1
    assert len(data["questions"]) == 2
    # Verify auto-populated 5-point Likert options
    assert len(data["questions"][0]["choices"]) == 5

    # 2. Get questionnaire by ID
    res = await client.get(f"/api/v1/questionnaires/{q_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["id"] == q_id

    # 3. Update questionnaire draft
    update_payload = {
        "title": "Patient Reported Outcome Scale - Updated",
        "questions": [
            {
                "id": "q_1",
                "variableName": "ENERGY_LEVEL",
                "type": "likert_5",
                "text": "I felt energetic throughout the past 24 hours.",
                "sectionId": "sec_1",
                "order": 1,
                "validation": {"required": True},
            },
            {
                "id": "q_2",
                "variableName": "DAILY_COMMENTS",
                "type": "long_text",
                "text": "Additional notes.",
                "sectionId": "sec_1",
                "order": 2,
                "validation": {"required": False},
            },
            {
                "id": "q_3",
                "variableName": "PAIN_SCORE",
                "type": "integer",
                "text": "Pain severity rating (0 to 10)",
                "sectionId": "sec_1",
                "order": 3,
                "validation": {"required": True, "min": 0, "max": 10},
            },
        ],
    }
    res = await client.put(f"/api/v1/questionnaires/{q_id}", json=update_payload, headers=headers)
    assert res.status_code == 200
    updated = res.json()
    assert updated["title"] == "Patient Reported Outcome Scale - Updated"
    assert len(updated["questions"]) == 3

    # 4. Submit for review
    res = await client.post(f"/api/v1/questionnaires/{q_id}/submit-review", headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "under_review"

    # 5. Approve questionnaire
    res = await client.post(
        f"/api/v1/questionnaires/{q_id}/approve",
        json={"notes": "Approved for clinical use by PI."},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "approved"
    assert res.json()["approvedBy"] is not None

    # 6. Publish questionnaire
    res = await client.post(
        f"/api/v1/questionnaires/{q_id}/publish",
        json={"changeSummary": "Initial baseline release for trial ONC-2026-QOL"},
        headers=headers,
    )
    assert res.status_code == 200
    published = res.json()
    assert published["status"] == "published"
    assert published["publishedAt"] is not None

    # 7. Immutability check: Attempting to modify a published questionnaire must fail with 409
    res = await client.put(
        f"/api/v1/questionnaires/{q_id}",
        json={"title": "Unauthorized Mutation Attempt"},
        headers=headers,
    )
    assert res.status_code == 409, "Modifying published questionnaire must fail with 409"

    # Attempting to delete a published questionnaire must also fail with 409
    res = await client.delete(f"/api/v1/questionnaires/{q_id}", headers=headers)
    assert res.status_code == 409

    # 8. Check version snapshot in versions history
    res = await client.get(f"/api/v1/questionnaires/{q_id}/versions", headers=headers)
    assert res.status_code == 200
    versions = res.json()
    assert len(versions) == 1
    assert versions[0]["versionNumber"] == "1.0"
    assert versions[0]["questionCount"] == 3


@pytest.mark.asyncio
async def test_questionnaire_version_branching(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id = await create_test_study(client, headers)

    # Create and publish initial questionnaire
    create_payload = {
        "title": "Baseline Symptoms Questionnaire",
        "studyId": study_id,
        "questions": [
            {
                "id": "q_orig_1",
                "variableName": "SYMPTOM_SEVERITY",
                "type": "rating_5",
                "text": "Rate severity from 1 to 5",
                "order": 1,
                "validation": {"required": True},
            }
        ],
    }
    create_res = await client.post("/api/v1/questionnaires", json=create_payload, headers=headers)
    q_id = create_res.json()["id"]

    await client.post(f"/api/v1/questionnaires/{q_id}/submit-review", headers=headers)
    await client.post(f"/api/v1/questionnaires/{q_id}/approve", json={"notes": "Approved"}, headers=headers)
    await client.post(
        f"/api/v1/questionnaires/{q_id}/publish",
        json={"changeSummary": "Release v1.0"},
        headers=headers,
    )

    # Branch new version
    branch_res = await client.post(f"/api/v1/questionnaires/{q_id}/new-version", headers=headers)
    assert branch_res.status_code == 201
    branched = branch_res.json()

    assert branched["id"] != q_id
    assert branched["version"] == "v2.0"
    assert branched["status"] == "draft"
    assert len(branched["questions"]) == 1
    assert branched["questions"][0]["variableName"] == "SYMPTOM_SEVERITY"

    # Verify the new branched draft is editable
    update_res = await client.put(
        f"/api/v1/questionnaires/{branched['id']}",
        json={"title": "Baseline Symptoms Questionnaire v2 (Amended)"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Baseline Symptoms Questionnaire v2 (Amended)"


@pytest.mark.asyncio
async def test_variable_name_uniqueness_and_validation(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id = await create_test_study(client, headers)

    # Reject duplicate variable names
    payload_duplicate = {
        "title": "Duplicate Variable Test",
        "studyId": study_id,
        "questions": [
            {"id": "q1", "variableName": "BLOOD_PRESSURE", "type": "short_text", "text": "BP Systolic", "order": 1},
            {"id": "q2", "variableName": "blood_pressure", "type": "short_text", "text": "BP Diastolic", "order": 2},
        ],
    }
    res = await client.post("/api/v1/questionnaires", json=payload_duplicate, headers=headers)
    assert res.status_code == 400
    assert "Duplicate variable name" in res.text

    # Reject invalid variable name syntax
    payload_invalid_syntax = {
        "title": "Invalid Syntax Test",
        "studyId": study_id,
        "questions": [
            {"id": "q1", "variableName": "123-INVALID-NAME", "type": "short_text", "text": "Question", "order": 1}
        ],
    }
    res = await client.post("/api/v1/questionnaires", json=payload_invalid_syntax, headers=headers)
    assert res.status_code == 422  # Pydantic schema validation failure


@pytest.mark.asyncio
async def test_conditional_logic_and_cycle_rejection(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id = await create_test_study(client, headers)

    # 1. Circular dependency rejection (q1 depends on q2, and q2 depends on q1)
    payload_circular = {
        "title": "Circular Logic Test",
        "studyId": study_id,
        "questions": [
            {
                "id": "q1",
                "variableName": "HAS_FEVER",
                "type": "single_choice",
                "text": "Do you have a fever?",
                "choices": [{"id": "c1", "code": "YES", "label": "Yes"}, {"id": "c2", "code": "NO", "label": "No"}],
                "conditionalLogic": {
                    "action": "show",
                    "match": "all",
                    "rules": [{"targetQuestionId": "q2", "operator": "equals", "value": "YES"}],
                },
                "order": 1,
            },
            {
                "id": "q2",
                "variableName": "FEVER_SEVERITY",
                "type": "short_text",
                "text": "Describe your fever symptoms",
                "conditionalLogic": {
                    "action": "show",
                    "match": "all",
                    "rules": [{"targetQuestionId": "q1", "operator": "equals", "value": "YES"}],
                },
                "order": 2,
            },
        ],
    }
    res = await client.post("/api/v1/questionnaires", json=payload_circular, headers=headers)
    assert res.status_code == 400
    assert "Circular dependency" in res.text

    # 2. Self-referencing dependency rejection
    payload_self = {
        "title": "Self Logic Test",
        "studyId": study_id,
        "questions": [
            {
                "id": "q1",
                "variableName": "IS_SMOKER",
                "type": "single_choice",
                "text": "Do you smoke?",
                "choices": [{"id": "c1", "code": "Y", "label": "Yes"}, {"id": "c2", "code": "N", "label": "No"}],
                "conditionalLogic": {
                    "action": "show",
                    "match": "all",
                    "rules": [{"targetQuestionId": "q1", "operator": "equals", "value": "Y"}],
                },
                "order": 1,
            }
        ],
    }
    res = await client.post("/api/v1/questionnaires", json=payload_self, headers=headers)
    assert res.status_code == 400
    assert "cannot have conditional logic referencing itself" in res.text

    # 3. Non-existent target question rejection
    payload_missing_target = {
        "title": "Missing Target Question Test",
        "studyId": study_id,
        "questions": [
            {
                "id": "q1",
                "variableName": "FOLLOWUP_QUESTION",
                "type": "short_text",
                "text": "Please elaborate.",
                "conditionalLogic": {
                    "action": "show",
                    "match": "all",
                    "rules": [{"targetQuestionId": "non_existent_qid", "operator": "equals", "value": "1"}],
                },
                "order": 1,
            }
        ],
    }
    res = await client.post("/api/v1/questionnaires", json=payload_missing_target, headers=headers)
    assert res.status_code == 400
    assert "referencing non-existent question ID" in res.text


@pytest.mark.asyncio
async def test_ai_questionnaire_generation_unconfigured_provider(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id = await create_test_study(client, headers)

    gen_payload = {
        "studyTitle": "Clinical Trial",
        "studyId": study_id,
        "researchAims": "Assess patient quality of life outcomes post-treatment.",
        "targetPopulation": "Adult oncology patients",
        "outcomes": ["Physical well-being", "Pain reduction"],
        "instrumentType": "PRO",
        "suggestedQuestionCount": 10,
    }

    # Ensure AI provider is unconfigured by clearing API keys
    with patch("app.core.config.settings.GEMINI_API_KEY", ""), patch(
        "app.core.config.settings.OPENAI_API_KEY", ""
    ):
        res = await client.post("/api/v1/questionnaires/generate", json=gen_payload, headers=headers)
        assert res.status_code == 400
        data = res.json()
        assert data.get("error_code") == "AI_PROVIDER_NOT_CONFIGURED" or "AI provider" in str(data)


@pytest.mark.asyncio
async def test_ai_questionnaire_generation_with_configured_provider(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id = await create_test_study(client, headers)

    gen_payload = {
        "studyTitle": "Oncology QOL Trial",
        "studyId": study_id,
        "researchAims": "Assess patient fatigue and cognitive function.",
        "targetPopulation": "Adult patients undergoing chemotherapy",
        "outcomes": ["Fatigue severity", "Cognitive clarity"],
        "instrumentType": "PRO",
        "suggestedQuestionCount": 2,
    }

    mock_ai_output = {
        "title": "Oncology Fatigue & Cognitive Scale",
        "description": "Synthesized candidate questionnaire draft for clinical evaluation.",
        "sections": [
            {"id": "sec_ai_1", "title": "Fatigue Domain", "description": "Assessment of diurnal fatigue", "order": 1}
        ],
        "questions": [
            {
                "id": "q_ai_1",
                "variableName": "FATIGUE_SEVERITY",
                "type": "likert_5",
                "text": "I felt overwhelmed by physical fatigue.",
                "sectionId": "sec_ai_1",
                "order": 1,
                "validation": {"required": True},
                "targetObjectiveId": "OBJ-1",
                "targetOutcomeName": "Fatigue severity",
            },
            {
                "id": "q_ai_2",
                "variableName": "COGNITIVE_CLARITY",
                "type": "likert_5",
                "text": "I was able to concentrate clearly on routine tasks.",
                "sectionId": "sec_ai_1",
                "order": 2,
                "validation": {"required": True},
                "targetObjectiveId": "OBJ-2",
                "targetOutcomeName": "Cognitive clarity",
            },
        ],
        "mappings": [
            {
                "objectiveId": "OBJ-1",
                "objectiveTitle": "Assess physical fatigue",
                "outcomeName": "Fatigue severity",
                "coveredQuestionIds": ["q_ai_1"],
                "isCovered": True,
            }
        ],
    }

    mock_provider = AsyncMock()
    mock_provider.model_name = "mock-gemini-pro"
    mock_provider.generate_questionnaire.return_value = mock_ai_output

    with patch("app.services.questionnaire_service.get_ai_provider", return_value=mock_provider):
        res = await client.post("/api/v1/questionnaires/generate", json=gen_payload, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["title"] == "Oncology Fatigue & Cognitive Scale"
        assert data["isAiGenerated"] is True
        # Verify generated questions are flagged as AI generated and unverified by researcher
        for q in data["questions"]:
            assert q["isAiGenerated"] is True
            assert q["verifiedByResearcher"] is False
        assert len(data["mappings"]) == 1
        assert data["mappings"][0]["objectiveId"] == "OBJ-1"


@pytest.mark.asyncio
async def test_questionnaire_metrics_endpoint(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id = await create_test_study(client, headers)

    # Create one draft questionnaire
    create_payload = {
        "title": "Metrics Test Questionnaire",
        "studyId": study_id,
        "questions": [
            {"id": "q1", "variableName": "METRIC_VAR", "type": "short_text", "text": "Question text", "order": 1}
        ],
    }
    await client.post("/api/v1/questionnaires", json=create_payload, headers=headers)

    res = await client.get("/api/v1/questionnaires/metrics", headers=headers)
    assert res.status_code == 200
    metrics = res.json()
    assert metrics["totalQuestionnaires"] >= 1
    assert "recentQuestionnaires" in metrics
    assert isinstance(metrics["recentQuestionnaires"], list)

