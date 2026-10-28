import uuid
import pytest
from httpx import AsyncClient
from app.models.user import User


@pytest.mark.asyncio
async def test_admin_can_list_users(client: AsyncClient, admin_user: User, auth_headers):
    headers = auth_headers(admin_user, "administrator")
    response = await client.get("/api/v1/users", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert isinstance(data["data"], list)
    assert len(data["data"]) >= 1


@pytest.mark.asyncio
async def test_researcher_cannot_list_users(client: AsyncClient, researcher_user: User, auth_headers):
    headers = auth_headers(researcher_user, "researcher")
    # Researcher role does not possess user management permission
    response = await client.get("/api/v1/users", headers=headers)
    assert response.status_code == 403
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_cross_user_deactivation_blocked(
    client: AsyncClient,
    researcher_user: User,
    admin_user: User,
    auth_headers,
):
    headers = auth_headers(researcher_user, "researcher")
    # Researcher attempts to deactivate admin account via admin endpoint
    response = await client.post(f"/api/v1/users/{admin_user.id}/deactivate", headers=headers)
    assert response.status_code == 403
    data = response.json()
    assert data["error_code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_admin_can_deactivate_and_activate_user(
    client: AsyncClient,
    researcher_user: User,
    admin_user: User,
    auth_headers,
):
    admin_headers = auth_headers(admin_user, "administrator")

    # 1. Admin deactivates researcher
    deact_resp = await client.post(
        f"/api/v1/users/{researcher_user.id}/deactivate",
        headers=admin_headers,
    )
    assert deact_resp.status_code == 200
    assert deact_resp.json()["data"]["is_active"] is False

    # 2. Deactivated researcher cannot log in
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": researcher_user.email,
        "password": "StrongP@ssw0rd123",
    })
    assert login_resp.status_code == 403
    assert login_resp.json()["error_code"] == "ACCOUNT_INACTIVE"

    # 3. Admin reactivates researcher
    act_resp = await client.post(
        f"/api/v1/users/{researcher_user.id}/activate",
        headers=admin_headers,
    )
    assert act_resp.status_code == 200
    assert act_resp.json()["data"]["is_active"] is True

    # 4. Reactivated researcher can now log in
    relogin_resp = await client.post("/api/v1/auth/login", json={
        "email": researcher_user.email,
        "password": "StrongP@ssw0rd123",
    })
    assert relogin_resp.status_code == 200


@pytest.mark.asyncio
async def test_admin_can_access_audit_logs(client: AsyncClient, admin_user: User, auth_headers):
    headers = auth_headers(admin_user, "administrator")
    response = await client.get("/api/v1/audit", headers=headers)
    assert response.status_code == 200
    assert response.json()["success"] is True


@pytest.mark.asyncio
async def test_unauthorized_access_to_audit_logs(client: AsyncClient, researcher_user: User, auth_headers):
    headers = auth_headers(researcher_user, "researcher")
    response = await client.get("/api/v1/audit", headers=headers)
    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error_code"] == "AUTHENTICATION_FAILED"
