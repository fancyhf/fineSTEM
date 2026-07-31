# -*- coding: utf-8 -*-
"""检查 verify_q037 临时项目是否残留（delete 是否软删除）。"""
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")
conn = sqlite3.connect(r"D:/data/finestem/finestem.db")
conn.row_factory = sqlite3.Row
rows = conn.execute(
    "SELECT id, name, is_deleted FROM projects WHERE name LIKE 'Q037%'"
).fetchall()
for r in rows:
    print(dict(r))
if not rows:
    print("无 Q037 临时项目残留")
conn.close()
