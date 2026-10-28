import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class SurveyInvitation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "survey_invitations"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    questionnaire_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False, index=True
    )
    participant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("participants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    token_prefix: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    access_mode: Mapped[str] = mapped_column(String(50), default="invitation_only", nullable=False)
    max_uses: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    uses_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    # Relationships
    study: Mapped["Study"] = relationship("Study")
    questionnaire: Mapped["Questionnaire"] = relationship("Questionnaire", back_populates="invitations")
    participant: Mapped[Optional["Participant"]] = relationship("Participant")
    created_by: Mapped["User"] = relationship("User")

