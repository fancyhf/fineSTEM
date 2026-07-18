"""
验证：数据库层的 MVP 拦截是否生效
通过 API 调用间接测试 save_project_workspace 的 MVP 拦截
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


async def check_workspace(token):
    """Check workspace via API"""
    import httpx
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{API_URL}/api/v1/projects/{PROJECT_ID}/workspace",
            headers={"Authorization": f"Bearer {token}"}
        )
        if r.status_code == 200:
            d = r.json()
            ws = d.get("data", {}).get("workspace", {})
            code = ws.get("code", "")[:200]
            files = ws.get("files", [])
            has_mvp = any(m in (ws.get("code") or "") for m in [
                "fineSTEM MVP", "actionButton", "已成功运行"
            ])
            print(f"  code_len={len(ws.get('code',''))} files={len(files)} MVP={has_mvp}")
            print(f"  code_preview: {code}")
            return has_mvp
        else:
            print(f"  API returned {r.status_code}")
            return None


async def main():
    token = await get_token()
    if not token:
        print("FATAL: Cannot get token!")
        sys.exit(1)
    print(f"Token OK: {token[:20]}...")
    
    # Step 1: Check current state
    print("\n=== BEFORE: Current workspace ===")
    await check_workspace(token)
    
    # Step 2: Send a message that triggers MVP generation
    print("\n=== TRIGGER: Sending MVP-triggering message ===")
    uri = f"{WS_URL}?token={token}"
    
    async with websockets.connect(uri) as ws:
        # 发送一个容易触发 MVP 的消息
        await ws.send(json.dumps({
            "type": "chat",
            "message": "现在什么阶段？帮我生成一个最小可运行的代码版本写入编辑器",
            "project_id": PROJECT_ID,
        }))
        
        full_content = ""
        deadline = asyncio.get_event_loop().time() + 60
        done = False
        while not done and asyncio.get_event_loop().time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=25)
                m = json.loads(raw)
                etype = m.get("event", "?")
                
                if etype == "token":
                    t = (m.get("data") or {}).get("token", "")
                    if isinstance(t, str):
                        full_content += t
                
                elif etype == "final":
                    done = True
                elif etype == "error":
                    err = (m.get("data") or {}).get("message", str(m))
                    print(f"  [ERROR] {err[:200]}")
                    
            except Exception as e:
                break
        
        # Check for MVP in reply text
        mvp_in_reply = [p for p in ["最小代码版本", "MVP", "最小可运行", 
                                     "已生成一个可运行的最小"] if p in full_content]
        print(f"\n  Reply len={len(full_content)} MVP_phrases={mvp_in_reply}")
        if full_content:
            print(f"  Reply preview: {full_content[:300]}")
    
    # Step 3: Check workspace AFTER - MVP should be blocked
    print("\n=== AFTER: Workspace should NOT have MVP ===")
    import httpx
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{API_URL}/api/v1/projects/{PROJECT_ID}/workspace",
            headers={"Authorization": f"Bearer {token}"}
        )
        if r.status_code == 200:
            d = r.json()
            ws = d.get("data", {}).get("workspace", {})
            code = ws.get("code", "")
            files = ws.get("files", [])
            
            mvp_markers = ["fineSTEM MVP", "actionButton", "已成功运行",
                          "这是一个可运行的最小版本"]
            has_mvp_in_code = any(m in code for m in mvp_markers)
            
            print(f"  Files: {len(files)}")
            for f in files:
                fc = f.get("content", "")
                f_mvp = [m for m in mvp_markers if m in fc]
                print(f"    {f['name']}: len={len(fc)} MVP={f_mvp if f_mvp else 'clean'}")
            
            print(f"\n{'='*50}")
            if has_mvp_in_code:
                print("❌ FAIL: MVP CODE IN WORKSPACE AFTER BLOCK!")
                print(f"   Code starts with: {code[:200]}")
                sys.exit(1)
            else:
                print("✅ PASS: No MVP code in workspace - DB layer block working!")
                print(f"   Code preview: {code[:150]}")


if __name__ == "__main__":
    asyncio.run(main())
