"""筛查成果卡 API 为什么不返回数据 — 直接读 SQLite"""
import sys
sys.path.insert(0, r"g:\mediaProjects\fineSTEM\apps\backend")

import json
import sqlite3
from pathlib import Path
from app.core.config import settings
from app.repositories.runtime_db import db
from app.api.projects import (
    _slugify_project_name,
    _auto_generate_achievement,
    _extract_achievement_from_chat,
)

conn = sqlite3.connect(str(Path(settings.STORAGE_BASE_PATH) / "finestem.db"))
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# 1. 查所有项目
print("=== 所有项目 ===")
cur.execute("SELECT id, name, author_id, mode, current_stage, description FROM projects WHERE is_deleted = 0")
for r in cur.fetchall():
    print(f"  {r['id'][:12]}... | name={r['name']} | author={r['author_id'][:12]}... | mode={r['mode']} | stage={r['current_stage']}")

# 找趣味小测验
cur.execute("SELECT id, name, author_id, mode, current_stage, description FROM projects WHERE name LIKE ? AND is_deleted = 0", ("%趣味%",))
target = cur.fetchone()

if not target:
    print("\n没找到'趣味小测验'项目")
    conn.close()
    sys.exit(1)

project_id = target["id"]
project_name = target["name"]
author_id = target["author_id"]
print(f"\n找到目标项目: id={project_id}, name={project_name}, author={author_id}")

# 2. slug 和文件路径
print(f"\n=== Slug 测试 ===")
slug = _slugify_project_name(project_name)
print(f"项目名: {project_name} → slug: {slug}")

draft_path = Path(settings.STORAGE_BASE_PATH) / "projects" / slug / "docs" / "reports" / "成果档案卡.md"
print(f"草稿路径: {draft_path}")
print(f"文件存在: {draft_path.exists()}")
if draft_path.parent.exists():
    print(f"父目录存在: {draft_path.parent}")
    print(f"父目录内容: {list(draft_path.parent.glob('*'))}")
else:
    proj_dir = Path(settings.STORAGE_BASE_PATH) / "projects" / slug
    print(f"项目目录存在: {proj_dir.exists()}")
    if proj_dir.exists():
        stuff = list(proj_dir.glob("**/*"))[:30]
        print(f"项目目录内容 ({len(stuff)} items):")
        for s in stuff:
            print(f"  {s}")

# 3. workspace 聊天记录
print(f"\n=== 工作台聊天记录 (via db) ===")
workspace = db.get_project_workspace(project_id) or {}
chat_messages = workspace.get("chat_messages", [])
print(f"消息数: {len(chat_messages)}")
if chat_messages:
    assistant_msgs = [m for m in chat_messages if m.get("role") == "assistant"]
    print(f"Assistant 消息数: {len(assistant_msgs)}")
    for i, msg in enumerate(assistant_msgs[-5:]):
        content = str(msg.get("content", ""))
        print(f"\n--- Assistant #{i} ({len(content)} 字符) ---")
        print(content[:500])

# 4. 测试从聊天提取
if chat_messages:
    print(f"\n=== 从聊天记录提取 ===")
    parsed = _extract_achievement_from_chat(chat_messages, project_name)
    if parsed:
        print(json.dumps(parsed, ensure_ascii=False, default=str))
    else:
        print("提取结果为空 — 检查消息格式...")

# 5. 测试自动生成
print(f"\n=== 自动生成 ===")
# Create a simple project-like object
class FakeProject:
    pass

p = FakeProject()
p.id = project_id
p.name = project_name
p.mode = target["mode"]
p.description = target["description"]
p.current_stage = target["current_stage"]

auto = _auto_generate_achievement(p)
print(json.dumps(auto, ensure_ascii=False, default=str))
print(f"has title: {bool(auto.get('title'))}")

# 6. 直接调 API 测试
print(f"\n=== 直接调 API 测试 ===")
from app.api.projects import get_achievement_draft
from app.schemas.auth import UserResponse
import asyncio

async def test():
    user = UserResponse(
        id=author_id,
        name="test",
        email="test@test.com",
        avatar_url=None,
        is_admin=False,
    )
    try:
        result = await get_achievement_draft(project_id, user)
        print(f"API 返回: {json.dumps(result.model_dump(), ensure_ascii=False, default=str)}")
    except Exception as e:
        import traceback
        print(f"API 错误: {type(e).__name__}: {e}")
        traceback.print_exc()

asyncio.run(test())

conn.close()
print("\n=== 完成 ===")
