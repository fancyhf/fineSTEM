"""直接在数据库中创建已完成项目"""
import sqlite3
import json
import uuid
from datetime import datetime, timezone

DB_PATH = "D:/data/finestem/finestem.db"
USER_ID = "848dc2f9-a96d-44b5-9c5b-a31765f35a4a"

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

now = datetime.now(timezone.utc).isoformat()
project_id = str(uuid.uuid4())

# 创建项目（已完成）
cur.execute(
    """INSERT INTO projects (id, author_id, name, mode, description, current_stage,
                              from_demo_id, initial_data, created_at, created_by,
                              updated_at, updated_by, is_deleted)
       VALUES (?, ?, ?, 'standard', ?, 'stage_08_evaluate', NULL, '{}', ?, ?, ?, NULL, 0)""",
    (project_id, USER_ID, "测试已完成无成果卡项目",
     "这是一个已完成但没有成果档案卡的测试项目", now, USER_ID, now),
)

# 复制现有 standard skill_state 的完整结构
cur.execute("SELECT * FROM skill_states WHERE mode='standard' LIMIT 1")
template = dict(cur.fetchone())

# 构建完整的 stages 数据
stages_data = {}
stage_history = []
for i, stage in enumerate([
    "stage_00_bootstrap", "stage_01_brainstorm", "stage_02_brief",
    "stage_03_constraints", "stage_04_track", "stage_05_design",
    "stage_06_step_plan", "stage_07_execute", "stage_08_evaluate"
]):
    stages_data[stage] = {
        "status": "completed",
        "started_at": now,
        "completed_at": now,
        "data": {},
    }
    stage_history.append({"stage": stage, "started_at": now, "completed_at": now})

# 插入 skill_state，使用所有 NOT NULL 列
cur.execute(
    """INSERT INTO skill_states
       (project_id, version, mode, current_stage, light_step, stages,
        metadata, stage_history, light_step_data, standard_step_data,
        created_at, created_by, updated_at, updated_by, is_deleted)
       VALUES (?, '1.0.0', 'standard', 'stage_08_evaluate', NULL, ?,
               '{}', ?, '{}', '{}',
               ?, ?, ?, NULL, 0)""",
    (project_id, json.dumps(stages_data), json.dumps(stage_history),
     now, USER_ID, now),
)

conn.commit()
print(f"创建项目成功: {project_id}")
print(f"项目名: 测试已完成无成果卡项目")

# 验证
cur.execute("SELECT id, name, mode, current_stage FROM projects WHERE id=?", (project_id,))
r = cur.fetchone()
print(f"验证: {r['name']} | {r['mode']} | {r['current_stage']}")

cur.execute("SELECT * FROM skill_states WHERE project_id=?", (project_id,))
s = cur.fetchone()
print(f"skill_state: mode={s['mode']} stage={s['current_stage']}")

conn.close()
