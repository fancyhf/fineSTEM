"""Quick check: workspace files and is_main status"""
import sqlite3
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

DB_PATH = "D:/data/finestem/finestem.db"
PROJECT_ID = "b686df08-6655-4edb-a3a5-955f3244abe1"

conn = sqlite3.connect(DB_PATH)
tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print(f"Tables: {tables}")

if 'projects' not in tables:
    print("No projects table, trying others...")
    for t in tables:
        cols = [r[1] for r in conn.execute(f"PRAGMA table_info({t})").fetchall()]
        print(f"  {t}: {cols}")
    conn.close()
    sys.exit(0)

row = conn.execute("SELECT initial_data FROM projects WHERE id=?", (PROJECT_ID,)).fetchone()
if not row:
    print("Project not found!")
    conn.close()
    sys.exit(1)

data = json.loads(row[0])
ws = data.get("workspace", {})
files = ws.get("files", [])

print(f"\nTotal files: {len(files)}")
print("-" * 60)
for f in files:
    name = f.get("name", "?")
    is_main = f.get("is_main", False)
    lang = f.get("language", "?")
    content_len = len(f.get("content", ""))
    print(f"  name={name:<20} is_main={is_main!s:<5} lang={lang:<10} content_len={content_len}")

main_files = [f for f in files if f.get("is_main")]
print(f"\nMain files: {[f['name'] for f in main_files]}")

index_html = [f for f in files if f["name"] == "index.html"]
if index_html:
    print(f"\nindex.html found: is_main={index_html[0].get('is_main', False)}")
else:
    print("\nWARNING: index.html NOT found in files!")

conn.close()
