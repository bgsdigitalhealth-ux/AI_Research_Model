import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import (
    AIExecutionError,
    AIProviderNotConfiguredError,
    NotFoundError,
    PermissionDeniedError,
    VersionImmutableError,
)
from app.core.rbac import Permission, RoleName, check_permission
from app.models.protocol import Protocol
from app.models.protocol_extraction import ProtocolExtraction
from app.models.protocol_version import ProtocolVersion
from app.models.extracted_field_item import ExtractedFieldItem
from app.models.study import Study
from app.models.study_configuration import StudyConfiguration
from app.models.study_membership import StudyMembership
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.protocol_extraction_repository import ProtocolExtractionRepository
from app.repositories.protocol_repository import ProtocolRepository
from app.repositories.study_configuration_repository import StudyConfigurationRepository
from app.repositories.study_repository import StudyMembershipRepository, StudyRepository
from app.schemas.protocol import (
    ExtractedFieldSchema,
    ExtractionSourceEvidenceSchema,
    FieldVerificationUpdateRequest,
    ProtocolApprovalRequest,
    ProtocolExtractionDataResponse,
    ProtocolResponse,
    ProtocolVersionResponse,
    StudyMethodAnalysisConfigurationSchema,
)
from app.services.ai_adapter import PROTOCOL_FIELD_DEFINITIONS, get_ai_provider
from app.services.document_parser import DocumentParserService
from app.services.storage_service import StorageService


