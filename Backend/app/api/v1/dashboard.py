from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.study import Study
from app.models.participant import Participant
from app.models.questionnaire import Questionnaire
from app.models.survey_response import SurveyResponse
from app.schemas.study import StudyResponse, StudyStatusSummaryResponse
from app.services.study_service import StudyService

router = APIRouter(prefix="/dashboard", tags=["Dashboard Metrics & Summaries"])


@router.get(
    "/metrics",
    status_code=status.HTTP_200_OK,
    summary="Retrieve real-time aggregate research dashboard metrics",
)
async def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Total studies
    total_studies_res = await db.execute(select(func.count(Study.id)))
    total_studies = total_studies_res.scalar() or 0

    # Active studies
    active_studies_res = await db.execute(
        select(func.count(Study.id)).where(Study.status.in_(["active", "data_collection", "analysis"]))
    )
    active_studies = active_studies_res.scalar() or 0

    # Total participants
    total_part_res = await db.execute(select(func.count(Participant.id)))
    total_participants = total_part_res.scalar() or 0

    # Active participants
    active_part_res = await db.execute(
        select(func.count(Participant.id)).where(Participant.status == "enrolled")
    )
    active_participants = active_part_res.scalar() or 0

    # Questionnaires completed (survey responses submitted)
    completed_res = await db.execute(
        select(func.count(SurveyResponse.id)).where(SurveyResponse.status == "completed")
    )
    questionnaires_completed = completed_res.scalar() or 0

    # Total questionnaires
    total_q_res = await db.execute(select(func.count(Questionnaire.id)))
    total_q = total_q_res.scalar() or 0
    questionnaires_pending = max(0, total_q - questionnaires_completed)

    # Collection rate calculation
    collection_rate = (
        round((questionnaires_completed / total_participants) * 100, 1)
        if total_participants > 0
        else 0.0
    )

    return {
        "totalStudies": total_studies,
        "activeStudies": active_studies,
        "totalParticipants": total_participants,
        "activeParticipants": active_participants,
        "questionnairesCompleted": questionnaires_completed,
        "questionnairesPending": questionnaires_pending,
        "dataCollectionRate": collection_rate,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }


@router.get(
    "/study-status-summary",
    status_code=status.HTTP_200_OK,
    summary="Retrieve breakdown count of studies grouped by lifecycle status",
)
async def get_study_status_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StudyService(db)
    summary_obj = await service.get_status_summary(current_user)

    return {
        "total": summary_obj.total,
        "byStatus": [
            {
                "status": item.status,
                "label": item.label,
                "count": item.count,
                "color": item.color,
            }
            for item in summary_obj.by_status
        ],
    }


@router.get(
    "/recent-studies",
    response_model=List[StudyResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve list of recent research studies for user",
)
async def get_recent_studies(
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StudyService(db)
    studies, _ = await service.list_studies(
        current_user=current_user,
        page=1,
        limit=limit,
    )
    return studies


@router.get(
    "/workflow-progress",
    status_code=status.HTTP_200_OK,
    summary="Retrieve research workflow milestone progress",
)
async def get_workflow_progress(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total_studies_res = await db.execute(select(func.count(Study.id)))
    studies_count = total_studies_res.scalar() or 0

    total_q_res = await db.execute(select(func.count(Questionnaire.id)))
    q_count = total_q_res.scalar() or 0

    total_resp_res = await db.execute(select(func.count(SurveyResponse.id)))
    resp_count = total_resp_res.scalar() or 0

    steps = [
        {
            "id": "step-1",
            "stepNumber": 1,
            "title": "Protocol Ingestion & AI Verification",
            "description": "Upload protocol document, extract study parameters, and verify evidence.",
            "status": "completed" if studies_count > 0 else "in_progress",
            "assignedRole": "Principal Investigator",
        },
        {
            "id": "step-2",
            "stepNumber": 2,
            "title": "Psychometric Questionnaire Synthesis",
            "description": "Generate candidate question items mapped to primary and secondary clinical outcomes.",
            "status": "completed" if q_count > 0 else ("in_progress" if studies_count > 0 else "pending"),
            "assignedRole": "Researcher",
        },
        {
            "id": "step-3",
            "stepNumber": 3,
            "title": "Participant Intake & Offline Field Collection",
            "description": "Administer participant consent and field questionnaires with background sync.",
            "status": "completed" if resp_count > 0 else ("in_progress" if q_count > 0 else "pending"),
            "assignedRole": "Field Coordinator",
        },
        {
            "id": "step-4",
            "stepNumber": 4,
            "title": "Statistical Analysis & Visualisations",
            "description": "Execute deterministic statistical pipelines and generate clinical interpretations.",
            "status": "pending",
            "assignedRole": "Biostatistician",
        },
        {
            "id": "step-5",
            "stepNumber": 5,
            "title": "CSR Manuscript Compilation & Governance Export",
            "description": "Compile de-identified regulatory export packages and CSR documentation.",
            "status": "pending",
            "assignedRole": "Lead Investigator",
        },
    ]
    return steps
