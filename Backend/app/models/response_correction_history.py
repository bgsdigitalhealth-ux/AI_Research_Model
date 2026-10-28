import uuid
from datetime import datetime
from typing import Any
from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin, utc_now


class ResponseCorrectionHistory(Base, UUIDMixin, TimestampMixin):
    """
    Maintains an immutable audit trail of all answer adjustments.
    Preserves original and corrected values with reasons and user attribution.
    """
    __tablename__ = "response_correction_history"

    response_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("survey_responses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[str] = mapped_column(String(100), nullable=False)
    variable_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    original_value: Mapped[Any] = mapped_column(JSON, nullable=True)
    corrected_value: Mapped[Any] = mapped_column(JSON, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    corrected_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    corrected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    response: Mapped["SurveyResponse"] = relationship("SurveyResponse", back_populates="corrections")
    corrected_by: Mapped["User"] = relationship("User")

