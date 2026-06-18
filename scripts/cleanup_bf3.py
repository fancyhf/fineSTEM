"""清理 BF3 测试数据"""
import sqlite3

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()
cur.execute("DELETE FROM skill_states WHERE project_id = 'bf3-test-0001-0000-0000-000000000001'")
cur.execute("DELETE FROM projects WHERE id = 'bf3-test-0001-0000-0000-000000000001'")
conn.commit()
print('已清理 BF3 测试数据')
conn.close()
