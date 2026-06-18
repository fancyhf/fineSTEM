"""验证 BF3 测试项目"""
import sqlite3

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()
cur.execute("SELECT id, name, mode, current_stage FROM projects WHERE id = 'bf3-test-0001-0000-0000-000000000001'")
print('项目:', cur.fetchone())
cur.execute("SELECT project_id, mode, current_stage, light_step FROM skill_states WHERE project_id = 'bf3-test-0001-0000-0000-000000000001'")
print('状态:', cur.fetchone())
conn.close()
