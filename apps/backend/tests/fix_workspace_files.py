"""
直接修复：从 projects/{id}/src/ 读取 4 个文件，正确写入 workspace DB
解决 project_code_writer 多次调用覆盖 files 数组的问题
"""
import sqlite3
import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

DB_PATH = "D:/data/finestem/finestem.db"
PROJECT_ID = "b686df08-6655-4edb-a3a5-955f3244abe1"
SRC_DIR = f"projects/{PROJECT_ID}/src"

# 文件名 -> 语言映射
FILE_LANG_MAP = {
    "index.html": "html",
    "style.css": "css",
    "story_data.js": "javascript",
    "story_engine.js": "javascript",
}

def main():
    # 1. 读取 src 目录下的所有文件
    if not os.path.isdir(SRC_DIR):
        print(f"ERROR: src directory not found: {SRC_DIR}")
        sys.exit(1)
    
    files = []
    for fname in sorted(os.listdir(SRC_DIR)):
        fpath = os.path.join(SRC_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
        
        lang = FILE_LANG_MAP.get(fname, "text")
        is_main = (fname == "index.html")  # index.html 始终为主文件
        
        files.append({
            "name": fname,
            "language": lang,
            "content": content,
            "is_main": is_main,
        })
        print(f"  Read: {fname:<20} lang={lang:<12} is_main={is_main!s:<5} len={len(content):>6}")
    
    if not files:
        print("ERROR: No files found in src directory!")
        sys.exit(1)
    
    # 2. 写入数据库
    from datetime import datetime, timezone
    saved_at = datetime.now(timezone.utc).isoformat()
    
    # 用第一个文件（应该是 index.html）作为 code 字段的值
    main_file = next((f for f in files if f["is_main"]), files[0])
    
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT initial_data FROM projects WHERE id=?", (PROJECT_ID,)
    ).fetchone()
    
    if not row:
        print(f"ERROR: Project {PROJECT_ID} not found!")
        conn.close()
        sys.exit(1)
    
    data = json.loads(row[0])
    
    # 更新 workspace
    if "workspace" not in data:
        data["workspace"] = {}
    
    data["workspace"].update({
        "code": main_file["content"],
        "language": main_file["language"],
        "filename": main_file["name"],
        "files": files,
        "saved_at": saved_at,
    })
    
    # 保存回数据库
    conn.execute(
        "UPDATE projects SET initial_data=? WHERE id=?",
        (json.dumps(data, ensure_ascii=False), PROJECT_ID)
    )
    conn.commit()
    conn.close()
    
    # 3. 验证
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT initial_data FROM projects WHERE id=?", (PROJECT_ID,)
    ).fetchone()
    data = json.loads(row[0])
    ws_files = data.get("workspace", {}).get("files", [])
    
    print(f"\n=== VERIFICATION ===")
    print(f"Total files in workspace: {len(ws_files)}")
    for f in ws_files:
        marker = " >>> MAIN <<<" if f.get("is_main") else ""
        print(f"  {f['name']:<20} is_main={str(f.get('is_main')):<5} "
              f"len={len(f.get('content','')):>6}{marker}")
    
    main_file_name = next((f["name"] for f in ws_files if f.get("is_main")), None)
    expected = {"index.html", "style.css", "story_data.js", "story_engine.js"}
    actual = {f["name"] for f in ws_files}
    
    print(f"\nMain file: {main_file_name}")
    if expected == actual and main_file_name == "index.html":
        print(">>> SUCCESS: All 4 files correctly written, index.html is main <<<")
    else:
        missing = expected - actual
        extra = actual - expected
        if missing:
            print(f"  MISSING: {missing}")
        if extra:
            print(f"  EXTRA: {extra}")
        if main_file_name != "index.html":
            print(f"  WRONG MAIN: {main_file_name} (expected index.html)")
        print(">>> FAILED <<<")
        sys.exit(1)
    
    conn.close()

if __name__ == "__main__":
    main()
