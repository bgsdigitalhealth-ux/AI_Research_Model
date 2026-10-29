import uuid
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import (
    ConflictError,
    GovernanceNotMetError,
    NotFoundError,
    PermissionDeniedError,
)
from app.core.rbac import Permission, RoleName, check_permission
from app.models.role import Role
from app.models.study import Study
from app.models.study_membership import StudyMembership
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.study_repository import StudyMembershipRepository, StudyRepository
from app.repositories.user_repository import UserRepository
from app.schemas.study import (
    StudyCreateRequest,
    StudyGovernanceUpdateRequest,
    StudyMemberAddRequest,
    StudyMemberResponse,
    StudyResponse,
    StudyStatusCount,
    StudyStatusSummaryResponse,
    StudyUpdateRequest,
)


class StudyService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.study_repo = StudyRepository(session)
        self.membership_repo = StudyMembershipRepository(session)
        self.user_repo = UserRepository(session)
        self.audit_repo = AuditRepository(session)

    def _is_admin(self, user: User) -> bool:
        if user.global_role and user.global_role.name == RoleName.ADMINISTRATOR:
            return True
        return False

    async def _verify_study_permission(
        self, study_id: uuid.UUID, user: User, required_permission: Permission
    ) -> None:
        if self._is_admin(user):
            return

        study = await self.study_repo.get_study_by_id(study_id)
        if not study:
            raise NotFoundError("Study", str(study_id))

        # Study Creator or designated Principal Investigator has full study management permissions
        if study.created_by_user_id == user.id or study.principal_investigator_id == user.id:
            return

        # Check explicit study-level membership role
        membership = await self.membership_repo.get_user_study_membership(study_id, user.id)
        if not membership:
            raise PermissionDeniedError("You do not have access to this study.")

        role_name = membership.role.name if membership.role else ""
        if not check_permission(role_name, required_permission):
            raise PermissionDeniedError(
                f"Your role ({role_name}) lacks the required permission: {required_permission.value}"
            )

    async def create_study(
        self,
        payload: StudyCreateRequest,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> StudyResponse:
        # Check uniqueness of protocol number
        existing = await self.study_repo.get_by_protocol_number(payload.protocol_number)
        if existing:
            raise ConflictError(
                f"A study with protocol number '{payload.protocol_number}' already exists."
            )

        pi_id = payload.principal_investigator_id or current_user.id

        study_data = {
            "title": payload.title,
            "protocol_number": payload.protocol_number,
            "description": payload.description,
            "status": "draft",
            "phase": payload.phase,
            "principal_investigator_id": pi_id,
            "organization_id": payload.organization_id or current_user.organization_id,
            "target_participants": payload.target_participants,
            "start_date": payload.start_date,
            "end_date": payload.end_date,
            "irb_approval_number": payload.irb_approval_number,
            "irb_approval_date": payload.irb_approval_date,
            "governance_notes": payload.governance_notes,
            "created_by_user_id": current_user.id,
        }

        study = await self.study_repo.create(**study_data)

        # Automatically assign PI membership to study creator / PI
        pi_role = await self.session.execute(
            select(Role).where(Role.name == RoleName.PRINCIPAL_INVESTIGATOR)
        )
        pi_role_entity = pi_role.scalars().first()
        if pi_role_entity:
            membership = StudyMembership(
                study_id=study.id,
                user_id=current_user.id,
                role_id=pi_role_entity.id,
                is_active=True,
                granted_by_user_id=current_user.id,
            )
            self.session.add(membership)
            await self.session.flush()

        await self.audit_repo.log_event(
            action="study:create",
            user_id=current_user.id,
            entity_type="study",
            entity_id=str(study.id),
            details={"protocol_number": study.protocol_number, "title": study.title},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        loaded = await self.study_repo.get_study_by_id(study.id)
        return self._to_study_response(loaded)

    async def list_studies(
        self,
        current_user: User,
        status: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> Tuple[List[StudyResponse], int]:
        is_admin = self._is_admin(current_user)
        offset = (page - 1) * limit
        items, total = await self.study_repo.list_accessible_studies(
            user_id=current_user.id,
            is_global_admin=is_admin,
            status=status,
            search=search,
            limit=limit,
            offset=offset,
        )
        return [self._to_study_response(s) for s in items], total

    async def get_study_by_id(self, study_id: uuid.UUID, current_user: User) -> StudyResponse:
        await self._verify_study_permission(study_id, current_user, Permission.STUDY_VIEW)
        study = await self.study_repo.get_study_by_id(study_id)
        if not study:
            raise NotFoundError("Study", str(study_id))
        return self._to_study_response(study)

    async def update_study(
        self,
        study_id: uuid.UUID,
        payload: StudyUpdateRequest,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> StudyResponse:
        await self._verify_study_permission(study_id, current_user, Permission.STUDY_MANAGE)
        study = await self.study_repo.get_study_by_id(study_id)
        if not study:
            raise NotFoundError("Study", str(study_id))

        update_dict = payload.model_dump(exclude_unset=True)

        # Enforce governance and consent metadata before collection or active status is enabled
        target_status = update_dict.get("status")
        if target_status in ("active", "data_collection"):
            is_gov_approved = update_dict.get("governance_approved", study.governance_approved)
            is_consent_approved = update_dict.get(
                "consent_framework_approved", study.consent_framework_approved
            )
            has_irb = bool(update_dict.get("irb_approval_number", study.irb_approval_number))

            if not (is_gov_approved and is_consent_approved) and not (has_irb and is_consent_approved):
                raise GovernanceNotMetError(
                    "Study cannot transition to active data collection without approved governance, "
                    "IRB approval number, and consent framework approval."
                )

        updated_study = await self.study_repo.update(study_id, **update_dict)

        await self.audit_repo.log_event(
            action="study:update",
            user_id=current_user.id,
            entity_type="study",
            entity_id=str(study_id),
            details={"updated_fields": list(update_dict.keys())},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        refreshed = await self.study_repo.get_study_by_id(study_id)
        return self._to_study_response(refreshed)

    async def add_study_member(
        self,
        study_id: uuid.UUID,
        payload: StudyMemberAddRequest,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> StudyMemberResponse:
        await self._verify_study_permission(study_id, current_user, Permission.STUDY_MEMBERS_MANAGE)

        target_user = None
        if payload.user_id:
            target_user = await self.user_repo.get_by_id(payload.user_id)
        elif payload.email:
            target_user = await self.user_repo.get_by_email(payload.email)

        if not target_user:
            raise NotFoundError("User", str(payload.user_id or payload.email))

        # Lookup role
        role_res = await self.session.execute(select(Role).where(Role.name == payload.role_name))
        role = role_res.scalars().first()
        if not role:
            raise NotFoundError("Role", payload.role_name)

        # Check existing membership
        existing = await self.membership_repo.get_user_study_membership(study_id, target_user.id)
        if existing:
            existing.role_id = role.id
            existing.is_active = True
            existing.granted_by_user_id = current_user.id
            membership = existing
        else:
            membership = StudyMembership(
                study_id=study_id,
                user_id=target_user.id,
                role_id=role.id,
                is_active=True,
                granted_by_user_id=current_user.id,
            )
            self.session.add(membership)

        await self.session.flush()

        await self.audit_repo.log_event(
            action="study:member_add",
            user_id=current_user.id,
            entity_type="study_membership",
            entity_id=str(membership.id),
            details={"study_id": str(study_id), "target_user": target_user.email, "role": role.name},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return StudyMemberResponse(
            id=membership.id,
            studyId=study_id,
            userId=target_user.id,
            userEmail=target_user.email,
            userFullName=target_user.full_name,
            roleName=role.name,
            isActive=membership.is_active,
            createdAt=membership.created_at,
        )

    async def list_study_members(
        self, study_id: uuid.UUID, current_user: User
    ) -> List[StudyMemberResponse]:
        await self._verify_study_permission(study_id, current_user, Permission.STUDY_VIEW)
        members = await self.membership_repo.list_study_members(study_id)
        return [
            StudyMemberResponse(
                id=m.id,
                studyId=m.study_id,
                userId=m.user_id,
                userEmail=m.user.email if m.user else "",
                userFullName=m.user.full_name if m.user else "",
                roleName=m.role.name if m.role else "",
                isActive=m.is_active,
                createdAt=m.created_at,
            )
            for m in members
        ]

    async def remove_study_member(
        self,
        study_id: uuid.UUID,
        target_user_id: uuid.UUID,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        await self._verify_study_permission(study_id, current_user, Permission.STUDY_MEMBERS_MANAGE)
        membership = await self.membership_repo.get_user_study_membership(study_id, target_user_id)
        if not membership:
            raise NotFoundError("StudyMembership", str(target_user_id))

        membership.is_active = False
        await self.session.flush()

        await self.audit_repo.log_event(
            action="study:member_remove",
            user_id=current_user.id,
            entity_type="study_membership",
            entity_id=str(membership.id),
            details={"study_id": str(study_id), "removed_user_id": str(target_user_id)},
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def update_governance(
        self,
        study_id: uuid.UUID,
        payload: StudyGovernanceUpdateRequest,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> StudyResponse:
        await self._verify_study_permission(study_id, current_user, Permission.STUDY_MANAGE)
        study = await self.study_repo.get_study_by_id(study_id)
        if not study:
            raise NotFoundError("Study", str(study_id))

        study.governance_approved = payload.governance_approved
        study.consent_framework_approved = payload.consent_framework_approved
        if payload.irb_approval_number is not None:
            study.irb_approval_number = payload.irb_approval_number
        if payload.irb_approval_date is not None:
            study.irb_approval_date = payload.irb_approval_date
        if payload.governance_notes is not None:
            study.governance_notes = payload.governance_notes

        await self.session.flush()

        await self.audit_repo.log_event(
            action="study:governance_update",
            user_id=current_user.id,
            entity_type="study",
            entity_id=str(study_id),
            details={
                "governance_approved": payload.governance_approved,
                "consent_framework_approved": payload.consent_framework_approved,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        refreshed = await self.study_repo.get_study_by_id(study_id)
        return self._to_study_response(refreshed)

    async def get_status_summary(self, current_user: User) -> StudyStatusSummaryResponse:
        is_admin = self._is_admin(current_user)
        raw_counts = await self.study_repo.get_study_status_counts(current_user.id, is_admin)

        status_order = [
            ("draft", "Draft", "#94A3B8"),
            ("protocol_review", "Protocol Review", "#3B82F6"),
            ("active", "Active", "#10B981"),
            ("data_collection", "Data Collection", "#8B5CF6"),
            ("analysis", "Analysis", "#F59E0B"),
            ("completed", "Completed", "#059669"),
            ("archived", "Archived", "#64748B"),
        ]

        total = sum(raw_counts.values())
        by_status = [
            StudyStatusCount(
                status=st,
                label=lbl,
                count=raw_counts.get(st, 0),
                color=col,
            )
            for st, lbl, col in status_order
        ]

        return StudyStatusSummaryResponse(total=total, by_status=by_status)

    def _to_study_response(self, study: Study) -> StudyResponse:
        pi_name = study.principal_investigator.full_name if study.principal_investigator else None
        return StudyResponse(
            id=study.id,
            title=study.title,
            protocolNumber=study.protocol_number,
            status=study.status,
            phase=study.phase,
            principalInvestigator=pi_name,
            principalInvestigatorId=study.principal_investigator_id,
            organizationId=study.organization_id,
            targetParticipants=study.target_participants,
            enrolledParticipants=study.enrolled_participants,
            startDate=study.start_date,
            endDate=study.end_date,
            completionPercentage=study.completion_percentage,
            governanceApproved=study.governance_approved,
            consentFrameworkApproved=study.consent_framework_approved,
            irbApprovalNumber=study.irb_approval_number,
            createdAt=study.created_at,
            updatedAt=study.updated_at,
        )
from sqlalchemy import select

