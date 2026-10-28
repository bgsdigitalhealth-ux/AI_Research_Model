import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class DataQualityIssue(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "data_quality_issues"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    response_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("survey_responses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    variable_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    issue_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # Types: "missing_required", "range_violation", "type_mismatch", "invalid_choice", "duplicate_submission", "suspect_outlier"

    severity: Mapped[str] = mapped_column(String(50), default="medium", nullable=False)
    # Severity: "low", "medium", "high", "critical"

    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="open", nullable=False, index=True)
    # Status: "open", "under_review", "resolved", "dismissed"

    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    study: Mapped["Study"] = relationship("Study", back_populates="data_quality_issues")
    response: Mapped["SurveyResponse"] = relationship("SurveyResponse", back_populates="quality_issues")
    resolved_by: Mapped[Optional["User"]] = relationship("User")

