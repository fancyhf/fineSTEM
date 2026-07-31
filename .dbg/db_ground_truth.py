"""
E2E 测试用的 DB ground-truth 读取器（被 manual-retest-v1.6.js 通过子进程调用）。

用法：
    python db_ground_truth.py name <project_id_prefix>
    python db_ground_truth.py evaluate <project_id_prefix>
    python db_ground_truth.py latest_project

输出：单行 JSON，便于 Node 端 JSON.parse。
为什么用 DB 落库状态做判据：E2E 只匹配短窗口内的 console [tool_call] 日志会假阴性
（agentic 工具链是多次串行 LLM 往返，writer 在链尾才调用）。projects.name /
evaluate_content 的实际变化 + updated_at 前移才是不可辩驳的 ground truth。
"""
import json
import sqlite3
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

DB = "D:/data/finestem/finestem.db"


def _find_key(obj, target):
    """递归在嵌套 dict/list 中找 target 键的值，返回第一个命中。"""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == target and isinstance(v, str):
                return v
            found = _find_key(v, target)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _find_key(item, target)
            if found is not None:
                return found
    return None


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    pid = sys.argv[2] if len(sys.argv) > 2 else ""
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    if mode == "name":
        r = cur.execute(
            "SELECT id, name, updated_at FROM projects WHERE id LIKE ?",
            (pid + "%",),
        ).fetchone()
        out = {
            "found": bool(r),
            "id": r["id"] if r else None,
            "name": r["name"] if r else None,
            "updated_at": r["updated_at"] if r else None,
        }
    elif mode == "evaluate":
        r = cur.execute(
            "SELECT standard_step_data, metadata, updated_at "
            "FROM skill_states WHERE project_id LIKE ?",
            (pid + "%",),
        ).fetchone()
        ev = ""
        if r:
            for col in ("standard_step_data", "metadata"):
                raw = r[col]
                if not raw:
                    continue
                try:
                    obj = json.loads(raw) if isinstance(raw, str) else raw
                except Exception:
                    continue
                v = _find_key(obj, "evaluate_content")
                if v:
                    ev = v
                    break
        out = {
            "found": bool(r),
            "evaluate_len": len(ev),
            "evaluate_head": ev[:120],
            "updated_at": r["updated_at"] if r else None,
        }
    elif mode == "latest_project":
        r = cur.execute(
            "SELECT id, name, updated_at FROM projects "
            "ORDER BY updated_at DESC LIMIT 1"
        ).fetchone()
        out = {
            "found": bool(r),
            "id": r["id"] if r else None,
            "name": r["name"] if r else None,
            "updated_at": r["updated_at"] if r else None,
        }
    else:
        out = {"error": f"unknown mode: {mode}"}

    conn.close()
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
