"""为轻量项目创建 skill_state 并测试升级"""
import sqlite3
import json
from datetime import datetime, timezone

DB_PATH = "D:/data/finestem/finestem.db"
LIGHT_PROJECT_ID = "859858e2-3320-4323-bf81-25673389e677"
USER_ID = "848dc2f9-a96d-44b5-9c5b-a31765f35a4a"


def main() -> None:
    """主函数"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    now = datetime.now(timezone.utc).isoformat()

    # 检查是否已存在
    cur.execute("SELECT project_id FROM skill_states WHERE project_id=?", (LIGHT_PROJECT_ID,))
    if cur.fetchone():
        print("[轻量项目] skill_state 已存在，跳过创建")
    else:
        # 为轻量项目创建 skill_state
        stages_data = {
            "step_1": {"status": "active", "started_at": now, "data": {}},
            "step_2": {"status": "locked"},
            "step_3": {"status": "locked"},
        }
        light_step_data = {
            "light_step_1": {"project_name": "待办清单", "one_liner": "一个简单的待办清单应用"},
            "light_step_2": {},
            "light_step_3": {},
        }

        cur.execute(
            """INSERT INTO skill_states
               (project_id, version, mode, current_stage, light_step, stages, metadata,
                light_to_standard_mapping, stage_history, light_step_data, standard_step_data,
                created_at, created_by, updated_at, updated_by, is_deleted)
               VALUES (?, '1.0.0', 'light', 'step_1', '1', ?, '{}', NULL, '[]', ?, '{}', ?, ?, ?, NULL, 0)""",
            (LIGHT_PROJECT_ID, json.dumps(stages_data), json.dumps(light_step_data), now, USER_ID, now),
        )
        print(f"[轻量项目] 创建 skill_state 行数: {cur.rowcount}")

    conn.commit()
    conn.close()
    print("完成")


if __name__ == "__main__":
    main()
