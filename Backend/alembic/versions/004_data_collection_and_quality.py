"""Data Collection, Consent, Offline Sync, and Data Quality schema

Revision ID: 004_data_collection_and_quality
Revises: 003_questionnaire_management
Create Date: 2026-10-28 10:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "004_data_collection_and_quality"
down_revision: Union[str, None] = "003_questionnaire_management"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Participants
    op.create_table(
        "participants",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("identifier_code", sa.String(100), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="enrolled"),
        sa.Column("enrollment_date", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("cohort", sa.String(100), nullable=True),
        sa.Column("site_location", sa.String(255), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("withdrawal_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("study_id", "identifier_code", name="uq_study_participant_code"),
    )
    op.create_index("ix_participants_study_id", "participants", ["study_id"])
    op.create_index("ix_participants_identifier_code", "participants", ["identifier_code"])
    op.create_index("ix_participants_status", "participants", ["status"])

    # 2. Participant Identity Mappings (Separate PII store)
    op.create_table(
        "participant_identity_mappings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("participant_id", sa.Uuid(), sa.ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("encrypted_identity_payload", sa.Text(), nullable=True),
        sa.Column("external_mrn", sa.String(100), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("contact_phone", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_participant_identity_mappings_participant_id", "participant_identity_mappings", ["participant_id"])
    op.create_index("ix_participant_identity_mappings_external_mrn", "participant_identity_mappings", ["external_mrn"])

    # 3. Consent Records
    op.create_table(
        "consent_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("questionnaire_id", sa.Uuid(), sa.ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False),
        sa.Column("questionnaire_version", sa.String(50), nullable=False),
        sa.Column("participant_id", sa.Uuid(), sa.ForeignKey("participants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("participant_identifier", sa.String(100), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("agreed_to_participate", sa.Boolean(), nullable=False),
        sa.Column("agreed_to_data_storage", sa.Boolean(), nullable=False),
        sa.Column("agreed_to_contact", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("agreed_statements", sa.JSON(), nullable=False),
        sa.Column("wording_version", sa.String(100), nullable=False),
        sa.Column("consent_text_hash", sa.String(64), nullable=True),
        sa.Column("confirmation_code", sa.String(64), unique=True, nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("withdrawal_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_consent_records_study_id", "consent_records", ["study_id"])
    op.create_index("ix_consent_records_questionnaire_id", "consent_records", ["questionnaire_id"])
    op.create_index("ix_consent_records_participant_id", "consent_records", ["participant_id"])
    op.create_index("ix_consent_records_participant_identifier", "consent_records", ["participant_identifier"])
    op.create_index("ix_consent_records_confirmation_code", "consent_records", ["confirmation_code"])

    # 4. Survey Invitations
    op.create_table(
        "survey_invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("questionnaire_id", sa.Uuid(), sa.ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False),
        sa.Column("participant_id", sa.Uuid(), sa.ForeignKey("participants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("token_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("token_prefix", sa.String(16), nullable=False),
        sa.Column("access_mode", sa.String(50), nullable=False, server_default="invitation_only"),
        sa.Column("max_uses", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("uses_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_survey_invitations_study_id", "survey_invitations", ["study_id"])
    op.create_index("ix_survey_invitations_questionnaire_id", "survey_invitations", ["questionnaire_id"])
    op.create_index("ix_survey_invitations_token_hash", "survey_invitations", ["token_hash"])

    # 5. Sync Batches
    op.create_table(
        "sync_batches",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("submitted_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("total_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("accepted_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicate_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rejected_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("conflict_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("results_summary", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_sync_batches_study_id", "sync_batches", ["study_id"])
    op.create_index("ix_sync_batches_submitted_by_user_id", "sync_batches", ["submitted_by_user_id"])

    # 6. Survey Responses
    op.create_table(
        "survey_responses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("questionnaire_id", sa.Uuid(), sa.ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False),
        sa.Column("questionnaire_version_id", sa.Uuid(), sa.ForeignKey("questionnaire_versions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("questionnaire_version", sa.String(50), nullable=False),
        sa.Column("participant_id", sa.Uuid(), sa.ForeignKey("participants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("participant_identifier", sa.String(100), nullable=False),
        sa.Column("consent_record_id", sa.Uuid(), sa.ForeignKey("consent_records.id", ondelete="SET NULL"), nullable=True),
        sa.Column("invitation_id", sa.Uuid(), sa.ForeignKey("survey_invitations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="completed"),
        sa.Column("confirmation_id", sa.String(64), unique=True, nullable=False),
        sa.Column("sync_source", sa.String(50), nullable=False, server_default="online"),
        sa.Column("sync_batch_id", sa.Uuid(), sa.ForeignKey("sync_batches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("client_submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("server_received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_survey_responses_study_id", "survey_responses", ["study_id"])
    op.create_index("ix_survey_responses_questionnaire_id", "survey_responses", ["questionnaire_id"])
    op.create_index("ix_survey_responses_participant_identifier", "survey_responses", ["participant_identifier"])
    op.create_index("ix_survey_responses_confirmation_id", "survey_responses", ["confirmation_id"])

    # 7. Survey Response Answers
    op.create_table(
        "survey_response_answers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("response_id", sa.Uuid(), sa.ForeignKey("survey_responses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.String(100), nullable=False),
        sa.Column("variable_name", sa.String(100), nullable=False),
        sa.Column("raw_value", sa.JSON(), nullable=True),
        sa.Column("is_missing", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_survey_response_answers_response_id", "survey_response_answers", ["response_id"])
    op.create_index("ix_survey_response_answers_question_id", "survey_response_answers", ["question_id"])
    op.create_index("ix_survey_response_answers_variable_name", "survey_response_answers", ["variable_name"])

    # 8. Data Quality Issues
    op.create_table(
        "data_quality_issues",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("study_id", sa.Uuid(), sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("response_id", sa.Uuid(), sa.ForeignKey("survey_responses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.String(100), nullable=True),
        sa.Column("variable_name", sa.String(100), nullable=True),
        sa.Column("issue_type", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(50), nullable=False, server_default="medium"),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="open"),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("resolved_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_data_quality_issues_study_id", "data_quality_issues", ["study_id"])
    op.create_index("ix_data_quality_issues_response_id", "data_quality_issues", ["response_id"])
    op.create_index("ix_data_quality_issues_status", "data_quality_issues", ["status"])
    op.create_index("ix_data_quality_issues_issue_type", "data_quality_issues", ["issue_type"])

    # 9. Response Correction History
    op.create_table(
        "response_correction_history",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("response_id", sa.Uuid(), sa.ForeignKey("survey_responses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.String(100), nullable=False),
        sa.Column("variable_name", sa.String(100), nullable=False),
        sa.Column("original_value", sa.JSON(), nullable=True),
        sa.Column("corrected_value", sa.JSON(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("corrected_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("corrected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_response_correction_history_response_id", "response_correction_history", ["response_id"])
    op.create_index("ix_response_correction_history_corrected_by", "response_correction_history", ["corrected_by_user_id"])


def downgrade() -> None:
    op.drop_table("response_correction_history")
    op.drop_table("data_quality_issues")
    op.drop_table("survey_response_answers")
    op.drop_table("survey_responses")
    op.drop_table("sync_batches")
    op.drop_table("survey_invitations")
    op.drop_table("consent_records")
    op.drop_table("participant_identity_mappings")
    op.drop_table("participants")

