"""
测试数据准备脚本 v2：直接修改数据库，创建不同状态的项目

用途：为 Playwright 业务链路测试准备测试数据
维护者：AI Agent
"""

import sqlite3
import uuid
from datetime import datetime, timezone

DB_PATH = "D:/data/finestem/finestem.db"
USER_ID = "848dc2f9-a96d-44b5-9c5b-a31765f35a4a"


def main() -> None:
    """主函数：创建/更新测试项目"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    now = datetime.now(timezone.utc).isoformat()

    # 1. 把已创建的标准项目推进到 stage_08_evaluate（已完成）
    completed_project_id = "ccb58a57-b95a-4811-9d7e-6c87fa78f98f"
    cur.execute(
        "UPDATE projects SET current_stage=?, updated_at=? WHERE id=?",
        ("stage_08_evaluate", now, completed_project_id),
    )
    print(f"[已完成项目] 更新行数: {cur.rowcount}, ID: {completed_project_id}")

    # 同时更新 skill_state 中的 current_stage（如果存在）
    cur.execute(
        "UPDATE skill_states SET current_stage=?, updated_at=? WHERE project_id=?",
        ("stage_08_evaluate", now, completed_project_id),
    )
    print(f"[已完成项目 skill_state] 更新行数: {cur.rowcount}")

    # 2. 创建一个进行中的标准研学项目（current_stage = stage_05_design）
    in_progress_project_id = str(uuid.uuid4())
    cur.execute(
        """INSERT INTO projects (id, author_id, name, mode, description, current_stage,
                                  from_demo_id, initial_data, created_at, created_by,
                                  updated_at, updated_by, is_deleted)
           VALUES (?, ?, ?, 'standard', ?, 'stage_05_design', NULL, '{}', ?, ?, ?, NULL, 0)""",
        (in_progress_project_id, USER_ID, "测试进行中项目-个人网站",
         "测试用进行中标准研学项目", now, USER_ID, now),
    )
    print(f"[进行中项目] 创建行数: {cur.rowcount}, ID: {in_progress_project_id}")

    # 3. 创建一个轻量项目（mode = light, current_stage = step_1）
    light_project_id = str(uuid.uuid4())
    cur.execute(
        """INSERT INTO projects (id, author_id, name, mode, description, current_stage,
                                  from_demo_id, initial_data, created_at, created_by,
                                  updated_at, updated_by, is_deleted)
           VALUES (?, ?, ?, 'light', ?, 'step_1', NULL, '{}', ?, ?, ?, NULL, 0)""",
        (light_project_id, USER_ID, "测试轻量项目-待办清单",
         "测试用轻量项目", now, USER_ID, now),
    )
    print(f"[轻量项目] 创建行数: {cur.rowcount}, ID: {light_project_id}")

    conn.commit()

    # 验证
    cur.execute("SELECT id, name, mode, current_stage FROM projects WHERE author_id=?", (USER_ID,))
    rows = cur.fetchall()
    print("\n[当前用户所有项目]")
    for row in rows:
        print(f"  - ID: {row[0]}, 名称: {row[1]}, 模式: {row[2]}, 阶段: {row[3]}")

    conn.close()
    print("\n测试数据准备完成")


if __name__ == "__main__":
    main()
