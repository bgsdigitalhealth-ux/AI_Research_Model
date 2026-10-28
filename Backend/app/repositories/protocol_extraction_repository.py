import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.extracted_field_item import ExtractedFieldItem
from app.models.protocol_extraction import ProtocolExtraction
from app.repositories.base import BaseRepository


class ProtocolExtractionRepository(BaseRepository[ProtocolExtraction]):
    def __init__(self, session: AsyncSession):
        super().__init__(ProtocolExtraction, session)

    async def get_by_protocol_id(self, protocol_id: uuid.UUID) -> Optional[ProtocolExtraction]:
        stmt = (
            select(ProtocolExtraction)
            .options(
                selectinload(ProtocolExtraction.fields).selectinload(ExtractedFieldItem.verified_by),
                selectinload(ProtocolExtraction.verified_by),
                selectinload(ProtocolExtraction.protocol),
            )
            .where(ProtocolExtraction.protocol_id == protocol_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_field(
        self, extraction_id: uuid.UUID, field_key: str
    ) -> Optional[ExtractedFieldItem]:
        stmt = select(ExtractedFieldItem).where(
            ExtractedFieldItem.extraction_id == extraction_id,
            ExtractedFieldItem.field_key == field_key,
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def save_extracted_fields(
        self,
        extraction: ProtocolExtraction,
        fields_data: Dict[str, Any],
    ) -> List[ExtractedFieldItem]:
        """
        Populates or replaces extracted fields for an extraction record.
        """
        saved_items = []
        for key, f in fields_data.items():
            stmt = select(ExtractedFieldItem).where(
                ExtractedFieldItem.extraction_id == extraction.id,
                ExtractedFieldItem.field_key == key,
            )
            res = await self.session.execute(stmt)
            existing = res.scalars().first()

            evidence_dict = f.evidence.model_dump(by_alias=True) if getattr(f, "evidence", None) else None

            if existing:
                existing.label = f.label
                existing.ai_value = f.ai_value
                existing.uncertainty = f.uncertainty
                existing.is_missing = f.is_missing
                existing.confidence_score = f.confidence_score
                existing.evidence = evidence_dict
                saved_items.append(existing)
            else:
                item = ExtractedFieldItem(
                    extraction_id=extraction.id,
                    field_key=key,
                    label=f.label,
                    ai_value=f.ai_value,
                    status="unreviewed",
                    uncertainty=f.uncertainty,
                    is_missing=f.is_missing,
                    confidence_score=f.confidence_score,
                    evidence=evidence_dict,
                )
                self.session.add(item)
                saved_items.append(item)

        await self.session.flush()
        return saved_items

    async def update_field_verification(
        self,
        extraction_id: uuid.UUID,
        field_key: str,
        status: str,
        verified_value: Optional[Any],
        reviewer_notes: Optional[str],
        flag_reason: Optional[str],
        verified_by_user_id: uuid.UUID,
    ) -> ExtractedFieldItem:
        field = await self.get_field(extraction_id, field_key)
        if not field:
            raise ValueError(f"Extracted field '{field_key}' does not exist for this extraction.")

        field.status = status
        if verified_value is not None:
            field.verified_value = verified_value
        if reviewer_notes is not None:
            field.reviewer_notes = reviewer_notes
        if flag_reason is not None:
            field.flag_reason = flag_reason

        field.verified_by_user_id = verified_by_user_id
        field.verified_at = datetime.now(timezone.utc)

        await self.session.flush()
        return field

