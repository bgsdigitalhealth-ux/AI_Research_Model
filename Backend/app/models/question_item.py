import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class QuestionItemModel(Base, TimestampMixin):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    questionnaire_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section_id: Mapped[Optional[str]] = mapped_column(
        String(100), ForeignKey("questionnaire_sections.id", ondelete="SET NULL"), nullable=True, index=True
    )
    variable_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Validation rules: { required, min, max, minLength, maxLength, regexPattern, customErrorMessage }
    validation: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    # Choices: [ { id, code, label, score } ]
    choices: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)
    # Conditional logic: { action, match, rules: [ { targetQuestionId, operator, value } ] }
    conditional_logic: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_by_researcher: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    target_objective_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    target_outcome_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    questionnaire: Mapped["Questionnaire"] = relationship("Questionnaire", back_populates="questions")
    section: Mapped[Optional["QuestionnaireSection"]] = relationship("QuestionnaireSection", back_populates="questions")
