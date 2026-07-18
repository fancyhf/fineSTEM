"""
最终验证测试 - 通过 3200 端口的后端（--reload 模式）测试 MVP 拦截
"""
import asyncio
import json
import sys
import websockets

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

WS_URL = "ws://localhost:3200/api/v1/agent/ws"
API_URL = "http://localhost:3200"
PROJECT_ID = "b686df08-6655-4edb-a3a5-955f3244abe1"
AUTH_EMAIL = "21749959@qq.com"
AUTH_PASSWORD = "750714hf"


async def get_token():
    import httpx
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{API_URL}/api/v1/auth/login", data={
            "username": AUTH_EMAIL, "password": AUTH_PASSWORD
        })
        d = r.json()
        return d.get("data", {}).get("access_token") or d.get("access_token")


async def test_chat(token, msg):
    uri = f"{WS_URL}?token={token}"
    print(f"\n>>> Sending: {msg}")
    
    full_content = ""
    code_events = []
    
    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({"type": "chat", "message": msg, "project_id": PROJECT_ID}))
        
        deadline = asyncio.get_event_loop().time() + 60
        done = False
        while not done and asyncio.get_event_loop().time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=20)
                m = json.loads(raw)
                etype = m.get("event", "?")
                edata = m.get("data")
                
                if etype == "token":
                    t = edata.get("token", "")
                    if isinstance(t, str):
                        full_content += t
                
                elif etype == "code_generated":
                    code_events.append(edata or {})
                    code_str = (edata or {}).get("code", "")
                    mvp_in_code = any(x in code_str for x in [
                        "fineSTEM MVP", "actionButton", "我的 STEM 项目 MVP"
                    ])
                    print(f"  [CODE_GEN] len={len(code_str)} source={(edata or {}).get('source')} MVP={mvp_in_code}")
                
                elif etype == "final":
                    done = True
                
                elif etype == "error":
                    err = (edata or {}).get("message", str(m))
                    print(f"  [ERROR] {err[:200]}")
                    
            except Exception as e:
                break
    
    # Check for MVP phrases in text reply
    mvp_phrases = ["最小代码版本", "MVP", "最小可运行", "写入编辑器",
                   "已生成一个可运行的最小"]
    found = [p for p in mvp_phrases if p in full_content]
    
    print(f"  Content length: {len(full_content)}")
    if found:
        print(f"  !! MVP PHRASES IN REPLY: {found}")
    else:
        print(f"  OK: No MVP phrases")
    print(f"  Reply: {full_content[:300]}")
    
    return {"content": full_content, "mvp_phrases": found, "code_events": code_events}


async def main():
    token = await get_token()
    print(f"Token OK: {token[:20]}...")
    
    # Test 1: Ask about stage
    r1 = await test_chat(token, "现在什么阶段？")
    
    # Test 2: Request code generation (most likely to trigger MVP)
    r2 = await test_chat(token, "恢复之前的故事代码，把4个文件都写好")
    
    # Check workspace after
    import httpx
    async with httpx.AsyncClient() as c:
        ws_resp = await c.get(
            f"{API_URL}/api/v1/projects/{PROJECT_ID}/workspace",
            headers={"Authorization": f"Bearer {token}"}
        )
        ws_data = ws_resp.json()
        ws_code = (ws_data.get("data", {}).get("workspace") or {}).get("code", "")
        has_mvp = any(m in ws_code for m in ["fineSTEM MVP", "actionButton"])
        print(f"\n=== WORKSPACE AFTER ===")
        print(f"Code length: {len(ws_code)}")
        print(f"MVP in workspace: {has_mvp}")
        if has_mvp:
            print(f"CODE:\n{ws_code[:500]}")
    
    # Summary
    all_mvp = r1["mvp_phrases"] + r2["mvp_phrases"]
    any_code_mvp = any(
        any(m in (ce.get("code") or "") for m in ["fineSTEM MVP", "actionButton"])
        for ce in r1["code_events"] + r2["code_events"]
    )
    
    print(f"\n{'='*50}")
    print(f"SUMMARY:")
    print(f"  MVP in text replies: {bool(all_mvp)} -> {all_mvp}")
    print(f"  MVP in code events: {any_code_mvp}")
    print(f"  MVP in workspace DB: {has_mvp}")
    if all_mvp or any_code_mvp or has_mvp:
        print(f"  >>> BUG STILL EXISTS <<<")
    else:
        print(f"  >>> ALL CLEAR <<<")


if __name__ == "__main__":
    asyncio.run(main())
