import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_event import AuditEvent
from app.repositories.base import BaseRepository


class AuditRepository(BaseRepository[AuditEvent]):
    def __init__(self, session: AsyncSession):
        super().__init__(AuditEvent, session)

    async def log_event(
        self,
        event_type: Optional[str] = None,
        status: str = "success",
        user_id: Optional[uuid.UUID] = None,
        study_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        **kwargs: Any,
    ) -> AuditEvent:
        evt_type = event_type or action or "system:event"
        clean_details = dict(details or {})
        if entity_type:
            clean_details["entity_type"] = entity_type
        if entity_id:
            clean_details["entity_id"] = entity_id

        # Scrub any accidental secrets from details dict
        for key in list(clean_details.keys()):
            if any(s in key.lower() for s in ["password", "token", "secret", "cookie", "authorization"]):
                clean_details[key] = "[REDACTED]"

        event = AuditEvent(
            event_type=evt_type,
            status=status,
            user_id=user_id,
            study_id=study_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=clean_details,
        )
        self.session.add(event)
        await self.session.flush()
        return event

    async def list_events(
        self,
        user_id: Optional[uuid.UUID] = None,
        study_id: Optional[uuid.UUID] = None,
        event_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[AuditEvent]:
        stmt = select(AuditEvent)
        if user_id:
            stmt = stmt.where(AuditEvent.user_id == user_id)
        if study_id:
            stmt = stmt.where(AuditEvent.study_id == study_id)
        if event_type:
            stmt = stmt.where(AuditEvent.event_type == event_type)

        stmt = stmt.order_by(AuditEvent.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
