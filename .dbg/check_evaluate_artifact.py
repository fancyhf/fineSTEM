"""确认 evaluate 工件是否写进 skill_states（artifact_writer 的落库位置）。"""
import json
import sqlite3
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

DB = "D:/data/finestem/finestem.db"
PID = "8a7c155e-5f66-4d7a-a595-e287731ff747"

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("PRAGMA table_info(skill_states)")
cols = [c["name"] for c in cur.fetchall()]
print("skill_states cols:", cols)

cur.execute("SELECT * FROM skill_states WHERE project_id=?", (PID,))
rows = cur.fetchall()
print(f"rows for project: {len(rows)}")
for row in rows:
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, str) and len(v) > 120:
            print(f"  {k}: <str len={len(v)}>")
        else:
            print(f"  {k}: {v}")
    # 深入找 evaluate 工件
    for k in ("artifacts", "standard_step_data", "metadata", "data", "state"):
        if k in d and d[k]:
            try:
                obj = json.loads(d[k]) if isinstance(d[k], str) else d[k]
            except Exception:
                continue
            s = json.dumps(obj, ensure_ascii=False)
            if "evaluate" in s:
                idx = s.find("evaluate")
                print(f"  >>> found 'evaluate' in {k}: ...{s[max(0,idx-40):idx+300]}...")

conn.close()
