import sqlite3
import sys
sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()

# 找到用户 21749959@qq.com 的最新项目
cur.execute('''
    SELECT p.id, p.name, p.current_stage, p.created_at, p.updated_at
    FROM projects p
    WHERE p.created_by = (SELECT id FROM users WHERE email = "21749959@qq.com")
    ORDER BY p.updated_at DESC LIMIT 1
''')
row = cur.fetchone()
if row:
    print(f'Project ID: {row[0]}')
    print(f'Name: {row[1]}')
    print(f'Stage: {row[2]}')
    print(f'Updated: {row[4]}')
else:
    print('No project found')
conn.close()
