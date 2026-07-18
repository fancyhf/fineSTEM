import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r'G:\mediaProjects\fineSTEM\apps\backend')

from app.repositories.runtime_db import db
from pathlib import Path

PROJECT_ID = 'f2a11545-2b53-488d-8c38-7048f3adc801'

ws = db.get_project_workspace(PROJECT_ID) or {}
print('=== workspace ===')
print('filename:', ws.get('filename'))
print('language:', ws.get('language'))
print('code len:', len(str(ws.get('code') or '')))
print('files count:', len(ws.get('files') or []))
for f in (ws.get('files') or [])[:10]:
    print('  file:', f.get('name'), f.get('language'), 'is_main=', f.get('is_main'), 'len=', len(str(f.get('content') or '')))
code = str(ws.get('code') or '')
print('\ncode first 300:')
print(code[:300])

# find project dir on disk
print('\n=== project dirs on disk ===')
for base in [r'G:\mediaProjects\fineSTEM\projects', r'D:\data\finestem\projects']:
    bp = Path(base)
    if bp.exists():
        for p in bp.iterdir():
            if '测验' in p.name or 'quiz' in p.name.lower():
                print('DIR:', p, 'files:')
                for f in p.rglob('*'):
                    if f.is_file() and f.stat().st_size < 50000:
                        print('  ', f.relative_to(p), f.stat().st_size)