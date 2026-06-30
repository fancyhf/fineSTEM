"""
证据 API 路由

用途：上传进度证据、管理证据
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from app.core.time_utils import utc_now_iso
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from app.schemas.evidence import (
    Evidence,
    AutoEvidenceCollectRequest,
    EvidenceCreate,
    EvidenceUpdate,
)
from app.schemas.common import ApiResponse, PaginationResult
from app.schemas.auth import UserResponse
from app.repositories.runtime_db import db
from app.api.auth import get_current_user
from app.services.storage_service import storage_service

router = APIRouter(prefix="/evidence", tags=["进度证据"])


@router.post("/projects/{project_id}", response_model=ApiResponse[Evidence])
async def upload_evidence(
    project_id: str,
    evidence_data: EvidenceCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    上传进度证据
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )
    if project.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此项目",
        )
    
    evidence = Evidence(
        project_id=project_id,
        author_id=current_user.id,
        type=evidence_data.type,
        title=evidence_data.title,
        content=evidence_data.content,
        content_url=evidence_data.content_url,
        related_step=evidence_data.related_step,
        created_by=current_user.id,
    )
    
    created_evidence = db.create_evidence(evidence)
    return ApiResponse(data=created_evidence, message="上传成功")


@router.get("/projects/{project_id}", response_model=ApiResponse[PaginationResult[Evidence]])
async def get_project_evidence(
    project_id: str,
    page: int = 1,
    page_size: int = 20,
    type: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取项目的证据列表
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )
    if project.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此项目",
        )
    
    skip = (page - 1) * page_size
    evidence_list = db.list_evidence(
        project_id=project_id,
        skip=skip,
        limit=page_size,
        type=type,
    )
    total = db.count_evidence(
        project_id=project_id,
        type=type,
    )
    total_pages = (total + page_size - 1) // page_size
    
    return ApiResponse(
        data=PaginationResult(
            items=evidence_list,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ),
        message="获取成功",
    )


@router.get("/{evidence_id}", response_model=ApiResponse[Evidence])
async def get_evidence(
    evidence_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取单个证据
    """
    evidence = db.get_evidence(evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="证据不存在",
        )
    
    project = db.get_project(evidence.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )
    if project.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此证据",
        )
    
    return ApiResponse(data=evidence, message="获取成功")


@router.patch("/{evidence_id}", response_model=ApiResponse[Evidence])
async def update_evidence(
    evidence_id: str,
    evidence_update: EvidenceUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    更新证据信息
    """
    evidence = db.get_evidence(evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="证据不存在",
        )
    
    project = db.get_project(evidence.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )
    if project.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此证据",
        )
    
    update_data = evidence_update.model_dump(exclude_unset=True)
    updated_evidence = db.update_evidence(evidence_id, update_data)
    return ApiResponse(data=updated_evidence, message="更新成功")

@router.post("/projects/{project_id}/auto-collect", response_model=ApiResponse[Evidence])
async def auto_collect_evidence(
    project_id: str,
    payload: AutoEvidenceCollectRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    自动采集证据（阶段推进 / AI 总结）
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )
    if project.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此项目",
        )

    source_hint = f"[source:{payload.source}]"
    evidence = Evidence(
        project_id=project_id,
        author_id=current_user.id,
        type=payload.type,
        title=payload.related_step or "",
        content=f"{source_hint} {payload.content}",
        content_url=None,
        related_step=payload.related_step,
        created_by=current_user.id,
    )
    created = db.create_evidence(evidence)
    return ApiResponse(data=created, message="自动采集成功")


@router.post("/projects/{project_id}/screenshots", response_model=ApiResponse[Evidence])
async def upload_screenshot_evidence(
    project_id: str,
    file: UploadFile = File(...),
    related_step: str | None = Form(default=None),
    current_user: UserResponse = Depends(get_current_user),
):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )
    if project.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此项目",
        )
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅支持图片文件")

    meta = await storage_service.save_upload(owner_id=current_user.id, file=file, project_id=project_id)
    evidence = Evidence(
        project_id=project_id,
        author_id=current_user.id,
        type="screenshot",
        title=related_step or "screenshot",
        content=f"截图上传：{file.filename or 'image'} @ {utc_now_iso()}",
        content_url=f"/api/v1/files/{meta['id']}",
        related_step=related_step,
        created_by=current_user.id,
    )
    created = db.create_evidence(evidence)
    return ApiResponse(data=created, message="截图证据上传成功")
