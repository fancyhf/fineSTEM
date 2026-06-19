import sqlite3

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()

# 查看 users 表结构
print('--- users 表结构 ---')
cur.execute("PRAGMA table_info(users)")
for col in cur.fetchall():
    print(f'  {col[1]} ({col[2]})')

# 查看用户信息（用 password 列名）
print('\n--- 用户 21749959@qq.com ---')
cur.execute("SELECT * FROM WHERE email = '21749959@qq.com'")
# 先看看列名
cur.execute("SELECT name FROM pragma_table_info('users')")
cols = [r[0] for r in cur.fetchall()]
print(f'列名: {cols}')

# 用列名动态查询
cur.execute(f'SELECT {", ".join(cols)} FROM users WHERE email = "21749959@qq.com"')
row = cur.fetchone()
if row:
    for i, col in enumerate(cols):
        val = str(row[i])
        if len(val) > 50:
            val = val[:50] + '...'
        print(f'  {col}: {val}')
else:
    print('  不存在！')

# 所有用户
print('\n--- 所有用户 ---')
cur.execute(f'SELECT id, email, name FROM users ORDER BY id')
for row in cur.fetchall():
    print(f'  ID={row[0]}  Email={row[1]}  Name={row[2]}')

conn.close()
