import pytest
from httpx import AsyncClient
from app.models.user import User
from tests.test_protocols import create_mock_pdf_bytes


@pytest.mark.asyncio
async def test_unconfigured_ai_provider_error(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")

    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "AI Extraction Test Study", "protocolNumber": "AI-TEST-01"},
        headers=headers,
    )
    study_id = study_res.json()["id"]

    pdf_bytes = create_mock_pdf_bytes("Clinical Oncology Protocol v1")
    up = await client.post(
        "/api/v1/protocols/upload",
        data={"study_id": study_id, "title": "Oncology Protocol"},
        files={"file": ("oncology.pdf", pdf_bytes, "application/pdf")},
        headers=headers,
    )
    protocol_id = up.json()["id"]

    # When no AI provider API key is set, extraction must return a clear configuration error
    extract_res = await client.post(
        f"/api/v1/protocols/{protocol_id}/extract",
        headers=headers,
    )
    assert extract_res.status_code == 400
    assert extract_res.json()["error_code"] == "AI_PROVIDER_NOT_CONFIGURED"

    # Extraction status should be "failed" with real error message
    get_ext = await client.get(f"/api/v1/protocols/{protocol_id}/extraction", headers=headers)
    assert get_ext.status_code == 200
    ext_data = get_ext.json()
    assert ext_data["status"] == "failed"
    assert "AI extraction provider is not configured" in ext_data["errorMessage"]


@pytest.mark.asyncio
async def test_field_verification_workflow(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")

    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "Verification Study", "protocolNumber": "VERIFY-01"},
        headers=headers,
    )
    study_id = study_res.json()["id"]

    pdf_bytes = create_mock_pdf_bytes("Neurology Research Protocol")
    up = await client.post(
        "/api/v1/protocols/upload",
        data={"study_id": study_id},
        files={"file": ("neurology.pdf", pdf_bytes, "application/pdf")},
        headers=headers,
    )
    protocol_id = up.json()["id"]

    # Retrieve initial extraction structure
    get_ext = await client.get(f"/api/v1/protocols/{protocol_id}/extraction", headers=headers)
    assert get_ext.status_code == 200
    fields = get_ext.json()["fields"]
    assert "studyDesign" in fields
    assert "primaryOutcomes" in fields
    assert "sampleSize" in fields

    # 1. Edit a field manually
    edit_res = await client.patch(
        f"/api/v1/protocols/{protocol_id}/extraction/fields/studyDesign",
        json={
            "status": "edited",
            "verifiedValue": "Randomized Double-Blind Placebo-Controlled 2-Arm Trial",
            "reviewerNotes": "Extracted from Section 3 Methodology",
        },
        headers=headers,
    )
    assert edit_res.status_code == 200
    edited = edit_res.json()
    assert edited["status"] == "edited"
    assert edited["verifiedValue"] == "Randomized Double-Blind Placebo-Controlled 2-Arm Trial"
    assert edited["reviewerNotes"] == "Extracted from Section 3 Methodology"
    assert edited["verifiedBy"] == pi_user.full_name

    # 2. Flag a field with reason
    flag_res = await client.patch(
        f"/api/v1/protocols/{protocol_id}/extraction/fields/sampleSize",
        json={
            "status": "flagged",
            "flagReason": "Sample size power calculation requires statistician audit",
        },
        headers=headers,
    )
    assert flag_res.status_code == 200
    assert flag_res.json()["status"] == "flagged"
    assert flag_res.json()["flagReason"] == "Sample size power calculation requires statistician audit"

    # 3. Accept a field
    accept_res = await client.patch(
        f"/api/v1/protocols/{protocol_id}/extraction/fields/primaryOutcomes",
        json={
            "status": "accepted",
            "verifiedValue": ["Reduction in symptom severity score at 12 weeks"],
        },
        headers=headers,
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "accepted"


@pytest.mark.asyncio
async def test_protocol_approval_and_version_immutability(
    client: AsyncClient, pi_user: User, researcher_user: User, auth_headers
):
    pi_headers = auth_headers(pi_user, "principal_investigator")
    res_headers = auth_headers(researcher_user, "researcher")

    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "Approval Study", "protocolNumber": "APPR-01"},
        headers=pi_headers,
    )
    study_id = study_res.json()["id"]

    pdf_bytes = create_mock_pdf_bytes("Vaccine Trial Protocol")
    up = await client.post(
        "/api/v1/protocols/upload",
        data={"study_id": study_id},
        files={"file": ("vaccine.pdf", pdf_bytes, "application/pdf")},
        headers=pi_headers,
    )
    protocol_id = up.json()["id"]

    # Researcher cannot approve protocol (requires PI or Admin)
    unauthorized_appr = await client.post(
        f"/api/v1/protocols/{protocol_id}/approve-extraction",
        json={"notes": "Attempted approval"},
        headers=res_headers,
    )
    assert unauthorized_appr.status_code == 403

    # PI approves protocol
    appr_res = await client.post(
        f"/api/v1/protocols/{protocol_id}/approve-extraction",
        json={"notes": "Final protocol verified and approved by PI", "irbApprovalNumber": "IRB-2026-VAC"},
        headers=pi_headers,
    )
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert appr_data["status"] == "approved"

    # Immutability Check: Any subsequent edit to fields must fail with 409 Conflict
    subsequent_edit = await client.patch(
        f"/api/v1/protocols/{protocol_id}/extraction/fields/studyDesign",
        json={"status": "edited", "verifiedValue": "Attempted modification of locked version"},
        headers=pi_headers,
    )
    assert subsequent_edit.status_code == 409
    assert subsequent_edit.json()["error_code"] == "VERSION_IMMUTABLE"

    # Immutability Check: Re-extracting an approved protocol must also fail with 409 Conflict
    subsequent_extract = await client.post(
        f"/api/v1/protocols/{protocol_id}/extract",
        headers=pi_headers,
    )
    assert subsequent_extract.status_code == 409
    assert subsequent_extract.json()["error_code"] == "VERSION_IMMUTABLE"


