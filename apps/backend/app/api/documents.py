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
from app.schemas.documents import DocumentFormat, DocumentType
from app.services.document_service import document_service

router = APIRouter(prefix="/documents", tags=["研学文档"])


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
