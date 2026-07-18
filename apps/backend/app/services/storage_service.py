"""
文件存储服务

用途：统一管理文件上传、下载与删除
维护者：AI Agent
"""

from __future__ import annotations

import json
from pathlib import Path
import uuid
from typing import Any, Dict, Optional

from fastapi import UploadFile

from app.core.config import settings
from app.core.time_utils import utc_now_iso


class FileStorageService:
    def __init__(self) -> None:
        self.base_path = Path(settings.STORAGE_BASE_PATH)
        self.upload_dir = self.base_path / settings.STORAGE_UPLOAD_DIR
        self.index_file = self.base_path / settings.STORAGE_INDEX_FILE
        self.covers_dir = self.base_path / "generated" / "covers"
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.covers_dir.mkdir(parents=True, exist_ok=True)
        self._index: Dict[str, Dict[str, Any]] = self._load_index()

    def _load_index(self) -> Dict[str, Dict[str, Any]]:
        if not self.index_file.exists():
            return {}
        try:
            data = json.loads(self.index_file.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _persist_index(self) -> None:
        self.index_file.parent.mkdir(parents=True, exist_ok=True)
        self.index_file.write_text(json.dumps(self._index, ensure_ascii=False, indent=2), encoding="utf-8")

    async def save_upload(self, owner_id: str, file: UploadFile, project_id: Optional[str] = None) -> Dict[str, Any]:
        file_id = str(uuid.uuid4())
        suffix = Path(file.filename or "").suffix
        target_dir = self.upload_dir / owner_id / (project_id or "common")
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / f"{file_id}{suffix}"
        content = await file.read()
        target_path.write_bytes(content)
        meta = {
            "id": file_id,
            "owner_id": owner_id,
            "project_id": project_id,
            "original_name": file.filename or "",
            "stored_path": str(target_path),
            "content_type": file.content_type or "application/octet-stream",
            "size": len(content),
            "created_at": utc_now_iso(),
        }
        self._index[file_id] = meta
        self._persist_index()
        return meta

    def get_file_meta(self, file_id: str) -> Optional[Dict[str, Any]]:
        return self._index.get(file_id)

    async def save_cover_image(self, card_id: str, image_url: str) -> Optional[str]:
        """
        下载远程图片并保存为本地封面图。

        Args:
            card_id: 成果档案卡 ID（用作文件名）
            image_url: 远程图片 URL（如 CogView CDN）

        Returns:
            可供前端访问的相对路径（如 /media/covers/{card_id}.png），失败返回 None
        """
        import httpx

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.get(image_url)
                response.raise_for_status()
                content = response.content
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("下载封面图失败: %s", e)
            return None

        target_path = self.covers_dir / f"{card_id}.png"
        target_path.write_bytes(content)
        return f"/media/covers/{card_id}.png"

    def delete_file(self, owner_id: str, file_id: str) -> bool:
        meta = self._index.get(file_id)
        if not meta or meta.get("owner_id") != owner_id:
            return False
        target = Path(meta["stored_path"])
        if target.exists():
            target.unlink()
        del self._index[file_id]
        self._persist_index()
        return True

    def save_screenshot_bytes(
        self,
        owner_id: str,
        project_id: Optional[str],
        content: bytes,
        suffix: str = ".png",
        original_name: str = "screenshot.png",
        content_type: str = "image/png",
    ) -> Dict[str, Any]:
        """
        将一段二进制内容（如无头浏览器截图 PNG）直接落盘并登记到索引。

        与 save_upload 的区别：无需 UploadFile 对象，便于服务端直接产出文件。
        返回 meta（含 stored_path）。
        """
        file_id = str(uuid.uuid4())
        target_dir = self.upload_dir / owner_id / (project_id or "common")
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / f"{file_id}{suffix}"
        target_path.write_bytes(content)
        meta = {
            "id": file_id,
            "owner_id": owner_id,
            "project_id": project_id,
            "original_name": original_name,
            "stored_path": str(target_path),
            "content_type": content_type,
            "size": len(content),
            "created_at": utc_now_iso(),
        }
        self._index[file_id] = meta
        self._persist_index()
        return meta


storage_service = FileStorageService()
