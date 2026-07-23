import sqlite3
import json
import codecs

DB_PATH = r"D:\data\finestem\finestem.db"
PROJECT_ID = "4e8f476a-b765-458d-a203-02c052f829e8"
OUTPUT_FILE = r"G:\mediaProjects\fineSTEM\scripts\chat_export.json"

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# 获取项目信息
cursor.execute("SELECT id, name, current_stage, mode, initial_data FROM projects WHERE id = ?", (PROJECT_ID,))
row = cursor.fetchone()

if not row:
    print("项目不存在!")
    exit(1)

# 解析 initial_data 获取 workspace
initial_data = json.loads(row['initial_data'] or '{}')
workspace = initial_data.get('workspace', {})
chat_messages = workspace.get('chat_messages', [])

# 导出为 JSON
export_data = {
    "project": {
        "id": row['id'],
        "name": row['name'],
        "current_stage": row['current_stage'],
        "mode": row['mode']
    },
    "chat_messages": chat_messages
}

with codecs.open(OUTPUT_FILE, 'w', 'utf-8') as f:
    json.dump(export_data, f, ensure_ascii=False, indent=2)

print(f"已导出 {len(chat_messages)} 条消息到 {OUTPUT_FILE}")
conn.close()
