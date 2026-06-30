"""
能力标签 API 路由

用途：为项目推荐、应用和读取能力标签，支撑成果档案与项目复盘。
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json#capability-tags
"""

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.repositories.runtime_db import db
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse


router = APIRouter(prefix="/capability-tags", tags=["能力标签"])


class CapabilityTagsApplyRequest(BaseModel):
    """项目能力标签应用请求。"""

    tags: list[str] = Field(default_factory=list, description="要写入项目的能力标签")


def _ensure_project_owner(project_id: str, current_user: UserResponse):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if getattr(project, "author_id", None) != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该项目")
    return project


def _recommend_tags(project_name: str, current_stage: str) -> list[str]:
    source = f"{project_name} {current_stage}".lower()
    tags: list[str] = []
    if any(keyword in source for keyword in ("ai", "智能", "模型", "生成")):
        tags.append("AI应用")
    if any(keyword in source for keyword in ("数据", "分析", "统计", "图表")):
        tags.append("数据分析")
    if any(keyword in source for keyword in ("web", "网页", "html", "javascript", "前端")):
        tags.append("Web开发")
    if any(keyword in source for keyword in ("python", "代码", "编程", "程序")):
        tags.append("编程")
    if not tags:
        tags.extend(["项目规划", "问题解决"])
    return list(dict.fromkeys(tags))


@router.get("/projects/{project_id}/recommend")
async def recommend_capability_tags(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """基于项目名称和阶段推荐能力标签。"""

    project = _ensure_project_owner(project_id, current_user)
    existing_tags = db.get_project_capability_tags(project_id)
    recommended_tags = existing_tags or _recommend_tags(
        getattr(project, "name", ""),
        getattr(project, "current_stage", ""),
    )
    return ApiResponse(data={"tags": recommended_tags}, message="获取成功")


@router.post("/projects/{project_id}/apply", response_model=ApiResponse[list[str]])
async def apply_capability_tags(
    project_id: str,
    req: CapabilityTagsApplyRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """保存项目能力标签。"""

    _ensure_project_owner(project_id, current_user)
    tags = db.set_project_capability_tags(project_id, req.tags)
    return ApiResponse(data=tags, message="保存成功")


@router.get("/projects/{project_id}", response_model=ApiResponse[list[str]])
async def get_capability_tags(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """读取项目能力标签。"""

    _ensure_project_owner(project_id, current_user)
    return ApiResponse(data=db.get_project_capability_tags(project_id), message="获取成功")
