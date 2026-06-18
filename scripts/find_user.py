"""查询 testuser 登录凭据"""
import sqlite3

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()
cur.execute("SELECT id, name, email, role FROM users WHERE name LIKE '%test%' OR email LIKE '%test%' LIMIT 5")
rows = cur.fetchall()
print('=== test 用户 ===')
for r in rows:
    print(f'  id={r[0]}, name={r[1]}, email={r[2]}, role={r[3]}')

# 查看有哪些用户
cur.execute("SELECT id, name, email, role FROM users LIMIT 10")
rows = cur.fetchall()
print('\n=== 所有用户 ===')
for r in rows:
    print(f'  id={r[0]}, name={r[1]}, email={r[2]}, role={r[3]}')

conn.close()
