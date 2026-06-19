"""删除数据库中 id 为空的坏项目，并检查 Fork 操作产生空 ID 的逻辑。"""
import sqlite3
import uuid

conn = sqlite3.connect(r'D:\data\finestem\finestem.db')
cur = conn.cursor()

# 1. 列出所有空 ID 项目
cur.execute("SELECT id, name, created_at FROM projects WHERE id = '' OR id IS NULL")
bad = cur.fetchall()
print(f"坏项目数: {len(bad)}")
for r in bad:
    print(f"  删除: id='{r[0]}' name='{r[1]}'")
    # 同时清理关联数据
    for table in ['skill_states', 'achievement_cards', 'evidence']:
        cur.execute(f"DELETE FROM {table} WHERE project_id = ''")
        if cur.rowcount:
            print(f"    清理 {table}: {cur.rowcount} 条")

# 2. 删除空 ID 项目
cur.execute("DELETE FROM projects WHERE id = '' OR id IS NULL")
print(f"\n删除项目: {cur.rowcount} 条")

conn.commit()
conn.close()
print("完成。")
