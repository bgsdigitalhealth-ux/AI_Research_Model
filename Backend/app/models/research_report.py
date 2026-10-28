import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON
from app.models.base import Base, TimestampMixin, UUIDMixin

JSONType = JSONB().with_variant(JSON(), "sqlite")


class ResearchReportModel(Base, UUIDMixin, TimestampMixin):
    """
    Persists structured clinical study reports, interim summaries, and manuscript drafts
    compiling approved protocol metadata and verified analytical run outputs.
    """
    __tablename__ = "research_reports"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="csr", nullable=False)
    version: Mapped[str] = mapped_column(String(50), default="1.0", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False, index=True)

    author_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    sections: Mapped[List[Dict[str, Any]]] = mapped_column(JSONType, default=list, nullable=False)
    approved_analysis_run_ids: Mapped[List[str]] = mapped_column(JSONType, default=list, nullable=False)
    protocol_version: Mapped[str] = mapped_column(String(50), default="1.0", nullable=False)
    dataset_snapshot_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("dataset_snapshots.id", ondelete="SET NULL"), nullable=True
    )
    summary_executive: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    study: Mapped["Study"] = relationship("Study")
    author: Mapped["User"] = relationship("User")
    dataset_snapshot: Mapped[Optional["DatasetSnapshot"]] = relationship("DatasetSnapshot")

