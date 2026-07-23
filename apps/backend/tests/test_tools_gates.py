"""
后端工具门禁单元测试（2026-07-22 测试体系重构）

覆盖本次重构修复的 4 个工具层漏洞：
- SkillStateWriterTool 白名单（禁止写 current_stage / standard_step_data）
- EvidenceSaverTool type 枚举映射（修复 pydantic 崩溃）
- ArtifactWriterTool 阶段门禁（防越权写后续工件）
- AchievementCardTool 阶段门禁（仅 stage_08）
- StageAdvancerTool target_stage 门禁（禁止跨阶段跳）

这些工具通过 ZeroClaw MCP 暴露给 AI，是 PBL 流程正确性的运行时保障。
"""
from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from app.services.tools import (
    AchievementCardTool,
    ArtifactWriterTool,
    EvidenceSaverTool,
    SkillStateWriterTool,
    StageAdvancerTool,
)


# ── SkillStateWriterTool 白名单 ────────────────────────────────

class TestSkillStateWriterWhitelist:
    """skill_state_writer 字段白名单（修复绕门禁漏洞）。"""

    @pytest.mark.asyncio
    async def test_block_writing_current_stage(self):
        """核心：禁止直接写 current_stage（必须走 stage_advancer）。"""
        tool = SkillStateWriterTool()
        result = await tool.execute({"project_id": "p1", "updates": {"current_stage": "stage_08_evaluate"}})
        assert not result.success
        assert "受保护字段" in result.error
        assert "current_stage" in result.error

    @pytest.mark.asyncio
    async def test_block_writing_standard_step_data(self):
        """禁止直接写 standard_step_data（必须走 artifact_writer）。"""
        tool = SkillStateWriterTool()
        result = await tool.execute({"project_id": "p1", "updates": {"standard_step_data": {"x": 1}}})
        assert not result.success
        assert "standard_step_data" in result.error

    @pytest.mark.asyncio
    async def test_block_writing_stages(self):
        tool = SkillStateWriterTool()
        result = await tool.execute({"project_id": "p1", "updates": {"stages": {}}})
        assert not result.success

    @pytest.mark.asyncio
    async def test_allow_writing_metadata(self):
        """metadata（教学模式等）允许写入。"""
        tool = SkillStateWriterTool()
        with patch("app.services.tools.db") as mock_db:
            mock_db.update_skill_state.return_value = True
            result = await tool.execute({"project_id": "p1", "updates": {"metadata": {"teachingMode": "guided"}}})
        assert result.success
        assert "metadata" in result.data["updated_fields"]

    @pytest.mark.asyncio
    async def test_allow_writing_stage_history(self):
        """history_entry 会被合并到 updates，最终写 stage_history 字段。"""
        tool = SkillStateWriterTool()
        with patch("app.services.tools.db") as mock_db:
            mock_state = type("S", (), {"stage_history": []})()
            mock_db.get_skill_state.return_value = mock_state
            mock_db.update_skill_state.return_value = True
            # updates 必须非空（白名单只含 stage_history，这里给个占位触发 history_entry 逻辑）
            result = await tool.execute({
                "project_id": "p1",
                "updates": {"stage_history": []},  # 占位，触发非空检查
                "history_entry": {"action": "test"},
            })
        assert result.success
        assert "stage_history" in result.data["updated_fields"]

    @pytest.mark.asyncio
    async def test_block_mixed_fields_reports_all_blocked(self):
        """混合字段时，报告所有受保护字段。"""
        tool = SkillStateWriterTool()
        result = await tool.execute({
            "project_id": "p1",
            "updates": {"current_stage": "x", "standard_step_data": {}, "metadata": {}},
        })
        assert not result.success
        blocked = result.data["blocked_fields"]
        assert "current_stage" in blocked
        assert "standard_step_data" in blocked
        assert "metadata" not in blocked


# ── EvidenceSaverTool type 映射 ────────────────────────────────

class TestEvidenceTypeMapping:
    """Evidence type 枚举映射（修复 pydantic 校验崩溃）。"""

    def test_alias_map_covers_legacy_types(self):
        tool = EvidenceSaverTool()
        # 原来声明的类型必须都映射到合法值
        assert tool.TYPE_ALIAS_MAP["code"] == "code_snapshot"
        assert tool.TYPE_ALIAS_MAP["dialogue_summary"] == "auto_ai_summary"
        assert tool.TYPE_ALIAS_MAP["run_result"] == "text_log"
        assert tool.TYPE_ALIAS_MAP["screenshot"] == "screenshot"

    def test_alias_map_values_all_legal(self):
        """所有映射目标都必须是 Evidence 模型的合法 type。"""
        from app.schemas.evidence import EvidenceBase
        legal_types = set(EvidenceBase.model_fields["type"].annotation.__args__)
        tool = EvidenceSaverTool()
        for mapped in tool.TYPE_ALIAS_MAP.values():
            assert mapped in legal_types, f"{mapped} 不是合法 Evidence type"

    @pytest.mark.asyncio
    async def test_code_type_mapped_successfully(self):
        """传 'code' 不再崩溃，映射成 code_snapshot。"""
        tool = EvidenceSaverTool()
        with patch("app.services.tools.db") as mock_db:
            mock_project = type("P", (), {"author_id": "u1", "current_stage": "stage_01_brainstorm"})()
            mock_db.get_project.return_value = mock_project
            created = type("E", (), {"id": "ev1"})()
            mock_db.create_evidence.return_value = created
            result = await tool.execute({
                "project_id": "p1",
                "type": "code",
                "title": "测试代码",
                "content": "print('hi')",
            })
        assert result.success
        assert result.data["evidence_id"] == "ev1"

    @pytest.mark.asyncio
    async def test_invalid_type_rejected(self):
        tool = EvidenceSaverTool()
        result = await tool.execute({
            "project_id": "p1",
            "type": "invalid_type",
            "title": "x",
            "content": "x",
        })
        assert not result.success
        assert "无效的证据类型" in result.error


