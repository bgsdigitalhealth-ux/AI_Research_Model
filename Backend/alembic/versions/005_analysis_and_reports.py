"""Statistical Analysis, Dataset Snapshots, Results, Reports, and Exports schema

Revision ID: 005_analysis_and_reports
Revises: 004_data_collection_and_quality
Create Date: 2026-10-28 11:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "005_analysis_and_reports"
down_revision: Union[str, None] = "004_data_collection_and_quality"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Dataset Snapshots
    op.create_table(
        "dataset_snapshots",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("questionnaire_id", sa.Uuid(), sa.ForeignKey("questionnaires.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("questionnaire_version", sa.String(50), nullable=False, server_default="1.0"),
        sa.Column("record_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("variable_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("is_frozen", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("frozen_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("data_quality_score", sa.Float(), nullable=True),
        sa.Column("variable_dictionary", sa.JSON(), nullable=False),
        sa.Column("dataset_payload", sa.JSON(), nullable=False),
        sa.Column("provenance_metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_dataset_snapshots_study_id", "dataset_snapshots", ["study_id"])
    op.create_index("ix_dataset_snapshots_checksum", "dataset_snapshots", ["checksum"])

    # 2. Analysis Runs
    op.create_table(
        "analysis_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dataset_snapshot_id", sa.Uuid(), sa.ForeignKey("dataset_snapshots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("method_id", sa.String(100), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="queued"),
        sa.Column("progress_percent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status_message", sa.String(255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("executed_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("runtime_versions", sa.JSON(), nullable=False),
        sa.Column("snapshot_checksum", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_analysis_runs_study_id", "analysis_runs", ["study_id"])
    op.create_index("ix_analysis_runs_dataset_snapshot_id", "analysis_runs", ["dataset_snapshot_id"])
    op.create_index("ix_analysis_runs_status", "analysis_runs", ["status"])
    op.create_index("ix_analysis_runs_method_id", "analysis_runs", ["method_id"])

    # 3. Statistical Results
    op.create_table(
        "statistical_results",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("run_id", sa.Uuid(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dataset_snapshot_id", sa.Uuid(), sa.ForeignKey("dataset_snapshots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("method_id", sa.String(100), nullable=False),
        sa.Column("sample_size", sa.Integer(), nullable=False),
        sa.Column("excluded_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("missingness_handled", sa.String(50), nullable=False, server_default="complete_case"),
        sa.Column("degrees_of_freedom", sa.JSON(), nullable=True),
        sa.Column("test_statistic", sa.JSON(), nullable=True),
        sa.Column("p_value", sa.Float(), nullable=True),
        sa.Column("effect_size", sa.JSON(), nullable=True),
        sa.Column("confidence_interval", sa.JSON(), nullable=True),
        sa.Column("estimates_table", sa.JSON(), nullable=True),
        sa.Column("assumption_warnings", sa.JSON(), nullable=False),
        sa.Column("distribution_data", sa.JSON(), nullable=True),
        sa.Column("scatter_plot_data", sa.JSON(), nullable=True),
        sa.Column("survival_data", sa.JSON(), nullable=True),
        sa.Column("ai_explanation", sa.JSON(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_statistical_results_run_id", "statistical_results", ["run_id"])
    op.create_index("ix_statistical_results_study_id", "statistical_results", ["study_id"])
    op.create_index("ix_statistical_results_method_id", "statistical_results", ["method_id"])

    # 4. Research Reports
    op.create_table(
        "research_reports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), nullable=False, server_default="csr"),
        sa.Column("version", sa.String(50), nullable=False, server_default="1.0"),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("author_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("sections", sa.JSON(), nullable=False),
        sa.Column("approved_analysis_run_ids", sa.JSON(), nullable=False),
        sa.Column("protocol_version", sa.String(50), nullable=False, server_default="1.0"),
        sa.Column("dataset_snapshot_id", sa.Uuid(), sa.ForeignKey("dataset_snapshots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("summary_executive", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_research_reports_study_id", "research_reports", ["study_id"])
    op.create_index("ix_research_reports_status", "research_reports", ["status"])

    # 5. Export Jobs
    op.create_table(
        "export_jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("format", sa.String(20), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("progress_percent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("file_name", sa.String(255), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("requested_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("de_identified_confirmed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("governance_notice", sa.Text(), nullable=True),
        sa.Column("options", sa.JSON(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_export_jobs_study_id", "export_jobs", ["study_id"])
    op.create_index("ix_export_jobs_status", "export_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("export_jobs")
    op.drop_table("research_reports")
    op.drop_table("statistical_results")
    op.drop_table("analysis_runs")
    op.drop_table("dataset_snapshots")

