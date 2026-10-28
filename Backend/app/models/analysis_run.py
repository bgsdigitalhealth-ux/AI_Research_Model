import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON
from app.models.base import Base, TimestampMixin, UUIDMixin, utc_now

JSONType = JSONB().with_variant(JSON(), "sqlite")


class AnalysisRun(Base, UUIDMixin, TimestampMixin):
    """
    Represents an independently validated statistical analysis execution run.
    Guarantees isolation and records software runtime versions and snapshot checksum.
    """
    __tablename__ = "analysis_runs"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dataset_snapshot_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("dataset_snapshots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    method_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    config: Mapped[Dict[str, Any]] = mapped_column(JSONType, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False, index=True)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status_message: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    executed_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    runtime_versions: Mapped[Dict[str, Any]] = mapped_column(JSONType, default=dict, nullable=False)
    snapshot_checksum: Mapped[str] = mapped_column(String(64), nullable=False)

    # Relationships
    study: Mapped["Study"] = relationship("Study")
    dataset_snapshot: Mapped["DatasetSnapshot"] = relationship("DatasetSnapshot", back_populates="analysis_runs")
    executed_by: Mapped["User"] = relationship("User")
    statistical_result: Mapped[Optional["StatisticalResultModel"]] = relationship(
        "StatisticalResultModel", back_populates="analysis_run", uselist=False, cascade="all, delete-orphan"
    )

