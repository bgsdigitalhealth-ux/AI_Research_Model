import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin, utc_now


class ConsentRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "consent_records"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    questionnaire_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False, index=True
    )
    questionnaire_version: Mapped[str] = mapped_column(String(50), nullable=False)
    participant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("participants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    participant_identifier: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    agreed_to_participate: Mapped[bool] = mapped_column(Boolean, nullable=False)
    agreed_to_data_storage: Mapped[bool] = mapped_column(Boolean, nullable=False)
    agreed_to_contact: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    agreed_statements: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    wording_version: Mapped[str] = mapped_column(String(100), nullable=False)
    consent_text_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    confirmation_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False, index=True)
    withdrawn_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    withdrawal_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    study: Mapped["Study"] = relationship("Study", back_populates="consent_records")
    questionnaire: Mapped["Questionnaire"] = relationship("Questionnaire", back_populates="consent_records")
    participant: Mapped[Optional["Participant"]] = relationship("Participant", back_populates="consent_records")
    responses: Mapped[List["SurveyResponse"]] = relationship("SurveyResponse", back_populates="consent")

