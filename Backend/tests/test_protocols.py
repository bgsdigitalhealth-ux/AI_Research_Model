import io
import pytest
from httpx import AsyncClient
from app.models.user import User


def create_mock_pdf_bytes(title: str = "Test Research Protocol") -> bytes:
    """Generates valid minimal PDF binary bytes starting with %PDF."""
    content = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 120 >>
stream
BT
/F1 12 Tf
72 712 Td
({title} - Clinical Protocol for Testing) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000213 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
385
%%EOF
"""
    return content.encode("utf-8")


@pytest.mark.asyncio
async def test_upload_protocol_valid_pdf_success(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")

    # Create study
    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "PDF Upload Test Study", "protocolNumber": "PDF-TEST-01"},
        headers=headers,
    )
    study_id = study_res.json()["id"]

    pdf_bytes = create_mock_pdf_bytes("Novel Biomarker Study")
    files = {"file": ("protocol.pdf", pdf_bytes, "application/pdf")}
    data = {"study_id": study_id, "title": "Biomarker Protocol"}

    upload_res = await client.post(
        "/api/v1/protocols/upload",
        data=data,
        files=files,
        headers=headers,
    )
    assert upload_res.status_code == 201
    result = upload_res.json()
    assert result["title"] == "Biomarker Protocol"
    assert result["version"] == "1.0"
    assert result["fileName"] == "protocol.pdf"
    assert result["status"] == "draft"
    assert result["extractionStatus"] == "not_started"
    assert "id" in result

    # Verify download endpoint returns matching bytes
    dl_res = await client.get(f"/api/v1/protocols/{result['id']}/download", headers=headers)
    assert dl_res.status_code == 200
    assert dl_res.content == pdf_bytes


@pytest.mark.asyncio
async def test_upload_protocol_invalid_extension_fails(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "Ext Test", "protocolNumber": "EXT-01"},
        headers=headers,
    )
    study_id = study_res.json()["id"]

    files = {"file": ("malicious.exe", b"binary_data", "application/octet-stream")}
    res = await client.post(
        "/api/v1/protocols/upload",
        data={"study_id": study_id},
        files=files,
        headers=headers,
    )
    assert res.status_code == 400
    assert res.json()["error_code"] == "FILE_VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_upload_protocol_disguised_file_fails_magic_bytes_check(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "Magic Bytes Test", "protocolNumber": "MAGIC-01"},
        headers=headers,
    )
    study_id = study_res.json()["id"]

    # Extension is .pdf, but content is arbitrary plain text without %PDF header
    fake_pdf = b"This is not a real PDF file header."
    files = {"file": ("fake.pdf", fake_pdf, "application/pdf")}
    res = await client.post(
        "/api/v1/protocols/upload",
        data={"study_id": study_id},
        files=files,
        headers=headers,
    )
    assert res.status_code == 400
    assert res.json()["error_code"] == "FILE_VALIDATION_ERROR"
    assert "Invalid PDF" in res.json()["message"]


@pytest.mark.asyncio
async def test_upload_protocol_unauthorized_user_forbidden(
    client: AsyncClient, pi_user: User, researcher_user: User, auth_headers
):
    pi_headers = auth_headers(pi_user, "principal_investigator")
    res_headers = auth_headers(researcher_user, "researcher")

    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "Private PI Study", "protocolNumber": "PRIV-01"},
        headers=pi_headers,
    )
    study_id = study_res.json()["id"]

    pdf_bytes = create_mock_pdf_bytes("Secret Protocol")
    files = {"file": ("protocol.pdf", pdf_bytes, "application/pdf")}

    # Researcher attempts to upload to PI study without membership
    upload_res = await client.post(
        "/api/v1/protocols/upload",
        data={"study_id": study_id},
        files=files,
        headers=res_headers,
    )
    assert upload_res.status_code == 403
    assert upload_res.json()["error_code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_protocol_version_history_tracking(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")

    study_res = await client.post(
        "/api/v1/studies",
        json={"title": "Versioned Protocol Study", "protocolNumber": "VER-01"},
        headers=headers,
    )
    study_id = study_res.json()["id"]

    pdf_v1 = create_mock_pdf_bytes("Protocol Version 1.0")
    up1 = await client.post(
        "/api/v1/protocols/upload",
        data={"study_id": study_id, "title": "Protocol v1.0", "version": "1.0"},
        files={"file": ("protocol_v1.pdf", pdf_v1, "application/pdf")},
        headers=headers,
    )
    assert up1.status_code == 201
    proto1_id = up1.json()["id"]

    # Check version history endpoint
    versions_res = await client.get(f"/api/v1/protocols/{proto1_id}/versions", headers=headers)
    assert versions_res.status_code == 200
    versions = versions_res.json()
    assert len(versions) >= 1
    assert versions[0]["versionNumber"] == "1.0"

