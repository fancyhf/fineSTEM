"""查看 projects 表结构"""
import sqlite3

conn = sqlite3.connect("D:/data/finestem/finestem.db")
cur = conn.cursor()
cur.execute("PRAGMA table_info(projects)")
print("=== projects 表结构 ===")
for row in cur.fetchall():
    print(row)

print("\n=== 现有项目数据 ===")
cur.execute("SELECT id, name, mode, current_stage, description FROM projects")
for row in cur.fetchall():
    print(row)

print("\n=== skill_states 表结构 ===")
cur.execute("PRAGMA table_info(skill_states)")
for row in cur.fetchall():
    print(row)

conn.close()
