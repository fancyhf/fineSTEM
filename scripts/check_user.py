import sqlite3

conn = sqlite3.connect('apps/backend/data/fine_stem.db')
cur = conn.cursor()

# 查看用户信息
cur.execute('SELECT id, email, name, substr(password_hash, 1, 30) FROM users WHERE email = "21749959@qq.com"')
row = cur.fetchone()
if row:
    print(f'用户ID: {row[0]}')
    print(f'邮箱: {row[1]}')
    print(f'姓名: {row[2]}')
    print(f'密码哈希前缀: {row[3]}...')
else:
    print('用户 21749959@qq.com 不存在！')

# 列出所有用户
print('\n--- 所有用户列表 ---')
cur.execute('SELECT id, email, name FROM users ORDER BY id')
for row in cur.fetchall():
    print(f'  ID={row[0]}  Email={row[1]}  Name={row[2]}')

conn.close()
