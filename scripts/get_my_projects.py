"""查询最近创建的项目"""
import sqlite3
conn = sqlite3.connect("D:/data/finestem/finestem.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("""
    SELECT id, name, mode, current_stage, author_id
    FROM projects
    WHERE is_deleted = 0 AND author_id = '848dc2f9-a96d-44b5-9c5b-a31765f35a4a'
    ORDER BY created_at DESC LIMIT 10
""")
for r in cur.fetchall():
    print(f"{r['id']} | {r['name']} | {r['mode']} | {r['current_stage']}")
conn.close()
