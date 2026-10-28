import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON
from app.models.base import Base, TimestampMixin, UUIDMixin, utc_now

JSONType = JSONB().with_variant(JSON(), "sqlite")


class DatasetSnapshot(Base, UUIDMixin, TimestampMixin):
    """
    Represents an immutable, cryptographically checksummed dataset frozen for analysis.
    Preserves exact variable dictionary, values, and cleaning provenance.
    """
    __tablename__ = "dataset_snapshots"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    questionnaire_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("questionnaires.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    questionnaire_version: Mapped[str] = mapped_column(String(50), nullable=False, default="1.0")
    record_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    variable_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_frozen: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    frozen_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    frozen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    data_quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Serialized structures
    variable_dictionary: Mapped[List[Dict[str, Any]]] = mapped_column(JSONType, default=list, nullable=False)
    dataset_payload: Mapped[List[Dict[str, Any]]] = mapped_column(JSONType, default=list, nullable=False)
    provenance_metadata: Mapped[Dict[str, Any]] = mapped_column(JSONType, default=dict, nullable=False)

    # Relationships
    study: Mapped["Study"] = relationship("Study")
    frozen_by: Mapped[Optional["User"]] = relationship("User")
    analysis_runs: Mapped[List["AnalysisRun"]] = relationship(
        "AnalysisRun", back_populates="dataset_snapshot", cascade="all, delete-orphan"
    )

