"""
文档 API 路由

用途：项目文档生成（开题/技术/结题）
维护者：AI Agent
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import PlainTextResponse

from app.api.auth import get_current_user
from app.repositories.runtime_db import db
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.schemas.documents import DocumentFormat, DocumentType, PublicProjectDocument
from app.services.document_service import build_process_documents, document_service

router = APIRouter(prefix="/documents", tags=["研学文档"])


@router.get("/public/{card_id}", response_model=ApiResponse[list[PublicProjectDocument]])
async def list_public_project_documents(card_id: str):
    """匿名读取公开成果卡关联项目的过程文档，私有卡和不存在卡统一返回 404。"""
    card = db.get_achievement_card(card_id)
    if not card or not card.is_public:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="档案卡不存在或未公开",
        )
    project = db.get_project(card.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="档案卡不存在或未公开",
        )
    skill_state = db.get_skill_state(card.project_id)
    progress = skill_state.model_dump(mode="json") if skill_state else {}
    return ApiResponse(data=build_process_documents(progress), message="获取成功")


@router.get("/projects/{project_id}/generate")
async def generate_project_document(
    project_id: str,
    document_type: DocumentType = Query(...),
    format: DocumentFormat = Query("md"),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    生成并下载项目文档
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

    try:
        file_name, media_type, payload = document_service.generate(project_id, document_type, format)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    if isinstance(payload, str):
        if format == "md":
            return PlainTextResponse(content=payload, headers=headers, media_type=media_type)
        return Response(content=payload.encode("utf-8"), headers=headers, media_type=media_type)
    return Response(content=payload, headers=headers, media_type=media_type)
