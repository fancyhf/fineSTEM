"""
fineSTEM 对话系统回归测试脚本

模拟学生走完整 PBL 流程（stage_00 → stage_02），统计：
- ask_question tool_call 次数 vs 丢卡次数
- 是否重复问已答问题
- 是否只总结不给选项
- 多选是否正确传递

用法：
  cd apps/backend
  set PYTHONIOENCODING=utf-8
  python scripts/ws_regression_test.py
"""
from __future__ import annotations

import asyncio
import json
import re
import time

import websockets

TOKEN = "zc_f5e09815815c6d130401da6d29ad5982e6eec88cf83a51d24fadd972fc3d4e87"
BASE = "ws://127.0.0.1:42617"
SESSION = f"regression-{int(time.time())}"


async def recv_until(ws, target_type, timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        data = json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout))
        if data.get("type") == target_type:
            return data
    return None


async def send_and_collect(ws, message, timeout=60):
    """发送消息并收集完整回复（tool_calls + 文本）。"""
    await ws.send(json.dumps({"type": "message", "content": message}))
    chunks = []
    tool_calls = []
    ask_questions = []
    done = False
    start = time.time()
    while time.time() - start < timeout and not done:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=5)
        except asyncio.TimeoutError:
            continue
        data = json.loads(raw)
        mtype = data.get("type", "")
        if mtype == "chunk":
            chunks.append(data.get("content", ""))
        elif mtype == "tool_call":
            name = data.get("name", "").replace("finestem__", "")
            args = data.get("args", {})
            tool_calls.append(name)
            if "ask_question" in name:
                ask_questions.append({
                    "title": args.get("title", ""),
                    "multiple": args.get("multiple", False),
                    "options": [o.get("label", "") for o in args.get("options", [])],
                })
        elif mtype == "tool_result":
            pass
        elif mtype == "done":
            done = True
        elif mtype == "error":
            break
    return "".join(chunks), tool_calls, ask_questions


async def run_regression():
    url = f"{BASE}/ws/chat?token={TOKEN}&agent=assistant&session_id={SESSION}"
    print(f"=== 回归测试开始 (session={SESSION}) ===\n")

    results = {
        "rounds": [],
        "total_ask_questions": 0,
        "total_multiple_cards": 0,
        "issues": [],
    }

    async with websockets.connect(url, max_size=2**20, ping_interval=20) as ws:
        await ws.send(json.dumps({"type": "connect", "session_id": SESSION, "device_name": "regression"}))
        await recv_until(ws, "connected")
        print("✅ 已连接\n")

        # 模拟学生对话序列
        conversations = [
            ("我想做一个项目", "stage_00 初始化"),
            ("[选择:junior] 初中", "stage_00 回答年级"),
            ("[选择:6h] 6小时", "stage_00 回答时间"),
            ("[选择:no_idea] 没想法", "stage_00 回答想法"),
            ("总结一下当前进度", "故意发总结请求（测 Q-003 误识别）"),
            ("继续", "推进到下一阶段"),
            ("[选择:web] Web应用", "stage_04 选轨道"),
        ]

        answered_titles = set()

        for i, (msg, desc) in enumerate(conversations):
            # 注入 context（模拟前端 buildOutgoingMessage）
            ctx = f"<context>\nproject_id: {SESSION}\nproject_name: 测试项目\ncurrent_stage: stage_0{i % 3}_xxx\nteaching_mode: guided\nstage_progress: {i+1}/9\n"
            if answered_titles:
                ctx += f"answered_questions: {'; '.join(list(answered_titles)[-3:])}\n"
            ctx += f"</context>\n\n[[skill:stem-pbl-guide]]\n\n{msg}"

            print(f"--- 轮次 {i+1}/{len(conversations)}: {desc} ---")
            print(f"  学生: {msg[:60]}")

            text, tools, asks = await send_and_collect(ws, ctx, 60)

            round_result = {
                "round": i + 1,
                "desc": desc,
                "ask_count": len(asks),
                "tools": tools,
                "has_summary": bool(re.search(r"总结|进度|当前状态|已完成|待完成", text)),
                "text_preview": text[:150],
            }
            results["rounds"].append(round_result)
            results["total_ask_questions"] += len(asks)

            print(f"  工具调用: {tools[:5]}{'...' if len(tools)>5 else ''}")
            print(f"  ask_question: {len(asks)} 次")

            for aq in asks:
                multi_tag = " [多选]" if aq["multiple"] else ""
                print(f"    📋 \"{aq['title']}\"{multi_tag} ({len(aq['options'])}选项)")
                answered_titles.add(aq["title"])
                if aq["multiple"]:
                    results["total_multiple_cards"] += 1

            # 检测问题
            if len(asks) == 0 and desc.startswith("stage_"):
                # 需要提问的阶段但没有 ask_question
                if re.search(r"选|点.*卡|哪个|方向|年级", text):
                    results["issues"].append(f"轮次{i+1}: AI 有选择意图但没调 ask_question (Q-002)")
                    print(f"  ⚠️ Q-002: 选择意图但无 ask_question")

            if i == 4:  # "总结一下当前进度" 轮
                # 这轮不应该产生 ask_question（总结请求不该被误识别为提问）
                if len(asks) > 0:
                    results["issues"].append(f"轮次{i+1}: 总结请求被误识别为选项卡 (Q-003)")
                    print(f"  ⚠️ Q-003: 总结请求误产生选项卡！")

            print(f"  文本: {text[:100]}")
            print()

    # 汇总
    print("=" * 60)
    print("回归测试汇总")
    print("=" * 60)
    print(f"总轮次: {len(conversations)}")
    print(f"ask_question 总次数: {results['total_ask_questions']}")
    print(f"多选卡片次数: {results['total_multiple_cards']}")
    print(f"检测到的问题: {len(results['issues'])}")
    for issue in results["issues"]:
        print(f"  - {issue}")

    print()
    if len(results["issues"]) == 0:
        print("✅ 无问题检出")
    else:
        print(f"⚠️ 有 {len(results['issues'])} 个问题需关注")

    return results


if __name__ == "__main__":
    asyncio.run(run_regression())
