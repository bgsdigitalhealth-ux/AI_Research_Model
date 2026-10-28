import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON
from app.models.base import Base, TimestampMixin, UUIDMixin

JSONType = JSONB().with_variant(JSON(), "sqlite")


class ExportJobModel(Base, UUIDMixin, TimestampMixin):
    """
    Tracks asynchronous and synchronous data/report export jobs with de-identification enforcement.
    """
    __tablename__ = "export_jobs"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    format: Mapped[str] = mapped_column(String(20), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False, index=True)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    de_identified_confirmed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    governance_notice: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    options: Mapped[Dict[str, Any]] = mapped_column(JSONType, default=dict, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    study: Mapped["Study"] = relationship("Study")
    requested_by: Mapped["User"] = relationship("User")

