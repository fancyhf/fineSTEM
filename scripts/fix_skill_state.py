"""检查并修复进行中项目的 skill_state"""
import sqlite3
import json
from datetime import datetime, timezone

DB_PATH = "D:/data/finestem/finestem.db"
IN_PROGRESS_PROJECT_ID = "7693f1d0-79e7-4d8b-8c5e-5a946a4658ac"
USER_ID = "848dc2f9-a96d-44b5-9c5b-a31765f35a4a"


def main() -> None:
    """主函数"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 检查 skill_state
    cur.execute("SELECT * FROM skill_states WHERE project_id=?", (IN_PROGRESS_PROJECT_ID,))
    row = cur.fetchone()
    print(f"[进行中项目 skill_state] 存在: {bool(row)}")
    if row:
        print(f"  current_stage: {row[3]}")

    # 检查已完成项目的 skill_state 作为参考
    cur.execute("SELECT project_id, current_stage, stages, standard_step_data FROM skill_states WHERE project_id='ccb58a57-b95a-4811-9d7e-6c87fa78f98f'")
    ref_row = cur.fetchone()
    print(f"\n[已完成项目 skill_state 参考]")
    if ref_row:
        print(f"  current_stage: {ref_row[1]}")
        print(f"  stages (前200字符): {str(ref_row[2])[:200]}")
        print(f"  standard_step_data (前200字符): {str(ref_row[3])[:200]}")
    else:
        print("  不存在")

    # 为进行中项目创建 skill_state
    now = datetime.now(timezone.utc).isoformat()
    stages_data = {
        "stage_00_bootstrap": {"status": "completed", "started_at": now, "completed_at": now, "data": {}},
        "stage_01_brainstorm": {"status": "completed", "started_at": now, "completed_at": now, "data": {"selected_idea": "个人网站"}},
        "stage_02_brief": {"status": "completed", "started_at": now, "completed_at": now, "data": {"title": "个人网站"}},
        "stage_03_constraints": {"status": "completed", "started_at": now, "completed_at": now, "data": {}},
        "stage_04_track": {"status": "completed", "started_at": now, "completed_at": now, "data": {"template_id": "web"}},
        "stage_05_design": {"status": "active", "started_at": now, "data": {}},
        "stage_06_step_plan": {"status": "locked"},
        "stage_07_execute": {"status": "locked"},
        "stage_08_evaluate": {"status": "locked"},
    }

    cur.execute(
        """INSERT OR REPLACE INTO skill_states
           (project_id, version, mode, current_stage, light_step, stages, metadata,
            light_to_standard_mapping, stage_history, light_step_data, standard_step_data,
            created_at, created_by, updated_at, updated_by, is_deleted)
           VALUES (?, '1.0.0', 'standard', 'stage_05_design', NULL, ?, '{}', NULL, '[]', '{}', '{}', ?, ?, ?, NULL, 0)""",
        (IN_PROGRESS_PROJECT_ID, json.dumps(stages_data), now, USER_ID, now),
    )
    print(f"\n[修复] 创建 skill_state 行数: {cur.rowcount}")

    conn.commit()

    # 验证
    cur.execute("SELECT project_id, current_stage FROM skill_states WHERE project_id=?", (IN_PROGRESS_PROJECT_ID,))
    row = cur.fetchone()
    print(f"[验证] skill_state: {row}")

    conn.close()
    print("\n修复完成")


if __name__ == "__main__":
    main()
