"""
知识来源模块 API
"""

from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.repositories.runtime_db import db
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.schemas.counseling import KnowledgeSource, KnowledgeSourceCreate, KnowledgeSourceUpdate
from app.services.audit_logger import audit_logger_service

router = APIRouter(prefix="/knowledge-sources", tags=["知识来源"])


@router.get("", response_model=ApiResponse[list[KnowledgeSource]])
async def list_sources(current_user: UserResponse = Depends(get_current_user)):
    return ApiResponse(data=db.list_knowledge_sources(current_user.id), message="获取成功")


@router.post("", response_model=ApiResponse[KnowledgeSource])
async def create_source(payload: KnowledgeSourceCreate, current_user: UserResponse = Depends(get_current_user)):
    item = KnowledgeSource(
        id=str(uuid.uuid4()),
        owner_id=current_user.id,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        **payload.model_dump(),
    )
    created = db.create_knowledge_source(item)
    audit_logger_service.record(current_user.id, "knowledge_sources", "create", created.id, {"type": created.source_type})
    return ApiResponse(data=created, message="创建成功")


@router.patch("/{item_id}", response_model=ApiResponse[KnowledgeSource])
async def update_source(item_id: str, payload: KnowledgeSourceUpdate, current_user: UserResponse = Depends(get_current_user)):
    updated = db.update_knowledge_source(item_id, payload.model_dump(exclude_unset=True))
    if not updated or updated.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    audit_logger_service.record(current_user.id, "knowledge_sources", "update", updated.id, {"type": updated.source_type})
    return ApiResponse(data=updated, message="更新成功")
