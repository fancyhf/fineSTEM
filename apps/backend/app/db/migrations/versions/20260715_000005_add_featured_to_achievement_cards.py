"""add featured columns to achievement_cards for homepage featured projects

Revision ID: 20260715_000005
Revises: 20260427_000004
Create Date: 2026-07-15 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260715_000005"
down_revision = "20260427_000004"
branch_labels = None
depends_on = None


def _columns(bind: sa.engine.Connection, table_name: str) -> set[str]:
    rows = bind.execute(sa.text(f"PRAGMA table_info({table_name})")).fetchall()
    return {str(row[1]) for row in rows}


def _add_col_if_missing(bind: sa.engine.Connection, table_name: str, column_name: str, ddl: str) -> None:
    if column_name in _columns(bind, table_name):
        return
    bind.execute(sa.text(f"ALTER TABLE {table_name} ADD COLUMN {ddl}"))


def upgrade() -> None:
    bind = op.get_bind()

    # achievement_cards: add featured fields for homepage curation.
    _add_col_if_missing(bind, "achievement_cards", "is_featured", "is_featured BOOLEAN NOT NULL DEFAULT 0")
    _add_col_if_missing(bind, "achievement_cards", "featured_sort_order", "featured_sort_order INTEGER NOT NULL DEFAULT 0")
    _add_col_if_missing(bind, "achievement_cards", "featured_at", "featured_at DATETIME")


def downgrade() -> None:
    bind = op.get_bind()
    for col in ("featured_at", "featured_sort_order", "is_featured"):
        if col in _columns(bind, "achievement_cards"):
            op.drop_column("achievement_cards", col)
