"""独立测试 parser 函数 — 不依赖 UserResponse"""
import sys
sys.path.insert(0, r"g:\mediaProjects\fineSTEM\apps\backend")

import json
from app.repositories.runtime_db import db
from app.api.projects import (
    _auto_generate_achievement,
    _extract_achievement_from_chat,
    _parse_achievement_md,
)

# 项目 ID
project_id = "f2a11545-2b53-488d-8c38-7048f3adc801"

# 获取 project
project = db.get_project(project_id)
if not project:
    print("项目不存在!")
    sys.exit(1)

print(f"项目: {project.name} (mode={project.mode}, stage={project.current_stage})")

# 获取 workspace 聊天记录
workspace = db.get_project_workspace(project_id) or {}
chat_messages = workspace.get("chat_messages", [])
print(f"聊天消息数: {len(chat_messages)}")

# 测试 tier 2: 从聊天提取
if chat_messages:
    print("\n=== Tier 2: 从聊天提取 ===")
    parsed = _extract_achievement_from_chat(chat_messages, project.name)
    if parsed:
        print("提取成功!")
        print(json.dumps(parsed, ensure_ascii=False, indent=2))
    else:
        print("提取结果为空")

# 测试 tier 3: 自动生成
print("\n=== Tier 3: 自动生成 ===")
auto = _auto_generate_achievement(project)
print(json.dumps(auto, ensure_ascii=False, indent=2))

# 测试 _parse_achievement_md 直接解析聊天内容
print("\n=== 直接解析聊天内容 ===")
if chat_messages:
    assistant_texts = []
    for msg in reversed(chat_messages):
        if msg.get("role") == "assistant" and msg.get("content"):
            assistant_texts.append(str(msg["content"]))
        if len(assistant_texts) >= 5:
            break
    combined = "\n".join(reversed(assistant_texts))
    result = _parse_achievement_md(combined)
    print(json.dumps(result, ensure_ascii=False, indent=2))

print("\nDone!")
