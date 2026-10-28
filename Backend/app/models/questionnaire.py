import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class Questionnaire(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "questionnaires"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    protocol_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("protocols.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[str] = mapped_column(String(50), default="1.0", nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False, index=True)

    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_generation_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    scientific_validation_claim: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_published_immutable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    approved_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    published_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Relationships
    study: Mapped["Study"] = relationship("Study", back_populates="questionnaires")
    protocol: Mapped[Optional["Protocol"]] = relationship("Protocol")
    sections: Mapped[List["QuestionnaireSection"]] = relationship(
        "QuestionnaireSection",
        back_populates="questionnaire",
        cascade="all, delete-orphan",
        order_by="QuestionnaireSection.order",
    )
    questions: Mapped[List["QuestionItemModel"]] = relationship(
        "QuestionItemModel",
        back_populates="questionnaire",
        cascade="all, delete-orphan",
        order_by="QuestionItemModel.order",
    )
    mappings: Mapped[List["QuestionnaireMapping"]] = relationship(
        "QuestionnaireMapping",
        back_populates="questionnaire",
        cascade="all, delete-orphan",
    )
    versions: Mapped[List["QuestionnaireVersion"]] = relationship(
        "QuestionnaireVersion",
        back_populates="questionnaire",
        cascade="all, delete-orphan",
        order_by="QuestionnaireVersion.created_at.desc()",
    )
    consent_records: Mapped[List["ConsentRecord"]] = relationship(
        "ConsentRecord", back_populates="questionnaire", cascade="all, delete-orphan"
    )
    invitations: Mapped[List["SurveyInvitation"]] = relationship(
        "SurveyInvitation", back_populates="questionnaire", cascade="all, delete-orphan"
    )
    survey_responses: Mapped[List["SurveyResponse"]] = relationship(
        "SurveyResponse", back_populates="questionnaire", cascade="all, delete-orphan"
    )
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_user_id])
    approved_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by_user_id])
    published_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[published_by_user_id])

