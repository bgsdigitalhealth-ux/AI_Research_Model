import uuid
from typing import Optional
from sqlalchemy import BigInteger, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class ProtocolVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "protocol_versions"

    protocol_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("protocols.id", ondelete="CASCADE"), nullable=False, index=True
    )
    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[str] = mapped_column(String(50), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    changes_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Relationships
    protocol: Mapped["Protocol"] = relationship("Protocol", back_populates="versions")
    study: Mapped["Study"] = relationship("Study")
    uploaded_by: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by_user_id])

