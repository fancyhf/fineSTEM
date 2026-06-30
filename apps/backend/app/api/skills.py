"""
Skill 管理 API 路由（v2 - 动态加载版）

用途：从磁盘动态加载 Skill，支持热重载和查询
维护者：AI Agent
"""

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
from app.core.time_utils import utc_now
from app.services.skill_registry import skill_registry_v2


router = APIRouter(prefix="/skills", tags=["Skill 管理"])


# ==================== 具体路径路由（必须在参数化路径之前）====================

@router.get("/marketplace")
async def list_marketplace():
    skills = skill_registry_v2.list_skills()
    return ApiResponse(data=skills, message="获取成功")


@router.get("/available")
async def list_available_skills():
    """获取所有从磁盘动态加载的 Skill（含阶段详情）"""
    skills = skill_registry_v2.list_skills()
    return ApiResponse(data=skills, message="获取成功")


@router.post("/install")
async def install_skill(
    req: SkillInstallRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    manifest_data = skill_registry_v2.get_skill(req.skill_id)
    if not manifest_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill 不存在")

    manifest = SkillManifest(
        skill_id=manifest_data.skill_id,
        name=manifest_data.name,
        description=manifest_data.description,
        version=manifest_data._loaded.manifest.version,
        entrypoint=manifest_data._loaded.manifest.entrypoint,
        tags=manifest_data._loaded.manifest.tags,
    )

    existing = db.get_installed_skill(current_user.id, req.skill_id)
    if existing:
        existing.status = "enabled"
        existing.config = req.config
        existing.updated_at = utc_now()
        db.upsert_installed_skill(current_user.id, existing)
        return ApiResponse(data=existing, message="已重新启用")

    record = SkillRecord(
        id=str(uuid.uuid4()),
        owner_id=current_user.id,
        source=req.source,
        status="enabled",
        manifest=manifest,
        config=req.config,
        install_date=utc_now(),
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.upsert_installed_skill(current_user.id, record)
    return ApiResponse(data=record, message="安装成功")


# ==================== 参数化路径路由 ====================

@router.get("")
async def list_installed_skills(current_user: UserResponse = Depends(get_current_user)):
    items = db.list_installed_skills(current_user.id)
    return ApiResponse(data=items, message="获取成功")


@router.get("/{skill_id}/detail")
async def get_skill_detail(skill_id: str):
    """获取指定 Skill 的完整定义（包含完整 system prompt）"""
    skill = skill_registry_v2.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' 不存在")

    return ApiResponse(data={
        **skill.to_dict(),
        'base_system_prompt_preview': skill.base_system_prompt[:2000],
        'stage_count': len(skill.stages),
        'trigger_count': len(skill.triggers),
        'has_resource_libraries': bool(skill.resource_libraries),
    }, message="获取成功")


@router.post("/{skill_id}/reload")
async def reload_skill(skill_id: str):
    """热重载指定 Skill（修改 SKILL.md 后调用）"""
    skill = skill_registry_v2.reload_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' 不存在或加载失败")

    return ApiResponse(data={
        'skill_id': skill.skill_id,
        'name': skill.name,
        'reloaded_at': skill._loaded.manifest.loaded_at,
    }, message="重载成功")


@router.post("/{skill_id}/toggle")
async def toggle_skill(
    skill_id: str,
    req: SkillToggleRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    record = db.get_installed_skill(current_user.id, skill_id)
    if not record:
        raise HTTPException(status_code=404, detail="Skill 未安装")
    record.status = "enabled" if req.enabled else "disabled"
    record.updated_at = utc_now()
    db.upsert_installed_skill(current_user.id, record)
    return ApiResponse(data=record, message="更新成功")


@router.delete("/{skill_id}")
async def uninstall_skill(skill_id: str, current_user: UserResponse = Depends(get_current_user)):
    ok = db.remove_installed_skill(current_user.id, skill_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Skill 未卸载")
    return ApiResponse(data=True, message="卸载成功")
