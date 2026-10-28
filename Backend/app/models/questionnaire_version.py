import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class QuestionnaireVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "questionnaire_versions"

    questionnaire_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False, index=True
    )
    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="published", nullable=False)

    # Full immutable snapshot of sections, questions, and mappings at publication time
    schema_snapshot: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    change_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    question_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    published_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    questionnaire: Mapped["Questionnaire"] = relationship("Questionnaire", back_populates="versions")
    study: Mapped["Study"] = relationship("Study")
    published_by: Mapped["User"] = relationship("User", foreign_keys=[published_by_user_id])