class ProtocolService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.protocol_repo = ProtocolRepository(session)
        self.study_repo = StudyRepository(session)
        self.extraction_repo = ProtocolExtractionRepository(session)
        self.config_repo = StudyConfigurationRepository(session)
        self.membership_repo = StudyMembershipRepository(session)
        self.audit_repo = AuditRepository(session)
        self.storage_service = StorageService()

    def _is_admin(self, user: User) -> bool:
        return bool(user.global_role and user.global_role.name == RoleName.ADMINISTRATOR)

    async def _verify_study_permission(
        self, study_id: uuid.UUID, user: User, required_permission: Permission
    ) -> None:
        if self._is_admin(user):
            return

        study = await self.study_repo.get_study_by_id(study_id)
        if not study:
            raise NotFoundError("Study", str(study_id))

        if study.created_by_user_id == user.id or study.principal_investigator_id == user.id:
            return

        membership = await self.membership_repo.get_user_study_membership(study_id, user.id)
        if not membership:
            raise PermissionDeniedError("You do not have access to this study's protocols.")

        role_name = membership.role.name if membership.role else ""
        if not check_permission(role_name, required_permission):
            raise PermissionDeniedError(
                f"Your role ({role_name}) lacks required permission: {required_permission.value}"
            )

    async def upload_protocol(
        self,
        study_id: uuid.UUID,
        file: UploadFile,
        title: Optional[str],
        version_str: Optional[str],
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ProtocolResponse:
        await self._verify_study_permission(study_id, current_user, Permission.PROTOCOL_UPLOAD)
        study = await self.study_repo.get_study_by_id(study_id)
        if not study:
            raise NotFoundError("Study", str(study_id))

        content = await file.read()
        filename = file.filename or "protocol.pdf"

        # Validate file format, magic bytes, size constraints
        ext, mime_type = self.storage_service.validate_file(filename, content)
        checksum = self.storage_service.compute_checksum(content)

        # Store file in object storage
        rel_path, file_size, checksum = await self.storage_service.save_protocol_file(
            study_id=study_id,
            filename=filename,
            content=content,
        )

        # Extract text and page/paragraph metadata
        raw_text, pages_meta = DocumentParserService.parse_document(filename, content)

        # Check existing protocol versioning for this study
        latest = await self.protocol_repo.get_latest_protocol_for_study(study_id)
        next_ver_num = 1
        if latest:
            latest.is_latest = False
            next_ver_num = latest.version_number + 1

        ver_str = version_str or (f"{next_ver_num}.0" if not latest else f"{float(latest.version) + 1.0:.1f}")
        proto_title = title or f"{study.title} Protocol v{ver_str}"

        # Create Protocol database record
        protocol = Protocol(
            study_id=study_id,
            title=proto_title,
            version=ver_str,
            version_number=next_ver_num,
            status="draft",
            file_name=filename,
            file_path=rel_path,
            file_size_bytes=file_size,
            file_type=mime_type,
            checksum_sha256=checksum,
            uploaded_by_user_id=current_user.id,
            is_latest=True,
            is_approved_immutable=False,
            extraction_status="not_started",
            extracted_raw_text=raw_text,
        )
        self.session.add(protocol)
        await self.session.flush()

        # Initialize Protocol Extraction record
        extraction = ProtocolExtraction(
            protocol_id=protocol.id,
            status="not_started",
            is_fully_verified=False,
        )
        self.session.add(extraction)
        await self.session.flush()

        # Create initial immutable version snapshot entry
        await self.protocol_repo.create_version_snapshot(
            protocol=protocol,
            uploaded_by_user_id=current_user.id,
            changes_summary=f"Initial upload of version {ver_str}",
        )

        await self.audit_repo.log_event(
            action="protocol:upload",
            user_id=current_user.id,
            entity_type="protocol",
            entity_id=str(protocol.id),
            details={
                "study_id": str(study_id),
                "filename": filename,
                "version": ver_str,
                "checksum": checksum,
                "file_size": file_size,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        loaded = await self.protocol_repo.get_protocol_by_id(protocol.id)
        return self._to_protocol_response(loaded)

    async def get_protocol(self, protocol_id: uuid.UUID, current_user: User) -> ProtocolResponse:
        protocol = await self.protocol_repo.get_protocol_by_id(protocol_id)
        if not protocol:
            raise NotFoundError("Protocol", str(protocol_id))
        await self._verify_study_permission(protocol.study_id, current_user, Permission.PROTOCOL_VIEW)
        return self._to_protocol_response(protocol)

    async def list_protocols(
        self,
        current_user: User,
        study_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> Tuple[List[ProtocolResponse], int]:
        accessible_study_ids = None
        if not self._is_admin(current_user):
            # Fetch accessible study IDs
            accessible_studies, _ = await self.study_repo.list_accessible_studies(
                user_id=current_user.id, is_global_admin=False, limit=500
            )
            accessible_study_ids = [s.id for s in accessible_studies]

        offset = (page - 1) * limit
        items, total = await self.protocol_repo.list_protocols(
            accessible_study_ids=accessible_study_ids,
            study_id=study_id,
            status=status,
            search=search,
            limit=limit,
            offset=offset,
        )
        return [self._to_protocol_response(p) for p in items], total

    async def trigger_ai_extraction(
        self,
        protocol_id: uuid.UUID,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Dict[str, Any]:
        protocol = await self.protocol_repo.get_protocol_by_id(protocol_id)
        if not protocol:
            raise NotFoundError("Protocol", str(protocol_id))

        await self._verify_study_permission(protocol.study_id, current_user, Permission.PROTOCOL_VERIFY)

        if protocol.is_approved_immutable:
            raise VersionImmutableError(
                "This protocol version has been approved and is immutable. "
                "AI extraction cannot overwrite an approved protocol."
            )

        extraction = await self.extraction_repo.get_by_protocol_id(protocol_id)
        if not extraction:
            extraction = ProtocolExtraction(protocol_id=protocol.id)
            self.session.add(extraction)
            await self.session.flush()

        extraction.status = "processing"
        protocol.extraction_status = "processing"
        await self.session.flush()

        # Execute extraction using configured AI provider adapter
        start_time = time.time()
        provider = get_ai_provider()

        try:
            pages_meta = [{"page_number": 1, "text": protocol.extracted_raw_text or ""}]
            result = await provider.extract_protocol_metadata(
                full_text=protocol.extracted_raw_text or "",
                pages_meta=pages_meta,
            )

            duration = round(time.time() - start_time, 2)
            extraction.status = "completed"
            extraction.provider_name = result.provider_name
            extraction.model_name = result.model_name
            extraction.prompt_version = result.prompt_version
            extraction.processing_duration_seconds = duration
            extraction.extracted_at = datetime.now(timezone.utc)
            extraction.error_message = None

            protocol.extraction_status = "completed"
            protocol.extraction_completed_at = datetime.now(timezone.utc)

            # Persist extracted fields
            await self.extraction_repo.save_extracted_fields(extraction, result.fields)

            await self.audit_repo.log_event(
                action="protocol:ai_extraction_completed",
                user_id=current_user.id,
                entity_type="protocol_extraction",
                entity_id=str(extraction.id),
                details={"provider": result.provider_name, "model": result.model_name, "duration": duration},
                ip_address=ip_address,
                user_agent=user_agent,
            )

            return {
                "status": "completed",
                "message": "AI extraction completed successfully with verified source evidence.",
            }

        except (AIProviderNotConfiguredError, AIExecutionError) as exc:
            extraction.status = "failed"
            extraction.error_message = exc.message
            protocol.extraction_status = "failed"
            await self.audit_repo.log_event(
                action="protocol:ai_extraction_failed",
                user_id=current_user.id,
                entity_type="protocol_extraction",
                entity_id=str(extraction.id),
                details={"error": exc.message},
                ip_address=ip_address,
                user_agent=user_agent,
            )
            await self.session.commit()
            raise

    async def get_extraction_data(
        self, protocol_id: uuid.UUID, current_user: User
    ) -> ProtocolExtractionDataResponse:
        protocol = await self.protocol_repo.get_protocol_by_id(protocol_id)
        if not protocol:
            raise NotFoundError("Protocol", str(protocol_id))

        await self._verify_study_permission(protocol.study_id, current_user, Permission.PROTOCOL_VIEW)

        extraction = await self.extraction_repo.get_by_protocol_id(protocol_id)
        if not extraction:
            # If no extraction record exists, initialize a blank default one with empty fields
            extraction = ProtocolExtraction(
                protocol_id=protocol_id,
                status="not_started",
                is_fully_verified=False,
            )
            self.session.add(extraction)
            await self.session.flush()

        fields_dict: Dict[str, ExtractedFieldSchema] = {}
        for defn in PROTOCOL_FIELD_DEFINITIONS:
            k = defn["key"]
            item = next((f for f in extraction.fields if f.field_key == k), None)
            if item:
                ev = None
                if item.evidence:
                    ev = ExtractionSourceEvidenceSchema(
                        pageNumber=item.evidence.get("pageNumber"),
                        paragraphNumber=item.evidence.get("paragraphNumber"),
                        sectionTitle=item.evidence.get("sectionTitle"),
                        sourceTextSnippet=item.evidence.get("sourceTextSnippet", ""),
                    )
                fields_dict[k] = ExtractedFieldSchema(
                    key=item.field_key,
                    label=item.label,
                    aiValue=item.ai_value,
                    verifiedValue=item.verified_value,
                    status=item.status,
                    uncertainty=item.uncertainty,
                    isMissing=item.is_missing,
                    confidenceScore=item.confidence_score,
                    evidence=ev,
                    reviewerNotes=item.reviewer_notes,
                    flagReason=item.flag_reason,
                    verifiedBy=item.verified_by.full_name if item.verified_by else None,
                    verifiedAt=item.verified_at,
                )
            else:
                fields_dict[k] = ExtractedFieldSchema(
                    key=k,
                    label=defn["label"],
                    aiValue=None,
                    status="unreviewed",
                    isMissing=True,
                )

        model_meta = None
        if extraction.model_name:
            model_meta = {
                "modelName": f"{extraction.provider_name}/{extraction.model_name}",
                "extractedAt": extraction.extracted_at.isoformat() if extraction.extracted_at else None,
                "processingDurationSeconds": extraction.processing_duration_seconds,
            }

        return ProtocolExtractionDataResponse(
            id=extraction.id,
            protocolId=protocol.id,
            status=extraction.status,
            errorMessage=extraction.error_message,
            modelMetadata=model_meta,
            fields=fields_dict,
            isFullyVerified=extraction.is_fully_verified,
            verifiedAt=extraction.verified_at,
            verifiedBy=extraction.verified_by.full_name if extraction.verified_by else None,
        )

    async def update_field_verification(
        self,
        protocol_id: uuid.UUID,
        field_key: str,
        payload: FieldVerificationUpdateRequest,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ExtractedFieldSchema:
        protocol = await self.protocol_repo.get_protocol_by_id(protocol_id)
        if not protocol:
            raise NotFoundError("Protocol", str(protocol_id))

        await self._verify_study_permission(protocol.study_id, current_user, Permission.PROTOCOL_VERIFY)

        if protocol.is_approved_immutable:
            raise VersionImmutableError(
                "This protocol version has been approved and is immutable. "
                "Individual fields cannot be edited on approved versions."
            )

        extraction = await self.extraction_repo.get_by_protocol_id(protocol_id)
        if not extraction:
            raise NotFoundError("Extraction", str(protocol_id))

        # Check if field exists, otherwise initialize it
        field = await self.extraction_repo.get_field(extraction.id, field_key)
        if not field:
            defn = next((d for d in PROTOCOL_FIELD_DEFINITIONS if d["key"] == field_key), None)
            label = defn["label"] if defn else field_key
            field = ExtractedFieldItem(
                extraction_id=extraction.id,
                field_key=field_key,
                label=label,
                status="unreviewed",
                is_missing=True,
            )
            self.session.add(field)
            await self.session.flush()

        updated_field = await self.extraction_repo.update_field_verification(
            extraction_id=extraction.id,
            field_key=field_key,
            status=payload.status,
            verified_value=payload.verified_value,
            reviewer_notes=payload.reviewer_notes,
            flag_reason=payload.flag_reason,
            verified_by_user_id=current_user.id,
        )

        await self.audit_repo.log_event(
            action="protocol:field_verify",
            user_id=current_user.id,
            entity_type="extracted_field_item",
            entity_id=str(updated_field.id),
            details={"field_key": field_key, "decision": payload.status},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        ev = None
        if updated_field.evidence:
            ev = ExtractionSourceEvidenceSchema(
                pageNumber=updated_field.evidence.get("pageNumber"),
                paragraphNumber=updated_field.evidence.get("paragraphNumber"),
                sectionTitle=updated_field.evidence.get("sectionTitle"),
                sourceTextSnippet=updated_field.evidence.get("sourceTextSnippet", ""),
            )

        return ExtractedFieldSchema(
            key=updated_field.field_key,
            label=updated_field.label,
            aiValue=updated_field.ai_value,
            verifiedValue=updated_field.verified_value,
            status=updated_field.status,
            uncertainty=updated_field.uncertainty,
            isMissing=updated_field.is_missing,
            confidenceScore=updated_field.confidence_score,
            evidence=ev,
            reviewerNotes=updated_field.reviewer_notes,
            flagReason=updated_field.flag_reason,
            verifiedBy=current_user.full_name,
            verifiedAt=updated_field.verified_at,
        )

    async def approve_protocol_extraction(
        self,
        protocol_id: uuid.UUID,
        payload: ProtocolApprovalRequest,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ProtocolResponse:
        protocol = await self.protocol_repo.get_protocol_by_id(protocol_id)
        if not protocol:
            raise NotFoundError("Protocol", str(protocol_id))

        # Enforce Principal Investigator or System Administrator permission to approve protocols
        await self._verify_study_permission(protocol.study_id, current_user, Permission.PROTOCOL_MANAGE)

        if protocol.is_approved_immutable:
            raise VersionImmutableError(
                "This protocol version has already been approved and is locked. "
                "Any changes must be submitted as a new protocol version / amendment."
            )

        extraction = await self.extraction_repo.get_by_protocol_id(protocol_id)

        # Mark protocol as approved and immutable
        now = datetime.now(timezone.utc)
        protocol.status = "approved"
        protocol.is_approved_immutable = True
        protocol.approved_by_user_id = current_user.id
        protocol.approval_date = now
        protocol.approval_notes = payload.notes
        if payload.irb_approval_number:
            protocol.irb_approval_number = payload.irb_approval_number

        if extraction:
            extraction.is_fully_verified = True
            extraction.verified_at = now
            extraction.verified_by_user_id = current_user.id

        # Propagate verified values to Study record
        study = await self.study_repo.get_study_by_id(protocol.study_id)
        if study and extraction:
            fields_map = {f.field_key: (f.verified_value if f.verified_value is not None else f.ai_value) for f in extraction.fields}
            if fields_map.get("studyDesign"):
                study.design_family = str(fields_map.get("studyDesign"))
            if fields_map.get("researchAims"):
                study.research_aims = fields_map.get("researchAims")
            if fields_map.get("inclusionCriteria") or fields_map.get("exclusionCriteria"):
                study.eligibility_criteria = {
                    "inclusion": fields_map.get("inclusionCriteria"),
                    "exclusion": fields_map.get("exclusionCriteria"),
                }
            if fields_map.get("primaryOutcomes"):
                study.primary_outcomes = fields_map.get("primaryOutcomes")
            if fields_map.get("secondaryOutcomes"):
                study.secondary_outcomes = fields_map.get("secondaryOutcomes")
            if fields_map.get("variablesAndInstruments"):
                study.variables_spec = fields_map.get("variablesAndInstruments")
            if fields_map.get("sampleSize"):
                try:
                    study.recruitment_target = int(str(fields_map.get("sampleSize")).replace(",", ""))
                except (ValueError, TypeError):
                    pass
            if fields_map.get("statisticalAnalysisPlan"):
                study.planned_analyses = {"plan": str(fields_map.get("statisticalAnalysisPlan"))}

            if study.status == "draft":
                study.status = "protocol_review"

        # Record approved version snapshot in audit history
        await self.protocol_repo.create_version_snapshot(
            protocol=protocol,
            uploaded_by_user_id=current_user.id,
            changes_summary=f"Protocol version {protocol.version} approved by {current_user.full_name}. Notes: {payload.notes or 'None'}",
        )

        await self.audit_repo.log_event(
            action="protocol:approve",
            user_id=current_user.id,
            entity_type="protocol",
            entity_id=str(protocol.id),
            details={"version": protocol.version, "study_id": str(protocol.study_id)},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        refreshed = await self.protocol_repo.get_protocol_by_id(protocol.id)
        return self._to_protocol_response(refreshed)

    async def get_study_configuration(
        self, protocol_id: uuid.UUID, current_user: User
    ) -> StudyMethodAnalysisConfigurationSchema:
        protocol = await self.protocol_repo.get_protocol_by_id(protocol_id)
        if not protocol:
            raise NotFoundError("Protocol", str(protocol_id))

        await self._verify_study_permission(protocol.study_id, current_user, Permission.PROTOCOL_VIEW)

        config = await self.config_repo.get_by_study_id(protocol.study_id)
        if not config:
            # Initialize default study configuration
            config = StudyConfiguration(
                study_id=protocol.study_id,
                protocol_id=protocol.id,
                study_type="interventional",
                blinding_type="open_label",
                number_of_arms=1,
                primary_hypothesis="",
                significance_alpha=0.05,
                power_threshold=0.80,
                planned_statistical_test="two_sample_t_test",
                missing_data_strategy="complete_case",
                configured_by_user_id=current_user.id,
            )
            self.session.add(config)
            await self.session.flush()

        return StudyMethodAnalysisConfigurationSchema(
            protocolId=protocol.id,
            studyId=config.study_id,
            studyType=config.study_type,
            randomizationMethod=config.randomization_method,
            allocationRatio=config.allocation_ratio,
            blindingType=config.blinding_type,
            numberOfArms=config.number_of_arms,
            primaryHypothesis=config.primary_hypothesis,
            significanceAlpha=config.significance_alpha,
            powerThreshold=config.power_threshold,
            plannedStatisticalTest=config.planned_statistical_test,
            missingDataStrategy=config.missing_data_strategy,
            subgroupAnalyses=config.subgroup_analyses,
            interimAnalysesPlanned=config.interim_analyses_planned,
            updatedAt=config.updated_at,
            configuredBy=config.configured_by.full_name if config.configured_by else None,
        )

    async def save_study_configuration(
        self,
        protocol_id: uuid.UUID,
        payload: Dict[str, Any],
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> StudyMethodAnalysisConfigurationSchema:
        protocol = await self.protocol_repo.get_protocol_by_id(protocol_id)
        if not protocol:
            raise NotFoundError("Protocol", str(protocol_id))

        await self._verify_study_permission(protocol.study_id, current_user, Permission.STUDY_MANAGE)

        if protocol.is_approved_immutable:
            # When protocol is approved, check if updating study configuration is authorized by PI
            if not self._is_admin(current_user) and current_user.id != protocol.study.principal_investigator_id:
                raise PermissionDeniedError(
                    "Only the Principal Investigator or Administrator can modify configuration of an approved protocol."
                )

        # Map camelCase to snake_case
        data = {}
        mapping = {
            "studyType": "study_type",
            "randomizationMethod": "randomization_method",
            "allocationRatio": "allocation_ratio",
            "blindingType": "blinding_type",
            "numberOfArms": "number_of_arms",
            "primaryHypothesis": "primary_hypothesis",
            "significanceAlpha": "significance_alpha",
            "powerThreshold": "power_threshold",
            "plannedStatisticalTest": "planned_statistical_test",
            "missingDataStrategy": "missing_data_strategy",
            "subgroupAnalyses": "subgroup_analyses",
            "interimAnalysesPlanned": "interim_analyses_planned",
        }
        for k, v in payload.items():
            db_k = mapping.get(k, k)
            data[db_k] = v

        config = await self.config_repo.upsert_configuration(
            study_id=protocol.study_id,
            protocol_id=protocol.id,
            data=data,
            user_id=current_user.id,
        )

        await self.audit_repo.log_event(
            action="protocol:study_configuration_save",
            user_id=current_user.id,
            entity_type="study_configuration",
            entity_id=str(config.id),
            details={"study_id": str(protocol.study_id), "protocol_id": str(protocol_id)},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return StudyMethodAnalysisConfigurationSchema(
            protocolId=protocol.id,
            studyId=config.study_id,
            studyType=config.study_type,
            randomizationMethod=config.randomization_method,
            allocationRatio=config.allocation_ratio,
            blindingType=config.blinding_type,
            numberOfArms=config.number_of_arms,
            primaryHypothesis=config.primary_hypothesis,
            significanceAlpha=config.significance_alpha,
            powerThreshold=config.power_threshold,
            plannedStatisticalTest=config.planned_statistical_test,
            missingDataStrategy=config.missing_data_strategy,
            subgroupAnalyses=config.subgroup_analyses,
            interimAnalysesPlanned=config.interim_analyses_planned,
            updatedAt=config.updated_at,
            configuredBy=current_user.full_name,
        )

    async def get_protocol_versions(
        self, protocol_id: uuid.UUID, current_user: User
    ) -> List[ProtocolVersionResponse]:
        protocol = await self.protocol_repo.get_protocol_by_id(protocol_id)
        if not protocol:
            raise NotFoundError("Protocol", str(protocol_id))

        await self._verify_study_permission(protocol.study_id, current_user, Permission.PROTOCOL_VIEW)

        versions = await self.protocol_repo.list_versions(protocol_id)
        return [
            ProtocolVersionResponse(
                id=v.id,
                protocolId=v.protocol_id,
                versionNumber=v.version_number,
                fileName=v.file_name,
                fileSizeBytes=v.file_size_bytes,
                uploadedAt=v.created_at,
                uploadedBy=v.uploaded_by.full_name if v.uploaded_by else "Unknown",
                changesSummary=v.changes_summary,
                status=v.status,
                downloadUrl=f"/api/v1/protocols/{protocol_id}/download",
            )
            for v in versions
        ]

    async def get_download_file(
        self, protocol_id: uuid.UUID, current_user: User
    ) -> Tuple[bytes, str, str]:
        protocol = await self.protocol_repo.get_protocol_by_id(protocol_id)
        if not protocol:
            raise NotFoundError("Protocol", str(protocol_id))

        await self._verify_study_permission(protocol.study_id, current_user, Permission.PROTOCOL_VIEW)

        content = self.storage_service.get_file_bytes(protocol.file_path)
        return content, protocol.file_name, protocol.file_type

    def _to_protocol_response(self, p: Protocol) -> ProtocolResponse:
        return ProtocolResponse(
            id=p.id,
            studyId=p.study_id,
            studyTitle=p.study.title if p.study else None,
            title=p.title,
            version=p.version,
            status=p.status,
            fileName=p.file_name,
            fileSizeBytes=p.file_size_bytes,
            fileType=p.file_type,
            fileUrl=f"/api/v1/protocols/{p.id}/download",
            uploadedAt=p.created_at,
            uploadedBy=p.uploaded_by.full_name if p.uploaded_by else None,
            irbApprovalNumber=p.irb_approval_number,
            approvalDate=p.approval_date,
            extractionStatus=p.extraction_status,
            extractionCompletedAt=p.extraction_completed_at,
            summaryNotes=p.summary_notes,
        )
