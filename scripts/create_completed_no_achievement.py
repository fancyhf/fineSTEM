"""创建一个已完成但没有 achievement 的测试项目"""
import sqlite3
import json
import uuid
from datetime import datetime, timezone

DB_PATH = "D:/data/finestem/finestem.db"
USER_ID = "848dc2f9-a96d-44b5-9c5b-a31765f35a4a"  # testuser

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

now = datetime.now(timezone.utc).isoformat()
project_id = str(uuid.uuid4())

# 创建已完成项目（stage_08_evaluate，无 achievement）
cur.execute(
    """INSERT INTO projects (id, author_id, name, mode, description, current_stage,
                              from_demo_id, initial_data, created_at, created_by,
                              updated_at, updated_by, is_deleted)
       VALUES (?, ?, ?, 'standard', ?, 'stage_08_evaluate', NULL, '{}', ?, ?, ?, NULL, 0)""",
    (project_id, USER_ID, "测试已完成无成果卡项目",
     "这是一个已完成但没有成果档案卡的测试项目", now, USER_ID, now),
)

# 创建 skill_state
stages_data = {}
for i, stage in enumerate([
    "stage_00_bootstrap", "stage_01_brainstorm", "stage_02_brief",
    "stage_03_constraints", "stage_04_track", "stage_05_design",
    "stage_06_step_plan", "stage_07_execute", "stage_08_evaluate"
]):
    stages_data[stage] = {
        "status": "completed" if i < 8 else "active",
        "started_at": now,
        "completed_at": now if i < 8 else None,
        "data": {},
    }

cur.execute(
    """INSERT OR REPLACE INTO skill_states
       (project_id, version, mode, current_stage, stages, stage_history,
        light_step, light_step_data, metadata, created_at, created_by, updated_at, is_deleted)
       VALUES (?, '1.0.0', 'standard', 'stage_08_evaluate', ?, '[]',
               NULL, '{}', '{}', ?, ?, ?, 0)""",
    (project_id, json.dumps(stages_data), now, USER_ID, now),
)

conn.commit()
print(f"创建项目成功: {project_id}")
print(f"项目名: 测试已完成无成果卡项目")
print(f"模式: standard")
print(f"阶段: stage_08_evaluate")
print(f"用户: {USER_ID}")

conn.close()
