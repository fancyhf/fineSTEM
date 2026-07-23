"""
check_gate 结构校验单元测试（2026-07-22 测试体系重构）

覆盖 pbl_engine.check_gate 的双层门禁：
- 第 1 道硬门禁：工件必须非空
- 第 2 道软门禁：JSON 工件的结构校验（返回精确 missing 清单）
- markdown 工件跳过结构校验
- 未知阶段处理
"""
from __future__ import annotations

import pytest

from app.services.pbl_engine import check_gate


class TestCheckGateHardGate:
    """第 1 道硬门禁：工件非空检查。"""

    def test_bootstrap_always_passes(self):
        passed, missing = check_gate("stage_00_bootstrap", {})
        assert passed is True
        assert missing == []

    def test_empty_data_blocked(self):
        passed, missing = check_gate("stage_01_brainstorm", {})
        assert passed is False
        assert len(missing) > 0
        assert "brainstorm" in missing[0] or "brainstorm_content" in missing[0]

    def test_none_data_blocked(self):
        passed, _ = check_gate("stage_02_brief", None)
        assert passed is False

    def test_empty_string_blocked(self):
        passed, _ = check_gate("stage_01_brainstorm", {"brainstorm_content": ""})
        assert passed is False

    def test_whitespace_only_blocked(self):
        passed, _ = check_gate("stage_01_brainstorm", {"brainstorm_content": "   \n  "})
        assert passed is False

    def test_non_empty_string_passes(self):
        passed, _ = check_gate("stage_01_brainstorm", {"brainstorm_content": "# 脑爆记录\n候选题1"})
        assert passed is True

    def test_json_string_data_passes(self):
        passed, _ = check_gate("stage_02_brief", {"brief_content": '{"title":"测试"}'})
        assert passed is True

    def test_unknown_stage_with_artifact_passes(self):
        """未知阶段（无 artifact 要求）放行。"""
        passed, _ = check_gate("stage_99_unknown", {})
        assert passed is True


class TestCheckGateStructuralCheck:
    """第 2 道软门禁：JSON 工件的结构校验（返回 missing 但不拦截）。"""

    def test_complete_json_passes_with_no_missing(self):
        """完整的 brief JSON 应该通过且无 missing。"""
        complete_brief = {
            "title": "我的项目",
            "success_criteria": ["能运行", "能展示"],
            "risks": ["时间不够", "技术不熟"],
        }
        passed, missing = check_gate("stage_02_brief", {"brief_content": __import__("json").dumps(complete_brief)})
        assert passed is True
        assert missing == []

    def test_brief_missing_success_criteria_reported(self):
        """brief 缺 success_criteria 时，missing 里有提示。"""
        incomplete = {"title": "x", "risks": ["r1", "r2"]}
        import json
        passed, missing = check_gate("stage_02_brief", {"brief_content": json.dumps(incomplete)})
        assert passed is True  # 软门禁不拦截
        assert any("success_criteria" in m for m in missing)

    def test_brief_missing_risks_reported(self):
        incomplete = {"title": "x", "success_criteria": ["s1"]}
        import json
        _, missing = check_gate("stage_02_brief", {"brief_content": json.dumps(incomplete)})
        assert any("risks" in m for m in missing)

    def test_constraints_missing_fields_reported(self):
        incomplete = {"must_have": ["m1"]}  # 缺 wont_do
        import json
        _, missing = check_gate("stage_03_constraints", {"constraints_content": json.dumps(incomplete)})
        assert any("wont_do" in m for m in missing)

    def test_constraints_empty_lists_reported(self):
        """空列表也算缺失。"""
        empty = {"must_have": [], "wont_do": []}
        import json
        _, missing = check_gate("stage_03_constraints", {"constraints_content": json.dumps(empty)})
        assert any("must_have" in m for m in missing)
        assert any("wont_do" in m for m in missing)

    def test_markdown_artifact_skips_structural_check(self):
        """brainstorm / dev_log 是 markdown，跳过结构校验。"""
        passed, missing = check_gate("stage_01_brainstorm", {"brainstorm_content": "# 纯文本脑爆"})
        assert passed is True
        assert missing == []

    def test_non_json_artifact_skips_structural_check(self):
        """看起来不像 JSON 的内容跳过结构校验。"""
        passed, missing = check_gate("stage_02_brief", {"brief_content": "# 开题报告（markdown）"})
        assert passed is True
        assert missing == []

    def test_design_missing_acceptance_criteria(self):
        incomplete = {"ui_design": "描述"}
        import json
        _, missing = check_gate("stage_05_design", {"design_content": json.dumps(incomplete)})
        assert any("acceptance_criteria" in m for m in missing)

    def test_evaluate_missing_reflections(self):
        incomplete = {"acceptance_results": [{"criterion": "x", "passed": True}]}
        import json
        _, missing = check_gate("stage_08_evaluate", {"evaluate_content": json.dumps(incomplete)})
        assert any("reflections" in m for m in missing)

    def test_malformed_json_does_not_crash(self):
        """坏的 JSON 不应该让 check_gate 崩溃。"""
        passed, missing = check_gate("stage_02_brief", {"brief_content": "{这不是合法JSON"})
        # 非空所以通过硬门禁；结构校验吞掉异常返回空
        assert passed is True
        assert isinstance(missing, list)


class TestCheckGateAllStages:
    """每个阶段都能正确判定（冒烟覆盖）。"""

    @pytest.mark.parametrize("stage,artifact_name", [
        ("stage_01_brainstorm", "brainstorm"),
        ("stage_02_brief", "project_brief"),
        ("stage_03_constraints", "constraints"),
        ("stage_04_track", "track_plan"),
        ("stage_05_design", "design"),
        ("stage_06_step_plan", "step_plan"),
        ("stage_07_execute", "dev_log"),
        ("stage_08_evaluate", "evaluate"),
    ])
    def test_stage_blocks_when_empty(self, stage, artifact_name):
        from app.services.stage_constants import ARTIFACT_TO_BLOB_KEY
        blob_key = ARTIFACT_TO_BLOB_KEY[artifact_name]
        passed, _ = check_gate(stage, {})
        assert not passed, f"{stage} 在 {blob_key} 为空时应该被拦截"

    @pytest.mark.parametrize("stage,artifact_name", [
        ("stage_01_brainstorm", "brainstorm"),
        ("stage_07_execute", "dev_log"),
    ])
    def test_stage_passes_when_filled(self, stage, artifact_name):
        from app.services.stage_constants import ARTIFACT_TO_BLOB_KEY
        blob_key = ARTIFACT_TO_BLOB_KEY[artifact_name]
        passed, _ = check_gate(stage, {blob_key: "# 内容"})
        assert passed
