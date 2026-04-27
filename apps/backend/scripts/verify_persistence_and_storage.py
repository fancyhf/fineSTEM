"""
持久化与文件存储验收脚本

用途：
1. 执行 Alembic 迁移（upgrade head）
2. 验证核心表是否存在
3. 通过 TestClient 验证文件上传/下载/删除流程
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
import sqlite3
import sys
from uuid import uuid4

from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from main import app


def ensure_tables() -> list[str]:
    try:
        from alembic import command
        from alembic.config import Config
    except ModuleNotFoundError as exc:
        raise RuntimeError("缺少 alembic 依赖，请先执行 `pip install -r requirements.txt` 后重试。") from exc

    conn = sqlite3.connect("D:/data/finestem/finestem.db")
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        existing = [row[0] for row in cur.fetchall()]
    finally:
        conn.close()

    alembic_cfg = Config(str(ROOT_DIR / "alembic.ini"))
    baseline_tables = {"users", "projects", "skill_states", "achievement_cards", "evidence", "demos", "courses"}
    has_baseline = bool(baseline_tables.intersection(set(existing)))
    has_alembic_table = "alembic_version" in existing
    has_alembic_rows = False
    if has_alembic_table:
        conn = sqlite3.connect("D:/data/finestem/finestem.db")
        try:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM alembic_version")
            has_alembic_rows = (cur.fetchone() or [0])[0] > 0
        finally:
            conn.close()

    if (not has_alembic_table and has_baseline) or (has_alembic_table and not has_alembic_rows and has_baseline):
        command.stamp(alembic_cfg, "head")
    else:
        command.upgrade(alembic_cfg, "head")

    conn = sqlite3.connect("D:/data/finestem/finestem.db")
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def run_file_flow() -> dict:
    client = TestClient(app)
    email = f"verify_{uuid4().hex[:8]}@example.com"
    password = "Verify#12345"
    register_res = client.post(
        "/api/v1/auth/register",
        json={"name": "Verifier", "email": email, "password": password},
    )
    register_res.raise_for_status()
    token = register_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    project_res = client.post(
        "/api/v1/projects",
        json={
            "name": "Storage Verify Project",
            "mode": "light",
            "initial_data": {"purpose": "验证文件存储链路"},
        },
        headers=headers,
    )
    project_res.raise_for_status()
    project_id = project_res.json()["data"]["id"]

    content = b"fineSTEM storage verification"
    upload_res = client.post(
        "/api/v1/files/upload",
        data={"project_id": project_id, "file_type": "document"},
        files={"file": ("verify.txt", BytesIO(content), "text/plain")},
        headers=headers,
    )
    upload_res.raise_for_status()
    upload_data = upload_res.json()["data"]
    file_id = upload_data["id"]

    download_res = client.get(f"/api/v1/files/{file_id}", headers=headers)
    download_res.raise_for_status()
    if download_res.content != content:
        raise RuntimeError("下载内容与上传内容不一致")

    delete_res = client.delete(f"/api/v1/files/{file_id}", headers=headers)
    delete_res.raise_for_status()
    if not delete_res.json().get("data"):
        raise RuntimeError("删除文件返回失败")

    return {
        "project_id": project_id,
        "file_id": file_id,
        "uploaded_size": len(content),
    }


def main() -> None:
    tables = ensure_tables()
    required = {
        "users",
        "demos",
        "projects",
        "skill_states",
        "achievement_cards",
        "evidence",
        "courses",
        "project_capability_tags",
    }
    missing = sorted(required.difference(set(tables)))
    if missing:
        raise RuntimeError(f"缺少数据库表: {missing}")

    file_flow = run_file_flow()
    print(
        {
            "status": "ok",
            "tables_checked": sorted(required),
            "file_flow": file_flow,
        }
    )


if __name__ == "__main__":
    main()
