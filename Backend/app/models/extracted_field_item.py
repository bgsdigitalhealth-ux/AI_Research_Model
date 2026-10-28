import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, JSON, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class ExtractedFieldItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "extracted_field_items"

    extraction_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("protocol_extractions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    field_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)

    ai_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    verified_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="unreviewed", nullable=False, index=True)

    uncertainty: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_missing: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Source Evidence
    evidence: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    reviewer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    flag_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    verified_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Composite Unique Constraint: One field_key per extraction
    __table_args__ = (
        UniqueConstraint("extraction_id", "field_key", name="uq_extraction_field_key"),
    )

    # Relationships
    extraction: Mapped["ProtocolExtraction"] = relationship("ProtocolExtraction", back_populates="fields")
    verified_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[verified_by_user_id])

