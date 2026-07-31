# 检查今天 15:00 后创建的项目（本轮 MOCK_USER 测试）
import sqlite3, os, sys
DB = 'D:/data/finestem/finestem.db'
con = sqlite3.connect(DB)
cur = con.cursor()

# 查询今天 15:00 后创建的项目（本轮测试）
cur.execute('''
SELECT id, name, created_at FROM projects 
WHERE created_at >= '2026-07-30 15:00:00' 
ORDER BY created_at ASC
''')
rows = cur.fetchall()

print('=== 2026-07-30 15:00 后创建的项目（本轮测试）===')
for r in rows:
    print(f'ID: {r[0]}')
    print(f'Name: {r[1]}')
    print(f'Created: {r[2]}')
    print('---')

print(f'\n本轮新建项目数: {len(rows)}')
if len(rows) == 1:
    print('✅ 确认本轮只新建了 1 个项目')
    sys.exit(0)
else:
    print('❌ 本轮新建了多个项目，F5 修复可能未生效')
    sys.exit(1)
