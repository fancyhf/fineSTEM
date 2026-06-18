"""查找 skill_state 相关表名"""
import sqlite3

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print('所有表:')
for t in tables:
    print(' ', t)

# 找含 skill 或 state 的
related = [t for t in tables if 'skill' in t.lower() or 'state' in t.lower()]
print('\nskill/state 相关表:', related)
