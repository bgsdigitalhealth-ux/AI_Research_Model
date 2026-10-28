import uuid
from typing import Optional
from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class StudyConfiguration(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "study_configurations"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    protocol_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("protocols.id", ondelete="SET NULL"), nullable=True, index=True
    )

    study_type: Mapped[str] = mapped_column(String(100), default="interventional", nullable=False)
    randomization_method: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    allocation_ratio: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    blinding_type: Mapped[str] = mapped_column(String(50), default="open_label", nullable=False)
    number_of_arms: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    primary_hypothesis: Mapped[str] = mapped_column(Text, default="", nullable=False)
    significance_alpha: Mapped[float] = mapped_column(Float, default=0.05, nullable=False)
    power_threshold: Mapped[float] = mapped_column(Float, default=0.80, nullable=False)
    planned_statistical_test: Mapped[str] = mapped_column(String(100), default="two_sample_t_test", nullable=False)
    missing_data_strategy: Mapped[str] = mapped_column(String(50), default="complete_case", nullable=False)

    subgroup_analyses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    interim_analyses_planned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    configured_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Relationships
    study: Mapped["Study"] = relationship("Study", back_populates="configuration")
    protocol: Mapped[Optional["Protocol"]] = relationship("Protocol")
    configured_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[configured_by_user_id])

