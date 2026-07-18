import sqlite3
import json

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cursor = conn.cursor()

# 查询项目状态
cursor.execute('SELECT project_id, current_stage, stage_history FROM skill_states WHERE project_id = ?', ('b686df08-6655-4edb-a3a5-955f3244abe1',))
row = cursor.fetchone()

if row:
    print(f'Project ID: {row[0]}')
    print(f'Current Stage: {row[1]}')
    print(f'Stage History: {row[2]}')
else:
    print('No skill state found for this project')

conn.close()
