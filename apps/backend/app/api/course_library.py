"""
课程库与能力标签 API

用途：课程资源维护、项目能力标签推荐与应用
维护者：AI Agent
"""

from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.repositories.runtime_db import db
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.schemas.course_library import (
    CapabilityTagApplyRequest,
    CapabilityTagSuggestion,
    Course,
    CourseCreate,
)

router = APIRouter(prefix="/course-library", tags=["课程库"])
cap_router = APIRouter(prefix="/capability-tags", tags=["能力标签"])


@router.get("/courses", response_model=ApiResponse[list[Course]])
async def list_courses(current_user: UserResponse = Depends(get_current_user)):
    return ApiResponse(data=db.list_courses(current_user.id), message="获取成功")


@router.post("/courses", response_model=ApiResponse[Course])
async def create_course(
    payload: CourseCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    item = Course(
        id=str(uuid.uuid4()),
        owner_id=current_user.id,
        **payload.model_dump(),
    )
    created = db.create_course(item)
    return ApiResponse(data=created, message="创建成功")


def _infer_capability_tags(project_name: str, description: str) -> list[str]:
    text = f"{project_name} {description}".lower()
    rules: list[tuple[str, str]] = [
        ("ai", "AI应用"),
        ("ml", "机器学习"),
        ("python", "Python开发"),
        ("web", "Web开发"),
        ("react", "前端工程"),
        ("data", "数据分析"),
        ("robot", "机器人"),
        ("iot", "物联网"),
        ("hardware", "硬件实践"),
    ]
    tags: list[str] = []
    for key, tag in rules:
        if re.search(re.escape(key), text):
            tags.append(tag)
    if not tags:
        tags = ["问题拆解", "项目实践"]
    # 去重并保持顺序
    seen = set()
    deduped: list[str] = []
    for item in tags:
        if item not in seen:
            deduped.append(item)
            seen.add(item)
    return deduped


@cap_router.get("/projects/{project_id}/recommend", response_model=ApiResponse[CapabilityTagSuggestion])
async def recommend_project_capability_tags(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此项目")
    tags = _infer_capability_tags(project.name, getattr(project, "description", "") or "")
    return ApiResponse(
        data=CapabilityTagSuggestion(
            project_id=project_id,
            tags=tags,
            reason="根据项目名称、描述与技术关键词自动推断",
        ),
        message="推荐成功",
    )


@cap_router.post("/projects/{project_id}/apply", response_model=ApiResponse[list[str]])
async def apply_project_capability_tags(
    project_id: str,
    payload: CapabilityTagApplyRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此项目")
    saved = db.set_project_capability_tags(project_id, payload.tags)
    return ApiResponse(data=saved, message="应用成功")


@cap_router.get("/projects/{project_id}", response_model=ApiResponse[list[str]])
async def get_project_capability_tags(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权查看此项目")
    return ApiResponse(data=db.get_project_capability_tags(project_id), message="获取成功")
