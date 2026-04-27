"""add counseling and skill tables plus missing columns

Revision ID: 20260427_000003
Revises: 20260426_000002
Create Date: 2026-04-27 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260427_000003"
down_revision = "20260426_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "skill_records",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="builtin"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="enabled"),
        sa.Column("manifest", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("config", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("install_date", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_skill_records_owner_id", "skill_records", ["owner_id"], unique=False)

    op.create_table(
        "hk_macao_plans",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("student_name", sa.String(length=100), nullable=False),
        sa.Column("grade", sa.String(length=50), nullable=False),
        sa.Column("target_track", sa.String(length=16), nullable=False, server_default="both"),
        sa.Column("timeline", sa.Text(), nullable=False, server_default=""),
        sa.Column("requirement_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_hk_macao_plans_owner_id", "hk_macao_plans", ["owner_id"], unique=False)

    op.create_table(
        "international_plans",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("student_name", sa.String(length=100), nullable=False),
        sa.Column("grade", sa.String(length=50), nullable=False),
        sa.Column("target_country", sa.String(length=100), nullable=False),
        sa.Column("target_school_level", sa.String(length=64), nullable=False, server_default="undergraduate"),
        sa.Column("timeline", sa.Text(), nullable=False, server_default=""),
        sa.Column("requirement_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_international_plans_owner_id", "international_plans", ["owner_id"], unique=False)

    op.create_table(
        "profile_enhancement_plans",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("student_name", sa.String(length=100), nullable=False),
        sa.Column("objective", sa.String(length=300), nullable=False),
        sa.Column("activities", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("evidence_targets", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_profile_enhancement_plans_owner_id", "profile_enhancement_plans", ["owner_id"], unique=False)

    op.create_table(
        "knowledge_sources",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False, server_default="article"),
        sa.Column("url", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("reliability_score", sa.Integer(), nullable=False, server_default=sa.text("70")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_knowledge_sources_owner_id", "knowledge_sources", ["owner_id"], unique=False)

    op.create_table(
        "questionnaire_templates",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("questions", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_questionnaire_templates_owner_id", "questionnaire_templates", ["owner_id"], unique=False)

    op.create_table(
        "questionnaire_responses",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("template_id", sa.String(length=64), nullable=False),
        sa.Column("respondent_name", sa.String(length=100), nullable=False),
        sa.Column("answers", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("completion_rate", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_questionnaire_responses_template_id", "questionnaire_responses", ["template_id"], unique=False)

    op.create_table(
        "dialogue_sessions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_dialogue_sessions_owner_id", "dialogue_sessions", ["owner_id"], unique=False)

    op.create_table(
        "dialogue_messages",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("session_id", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_dialogue_messages_session_id", "dialogue_messages", ["session_id"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("module", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=64), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_audit_logs_owner_id", "audit_logs", ["owner_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_owner_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_dialogue_messages_session_id", table_name="dialogue_messages")
    op.drop_table("dialogue_messages")
    op.drop_index("ix_dialogue_sessions_owner_id", table_name="dialogue_sessions")
    op.drop_table("dialogue_sessions")
    op.drop_index("ix_questionnaire_responses_template_id", table_name="questionnaire_responses")
    op.drop_table("questionnaire_responses")
    op.drop_index("ix_questionnaire_templates_owner_id", table_name="questionnaire_templates")
    op.drop_table("questionnaire_templates")
    op.drop_index("ix_knowledge_sources_owner_id", table_name="knowledge_sources")
    op.drop_table("knowledge_sources")
    op.drop_index("ix_profile_enhancement_plans_owner_id", table_name="profile_enhancement_plans")
    op.drop_table("profile_enhancement_plans")
    op.drop_index("ix_international_plans_owner_id", table_name="international_plans")
    op.drop_table("international_plans")
    op.drop_index("ix_hk_macao_plans_owner_id", table_name="hk_macao_plans")
    op.drop_table("hk_macao_plans")
    op.drop_index("ix_skill_records_owner_id", table_name="skill_records")
    op.drop_table("skill_records")
