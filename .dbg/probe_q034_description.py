# -*- coding: utf-8 -*-
"""Q-033 探针：检查 projects.description 现状及自愈回填可用数据源。"""
import json
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")

DB = r"D:/data/finestem/finestem.db"
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

rows = conn.execute(
    """
    SELECT p.id, p.name, p.description, p.mode, p.is_deleted,
           s.light_step_data, s.standard_step_data, s.metadata
    FROM projects p LEFT JOIN skill_states s ON s.project_id = p.id
    WHERE p.is_deleted = 0
    ORDER BY p.updated_at DESC LIMIT 10
    """
).fetchall()

for r in rows:
    print("=" * 70)
    print(f"[{r['id'][:8]}] {r['name']} mode={r['mode']} desc={r['description']!r}")
    for col in ("metadata", "light_step_data", "standard_step_data"):
        raw = r[col]
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            print(f"  {col}: <非JSON> {raw[:80]!r}")
            continue
        if not isinstance(data, dict):
            continue
        keys = ("one_liner", "description", "project_description", "brief_content")
        found = {k: data[k] for k in keys if data.get(k)}
        if found:
            print(f"  {col}: {json.dumps(found, ensure_ascii=False)[:300]}")

# 成果卡 one_liner
print("=" * 70)
cards = conn.execute(
    "SELECT project_id, one_liner FROM achievement_cards LIMIT 10"
).fetchall()
for c in cards:
    print(f"card [{c['project_id'][:8]}] one_liner={c['one_liner']!r}")

# 截图中的两个项目
print("=" * 70)
for pid in ("8a7c155e", "4e8f476a"):
    for r in conn.execute(
        "SELECT substr(id,1,8) sid, name, description FROM projects WHERE id LIKE ?",
        (pid + "%",),
    ):
        print(f"[{r['sid']}] {r['name']} desc={r['description']!r}")
conn.close()
