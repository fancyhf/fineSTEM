#!/usr/bin/env python3
"""测试自动续接机制是否工作"""

import asyncio
import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

from app.services.orchestrator import AgentOrchestratorService, AgentChatRequest

async def test():
    service = AgentOrchestratorService()

    # 构造一个请求，要求生成大量代码
    req = AgentChatRequest(
        message="请写一个完整的贪吃蛇游戏，使用 Python 和 Pygame。包含完整的游戏逻辑、碰撞检测、分数系统、游戏结束界面和重新开始功能。请直接输出完整代码，不要省略任何部分。",
        session_id="test-auto-continue-long-code",
        context={
            "current_stage": "stage_07_execute",
            "skill_id": "stem-pbl-guide"
        },
        enable_tools=False  # 禁用工具调用，确保走流式输出路径
    )

    owner_id = "test-user"

    print("=" * 60)
    print("Testing auto-continue mechanism")
    print("=" * 60)
    print(f"Message: {req.message}")
    print("-" * 60)

    event_count = 0
    token_count = 0
    final_content = ""

    try:
        async for event_type, event_data in service.stream_chat_with_events(owner_id, req):
            event_count += 1

            if event_type == "token":
                token = event_data.get("token", "")
                token_count += 1
                final_content += token
                # 不打印每个 token，避免编码问题
            elif event_type == "question":
                # 不打印 question 数据，避免 emoji 编码问题
                pass
            elif event_type == "final":
                print(f"[FINAL] status={event_data.get('status')}, tools_used={event_data.get('tools_used')}")
                break
            elif event_type == "error":
                print(f"[ERROR] {event_data}")
                break

            # 防止无限循环（增加到 5000 以允许续接）
            if event_count > 5000:
                print("[WARN] Too many events, stopping")
                break

    except Exception as e:
        print(f"\n[EXCEPTION] {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

    print("-" * 60)
    print(f"Total events: {event_count}")
    print(f"Total tokens: {token_count}")
    print(f"Final content length: {len(final_content)}")
    print(f"Last 100 chars: {repr(final_content[-100:])}")

    # 检查是否包含完整的代码块
    if "```" in final_content:
        code_block_count = final_content.count("```")
        if code_block_count % 2 == 0:
            print("[OK] Code block is properly closed")
        else:
            print("[FAIL] Code block is NOT properly closed (truncated)")
    else:
        print("[WARN] No code block found")

    return True

if __name__ == "__main__":
    success = asyncio.run(test())
    exit(0 if success else 1)
