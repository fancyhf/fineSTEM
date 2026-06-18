"""检查数据库中的项目状态"""
import sqlite3
import json

DB_PATH = "D:/data/finestem/finestem.db"

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# 查询项目
cur.execute("""
    SELECT p.id, p.name, p.mode, p.current_stage, p.author_id,
           (SELECT COUNT(*) FROM skill_states WHERE project_id = p.id) as has_skill_state,
           (SELECT COUNT(*) FROM achievement_cards WHERE project_id = p.id) as has_achievement
    FROM projects p
    WHERE p.is_deleted = 0
    ORDER BY p.updated_at DESC
    LIMIT 20
""")
rows = cur.fetchall()

print("=" * 100)
print(f"{'ID(前8)':<10} {'名称':<25} {'模式':<10} {'当前阶段':<25} {'skill_state':<12} {'achievement':<12}")
print("=" * 100)
for r in rows:
    print(f"{r['id'][:8]:<10} {r['name'][:25]:<25} {r['mode']:<10} {r['current_stage']:<25} {'有' if r['has_skill_state'] else '无':<12} {'有' if r['has_achievement'] else '无':<12}")

print("\n用户列表:")
cur.execute("SELECT id, username, email FROM users LIMIT 5")
for r in cur.fetchall():
    print(f"  {r['id'][:8]}... | {r['username']} | {r['email']}")

conn.close()
