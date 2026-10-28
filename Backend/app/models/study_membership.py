import uuid
from typing import Optional
from sqlalchemy import Boolean, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class StudyMembership(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "study_memberships"

    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("roles.id", ondelete="RESTRICT"), index=True, nullable=False
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    granted_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Composite Unique Constraint: A user can hold one active role per study
    __table_args__ = (
        UniqueConstraint("study_id", "user_id", name="uq_study_user_membership"),
    )

    # Relationships
    study: Mapped["Study"] = relationship("Study", back_populates="memberships")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="study_memberships")
    role: Mapped["Role"] = relationship("Role", back_populates="study_memberships")
    granted_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[granted_by_user_id])
