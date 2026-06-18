"""查找轻量项目"""
import sqlite3

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()
cur.execute("SELECT p.id, p.name, p.mode, p.current_stage FROM projects p WHERE p.mode = 'light' AND p.is_deleted = 0")
print('轻量项目:')
for r in cur.fetchall():
    print(' ', r)
