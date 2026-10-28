import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import require_role
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.schemas.common import StandardResponse
from app.schemas.audit import AuditEventResponse

router = APIRouter(prefix="/audit", tags=["Security & Compliance Audit Trail"])


@router.get(
    "",
    response_model=StandardResponse[List[AuditEventResponse]],
    status_code=status.HTTP_200_OK,
    summary="Query security, authentication, and governance audit logs",
)
async def list_audit_events(
    user_id: Optional[uuid.UUID] = Query(None),
    study_id: Optional[uuid.UUID] = Query(None),
    event_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_role("administrator")),
    db: AsyncSession = Depends(get_db),
):
    audit_repo = AuditRepository(db)
    events = await audit_repo.list_events(
        user_id=user_id,
        study_id=study_id,
        event_type=event_type,
        skip=skip,
        limit=limit,
    )
    return StandardResponse(
        success=True,
        message=f"Retrieved {len(events)} audit events",
        data=[AuditEventResponse.model_validate(e) for e in events],
    )
