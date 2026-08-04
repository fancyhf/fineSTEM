"""
通知消息数据模型

用途：站内通知的创建、列表、未读统计
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json

注意：通知 API 对外统一使用 camelCase 字段名，通过 alias + populate_by_name
与 ORM 侧 snake_case 属性做映射；FastAPI 响应默认按别名序列化。
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


NotificationType = Literal[
    "admin_message",
    "achievement_missing",
    "system",
    "project_featured",
    "demo_offshelf",
]

RelatedType = Literal["project", "achievement_card", "demo"]


class NotificationBase(BaseModel):
    """通知基础字段（camelCase 对外，snake_case 兼容 ORM）"""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    type: NotificationType = Field(..., description="通知类型")
    title: str = Field(..., min_length=1, max_length=255, description="通知标题")
    content: str = Field(..., min_length=1, description="通知正文")
    related_type: Optional[RelatedType] = Field(
        None, alias="relatedType", description="关联对象类型"
    )
    related_id: Optional[str] = Field(
        None, alias="relatedId", description="关联对象 ID"
    )
    link_url: Optional[str] = Field(
        None, alias="linkUrl", max_length=500, description="点击跳转链接"
    )


class Notification(NotificationBase):
    """完整通知模型"""

    id: str = Field(..., description="通知 ID")
    recipient_id: str = Field(..., alias="recipientId", description="收件人用户 ID")
    sender_id: Optional[str] = Field(
        None, alias="senderId", description="发件人用户 ID；系统通知为 NULL"
    )
    is_read: bool = Field(False, alias="isRead", description="是否已读")
    read_at: Optional[datetime] = Field(
        None, alias="readAt", description="标记为已读时间"
    )
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")


class NotificationListItem(Notification):
    """列表页轻量视图（当前与 Notification 一致，预留字段裁剪空间）"""

    pass


class NotificationCreate(BaseModel):
    """
    管理员/系统创建通知的请求

    三选一：
    - recipientId：单人
    - recipientIds：多人
    - broadcast=True：广播给所有学生用户
    """

    model_config = ConfigDict(populate_by_name=True)

    recipient_id: Optional[str] = Field(
        None, alias="recipientId", description="单一收件人 ID"
    )
    recipient_ids: Optional[list[str]] = Field(
        None, alias="recipientIds", description="多收件人 ID 列表"
    )
    broadcast: bool = Field(
        False, description="是否广播给所有学生（与其他二者互斥）"
    )
    type: NotificationType = Field(..., description="通知类型")
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    related_type: Optional[RelatedType] = Field(None, alias="relatedType")
    related_id: Optional[str] = Field(None, alias="relatedId")
    link_url: Optional[str] = Field(None, alias="linkUrl", max_length=500)

    @model_validator(mode="after")
    def _validate_target(self) -> "NotificationCreate":
        has_single = bool(self.recipient_id)
        has_multi = bool(self.recipient_ids)
        if sum([has_single, has_multi, self.broadcast]) != 1:
            raise ValueError(
                "必须且只能指定一种收件人方式：recipientId / recipientIds / broadcast"
            )
        return self


class UnreadCount(BaseModel):
    """未读通知统计"""

    model_config = ConfigDict(populate_by_name=True)

    unread_count: int = Field(..., alias="unreadCount", ge=0)


class MarkAllReadResult(BaseModel):
    """批量标记为已读的结果"""

    model_config = ConfigDict(populate_by_name=True)

    updated_count: int = Field(..., alias="updatedCount", ge=0)


class BroadcastResult(BaseModel):
    """广播/多发通知的结果"""

    model_config = ConfigDict(populate_by_name=True)

    count: int = Field(..., ge=0, description="实际写入的通知条数")
