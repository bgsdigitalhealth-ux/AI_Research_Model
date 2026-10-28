"""Questionnaire Management schema

Revision ID: 003_questionnaire_management
Revises: 002_study_and_protocol_management
Create Date: 2026-10-28 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "003_questionnaire_management"
down_revision: Union[str, None] = "002_study_and_protocol_management"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Questionnaires
    op.create_table(
        "questionnaires",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("protocol_id", sa.Uuid(), sa.ForeignKey("protocols.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("version", sa.String(50), nullable=False, server_default="1.0"),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("is_ai_generated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("ai_generation_metadata", sa.JSON(), nullable=True),
        sa.Column("scientific_validation_claim", sa.Text(), nullable=True),
        sa.Column("is_published_immutable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("approved_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_questionnaires_study_id", "questionnaires", ["study_id"])
    op.create_index("ix_questionnaires_protocol_id", "questionnaires", ["protocol_id"])
    op.create_index("ix_questionnaires_status", "questionnaires", ["status"])
    op.create_index("ix_questionnaires_created_by_user_id", "questionnaires", ["created_by_user_id"])
    op.create_index("ix_questionnaires_approved_by_user_id", "questionnaires", ["approved_by_user_id"])
    op.create_index("ix_questionnaires_published_by_user_id", "questionnaires", ["published_by_user_id"])

    # 2. Questionnaire Sections
    op.create_table(
        "questionnaire_sections",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("questionnaire_id", sa.Uuid(), sa.ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_questionnaire_sections_questionnaire_id", "questionnaire_sections", ["questionnaire_id"])

    # 3. Questions
    op.create_table(
        "questions",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("questionnaire_id", sa.Uuid(), sa.ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_id", sa.String(100), sa.ForeignKey("questionnaire_sections.id", ondelete="SET NULL"), nullable=True),
        sa.Column("variable_name", sa.String(100), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("validation", sa.JSON(), nullable=True),
        sa.Column("choices", sa.JSON(), nullable=True),
        sa.Column("conditional_logic", sa.JSON(), nullable=True),
        sa.Column("is_ai_generated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("verified_by_researcher", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("target_objective_id", sa.String(100), nullable=True),
        sa.Column("target_outcome_name", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_questions_questionnaire_id", "questions", ["questionnaire_id"])
    op.create_index("ix_questions_section_id", "questions", ["section_id"])
    op.create_index("ix_questions_variable_name", "questions", ["variable_name"])

    # 4. Questionnaire Mappings
    op.create_table(
        "questionnaire_mappings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("questionnaire_id", sa.Uuid(), sa.ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False),
        sa.Column("objective_id", sa.String(100), nullable=False),
        sa.Column("objective_title", sa.String(255), nullable=False),
        sa.Column("outcome_name", sa.String(255), nullable=False),
        sa.Column("covered_question_ids", sa.JSON(), nullable=False),
        sa.Column("is_covered", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("coverage_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_questionnaire_mappings_questionnaire_id", "questionnaire_mappings", ["questionnaire_id"])

    # 5. Questionnaire Versions
    op.create_table(
        "questionnaire_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("questionnaire_id", sa.Uuid(), sa.ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="published"),
        sa.Column("schema_snapshot", sa.JSON(), nullable=False),
        sa.Column("change_summary", sa.Text(), nullable=True),
        sa.Column("question_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("published_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_questionnaire_versions_questionnaire_id", "questionnaire_versions", ["questionnaire_id"])
    op.create_index("ix_questionnaire_versions_study_id", "questionnaire_versions", ["study_id"])
    op.create_index("ix_questionnaire_versions_published_by_user_id", "questionnaire_versions", ["published_by_user_id"])


def downgrade() -> None:
    op.drop_table("questionnaire_versions")
    op.drop_table("questionnaire_mappings")
    op.drop_table("questions")
    op.drop_table("questionnaire_sections")
    op.drop_table("questionnaires")

