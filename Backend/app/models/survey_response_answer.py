import uuid
from typing import Any, Optional
from sqlalchemy import Boolean, ForeignKey, JSON, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class SurveyResponseAnswer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "survey_response_answers"

    response_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("survey_responses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    variable_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    raw_value: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    is_missing: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    response: Mapped["SurveyResponse"] = relationship("SurveyResponse", back_populates="answers")

