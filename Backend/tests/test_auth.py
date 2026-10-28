import pytest
import pyotp
from httpx import AsyncClient
from app.models.user import User
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository


@pytest.mark.asyncio
async def test_user_registration_success(client: AsyncClient):
    payload = {
        "email": "new.scientist@university.edu",
        "password": "SecurePassword123!",
        "full_name": "Dr. Sarah Conner",
        "role_name": "researcher",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["email"] == "new.scientist@university.edu"
    assert data["data"]["full_name"] == "Dr. Sarah Conner"
    assert data["data"]["is_active"] is True
    assert data["data"]["is_verified"] is False


@pytest.mark.asyncio
async def test_user_registration_duplicate_email(client: AsyncClient, researcher_user: User):
    payload = {
        "email": researcher_user.email,
        "password": "AnotherPassword123!",
        "full_name": "Duplicate User",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_user_login_success(client: AsyncClient, researcher_user: User):
    payload = {
        "email": researcher_user.email,
        "password": "StrongP@ssw0rd123",
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]
    assert data["data"]["token_type"] == "bearer"
    assert data["data"]["user"]["email"] == researcher_user.email


@pytest.mark.asyncio
async def test_user_login_invalid_password(client: AsyncClient, researcher_user: User):
    payload = {
        "email": researcher_user.email,
        "password": "WrongPassword999!",
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_token_refresh_and_revocation(client: AsyncClient, researcher_user: User):
    # 1. Login to obtain tokens
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": researcher_user.email,
        "password": "StrongP@ssw0rd123",
    })
    tokens = login_resp.json()["data"]
    refresh_token = tokens["refresh_token"]

    # 2. Refresh token
    refresh_resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert refresh_resp.status_code == 200
    new_tokens = refresh_resp.json()["data"]
    assert "access_token" in new_tokens
    new_refresh_token = new_tokens["refresh_token"]

    # 3. Old refresh token should now be revoked (cannot be reused)
    old_reuse_resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert old_reuse_resp.status_code == 401

    # 4. Logout with active refresh token
    logout_resp = await client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": new_refresh_token},
        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
    )
    assert logout_resp.status_code == 200

    # 5. Token cannot be refreshed after logout
    post_logout_resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": new_refresh_token,
    })
    assert post_logout_resp.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_profile(client: AsyncClient, researcher_user: User, auth_headers):
    headers = auth_headers(researcher_user, "researcher")
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["email"] == researcher_user.email
    assert data["full_name"] == researcher_user.full_name


@pytest.mark.asyncio
async def test_update_current_user_profile(client: AsyncClient, researcher_user: User, auth_headers):
    headers = auth_headers(researcher_user, "researcher")
    payload = {
        "full_name": "Dr. Jane Modified",
        "phone_number": "+1-555-0199",
    }
    response = await client.patch("/api/v1/auth/me", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["full_name"] == "Dr. Jane Modified"
    assert data["phone_number"] == "+1-555-0199"


@pytest.mark.asyncio
async def test_change_password(client: AsyncClient, researcher_user: User, auth_headers):
    headers = auth_headers(researcher_user, "researcher")
    payload = {
        "current_password": "StrongP@ssw0rd123",
        "new_password": "BrandNewPassword456!",
    }
    response = await client.post("/api/v1/auth/change-password", json=payload, headers=headers)
    assert response.status_code == 200

    # Login with old password must fail
    old_login = await client.post("/api/v1/auth/login", json={
        "email": researcher_user.email,
        "password": "StrongP@ssw0rd123",
    })
    assert old_login.status_code == 401

    # Login with new password must succeed
    new_login = await client.post("/api/v1/auth/login", json={
        "email": researcher_user.email,
        "password": "BrandNewPassword456!",
    })
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_mfa_setup_and_verify(client: AsyncClient, researcher_user: User, auth_headers):
    headers = auth_headers(researcher_user, "researcher")

    # 1. Initiate MFA setup
    setup_resp = await client.post("/api/v1/auth/mfa/setup", headers=headers)
    assert setup_resp.status_code == 200
    data = setup_resp.json()["data"]
    secret = data["secret"]
    assert "provisioning_uri" in data

    # 2. Generate valid TOTP code from secret
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    # 3. Verify and enable MFA
    verify_resp = await client.post(
        "/api/v1/auth/mfa/verify",
        json={"code": valid_code},
        headers=headers,
    )
    assert verify_resp.status_code == 200

    # 4. Profile shows MFA enabled
    profile_resp = await client.get("/api/v1/auth/me", headers=headers)
    assert profile_resp.json()["data"]["mfa_enabled"] is True


@pytest.mark.asyncio
async def test_email_verification_flow(client: AsyncClient, db_session):
    from app.services.auth_service import AuthService
    from app.schemas.auth import RegisterRequest

    auth_service = AuthService(db_session)
    reg_payload = RegisterRequest(
        email="unverified.doc@clinic.org",
        password="ValidPassword789!",
        full_name="Unverified Doc",
    )
    user, raw_token = await auth_service.register(reg_payload)
    await db_session.commit()
    assert user.is_verified is False

    # Verify email via API
    resp = await client.post("/api/v1/auth/verify-email", json={"token": raw_token})
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # User profile on login now reports verified
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "unverified.doc@clinic.org",
        "password": "ValidPassword789!",
    })
    assert login_resp.status_code == 200
    assert login_resp.json()["data"]["user"]["is_verified"] is True


@pytest.mark.asyncio
async def test_password_reset_flow(client: AsyncClient, researcher_user: User, db_session):
    from app.services.auth_service import AuthService

    auth_service = AuthService(db_session)
    raw_token = await auth_service.request_password_reset(researcher_user.email)
    await db_session.commit()
    assert raw_token is not None

    # Confirm password reset
    confirm_resp = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": raw_token, "new_password": "ResetPassword987!"},
    )
    assert confirm_resp.status_code == 200

    # Login with new password
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": researcher_user.email,
        "password": "ResetPassword987!",
    })
    assert login_resp.status_code == 200


@pytest.mark.asyncio
async def test_login_rate_limiting(client: AsyncClient, researcher_user: User):
    # Perform 5 failed login attempts to trigger rate limit
    for _ in range(5):
        await client.post("/api/v1/auth/login", json={
            "email": researcher_user.email,
            "password": "WrongPasswordAttempt!",
        })

    # 6th attempt must trigger HTTP 429
    blocked_resp = await client.post("/api/v1/auth/login", json={
        "email": researcher_user.email,
        "password": "WrongPasswordAttempt!",
    })
    assert blocked_resp.status_code == 429
    assert blocked_resp.json()["error_code"] == "RATE_LIMIT_EXCEEDED"
