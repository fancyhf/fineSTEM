#!/usr/bin/env python3
"""直接测试 orchestrator 服务"""

import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

import asyncio
from app.services.orchestrator import AgentOrchestratorService, AgentChatRequest

async def test():
    service = AgentOrchestratorService()
    
    req = AgentChatRequest(
        message="重新生成index.html代码兵写入编辑器，且要符合项目立项的需求，要能用起来",
        project_id="b686df08-6655-4edb-a3a5-955f3244abe1",
        session_id="test-session-001",
        context={
            "current_stage": "stage_08_evaluate",
            "skill_id": "stem-pbl-guide"
        },
        enable_tools=True
    )
    
    print("Testing orchestrator service...")
    print(f"Message: {req.message}")
    print("-" * 60)
    
    try:
        events = []
        async for event, data in service.stream_chat_with_events("test-user", req):
            events.append((event, data))
            if event == "error":
                print(f"[ERROR] {data}")
                return False
            elif event == "final":
                print(f"[FINAL] {data}")
                break
            elif event == "token":
                token = data.get('token', '')
                if "cannot unpack" in token or "TypeError" in token:
                    print(f"[ERROR IN TOKEN] {token}")
                    return False
                # 忽略编码错误，只检查是否包含错误信息
                try:
                    print(token, end='', flush=True)
                except UnicodeEncodeError:
                    pass  # 忽略编码错误，继续处理
        
        print("\n" + "-" * 60)
        print(f"Total events: {len(events)}")
        
        # 检查是否有错误
        for event, data in events:
            if event == "error":
                print(f"Found error event: {data}")
                return False
            if isinstance(data, dict) and 'content' in data:
                content = data.get('content', '')
                if "cannot unpack" in content or "TypeError" in content:
                    print(f"Found error in content: {content[:200]}")
                    return False
        
        print("[OK] Test passed! No 'cannot unpack' errors found.")
        return True
        
    except Exception as e:
        print(f"\n[EXCEPTION] {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test())
    exit(0 if success else 1)
