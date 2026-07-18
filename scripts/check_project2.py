import sqlite3
conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()

# 查看有哪些表
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("表列表:", [r[0] for r in cur.fetchall()])

# 找到用户 21749959@qq.com 的最新项目
cur.execute('''
    SELECT p.id, p.name, p.current_stage, p.created_at, p.updated_at
    FROM projects p
    WHERE p.created_by = (SELECT id FROM users WHERE email = "21749959@qq.com")
    ORDER BY p.updated_at DESC LIMIT 3
''')
print("\n最近3个项目:")
for row in cur.fetchall():
    print(f"  ID={row[0]}, 名称={row[1]}, 阶段={row[2]}")

# 查看第一个项目的代码（如果有project_files表）
cur.execute('''
    SELECT pf.filename, pf.content, pf.language
    FROM project_files pf
    JOIN projects p ON pf.project_id = p.id
    WHERE p.created_by = (SELECT id FROM users WHERE email = "21749959@qq.com")
    ORDER BY p.updated_at DESC LIMIT 1
''')
row = cur.fetchone()
if row:
    print(f"\n代码文件: {row[0]}")
    print(f"语言: {row[2]}")
    print(f"代码长度: {len(row[1]) if row[1] else 0}")
    print('\n--- 代码前1000字符 ---')
    print((row[1] or '')[:1000])
else:
    print("\n未找到代码文件")
conn.close()
