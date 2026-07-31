"""
Ground-truth 诊断脚本：直接驱动真实 ZeroClaw daemon 会话。

目的：v1.6 复测中 AI 不调用 skill_state_writer / artifact_writer。已排除所有
结构性原因（config 规则已注入、daemon 已重启、MCP server 在跑、tool_filter 放行、
SOP 允许）。本脚本复制前端 useStreamingChat.ts 的 WS 握手，驱动一次针对 stage_08
项目的"重写评估报告"请求，捕获 daemon 返回的每一个 tool_call 事件，获得 ground truth：
到底是 daemon 没把规则/工具给模型，还是模型收到了却不调用。

用法：
    .venv\\Scripts\\python.exe .dbg\\probe_daemon_ws.py [project_id]
不传 project_id 则自动挑一个 current_stage 尽量靠后的项目。
"""
import asyncio
import json
import sqlite3
import sys
import time

import websockets

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

WS_BASE = "ws://127.0.0.1:42617"
TOKEN = "zc_f5e09815815c6d130401da6d29ad5982e6eec88cf83a51d24fadd972fc3d4e87"
AGENT = "assistant"
DB_PATH = "D:/data/finestem/finestem.db"


def pick_project(explicit_id: str | None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if explicit_id:
        cur.execute(
            "SELECT id, name, current_stage FROM projects WHERE id LIKE ? LIMIT 1",
            (explicit_id + "%",),
        )
        row = cur.fetchone()
        if row:
            conn.close()
            return dict(row)
    # 自动挑：优先 stage_08，其次任何非 bootstrap 的最近项目
    cur.execute(
        "SELECT id, name, current_stage FROM projects "
        "WHERE current_stage LIKE 'stage_08%' ORDER BY updated_at DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        cur.execute(
            "SELECT id, name, current_stage FROM projects "
            "WHERE current_stage NOT LIKE 'stage_00%' ORDER BY updated_at DESC LIMIT 1"
        )
        row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def build_message(proj: dict, instruction: str | None = None) -> str:
    """复制前端 buildOutgoingMessage 的上下文注入格式。"""
    ctx = [
        f"project_id: {proj['id']}",
        f"project_name: {proj['name']}",
        f"current_stage: {proj['current_stage']}",
    ]
    default_instr = (
        "请把这个项目的评估报告（第8阶段 evaluate 工件）重写得更完整，"
        "写完后务必保存。请直接执行，不要只回复文字。"
    )
    parts = [
        f"<context>\n" + "\n".join(ctx) + "\n</context>",
        "<memory_hint>该项目已有历史进度。第一件事必须调用 skill_state_reader "
        "读取已收集的学生画像和各阶段工件。</memory_hint>",
        instruction or default_instr,
    ]
    return "\n\n".join(parts)


async def probe(proj: dict, instruction: str | None = None):
    session_id = f"probe-{int(time.time())}"
    url = (
        f"{WS_BASE}/ws/chat?token={TOKEN}&agent={AGENT}&session_id={session_id}"
    )
    tool_calls: list[str] = []
    tool_results: list[dict] = []
    text_chunks: list[str] = []
    other_events: list[str] = []

    print(f"[probe] connecting session={session_id} project={proj['id']} "
          f"stage={proj['current_stage']}")
    async with websockets.connect(url, max_size=None) as ws:
        deadline = time.time() + 180
        sent_message = False
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=120)
            except asyncio.TimeoutError:
                print("[probe] recv timeout")
                break
            try:
                msg = json.loads(raw)
            except Exception:
                print("[probe] non-json frame:", raw[:200])
                continue
            typ = msg.get("type")
            data = msg.get("data", msg)

            if typ == "session_start":
                await ws.send(json.dumps({
                    "type": "connect",
                    "session_id": session_id,
                    "device_name": "finestem-probe",
                    "capabilities": ["tool_calls", "streaming"],
                }))
            elif typ == "connected":
                await ws.send(json.dumps({
                    "type": "message",
                    "content": build_message(proj, instruction),
                }))
                sent_message = True
                print("[probe] handshake done, message sent")
            elif typ == "chunk":
                c = data.get("content", "")
                if isinstance(c, str):
                    text_chunks.append(c)
            elif typ == "thinking":
                pass
            elif typ == "tool_call":
                name = data.get("name")
                args = data.get("args")
                tool_calls.append(name)
                print(f"[probe] >>> tool_call: {name}  args_keys="
                      f"{list(args.keys()) if isinstance(args, dict) else args}")
            elif typ == "tool_result":
                tool_results.append({"name": data.get("name"),
                                     "ok": data.get("success")})
                print(f"[probe] <<< tool_result: {data.get('name')} "
                      f"success={data.get('success')}")
            elif typ in ("done", "aborted", "error"):
                print(f"[probe] terminal frame: {typ} "
                      f"reason={data.get('finish_reason') or data.get('message')}")
                break
            else:
                other_events.append(typ)

    print("\n" + "=" * 60)
    print("GROUND TRUTH SUMMARY")
    print("=" * 60)
    print("tool_calls (in order):", tool_calls or "(none)")
    print("tool_results:", tool_results or "(none)")
    print("other event types:", sorted(set(other_events)))
    full = "".join(text_chunks)
    print(f"assistant text length: {len(full)}")
    print("--- assistant text (first 1200 chars) ---")
    print(full[:1200])
    print("--- key questions ---")
    print("called skill_state_reader?  ",
          any("skill_state_reader" in (t or "") for t in tool_calls))
    print("called skill_state_writer?  ",
          any("skill_state_writer" in (t or "") for t in tool_calls))
    print("called artifact_writer?     ",
          any("artifact_writer" in (t or "") for t in tool_calls))


def main():
    explicit = sys.argv[1] if len(sys.argv) > 1 else None
    instruction = sys.argv[2] if len(sys.argv) > 2 else None
    proj = pick_project(explicit)
    if not proj:
        print("[probe] no suitable project found")
        return
    asyncio.run(probe(proj, instruction))


if __name__ == "__main__":
    main()
