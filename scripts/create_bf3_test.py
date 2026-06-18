"""创建一个已完成（step_3）的轻量项目用于 BF-3 回归测试"""
import sqlite3
import uuid
import json
from datetime import datetime, timezone

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()

PROJECT_ID = 'bf3-test-0001-0000-0000-000000000001'
AUTHOR_ID = '848dc2f9-a96d-44b5-9c5b-a31765f35a4a'  # testuser
now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S.000')

# 先删除旧的（如果存在）
cur.execute("DELETE FROM projects WHERE id = ?", (PROJECT_ID,))
cur.execute("DELETE FROM skill_states WHERE project_id = ?", (PROJECT_ID,))

# 插入项目（mode=light, current_stage=step_3 表示已完成）
cur.execute("""
    INSERT INTO projects (id, author_id, name, mode, description, current_stage,
                          from_demo_id, initial_data, created_at, created_by,
                          updated_at, updated_by, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 0)
""", (
    PROJECT_ID, AUTHOR_ID, 'BF3测试-已完成轻量项目', 'light',
    '用于验证 BF-3 完成态判断的测试项目', 'step_3',
    json.dumps({}), now, AUTHOR_ID, now, AUTHOR_ID
))

# 查 skill_states 表结构
cur.execute("PRAGMA table_info(skill_states)")
cols = [r[1] for r in cur.fetchall()]
print('skill_states 列:', cols)

# 根据列名构造 INSERT
# 常见列: id, project_id, standard_step_data, light_step_data, ...
# 先看一行示例
cur.execute("SELECT * FROM skill_states LIMIT 1")
sample = cur.fetchone()
if sample:
    print('示例行:', sample)
    cur.execute("PRAGMA table_info(skill_states)")
    col_info = cur.fetchall()
    print('列详情:')
    for c in col_info:
        print(' ', c)

conn.commit()
conn.close()
print('完成')
