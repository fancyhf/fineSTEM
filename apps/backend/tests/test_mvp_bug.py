"""
自动化测试：彻底排查 "已生成一个可运行的最小代码版本，并写入编辑器" bug

项目 owner: 21749959@qq.com (fang)
项目 ID: b686df08-6655-4edb-a3a5-955f3244abe1
SSE 格式: event: token\ndata: {...}\n\n
"""
import asyncio
import httpx
import json
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://localhost:8000"
PROJECT_ID = "b686df08-6655-4edb-a3a5-955f3244abe1"
AUTH_EMAIL = "21749959@qq.com"
AUTH_PASSWORD = "750714hf"


async def login(client: httpx.AsyncClient) -> str:
    """登录获取 token"""
    resp = await client.post(f"{BASE_URL}/api/v1/auth/login", data={
        "username": AUTH_EMAIL,
        "password": AUTH_PASSWORD
    })
    if resp.status_code != 200:
        # 尝试注册
        print(f"[LOGIN] Login failed ({resp.status_code}), trying register...")
        reg = await client.post(f"{BASE_URL}/api/v1/auth/register", json={
            "email": AUTH_EMAIL, "password": AUTH_PASSWORD, "name": "fang"
        })
        print(f"[LOGIN] Register: {reg.status_code}")
        resp = await client.post(f"{BASE_URL}/api/v1/auth/login", data={
            "username": AUTH_EMAIL, "password": AUTH_PASSWORD
        })
    data = resp.json()
    token = data.get("data", {}).get("access_token") or data.get("access_token")
    if not token:
        raise Exception(f"No token: {json.dumps(data, ensure_ascii=False)[:300]}")
    print(f"[LOGIN] OK token={token[:30]}...")
    return token


async def get_workspace(client: httpx.AsyncClient, token: str) -> dict:
    """获取 workspace 状态"""
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(f"{BASE_URL}/api/v1/projects/{PROJECT_ID}/workspace", headers=headers)
    data = resp.json()
    ws = data.get("data", {}).get("workspace", {})
    code = ws.get("code", "")
    lang = ws.get("language", "")
    
    mvp_markers = ["fineSTEM MVP", "我的 STEM 项目 MVP", "猜数字游戏",
                   "actionButton", "已成功运行", "这是一个可运行的最小版本"]
    found = [m for m in mvp_markers if m in code]
    
    print(f"[WORKSPACE] status={resp.status_code} lang={lang} code_len={len(code)}")
    if found:
        print(f"[WORKSPACE] !! MVP MARKERS: {found}")
        print(f"[WORKSPACE] code:\n{code[:1000]}")
    else:
        print(f"[WORKSPACE] OK no MVP markers")
        print(f"[WORKSPACE] preview: {code[:300]}")
    return ws


def parse_sse_line(line: str) -> tuple[str | None, str | None]:
    """解析 SSE 行，返回 (event_type, data_json)"""
    line = line.strip()
    if line.startswith("event:"):
        return line[6:].strip(), None
    if line.startswith("data:"):
        return None, line[5:].strip()
    return None, None