@pytest.mark.asyncio
async def test_study_configuration_methods_and_analysis_plan(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")

    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "Statistical Plan Study", "protocolNumber": "STAT-01"},
        headers=headers,
    )
    study_id = study_res.json()["id"]

    pdf_bytes = create_mock_pdf_bytes("Methodology Protocol")
    up = await client.post(
        "/api/v1/protocols/upload",
        data={"study_id": study_id},
        files={"file": ("methodology.pdf", pdf_bytes, "application/pdf")},
        headers=headers,
    )
    protocol_id = up.json()["id"]

    # Retrieve default configuration
    get_cfg = await client.get(
        f"/api/v1/protocols/{protocol_id}/study-configuration",
        headers=headers,
    )
    assert get_cfg.status_code == 200
    cfg_data = get_cfg.json()
    assert cfg_data["studyType"] == "interventional"
    assert cfg_data["blindingType"] == "open_label"

    # Update configuration
    update_payload = {
        "studyType": "randomized_controlled_trial",
        "randomizationMethod": "stratified_permuted_block",
        "blindingType": "double_blind",
        "numberOfArms": 2,
        "primaryHypothesis": "Treatment reduces LDL cholesterol by >20% compared to placebo at week 24",
        "significanceAlpha": 0.05,
        "powerThreshold": 0.90,
        "plannedStatisticalTest": "analysis_of_covariance_ancova",
        "missingDataStrategy": "multiple_imputation",
    }
    put_cfg = await client.put(
        f"/api/v1/protocols/{protocol_id}/study-configuration",
        json=update_payload,
        headers=headers,
    )
    assert put_cfg.status_code == 200
    saved_cfg = put_cfg.json()
    assert saved_cfg["studyType"] == "randomized_controlled_trial"
    assert saved_cfg["blindingType"] == "double_blind"
    assert saved_cfg["powerThreshold"] == 0.90
    assert saved_cfg["plannedStatisticalTest"] == "analysis_of_covariance_ancova"
    assert saved_cfg["missingDataStrategy"] == "multiple_imputation"

