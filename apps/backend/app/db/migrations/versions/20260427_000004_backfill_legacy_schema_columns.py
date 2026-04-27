"""backfill legacy schema columns for demos/evidence and stage defaults

Revision ID: 20260427_000004
Revises: 20260427_000003
Create Date: 2026-04-27 00:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260427_000004"
down_revision = "20260427_000003"
branch_labels = None
depends_on = None


def _columns(bind: sa.engine.Connection, table_name: str) -> set[str]:
    rows = bind.execute(sa.text(f"PRAGMA table_info({table_name})")).fetchall()
    return {str(row[1]) for row in rows}


def _add_col_if_missing(bind: sa.engine.Connection, table_name: str, column_name: str, ddl: str) -> None:
    if column_name in _columns(bind, table_name):
        return
    bind.execute(sa.text(f"ALTER TABLE {table_name} ADD COLUMN {ddl}"))


def _index_exists(bind: sa.engine.Connection, index_name: str) -> bool:
    rows = bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='index' AND name=:name"), {"name": index_name}).fetchall()
    return len(rows) > 0


def upgrade() -> None:
    bind = op.get_bind()

    # demos: old deployments miss several fields introduced after initial release.
    _add_col_if_missing(bind, "demos", "grade_range", "grade_range VARCHAR(64) NOT NULL DEFAULT '10-18岁'")
    _add_col_if_missing(bind, "demos", "tags", "tags TEXT NOT NULL DEFAULT '[]'")
    _add_col_if_missing(bind, "demos", "iframe_url", "iframe_url VARCHAR(500)")
    _add_col_if_missing(bind, "demos", "screenshots", "screenshots TEXT NOT NULL DEFAULT '[]'")
    _add_col_if_missing(bind, "demos", "demo_video_url", "demo_video_url VARCHAR(500)")
    _add_col_if_missing(bind, "demos", "project_breakdown", "project_breakdown TEXT")
    _add_col_if_missing(bind, "demos", "minimal_replica", "minimal_replica TEXT")
    _add_col_if_missing(bind, "demos", "fork_template_id", "fork_template_id VARCHAR(128)")
    _add_col_if_missing(bind, "demos", "is_public", "is_public BOOLEAN NOT NULL DEFAULT 0")
    _add_col_if_missing(bind, "demos", "submitted_at", "submitted_at DATETIME")

    # evidence: ensure schema aligns with ORM/query usage.
    _add_col_if_missing(bind, "evidence", "author_id", "author_id VARCHAR(64)")
    _add_col_if_missing(bind, "evidence", "content_url", "content_url VARCHAR(500)")
    _add_col_if_missing(bind, "evidence", "related_step", "related_step VARCHAR(64)")

    if not _index_exists(bind, "ix_evidence_project_deleted_created"):
        op.create_index(
            "ix_evidence_project_deleted_created",
            "evidence",
            ["project_id", "is_deleted", "created_at"],
            unique=False,
        )

    # project default alignment for historical data.
    bind.execute(
        sa.text(
            "UPDATE projects SET current_stage='stage_01_brainstorm' "
            "WHERE current_stage IS NULL OR current_stage='stage_00_bootstrap'"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    if _index_exists(bind, "ix_evidence_project_deleted_created"):
        op.drop_index("ix_evidence_project_deleted_created", table_name="evidence")
