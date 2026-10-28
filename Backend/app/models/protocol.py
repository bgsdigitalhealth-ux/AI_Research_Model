import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class Protocol(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "protocols"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(50), default="1.0", nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False, index=True)

    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # IRB Governance & Approval
    irb_approval_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    approval_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    approval_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Immutability and Version Tracking
    is_latest: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_approved_immutable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # AI Extraction Lifecycle Status
    extraction_status: Mapped[str] = mapped_column(String(50), default="not_started", nullable=False, index=True)
    extraction_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    extracted_raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    study: Mapped["Study"] = relationship("Study", back_populates="protocols")
    uploaded_by: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by_user_id])
    approved_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by_user_id])
    extraction: Mapped[Optional["ProtocolExtraction"]] = relationship(
        "ProtocolExtraction", back_populates="protocol", uselist=False, cascade="all, delete-orphan"
    )
    versions: Mapped[List["ProtocolVersion"]] = relationship(
        "ProtocolVersion", back_populates="protocol", cascade="all, delete-orphan", order_by="ProtocolVersion.created_at.desc()"
    )

