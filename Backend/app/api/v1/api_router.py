from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.audit import router as audit_router
from app.api.v1.studies import router as studies_router
from app.api.v1.protocols import router as protocols_router
from app.api.v1.questionnaires import router as questionnaires_router
from app.api.v1.data_collection import router as data_collection_router
from app.api.v1.surveys import router as surveys_router
from app.api.v1.participants import router as participants_router
from app.api.v1.analysis import router as analysis_router
from app.api.v1.reports import reports_router, exports_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.collaborators import router as collaborators_router

api_v1_router = APIRouter()
api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(studies_router)
api_v1_router.include_router(protocols_router)
api_v1_router.include_router(questionnaires_router)
api_v1_router.include_router(data_collection_router)
api_v1_router.include_router(surveys_router)
api_v1_router.include_router(participants_router)
api_v1_router.include_router(collaborators_router)
api_v1_router.include_router(analysis_router)
api_v1_router.include_router(reports_router)
api_v1_router.include_router(exports_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(notifications_router)
