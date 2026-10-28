import uuid
from typing import Any, Dict, Optional
from sqlalchemy import ForeignKey, Integer, JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class SyncBatch(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "sync_batches"

    study_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="SET NULL"), nullable=True, index=True
    )
    submitted_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    total_items: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    accepted_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rejected_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    conflict_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    results_summary: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    study: Mapped[Optional["Study"]] = relationship("Study")
    submitted_by: Mapped[Optional["User"]] = relationship("User")