# ── ArtifactWriterTool 阶段门禁 ────────────────────────────────

class TestArtifactWriterGate:
    """artifact_writer 阶段门禁（防越权写后续工件）。"""

    @pytest.mark.asyncio
    async def test_block_writing_future_artifact(self):
        """stage_01 时不能写 evaluate 工件。"""
        tool = ArtifactWriterTool()
        with patch("app.services.tools.db") as mock_db:
            mock_state = type("S", (), {"current_stage": "stage_01_brainstorm"})()
            mock_db.get_skill_state.return_value = mock_state
            result = await tool.execute({
                "project_id": "p1",
                "artifact_name": "evaluate",
                "content": "验收内容",
            })
        assert not result.success
        assert "阶段门禁拦截" in result.error

    @pytest.mark.asyncio
    async def test_allow_writing_current_stage_artifact(self):
        """stage_01 时可以写 brainstorm。"""
        tool = ArtifactWriterTool()
        with patch("app.services.tools.db") as mock_db:
            mock_state = type("S", (), {"current_stage": "stage_01_brainstorm", "standard_step_data": {}})()
            mock_db.get_skill_state.return_value = mock_state
            mock_db.update_skill_state.return_value = True
            mock_db.get_project.return_value = type("P", (), {"name": "test"})()
            result = await tool.execute({
                "project_id": "p1",
                "artifact_name": "brainstorm",
                "content": "# 脑爆记录",
            })
        assert result.success

    @pytest.mark.asyncio
    async def test_missing_params_rejected(self):
        tool = ArtifactWriterTool()
        result = await tool.execute({"project_id": "p1", "artifact_name": "brainstorm"})
        assert not result.success

    @pytest.mark.asyncio
    async def test_unknown_artifact_rejected(self):
        tool = ArtifactWriterTool()
        with patch("app.services.tools.db") as mock_db:
            mock_state = type("S", (), {"current_stage": "stage_01_brainstorm"})()
            mock_db.get_skill_state.return_value = mock_state
            result = await tool.execute({
                "project_id": "p1",
                "artifact_name": "nonexistent",
                "content": "x",
            })
        assert not result.success


# ── AchievementCardTool 阶段门禁 ───────────────────────────────

class TestAchievementCardGate:
    """achievement_card 阶段门禁（仅 stage_08）。"""

    @pytest.mark.asyncio
    async def test_block_before_stage_08(self):
        """stage_07 时不能生成成果档案卡。"""
        tool = AchievementCardTool()
        with patch("app.services.tools.db") as mock_db:
            mock_state = type("S", (), {"current_stage": "stage_07_execute"})()
            mock_db.get_skill_state.return_value = mock_state
            result = await tool.execute({
                "project_id": "p1",
                "title": "成果卡",
                "one_liner": "一句话",
                "problem_solved": "解决了问题",
                "method_used": "用了方法",
                "reflection": "反思",
            })
        assert not result.success
        assert "stage_08_evaluate" in result.error

    @pytest.mark.asyncio
    async def test_block_early_stage(self):
        tool = AchievementCardTool()
        with patch("app.services.tools.db") as mock_db:
            mock_state = type("S", (), {"current_stage": "stage_01_brainstorm"})()
            mock_db.get_skill_state.return_value = mock_state
            result = await tool.execute({
                "project_id": "p1",
                "title": "x", "one_liner": "x", "problem_solved": "x",
                "method_used": "x", "reflection": "x",
            })
        assert not result.success

    @pytest.mark.asyncio
    async def test_missing_params_rejected(self):
        tool = AchievementCardTool()
        result = await tool.execute({"project_id": "p1", "title": "only title"})
        assert not result.success
        assert "缺少必填参数" in result.error


# ── StageAdvancerTool target_stage 门禁 ────────────────────────

class TestStageAdvancerTargetGate:
    """stage_advancer 的 target_stage 门禁（修复跨阶段跳漏洞）。"""

    @pytest.mark.asyncio
    async def test_block_skip_to_final_stage(self):
        """核心：stage_01 不能直接跳 stage_08。"""
        tool = StageAdvancerTool()
        with patch("app.services.tools.db") as mock_db:
            mock_state = type("S", (), {
                "current_stage": "stage_01_brainstorm",
                "mode": "standard",
                "standard_step_data": {},
            })()
            mock_db.get_skill_state.return_value = mock_state
            result = await tool.execute({
                "project_id": "p1",
                "target_stage": "stage_08_evaluate",
            })
        assert not result.success
        assert "跨阶段" in result.error or "下一阶段" in result.error

    @pytest.mark.asyncio
    async def test_block_backward_target(self):
        tool = StageAdvancerTool()
        with patch("app.services.tools.db") as mock_db:
            mock_state = type("S", (), {
                "current_stage": "stage_05_design",
                "mode": "standard",
                "standard_step_data": {},
            })()
            mock_db.get_skill_state.return_value = mock_state
            result = await tool.execute({
                "project_id": "p1",
                "target_stage": "stage_01_brainstorm",
            })
        assert not result.success

    @pytest.mark.asyncio
    async def test_missing_project_id(self):
        tool = StageAdvancerTool()
        result = await tool.execute({})
        assert not result.success
        assert "project_id" in result.error
