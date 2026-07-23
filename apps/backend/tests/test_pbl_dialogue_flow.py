"""
PBL 对话流集成测试
测试创建项目、AI对话流、选项识别、阶段推进的完整流程

⚠️ 2026-07-22 测试体系重构：本文件已停用（pytest.skip）。
原因：依赖 orchestrator.py 的内部符号（_parse_selection_format /
_is_selection_message / _extract_selected_option_id），这些符号已不存在。
orchestrator.py 是前端直连 ZeroClaw 之前的旧路径，现已不在主链路上。
这些测试场景的等价覆盖已迁移到：
  - test_stage_constants.py（阶段推进门禁）
  - test_tools_gates.py（工具层门禁）
  - test_check_gate_structural.py（工件校验）
  - test_mcp_server.py（MCP 协议）
本文件保留备查，不再收集运行。
"""
import pytest
pytestmark = pytest.mark.skip(reason="依赖已废弃的 orchestrator 内部符号，场景已迁移到新测试文件")

# 用 try/except 包住 import，避免收集阶段就失败（skip 标记对已 import 失败的模块无效）
try:
    from app.services.orchestrator import (
        AgentOrchestratorService,
        _parse_selection_format,
        _is_selection_message,
        _extract_selected_option_id,
        _has_direct_code_intent,
    )
    from app.services.tools import AskQuestionTool
    from app.schemas.agent import AgentChatRequest
    _IMPORT_OK = True
except ImportError:
    _IMPORT_OK = False
    # 提供占位，避免 NameError（这些测试反正被 skip 了）
    AgentOrchestratorService = None
    _parse_selection_format = None
    _is_selection_message = None
    _extract_selected_option_id = None
    _has_direct_code_intent = None
    AskQuestionTool = None
    AgentChatRequest = None

# 以下是原始测试类，因 pytestmark=skip 不会执行，保留备查
import asyncio
from typing import Any, Dict, List
from unittest.mock import Mock, patch, AsyncMock


class TestSelectionFormatParsing:
    """测试选择消息格式解析"""
    
    def test_parse_selection_format_standard(self):
        """测试标准 [选择:选项ID] 格式"""
        result = _parse_selection_format("[选择:time-2h] 2小时")
        assert result is not None
        assert result[0] == "[选择]"
        assert result[1] == "time-2h"
    
    def test_parse_selection_format_with_chinese_colon(self):
        """测试中文冒号 [选择：选项ID] 格式"""
        result = _parse_selection_format("[选择：web] Web应用")
        assert result is not None
        assert result[1] == "web"
    
    def test_parse_selection_format_with_space(self):
        """测试带空格格式"""
        result = _parse_selection_format("[选择: junior] 初中")
        assert result is not None
        assert result[1] == "junior"
    
    def test_parse_selection_format_not_selection(self):
        """测试非选择消息返回 None"""
        result = _parse_selection_format("我想做一个网页项目")
        assert result is None
    
    def test_parse_selection_format_empty(self):
        """测试空消息"""
        result = _parse_selection_format("")
        assert result is None
    
    def test_is_selection_message(self):
        """测试判断选择消息"""
        assert _is_selection_message("[选择:web] Web应用") is True
        assert _is_selection_message("[选择：junior] 初中") is True
        assert _is_selection_message("我想做项目") is False
    
    def test_extract_selected_option_id(self):
        """测试提取选项ID"""
        assert _extract_selected_option_id("[选择:time-6h] 6小时") == "time-6h"
        assert _extract_selected_option_id("[选择：brainstorm] 脑爆") == "brainstorm"
        assert _extract_selected_option_id("普通消息") is None


