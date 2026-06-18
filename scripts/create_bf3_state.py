"""为 BF3 测试项目补一条 skill_states 记录"""
import sqlite3
import json
from datetime import datetime, timezone

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()

PROJECT_ID = 'bf3-test-0001-0000-0000-000000000001'
AUTHOR_ID = '848dc2f9-a96d-44b5-9c5b-a31765f35a4a'
now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S.000')

cur.execute("DELETE FROM skill_states WHERE project_id = ?", (PROJECT_ID,))

cur.execute("""
    INSERT INTO skill_states (project_id, version, mode, current_stage, light_step,
                              stages, metadata, light_to_standard_mapping,
                              stage_history, light_step_data, standard_step_data,
                              created_at, created_by, updated_at, updated_by, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0)
""", (
    PROJECT_ID, '1.0.0', 'light', 'step_3', '3',
    json.dumps({}), json.dumps({}),
    json.dumps([{"stage": "step_3", "started_at": now}]),
    json.dumps({"result": "测试结果", "reflection": "测试反思"}),
    json.dumps({}),
    now, AUTHOR_ID, now, AUTHOR_ID
))

conn.commit()
cur.execute("SELECT project_id, mode, current_stage, light_step FROM skill_states WHERE project_id = ?", (PROJECT_ID,))
print('已创建:', cur.fetchone())
conn.close()
