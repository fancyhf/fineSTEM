"""
ZeroClaw WebSocket 真实帧抓取脚本（一次性诊断工具）

用途：连真实 ZeroClaw daemon，模拟前端握手 + 发一条 PBL 消息，
把所有 WebSocket 帧的原始 JSON dump 到文件，用于确认：
1. tool_call 帧的字段名（name/args vs tool/arguments）
2. done 帧是否带 finish_reason
3. ask_question 工具是否真的被调用

跑法：python apps/backend/scripts/ws_frame_capture.py
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

# 2026-07-22 修复：Windows 控制台默认 GBK 编码，print 含 emoji 时崩溃。强制 UTF-8。
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", newline="\n")
    except (AttributeError, ValueError):
        pass

# 复用前端的 token 和配置
TOKEN = "zc_f5e09815815c6d130401da6d29ad5982e6eec88cf83a51d24fadd972fc3d4e87"
AGENT = "assistant"
BASE_URL = "ws://127.0.0.1:42617"
SESSION_ID = f"finestem-capture-{int(time.time())}"
MESSAGE = "我想做一个项目"  # 触发 stage_00_bootstrap 三轮提问

OUTPUT_FILE = Path("G:/mediaProjects/fineSTEM/apps/backend/scripts/ws_frames_dump.json")


async def capture() -> int:
    try:
        import websockets
    except ImportError:
        print("ERROR: 需要 websockets 库。pip install websockets", file=sys.stderr)
        return 1

    ws_url = f"{BASE_URL}/ws/chat?token={TOKEN}&agent={AGENT}&session_id={SESSION_ID}"
    print(f"[capture] 连接 {ws_url[:80]}...")

    frames: list[dict] = []
    start = time.time()

    try:
        async with websockets.connect(ws_url, max_size=2**20, ping_interval=20) as ws:
            print(f"[capture] 已连接，等待 session_start...")
            handshake_done = False
            message_sent = False

            async for raw in ws:
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8", errors="replace")
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    print(f"[capture] 非 JSON 帧: {raw[:100]}")
                    continue

                frame_type = data.get("type", "?")
                elapsed_ms = int((time.time() - start) * 1000)
                frames.append({"t_ms": elapsed_ms, "frame": data})

                # 简要日志
                summary = _summarize(frame_type, data)
                print(f"[capture] +{elapsed_ms}ms {frame_type} {summary}")

                # 握手：session_start → connect → connected
                if frame_type == "session_start" and not handshake_done:
                    await ws.send(json.dumps({
                        "type": "connect",
                        "session_id": SESSION_ID,
                        "device_name": "capture-script",
                        "capabilities": ["tool_calls", "streaming"],
                    }))
                    print("[capture] 已发送 connect 帧")

                if frame_type == "connected" and not message_sent:
                    # 发 PBL 触发消息
                    await ws.send(json.dumps({"type": "message", "content": MESSAGE}))
                    print(f"[capture] 已发送消息: {MESSAGE}")

                # done / error / aborted → 结束
                if frame_type in ("done", "error", "aborted"):
                    print(f"[capture] 收到终止帧 {frame_type}，结束抓取")
                    break

                # 超时保护（90 秒）
                if elapsed_ms > 90000:
                    print("[capture] 超过 90 秒，强制结束")
                    break

    except Exception as exc:
        print(f"[capture] 异常: {type(exc).__name__}: {exc}", file=sys.stderr)
        frames.append({"t_ms": int((time.time() - start) * 1000), "error": str(exc)})

    # 写出
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(frames, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[capture] 共抓 {len(frames)} 帧，已写入 {OUTPUT_FILE}")

    # 关键发现汇总
    _report_findings(frames)
    return 0


def _summarize(frame_type: str, data: dict) -> str:
    """单行摘要，关键字段优先。"""
    if frame_type == "chunk":
        c = data.get("content", "")
        return f"content={repr(c[:40])}{'...' if len(c) > 40 else ''}"
    if frame_type == "tool_call":
        keys = sorted(data.keys())
        return f"keys={keys} name={data.get('name')} tool={data.get('tool')} args_keys={list(data.get('args', {}).keys()) if isinstance(data.get('args'), dict) else None}"
    if frame_type == "tool_result":
        return f"name={data.get('name')} tool={data.get('tool')} output_len={len(str(data.get('output', '')))}"
    if frame_type == "done":
        keys = sorted(data.keys())
        return f"keys={keys} finish_reason={data.get('finish_reason')} full_response_len={len(str(data.get('full_response', '')))}"
    if frame_type == "thinking":
        return f"content_len={len(str(data.get('content', '')))}"
    if frame_type == "error":
        return f"message={data.get('message', '')[:100]}"
    return f"keys={sorted(data.keys())}"


def _report_findings(frames: list[dict]) -> None:
    """汇总关键发现。"""
    print("\n" + "=" * 60)
    print("关键发现汇总")
    print("=" * 60)

    types_count: dict[str, int] = {}
    tool_calls: list[dict] = []
    tool_results: list[dict] = []
    done_frame: dict | None = None
    chunks_total_len = 0
    thinking_total_len = 0

    for entry in frames:
        f = entry.get("frame", {})
        t = f.get("type", "?")
        types_count[t] = types_count.get(t, 0) + 1
        if t == "tool_call":
            tool_calls.append(f)
        elif t == "tool_result":
            tool_results.append(f)
        elif t == "done":
            done_frame = f
        elif t == "chunk":
            chunks_total_len += len(str(f.get("content", "")))
        elif t == "thinking":
            thinking_total_len += len(str(f.get("content", "")))

    print(f"帧类型分布: {types_count}")
    print(f"chunk 总字符: {chunks_total_len}")
    print(f"thinking 总字符: {thinking_total_len}")
    print(f"tool_call 次数: {len(tool_calls)}")
    print(f"tool_result 次数: {len(tool_results)}")

    if tool_calls:
        print("\n--- tool_call 字段确认（最关键）---")
        tc = tool_calls[0]
        print(f"  顶层 keys: {sorted(tc.keys())}")
        print(f"  data.get('name') = {tc.get('name')!r}")
        print(f"  data.get('tool') = {tc.get('tool')!r}")
        print(f"  data.get('args') 类型 = {type(tc.get('args')).__name__}")
        print(f"  data.get('arguments') 类型 = {type(tc.get('arguments')).__name__}")
        ask_calls = [t for t in tool_calls if t.get("name") == "ask_question" or t.get("tool") == "ask_question"]
        print(f"  ask_question 调用次数: {len(ask_calls)}")
    else:
        print("\n⚠️ 没有任何 tool_call 帧——AI 没调工具！")

    if done_frame:
        print("\n--- done 帧字段确认 ---")
        print(f"  顶层 keys: {sorted(done_frame.keys())}")
        print(f"  finish_reason = {done_frame.get('finish_reason')!r}")
        print(f"  full_response 长度 = {len(str(done_frame.get('full_response', '')))}")
    else:
        print("\n⚠️ 没有 done 帧")

    # 前端假设验证
    print("\n--- 前端假设验证 ---")
    if tool_calls:
        tc = tool_calls[0]
        name_ok = "name" in tc
        args_ok = "args" in tc
        print(f"  前端读 data.name: {'✅ 字段存在' if name_ok else '❌ 字段缺失'}")
        print(f"  前端读 data.args: {'✅ 字段存在' if args_ok else '❌ 字段缺失'}")
        if not name_ok or not args_ok:
            print(f"  ⚠️ 实际字段是: name={tc.get('name')!r} tool={tc.get('tool')!r} args_keys={list(tc.get('args', {}).keys()) if isinstance(tc.get('args'), dict) else 'N/A'} arguments_keys={list(tc.get('arguments', {}).keys()) if isinstance(tc.get('arguments'), dict) else 'N/A'}")
            print(f"  💡 这就是 ask_question 卡片不显示的根因——需要改前端字段映射")


if __name__ == "__main__":
    sys.exit(asyncio.run(capture()))
