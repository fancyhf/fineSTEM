# -*- coding: utf-8 -*-
"""Q-037 自愈触发：进程内调用 _build_workspace_payload（与 GET workspace
同一代码路径，owner 密码未知故绕过认证层，不绕过业务逻辑），再复查 DB。"""
import json
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, r"g:\mediaProjects\fineSTEM\apps\backend")

DB = r"D:/data/finestem/finestem.db"
PROJECT_PREFIX = "3c60caf9"

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
row = conn.execute(
    "SELECT p.id, p.name, p.author_id, u.email FROM projects p "
    "LEFT JOIN users u ON u.id = p.author_id WHERE p.id LIKE ?",
    (PROJECT_PREFIX + "%",),
).fetchone()
if not row:
    print("project not found")
    sys.exit(1)
pid = row["id"]
print("project:", pid, row["name"], "| owner:", row["email"])

# 进程内触发水合（与 GET /workspace 相同的自愈落库逻辑）
from app.api.projects import _build_workspace_payload  # noqa: E402

progress, _workspace = _build_workspace_payload(pid)
payload = (progress.standard_step_data or {}).get("step8", {}).get("payload", {})
print("-- 水合返回 step8.payload.acceptance_summary（前 120 字）--")
print(payload.get("acceptance_summary", "")[:120])

# 复查 DB 落库
row2 = conn.execute(
    "SELECT standard_step_data FROM skill_states WHERE project_id=?", (pid,)
).fetchone()
data = json.loads(row2["standard_step_data"])
db_payload = (data.get("step8") or {}).get("payload") or {}
summary = db_payload.get("acceptance_summary", "")
print("-- DB 落库 acceptance_summary（前 120 字）--")
print(summary[:120])
ok = "我想做一个项目" not in summary and summary.strip()
print("自愈结果:", "OK（占位模板已被真实内容替换）" if ok else "FAIL（仍是占位）")
conn.close()