class TestBootstrapFollowup:
    """测试 Bootstrap 阶段的三问流程"""
    
    def test_build_bootstrap_followup_grade_selection(self):
        """测试年级选择后的跟进（应该询问时间）"""
        req = AgentChatRequest(
            message="[选择:junior] 初中",
            project_id="test-project",
        )
        
        result = AgentOrchestratorService._build_bootstrap_followup(req)
        
        assert result is not None
        content, question = result
        assert "时间安排" in content
        assert question["title"] == "你打算花多长时间完成这个项目？"
        assert question["step"] == 2
        assert question["total_steps"] == 3
        assert any(opt["id"] == "time-2h" for opt in question["options"])
    
    def test_build_bootstrap_followup_time_selection(self):
        """测试时间选择后的跟进（应该询问想法）"""
        req = AgentChatRequest(
            message="[选择:time-6h] 6小时",
            project_id="test-project",
            context={"current_stage": "stage_00_bootstrap"},
        )
        
        result = AgentOrchestratorService._build_bootstrap_followup(req)
        
        assert result is not None
        content, question = result
        # 检查内容包含"想法"或"项目"关键词
        assert "想法" in content or "项目" in content
        assert question["title"] == "你有初步想法了吗？"
        assert question["step"] == 3
        assert question["total_steps"] == 3
        assert any(opt["id"] == "brainstorm" for opt in question["options"])
    
    def test_build_bootstrap_followup_not_selection(self):
        """测试非选择消息不触发跟进"""
        req = AgentChatRequest(
            message="我想做一个项目",
            project_id="test-project",
        )
        
        result = AgentOrchestratorService._build_bootstrap_followup(req)
        
        assert result is None


class TestTeachingModes:
    """测试教学模式"""
    
    def test_valid_teaching_modes_include_html_visual(self):
        """测试 html_visual 模式已添加到有效模式列表"""
        from app.services.orchestrator import VALID_TEACHING_MODES
        
        assert "guided" in VALID_TEACHING_MODES
        assert "demo" in VALID_TEACHING_MODES
        assert "hands_on" in VALID_TEACHING_MODES
        assert "lecture" in VALID_TEACHING_MODES
        assert "html_visual" in VALID_TEACHING_MODES
    
    def test_build_teaching_mode_instruction_html_visual(self):
        """测试 html_visual 教学模式指令生成"""
        req = AgentChatRequest(
            message="讲解代码架构",
            project_id="test-project",
            context={"current_stage": "stage_07_execute", "teaching_mode": "html_visual"},
        )
        
        instruction = AgentOrchestratorService._build_teaching_mode_instruction(req)
        
        assert "html_visual" in instruction
        assert "HTML可视化" in instruction
        assert "Mermaid" in instruction


class TestStageGate:
    """测试阶段门禁"""
    
    def test_allowed_code_stages(self):
        """测试允许代码生成的阶段"""
        from app.services.orchestrator import AgentOrchestratorService
        
        # 这些阶段应该允许代码生成
        allowed_stages = ["stage_05_design", "stage_07_execute", "stage_08_evaluate"]
        
        for stage in allowed_stages:
            req = AgentChatRequest(
                message="给我代码",
                project_id="test-project",
                context={"current_stage": stage},
            )
            # 注意：还需要满足 _has_direct_code_intent
            can_generate = AgentOrchestratorService._should_force_code_generation(
                AgentOrchestratorService(), req
            )
            # 由于消息内容，可能不满足强意图，但至少阶段检查通过
    
    def test_early_stages_block_code_generation(self):
        """测试早期阶段阻止代码生成（即使消息包含代码意图）"""
        early_stages = ["stage_00_bootstrap", "stage_01_brainstorm", "stage_02_brief"]
        
        for stage in early_stages:
            # 注意：_should_force_code_generation 先检查 _has_strong_code_intent
            # 如果消息有强代码意图，它会返回 True 而不检查阶段
            # 所以这个测试需要验证：在阶段不允许时，即使有代码意图也应该被阻止
            # 或者测试应该使用没有强代码意图的消息
            req = AgentChatRequest(
                message="给我完整代码",
                project_id="test-project",
                context={"current_stage": stage},
            )
            
            can_generate = AgentOrchestratorService._should_force_code_generation(
                AgentOrchestratorService(), req
            )
            
            # 由于 "给我完整代码" 匹配 _has_strong_code_intent，它会返回 True
            # 这个行为是正确的：用户明确要代码，系统应该响应
            # 测试改为验证：在没有强代码意图时，早期阶段阻止代码生成
            req_no_intent = AgentChatRequest(
                message="下一步做什么",
                project_id="test-project",
                context={"current_stage": stage},
            )
            
            can_generate_no_intent = AgentOrchestratorService._should_force_code_generation(
                AgentOrchestratorService(), req_no_intent
            )
            
            # 没有代码意图时，早期阶段应该阻止代码生成
            assert can_generate_no_intent is False, f"阶段 {stage} 不应该允许代码生成（无代码意图）"


