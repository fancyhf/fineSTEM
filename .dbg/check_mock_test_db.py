# 检查 MOCK_USER 2026-07-30 实测产生的项目：对话是否落库、代码是否写入
import sqlite3, os

DB = 'D:/data/finestem/finestem.db'
con = sqlite3.connect(DB)
cur = con.cursor()

cols = [r[1] for r in cur.execute('PRAGMA table_info(projects)').fetchall()]
print('projects 列:', cols)

name_col = 'name' if 'name' in cols else ('project_name' if 'project_name' in cols else cols[1])
cur.execute(f"""
SELECT p.id, p.{name_col}, p.created_at FROM projects p
JOIN users u ON p.author_id = u.id
WHERE u.email = '2749959@qq.com' AND p.created_at >= '2026-07-30'
ORDER BY p.created_at DESC LIMIT 5
""")
rows = cur.fetchall()
print('\n今天 MOCK_USER 的项目:')
for r in rows:
    print(' ', r)

chat_tables = [r[0] for r in cur.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%chat%' OR name LIKE '%message%' OR name LIKE '%workspace%')"
).fetchall()]
print('\n聊天相关表:', chat_tables)

for pid, title, _ in rows:
    for t in chat_tables:
        tcols = [r[1] for r in cur.execute(f'PRAGMA table_info({t})').fetchall()]
        if 'project_id' not in tcols:
            continue
        try:
            n = cur.execute(f"SELECT COUNT(*) FROM {t} WHERE project_id=?", (pid,)).fetchone()[0]
            if n:
                print(f'\n项目 {str(title)[:20]} ({pid[:8]}) 表 {t}: {n} 行')
                textcol = 'content' if 'content' in tcols else ('messages' if 'messages' in tcols else None)
                if textcol:
                    for m in cur.execute(f"SELECT substr({textcol},1,150) FROM {t} WHERE project_id=? ORDER BY rowid DESC LIMIT 3", (pid,)):
                        print('   ', m[0].replace(chr(10), ' ')[:150])
        except Exception as e:
            print(f'  表 {t} 查询失败: {e}')

# 项目代码文件
print('\n项目文件目录:')
base = os.path.join(os.path.dirname(__file__), '..', 'apps', 'backend', 'projects')
for pid, title, _ in rows:
    d = os.path.join(base, pid)
    if os.path.isdir(d):
        for root, _, files in os.walk(d):
            for f in files:
                fp = os.path.join(root, f)
                lines = 0
                try:
                    lines = sum(1 for _ in open(fp, encoding='utf-8', errors='ignore'))
                except Exception:
                    pass
                print(f'  [{str(title)[:15]}] {os.path.relpath(fp, d)}  {os.path.getsize(fp)}B  {lines}行')
    else:
        print(f'  [{str(title)[:15]}] 无文件目录')
con.close()