async def send_chat_sse(client: httpx.AsyncClient, token: str, message: str) -> dict:
    """通过 SSE GET 接口发送聊天消息"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n[CHAT] Sending: {message}")
    print(f"[CHAT] --- SSE stream start ---")
    
    full_content = ""
    events_seen = []
    code_events = []
    current_event_type = None
    
    params = {"message": message, "project_id": PROJECT_ID}
    
    async with client.stream(
        "GET",
        f"{BASE_URL}/api/v1/agent/stream",
        headers=headers,
        params=params,
        timeout=120.0
    ) as response:
        print(f"[CHAT] Response status: {response.status_code}")
        
        buffer = ""
        async for raw_bytes in response.aiter_bytes():
            text = raw_bytes.decode('utf-8', errors='replace')
            buffer += text
            
            # 按 SSE 双换行分割事件
            while "\n\n" in buffer:
                chunk, buffer = buffer.split("\n\n", 1)
                lines = [l for l in chunk.split('\n') if l.strip()]
                
                evt_type = None
                evt_data = None
                
                for line in lines:
                    if line.startswith("event:"):
                        evt_type = line[6:].strip()
                    elif line.startswith("data:"):
                        evt_data_str = line[5:].strip()
                        try:
                            evt_data = json.loads(evt_data_str)
                        except json.JSONDecodeError:
                            evt_data = evt_data_str
                
                if not evt_type or evt_data is None:
                    continue
                    
                events_seen.append(evt_type)
                
                if evt_type == "token":
                    tok = evt_data.get("token", "")
                    if isinstance(tok, list):
                        tok = " ".join(str(t) for t in tok)
                    elif not isinstance(tok, str):
                        tok = str(tok)
                    full_content += tok
                    # 实时打印（每100字符）
                    if len(full_content) % 200 < 10:
                        pass  # 不刷屏
                
                elif evt_type == "error":
                    err_msg = evt_data.get("error", str(evt_data))
                    print(f"[CHAT] [ERROR] {err_msg}")
                    
                elif evt_type == "final":
                    print(f"[CHAT] [FINAL] {evt_data}")
            
            # 防止 buffer 无限增长
            if len(buffer) > 50000:
                buffer = buffer[-10000:]
    
    # 处理剩余 buffer
    if buffer.strip():
        lines = [l for l in buffer.split('\n') if l.strip()]
        for line in lines:
            if line.startswith("data:"):
                try:
                    d = json.loads(line[5:].strip())
                    if isinstance(d, dict) and "token" in d:
                        full_content += d["token"]
                except json.JSONDecodeError:
                    pass
    
    print(f"[CHAT] --- SSE stream end ---")
    print(f"[CHAT] Events: {events_seen}")
    print(f"[CHAT] Content length: {len(full_content)}")
    
    # 检查 MVP 短语
    mvp_phrases = ["最小代码版本", "MVP", "最小可运行", "写入编辑器",
                   "已生成一个可运行的最小"]
    found = [p for p in mvp_phrases if p in full_content]
    
    if found:
        print(f"\n[ANALYSIS] !! MVP PHRASES FOUND: {found}")
        for p in found:
            idx = full_content.find(p)
            ctx = full_content[max(0,idx-80):idx+len(p)+80]
            print(f'[ANALYSIS] Context of "{p}": ...{ctx}...')
    else:
        print(f"[ANALYSIS] OK No MVP phrases in reply")
    
    print(f"\n[REPLY FULL]:\n{full_content}")
    
    return {
        "full_content": full_content,
        "events": events_seen,
        "mvp_phrases_found": found,
    }


async def main():
    async with httpx.AsyncClient() as client:
        # Step 1: Login
        print("=" * 60)
        print("STEP 1: LOGIN")
        print("=" * 60)
        token = await login(client)
        
        # Step 2: Workspace BEFORE
        print("\n" + "=" * 60)
        print("STEP 2: WORKSPACE BEFORE")
        print("=" * 60)
        ws_before = await get_workspace(client, token)
        
        # Step 3: Chat - ask about stage
        print("\n" + "=" * 60)
        print("STEP 3: CHAT - '现在什么阶段？'")
        print("=" * 60)
        r1 = await send_chat_sse(client, token, "现在什么阶段？")
        
        # Step 4: Chat - restore code
        print("\n" + "=" * 60)
        print("STEP 4: CHAT - '恢复之前的故事代码'")
        print("=" * 60)
        r2 = await send_chat_sse(client, token, "恢复之前的故事代码，把4个文件都写好，不要最小版本")
        
        # Step 5: Workspace AFTER
        print("\n" + "=" * 60)
        print("STEP 5: WORKSPACE AFTER")
        print("=" * 60)
        ws_after = await get_workspace(client, token)
        
        # Summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        all_mvp = r1["mvp_phrases_found"] + r2["mvp_phrases_found"]
        if all_mvp:
            print(f"BUG CONFIRMED: MVP phrases still appearing: {all_mvp}")
        else:
            print(f"No MVP phrases detected")


if __name__ == "__main__":
    asyncio.run(main())
