# 检查项目 8a7c155e 的工作区代码与文件（AI 说"代码不在本地文件系统"）
import sqlite3, os, json

DB = 'D:/data/finestem/finestem.db'
PID = '8a7c155e-5f66-4d7a-a595-e287731ff747'
con = sqlite3.connect(DB)
cur = con.cursor()

row = cur.execute("SELECT name, current_stage, updated_at, length(initial_data) FROM projects WHERE id=?", (PID,)).fetchone()
print('项目:', row)

raw = cur.execute("SELECT initial_data FROM projects WHERE id=?", (PID,)).fetchone()[0]
try:
    data = json.loads(raw or '{}')
    ws = data.get('workspace', {})
    code = ws.get('code', '')
    files = ws.get('files', []) or []
    msgs = ws.get('chat_messages', []) or []
    print(f'workspace.code: {len(code)} 字符, {len(code.splitlines())} 行')
    print(f'workspace.files: {len(files)} 个')
    for f in files:
        print(f"  - {f.get('name')}  {len(f.get('content') or '')} 字符")
    print(f'chat_messages: {len(msgs)} 条')
    if msgs:
        for m in msgs[-4:]:
            print('  ', m.get('role'), ':', (m.get('content') or '')[:80].replace(chr(10), ' '))
except Exception as e:
    print('initial_data 解析失败:', e)

# 文件系统目录
base = os.path.join(os.path.dirname(__file__), '..', 'apps', 'backend', 'projects', PID)
print('\n文件系统目录存在:', os.path.isdir(base))
if os.path.isdir(base):
    for root, _, fs in os.walk(base):
        for f in fs:
            fp = os.path.join(root, f)
            print(' ', os.path.relpath(fp, base), os.path.getsize(fp), 'B')
con.close()
