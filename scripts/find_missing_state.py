"""查找有项目但无 skill_states 记录的项目"""
import sqlite3

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()
cur.execute("""
    SELECT p.id, p.name, p.author_id, p.mode, p.current_stage
    FROM projects p
    LEFT JOIN skill_states s ON p.id = s.project_id
    WHERE s.project_id IS NULL AND p.is_deleted = 0
    LIMIT 10
""")
rows = cur.fetchall()
print('有项目但无 skill_states 记录的项目:')
for r in rows:
    print(' ', r)

if not rows:
    print('  (无 — 所有项目都有 skill_states)')

# 同时查 testuser 的所有项目
print('\ntestuser (848dc2f9-a96d-44b5-9c5b-a31765f35a4a) 的所有项目:')
cur.execute("""
    SELECT p.id, p.name, p.mode, p.current_stage,
           CASE WHEN s.project_id IS NOT NULL THEN '有' ELSE '无' END AS has_state,
           CASE WHEN a.id IS NOT NULL THEN '有' ELSE '无' END AS has_achievement
    FROM projects p
    LEFT JOIN skill_states s ON p.id = s.project_id
    LEFT JOIN achievement_cards a ON p.id = a.project_id
    WHERE p.author_id = '848dc2f9-a96d-44b5-9c5b-a31765f35a4a' AND p.is_deleted = 0
    ORDER BY p.created_at DESC
""")
for r in cur.fetchall():
    print(' ', r)
