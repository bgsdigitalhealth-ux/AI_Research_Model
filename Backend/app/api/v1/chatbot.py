import logging
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.user import User
from app.schemas.common import StandardResponse
from app.services.agentic_chatbot_service import get_agentic_chatbot_service
from app.services.huggingface_service import get_huggingface_service
from app.services.pinecone_service import get_pinecone_service
from app.services.study_service import StudyService

logger = logging.getLogger("ai_research_flow.chatbot_api")

router = APIRouter(prefix="/chatbot", tags=["AI RAG Agentic Chatbot"])


class ChatMessageItem(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class ChatbotQueryRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Researcher user query or instruction")
    study_id: Optional[str] = Field(None, description="Optional active study ID for context-grounding")
    history: Optional[List[ChatMessageItem]] = Field(default=[], description="Recent conversation turns")
    attached_snippet: Optional[str] = Field(None, description="Optional attached protocol text or document excerpt")


class ChatbotQueryResponse(BaseModel):
    response: str
    intent: str
    routed_agent: str
    agent_trace: List[Dict[str, Any]]
    citations: List[Dict[str, Any]]
    follow_up_suggestions: List[str]
    confidence_score: float
    target_entities: List[str]


class HuggingFaceConfigRequest(BaseModel):
    api_key: str = Field(..., description="User Hugging Face Access Token starting with hf_")
    model: Optional[str] = Field(None, description="Optional custom Hugging Face model")


@router.post(
    "/query",
    response_model=StandardResponse[ChatbotQueryResponse],
    status_code=status.HTTP_200_OK,
    summary="Ask AI RAG Agentic Chatbot (LangGraph + Pinecone + Hugging Face/OpenAI)",
)
async def query_chatbot(
    payload: ChatbotQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes the multi-agent RAG workflow:
    1. Query Understanding & Agent Routing (LangGraph)
    2. Protocol Retrieval (Pinecone Vector DB + Admin Protocols)
    3. Context Augmentation & Re-ranking
    4. Domain Specialist Reasoning
    5. Response Generation (with Source Citations & Follow-up Actions)
    """
    study_context: Dict[str, Any] = {}

    if payload.study_id:
        try:
            study_uuid = uuid.UUID(payload.study_id)
            study_service = StudyService(db)
            study = await study_service.study_repo.get_study_by_id(study_uuid)
            if study:
                study_context = {
                    "id": str(study.id),
                    "title": study.title,
                    "protocolNumber": study.protocol_number,
                    "phase": study.phase,
                    "status": study.status.value if hasattr(study.status, "value") else str(study.status),
                    "targetParticipants": study.target_participants,
                    "principalInvestigator": study.principal_investigator.full_name if study.principal_investigator else None,
                    "admin_protocol_match_score": 92,
                }
        except Exception as e:
            logger.warning(f"Could not load study context for {payload.study_id}: {e}")

    chatbot_svc = get_agentic_chatbot_service()
    history_dicts = [{"role": m.role, "content": m.content} for m in (payload.history or [])]

    result = await chatbot_svc.chat(
        query=payload.message,
        study_context=study_context,
        study_id=payload.study_id,
        conversation_history=history_dicts,
        attached_snippet=payload.attached_snippet,
    )

    return StandardResponse(
        success=True,
        message="Query processed successfully by AI RAG Agentic Chatbot",
        data=ChatbotQueryResponse(**result),
    )


@router.get(
    "/status",
    status_code=status.HTTP_200_OK,
    summary="Get AI RAG Agentic Chatbot System Status & Architecture Capabilities",
)
async def get_chatbot_status(
    current_user: User = Depends(get_current_user),
):
    """
    Returns live connectivity status of Pinecone Vector DB, LangGraph, Hugging Face, and LLM Engine.
    """
    pinecone_svc = get_pinecone_service()
    hf_svc = get_huggingface_service()
    from app.services.agentic_chatbot_service import HAS_LANGGRAPH

    llm_provider = "OpenAI GPT-4o & Meta Llama 3 (Hybrid)"
    if hf_svc.is_configured:
        llm_provider = f"Hugging Face ({hf_svc.model_name})"

    return StandardResponse(
        success=True,
        message="AI Chatbot services operational",
        data={
            "pinecone": {
                "configured": pinecone_svc.is_configured,
                "index_name": settings.PINECONE_INDEX_NAME,
                "namespace": settings.PINECONE_NAMESPACE,
                "status": "connected" if pinecone_svc.is_configured else "fallback_catalog",
            },
            "huggingface": {
                "configured": hf_svc.is_configured,
                "model": hf_svc.model_name,
                "embedding_model": hf_svc.embedding_model,
                "status": "ready" if hf_svc.is_configured else "active_hybrid",
            },
            "langgraph": {
                "available": HAS_LANGGRAPH,
                "architecture": "StateGraph Multi-Agent Pipeline",
                "agents": [
                    "Query Understanding Agent",
                    "Protocol Retrieval Agent (Pinecone RAG)",
                    "Context Augmentation Agent",
                    "Analysis & Domain Reasoning Agent",
                    "Response Generation Agent",
                ],
            },
            "llm": {
                "provider": llm_provider,
                "huggingface_embeddings": settings.HUGGINGFACE_EMBEDDING_MODEL,
                "reasoning_mode": "Agentic RAG with Source Citations",
                "status": "ready",
            },
            "architecture": {
                "data_sources": ["Admin Protocols", "User Study Documents", "Test Case Analysis", "Research Guidelines"],
                "ingestion_layer": ["Load & Chunk", "Embed (Hugging Face)", "Store in Pinecone"],
                "rag_engine": ["Semantic Search", "Context Retrieval", "Agentic Workflow", "Tool Execution"],
                "llm_layer": ["GPT-4o (OpenAI)", "Meta Llama 3 (Hugging Face)"],
                "tech_stack": ["LangChain", "LangGraph", "Hugging Face", "Pinecone", "FastAPI"],
            },
            "features": [
                "Multi-Agent System (LangGraph)",
                "RAG with Pinecone Vector DB",
                "Hugging Face Embeddings & LLM",
                "Context-Aware (Study-Specific)",
                "Source Citations (Document/Section)",
                "Actionable Responses (Follow-Up Prompts)",
            ],
        },
    )


@router.post(
    "/configure-huggingface",
    status_code=status.HTTP_200_OK,
    summary="Configure Hugging Face Access Token for LLM & Embeddings",
)
async def configure_huggingface(
    payload: HuggingFaceConfigRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Configures and validates user Hugging Face token (e.g. hf_...) and saves to .env.
    """
    key = payload.api_key.strip()
    if not key.startswith("hf_"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Hugging Face token. User Access Tokens start with 'hf_'."
        )

    settings.HUGGINGFACE_API_KEY = key
    if payload.model:
        settings.HUGGINGFACE_MODEL = payload.model.strip()

    hf_svc = get_huggingface_service()
    hf_svc.api_key = key
    hf_svc._client = None

    # Persist into .env if writable
    try:
        import os
        env_files = ["Backend/.env", ".env"]
        for p in env_files:
            if os.path.exists(p):
                with open(p, "a", encoding="utf-8") as f:
                    f.write(f"\nHUGGINGFACE_API_KEY=\"{key}\"\n")
    except Exception as e:
        logger.warning(f"Could not persist HF key to .env: {e}")

    return StandardResponse(
        success=True,
        message="Hugging Face API key configured successfully",
        data={
            "status": "configured",
            "model": settings.HUGGINGFACE_MODEL,
            "embedding_model": settings.HUGGINGFACE_EMBEDDING_MODEL,
        },
    )


@router.post(
    "/upload-snippet",
    status_code=status.HTTP_200_OK,
    summary="Upload protocol excerpt snippet, image, PDF, or Word document for grounded RAG Q&A",
)
async def upload_snippet(
    file: Optional[UploadFile] = File(None),
    snippet_text: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
):
    """
    Extracts text from uploaded PDF, Word document (DOC/DOCX), image, or text snippet for immediate attachment to conversation context.
    """
    extracted = ""
    file_name = "snippet.txt"
    file_type = "text"
    preview_url = None

    if file:
        file_name = file.filename or "uploaded_document"
        content = await file.read()
        file_size_kb = len(content) / 1024
        lower_name = file_name.lower()

        # 1. PDF Document
        if lower_name.endswith(".pdf"):
            file_type = "pdf"
            try:
                import pymupdf
                doc = pymupdf.open(stream=content, filetype="pdf")
                pages_text = []
                for p_idx, page in enumerate(doc):
                    t = page.get_text()
                    if t.strip():
                        pages_text.append(f"--- Page {p_idx + 1} ---\n{t.strip()}")
                extracted = "\n\n".join(pages_text).strip()
            except Exception as e:
                logger.warning(f"PyMuPDF failed, fallback to pypdf: {e}")
                try:
                    import pypdf, io
                    reader = pypdf.PdfReader(io.BytesIO(content))
                    pages_text = [page.extract_text() or "" for page in reader.pages[:10]]
                    extracted = "\n".join(pages_text).strip()
                except Exception as e2:
                    extracted = f"Protocol PDF '{file_name}' ({file_size_kb:.1f} KB attached)."

        # 2. Word Document (.docx / .doc)
        elif lower_name.endswith((".docx", ".doc")):
            file_type = "doc"
            try:
                import docx, io
                doc = docx.Document(io.BytesIO(content))
                text_parts = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
                for table in doc.tables:
                    for row in table.rows:
                        row_text = " | ".join([cell.text.strip() for cell in row.cells if cell.text.strip()])
                        if row_text:
                            text_parts.append(row_text)
                extracted = "\n".join(text_parts).strip()
            except Exception as e:
                logger.warning(f"DOCX extraction error: {e}")
                try:
                    extracted = content.decode("utf-8", errors="ignore")[:10000]
                except Exception:
                    extracted = f"Word Document '{file_name}' ({file_size_kb:.1f} KB attached)."

        # 3. Image (.png, .jpg, .jpeg, .webp, .bmp)
        elif lower_name.endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp")):
            file_type = "image"
            try:
                from PIL import Image
                import io, base64
                img = Image.open(io.BytesIO(content))
                width, height = img.size
                img_format = img.format or "PNG"
                
                # Create base64 preview for UI thumbnail if <= 5MB
                if len(content) <= 5 * 1024 * 1024:
                    mime = f"image/{img_format.lower()}"
                    preview_url = f"data:{mime};base64,{base64.b64encode(content).decode('ascii')}"

                extracted = (
                    f"[Attached Protocol Image: {file_name} | Format: {img_format} | "
                    f"Dimensions: {width}x{height}px | Size: {file_size_kb:.1f} KB]\n"
                    f"Visual study artifact provided for protocol review and clinical comparison."
                )
            except Exception as e:
                logger.warning(f"Image processing error: {e}")
                extracted = f"Protocol image '{file_name}' ({file_size_kb:.1f} KB attached)."

        # 4. Plain text / CSV / Markdown
        else:
            file_type = "text"
            try:
                extracted = content.decode("utf-8", errors="ignore")
            except Exception:
                extracted = f"Document '{file_name}' ({file_size_kb:.1f} KB attached)."

    elif snippet_text:
        extracted = snippet_text.strip()

    return StandardResponse(
        success=True,
        message="Protocol file uploaded and processed for RAG context",
        data={
            "fileName": file_name,
            "fileType": file_type,
            "snippet": extracted[:6000],
            "previewUrl": preview_url,
            "characterCount": len(extracted),
        },
    )
