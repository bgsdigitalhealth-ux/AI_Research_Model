"""Study and Protocol Management schema

Revision ID: 002_study_and_protocol_management
Revises: 001_initial_auth_and_rbac
Create Date: 2026-10-28 09:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "002_study_and_protocol_management"
down_revision: Union[str, None] = "001_initial_auth_and_rbac"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Studies
    op.create_table(
        "studies",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("protocol_number", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("phase", sa.String(50), nullable=True),
        sa.Column("principal_investigator_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("target_participants", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enrolled_participants", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completion_percentage", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("governance_approved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("governance_notes", sa.Text(), nullable=True),
        sa.Column("irb_approval_number", sa.String(100), nullable=True),
        sa.Column("irb_approval_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consent_framework_approved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("design_family", sa.String(100), nullable=True),
        sa.Column("research_aims", sa.JSON(), nullable=True),
        sa.Column("eligibility_criteria", sa.JSON(), nullable=True),
        sa.Column("primary_outcomes", sa.JSON(), nullable=True),
        sa.Column("secondary_outcomes", sa.JSON(), nullable=True),
        sa.Column("variables_spec", sa.JSON(), nullable=True),
        sa.Column("recruitment_target", sa.Integer(), nullable=True),
        sa.Column("planned_analyses", sa.JSON(), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_studies_protocol_number", "studies", ["protocol_number"], unique=True)
    op.create_index("ix_studies_status", "studies", ["status"])
    op.create_index("ix_studies_principal_investigator_id", "studies", ["principal_investigator_id"])
    op.create_index("ix_studies_organization_id", "studies", ["organization_id"])
    op.create_index("ix_studies_created_by_user_id", "studies", ["created_by_user_id"])

    # 2. Protocols
    op.create_table(
        "protocols",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("version", sa.String(50), nullable=False, server_default="1.0"),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("file_type", sa.String(100), nullable=False),
        sa.Column("checksum_sha256", sa.String(64), nullable=False),
        sa.Column("uploaded_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("irb_approval_number", sa.String(100), nullable=True),
        sa.Column("approval_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approval_notes", sa.Text(), nullable=True),
        sa.Column("summary_notes", sa.Text(), nullable=True),
        sa.Column("is_latest", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_approved_immutable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("extraction_status", sa.String(50), nullable=False, server_default="not_started"),
        sa.Column("extraction_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("extracted_raw_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_protocols_study_id", "protocols", ["study_id"])
    op.create_index("ix_protocols_status", "protocols", ["status"])
    op.create_index("ix_protocols_checksum_sha256", "protocols", ["checksum_sha256"])
    op.create_index("ix_protocols_uploaded_by_user_id", "protocols", ["uploaded_by_user_id"])
    op.create_index("ix_protocols_approved_by_user_id", "protocols", ["approved_by_user_id"])
    op.create_index("ix_protocols_extraction_status", "protocols", ["extraction_status"])

    # 3. Protocol Versions (Immutable Historical Snapshot Archive)
    op.create_table(
        "protocol_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("protocol_id", sa.Uuid(), sa.ForeignKey("protocols.id", ondelete="CASCADE"), nullable=False),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.String(50), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("checksum_sha256", sa.String(64), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("changes_summary", sa.Text(), nullable=True),
        sa.Column("uploaded_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_protocol_versions_protocol_id", "protocol_versions", ["protocol_id"])
    op.create_index("ix_protocol_versions_study_id", "protocol_versions", ["study_id"])
    op.create_index("ix_protocol_versions_uploaded_by_user_id", "protocol_versions", ["uploaded_by_user_id"])

    # 4. Protocol Extractions
    op.create_table(
        "protocol_extractions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("protocol_id", sa.Uuid(), sa.ForeignKey("protocols.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="not_started"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("provider_name", sa.String(50), nullable=True),
        sa.Column("model_name", sa.String(100), nullable=True),
        sa.Column("prompt_version", sa.String(50), nullable=True),
        sa.Column("processing_duration_seconds", sa.Float(), nullable=True),
        sa.Column("extracted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_fully_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_protocol_extractions_protocol_id", "protocol_extractions", ["protocol_id"], unique=True)
    op.create_index("ix_protocol_extractions_status", "protocol_extractions", ["status"])
    op.create_index("ix_protocol_extractions_verified_by_user_id", "protocol_extractions", ["verified_by_user_id"])

    # 5. Extracted Field Items
    op.create_table(
        "extracted_field_items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("extraction_id", sa.Uuid(), sa.ForeignKey("protocol_extractions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_key", sa.String(100), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("ai_value", sa.JSON(), nullable=True),
        sa.Column("verified_value", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="unreviewed"),
        sa.Column("uncertainty", sa.String(20), nullable=True),
        sa.Column("is_missing", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("evidence", sa.JSON(), nullable=True),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("flag_reason", sa.Text(), nullable=True),
        sa.Column("verified_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("extraction_id", "field_key", name="uq_extraction_field_key"),
    )
    op.create_index("ix_extracted_field_items_extraction_id", "extracted_field_items", ["extraction_id"])
    op.create_index("ix_extracted_field_items_field_key", "extracted_field_items", ["field_key"])
    op.create_index("ix_extracted_field_items_status", "extracted_field_items", ["status"])
    op.create_index("ix_extracted_field_items_verified_by_user_id", "extracted_field_items", ["verified_by_user_id"])

    # 6. Study Configurations
    op.create_table(
        "study_configurations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("protocol_id", sa.Uuid(), sa.ForeignKey("protocols.id", ondelete="SET NULL"), nullable=True),
        sa.Column("study_type", sa.String(100), nullable=False, server_default="interventional"),
        sa.Column("randomization_method", sa.String(100), nullable=True),
        sa.Column("allocation_ratio", sa.String(50), nullable=True),
        sa.Column("blinding_type", sa.String(50), nullable=False, server_default="open_label"),
        sa.Column("number_of_arms", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("primary_hypothesis", sa.Text(), nullable=False, server_default=""),
        sa.Column("significance_alpha", sa.Float(), nullable=False, server_default="0.05"),
        sa.Column("power_threshold", sa.Float(), nullable=False, server_default="0.80"),
        sa.Column("planned_statistical_test", sa.String(100), nullable=False, server_default="two_sample_t_test"),
        sa.Column("missing_data_strategy", sa.String(50), nullable=False, server_default="complete_case"),
        sa.Column("subgroup_analyses", sa.Text(), nullable=True),
        sa.Column("interim_analyses_planned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("configured_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_study_configurations_study_id", "study_configurations", ["study_id"], unique=True)
    op.create_index("ix_study_configurations_protocol_id", "study_configurations", ["protocol_id"])
    op.create_index("ix_study_configurations_configured_by_user_id", "study_configurations", ["configured_by_user_id"])


def downgrade() -> None:
    op.drop_table("study_configurations")
    op.drop_table("extracted_field_items")
    op.drop_table("protocol_extractions")
    op.drop_table("protocol_versions")
    op.drop_table("protocols")
    op.drop_table("studies")

