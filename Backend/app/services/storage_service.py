import hashlib
import os
import uuid
from pathlib import Path
from typing import Optional, Tuple
from app.core.config import settings
from app.core.exceptions import FileValidationError


class StorageService:
    def __init__(self, base_dir: str = settings.STORAGE_LOCAL_DIR):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def validate_file(self, filename: str, content: bytes, content_type: Optional[str] = None) -> Tuple[str, str]:
        """
        Validates file extension, magic bytes, and file size constraints.
        Returns cleaned (extension, detected_mime_type).
        """
        max_bytes = settings.STORAGE_MAX_FILE_SIZE_MB * 1024 * 1024
        if len(content) > max_bytes:
            raise FileValidationError(
                f"File size exceeds configured limit of {settings.STORAGE_MAX_FILE_SIZE_MB} MB."
            )

        if len(content) == 0:
            raise FileValidationError("Uploaded file is empty.")

        ext = Path(filename).suffix.lower()
        if ext not in settings.ALLOWED_PROTOCOL_EXTENSIONS:
            raise FileValidationError(
                f"Unsupported file extension '{ext}'. Allowed extensions are: {', '.join(settings.ALLOWED_PROTOCOL_EXTENSIONS)}."
            )

        # Magic bytes verification to prevent disguised binaries
        if ext == ".pdf":
            if not content.startswith(b"%PDF"):
                raise FileValidationError("Invalid PDF file format. Missing standard PDF magic header.")
            mime_type = "application/pdf"
        elif ext == ".docx":
            # DOCX is an OpenXML ZIP container starting with PK\x03\x04
            if not content.startswith(b"PK\x03\x04"):
                raise FileValidationError("Invalid DOCX file format. Missing OpenXML ZIP header.")
            mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            raise FileValidationError(f"Unsupported protocol file type: {ext}")

        return ext, mime_type

    def compute_checksum(self, content: bytes) -> str:
        """Computes SHA-256 checksum of content."""
        return hashlib.sha256(content).hexdigest()

    async def save_protocol_file(
        self,
        study_id: uuid.UUID,
        filename: str,
        content: bytes,
    ) -> Tuple[str, int, str]:
        """
        Saves uploaded file securely into object storage directory.
        Returns: (stored_relative_path, file_size_bytes, sha256_checksum)
        """
        ext, _ = self.validate_file(filename, content)
        checksum = self.compute_checksum(content)

        # Create structured path: uploads/protocols/<study_id>/<uuid>_<clean_filename>
        study_folder = self.base_dir / str(study_id)
        study_folder.mkdir(parents=True, exist_ok=True)

        safe_name = f"{uuid.uuid4().hex[:12]}_{Path(filename).name}"
        target_path = study_folder / safe_name

        with open(target_path, "wb") as f:
            f.write(content)

        relative_path = target_path.as_posix()
        return relative_path, len(content), checksum

    def get_file_bytes(self, stored_path: str) -> bytes:
        """Reads file bytes from storage."""
        path = Path(stored_path)
        if not path.is_file():
            raise FileValidationError("Stored protocol document could not be found in storage.")
        with open(path, "rb") as f:
            return f.read()
