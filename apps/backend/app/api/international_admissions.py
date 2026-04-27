"""
国际升学模块 API
"""

from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.repositories.runtime_db import db
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.schemas.counseling import InternationalPlan, InternationalPlanCreate, InternationalPlanUpdate
from app.services.audit_logger import audit_logger_service

router = APIRouter(prefix="/international-admissions", tags=["国际升学"])


@router.get("/plans", response_model=ApiResponse[list[InternationalPlan]])
async def list_plans(current_user: UserResponse = Depends(get_current_user)):
    return ApiResponse(data=db.list_international_plans(current_user.id), message="获取成功")


@router.post("/plans", response_model=ApiResponse[InternationalPlan])
async def create_plan(payload: InternationalPlanCreate, current_user: UserResponse = Depends(get_current_user)):
    item = InternationalPlan(
        id=str(uuid.uuid4()),
        owner_id=current_user.id,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        **payload.model_dump(),
    )
    created = db.create_international_plan(item)
    audit_logger_service.record(current_user.id, "international_admissions", "create", created.id, {"country": created.target_country})
    return ApiResponse(data=created, message="创建成功")


@router.patch("/plans/{item_id}", response_model=ApiResponse[InternationalPlan])
async def update_plan(item_id: str, payload: InternationalPlanUpdate, current_user: UserResponse = Depends(get_current_user)):
    updated = db.update_international_plan(item_id, payload.model_dump(exclude_unset=True))
    if not updated or updated.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    audit_logger_service.record(current_user.id, "international_admissions", "update", updated.id, {"status": updated.status})
    return ApiResponse(data=updated, message="更新成功")
