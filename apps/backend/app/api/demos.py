"""
示例项目 API 路由

用途：获取示例项目列表、详情等
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from typing import Optional
import json
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.demos import Demo, DemoListQuery
from app.schemas.common import ApiResponse, PaginationResult
from app.repositories.runtime_db import db

router = APIRouter(prefix="/demos", tags=["示例项目"])


@router.get("", response_model=ApiResponse[PaginationResult[Demo]])
async def list_demos(query: DemoListQuery = Depends()):
    """
    获取示例项目列表
    """
    skip = (query.page - 1) * query.page_size
    demos = db.list_demos(
        skip=skip,
        limit=query.page_size,
        difficulty=query.difficulty,
        subject=query.subject,
        tech_stack=query.tech_stack,
        search=query.search,
    )
    total = db.count_demos(
        difficulty=query.difficulty,
        subject=query.subject,
        tech_stack=query.tech_stack,
        search=query.search,
    )
    total_pages = (total + query.page_size - 1) // query.page_size
    
    return ApiResponse(
        data=PaginationResult(
            items=demos,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=total_pages,
        ),
        message="获取成功",
    )


@router.get("/{demo_id}", response_model=ApiResponse[Demo])
async def get_demo(demo_id: str):
    """
    获取示例项目详情
    """
    demo = db.get_demo(demo_id)
    if not demo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )
    
    return ApiResponse(data=demo, message="获取成功")


@router.get("/{demo_id}/use-project", response_model=ApiResponse[dict])
async def use_demo_as_template(demo_id: str):
    """
    使用示例项目作为模板（返回基本信息）
    """
    demo = db.get_demo(demo_id)
    if not demo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )
    
    return ApiResponse(
        data={
            "demo_id": demo.id,
            "name": demo.name,
            "description": demo.description,
            "tech_stack": demo.tech_stack,
            "difficulty": demo.difficulty,
            "subjects": demo.subjects,
            "display_mode": demo.display_mode,
            "fork_template_id": demo.fork_template_id,
        },
        message="获取成功",
    )


@router.get("/{demo_id}/breakdown", response_model=ApiResponse[dict])
async def get_demo_breakdown(demo_id: str):
    """
    获取 Demo 项目拆解文档
    """
    demo = db.get_demo(demo_id)
    if not demo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )

    return ApiResponse(
        data={
            "demo_id": demo.id,
            "project_breakdown": demo.project_breakdown or "",
            "minimal_replica": demo.minimal_replica,
        },
        message="获取成功",
    )


@router.get("/{demo_id}/fork-template", response_model=ApiResponse[dict])
async def get_demo_fork_template(demo_id: str):
    """
    获取 Demo 最小可改版 Fork 模板
    """
    demo = db.get_demo(demo_id)
    if not demo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )

    editable_markers = [
        "修改页面标题与项目名称",
        "调整核心交互参数",
        "替换默认数据与主题样式",
    ]
    suggestions = [
        f"保持 {demo.name} 核心逻辑不变，先改 UI 风格与配色",
        "增加一个可视化反馈（图表、提示区或动画）",
        "扩展一个与学科相关的新功能并记录验证结果",
    ]

    template_entry = "src/main.js"
    template_files: dict[str, str] = {}
    if demo.minimal_replica:
        try:
            parsed = json.loads(demo.minimal_replica)
            if isinstance(parsed, dict):
                maybe_entry = parsed.get("entry_file")
                maybe_files = parsed.get("files")
                if isinstance(maybe_entry, str) and maybe_entry:
                    template_entry = maybe_entry
                if isinstance(maybe_files, dict):
                    template_files = {str(k): str(v) for k, v in maybe_files.items()}
        except json.JSONDecodeError:
            pass

    if not template_files:
        template_files = {
            "index.html": "<!doctype html><html><body><h1>Demo Template</h1><script type='module' src='./src/main.js'></script></body></html>",
            "src/main.js": "console.log('Start from this template and build your own version.');",
        }

    return ApiResponse(
        data={
            "demo_id": demo.id,
            "skeleton_code": template_entry,
            "template_files": template_files,
            "entry_file": template_entry,
            "editable_markers": editable_markers,
            "suggestions": suggestions,
            "default_goal": f"在保留 {demo.name} 核心功能的前提下完成一次可演示改造",
            "default_template": "我解决了什么 -> 我做了哪些改动 -> 我如何验证 -> 下一步优化",
        },
        message="获取成功",
    )
