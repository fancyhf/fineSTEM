"""
系统运维 API 路由

用途：手动触发数据库备份等运维操作
维护者：AI Agent
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.auth import get_current_user
from app.core.config import settings
from app.schemas.auth import UserResponse
from app.services import backup_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["system"])


class BackupResponse(BaseModel):
    enabled: bool
    backup_path: str
    size_bytes: int
    deleted_old: int


@router.post("/backup", response_model=dict)
async def trigger_backup(
    current_user: UserResponse = Depends(get_current_user),
):
    """
    手动触发数据库备份（用 sqlite3.backup() 在线热备）。

    供运维或外部 cron 调用。定时备份由后端 lifespan 自动管理。
    """
    if not settings.BACKUP_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="备份功能未启用（BACKUP_ENABLED=False）",
        )
    try:
        result = backup_service.run_scheduled_backup()
        logger.info("manual_backup_triggered by=%s result=%s", current_user.id, result)
        return {
            "success": True,
            "data": BackupResponse(
                enabled=True,
                backup_path=result["backup_path"],
                size_bytes=result["size_bytes"],
                deleted_old=result["deleted_old"],
            ).model_dump(),
        }
    except Exception as exc:
        logger.exception("manual_backup_failed user=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"备份失败: {exc}",
        )
