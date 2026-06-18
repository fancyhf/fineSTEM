"""查询项目完整ID"""
import sqlite3

DB_PATH = "D:/data/finestem/finestem.db"
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# 查询关键项目
cur.execute("""
    SELECT id, name, mode, current_stage
    FROM projects
    WHERE is_deleted = 0 AND (
        id LIKE 'bd7519df%' OR
        id LIKE '014528a5%' OR
        id LIKE 'f2a11545%' OR
        id LIKE 'ccb58a57%' OR
        id LIKE '7693f1d0%' OR
        id LIKE '859858e2%'
    )
    ORDER BY updated_at DESC
""")

for r in cur.fetchall():
    print(f"ID: {r['id']}")
    print(f"  名称: {r['name']}")
    print(f"  模式: {r['mode']}")
    print(f"  阶段: {r['current_stage']}")
    print()

# 也查询当前登录用户
cur.execute("SELECT id FROM users LIMIT 1")
user = cur.fetchone()
if user:
    print(f"用户ID: {user['id']}")

conn.close()
