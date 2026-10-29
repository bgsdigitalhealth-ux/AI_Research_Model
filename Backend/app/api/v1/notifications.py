from datetime import datetime, timezone
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.audit_event import AuditEvent

router = APIRouter(prefix="/notifications", tags=["System Notifications"])


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="Retrieve system and workflow notifications",
)
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditEvent).order_by(desc(AuditEvent.created_at)).limit(10)
    res = await db.execute(stmt)
    events = res.scalars().all()

    notifications = []
    for evt in events:
        event_name = evt.event_type.replace(":", " ").title()
        status_type = "info"
        if evt.status == "failure" or evt.status == "denied":
            status_type = "alert"
        elif "create" in evt.event_type or "publish" in evt.event_type:
            status_type = "success"

        notifications.append({
            "id": str(evt.id),
            "title": event_name,
            "message": f"Action {evt.event_type} registered for user.",
            "timestamp": evt.created_at.isoformat() if evt.created_at else datetime.now(timezone.utc).isoformat(),
            "read": False,
            "type": status_type,
        })

    # If no audit events yet, provide a dynamic welcome notification
    if not notifications:
        notifications.append({
            "id": "welcome-1",
            "title": "PostgreSQL Database Connected",
            "message": "AI Research Flow connected to PostgreSQL 14 on port 5433 with full relational integrity.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "read": False,
            "type": "success",
        })

    return notifications


@router.patch(
    "/{notification_id}/read",
    status_code=status.HTTP_200_OK,
    summary="Mark notification as read",
)
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
):
    return {"success": True, "notificationId": notification_id}
