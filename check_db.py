import sqlite3
import json

conn = sqlite3.connect('apps/backend/data/fine_stem.db')
cursor = conn.cursor()

# 查看有哪些表
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print('Tables:', [t[0] for t in tables])

# 查看项目
try:
    cursor.execute("SELECT id, name, current_stage FROM projects WHERE id = ?", ('4e8f476a-b765-458d-a203-02c052f829e8',))
    project = cursor.fetchone()
    print('\nProject:', project)
except Exception as e:
    print('Project query error:', e)

# 查看聊天记录表结构
try:
    cursor.execute("PRAGMA table_info(chat_messages)")
    columns = cursor.fetchall()
    print('\nChat messages columns:', [c[1] for c in columns])
except Exception as e:
    print('Chat messages schema error:', e)

# 查看聊天记录
try:
    cursor.execute("SELECT * FROM chat_messages WHERE project_id = ? ORDER BY created_at DESC LIMIT 10", ('4e8f476a-b765-458d-a203-02c052f829e8',))
    chats = cursor.fetchall()
    print('\nChat history count:', len(chats))
    for i, chat in enumerate(chats[:3]):
        print(f'\n--- Chat {i+1} ---')
        print('ID:', chat[0])
        print('Role:', chat[2])
        print('Content length:', len(chat[3]) if chat[3] else 0)
        print('Content preview:', chat[3][:200] if chat[3] else 'None')
except Exception as e:
    print('Chat query error:', e)

conn.close()
