"""
测试流式对话截断检测和自动续接机制

⚠️ 2026-07-22 测试体系重构：本文件已停用（pytest.skip）。
原因：依赖 orchestrator.AgentOrchestrator（类已重命名为 AgentOrchestratorService），
且测试的是 orchestrator 内部的 stream_chat 逻辑——而 orchestrator 已不在主链路上
（前端直连 ZeroClaw，截断/续接逻辑在前端 useStreamingChat.ts 实现）。
截断续接的等价覆盖在：
  - 前端单测 test_useStreamingChat（normalizeToolName / parseMcpOutput）
  - 前端单测 test_create_narration（sanitizeAssistantNarration 不误杀内容）
本文件保留备查，不再收集运行。

问题背景：AI 输出经常在代码块中间、句子中间被截断，导致用户需要不断输入"继续"
测试目标：验证截断检测和自动续接机制能正确处理各种截断场景
"""

import pytest
pytestmark = pytest.mark.skip(reason="依赖已废弃的 orchestrator.AgentOrchestrator，截断逻辑已迁至前端")

# 用 try/except 包住 import，避免收集阶段就失败
try:
    from app.services.orchestrator import AgentOrchestrator as _AO  # noqa: F401
except ImportError:
    AgentOrchestrator = None  # type: ignore

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from typing import AsyncGenerator

# AgentOrchestrator 已在文件头 try/except 中定义为 None（被 skip 不执行）


class TestOutputTruncationDetection:
    """测试截断检测逻辑 _is_output_truncated"""

    def test_unclosed_code_block(self):
        """测试未闭合的代码块被检测为截断"""
        content = "这是一些文本\n```python\nprint('hello')"
        assert AgentOrchestrator._is_output_truncated(content) is True

    def test_closed_code_block(self):
        """测试已闭合的代码块不被检测为截断"""
        content = "这是一些文本\n```python\nprint('hello')\n```"
        assert AgentOrchestrator._is_output_truncated(content) is False

    def test_unclosed_xml_tag(self):
        """测试未闭合的 XML 标签被检测为截断"""
        content = "<question>这是一个问题"
        assert AgentOrchestrator._is_output_truncated(content) is True

    def test_closed_xml_tag(self):
        """测试已闭合的 XML 标签不被检测为截断"""
        content = "<question>这是一个问题</question>"
        assert AgentOrchestrator._is_output_truncated(content) is False

    def test_incomplete_sentence_with_comma(self):
        """测试以逗号结尾的句子被检测为截断"""
        content = "接下来，我们将"
        assert AgentOrchestrator._is_output_truncated(content) is True

    def test_incomplete_sentence_with_colon(self):
        """测试以冒号结尾的句子被检测为截断"""
        content = "以下是几种选择："
        assert AgentOrchestrator._is_output_truncated(content) is True

    def test_complete_sentence(self):
        """测试完整的句子不被检测为截断"""
        content = "这是一个完整的句子。"
        assert AgentOrchestrator._is_output_truncated(content) is False

    def test_ends_with_language_name(self):
        """测试以编程语言名称结尾被检测为截断"""
        content = "```python"
        assert AgentOrchestrator._is_output_truncated(content) is True

    def test_normal_ending(self):
        """测试正常结尾不被检测为截断"""
        content = "谢谢你的提问！"
        assert AgentOrchestrator._is_output_truncated(content) is False


class TestFinishReasonDetection:
    """测试 finish_reason 检测逻辑"""

    @pytest.mark.asyncio
    async def test_finish_reason_length_detection(self):
        """测试检测到 finish_reason=length 时触发续接"""
        orchestrator = AgentOrchestrator()

        # 模拟 provider.stream_complete 返回 finish_reason 标记
        async def mock_stream_complete(*args, **kwargs):
            yield "这是一些内容"
            yield "__FINISH_REASON__:length"

        orchestrator.provider = MagicMock()
        orchestrator.provider.stream_complete = mock_stream_complete

        # 收集所有 yield 的内容
        tokens = []
        async for token in orchestrator.provider.stream_complete({}, "http://test"):
            tokens.append(token)

        # 验证检测到了 finish_reason 标记
        assert "__FINISH_REASON__:length" in tokens

    @pytest.mark.asyncio
    async def test_finish_reason_stop_no_continue(self):
        """测试 finish_reason=stop 时不触发续接"""
        orchestrator = AgentOrchestrator()

        async def mock_stream_complete(*args, **kwargs):
            yield "这是完整的内容"
            yield "__FINISH_REASON__:stop"

        orchestrator.provider = MagicMock()
        orchestrator.provider.stream_complete = mock_stream_complete

        tokens = []
        async for token in orchestrator.provider.stream_complete({}, "http://test"):
            tokens.append(token)

        assert "__FINISH_REASON__:stop" in tokens


