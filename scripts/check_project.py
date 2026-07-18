import sqlite3
conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()

# 找到用户 21749959@qq.com 的最新项目
cur.execute('''
    SELECT p.id, p.name, p.current_stage, w.code, w.language, w.filename
    FROM projects p
    LEFT JOIN workspaces w ON p.id = w.project_id
    WHERE p.created_by = (SELECT id FROM users WHERE email = "21749959@qq.com")
    ORDER BY p.updated_at DESC LIMIT 1
''')
row = cur.fetchone()
if row:
    print(f'项目ID: {row[0]}')
    print(f'项目名称: {row[1]}')
    print(f'当前阶段: {row[2]}')
    print(f'代码长度: {len(row[3]) if row[3] else 0}')
    print(f'语言: {row[4]}')
    print(f'文件名: {row[5]}')
    print('\n--- 代码前1000字符 ---')
    print((row[3] or '')[:1000])
else:
    print('未找到项目')
conn.close()
