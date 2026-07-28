"""
全量 workspace 完整性验证脚本（2026-07-27 新增，对应 TC-DATA-006）

用途：遍历数据库中全部 skill_states，对每个项目调用 _build_workspace_payload，
      验证 /projects/{id}/workspace 接口不会因脏数据返回 500。

背景：Q-014（stages 非法状态）和 Q-015（light_step_data 多层编码）曾导致
      打开历史项目详情时报 Internal Server Error。本脚本作为数据安全的回归门禁。

用法：
    cd apps/backend
    set PYTHONIOENCODING=utf-8
    python scripts/verify_workspace_integrity.py

退出码：0 = 全部通过；1 = 有失败
links: .trae/documents/问题清单_长期维护.md (Q-014, Q-015)
       .trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md (TC-DATA-006)
"""
from __future__ import annotations

import sys
import traceback
from pathlib import Path

# 支持从 scripts/ 目录直接运行
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.api.projects import _build_workspace_payload  # noqa: E402
from app.db.database import engine  # noqa: E402


def main() -> int:
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT project_id FROM skill_states WHERE is_deleted = 0 OR is_deleted IS NULL")
        ).fetchall()
        pids = [r[0] for r in rows]

    print(f"========== 全表 workspace 完整性验证 ==========")
    print(f"共 {len(pids)} 条 skill_states，逐个调用 _build_workspace_payload...")

    failures: list[tuple[str, str, str]] = []
    for pid in pids:
        try:
            _build_workspace_payload(pid)
        except Exception as e:
            msg = str(e)
            # 排除合理的 404（项目已被软删但 skill_state 残留）
            if "项目状态不存在" in msg or "项目不存在" in msg:
                continue
            failures.append((pid, type(e).__name__, msg[:200]))

    print()
    if not failures:
        print(f"✅ 全部通过：{len(pids)} 条 skill_states，0 失败")
        return 0

    print(f"❌ 失败 {len(failures)} 条：")
    for pid, etype, emsg in failures[:20]:
        print(f"  [{etype}] {pid}")
        print(f"         {emsg}")
    if len(failures) > 20:
        print(f"  ... 及其余 {len(failures) - 20} 条")
    print()
    print("建议：")
    print("  - 检查对应项目的 stages 是否含非法状态值（Q-014）")
    print("  - 检查 light_step_data / standard_step_data 是否被多层编码（Q-015）")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
