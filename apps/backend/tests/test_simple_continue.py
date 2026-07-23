#!/usr/bin/env python3
"""简单的自动续接测试"""

import asyncio
import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

from app.services.orchestrator import AgentOrchestratorService, AgentChatRequest

async def test():
    service = AgentOrchestratorService()

    # 构造一个请求
    req = AgentChatRequest(
        message="写一个 Python 函数计算阶乘",
        session_id="test-simple-continue",
        context={
            "current_stage": "stage_07_execute",
            "skill_id": "stem-pbl-guide"
        },
        enable_tools=False
    )

    owner_id = "test-user"

    print("Starting test...")
    print("-" * 60)

    event_count = 0
    token_count = 0
    final_content = ""
    has_final = False

    try:
        async for event_type, event_data in service.stream_chat_with_events(owner_id, req):
            event_count += 1

            if event_type == "token":
                token = event_data.get("token", "")
                token_count += 1
                final_content += token

                # 每 100 个 token 打印一次进度
                if token_count % 100 == 0:
                    print(f"[PROGRESS] tokens={token_count}, content_len={len(final_content)}")

            elif event_type == "final":
                print(f"[FINAL] status={event_data.get('status')}")
                has_final = True
                break

            elif event_type == "error":
                print(f"[ERROR] {event_data}")
                break

            # 防止无限循环
            if event_count > 3000:
                print("[WARN] Event limit reached")
                break

    except Exception as e:
        print(f"[EXCEPTION] {type(e).__name__}: {e}")

    print("-" * 60)
    print(f"Results:")
    print(f"  Events: {event_count}")
    print(f"  Tokens: {token_count}")
    print(f"  Content length: {len(final_content)}")
    print(f"  Has final event: {has_final}")
    print(f"  Last 50 chars: {repr(final_content[-50:])}")

    # 检查代码块
    if "```" in final_content:
        count = final_content.count("```")
        print(f"  Code block markers: {count} ({'closed' if count % 2 == 0 else 'OPEN'})")

if __name__ == "__main__":
    asyncio.run(test())
