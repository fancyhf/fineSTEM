"""
文件服务 API

用途：文件上传、下载、删除
维护者：AI Agent
"""

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.api.auth import get_current_user
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.services.storage_service import storage_service

router = APIRouter(prefix="/files", tags=["文件存储"])


@router.post("/upload", response_model=ApiResponse[dict])
async def upload_file(
    file: UploadFile = File(...),
    project_id: str | None = Form(default=None),
    current_user: UserResponse = Depends(get_current_user),
):
    meta = await storage_service.save_upload(owner_id=current_user.id, file=file, project_id=project_id)
    return ApiResponse(
        data={
            **meta,
            "download_url": f"/api/v1/files/{meta['id']}",
        },
        message="上传成功",
    )


@router.get("/{file_id}")
async def download_file(file_id: str, current_user: UserResponse = Depends(get_current_user)):
    meta = storage_service.get_file_meta(file_id)
    if not meta or meta.get("owner_id") != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    path = Path(meta["stored_path"])
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    return FileResponse(
        path=str(path),
        media_type=meta.get("content_type", "application/octet-stream"),
        filename=meta.get("original_name") or path.name,
    )


@router.delete("/{file_id}", response_model=ApiResponse[bool])
async def delete_file(file_id: str, current_user: UserResponse = Depends(get_current_user)):
    success = storage_service.delete_file(owner_id=current_user.id, file_id=file_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    return ApiResponse(data=True, message="删除成功")
