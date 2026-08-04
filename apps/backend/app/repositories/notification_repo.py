"""
通知消息 Repository

用途：站内通知的 CRUD、未读计数、广播派发
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from __future__ import annotations

import uuid
from typing import Iterable

from app.core.time_utils import utc_now
from app.db.models import NotificationModel, UserModel
from app.repositories.base import BaseRepository
from app.schemas.notifications import Notification


def _to_schema(model: NotificationModel) -> Notification:
    """将 ORM 行映射为对外 Pydantic 模型。"""
    return Notification.model_validate(model, from_attributes=True)


class NotificationRepo(BaseRepository):
    def get(self, notification_id: str) -> Notification | None:
        row = self.db.get(NotificationModel, notification_id)
        if not row or row.is_deleted:
            return None
        return _to_schema(row)

    def list_for_user(
        self,
        user_id: str,
        unread_only: bool = False,
        skip: int = 0,
        limit: int = 20,
    ) -> list[Notification]:
        query = self.db.query(NotificationModel).filter(
            NotificationModel.recipient_id == user_id,
            NotificationModel.is_deleted.is_(False),
        )
        if unread_only:
            query = query.filter(NotificationModel.is_read.is_(False))
        rows = (
            query.order_by(NotificationModel.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return [_to_schema(r) for r in rows]

    def count_for_user(self, user_id: str, unread_only: bool = False) -> int:
        query = self.db.query(NotificationModel).filter(
            NotificationModel.recipient_id == user_id,
            NotificationModel.is_deleted.is_(False),
        )
        if unread_only:
            query = query.filter(NotificationModel.is_read.is_(False))
        return query.count()

    def count_unread(self, user_id: str) -> int:
        return self.count_for_user(user_id, unread_only=True)

    def _insert(
        self,
        recipient_id: str,
        sender_id: str | None,
        type_: str,
        title: str,
        content: str,
        related_type: str | None,
        related_id: str | None,
        link_url: str | None,
    ) -> NotificationModel:
        now = utc_now()
        row = NotificationModel(
            id=str(uuid.uuid4()),
            recipient_id=recipient_id,
            sender_id=sender_id,
            type=type_,
            title=title,
            content=content,
            related_type=related_type,
            related_id=related_id,
            link_url=link_url,
            is_read=False,
            read_at=None,
            created_at=now,
            created_by=sender_id,
            updated_at=now,
            updated_by=sender_id,
            is_deleted=False,
        )
        self.db.add(row)
        return row

    def create(
        self,
        *,
        recipient_id: str,
        type_: str,
        title: str,
        content: str,
        sender_id: str | None = None,
        related_type: str | None = None,
        related_id: str | None = None,
        link_url: str | None = None,
    ) -> Notification:
        row = self._insert(
            recipient_id=recipient_id,
            sender_id=sender_id,
            type_=type_,
            title=title,
            content=content,
            related_type=related_type,
            related_id=related_id,
            link_url=link_url,
        )
        self.db.commit()
        self.db.refresh(row)
        return _to_schema(row)

    def create_many(
        self,
        *,
        recipient_ids: Iterable[str],
        type_: str,
        title: str,
        content: str,
        sender_id: str | None = None,
        related_type: str | None = None,
        related_id: str | None = None,
        link_url: str | None = None,
    ) -> int:
        count = 0
        for rid in recipient_ids:
            if not rid:
                continue
            self._insert(
                recipient_id=rid,
                sender_id=sender_id,
                type_=type_,
                title=title,
                content=content,
                related_type=related_type,
                related_id=related_id,
                link_url=link_url,
            )
            count += 1
        if count:
            self.db.commit()
        return count

    def broadcast_to_students(
        self,
        *,
        sender_id: str | None,
        type_: str,
        title: str,
        content: str,
        related_type: str | None = None,
        related_id: str | None = None,
        link_url: str | None = None,
    ) -> int:
        student_ids = [
            row[0]
            for row in self.db.query(UserModel.id)
            .filter(
                UserModel.role == "student",
                UserModel.is_deleted.is_(False),
            )
            .all()
        ]
        return self.create_many(
            recipient_ids=student_ids,
            type_=type_,
            title=title,
            content=content,
            sender_id=sender_id,
            related_type=related_type,
            related_id=related_id,
            link_url=link_url,
        )

    def mark_read(self, notification_id: str, user_id: str) -> Notification | None:
        row = self.db.get(NotificationModel, notification_id)
        if not row or row.is_deleted or row.recipient_id != user_id:
            return None
        if not row.is_read:
            row.is_read = True
            row.read_at = utc_now()
            row.updated_at = utc_now()
            self.db.commit()
            self.db.refresh(row)
        return _to_schema(row)

    def mark_all_read(self, user_id: str) -> int:
        now = utc_now()
        updated = (
            self.db.query(NotificationModel)
            .filter(
                NotificationModel.recipient_id == user_id,
                NotificationModel.is_deleted.is_(False),
                NotificationModel.is_read.is_(False),
            )
            .update(
                {
                    NotificationModel.is_read: True,
                    NotificationModel.read_at: now,
                    NotificationModel.updated_at: now,
                },
                synchronize_session=False,
            )
        )
        if updated:
            self.db.commit()
        return int(updated)

    def soft_delete(self, notification_id: str, user_id: str) -> bool:
        row = self.db.get(NotificationModel, notification_id)
        if not row or row.is_deleted or row.recipient_id != user_id:
            return False
        now = utc_now()
        row.is_deleted = True
        row.deleted_at = now
        row.deleted_by = user_id
        row.updated_at = now
        self.db.commit()
        return True
