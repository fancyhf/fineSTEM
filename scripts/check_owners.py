"""检查项目归属和当前用户"""
import sqlite3

DB_PATH = "D:/data/finestem/finestem.db"
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# 查询所有用户
cur.execute("SELECT id, name, email FROM users LIMIT 10")
print("用户列表:")
for r in cur.fetchall():
    print(f"  {r['id']} | {r['name']} | {r['email']}")

# 查询关键项目的 author_id
cur.execute("""
    SELECT id, name, mode, current_stage, author_id
    FROM projects
    WHERE is_deleted = 0
    ORDER BY updated_at DESC
    LIMIT 20
""")
print("\n项目列表:")
for r in cur.fetchall():
    print(f"  {r['id'][:8]}... | {r['name'][:30]:<30} | {r['mode']:<10} | {r['current_stage']:<25} | author: {r['author_id'][:8]}...")

conn.close()
