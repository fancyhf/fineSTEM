"""端到端复现+修复：以 owner 身份走真实 capture 流程，并修掉坏封面。"""
import sys, io, json, base64, httpx
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r'G:\mediaProjects\fineSTEM\apps\backend')

from datetime import timedelta
from app.api.auth import create_access_token
from app.repositories.runtime_db import db
from app.services.screenshot_service import screenshot_service
from app.services.storage_service import storage_service
import sqlite3

OWNER_ID = '27fb2e88-bf95-4c98-b33b-688891d40f43'
PROJECT_ID = 'f2a11545-2b53-488d-8c38-7048f3adc801'

# 1) inspect workspace preview_html
ws = db.get_project_workspace(PROJECT_ID) or {}
print('=== workspace keys ===', list(ws.keys()))
print('preview_html len:', len(str(ws.get('preview_html') or '')))
ph = str(ws.get('preview_html') or '')
print('preview_html preview:', ph[:200])

# also check project files on disk
from pathlib import Path
proj_dir = Path(r'G:\mediaProjects\fineSTEM\projects') 
for p in proj_dir.iterdir():
    if '测验' in p.name or 'quiz' in p.name.lower() or 'f2a11545' in p.name:
        print('PROJ DIR:', p)
        for f in (p / 'src').glob('*') if (p/'src').exists() else []:
            print('  file:', f.name, f.stat().st_size)

# 2) Try capture_html with the saved preview_html (no streamlit needed)
print('\n=== direct screenshot_service.capture_html ===')
try:
    if ph.strip():
        png = screenshot_service.capture_html(ph)
        print('PNG bytes:', len(png))
        # save to disk for inspection
        out = r'G:\mediaProjects\fineSTEM\.dbg\preview_capture.png'
        Path(out).write_bytes(png)
        print('saved to', out)
    else:
        print('no preview_html to capture')
except Exception as e:
    print('capture_html FAILED:', type(e).__name__, e)