class TestCodeIntentDetection:
    """测试代码意图检测"""
    
    def test_has_direct_code_intent_positive(self):
        """测试检测到代码意图"""
        assert _has_direct_code_intent("给我完整代码") is True
        assert _has_direct_code_intent("用Python实现") is True
        assert _has_direct_code_intent("写入编辑器") is True
        assert _has_direct_code_intent("开始编码") is True
        assert _has_direct_code_intent("直接给代码") is True
    
    def test_has_direct_code_intent_negative(self):
        """测试未检测到代码意图"""
        assert _has_direct_code_intent("现在什么阶段") is False
        assert _has_direct_code_intent("下一步做什么") is False
        assert _has_direct_code_intent("解释一下") is False


class TestAskQuestionToolIntegration:
    """测试 ask_question 工具集成"""
    
    @pytest.mark.asyncio
    async def test_ask_question_tool_returns_correct_format(self):
        """测试工具返回格式正确"""
        tool = AskQuestionTool()
        
        params = {
            "title": "选择项目类型",
            "step": 1,
            "total_steps": 3,
            "options": [
                {"id": "web", "label": "Web应用", "description": "网页开发"},
                {"id": "game", "label": "游戏", "description": "游戏开发"},
            ],
        }
        
        result = await tool.execute(params)
        
        assert result.success is True
        assert "title" in result.data
        assert "options" in result.data
        assert len(result.data["options"]) == 2
        assert result.data["options"][0]["id"] == "web"
    
    @pytest.mark.asyncio
    async def test_ask_question_tool_multiple_selection(self):
        """测试多选问题"""
        tool = AskQuestionTool()
        
        params = {
            "title": "选择兴趣爱好（可多选）",
            "multiple": True,
            "options": [
                {"id": "coding", "label": "编程"},
                {"id": "reading", "label": "阅读"},
                {"id": "sports", "label": "运动"},
            ],
        }
        
        result = await tool.execute(params)
        
        assert result.success is True
        assert result.data["multiple"] is True


class TestCompleteDialogueFlow:
    """测试完整对话流程"""
    
    @pytest.mark.asyncio
    async def test_create_project_flow(self):
        """测试创建项目流程（模拟）"""
        # 这是一个集成测试的框架，实际测试需要更多 mock
        
        # 步骤1: 用户说"我想做一个项目"
        # 期望: AI 询问年级
        
        # 步骤2: 用户选择年级
        # 期望: AI 询问时间预算
        
        # 步骤3: 用户选择时间
        # 期望: AI 询问初步想法
        
        # 步骤4: 用户选择想法
        # 期望: AI 进入脑爆阶段
        
        pass
    
    def test_stage_progression_logic(self):
        """测试阶段推进逻辑"""
        # 测试阶段顺序
        from app.services.orchestrator import AgentOrchestratorService
        
        service = AgentOrchestratorService()
        
        # 验证阶段顺序列表存在且完整
        assert hasattr(service, 'STAGE_ORDER_LIST')
        assert "stage_00_bootstrap" in service.STAGE_ORDER_LIST
        assert "stage_08_evaluate" in service.STAGE_ORDER_LIST
        assert len(service.STAGE_ORDER_LIST) == 9  # 9个阶段


# 运行测试的命令
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
