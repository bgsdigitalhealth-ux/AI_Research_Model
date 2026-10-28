import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin, utc_now


class SurveyResponse(Base, UUIDMixin, TimestampMixin):
    """
    Represents an authoritative research questionnaire response.
    `id` is the client-provided stable submission UUID (or server-generated UUID) serving as idempotency key.
    """
    __tablename__ = "survey_responses"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    questionnaire_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False, index=True
    )
    questionnaire_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("questionnaire_versions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    questionnaire_version: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    participant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("participants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    participant_identifier: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    consent_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("consent_records.id", ondelete="SET NULL"), nullable=True, index=True
    )
    invitation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("survey_invitations.id", ondelete="SET NULL"), nullable=True, index=True
    )

    status: Mapped[str] = mapped_column(String(50), default="completed", nullable=False, index=True)
    confirmation_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    sync_source: Mapped[str] = mapped_column(String(50), default="online", nullable=False)
    sync_batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("sync_batches.id", ondelete="SET NULL"), nullable=True, index=True
    )

    client_submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    server_received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    study: Mapped["Study"] = relationship("Study", back_populates="survey_responses")
    questionnaire: Mapped["Questionnaire"] = relationship("Questionnaire", back_populates="survey_responses")
    questionnaire_version_rel: Mapped[Optional["QuestionnaireVersion"]] = relationship("QuestionnaireVersion")
    participant: Mapped[Optional["Participant"]] = relationship("Participant", back_populates="responses")
    consent: Mapped[Optional["ConsentRecord"]] = relationship("ConsentRecord", back_populates="responses")
    invitation: Mapped[Optional["SurveyInvitation"]] = relationship("SurveyInvitation")
    sync_batch: Mapped[Optional["SyncBatch"]] = relationship("SyncBatch")

    answers: Mapped[List["SurveyResponseAnswer"]] = relationship(
        "SurveyResponseAnswer", back_populates="response", cascade="all, delete-orphan"
    )
    quality_issues: Mapped[List["DataQualityIssue"]] = relationship(
        "DataQualityIssue", back_populates="response", cascade="all, delete-orphan"
    )
    corrections: Mapped[List["ResponseCorrectionHistory"]] = relationship(
        "ResponseCorrectionHistory", back_populates="response", cascade="all, delete-orphan"
    )

