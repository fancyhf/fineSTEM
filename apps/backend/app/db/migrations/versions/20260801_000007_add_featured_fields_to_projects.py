"""add featured fields to projects for homepage curation

Revision ID: 20260801_000007
Revises: 20260731_000006
Create Date: 2026-08-01 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260801_000007"
down_revision = "20260731_000006"
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

    # projects: add featured fields for homepage curation
    # is_featured_demo: 是否作为精选 Demo 展示在首页
    _add_col_if_missing(bind, "projects", "is_featured_demo", "is_featured_demo BOOLEAN NOT NULL DEFAULT 0")
    _add_col_if_missing(bind, "projects", "featured_demo_sort_order", "featured_demo_sort_order INTEGER NOT NULL DEFAULT 0")
    _add_col_if_missing(bind, "projects", "featured_demo_at", "featured_demo_at DATETIME")
    
    # is_featured_work: 是否作为精选作品展示在首页（与 achievement_cards.is_featured 平行，但基于项目）
    _add_col_if_missing(bind, "projects", "is_featured_work", "is_featured_work BOOLEAN NOT NULL DEFAULT 0")
    _add_col_if_missing(bind, "projects", "featured_work_sort_order", "featured_work_sort_order INTEGER NOT NULL DEFAULT 0")
    _add_col_if_missing(bind, "projects", "featured_work_at", "featured_work_at DATETIME")
    
    # visibility: 项目可见性（private, link, public）
    _add_col_if_missing(bind, "projects", "visibility", "visibility VARCHAR(32) DEFAULT 'private'")


def downgrade() -> None:
    bind = op.get_bind()
    for col in (
        "visibility",
        "featured_work_at", "featured_work_sort_order", "is_featured_work",
        "featured_demo_at", "featured_demo_sort_order", "is_featured_demo",
    ):
        if col in _columns(bind, "projects"):
            op.drop_column("projects", col)
