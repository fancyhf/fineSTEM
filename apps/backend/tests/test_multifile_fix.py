"""
多文件写入修复验证测试
1. 验证 MVP 套话不再出现
2. 验证 project_code_writer 多文件 upsert 正常工作
3. 验证 workspace 中保存了所有 4 个文件
4. 验证 index.html 被标记为 is_main
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

MVP_PHRASES = [
    "最小代码版本", "MVP", "最小可运行", "写入编辑器",
    "已生成一个可运行的最小", "可运行的最小代码版本"
]

MVP_CODE_MARKERS = [
    "fineSTEM MVP", "我的 STEM 项目 MVP", "actionButton",
    "已成功运行", "这是一个可运行的最小版本",
    "你可以继续让 AI 按你的项目主题扩展功能",
]


async def get_token():
    import httpx
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{API_URL}/api/v1/auth/login", data={
            "username": AUTH_EMAIL, "password": AUTH_PASSWORD
        })
        d = r.json()
        return d.get("data", {}).get("access_token") or d.get("access_token")


async def test_chat(token, msg, timeout=90):
    """Send chat message via WebSocket and collect response"""
    uri = f"{WS_URL}?token={token}"
    print(f"\n{'='*60}")
    print(f">>> Sending: {msg}")
    
    full_content = ""
    code_events = []
    tool_calls = []
    
    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({
            "type": "chat",
            "message": msg,
            "project_id": PROJECT_ID
        }))
        
        deadline = asyncio.get_event_loop().time() + timeout
        done = False
        while not done and asyncio.get_event_loop().time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=25)
                m = json.loads(raw)
                etype = m.get("event", "?")
                edata = m.get("data")
                
                if etype == "token":
                    t = edata.get("token", "") if isinstance(edata, dict) else ""
                    if isinstance(t, str):
                        full_content += t
                
                elif etype == "code_generated":
                    code_events.append(edata or {})
                    ce = edata or {}
                    code_str = ce.get("code", "")
                    files_list = ce.get("files", [])
                    mvp_in_code = any(x in code_str for x in MVP_CODE_MARKERS)
                    print(f"  [CODE_GEN] len={len(code_str)} source={ce.get('source')} "
                          f"files={len(files_list)} MVP={mvp_in_code}")
                    for f in files_list:
                        print(f"             file: {f.get('name')} ({f.get('language')}) "
                              f"is_main={f.get('is_main')} len={len(f.get('content',''))}")
                
                elif etype == "tool_call":
                    tool_calls.append(edata or {})
                    tc = edata or {}
                    print(f"  [TOOL_CALL] name={tc.get('tool_name')} "
                          f"params_keys={list((tc.get('parameters') or {}).keys())}")
                
                elif etype == "tool_result":
                    tr = edata or {}
                    print(f"  [TOOL_RESULT] ok={tr.get('ok')} "
                          f"msg={str(tr.get('message') or tr.get('error') or '')[:100]}")
                
                elif etype == "final":
                    done = True
                
                elif etype == "error":
                    err = (edata or {}).get("message", str(m))
                    print(f"  [ERROR] {err[:300]}")
                    
            except asyncio.TimeoutError:
                print(f"  [TIMEOUT] after {timeout}s")
                break
            except Exception as e:
                print(f"  [EXCEPTION] {e}")
                break
    
    # Check MVP phrases in text reply
    found_mvp = [p for p in MVP_PHRASES if p in full_content]
    
    print(f"\n  Content length: {len(full_content)}")
    if found_mvp:
        print(f"  !! MVP PHRASES IN REPLY: {found_mvp}")
    else:
        print(f"  OK: No MVP phrases in text reply")
    print(f"  Reply preview: {full_content[:400]}")
    
    return {
        "content": full_content,
        "mvp_phrases": found_mvp,
        "code_events": code_events,
        "tool_calls": tool_calls,
    }


async def check_workspace_files(token):
    """Check workspace file list from API"""
    import httpx
    async with httpx.AsyncClient() as c:
        ws_resp = await c.get(
            f"{API_URL}/api/v1/projects/{PROJECT_ID}/workspace",
            headers={"Authorization": f"Bearer {token}"}
        )
        ws_data = ws_resp.json()
        workspace = ws_data.get("data", {}).get("workspace") or {}
        files = workspace.get("files", [])
        code = workspace.get("code", "")
        
        print(f"\n{'='*60}")
        print(f"=== WORKSPACE FILES ===")
        print(f"Total files: {len(files)}")
        
        main_file = None
        for f in files:
            is_main = f.get("is_main", False)
            fname = f.get("name", "?")
            flang = f.get("language", "?")
            clen = len(f.get("content", ""))
            marker = " >>> MAIN <<<" if is_main else ""
            print(f"  {fname:<20} lang={flang:<10} is_main={is_main!s:<5} content_len={clen}{marker}")
            if is_main:
                main_file = fname
        
        # Check for expected files
        expected = ["index.html", "style.css", "story_data.js", "story_engine.js"]
        present = [f.get("name") for f in files]
        missing = [e for e in expected if e not in present]
        extra = [p for p in present if p not in expected]
        
        print(f"\n  Main file: {main_file}")
        if missing:
            print(f"  !! MISSING files: {missing}")
        if extra:
            print(f"  !! EXTRA files: {extra}")
        
        has_mvp_code = any(m in code for m in ["fineSTEM MVP", "actionButton"])
        print(f"\n  Code field length: {len(code)}")
        print(f"  MVP in code field: {has_mvp_code}")
        
        return {
            "files": files,
            "main_file": main_file,
            "missing": missing,
            "extra": extra,
            "has_mvp_code": has_mvp_code,
            "file_count": len(files),
        }


async def main():
    token = await get_token()
    if not token:
        print("FATAL: Cannot get auth token!")
        sys.exit(1)
    print(f"Token OK: {token[:30]}...")
    
    # Step 1: Check initial state
    print("\n" + "="*60)
    print("STEP 1: Initial workspace check")
    ws_before = await check_workspace_files(token)
    
    # Step 2: Ask about current stage (should NOT trigger MVP)
    r1 = await test_chat(token, "现在什么阶段？")
    
    # Step 3: Ask to write all 4 files (the key test for multi-file fix)
    r2 = await test_chat(
        token,
        "请用 project_code_writer 工具依次写入以下4个完整文件：\n"
        "1. index.html - 主HTML文件\n"
        "2. style.css - 样式文件\n"
        "3. story_data.js - 故事数据\n"
        "4. story_engine.js - 故事引擎\n\n"
        "每个文件单独调用一次 project_code_writer，不要用 skill_state_writer。",
        timeout=120
    )
    
    # Step 4: Check final workspace state
    print("\n" + "="*60)
    print("STEP 4: Final workspace check (after multi-file write)")
    ws_after = await check_workspace_files(token)
    
    # Final verdict
    print("\n" + "="*60)
    print("="*60)
    print("FINAL VERDICT:")
    print("-" * 40)
    
    issues = []
    
    # Check 1: No MVP phrases in text replies
    all_mvp_phrases = r1["mvp_phrases"] + r2["mvp_phrases"]
    if all_mvp_phrases:
        print(f"  FAIL: MVP phrases found in replies: {all_mvp_phrases}")
        issues.append("MVP phrases in text")
    else:
        print(f"  PASS: No MVP phrases in text replies")
    
    # Check 2: No MVP in code events
    any_code_mvp = any(
        any(m in (ce.get("code") or "") for m in MVP_CODE_MARKERS)
        for ce in r1["code_events"] + r2["code_events"]
    )
    if any_code_mvp:
        print(f"  FAIL: MVP markers found in code events")
        issues.append("MVP in code events")
    else:
        print(f"  PASS: No MVP markers in code events")
    
    # Check 3: All 4 files present
    if ws_after["missing"]:
        print(f"  FAIL: Missing files: {ws_after['missing']}")
        issues.append(f"Missing files: {ws_after['missing']}")
    else:
        print(f"  PASS: All expected files present ({ws_after['file_count']} files)")
    
    # Check 4: index.html is main
    if ws_after["main_file"] == "index.html":
        print(f"  PASS: index.html is correctly marked as main file")
    else:
        print(f"  FAIL: Main file is '{ws_after['main_file']}', expected 'index.html'")
        issues.append(f"Wrong main file: {ws_after['main_file']}")
    
    # Check 5: No MVP in workspace DB
    if ws_after["has_mvp_code"]:
        print(f"  FAIL: MVP code found in workspace DB")
        issues.append("MVP in workspace DB")
    else:
        print(f"  PASS: No MVP code in workspace DB")
    
    print("-" * 40)
    if issues:
        print(f">>> ISSUES FOUND: {issues} <<<")
        sys.exit(1)
    else:
        print(f">>> ALL CHECKS PASSED <<<")


if __name__ == "__main__":
    asyncio.run(main())
