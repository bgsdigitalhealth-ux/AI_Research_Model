import uuid
import pytest
from httpx import AsyncClient
from app.models.user import User


@pytest.mark.asyncio
async def test_create_study_success(client: AsyncClient, pi_user: User, auth_headers):
    headers = auth_headers(pi_user, "principal_investigator")
    payload = {
        "title": "Cardiovascular Health Intervention Study",
        "protocolNumber": "CV-2026-001",
        "phase": "Phase II",
        "targetParticipants": 150,
        "description": "Double-blind randomized controlled trial for CV health.",
    }
    response = await client.post("/api/v1/studies", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["protocolNumber"] == payload["protocolNumber"]
    assert data["status"] == "draft"
    assert data["targetParticipants"] == 150
    assert "id" in data


@pytest.mark.asyncio
async def test_create_study_duplicate_protocol_number_fails(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    payload = {
        "title": "Initial Oncology Protocol",
        "protocolNumber": "ONC-2026-999",
        "targetParticipants": 50,
    }
    res1 = await client.post("/api/v1/studies", json=payload, headers=headers)
    assert res1.status_code == 201

    # Second attempt with same protocolNumber must fail with 409 Conflict
    res2 = await client.post("/api/v1/studies", json=payload, headers=headers)
    assert res2.status_code == 409
    assert res2.json()["error_code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_study_isolation_access_restrictions(
    client: AsyncClient, pi_user: User, researcher_user: User, admin_user: User, auth_headers
):
    pi_headers = auth_headers(pi_user, "principal_investigator")
    res_headers = auth_headers(researcher_user, "researcher")
    admin_headers = auth_headers(admin_user, "administrator")

    # PI creates study
    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "PI Exclusive Study", "protocolNumber": "PI-EXCL-01"},
        headers=pi_headers,
    )
    assert study_res.status_code == 201
    study_id = study_res.json()["id"]

    # Researcher (unauthorized) lists studies -> should NOT see PI's study
    list_res = await client.get("/api/v1/studies", headers=res_headers)
    assert list_res.status_code == 200
    returned_ids = [s["id"] for s in list_res.json()]
    assert study_id not in returned_ids

    # Researcher attempts direct access -> 403 Forbidden
    direct_res = await client.get(f"/api/v1/studies/{study_id}", headers=res_headers)
    assert direct_res.status_code == 403
    assert direct_res.json()["error_code"] == "PERMISSION_DENIED"

    # Administrator can view the study
    admin_get = await client.get(f"/api/v1/studies/{study_id}", headers=admin_headers)
    assert admin_get.status_code == 200
    assert admin_get.json()["id"] == study_id


@pytest.mark.asyncio
async def test_study_membership_management(
    client: AsyncClient, pi_user: User, researcher_user: User, auth_headers
):
    pi_headers = auth_headers(pi_user, "principal_investigator")
    res_headers = auth_headers(researcher_user, "researcher")

    # Create study
    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "Team Collaboration Study", "protocolNumber": "COLLAB-01"},
        headers=pi_headers,
    )
    study_id = study_res.json()["id"]

    # PI adds researcher as a study member
    add_member_res = await client.post(
        f"/api/v1/studies/{study_id}/members",
        json={"userId": str(researcher_user.id), "roleName": "researcher"},
        headers=pi_headers,
    )
    assert add_member_res.status_code == 201
    assert add_member_res.json()["userEmail"] == researcher_user.email

    # Now researcher can view the study
    get_res = await client.get(f"/api/v1/studies/{study_id}", headers=res_headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == study_id

    # PI removes researcher
    del_res = await client.delete(
        f"/api/v1/studies/{study_id}/members/{researcher_user.id}",
        headers=pi_headers,
    )
    assert del_res.status_code == 204

    # Researcher should now be forbidden again
    forbidden_res = await client.get(f"/api/v1/studies/{study_id}", headers=res_headers)
    assert forbidden_res.status_code == 403


@pytest.mark.asyncio
async def test_study_lifecycle_governance_enforcement(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")

    # Create study
    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "Governance Trial", "protocolNumber": "GOV-01"},
        headers=headers,
    )
    study_id = study_res.json()["id"]

    # Transitioning to "active" without governance must fail
    fail_res = await client.patch(
        f"/api/v1/studies/{study_id}",
        json={"status": "active"},
        headers=headers,
    )
    assert fail_res.status_code == 400
    assert fail_res.json()["error_code"] == "GOVERNANCE_REQUIREMENTS_NOT_MET"

    # Satisfy governance requirements
    gov_res = await client.patch(
        f"/api/v1/studies/{study_id}/governance",
        json={
            "governanceApproved": True,
            "consentFrameworkApproved": True,
            "irbApprovalNumber": "IRB-2026-XYZ-99",
        },
        headers=headers,
    )
    assert gov_res.status_code == 200
    assert gov_res.json()["governanceApproved"] is True

    # Transitioning to "active" should now succeed
    success_res = await client.patch(
        f"/api/v1/studies/{study_id}",
        json={"status": "active"},
        headers=headers,
    )
    assert success_res.status_code == 200
    assert success_res.json()["status"] == "active"

