import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class ProtocolExtraction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "protocol_extractions"

    protocol_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("protocols.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(50), default="not_started", nullable=False, index=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    provider_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    model_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    prompt_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    processing_duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    extracted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    is_fully_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Relationships
    protocol: Mapped["Protocol"] = relationship("Protocol", back_populates="extraction")
    verified_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[verified_by_user_id])
    fields: Mapped[List["ExtractedFieldItem"]] = relationship(
        "ExtractedFieldItem", back_populates="extraction", cascade="all, delete-orphan", order_by="ExtractedFieldItem.field_key"
    )

