"""
清除项目 workspace 中的 MVP 代码
"""
import sqlite3, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB_PATH = "D:/data/finestem/finestem.db"
PROJECT_ID = "b686df08-6655-4edb-a3a5-955f3244abe1"

conn = sqlite3.connect(DB_PATH)
row = conn.execute("SELECT initial_data FROM projects WHERE id=?", (PROJECT_ID,)).fetchone()

if not row or not row[0]:
    print("Project not found!")
    sys.exit(1)

initial_data = json.loads(row[0])
workspace = initial_data.get("workspace", {})
code = workspace.get("code", "")
lang = workspace.get("language", "")

print(f"Current code length: {len(code)}")
print(f"Current language: {lang}")

mvp_markers = ["fineSTEM MVP", "我的 STEM 项目 MVP", "actionButton", "已成功运行"]
has_mvp = any(m in code for m in mvp_markers)
print(f"Has MVP code: {has_mvp}")

if has_mvp:
    # 清空 MVP 代码，保留空 workspace 结构
    workspace["code"] = ""
    workspace["language"] = "html"
    workspace["filename"] = "index.html"
    workspace["files"] = []
    workspace["saved_at"] = None
    initial_data["workspace"] = workspace
    
    conn.execute(
        "UPDATE projects SET initial_data=? WHERE id=?",
        (json.dumps(initial_data), PROJECT_ID)
    )
    conn.commit()
    print("\nDONE: MVP code cleared from workspace!")
else:
    print("\nNo MVP code found in workspace.")

conn.close()
