import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin, utc_now


class Participant(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "participants"
    __table_args__ = (
        UniqueConstraint("study_id", "identifier_code", name="uq_study_participant_code"),
    )

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    identifier_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="enrolled", nullable=False, index=True)
    enrollment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    cohort: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    site_location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    withdrawn_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    withdrawal_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    study: Mapped["Study"] = relationship("Study", back_populates="participants")
    identity_mapping: Mapped[Optional["ParticipantIdentityMapping"]] = relationship(
        "ParticipantIdentityMapping", back_populates="participant", uselist=False, cascade="all, delete-orphan"
    )
    consent_records: Mapped[List["ConsentRecord"]] = relationship(
        "ConsentRecord", back_populates="participant", cascade="all, delete-orphan"
    )
    responses: Mapped[List["SurveyResponse"]] = relationship(
        "SurveyResponse", back_populates="participant"
    )


class ParticipantIdentityMapping(Base, UUIDMixin, TimestampMixin):
    """
    Separates PII / identity mapping from routine research analysis data.
    Only authorized investigators or administrative workflows can access this table.
    """
    __tablename__ = "participant_identity_mappings"

    participant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    encrypted_identity_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    external_mrn: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    participant: Mapped["Participant"] = relationship("Participant", back_populates="identity_mapping")

