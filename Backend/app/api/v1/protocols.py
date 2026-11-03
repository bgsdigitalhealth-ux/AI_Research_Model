from pydantic import BaseModel
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



class ProtocolRagVerifyRequest(BaseModel):
    study_title: str
    description: str
    protocol_type: str = "Clinical Protocol"
    protocol_text: Optional[str] = None
    file_name: Optional[str] = None
    file_size_bytes: Optional[int] = None


class CompleteStudyFlowRequest(BaseModel):
    study_title: str
    description: str
    protocol_type: str = "Clinical Protocol"
    file_name: Optional[str] = "protocol.pdf"
    file_size_bytes: Optional[int] = 1024 * 1024
    test_case_analysis: Optional[Dict[str, Any]] = None
    generated_questions: Optional[List[Dict[str, Any]]] = None


@router.post(
    "/rag-verify",
    status_code=status.HTTP_200_OK,
    summary="Semantic RAG verification of protocol against Admin standard protocols",
)
async def verify_protocol_rag(
    payload: ProtocolRagVerifyRequest,
    current_user: User = Depends(get_current_user),
):
    from app.services.protocol_rag_service import get_protocol_rag_service

    svc = get_protocol_rag_service()
    return await svc.verify_protocol(
        study_title=payload.study_title,
        description=payload.description,
        protocol_type=payload.protocol_type,
        protocol_text=payload.protocol_text,
        file_name=payload.file_name,
    )


@router.post(
    "/complete-study-flow",
    status_code=status.HTTP_201_CREATED,
    summary="Complete multi-step study creation, protocol persistence, and question generation",
)
async def complete_study_flow(
    payload: CompleteStudyFlowRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import hashlib
    from app.models.study import Study
    from app.models.protocol import Protocol
    from app.models.questionnaire import Questionnaire, QuestionnaireSection, QuestionItem

    # 1. Create Study
    hex_id = uuid.uuid4().hex[:6].upper()
    proto_num = f"PROTO-2026-{hex_id}"
    study = Study(
        title=payload.study_title,
        protocol_number=proto_num,
        description=payload.description,
        status="active",
        phase="Phase II",
        created_by_user_id=current_user.id,
        principal_investigator_id=current_user.id,
        target_participants=100,
        research_aims={"test_case_analysis": payload.test_case_analysis} if payload.test_case_analysis else None,
    )
    db.add(study)
    await db.flush()

    # 2. Create Protocol
    dummy_checksum = hashlib.sha256(payload.study_title.encode()).hexdigest()
    protocol = Protocol(
        study_id=study.id,
        title=f"{payload.study_title} Protocol",
        version="1.0",
        version_number=1,
        status="approved",
        file_name=payload.file_name or "protocol.pdf",
        file_path=f"uploads/protocols/{study.id}/{payload.file_name or 'protocol.pdf'}",
        file_size_bytes=payload.file_size_bytes or 1024 * 1024,
        file_type="application/pdf",
        checksum_sha256=dummy_checksum,
        uploaded_by_user_id=current_user.id,
        extraction_status="completed",
        summary_notes=payload.description,
    )
    db.add(protocol)
    await db.flush()

    # 3. Create Questionnaire if questions provided
    q_id = None
    if payload.generated_questions:
        q = Questionnaire(
            study_id=study.id,
            protocol_id=protocol.id,
            title=f"{payload.study_title} Protocol Assessment",
            description=f"AI Generated Questions based on verified protocol for {payload.study_title}.",
            version="1.0",
            version_number=1,
            status="draft",
            is_ai_generated=True,
            created_by_user_id=current_user.id,
            scientific_validation_claim="Candidate AI questionnaire draft synthesized from verified protocol.",
        )
        db.add(q)
        await db.flush()
        q_id = str(q.id)

        # Add default section
        sec_id = f"{q.id.hex[:8]}_sec_1"
        sec = QuestionnaireSection(
            id=sec_id,
            questionnaire_id=q.id,
            title="Protocol Assessment Questions",
            order=0,
        )
        db.add(sec)
        await db.flush()

        for idx, item in enumerate(payload.generated_questions):
            q_item_id = f"{q.id.hex[:8]}_q_{idx + 1}"
            qi = QuestionItem(
                id=q_item_id,
                questionnaire_id=q.id,
                section_id=sec_id,
                variable_name=f"proto_q_{idx + 1}",
                type="single_choice",
                text=item.get("text", f"Question {idx + 1}"),
                explanation=item.get("explanation"),
                remark=item.get("remark"),
                order=idx,
                choices=item.get("choices") or [
                    {"code": "a", "label": "a) Yes / Compliant", "score": 1.0},
                    {"code": "b", "label": "b) No / Non-compliant", "score": 0.0},
                    {"code": "c", "label": "c) Not Applicable", "score": 0.0},
                ],
                is_ai_generated=True,
                verified_by_researcher=False,
            )
            db.add(qi)

    await db.commit()

    return {
        "success": True,
        "study_id": str(study.id),
        "protocol_id": str(protocol.id),
        "questionnaire_id": q_id,
        "study_title": study.title,
        "protocol_number": study.protocol_number,
        "message": "Study created successfully with verified protocol and generated questions.",
    }


class ProtocolQuestionGenRequest(BaseModel):
    study_title: str
    description: str
    protocol_type: Optional[str] = "Clinical Protocol"
    protocol_text: Optional[str] = None
    count: Optional[int] = 5


@router.post(
    "/generate-questions-from-protocol",
    status_code=status.HTTP_200_OK,
    summary="Dynamically synthesize assessment questions based on clinical protocol",
)
async def generate_questions_from_protocol(
    payload: ProtocolQuestionGenRequest,
    current_user: User = Depends(get_current_user),
):
    from app.services.protocol_rag_service import get_protocol_rag_service

    svc = get_protocol_rag_service()
    questions = await svc.generate_more_questions(
        study_title=payload.study_title,
        description=payload.description,
        protocol_type=payload.protocol_type or "Clinical Protocol",
        protocol_text=payload.protocol_text,
        count=payload.count or 5,
    )
    return {"questions": questions}
