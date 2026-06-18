"""排查趣味小测验项目的 slug 和草稿文件路径"""
import sqlite3
import re
from pathlib import Path

def _slugify(name: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", name.lower().strip())
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-") or "project"

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()

# 查找所有名称包含"趣味"的项目
cur.execute("SELECT id, name, mode, current_stage FROM projects WHERE name LIKE '%趣味%' AND is_deleted = 0")
rows = cur.fetchall()
print('=== 匹配的项目 ===')
for r in rows:
    print(f'  id={r[0]}, name={r[1]}, mode={r[2]}, stage={r[3]}')
    slug = _slugify(r[1])
    draft_path = Path('D:/data/finestem') / 'projects' / slug / 'docs' / 'reports' / '成果档案卡.md'
    print(f'    slug={slug}')
    print(f'    draft_path={draft_path}')
    print(f'    exists={draft_path.exists()}')
    if draft_path.exists():
        print(f'    content={draft_path.read_text(encoding="utf-8")[:200]}')
    print()

# 也列出 D:/data/finestem/projects/ 下所有目录
print('=== 磁盘项目目录 ===')
projects_dir = Path('D:/data/finestem') / 'projects'
if projects_dir.exists():
    for d in sorted(projects_dir.iterdir()):
        if d.is_dir():
            has_docs = (d / 'docs').exists()
            has_reports = (d / 'docs' / 'reports').exists()
            has_draft = (d / 'docs' / 'reports' / '成果档案卡.md').exists()
            print(f'  {d.name}  docs={has_docs}  reports={has_reports}  draft={has_draft}')

conn.close()
