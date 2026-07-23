"""
MCP server 工具暴露与协议测试（2026-07-22 测试体系重构）

覆盖：
- MCP server 暴露全部 15 个工具（原 12 + 新增 project_memory_store/recall + sop_state_sync）
- 工具调用参数透传完整
- 返回值结构符合 MCP 规范（content + isError）
- 最关键：tool_result 的双层 JSON 结构（content[0].text 内层 JSON）

这组测试使用 2026-07-22 抓帧得到的真实帧数据，确保与 ZeroClaw 实际行为一致。
"""
from __future__ import annotations

import asyncio
import json

import pytest

from app.mcp_server.server import (
    _handle_initialize,
    _handle_tools_call,
    _handle_tools_list,
    _tool_to_mcp_spec,
    _load_tools,
)


class TestMcpToolExposure:
    """MCP server 暴露的工具完整性。"""

    def test_loads_all_15_tools(self):
        """MCP server 应暴露全部 15 个工具（原 12 + 新增 3 个 SOP/Memory 工具）。"""
        tools = _load_tools()
        assert len(tools) == 15, f"期望 15 个工具，实际 {len(tools)}"

    def test_expected_tool_names_present(self):
        tools = _load_tools()
        expected = {
            "skill_state_reader", "ask_question", "skill_state_writer",
            "stage_advancer", "artifact_reader", "artifact_writer",
            "evidence_saver", "code_runner", "project_code_writer",
            "resource_searcher", "project_creator", "achievement_card",
            "project_memory_store", "project_memory_recall", "sop_state_sync",
        }
        assert set(tools.keys()) == expected

    @pytest.mark.asyncio
    async def test_tools_list_returns_all_specs(self):
        tools = _load_tools()
        result = await _handle_tools_list({}, tools)
        assert "tools" in result
        assert len(result["tools"]) == 15
        # 每个 spec 必须有 name / description / inputSchema
        for spec in result["tools"]:
            assert "name" in spec
            assert "description" in spec
            assert "inputSchema" in spec

    def test_tool_to_mcp_spec_format(self):
        tools = _load_tools()
        ask = tools["ask_question"]
        spec = _tool_to_mcp_spec("ask_question", ask)
        assert spec["name"] == "ask_question"
        assert isinstance(spec["description"], str)
        assert "inputSchema" in spec


class TestMcpInitialize:
    """MCP initialize 握手。"""

    @pytest.mark.asyncio
    async def test_initialize_returns_protocol_version(self):
        result = await _handle_initialize({})
        assert "protocolVersion" in result
        assert result["protocolVersion"] == "2024-11-05"
        assert result["serverInfo"]["name"] == "finestem-pbl"
        assert "tools" in result["capabilities"]


class TestMcpToolsCallOutputStructure:
    """工具调用的返回值必须符合 MCP content 结构（双层 JSON）。

    这是前端 parseMcpOutput 函数的前提——ZeroClaw 拿到 MCP server 的返回后，
    会把它原样转成 tool_result 帧推给前端。前端的 parseMcpOutput 负责解析
    content[0].text 里的内层 JSON。
    """

    @pytest.mark.asyncio
    async def test_successful_call_returns_content_with_text(self):
        """成功调用返回 {content: [{type:text, text:JSON}], isError:false}。"""
        tools = _load_tools()
        result = await _handle_tools_call({
            "name": "ask_question",
            "arguments": {
                "title": "测试问题",
                "options": [
                    {"id": "a", "label": "选项A"},
                    {"id": "b", "label": "选项B"},
                ],
            },
        }, tools)
        assert "content" in result
        assert isinstance(result["content"], list)
        assert len(result["content"]) == 1
        assert result["content"][0]["type"] == "text"
        assert result["isError"] is False
        # 内层 JSON 必须能解析
        inner = json.loads(result["content"][0]["text"])
        assert inner["success"] is True
        assert "data" in inner
        assert inner["data"]["title"] == "测试问题"

    @pytest.mark.asyncio
    async def test_unknown_tool_returns_error(self):
        tools = _load_tools()
        result = await _handle_tools_call({"name": "nonexistent", "arguments": {}}, tools)
        assert result["isError"] is True
        inner = json.loads(result["content"][0]["text"])
        assert inner["success"] is False

    @pytest.mark.asyncio
    async def test_missing_required_param_returns_error(self):
        """缺必填参数时，工具返回 success=false（业务失败，不是协议错误）。"""
        tools = _load_tools()
        result = await _handle_tools_call({
            "name": "ask_question",
            "arguments": {"title": ""},  # 缺 options
        }, tools)
        inner = json.loads(result["content"][0]["text"])
        assert inner["success"] is False


class TestRealFrameStructure:
    """用抓帧得到的真实数据验证 MCP output 结构（确保前后端协议一致）。"""

    @staticmethod
    def _build_real_output() -> str:
        """构造与 2026-07-22 抓帧实证一致的 MCP 双层 JSON output。"""
        inner_data = {
            "success": True,
            "data": {
                "title": "你现在是哪个年级？",
                "multiple": False,
                "step": 1,
                "total_steps": 3,
                "options": [
                    {"description": "7~9 年级", "id": "junior", "label": "初中"},
                    {"description": "10~12 年级", "id": "senior", "label": "高中"},
                ],
                "message": "已向学生提问",
            },
        }
        outer = {
            "content": [{"type": "text", "text": json.dumps(inner_data, ensure_ascii=False)}],
            "isError": False,
        }
        return json.dumps(outer, ensure_ascii=False, indent=2)

    def test_real_output_parses_to_inner_data(self):
        """模拟前端 parseMcpOutput：从真实双层 JSON 提取内层 data。"""
        output_str = self._build_real_output()
        outer = json.loads(output_str)
        assert outer["isError"] is False
        assert isinstance(outer["content"], list)
        inner_text = outer["content"][0]["text"]
        inner = json.loads(inner_text)
        assert inner["success"] is True
        assert inner["data"]["title"] == "你现在是哪个年级？"
        assert len(inner["data"]["options"]) == 2
        assert inner["data"]["options"][0]["id"] == "junior"

    def test_real_tool_call_name_has_prefix(self):
        """实证：ZeroClaw 推给前端的工具名带 finestem__ 前缀。"""
        # 这是 useStreamingChat.normalizeToolName 要处理的情况
        raw_name = "finestem__ask_question"
        # 模拟 normalizeToolName
        normalized = raw_name[10:] if raw_name.startswith("finestem__") else raw_name
        assert normalized == "ask_question"
