"""
审计日志模块 API
"""

from fastapi import APIRouter, Depends

from app.api.auth import get_current_user
from app.repositories.runtime_db import db
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.schemas.counseling import AuditLogItem

router = APIRouter(prefix="/audit-logs", tags=["审计日志"])


@router.get("", response_model=ApiResponse[list[AuditLogItem]])
async def list_logs(module: str | None = None, current_user: UserResponse = Depends(get_current_user)):
    return ApiResponse(data=db.list_audit_logs(current_user.id, module=module), message="获取成功")
