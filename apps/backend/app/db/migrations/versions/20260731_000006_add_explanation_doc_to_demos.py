"""add explanation_doc column to demos for seeded code explanation docs

Revision ID: 20260731_000006
Revises: 20260715_000005
Create Date: 2026-07-31 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260731_000006"
down_revision = "20260715_000005"
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

    # demos: 讲解文档（种子预写，Demo 详情「讲解」页签数据源）
    _add_col_if_missing(bind, "demos", "explanation_doc", "explanation_doc TEXT")


def downgrade() -> None:
    bind = op.get_bind()
    if "explanation_doc" in _columns(bind, "demos"):
        op.drop_column("demos", "explanation_doc")
