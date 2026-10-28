from typing import Any, List
from sqlalchemy import Boolean, DateTime, String, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, utc_now


class Role(Base, UUIDMixin):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    permissions: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="global_role")
    study_memberships: Mapped[List["StudyMembership"]] = relationship("StudyMembership", back_populates="role")
