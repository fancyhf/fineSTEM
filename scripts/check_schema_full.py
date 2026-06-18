"""检查 skill_states 完整表结构（包括所有列）"""
import sqlite3

DB_PATH = "D:/data/finestem/finestem.db"
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# 完整表结构
cur.execute("PRAGMA table_info(skill_states)")
cols = cur.fetchall()
print("skill_states 完整表结构:")
for col in cols:
    print(f"  {col[1]:<30} {col[2]:<15} NOT_NULL={col[3]} DEFAULT={col[4]}")

# 查看一个 standard 模式的 skill_state
cur.execute("SELECT * FROM skill_states WHERE mode='standard' LIMIT 1")
row = cur.fetchone()
if row:
    print("\nstandard 模式样本:")
    for k, v in zip([d[0] for d in cur.description], row):
        print(f"  {k}: {str(v)[:100]}")
else:
    print("\n没有 standard 模式的 skill_state")

conn.close()
