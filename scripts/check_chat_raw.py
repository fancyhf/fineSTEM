import sqlite3
import json

DB_PATH = r"D:\data\finestem\finestem.db"
PROJECT_ID = "4e8f476a-b765-458d-a203-02c052f829e8"

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# 获取项目信息
cursor.execute("SELECT id, name, current_stage, mode, initial_data FROM projects WHERE id = ?", (PROJECT_ID,))
row = cursor.fetchone()

if not row:
    print("项目不存在!")
    sys.exit(1)

print(f"=== 项目信息 ===")
print(f"ID: {row['id']}")
print(f"名称: {row['name']}")
print(f"当前阶段: {row['current_stage']}")
print(f"模式: {row['mode']}")

# 解析 initial_data 获取 workspace
initial_data = json.loads(row['initial_data'] or '{}')
workspace = initial_data.get('workspace', {})
chat_messages = workspace.get('chat_messages', [])

print(f"\n=== 聊天记录 ({len(chat_messages)} 条) ===\n")

for i, msg in enumerate(chat_messages):
    role = msg.get('role', 'unknown')
    content = msg.get('content', '')
    
    print(f"=" * 80)
    print(f"消息 {i+1} | 角色: {role}")
    print(f"=" * 80)
    
    # 显示完整内容（如果太长则截断）
    try:
        if len(content) > 2000:
            print(content[:2000])
            print(f"\n... [截断，共 {len(content)} 字符] ...")
        else:
            print(content)
    except UnicodeEncodeError:
        # 处理编码问题
        safe_content = content.encode('utf-8', errors='ignore').decode('utf-8')
        if len(safe_content) > 2000:
            print(safe_content[:2000])
            print(f"\n... [截断，共 {len(content)} 字符] ...")
        else:
            print(safe_content)
    print()

conn.close()
