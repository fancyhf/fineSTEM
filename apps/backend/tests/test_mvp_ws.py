"""
通过 WebSocket 通道测试 MVP bug（前端实际使用的通道）
"""
import asyncio
import json
import sys
import websockets

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/api/v1/agent/ws"
PROJECT_ID = "b686df08-6655-4edb-a3a5-955f3244abe1"
AUTH_EMAIL = "21749959@qq.com"
AUTH_PASSWORD = "750714hf"


async def get_token():
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{BASE_URL}/api/v1/auth/login", data={
            "username": AUTH_EMAIL, "password": AUTH_PASSWORD
        })
        if resp.status_code != 200:
            raise Exception(f"Login failed: {resp.status_code}")
        data = resp.json()
        return data.get("data", {}).get("access_token") or data.get("access_token")


async def test_ws_chat(token: str, message: str):
    """通过 WebSocket 发送消息并捕获所有事件"""
    uri = f"{WS_URL}?token={token}"
    print(f"\n[WS] Connecting to {uri[:50]}...")
    
    full_content = ""
    events = []
    code_events = []
    
    async with websockets.connect(uri) as ws:
        # 发送聊天消息
        send_msg = {
            "type": "chat",
            "message": message,
            "project_id": PROJECT_ID,
        }
        await ws.send(json.dumps(send_msg))
        print(f"[WS] Sent: {message}")
        
        # 接收响应（带超时）
        deadline = asyncio.get_event_loop().time() + 90
        final_received = False
        
        while not final_received and asyncio.get_event_loop().time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=30)
                msg = json.loads(raw)
                event_type = msg.get("event", "unknown")
                event_data = msg.get("data")
                
                events.append(event_type)
                
                if event_type == "token":
                    tok = event_data.get("token", "")
                    if isinstance(tok, str):
                        full_content += tok
                
                elif event_type == "code_generated":
                    code_events.append(event_data or {})
                    code_len = len((event_data or {}).get("code", ""))
                    lang = (event_data or {}).get("language", "")
                    source = (event_data or {}).get("source", "")
                    print(f"  [CODE_GEN] lang={lang} len={code_len} source={source}")
                    # 检查是否是 MVP 代码
                    code_str = (event_data or {}).get("code", "")
                    mvp_markers = ["fineSTEM MVP", "我的 STEM 项目 MVP", "actionButton",
                                   "已成功运行", "这是一个可运行的最小版本"]
                    found = [m for m in mvp_markers if m in code_str]
                    if found:
                        print(f"  !! MVP CODE IN EVENT: {found}")
                
                elif event_type == "content_update":
                    content = (event_data or {}).get("content", "")
                    if content:
                        full_content = content
                        print(f"  [CONTENT] len={len(content)}")
                
                elif event_type == "final":
                    final_received = True
                    print(f"  [FINAL] status={(event_data or {}).get('status')}")
                
                elif event_type == "error":
                    err_msg = (event_data or {}).get("message", str(msg))
                    print(f"  [ERROR] {err_msg}")
                    
                elif event_type not in ("stage_changed", "skill_activated"):
                    print(f"  [{event_type}] {str(event_data)[:100]}")
                    
            except asyncio.TimeoutError:
                print("[WS] Timeout waiting for more messages")
                break
            except Exception as e:
                print(f"[WS] Error: {e}")
                break
    
    print(f"\n[WS] Events received ({len(events)}): {events}")
    print(f"[WS] Content length: {len(full_content)}")
    
    # 检查 MVP 短语
    mvp_phrases = ["最小代码版本", "MVP", "最小可运行", "写入编辑器",
                   "已生成一个可运行的最小"]
    found = [p for p in mvp_phrases if p in full_content]
    
    if found:
        print(f"\n[ANALYSIS] !! MVP PHRASES FOUND: {found}")
        for p in found:
            idx = full_content.find(p)
            ctx = full_content[max(0,idx-80):idx+len(p)+80]
            print(f'  Context of "{p}": ...{ctx}...')
    else:
        print(f"[ANALYSIS] OK No MVP phrases")
    
    print(f"\n[REPLY]:\n{full_content}")
    
    return {
        "full_content": full_content,
        "events": events,
        "mvp_phrases_found": found,
        "code_events": code_events,
    }


async def main():
    token = await get_token()
    print(f"[LOGIN] OK")
    
    print("=" * 60)
    print("TEST 1: '现在什么阶段？'")
    print("=" * 60)
    r1 = await test_ws_chat(token, "现在什么阶段？")
    
    print("\n" + "=" * 60)
    print("TEST 2: '恢复之前的故事代码，把4个文件都写好'")
    print("=" * 60)
    r2 = await test_ws_chat(token, "恢复之前的故事代码，把4个文件都写好，不要最小版本")
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    all_mvp = r1["mvp_phrases_found"] + r2["mvp_phrases_found"]
    all_code = r1["code_events"] + r2["code_events"]
    
    if all_mvp:
        print(f"BUG CONFIRMED - MVP phrases: {all_mvp}")
    else:
        print(f"No MVP phrases in AI text replies")
    
    for i, ce in enumerate(all_code):
        code = ce.get("code", "")
        if any(m in code for m in ["fineSTEM MVP", "actionButton"]):
            print(f"BUG - MVP CODE in code_event[{i}] source={ce.get('source')}")


if __name__ == "__main__":
    asyncio.run(main())