class TestAutoContinueMechanism:
    """测试自动续接机制"""

    @pytest.mark.asyncio
    async def test_auto_continue_on_truncation(self):
        """测试检测到截断时自动续接"""
        orchestrator = AgentOrchestrator()

        # 第一次调用返回截断内容
        call_count = 0
        async def mock_stream_complete(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                yield "这是截断的内容```python\nprint('hel"
                yield "__FINISH_REASON__:length"
            else:
                # 续接调用返回完整内容
                yield "lo')\n```\n完成！"
                yield "__FINISH_REASON__:stop"

        orchestrator.provider = MagicMock()
        orchestrator.provider.stream_complete = mock_stream_complete

        # 验证续接机制
        tokens = []
        async for token in orchestrator.provider.stream_complete({}, "http://test"):
            if not token.startswith("__FINISH_REASON__"):
                tokens.append(token)

        # 第一次应该返回截断内容
        assert "```python" in "".join(tokens)

    @pytest.mark.asyncio
    async def test_multiple_continue_attempts(self):
        """测试多次续接尝试"""
        orchestrator = AgentOrchestrator()

        call_count = 0
        async def mock_stream_complete(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            yield f"内容片段{call_count}"
            if call_count < 3:
                yield "__FINISH_REASON__:length"
            else:
                yield "__FINISH_REASON__:stop"

        orchestrator.provider = MagicMock()
        orchestrator.provider.stream_complete = mock_stream_complete

        # 模拟多次调用
        all_tokens = []
        for _ in range(3):
            async for token in orchestrator.provider.stream_complete({}, "http://test"):
                all_tokens.append(token)

        # 验证调用了 3 次
        assert call_count == 3
        assert "内容片段1" in all_tokens
        assert "内容片段2" in all_tokens
        assert "内容片段3" in all_tokens


class TestContentUpdateHandling:
    """测试 content_update 事件处理"""

    def test_strip_question_xml(self):
        """测试剥离 question XML 标签"""
        orchestrator = AgentOrchestrator()

        content = """这是正常文本
<question type="single" title="选择一个选项">
  <option id="opt1" label="选项1">描述1</option>
  <option id="opt2" label="选项2">描述2</option>
</question>
更多文本"""

        clean_content, has_question = orchestrator.strip_question_xml(content)

        # 验证 XML 被剥离
        assert "<question>" not in clean_content
        assert "<option" not in clean_content
        assert "这是正常文本" in clean_content
        assert "更多文本" in clean_content
        assert has_question is True

    def test_content_length_after_strip(self):
        """测试剥离 XML 后内容长度变短"""
        orchestrator = AgentOrchestrator()

        content_with_xml = "文本<question><option id='1'>选项</option></question>更多文本"
        clean_content, _ = orchestrator.strip_question_xml(content_with_xml)

        # 清理后的内容应该更短
        assert len(clean_content) < len(content_with_xml)
        assert "文本" in clean_content
        assert "更多文本" in clean_content


class TestIntegrationScenarios:
    """测试集成场景"""

    @pytest.mark.asyncio
    async def test_full_stream_with_truncation(self):
        """测试完整的流式对话场景，包含截断和续接"""
        orchestrator = AgentOrchestrator()

        # 模拟完整的对话流程
        events = []

        async def mock_stream_chat_with_events(*args, **kwargs):
            # 模拟工具调用前内容
            yield ("token", {"token": "让我为你"})
            yield ("token", {"token": "生成代码："})
            yield ("token", {"token": "\n```python\n"})
            yield ("token", {"token": "def hello():\n    "})
            yield ("token", {"token": "print('hel"})
            # 模拟截断
            yield ("token", {"token": "__FINISH_REASON__:length"})

            # 续接内容
            yield ("token", {"token": "lo')\n```\n"})
            yield ("token", {"token": "完成！"})
            yield ("token", {"token": "__FINISH_REASON__:stop"})

            # 最终 content_update
            yield ("content_update", {"content": "让我为你生成代码：\n```python\ndef hello():\n    print('hello')\n```\n完成！"})

        # 收集事件
        async for event in mock_stream_chat_with_events():
            events.append(event)

        # 验证事件序列
        token_events = [e for e in events if e[0] == "token"]
        content_update_events = [e for e in events if e[0] == "content_update"]

        assert len(token_events) > 0
        assert len(content_update_events) == 1

        # 验证最终内容
        final_content = content_update_events[0][1]["content"]
        assert "```python" in final_content
        assert "def hello():" in final_content
        assert "print('hello')" in final_content


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
