"""add core domain tables

Revision ID: 20260426_000002
Revises: 20260425_000001
Create Date: 2026-04-26 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260426_000002"
down_revision = "20260425_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("from_demo_id", sa.String(length=64), nullable=True))
    op.add_column("projects", sa.Column("initial_data", sa.Text(), nullable=False, server_default="{}"))

    op.create_table(
        "demos",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("tech_stack", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("difficulty", sa.String(length=32), nullable=False, server_default="beginner"),
        sa.Column("subjects", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("grade_range", sa.String(length=64), nullable=False, server_default="10-18岁"),
        sa.Column("tags", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("display_mode", sa.String(length=32), nullable=False, server_default="iframe"),
        sa.Column("iframe_url", sa.String(length=500), nullable=True),
        sa.Column("screenshots", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("demo_video_url", sa.String(length=500), nullable=True),
        sa.Column("project_breakdown", sa.Text(), nullable=True),
        sa.Column("minimal_replica", sa.Text(), nullable=True),
        sa.Column("code_url", sa.String(length=500), nullable=False),
        sa.Column("download_url", sa.String(length=500), nullable=False),
        sa.Column("fork_template_id", sa.String(length=64), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )

    op.create_table(
        "skill_states",
        sa.Column("project_id", sa.String(length=64), primary_key=True),
        sa.Column("version", sa.String(length=16), nullable=False, server_default="1.0.0"),
        sa.Column("mode", sa.String(length=32), nullable=False, server_default="light"),
        sa.Column("current_stage", sa.String(length=64), nullable=False, server_default="stage_01_brainstorm"),
        sa.Column("light_step", sa.String(length=8), nullable=True),
        sa.Column("stages", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("metadata", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("light_to_standard_mapping", sa.Text(), nullable=True),
        sa.Column("stage_history", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("light_step_data", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("standard_step_data", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )

    op.create_table(
        "achievement_cards",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.String(length=64), nullable=False, unique=True),
        sa.Column("author_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("one_liner", sa.Text(), nullable=False),
        sa.Column("problem_solved", sa.Text(), nullable=False),
        sa.Column("method_used", sa.Text(), nullable=False),
        sa.Column("screenshots", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("reflection", sa.Text(), nullable=False),
        sa.Column("capability_tags", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("project_mode", sa.String(length=32), nullable=False, server_default="light"),
        sa.Column("share_token", sa.String(length=64), nullable=True, unique=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_achievement_cards_project_id", "achievement_cards", ["project_id"], unique=True)
    op.create_index("ix_achievement_cards_author_id", "achievement_cards", ["author_id"], unique=False)

    op.create_table(
        "evidence",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.String(length=64), nullable=False),
        sa.Column("author_id", sa.String(length=64), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_url", sa.String(length=500), nullable=True),
        sa.Column("related_step", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_evidence_project_id", "evidence", ["project_id"], unique=False)
    op.create_index("ix_evidence_author_id", "evidence", ["author_id"], unique=False)
    op.create_index("ix_evidence_type", "evidence", ["type"], unique=False)
    op.create_index(
        "ix_evidence_project_deleted_created",
        "evidence",
        ["project_id", "is_deleted", "created_at"],
        unique=False,
    )

    op.create_table(
        "courses",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("subject", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("difficulty", sa.String(length=32), nullable=False, server_default="beginner"),
        sa.Column("tags", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("resource_url", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_courses_owner_id", "courses", ["owner_id"], unique=False)

    op.create_table(
        "project_capability_tags",
        sa.Column("project_id", sa.String(length=64), primary_key=True),
        sa.Column("tags", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("project_capability_tags")
    op.drop_index("ix_courses_owner_id", table_name="courses")
    op.drop_table("courses")
    op.drop_index("ix_evidence_project_deleted_created", table_name="evidence")
    op.drop_index("ix_evidence_type", table_name="evidence")
    op.drop_index("ix_evidence_author_id", table_name="evidence")
    op.drop_index("ix_evidence_project_id", table_name="evidence")
    op.drop_table("evidence")
    op.drop_index("ix_achievement_cards_author_id", table_name="achievement_cards")
    op.drop_index("ix_achievement_cards_project_id", table_name="achievement_cards")
    op.drop_table("achievement_cards")
    op.drop_table("skill_states")
    op.drop_table("demos")
    op.drop_column("projects", "initial_data")
    op.drop_column("projects", "from_demo_id")
