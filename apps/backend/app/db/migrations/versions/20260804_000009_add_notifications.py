"""add notifications table for user messaging MVP

Revision ID: 20260804_000009
Revises: 20260803_000008
Create Date: 2026-08-04 00:00:00

新增 notifications 表：
- 承载管理员通知、系统消息、精选/下架告知、成果卡缺失提醒等站内消息
- 索引 ix_notifications_recipient_read_created(recipient_id, is_read, created_at DESC)
  服务收件箱查询与未读计数
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260804_000009"
down_revision = "20260803_000008"
branch_labels = None
depends_on = None


def _table_exists(bind: sa.engine.Connection, table_name: str) -> bool:
    rows = bind.execute(
        sa.text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=:name"
        ),
        {"name": table_name},
    ).fetchall()
    return len(rows) > 0


def _index_exists(bind: sa.engine.Connection, index_name: str) -> bool:
    rows = bind.execute(
        sa.text(
            "SELECT name FROM sqlite_master WHERE type='index' AND name=:name"
        ),
        {"name": index_name},
    ).fetchall()
    return len(rows) > 0


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", sa.String(length=64), primary_key=True),
            sa.Column("recipient_id", sa.String(length=64), nullable=False),
            sa.Column("sender_id", sa.String(length=64), nullable=True),
            sa.Column("type", sa.String(length=32), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("related_type", sa.String(length=32), nullable=True),
            sa.Column("related_id", sa.String(length=64), nullable=True),
            sa.Column("link_url", sa.String(length=500), nullable=True),
            sa.Column(
                "is_read", sa.Boolean(), nullable=False, server_default=sa.text("0")
            ),
            sa.Column("read_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("created_by", sa.String(length=64), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.Column("updated_by", sa.String(length=64), nullable=True),
            sa.Column("deleted_at", sa.DateTime(), nullable=True),
            sa.Column("deleted_by", sa.String(length=64), nullable=True),
            sa.Column(
                "is_deleted",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            ),
        )

    if not _index_exists(bind, "ix_notifications_recipient_id"):
        op.create_index(
            "ix_notifications_recipient_id", "notifications", ["recipient_id"]
        )
    if not _index_exists(bind, "ix_notifications_type"):
        op.create_index("ix_notifications_type", "notifications", ["type"])
    if not _index_exists(bind, "ix_notifications_related_id"):
        op.create_index(
            "ix_notifications_related_id", "notifications", ["related_id"]
        )
    if not _index_exists(bind, "ix_notifications_is_read"):
        op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
    if not _index_exists(bind, "ix_notifications_recipient_read_created"):
        op.create_index(
            "ix_notifications_recipient_read_created",
            "notifications",
            ["recipient_id", "is_read", sa.text("created_at DESC")],
        )


def downgrade() -> None:
    bind = op.get_bind()

    for index_name in (
        "ix_notifications_recipient_read_created",
        "ix_notifications_is_read",
        "ix_notifications_related_id",
        "ix_notifications_type",
        "ix_notifications_recipient_id",
    ):
        if _index_exists(bind, index_name):
            op.drop_index(index_name, table_name="notifications")

    if _table_exists(bind, "notifications"):
        op.drop_table("notifications")
