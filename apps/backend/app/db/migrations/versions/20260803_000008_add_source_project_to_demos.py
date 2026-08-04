"""add source_project_id to demos for project promotion traceability

Revision ID: 20260803_000008
Revises: 20260801_000007
Create Date: 2026-08-03 00:00:00

demos 表新增 source_project_id 列：当 admin 把一个合格项目"收录为 demo"时，
记录来源 project_id，便于追溯。种子数据该列为 NULL。
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260803_000008"
down_revision = "20260801_000007"
branch_labels = None
depends_on = None


def _columns(bind: sa.engine.Connection, table_name: str) -> set[str]:
    rows = bind.execute(sa.text(f"PRAGMA table_info({table_name})")).fetchall()
    return {str(row[1]) for row in rows}


def _index_exists(bind: sa.engine.Connection, index_name: str) -> bool:
    rows = bind.execute(sa.text("PRAGMA index_list(demos)")).fetchall()
    return any(str(row[1]) == index_name for row in rows)


def upgrade() -> None:
    bind = op.get_bind()

    if "source_project_id" not in _columns(bind, "demos"):
        bind.execute(sa.text("ALTER TABLE demos ADD COLUMN source_project_id VARCHAR(64)"))

    # 索引：按来源项目查询（如"这个项目是否已被收录过"）
    if not _index_exists(bind, "ix_demos_source_project_id"):
        bind.execute(
            sa.text("CREATE INDEX ix_demos_source_project_id ON demos (source_project_id)")
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _index_exists(bind, "ix_demos_source_project_id"):
        bind.execute(sa.text("DROP INDEX ix_demos_source_project_id"))
    if "source_project_id" in _columns(bind, "demos"):
        op.drop_column("demos", "source_project_id")
