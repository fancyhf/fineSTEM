"""
Skill 管理 API 路由

用途：Skill 市场、安装、启停、卸载
维护者：AI Agent
"""

from datetime import datetime
from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.repositories.runtime_db import db
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.schemas.skills import (
    SkillInstallRequest,
    SkillManifest,
    SkillRecord,
    SkillToggleRequest,
)
from app.services.skill_registry import skill_registry_service

router = APIRouter(prefix="/skills", tags=["Skill 管理"])


@router.get("/marketplace", response_model=ApiResponse[List[SkillManifest]])
async def list_marketplace():
    return ApiResponse(data=skill_registry_service.list_marketplace(), message="获取成功")


@router.get("", response_model=ApiResponse[List[SkillRecord]])
async def list_installed_skills(current_user: UserResponse = Depends(get_current_user)):
    items = db.list_installed_skills(current_user.id)
    return ApiResponse(data=items, message="获取成功")


@router.post("/install", response_model=ApiResponse[SkillRecord])
async def install_skill(
    req: SkillInstallRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    manifest = skill_registry_service.get_manifest(req.skill_id)
    if not manifest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill 不存在")

    existing = db.get_installed_skill(current_user.id, req.skill_id)
    if existing:
        existing.status = "enabled"
        existing.config = req.config
        existing.updated_at = datetime.utcnow()
        db.upsert_installed_skill(current_user.id, existing)
        return ApiResponse(data=existing, message="已重新启用")

    record = SkillRecord(
        id=str(uuid.uuid4()),
        owner_id=current_user.id,
        source=req.source,
        status="enabled",
        manifest=manifest,
        config=req.config,
        install_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.upsert_installed_skill(current_user.id, record)
    return ApiResponse(data=record, message="安装成功")


@router.post("/{skill_id}/toggle", response_model=ApiResponse[SkillRecord])
async def toggle_skill(
    skill_id: str,
    req: SkillToggleRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    record = db.get_installed_skill(skill_id, current_user.id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill 未安装")
    record.status = "enabled" if req.enabled else "disabled"
    record.updated_at = datetime.utcnow()
    db.upsert_installed_skill(current_user.id, record)
    return ApiResponse(data=record, message="更新成功")


@router.delete("/{skill_id}", response_model=ApiResponse[bool])
async def uninstall_skill(skill_id: str, current_user: UserResponse = Depends(get_current_user)):
    ok = db.uninstall_skill(skill_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill 未安装")
    return ApiResponse(data=True, message="卸载成功")
