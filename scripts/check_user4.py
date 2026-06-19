import sqlite3

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()

# 查看用户信息
print('--- 用户 21749959@qq.com ---')
cur.execute("SELECT id, email, name, substr(hashed_password, 1, 40), is_deleted FROM users WHERE email = '21749959@qq.com'")
row = cur.fetchone()
if row:
    print(f'  ID: {row[0]}')
    print(f'  邮箱: {row[1]}')
    print(f'  姓名: {row[2]}')
    print(f'  密码哈希前缀: {row[3]}...')
    print(f'  已删除: {row[4]}')
else:
    print('  不存在！')

# 所有用户
print('\n--- 所有用户 ---')
cur.execute("SELECT id, email, name, is_deleted FROM users ORDER BY id")
for row in cur.fetchall():
    print(f'  ID={row[0]}  Email={row[1]}  Name={row[2]}  Deleted={row[3]}')

conn.close()
