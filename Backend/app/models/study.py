import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class Study(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "studies"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    protocol_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False, index=True)
    phase: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    principal_investigator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True
    )

    target_participants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    enrolled_participants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completion_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Governance and Consent Controls
    governance_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    governance_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    irb_approval_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    irb_approval_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    consent_framework_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Approved Research Specifications
    design_family: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    research_aims: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    eligibility_criteria: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    primary_outcomes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    secondary_outcomes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    variables_spec: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    recruitment_target: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    planned_analyses: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Relationships
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_user_id])
    principal_investigator: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[principal_investigator_id]
    )
    organization: Mapped[Optional["Organization"]] = relationship("Organization")
    memberships: Mapped[List["StudyMembership"]] = relationship(
        "StudyMembership", back_populates="study", cascade="all, delete-orphan"
    )
    protocols: Mapped[List["Protocol"]] = relationship(
        "Protocol", back_populates="study", cascade="all, delete-orphan", order_by="Protocol.created_at.desc()"
    )
    configuration: Mapped[Optional["StudyConfiguration"]] = relationship(
        "StudyConfiguration", back_populates="study", uselist=False, cascade="all, delete-orphan"
    )
    questionnaires: Mapped[List["Questionnaire"]] = relationship(
        "Questionnaire", back_populates="study", cascade="all, delete-orphan", order_by="Questionnaire.created_at.desc()"
    )
    participants: Mapped[List["Participant"]] = relationship(
        "Participant", back_populates="study", cascade="all, delete-orphan", order_by="Participant.created_at.desc()"
    )
    consent_records: Mapped[List["ConsentRecord"]] = relationship(
        "ConsentRecord", back_populates="study", cascade="all, delete-orphan"
    )
    survey_responses: Mapped[List["SurveyResponse"]] = relationship(
        "SurveyResponse", back_populates="study", cascade="all, delete-orphan", order_by="SurveyResponse.created_at.desc()"
    )
    data_quality_issues: Mapped[List["DataQualityIssue"]] = relationship(
        "DataQualityIssue", back_populates="study", cascade="all, delete-orphan", order_by="DataQualityIssue.created_at.desc()"
    )

