import uuid
from typing import Optional
from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class QuestionnaireSection(Base, TimestampMixin):
    __tablename__ = "questionnaire_sections"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    questionnaire_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    questionnaire: Mapped["Questionnaire"] = relationship("Questionnaire", back_populates="sections")
    questions: Mapped[list["QuestionItemModel"]] = relationship(
        "QuestionItemModel", back_populates="section", cascade="all, delete-orphan", order_by="QuestionItemModel.order"
    )
