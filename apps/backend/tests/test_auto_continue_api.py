"""
AI 自动续接功能 API 测试

测试场景：
1. 发送长代码生成请求
2. 验证后端是否正确检测截断
3. 验证自动续接机制是否触发
4. 验证最终输出是否完整

运行：
    cd apps/backend
    python -m pytest tests/test_auto_continue_api.py -v --timeout=300
"""

import asyncio
import pytest
import sys
from typing import AsyncGenerator, Tuple, Any

sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

from app.services.orchestrator import AgentOrchestratorService, AgentChatRequest


class TestAutoContinueAPI:
    """AI 自动续接功能测试套件"""

    @pytest.fixture
    def orchestrator(self):
        """创建编排器服务实例"""
        return AgentOrchestratorService()

    @pytest.fixture
    def owner_id(self):
        """测试用户 ID"""
        return "test-user-auto-continue"

    @pytest.mark.asyncio
    @pytest.mark.timeout(180)  # 3 分钟超时
    async def test_short_code_no_truncation(self, orchestrator, owner_id):
        """测试：短代码生成不应触发续接"""
        req = AgentChatRequest(
            message="写一个 Python 函数计算阶乘",
            session_id="test-short-code",
            context={
                "current_stage": "stage_07_execute",
                "skill_id": "stem-pbl-guide"
            },
            enable_tools=False
        )

        events = []
        token_count = 0
        final_content = ""

        async for event_type, event_data in orchestrator.stream_chat_with_events(owner_id, req):
            events.append((event_type, event_data))
            if event_type == "token":
                token_count += 1
                final_content += event_data.get("token", "")
            if event_type == "final":
                break

        # 验证
        assert token_count < 1000, "短代码不应生成过多 token"
        assert "```" in final_content, "应包含代码块"
        # 代码块应该闭合
        code_block_count = final_content.count("```")
        assert code_block_count % 2 == 0, "代码块应正确闭合"

        print(f"✅ 短代码测试通过: {token_count} tokens, {len(final_content)} chars")

    @pytest.mark.asyncio
    @pytest.mark.timeout(300)  # 5 分钟超时
    async def test_long_code_auto_continue(self, orchestrator, owner_id):
        """测试：长代码生成应触发自动续接"""
        req = AgentChatRequest(
            message="请写一个完整的贪吃蛇游戏，使用 Python 和 Pygame。包含完整的游戏逻辑、碰撞检测、分数系统、游戏结束界面和重新开始功能。请直接输出完整代码，不要省略任何部分。",
            session_id="test-long-code-auto-continue",
            context={
                "current_stage": "stage_07_execute",
                "skill_id": "stem-pbl-guide"
            },
            enable_tools=False
        )

        events = []
        token_count = 0
        final_content = ""
        start_time = asyncio.get_event_loop().time()

        async for event_type, event_data in orchestrator.stream_chat_with_events(owner_id, req):
            events.append((event_type, event_data))

            if event_type == "token":
                token_count += 1
                final_content += event_data.get("token", "")

            if event_type == "final":
                break

            # 防止无限循环
            if len(events) > 5000:
                pytest.fail("事件过多，可能进入无限循环")

        elapsed = asyncio.get_event_loop().time() - start_time

        # 验证
        assert token_count > 1000, f"长代码应生成大量 token，实际: {token_count}"
        assert len(final_content) > 5000, f"长代码内容应很长，实际: {len(final_content)}"

        # 验证代码块完整性
        code_block_count = final_content.count("```")
        assert code_block_count > 0, "应包含代码块"
        assert code_block_count % 2 == 0, f"代码块应正确闭合，实际 {code_block_count} 个标记"

        # 验证关键内容
        assert "import" in final_content, "应包含 import 语句"
        assert "pygame" in final_content.lower() or "snake" in final_content.lower(), "应包含 pygame 或 snake 相关内容"

        print(f"✅ 长代码自动续接测试通过:")
        print(f"   - Token 数量: {token_count}")
        print(f"   - 内容长度: {len(final_content)} 字符")
        print(f"   - 耗时: {elapsed:.1f} 秒")
        print(f"   - 代码块: {code_block_count // 2} 个")

    @pytest.mark.asyncio
    @pytest.mark.timeout(600)  # 10 分钟超时（超长代码）
    async def test_ultra_long_code_multiple_continues(self, orchestrator, owner_id):
        """测试：超长代码可能触发多次续接"""
        req = AgentChatRequest(
            message="请写一个完整的 3D 游戏引擎，使用 Python 和 PyOpenGL。包含：1) 向量/矩阵数学库 2) 3D 模型加载器（OBJ格式）3) 光照系统（Phong shading）4) 纹理映射 5) 摄像机控制 6) 碰撞检测 7) 粒子系统 8) 阴影映射 9) 后处理效果（Bloom、景深）10) 完整的游戏循环。请输出完整代码，不要省略任何部分，每个函数都要有详细注释。",
            session_id="test-ultra-long-code",
            context={
                "current_stage": "stage_07_execute",
                "skill_id": "stem-pbl-guide"
            },
            enable_tools=False
        )

        events = []
        token_count = 0
        final_content = ""
        start_time = asyncio.get_event_loop().time()

        async for event_type, event_data in orchestrator.stream_chat_with_events(owner_id, req):
            events.append((event_type, event_data))

            if event_type == "token":
                token_count += 1
                final_content += event_data.get("token", "")

            if event_type == "final":
                break

            if len(events) > 8000:
                pytest.fail("事件过多，可能进入无限循环")

        elapsed = asyncio.get_event_loop().time() - start_time

        # 验证
        assert token_count > 2000, f"超长代码应生成大量 token，实际: {token_count}"
        assert len(final_content) > 10000, f"超长代码内容应非常长，实际: {len(final_content)}"

        # 验证代码块完整性
        code_block_count = final_content.count("```")
        assert code_block_count % 2 == 0, "代码块应正确闭合"

        print(f"✅ 超长代码多次续接测试通过:")
        print(f"   - Token 数量: {token_count}")
        print(f"   - 内容长度: {len(final_content)} 字符")
        print(f"   - 耗时: {elapsed:.1f} 秒")
        print(f"   - 代码块: {code_block_count // 2} 个")

    def test_truncation_detection(self, orchestrator):
        """测试：截断检测逻辑"""
        # 测试用例 1: 未闭合的代码块
        content1 = "```python\nprint('hello')\n"
        assert orchestrator._is_output_truncated(content1) == True, "未闭合代码块应检测为截断"

        # 测试用例 2: 闭合的代码块
        content2 = "```python\nprint('hello')\n```"
        assert orchestrator._is_output_truncated(content2) == False, "闭合代码块不应检测为截断"

        # 测试用例 3: 以编程语言名结尾
        content3 = "```\nprint('hello')\npython"
        assert orchestrator._is_output_truncated(content3) == True, "以编程语言名结尾应检测为截断"

        # 测试用例 4: 未闭合的 XML 标签
        content4 = "<option>test"
        assert orchestrator._is_output_truncated(content4) == True, "未闭合 XML 标签应检测为截断"

        # 测试用例 5: 正常结束的文本
        content5 = "这是一个完整的回复。"
        assert orchestrator._is_output_truncated(content5) == False, "正常文本不应检测为截断"

        print("✅ 截断检测逻辑测试通过")


if __name__ == "__main__":
    # 直接运行测试
    pytest.main([__file__, "-v", "--timeout=300"])
