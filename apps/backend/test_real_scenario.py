#!/usr/bin/env python3
"""模拟真实使用场景的测试"""

import asyncio
import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

from app.services.orchestrator import AgentOrchestratorService, AgentChatRequest

async def test():
    service = AgentOrchestratorService()

    # 模拟用户的真实请求：让 AI 检查文件并生成代码
    req = AgentChatRequest(
        message="我看到所有HTML文件了！从列表来看，index.html 在多个位置都存在。让我仔细检查 4824fbf1 这个项目ID对应的文件，确认我们的代码是否写入了正确的位置，并且内容正确。",
        session_id="test-real-scenario",
        context={
            "current_stage": "stage_07_execute",
            "skill_id": "stem-pbl-guide",
            "project_id": "4824fbf1-0054-4edf-9f16-4bd80087ab3f"
        },
        enable_tools=True  # 启用工具调用
    )

    owner_id = "test-user"

    print("Starting real scenario test...")
    print("-" * 60)

    event_count = 0
    token_count = 0
    tool_count = 0
    final_content = ""
    has_final = False

    try:
        async for event_type, event_data in service.stream_chat_with_events(owner_id, req):
            event_count += 1

            if event_type == "token":
                token = event_data.get("token", "")
                token_count += 1
                final_content += token

                if token_count % 50 == 0:
                    print(f"[TOKEN] count={token_count}, len={len(final_content)}")

            elif event_type == "tool_start":
                tool_count += 1
                print(f"[TOOL_START] {event_data.get('tool_name')}")

            elif event_type == "tool_end":
                success = event_data.get('success')
                print(f"[TOOL_END] success={success}")

            elif event_type == "final":
                print(f"[FINAL] status={event_data.get('status')}")
                has_final = True
                break

            elif event_type == "error":
                print(f"[ERROR] {event_data}")
                break

            if event_count > 2000:
                print("[WARN] Event limit")
                break

    except Exception as e:
        print(f"[EXCEPTION] {type(e).__name__}: {e}")

    print("-" * 60)
    print(f"Results:")
    print(f"  Events: {event_count}")
    print(f"  Tokens: {token_count}")
    print(f"  Tool calls: {tool_count}")
    print(f"  Content length: {len(final_content)}")
    print(f"  Has final: {has_final}")
    print(f"  Last 100 chars:")
    print(f"    {repr(final_content[-100:])}")

    # 检查截断
    is_truncated = service._is_output_truncated(final_content)
    print(f"\nIs truncated: {is_truncated}")

if __name__ == "__main__":
    asyncio.run(test())
