import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON
from app.models.base import Base, TimestampMixin, UUIDMixin, utc_now

JSONType = JSONB().with_variant(JSON(), "sqlite")


class StatisticalResultModel(Base, UUIDMixin, TimestampMixin):
    """
    Stores authoritatively computed numerical estimates, test statistics, degrees of freedom,
    p-values, confidence intervals, effect sizes, and diagnostic assumption evaluations.
    """
    __tablename__ = "statistical_results"

    run_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("analysis_runs.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dataset_snapshot_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("dataset_snapshots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    method_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    excluded_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    missingness_handled: Mapped[str] = mapped_column(String(50), default="complete_case", nullable=False)

    degrees_of_freedom: Mapped[Optional[Any]] = mapped_column(JSONType, nullable=True)
    test_statistic: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONType, nullable=True)
    p_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    effect_size: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONType, nullable=True)
    confidence_interval: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONType, nullable=True)
    estimates_table: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONType, nullable=True)
    assumption_warnings: Mapped[List[Dict[str, Any]]] = mapped_column(JSONType, default=list, nullable=False)
    distribution_data: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONType, nullable=True)
    scatter_plot_data: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONType, nullable=True)
    survival_data: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONType, nullable=True)
    ai_explanation: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONType, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    analysis_run: Mapped["AnalysisRun"] = relationship("AnalysisRun", back_populates="statistical_result")

