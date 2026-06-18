"""检查 skill_states 表结构"""
import sqlite3

DB_PATH = "D:/data/finestem/finestem.db"
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("PRAGMA table_info(skill_states)")
print("skill_states 表结构:")
for col in cur.fetchall():
    print(f"  {col[1]} ({col[2]})")

# 查看一个现有的 skill_state 样本
cur.execute("SELECT * FROM skill_states LIMIT 1")
row = cur.fetchone()
if row:
    print("\n样本数据:")
    for k, v in zip([d[0] for d in cur.description], row):
        print(f"  {k}: {str(v)[:100]}")

conn.close()
