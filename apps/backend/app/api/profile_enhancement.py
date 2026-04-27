"""
背景提升模块 API
"""

from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.repositories.runtime_db import db
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.schemas.counseling import (
    ProfileEnhancementPlan,
    ProfileEnhancementPlanCreate,
    ProfileEnhancementPlanUpdate,
)
from app.services.audit_logger import audit_logger_service

router = APIRouter(prefix="/profile-enhancement", tags=["背景提升"])


@router.get("/plans", response_model=ApiResponse[list[ProfileEnhancementPlan]])
async def list_plans(current_user: UserResponse = Depends(get_current_user)):
    return ApiResponse(data=db.list_profile_plans(current_user.id), message="获取成功")


@router.post("/plans", response_model=ApiResponse[ProfileEnhancementPlan])
async def create_plan(payload: ProfileEnhancementPlanCreate, current_user: UserResponse = Depends(get_current_user)):
    item = ProfileEnhancementPlan(
        id=str(uuid.uuid4()),
        owner_id=current_user.id,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        **payload.model_dump(),
    )
    created = db.create_profile_plan(item)
    audit_logger_service.record(current_user.id, "profile_enhancement", "create", created.id, {"status": created.status})
    return ApiResponse(data=created, message="创建成功")


@router.patch("/plans/{item_id}", response_model=ApiResponse[ProfileEnhancementPlan])
async def update_plan(item_id: str, payload: ProfileEnhancementPlanUpdate, current_user: UserResponse = Depends(get_current_user)):
    updated = db.update_profile_plan(item_id, payload.model_dump(exclude_unset=True))
    if not updated or updated.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    audit_logger_service.record(current_user.id, "profile_enhancement", "update", updated.id, {"status": updated.status})
    return ApiResponse(data=updated, message="更新成功")
