import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_registration_validation_short_password(client: AsyncClient):
    payload = {
        "email": "valid.email@example.com",
        "password": "short",  # Less than 8 characters
        "full_name": "Valid Name",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "VALIDATION_ERROR"
    assert "details" in data


@pytest.mark.asyncio
async def test_registration_validation_invalid_email(client: AsyncClient):
    payload = {
        "email": "not-an-email",
        "password": "ValidPassword123!",
        "full_name": "Valid Name",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_login_missing_password(client: AsyncClient):
    payload = {
        "email": "user@example.com",
        # missing password
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 422
    assert response.json()["error_code"] == "VALIDATION_ERROR"
