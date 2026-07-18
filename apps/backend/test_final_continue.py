#!/usr/bin/env python3
"""最终测试：强制触发截断和续接"""

import asyncio
import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

from app.services.orchestrator import AgentOrchestratorService, AgentChatRequest

async def test():
    service = AgentOrchestratorService()

    # 要求生成一个超长的代码（确保会被截断）
    req = AgentChatRequest(
        message="请写一个完整的 3D 游戏引擎，使用 Python 和 PyOpenGL。包含：1) 向量/矩阵数学库 2) 3D 模型加载器（OBJ格式）3) 光照系统（Phong shading）4) 纹理映射 5) 摄像机控制 6) 碰撞检测 7) 粒子系统 8) 阴影映射 9) 后处理效果（Bloom、景深）10) 完整的游戏循环。请输出完整代码，不要省略任何部分，每个函数都要有详细注释。",
        session_id="test-final-continue",
        context={
            "current_stage": "stage_07_execute",
            "skill_id": "stem-pbl-guide"
        },
        enable_tools=False
    )

    owner_id = "test-user"

    print("=" * 60)
    print("FINAL TEST: Force truncation and auto-continue")
    print("=" * 60)

    event_count = 0
    token_count = 0
    final_content = ""
    start_time = asyncio.get_event_loop().time()

    try:
        async for event_type, event_data in service.stream_chat_with_events(owner_id, req):
            event_count += 1
            elapsed = asyncio.get_event_loop().time() - start_time

            if event_type == "token":
                token = event_data.get("token", "")
                token_count += 1
                final_content += token

                # 每 200 个 token 打印进度
                if token_count % 200 == 0:
                    print(f"[{elapsed:.1f}s] tokens={token_count}, len={len(final_content)}")

            elif event_type == "final":
                print(f"\n[{elapsed:.1f}s] [FINAL] received!")
                break

            elif event_type == "error":
                print(f"\n[{elapsed:.1f}s] [ERROR] {event_data}")
                break

            # 最多等待 5 分钟
            if elapsed > 300:
                print(f"\n[{elapsed:.1f}s] Timeout! Stopping.")
                break

    except Exception as e:
        print(f"\n[EXCEPTION] {type(e).__name__}: {e}")

    elapsed = asyncio.get_event_loop().time() - start_time
    print("-" * 60)
    print(f"Results (after {elapsed:.1f}s):")
    print(f"  Events: {event_count}")
    print(f"  Tokens: {token_count}")
    print(f"  Content length: {len(final_content)}")
    print(f"  Last 150 chars (repr):")
    print(f"    {repr(final_content[-150:])}")

    # 检查截断
    is_truncated = service._is_output_truncated(final_content)
    print(f"\nIs truncated: {is_truncated}")

    if "```" in final_content:
        count = final_content.count("```")
        print(f"Code block markers: {count} ({'CLOSED' if count % 2 == 0 else 'OPEN - TRUNCATED'})")

if __name__ == "__main__":
    asyncio.run(test())
