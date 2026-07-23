#!/usr/bin/env python3
"""测试项目 b686df08-6655-4edb-a3a5-955f3244abe1"""

import asyncio
import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

from app.services.orchestrator import AgentOrchestratorService, AgentChatRequest

async def test_project():
    service = AgentOrchestratorService()
    
    # 构造请求
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
    
    owner_id = "test-user"
    
    print("=" * 60)
    print("Testing project: b686df08-6655-4edb-a3a5-955f3244abe1")
    print("Message:", req.message)
    print("=" * 60)
    
    try:
        # 使用 stream_chat_with_events 来测试
        async for event, data in service.stream_chat_with_events(owner_id, req):
            print(f"\n[EVENT: {event}]")
            if event == "error":
                print(f"ERROR: {data}")
                break
            elif event == "final":
                print(f"Final: {data}")
                break
            elif event == "skill_activated":
                print(f"Skill: {data.get('skill_name')} / {data.get('sub_skill_name')}")
            elif event == "token":
                print(f"Token: {data.get('token', '')[:100]}...")
    except Exception as e:
        print(f"\n[EXCEPTION: {type(e).__name__}]")
        print(str(e))
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_project())
