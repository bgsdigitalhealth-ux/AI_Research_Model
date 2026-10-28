from enum import Enum
from typing import Dict, List, Set


class RoleName(str, Enum):
    ADMINISTRATOR = "administrator"
    PRINCIPAL_INVESTIGATOR = "principal_investigator"
    RESEARCHER = "researcher"
    STATISTICIAN = "statistician"
    COLLECTOR = "collector"
    PARTICIPANT = "participant"


class Permission(str, Enum):
    # System Administration
    SYSTEM_ADMIN = "system:admin"
    USER_MANAGE = "user:manage"
    ROLE_MANAGE = "role:manage"
    AUDIT_VIEW = "audit:view"

    # Studies & Memberships
    STUDY_CREATE = "study:create"
    STUDY_VIEW = "study:view"
    STUDY_MANAGE = "study:manage"
    STUDY_MEMBERS_MANAGE = "study:members_manage"

    # Protocols & AI Extractions
    PROTOCOL_UPLOAD = "protocol:upload"
    PROTOCOL_VIEW = "protocol:view"
    PROTOCOL_VERIFY = "protocol:verify"
    PROTOCOL_MANAGE = "protocol:manage"

    # Questionnaires
    QUESTIONNAIRE_VIEW = "questionnaire:view"
    QUESTIONNAIRE_BUILD = "questionnaire:build"
    QUESTIONNAIRE_PUBLISH = "questionnaire:publish"

    # Data Collection & Field Intake
    SURVEY_INTAKE = "survey:intake"
    SURVEY_CONSENT = "survey:consent"
    DATA_COLLECTION_MONITOR = "data_collection:monitor"

    # Analysis & Visualisations
    ANALYSIS_RUN = "analysis:run"
    ANALYSIS_VIEW = "analysis:view"
    DATA_QUALITY_VIEW = "data_quality:view"

    # Reports & Exports
    REPORTS_GENERATE = "reports:generate"
    REPORTS_VIEW = "reports:view"
    EXPORT_DATA = "export:data"


# Canonical Role to Permissions Mapping
ROLE_PERMISSIONS: Dict[RoleName, Set[Permission]] = {
    RoleName.ADMINISTRATOR: {
        Permission.SYSTEM_ADMIN,
        Permission.USER_MANAGE,
        Permission.ROLE_MANAGE,
        Permission.AUDIT_VIEW,
        Permission.STUDY_CREATE,
        Permission.STUDY_VIEW,
        Permission.STUDY_MANAGE,
        Permission.STUDY_MEMBERS_MANAGE,
        Permission.PROTOCOL_UPLOAD,
        Permission.PROTOCOL_VIEW,
        Permission.PROTOCOL_VERIFY,
        Permission.PROTOCOL_MANAGE,
        Permission.QUESTIONNAIRE_VIEW,
        Permission.QUESTIONNAIRE_BUILD,
        Permission.QUESTIONNAIRE_PUBLISH,
        Permission.SURVEY_INTAKE,
        Permission.SURVEY_CONSENT,
        Permission.DATA_COLLECTION_MONITOR,
        Permission.ANALYSIS_RUN,
        Permission.ANALYSIS_VIEW,
        Permission.DATA_QUALITY_VIEW,
        Permission.REPORTS_GENERATE,
        Permission.REPORTS_VIEW,
        Permission.EXPORT_DATA,
    },
    RoleName.PRINCIPAL_INVESTIGATOR: {
        Permission.STUDY_CREATE,
        Permission.STUDY_VIEW,
        Permission.STUDY_MANAGE,
        Permission.STUDY_MEMBERS_MANAGE,
        Permission.PROTOCOL_UPLOAD,
        Permission.PROTOCOL_VIEW,
        Permission.PROTOCOL_VERIFY,
        Permission.PROTOCOL_MANAGE,
        Permission.QUESTIONNAIRE_VIEW,
        Permission.QUESTIONNAIRE_BUILD,
        Permission.QUESTIONNAIRE_PUBLISH,
        Permission.SURVEY_INTAKE,
        Permission.SURVEY_CONSENT,
        Permission.DATA_COLLECTION_MONITOR,
        Permission.ANALYSIS_RUN,
        Permission.ANALYSIS_VIEW,
        Permission.DATA_QUALITY_VIEW,
        Permission.REPORTS_GENERATE,
        Permission.REPORTS_VIEW,
        Permission.EXPORT_DATA,
        Permission.AUDIT_VIEW,
    },
    RoleName.RESEARCHER: {
        Permission.STUDY_VIEW,
        Permission.PROTOCOL_UPLOAD,
        Permission.PROTOCOL_VIEW,
        Permission.PROTOCOL_VERIFY,
        Permission.QUESTIONNAIRE_VIEW,
        Permission.QUESTIONNAIRE_BUILD,
        Permission.SURVEY_INTAKE,
        Permission.SURVEY_CONSENT,
        Permission.DATA_COLLECTION_MONITOR,
        Permission.ANALYSIS_RUN,
        Permission.ANALYSIS_VIEW,
        Permission.DATA_QUALITY_VIEW,
        Permission.REPORTS_GENERATE,
        Permission.REPORTS_VIEW,
        Permission.EXPORT_DATA,
    },
    RoleName.STATISTICIAN: {
        Permission.STUDY_VIEW,
        Permission.PROTOCOL_VIEW,
        Permission.QUESTIONNAIRE_VIEW,
        Permission.ANALYSIS_RUN,
        Permission.ANALYSIS_VIEW,
        Permission.DATA_QUALITY_VIEW,
        Permission.REPORTS_GENERATE,
        Permission.REPORTS_VIEW,
        Permission.EXPORT_DATA,
    },
    RoleName.COLLECTOR: {
        Permission.STUDY_VIEW,
        Permission.QUESTIONNAIRE_VIEW,
        Permission.SURVEY_INTAKE,
        Permission.SURVEY_CONSENT,
        Permission.DATA_COLLECTION_MONITOR,
    },
    RoleName.PARTICIPANT: {
        Permission.QUESTIONNAIRE_VIEW,
        Permission.SURVEY_INTAKE,
        Permission.SURVEY_CONSENT,
    },
}


def get_role_permissions(role_name: str) -> Set[Permission]:
    """
    Returns the set of permissions associated with a given role name.
    """
    try:
        role_enum = RoleName(role_name)
        return ROLE_PERMISSIONS.get(role_enum, set())
    except ValueError:
        return set()


def check_permission(user_role: str, required_permission: Permission) -> bool:
    """
    Checks if a role has the required permission.
    """
    permissions = get_role_permissions(user_role)
    return required_permission in permissions
