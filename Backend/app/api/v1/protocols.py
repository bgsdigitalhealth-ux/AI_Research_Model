import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_client_ip, get_current_user, get_user_agent
from app.core.database import get_db
from app.models.user import User
from app.schemas.protocol import (
    ExtractedFieldSchema,
    FieldVerificationUpdateRequest,
    ProtocolApprovalRequest,
    ProtocolExtractionDataResponse,
    ProtocolResponse,
    ProtocolVersionResponse,
    StudyMethodAnalysisConfigurationSchema,
)
from app.services.protocol_service import ProtocolService

router = APIRouter(prefix="/protocols", tags=["Protocol Management & AI Extraction"])


@router.get(
    "",
    response_model=List[ProtocolResponse],
    status_code=status.HTTP_200_OK,
    summary="List protocols accessible to the authenticated user",
)
async def list_protocols(
    study_id: Optional[uuid.UUID] = Query(None, description="Filter by study ID"),
    status: Optional[str] = Query(None, description="Filter by protocol review status"),
    search: Optional[str] = Query(None, description="Search by title or filename"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProtocolService(db)
    items, _ = await service.list_protocols(
        current_user=current_user,
        study_id=study_id,
        status=status,
        search=search,
        page=page,
        limit=limit,
    )
    return items


@router.post(
    "/upload",
    response_model=ProtocolResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload research protocol document (PDF or DOCX)",
)
async def upload_protocol(
    study_id: uuid.UUID = Form(..., description="Target study ID for this protocol"),
    title: Optional[str] = Form(None, description="Protocol title"),
    version: Optional[str] = Form(None, description="Version string (e.g. 1.0)"),
    file: UploadFile = File(..., description="PDF or DOCX document file"),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    service = ProtocolService(db)
    return await service.upload_protocol(
        study_id=study_id,
        file=file,
        title=title,
        version_str=version,
        current_user=current_user,
        ip_address=ip,
        user_agent=ua,
    )


@router.get(
    "/{protocol_id}",
    response_model=ProtocolResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve protocol details by ID",
)
async def get_protocol_by_id(
    protocol_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProtocolService(db)
    return await service.get_protocol(protocol_id, current_user)


@router.post(
    "/{protocol_id}/extract",
    status_code=status.HTTP_200_OK,
    summary="Trigger AI extraction for protocol",
)
async def trigger_ai_extraction(
    protocol_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    service = ProtocolService(db)
    return await service.trigger_ai_extraction(protocol_id, current_user, ip, ua)


@router.get(
    "/{protocol_id}/extraction",
    response_model=ProtocolExtractionDataResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve AI extraction status and extracted fields",
)
async def get_extraction(
    protocol_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProtocolService(db)
    return await service.get_extraction_data(protocol_id, current_user)


@router.patch(
    "/{protocol_id}/extraction/fields/{field_key}",
    response_model=ExtractedFieldSchema,
    status_code=status.HTTP_200_OK,
    summary="Update verification decision for an extracted field",
)
async def update_field_verification(
    protocol_id: uuid.UUID,
    field_key: str,
    payload: FieldVerificationUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    service = ProtocolService(db)
    return await service.update_field_verification(
        protocol_id=protocol_id,
        field_key=field_key,
        payload=payload,
        current_user=current_user,
        ip_address=ip,
        user_agent=ua,
    )


@router.post(
    "/{protocol_id}/approve-extraction",
    response_model=ProtocolResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve protocol extraction and lock version as immutable",
)
async def approve_protocol_extraction(
    protocol_id: uuid.UUID,
    payload: ProtocolApprovalRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    service = ProtocolService(db)
    return await service.approve_protocol_extraction(
        protocol_id=protocol_id,
        payload=payload,
        current_user=current_user,
        ip_address=ip,
        user_agent=ua,
    )


@router.get(
    "/{protocol_id}/study-configuration",
    response_model=StudyMethodAnalysisConfigurationSchema,
    status_code=status.HTTP_200_OK,
    summary="Retrieve study methodology and statistical analysis configuration",
)
async def get_study_configuration(
    protocol_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProtocolService(db)
    return await service.get_study_configuration(protocol_id, current_user)


@router.put(
    "/{protocol_id}/study-configuration",
    response_model=StudyMethodAnalysisConfigurationSchema,
    status_code=status.HTTP_200_OK,
    summary="Save or update study methodology and statistical analysis configuration",
)
async def save_study_configuration(
    protocol_id: uuid.UUID,
    payload: Dict[str, Any],
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    service = ProtocolService(db)
    return await service.save_study_configuration(
        protocol_id=protocol_id,
        payload=payload,
        current_user=current_user,
        ip_address=ip,
        user_agent=ua,
    )


@router.get(
    "/{protocol_id}/versions",
    response_model=List[ProtocolVersionResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve audit version history of a protocol",
)
async def get_protocol_versions(
    protocol_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProtocolService(db)
    return await service.get_protocol_versions(protocol_id, current_user)


@router.get(
    "/{protocol_id}/download",
    summary="Download original protocol document file",
)
async def download_protocol(
    protocol_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProtocolService(db)
    content, filename, mime_type = await service.get_download_file(protocol_id, current_user)
    return Response(
        content=content,
        media_type=mime_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

