"""
通知消息 API 路由

用途：站内通知的收件箱、未读计数、已读、删除、管理员发信/广播
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.auth import get_current_user, require_admin
from app.repositories.runtime_db import db
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse, PaginationResult
from app.schemas.notifications import (
    BroadcastResult,
    MarkAllReadResult,
    Notification,
    NotificationCreate,
    UnreadCount,
)


router = APIRouter(
    prefix="/notifications",
    tags=["通知消息"],
    # 前端 TS 类型统一为 camelCase，本模块响应显式按别名序列化
)


@router.get(
    "",
    response_model=ApiResponse[PaginationResult[Notification]],
    response_model_by_alias=True,
)
async def list_notifications(
    unread_only: bool = Query(False, alias="unreadOnly"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, alias="pageSize", ge=1, le=100),
    current_user: UserResponse = Depends(get_current_user),
):
    """获取当前用户的通知列表（按创建时间倒序）。"""
    skip = (page - 1) * page_size
    items = db.list_notifications(
        user_id=current_user.id,
        unread_only=unread_only,
        skip=skip,
        limit=page_size,
    )
    total = db.count_notifications(current_user.id, unread_only=unread_only)
    total_pages = (total + page_size - 1) // page_size
    return ApiResponse(
        data=PaginationResult(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ),
        message="获取成功",
    )


@router.get(
    "/unread-count",
    response_model=ApiResponse[UnreadCount],
    response_model_by_alias=True,
)
async def get_unread_count(
    current_user: UserResponse = Depends(get_current_user),
):
    """未读通知数量。"""
    count = db.count_unread_notifications(current_user.id)
    return ApiResponse(data=UnreadCount(unread_count=count), message="获取成功")


@router.patch(
    "/read-all",
    response_model=ApiResponse[MarkAllReadResult],
    response_model_by_alias=True,
)
async def mark_all_read(
    current_user: UserResponse = Depends(get_current_user),
):
    """将当前用户的所有未读通知标记为已读。"""
    updated = db.mark_all_notifications_read(current_user.id)
    return ApiResponse(
        data=MarkAllReadResult(updated_count=updated),
        message=f"已标记 {updated} 条为已读",
    )


@router.patch(
    "/{notification_id}/read",
    response_model=ApiResponse[Notification],
    response_model_by_alias=True,
)
async def mark_read(
    notification_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """将指定通知标记为已读。"""
    result = db.mark_notification_read(notification_id, current_user.id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在或无权访问",
        )
    return ApiResponse(data=result, message="已标记为已读")


@router.delete("/{notification_id}", response_model=ApiResponse[bool])
async def delete_notification(
    notification_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """删除通知（软删除，仅收件人可删）。"""
    ok = db.soft_delete_notification(notification_id, current_user.id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在或无权访问",
        )
    return ApiResponse(data=True, message="已删除")


@router.post(
    "",
    response_model=ApiResponse[BroadcastResult],
    response_model_by_alias=True,
)
async def admin_create_notification(
    payload: NotificationCreate,
    admin: UserResponse = Depends(require_admin),
):
    """
    管理员创建通知（单发 / 群发 / 广播三选一）。

    响应统一返回写入条数，便于前端统一处理。
    """
    if payload.broadcast:
        count = db.broadcast_notification_to_students(
            sender_id=admin.id,
            type_=payload.type,
            title=payload.title,
            content=payload.content,
            related_type=payload.related_type,
            related_id=payload.related_id,
            link_url=payload.link_url,
        )
    elif payload.recipient_ids:
        count = db.create_notifications_bulk(
            recipient_ids=payload.recipient_ids,
            sender_id=admin.id,
            type_=payload.type,
            title=payload.title,
            content=payload.content,
            related_type=payload.related_type,
            related_id=payload.related_id,
            link_url=payload.link_url,
        )
    else:
        recipient_id = payload.recipient_id
        if not recipient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="缺少收件人",
            )
        recipient = db.get_user(recipient_id)
        if not recipient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="收件人不存在",
            )
        db.create_notification(
            recipient_id=recipient_id,
            sender_id=admin.id,
            type_=payload.type,
            title=payload.title,
            content=payload.content,
            related_type=payload.related_type,
            related_id=payload.related_id,
            link_url=payload.link_url,
        )
        count = 1

    if count == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="未能创建任何通知（收件人为空）",
        )
    return ApiResponse(
        data=BroadcastResult(count=count),
        message=f"通知已发送（{count} 条）",
    )
