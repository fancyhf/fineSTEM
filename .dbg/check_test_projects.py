# 核对本次测试执行期间新建项目数
import sqlite3, sys
DB = 'D:/data/finestem/finestem.db'
con = sqlite3.connect(DB)
cur = con.cursor()

# 查询 16:21 后创建的项目（本次测试执行）
cur.execute('''
SELECT id, name, created_at FROM projects 
WHERE created_at >= '2026-07-30 16:21:00' 
ORDER BY created_at ASC
''')
rows = cur.fetchall()

print('=== 2026-07-30 16:21 后创建的项目（本次测试）===')
for r in rows:
    print(f'ID: {r[0]}')
    print(f'Name: {r[1]}')
    print(f'Created: {r[2]}')
    print('---')

print(f'\n本次测试新建项目数: {len(rows)}')
print('预期: 阶段A 1个 + TC-06 1个 = 2个')

if len(rows) == 2:
    print('✅ TC-C1 通过：恰好新建 2 个项目')
    sys.exit(0)
else:
    print(f'❌ TC-C1 失败：实际 {len(rows)} 个，预期 2 个')
    sys.exit(1)
