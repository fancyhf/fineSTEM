"""深入检查 workspace.chat_messages"""
import sqlite3
import json

DB = r"D:\data\finestem\finestem.db"
PID = "f2a11545-2b53-488d-8c38-7048f3adc801"

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT id, name, initial_data FROM projects WHERE id = ?", (PID,))
row = cursor.fetchone()
data = json.loads(row['initial_data'])
workspace = data.get("workspace", {})

chat = workspace.get("chat_messages", [])
print(f"chat_messages 数量: {len(chat)}")
print(f"chat_messages 类型: {type(chat).__name__}")

if isinstance(chat, str):
    chat = json.loads(chat)

if chat:
    assistant_msgs = [m for m in chat if m.get("role") == "assistant"]
    print(f"assistant 消息数: {len(assistant_msgs)}")
    for m in assistant_msgs[-5:]:
        content = m.get("content", "")
        print(f"\n{'='*60}")
        print(f"role: {m.get('role')}")
        print(f"content 长度: {len(content)}")
        print(f"content 前500字: {content[:500]}")
else:
    print("chat_messages 为空!")

conn.close()
