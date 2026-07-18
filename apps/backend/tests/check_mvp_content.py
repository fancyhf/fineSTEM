"""检查 workspace 当前代码是否是 MVP 僵尸代码"""
import sqlite3
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

DB_PATH = "D:/data/finestem/finestem.db"
PROJECT_ID = "b686df08-6655-4edb-a3a5-955f3244abe1"

conn = sqlite3.connect(DB_PATH)
row = conn.execute("SELECT initial_data FROM projects WHERE id=?", (PROJECT_ID,)).fetchone()
data = json.loads(row[0])
ws = data.get("workspace", {})
code = ws.get("code", "")
files = ws.get("files", [])

print(f"=== CODE FIELD (first 800 chars) ===")
print(code[:800])
print(f"\n... total length: {len(code)}")

MVP_MARKERS = ["fineSTEM MVP", "actionButton", "已成功运行", "这是一个可运行的最小版本",
               "你可以继续让 AI 按你的项目主题扩展功能"]
found = [m for m in MVP_MARKERS if m in code]
print(f"\n=== MVP MARKERS ===")
if found:
    print(f"!!! ZOMBIE MVP DETECTED: {found} !!!")
else:
    print("No MVP markers in code field")

# Also check files
print(f"\n=== FILES ({len(files)}) ===")
for f in files:
    fc = f.get("content", "")
    f_found = [m for m in MVP_MARKERS if m in fc]
    print(f"  {f['name']}: len={len(fc)} MVP={f_found if f_found else 'clean'}")

conn.close()
