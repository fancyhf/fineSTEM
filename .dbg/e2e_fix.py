"""端到端验证截图服务 + 修复 f2a11545 的坏封面。"""
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r'G:\mediaProjects\fineSTEM\apps\backend')

from pathlib import Path
from app.services.screenshot_service import screenshot_service
from app.services.storage_service import storage_service
from app.repositories.runtime_db import db
from app.schemas.evidence import Evidence as EvSchema
from app.core.time_utils import utc_now_iso

OWNER_ID = '27fb2e88-bf95-4c98-b33b-688891d40f43'
PROJECT_ID = 'f2a11545-2b53-488d-8c38-7048f3adc801'

# ---- 1) 证明截图服务本身能工作 ----
sample_html = """<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:sans-serif;background:linear-gradient(135deg,#0ea5e9,#14b8a6);color:#fff;
display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0}
h1{font-size:48px;margin:0 0 16px} .card{background:#fff;color:#1f2937;border-radius:16px;
padding:32px 40px;box-shadow:0 20px 40px rgba(0,0,0,.2);text-align:center}
.badge{display:inline-block;background:#14b8a6;color:#fff;padding:4px 12px;border-radius:999px;
font-size:12px;margin-bottom:12px} ol{text-align:left} </style></head>
<body><div class="card"><span class="badge">科学百科</span>
<h1>科学百科小测验</h1><p>一个趣味科学问答 Web 应用</p>
<ol><li>随机出题</li><li>选项交互</li><li>自动计分</li></ol></div></body></html>"""

print('=== 1) screenshot_service.capture_html ===')
png = screenshot_service.capture_html(sample_html)
print('  PNG bytes =', len(png))
( Path(r'G:\mediaProjects\fineSTEM\.dbg') / 'sample_capture.png').write_bytes(png)
print('  saved .dbg/sample_capture.png')

# ---- 2) 保存为项目截图证据 ----
print('\n=== 2) save_screenshot_bytes + create_evidence ===')
meta = storage_service.save_screenshot_bytes(owner_id=OWNER_ID, project_id=PROJECT_ID, content=png)
uploads_base = Path(storage_service.base_path) / storage_service.upload_dir
rel = Path(meta["stored_path"]).relative_to(uploads_base)
public_url = f"/uploads/{rel.as_posix()}"
print('  stored:', meta["stored_path"])
print('  public_url:', public_url)
ev = EvSchema(project_id=PROJECT_ID, author_id=OWNER_ID, type="screenshot",
              title="项目运行截图", content=f"运行截图自动采集 @ {utc_now_iso()}",
              content_url=public_url, created_by=OWNER_ID)
created_ev = db.create_evidence(ev)
print('  evidence id:', created_ev.id, 'url:', created_ev.content_url)

# ---- 3) 修复坏封面：把 screenshots 指向真实存在的生成封面 ----
print('\n=== 3) 修复成果卡封面 ===')
CARD_ID = '544215f5-bc2d-4832-8c48-7fa2c9ee934c'
cover_path = Path(storage_service.base_path) / 'generated' / 'covers' / f'{CARD_ID}.png'
print('  cover file exists?', cover_path.exists(), cover_path)
if cover_path.exists():
    new_cover_url = f"/media/covers/{CARD_ID}.png"
    updated = db.update_achievement_card(CARD_ID, {"screenshots": [new_cover_url]})
    print('  updated card screenshots:', updated.screenshots)

# ---- 4) 重新查截图列表 ----
print('\n=== 4) 项目当前可选用截图 ===')
for ev_ in db.list_evidence(project_id=PROJECT_ID, skip=0, limit=20, type="screenshot"):
    print('  -', ev_.id, '|', ev_.title, '|', ev_.content_url)