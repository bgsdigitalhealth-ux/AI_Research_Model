import uuid
from typing import List, Optional
from sqlalchemy import Boolean, ForeignKey, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class QuestionnaireMapping(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "questionnaire_mappings"

    questionnaire_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False, index=True
    )
    objective_id: Mapped[str] = mapped_column(String(100), nullable=False)
    objective_title: Mapped[str] = mapped_column(String(255), nullable=False)
    outcome_name: Mapped[str] = mapped_column(String(255), nullable=False)
    covered_question_ids: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    is_covered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    coverage_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    questionnaire: Mapped["Questionnaire"] = relationship("Questionnaire", back_populates="mappings")

