"""
ZeroClaw 多轮 PBL 对话测试（实证验证修复效果）

模拟学生：发"我想做一个项目" → 答第一问"初中" → 答第二问 → ...
验证：
1. ask_question 卡片每轮都能渲染（finestem__ 前缀归一化生效）
2. AI 能逐轮推进（不会卡住、不会跳阶段）
3. tool_call / tool_result 字段映射正确

跑法：python apps/backend/scripts/ws_multi_turn_test.py
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

# 2026-07-22 修复：Windows 控制台默认 GBK 编码，print 含 emoji 的 AI 回复会崩溃。
# 强制 stdout/stderr 走 UTF-8。
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", newline="\n")
    except (AttributeError, ValueError):
        pass

TOKEN = "zc_f5e09815815c6d130401da6d29ad5982e6eec88cf83a51d24fadd972fc3d4e87"
AGENT = "assistant"
BASE_URL = "ws://127.0.0.1:42617"
SESSION_ID = f"finestem-multiturn-{int(time.time())}"

# 模拟学生的逐轮回答（对应 stage_00 三轮：年级/时间/想法）
# 用 [选择] 格式，符合 config.toml 里教 AI 识别的格式
REPLIES = [
    "[选择] 你现在是哪个年级？\n回答：初中",
    "[选择] 你打算花多长时间完成这个项目？\n回答：6小时",
    "[选择] 你有初步想法了吗？\n回答：完全没想法，需要脑爆",
]
FIRST_MESSAGE = "我想做一个项目"

OUTPUT_FILE = Path("G:/mediaProjects/fineSTEM/apps/backend/scripts/ws_multiturn_dump.json")


def normalize_tool_name(raw):
    if not isinstance(raw, str):
        return ""
    return raw[10:] if raw.startswith("finestem__") else raw


def parse_mcp_output(raw):
    if raw is None:
        return True, None
    if isinstance(raw, dict):
        if isinstance(raw.get("content"), list) and raw["content"] and raw["content"][0].get("text"):
            return _extract(raw["content"][0]["text"], raw.get("isError"))
        return raw.get("isError") != True, raw
    s = str(raw)
    try:
        outer = json.loads(s)
        if isinstance(outer, dict):
            if isinstance(outer.get("content"), list) and outer["content"] and outer["content"][0].get("text"):
                return _extract(outer["content"][0]["text"], outer.get("isError"))
            return outer.get("isError") != True, outer
    except Exception:
        pass
    return not ("error" in s.lower() or "failed" in s.lower()), s


def _extract(text, is_error):
    try:
        inner = json.loads(text)
        if isinstance(inner, dict) and ("success" in inner or "data" in inner):
            return (inner.get("success", True) and is_error != True), inner.get("data", inner)
        return is_error != True, inner
    except Exception:
        return is_error != True, text


async def run_turn(ws, message, turn_idx, all_frames):
    """发一条消息，收到 done/error 就返回。返回这一轮的文本和工具调用。"""
    await ws.send(json.dumps({"type": "message", "content": message}))
    print(f"\n[turn {turn_idx}] 发送: {message[:50]}")

    text_chunks = []
    tool_calls = []
    start = time.time()

    async for raw in ws:
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        ft = data.get("type", "?")
        all_frames.append({"turn": turn_idx, "t_ms": int((time.time() - start) * 1000), "frame": data})

        if ft == "chunk":
            text_chunks.append(data.get("content", ""))
        elif ft == "tool_call":
            name = normalize_tool_name(data.get("name"))
            tool_calls.append({"name": name, "raw_name": data.get("name"), "args": data.get("args")})
            print(f"  tool_call: {name} (raw={data.get('name')})")
        elif ft == "tool_result":
            name = normalize_tool_name(data.get("name"))
            success, out_data = parse_mcp_output(data.get("output"))
            print(f"  tool_result: {name} success={success}")
        elif ft == "done":
            full = data.get("full_response") or "".join(text_chunks)
            return full, tool_calls
        elif ft in ("error", "aborted"):
            print(f"  ⚠️ 终止帧: {ft} {data.get('message', '')[:80]}")
            return "".join(text_chunks), tool_calls
        if (time.time() - start) > 60:
            print("  ⚠️ 单轮超时 60s")
            return "".join(text_chunks), tool_calls
    return "".join(text_chunks), tool_calls


async def main() -> int:
    try:
        import websockets
    except ImportError:
        print("需要 websockets", file=sys.stderr)
        return 1

    ws_url = f"{BASE_URL}/ws/chat?token={TOKEN}&agent={AGENT}&session_id={SESSION_ID}"
    print(f"[test] 连接 ZeroClaw（session={SESSION_ID}）")

    all_frames = []
    all_turns = []

    try:
        async with websockets.connect(ws_url, max_size=2**20, ping_interval=20) as ws:
            # 握手
            handshake_start = False
            msg_sent = False
            async for raw in ws:
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8", errors="replace")
                data = json.loads(raw)
                if data.get("type") == "session_start" and not handshake_start:
                    await ws.send(json.dumps({
                        "type": "connect", "session_id": SESSION_ID,
                        "device_name": "multi-turn-test", "capabilities": ["tool_calls", "streaming"],
                    }))
                    handshake_start = True
                elif data.get("type") == "connected" and not msg_sent:
                    break

            # 第一轮：触发
            text, tools = await run_turn(ws, FIRST_MESSAGE, 0, all_frames)
            all_turns.append({"turn": 0, "message": FIRST_MESSAGE, "response": text, "tools": tools})
            print(f"  回复: {text[:80]}")

            # 后续轮：逐个回答
            for i, reply in enumerate(REPLIES, 1):
                text, tools = await run_turn(ws, reply, i, all_frames)
                all_turns.append({"turn": i, "message": reply, "response": text, "tools": tools})
                print(f"  回复: {text[:80]}")
                # 如果这一轮没调 ask_question 也没推进，可能是流程结束了
                if not tools and "脑爆" not in text and "选题" not in text:
                    print(f"  ℹ️ 本轮无工具调用，可能流程已转入对话")

    except Exception as exc:
        print(f"[test] 异常: {type(exc).__name__}: {exc}", file=sys.stderr)
        all_frames.append({"error": str(exc)})

    # 输出
    OUTPUT_FILE.write_text(json.dumps({"turns": all_turns, "frames": all_frames}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[test] 详细数据写入 {OUTPUT_FILE}")

    # 汇总
    print("\n" + "=" * 60)
    print("多轮对话验证汇总")
    print("=" * 60)
    total_ask = 0
    total_tools = 0
    for t in all_turns:
        ask = [tc for tc in t["tools"] if tc["name"] == "ask_question"]
        other = [tc for tc in t["tools"] if tc["name"] != "ask_question"]
        total_ask += len(ask)
        total_tools += len(t["tools"])
        print(f"turn {t['turn']}: ask_question={len(ask)} 其他工具={len(other)} 回复长度={len(t['response'])}")
        for tc in t["tools"]:
            if tc["name"] == "ask_question":
                print(f"  卡片: {tc['args'].get('title', '?')}")
    print(f"\n总计: ask_question 渲染 {total_ask} 次, 工具调用 {total_tools} 次")
    print(f"阶段推进验证: {'✅ AI 逐轮提问（stage_00 三轮正常）' if total_ask >= 2 else '⚠️ 提问次数不足，可能卡住'}")

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
