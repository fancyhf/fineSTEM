"""临时诊断：ZeroClaw daemon 会话跨连接持久化测试。用完即删。"""
import asyncio, json, re, sys
import websockets

TOK = None
for line in open(r"G:/mediaProjects/fineSTEM/apps/frontend/.env.development", encoding="utf-8"):
    m = re.match(r"VITE_ZC_TOKEN\s*=\s*(.+)", line.strip())
    if m: TOK = m.group(1).strip()
BASE = "ws://127.0.0.1:42617/ws/chat"

async def chat_once(session_id: str, text: str, label: str) -> str:
    async with websockets.connect(f"{BASE}?token={TOK}&agent=assistant_qwen&session_id={session_id}", max_size=None) as ws:
        started = json.loads(await ws.recv())
        assert started.get("type") == "session_start", started
        await ws.send(json.dumps({"type": "connect", "session_id": session_id, "device_name": "diag", "capabilities": ["tool_calls", "streaming"]}))
        connected = json.loads(await ws.recv())
        assert connected.get("type") == "connected", connected
        await ws.send(json.dumps({"type": "message", "content": text}))
        buf = []
        while True:
            try:
                frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=150))
            except asyncio.TimeoutError:
                print(f"[{label}] 超时"); break
            t = frame.get("type")
            if t == "chunk": buf.append(frame.get("content",""))
            elif t == "done":
                resp = frame.get("full_response") or "".join(buf)
                return resp
            elif t in ("error",):
                print(f"[{label}] error frame:", str(frame)[:200]); return "".join(buf)
            elif t == "aborted":
                return "".join(buf)

async def main():
    sid = "diag-persist-20261107"
    r1 = await chat_once(sid, "请记住一个暗号：芒果42。只回复收到。", "第一连接-写")
    print("R1:", r1[:120].replace("\n", " "))
    r2 = await chat_once(sid, "我刚才让你记住的暗号是什么？只回答暗号本身。", "第二连接-读")
    print("R2:", r2[:200].replace("\n", " "))
    print("持久化:", "✅ 记得" if "芒果42" in r2 else "❌ 不记得（会话不跨连接）")

    # 真实项目会话：看 daemon 是否记得阶段
    proj_sid = "finestem-p-18aef160-3899-4a2c-abb5-d94d36f686ff"
    r3 = await chat_once(proj_sid, "只回答一个问题：我们这个项目现在进行到哪个阶段了？用中文短语回答。", "项目会话-读")
    print("R3:", r3[:300].replace("\n", " "))

asyncio.run(main())
