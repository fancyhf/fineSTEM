"""查询项目对话历史"""
import sys
sys.path.insert(0, r'G:\mediaProjects\fineSTEM\apps\backend')
from app.repositories.runtime_db import db
import json

project_id = '4e8f476a-b765-458d-a203-02c052f829e8'

# 获取项目信息
project = db.get_project(project_id)
if project:
    print(f'=== 项目信息 ===')
    print(f'名称: {project.name}')
    print(f'当前阶段: {project.current_stage}')
    print(f'模式: {project.mode}')
else:
    print('项目不存在!')
    sys.exit(1)

# 获取 workspace
workspace = db.get_project_workspace(project_id) or {}
chat_messages = workspace.get('chat_messages', [])

print(f'\n=== 聊天记录 ({len(chat_messages)} 条) ===')
for i, msg in enumerate(chat_messages):
    role = msg.get('role', 'unknown')
    content = msg.get('content', '')
    print(f'\n--- 消息 {i+1} [{role}] ---')
    print(content[:800] if len(content) > 800 else content)
    if len(content) > 800:
        print(f'... (共 {len(content)} 字符)')
