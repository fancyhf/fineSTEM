# -*- coding: utf-8 -*-
"""Q-037 探针：对比 step8.payload 与 evaluate_content（运动小管家）"""
import json
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")

DB = r"D:/data/finestem/finestem.db"
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

rows = conn.execute(
    "SELECT id, name FROM projects WHERE name LIKE '%运动%' ORDER BY updated_at DESC"
).fetchall()
for r in rows:
    print("project:", r["id"], r["name"])

if not rows:
    print("no project matched 运动")
    sys.exit(0)

for r in rows:
    ss = conn.execute(
        "SELECT standard_step_data FROM skill_states WHERE project_id=?", (r["id"],)
    ).fetchone()
    if not ss or not ss["standard_step_data"]:
        print(f"-- {r['id']}: no skill_state/standard_step_data")
        continue
    data = json.loads(ss["standard_step_data"])
    step8 = data.get("step8") or {}
    payload = step8.get("payload") or {}
    ec = data.get("evaluate_content") or ""
    print("=" * 60)
    print("project:", r["id"], r["name"])
    print("-- step8.payload.acceptance_summary:")
    print(repr(payload.get("acceptance_summary", ""))[:400])
    print("-- step8.payload.reflection:")
    print(repr(payload.get("reflection", ""))[:200])
    print("-- step8.payload.next_iteration:")
    print(repr(payload.get("next_iteration", ""))[:200])
    print("-- evaluate_content (first 500 chars):")
    print(ec[:500])
conn.close()
