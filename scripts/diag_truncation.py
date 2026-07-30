"""诊断脚本：直连 ZeroClaw daemon WS，发长输出请求，捕获 finish_reason 和内容长度。
用法：python scripts/diag_truncation.py
"""
import asyncio
import json
import sys

try:
    import websockets
except ImportError:
    print("需要 websockets: pip install websockets", file=sys.stderr)
    sys.exit(1)

async def test():
    token = "zc_f5e09815815c6d130401da6d29ad5982e6eec88cf83a51d24fadd972fc3d4e87"
    url = f"ws://127.0.0.1:42617/ws/chat?token={token}&agent=assistant"
    print(f"连接 daemon WS ...")
    async with websockets.connect(url, max_size=20 * 1024 * 1024) as ws:
        # 握手
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        print(f"[握手] type={msg.get('type')}")

        await ws.send(json.dumps({
            "type": "connect",
            "session_id": "diag-trunc-001",
            "device_name": "diag",
            "capabilities": ["tool_calls", "streaming"],
        }))
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        print(f"[connected] type={msg.get('type')}")

        # 发长输出请求（模拟前端真实场景：带 context + 要求调工具写代码）
        prompt = (
            "<context>\nproject_id: 8a7c155e-5f66-4d7a-a595-e287731ff747\n"
            "project_name: 英语单词学习助手\ncurrent_stage: stage_07_execute\n"
            "teaching_mode: lecture\n</context>\n\n"
            "请用讲解式模式，完整实现这个英语单词学习助手的所有代码。"
            "先讲解原理和设计思路，然后调用 project_code_writer 工具写入完整代码，"
            "代码必须包含完整HTML结构、所有CSS样式、所有JavaScript交互逻辑，不要省略任何部分。"
        )
        await ws.send(json.dumps({"type": "message", "content": prompt}))
        print("[已发送带工具调用的长输出请求，等待流式回复...]")

        full = ""
        frame_types = {}
        finish_reason = None
        tool_calls = []
        last_tool_name = None
        code_in_tool = ""

        try:
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=180)
                data = json.loads(raw)
                t = data.get("type", "?")
                frame_types[t] = frame_types.get(t, 0) + 1

                if t == "chunk":
                    full += data.get("content", "")
                elif t == "thinking":
                    pass
                elif t in ("tool_call", "tool_result"):
                    tn = data.get("name") or data.get("tool_name") or "?"
                    tool_calls.append({"type": t, "name": tn})
                    last_tool_name = tn
                    # 如果是 project_code_writer，提取 code 参数
                    if "code_writer" in str(tn):
                        args = data.get("args") or data.get("arguments") or data.get("data", {}).get("args") or {}
                        if isinstance(args, str):
                            try:
                                import json as _j
                                args = _j.loads(args)
                            except Exception:
                                args = {}
                        code_in_tool = str(args.get("code", ""))
                        print(f"  [{t}] {tn}: code 长度={len(code_in_tool)} 字符")
                elif t == "done":
                    finish_reason = data.get("finish_reason") or data.get("finishReason")
                    full_resp = data.get("full_response", "")
                    print("\n========== DONE 帧 ==========")
                    print(f"finish_reason: {finish_reason!r}")
                    print(f"full_response 长度: {len(full_resp) if full_resp else 0}")
                    print(f"output_tokens: {data.get('output_tokens')}")
                    print(f"done 帧所有 key: {list(data.keys())}")
                    break
                elif t in ("error", "aborted"):
                    print(f"\n===== 终止帧: {t} ===== msg={data.get('message', '')}")
                    break
        except asyncio.TimeoutError:
            print("\n===== 超时（180s 无数据，可能卡死）=====")

        print(f"\n========== 诊断结果 ==========")
        print(f"帧类型统计: {frame_types}")
        print(f"工具调用序列: {[tc['name'] for tc in tool_calls]}")
        print(f"累积 chunk 文本长度: {len(full)} 字符")
        if code_in_tool:
            print(f"project_code_writer 传入代码长度: {len(code_in_tool)} 字符")
            cf = code_in_tool.count("```")
            print(f"  代码块 ``` 数: {cf} ({'闭合' if cf % 2 == 0 else '未闭合'})")
            print(f"  代码结尾 200 字: {code_in_tool[-200:]!r}")
        code_fence_count = full.count("```")
        print(f"chunk 文本代码块 ``` 数: {code_fence_count} ({'闭合' if code_fence_count % 2 == 0 else '未闭合(截断)'})")
        if full:
            print(f"chunk 文本结尾 300 字: {full[-300:]!r}")

asyncio.run(test())
