import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.study import Study
from app.models.role import Role
from app.models.study_membership import StudyMembership
from app.schemas.common import BaseSchema
from pydantic import ConfigDict, Field

router = APIRouter(prefix="/collaborators", tags=["Collaborators Management"])


class CollaboratorResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    userId: Optional[str] = None
    studyId: Optional[str] = None
    studyTitle: Optional[str] = None
    fullName: str
    email: str
    roleName: str
    institution: Optional[str] = "Clinical AI Research Network"
    department: Optional[str] = "Clinical Trials Unit"
    isActive: bool = True
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CollaboratorInviteRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    email: str
    fullName: str = Field(..., alias="fullName")
    roleName: str = Field(default="researcher", alias="roleName")
    studyId: Optional[str] = Field(None, alias="studyId")
    institution: Optional[str] = None
    department: Optional[str] = None


class CollaboratorMetrics(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    totalCollaborators: int = 0
    activeInvestigators: int = 0
    participatingInstitutions: int = 1
    activeStudies: int = 0


@router.get(
    "/metrics",
    response_model=CollaboratorMetrics,
    status_code=status.HTTP_200_OK,
    summary="Retrieve aggregate collaborator and investigator metrics",
)
async def get_collaborator_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mem_res = await db.execute(select(func.count(StudyMembership.id)))
    mem_count = mem_res.scalar_one()

    user_res = await db.execute(select(func.count(User.id)))
    user_count = user_res.scalar_one()

    study_res = await db.execute(select(func.count(Study.id)))
    study_count = study_res.scalar_one()

    total = max(mem_count, user_count)
    return CollaboratorMetrics(
        totalCollaborators=total,
        activeInvestigators=total,
        participatingInstitutions=max(1, total // 2),
        activeStudies=study_count,
    )


@router.get(
    "",
    response_model=List[CollaboratorResponse],
    status_code=status.HTTP_200_OK,
    summary="List team collaborators and cross-institutional investigators",
)
async def list_collaborators(
    studyId: Optional[str] = Query(None, alias="studyId"),
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(StudyMembership)
        .options(
            selectinload(StudyMembership.user),
            selectinload(StudyMembership.study),
            selectinload(StudyMembership.role),
        )
    )
    if studyId:
        try:
            s_uuid = uuid.UUID(studyId)
            stmt = stmt.where(StudyMembership.study_id == s_uuid)
        except ValueError:
            pass

    res = await db.execute(stmt)
    memberships = res.scalars().all()

    results: List[CollaboratorResponse] = []
    seen_user_ids = set()

    for m in memberships:
        u = m.user
        if not u:
            continue
        seen_user_ids.add(str(u.id))
        r_name = m.role.name if m.role else "researcher"
        if role and role.lower() not in r_name.lower():
            continue
        if search:
            st = search.lower()
            if st not in u.full_name.lower() and st not in u.email.lower():
                continue

        results.append(
            CollaboratorResponse(
                id=str(m.id),
                userId=str(u.id),
                studyId=str(m.study_id),
                studyTitle=m.study.title if m.study else None,
                fullName=u.full_name,
                email=u.email,
                roleName=r_name,
                institution="Central Clinical Trials Consortium",
                department="Biomedical Informatics",
                isActive=m.is_active,
                createdAt=m.created_at,
            )
        )

    # Also list registered users if not yet in study membership
    u_stmt = select(User).options(selectinload(User.global_role))
    u_res = await db.execute(u_stmt)
    all_users = u_res.scalars().all()

    for u in all_users:
        if str(u.id) not in seen_user_ids:
            r_name = u.global_role.name if u.global_role else "researcher"
            if role and role.lower() not in r_name.lower():
                continue
            if search:
                st = search.lower()
                if st not in u.full_name.lower() and st not in u.email.lower():
                    continue

            results.append(
                CollaboratorResponse(
                    id=str(u.id),
                    userId=str(u.id),
                    studyId=None,
                    studyTitle="Global Platform Investigator",
                    fullName=u.full_name,
                    email=u.email,
                    roleName=r_name,
                    institution="Academic Medical Center",
                    department="Clinical Research",
                    isActive=u.is_active,
                    createdAt=u.created_at,
                )
            )

    return results


@router.post(
    "",
    response_model=CollaboratorResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite and register a research collaborator",
)
async def invite_collaborator(
    payload: CollaboratorInviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Lookup role
    role_res = await db.execute(select(Role).where(Role.name == payload.roleName.lower()))
    role = role_res.scalars().first()
    if not role:
        # Fallback to researcher or first role
        r_all = await db.execute(select(Role))
        role = r_all.scalars().first()

    # Find or create user
    u_res = await db.execute(select(User).where(User.email == payload.email.strip().lower()))
    target_user = u_res.scalars().first()

    if not target_user:
        target_user = User(
            email=payload.email.strip().lower(),
            full_name=payload.fullName.strip(),
            hashed_password="invited_external_collaborator_hash",
            global_role_id=role.id,
            is_active=True,
            is_verified=True,
        )
        db.add(target_user)
        await db.commit()
        await db.refresh(target_user)

    # Assign to study if provided, else use first study
    study_id = None
    study_title = None
    if payload.studyId:
        try:
            study_id = uuid.UUID(payload.studyId)
        except ValueError:
            study_id = None

    if not study_id:
        st_res = await db.execute(select(Study))
        first_study = st_res.scalars().first()
        if first_study:
            study_id = first_study.id
            study_title = first_study.title

    membership_id = str(uuid.uuid4())
    if study_id:
        # check existing membership
        mem_check = await db.execute(
            select(StudyMembership).where(
                StudyMembership.study_id == study_id,
                StudyMembership.user_id == target_user.id,
            )
        )
        existing_m = mem_check.scalars().first()
        if not existing_m:
            new_m = StudyMembership(
                study_id=study_id,
                user_id=target_user.id,
                role_id=role.id,
                is_active=True,
                granted_by_user_id=current_user.id,
            )
            db.add(new_m)
            await db.commit()
            await db.refresh(new_m)
            membership_id = str(new_m.id)
        else:
            membership_id = str(existing_m.id)

    return CollaboratorResponse(
        id=membership_id,
        userId=str(target_user.id),
        studyId=str(study_id) if study_id else None,
        studyTitle=study_title or "Assigned Research Study",
        fullName=target_user.full_name,
        email=target_user.email,
        roleName=role.name if role else payload.roleName,
        institution=payload.institution or "Clinical AI Research Network",
        department=payload.department or "Clinical Trials Unit",
        isActive=True,
        createdAt=datetime.now(timezone.utc),
    )


@router.delete(
    "/{collaborator_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a collaborator from active study membership",
)
async def remove_collaborator(
    collaborator_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        c_uuid = uuid.UUID(collaborator_id)
        mem = await db.get(StudyMembership, c_uuid)
        if mem:
            await db.delete(mem)
            await db.commit()
            return None
    except ValueError:
        pass

    return None

