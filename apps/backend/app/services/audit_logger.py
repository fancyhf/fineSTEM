"""
审计日志服务

用途：统一记录模块操作日志，便于追踪
维护者：AI Agent
"""

from datetime import datetime
import uuid

from app.repositories.runtime_db import db
from app.schemas.counseling import AuditLogItem


class AuditLoggerService:
    def record(self, owner_id: str, module: str, action: str, resource_id: str, detail: dict[str, str] | None = None) -> None:
        item = AuditLogItem(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            module=module,
            action=action,
            resource_id=resource_id,
            detail=detail or {},
            created_at=datetime.utcnow(),
        )
        db.create_audit_log(item)


audit_logger_service = AuditLoggerService()
