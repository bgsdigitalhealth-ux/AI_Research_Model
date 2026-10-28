"""Initial auth and RBAC schema

Revision ID: 001_initial_auth_and_rbac
Revises: 
Create Date: 2026-10-27 15:50:00.000000

"""
import uuid
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial_auth_and_rbac"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Organizations
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_organizations_name", "organizations", ["name"], unique=True)
    op.create_index("ix_organizations_code", "organizations", ["code"], unique=True)

    # 2. Roles
    roles_table = op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("is_system_role", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_roles_name", "roles", ["name"], unique=True)

    # Pre-seed system role definitions (schema metadata)
    system_roles = [
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
            "name": "administrator",
            "description": "System Administrator with full governance and security oversight",
            "is_system_role": True,
            "permissions": [
                "system:admin", "user:manage", "role:manage", "audit:view",
                "study:create", "study:view", "study:manage", "study:members_manage",
                "protocol:upload", "protocol:view", "protocol:verify", "protocol:manage",
                "questionnaire:view", "questionnaire:build", "questionnaire:publish",
                "survey:intake", "survey:consent", "data_collection:monitor",
                "analysis:run", "analysis:view", "data_quality:view",
                "reports:generate", "reports:view", "export:data"
            ],
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
            "name": "principal_investigator",
            "description": "Principal Investigator leading clinical trials and scientific investigations",
            "is_system_role": True,
            "permissions": [
                "study:create", "study:view", "study:manage", "study:members_manage",
                "protocol:upload", "protocol:view", "protocol:verify", "protocol:manage",
                "questionnaire:view", "questionnaire:build", "questionnaire:publish",
                "survey:intake", "survey:consent", "data_collection:monitor",
                "analysis:run", "analysis:view", "data_quality:view",
                "reports:generate", "reports:view", "export:data", "audit:view"
            ],
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000003"),
            "name": "researcher",
            "description": "Research Associate drafting protocols and verifying scientific data",
            "is_system_role": True,
            "permissions": [
                "study:view", "protocol:upload", "protocol:view", "protocol:verify",
                "questionnaire:view", "questionnaire:build", "data_collection:monitor",
                "analysis:run", "analysis:view", "data_quality:view", "reports:view"
            ],
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000004"),
            "name": "statistician",
            "description": "Biostatistician and Quantitative Analyst executing SAP pipelines",
            "is_system_role": True,
            "permissions": [
                "study:view", "protocol:view", "questionnaire:view",
                "analysis:run", "analysis:view", "data_quality:view",
                "reports:generate", "reports:view", "export:data"
            ],
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000005"),
            "name": "collector",
            "description": "Field Data Collector administering participant consent and surveys",
            "is_system_role": True,
            "permissions": [
                "study:view", "questionnaire:view", "survey:intake", "survey:consent"
            ],
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000006"),
            "name": "participant",
            "description": "Study participant completing questionnaires and providing informed consent",
            "is_system_role": True,
            "permissions": [
                "questionnaire:view", "survey:intake", "survey:consent"
            ],
        },
    ]
    op.bulk_insert(roles_table, system_roles)

    # 3. Users
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("phone_number", sa.String(50), nullable=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("global_role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("mfa_secret", sa.String(255), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_organization_id", "users", ["organization_id"])
    op.create_index("ix_users_global_role_id", "users", ["global_role_id"])

    # 4. Study Memberships
    op.create_table(
        "study_memberships",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("granted_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("study_id", "user_id", name="uq_study_user_membership"),
    )
    op.create_index("ix_study_memberships_study_id", "study_memberships", ["study_id"])
    op.create_index("ix_study_memberships_user_id", "study_memberships", ["user_id"])
    op.create_index("ix_study_memberships_role_id", "study_memberships", ["role_id"])

    # 5. User Sessions / Refresh Tokens
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_token_hash", "user_sessions", ["token_hash"], unique=True)
    op.create_index("ix_user_sessions_is_revoked", "user_sessions", ["is_revoked"])

    # 6. Verification Tokens
    op.create_table(
        "verification_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("token_type", sa.String(50), nullable=False),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_verification_tokens_user_id", "verification_tokens", ["user_id"])
    op.create_index("ix_verification_tokens_token_hash", "verification_tokens", ["token_hash"], unique=True)
    op.create_index("ix_verification_tokens_token_type", "verification_tokens", ["token_type"])
    op.create_index("ix_verification_tokens_is_used", "verification_tokens", ["is_used"])

    # 7. Audit Events
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("study_id", sa.Uuid(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_audit_events_event_type", "audit_events", ["event_type"])
    op.create_index("ix_audit_events_user_id", "audit_events", ["user_id"])
    op.create_index("ix_audit_events_study_id", "audit_events", ["study_id"])
    op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("verification_tokens")
    op.drop_table("user_sessions")
    op.drop_table("study_memberships")
    op.drop_table("users")
    op.drop_table("roles")
    op.drop_table("organizations")
