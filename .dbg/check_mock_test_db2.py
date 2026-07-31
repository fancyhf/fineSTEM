# 深查：全部表名 + 两个测试项目的对话/工作区存储位置
import sqlite3

DB = 'D:/data/finestem/finestem.db'
PIDS = ['46a30679-2432-40bb-ab17-2b62627b430a', 'a133bd66-91e0-4c21-9568-1a7dac8a0bda']
con = sqlite3.connect(DB)
cur = con.cursor()

tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print('全部表:', tables)

for t in tables:
    tcols = [r[1] for r in cur.execute(f'PRAGMA table_info({t})').fetchall()]
    if 'project_id' not in tcols:
        continue
    for pid in PIDS:
        try:
            n = cur.execute(f"SELECT COUNT(*) FROM {t} WHERE project_id=?", (pid,)).fetchone()[0]
            if n:
                print(f'{t} / {pid[:8]}: {n} 行, 列={tcols}')
        except Exception as e:
            print(f'{t} 查询失败: {e}')

# projects.initial_data 里是否有工作区快照
for pid in PIDS:
    row = cur.execute("SELECT length(initial_data), substr(initial_data,1,200) FROM projects WHERE id=?", (pid,)).fetchone()
    print(f'\n{pid[:8]} initial_data 长度={row[0]}')
    print(' 头200字符:', (row[1] or '').replace(chr(10), ' '))
con.close()
