"""
stage_constants 门禁单元测试（2026-07-22 测试体系重构）

覆盖本次重构的核心门禁逻辑：
- can_advance_to（禁止跨阶段跳 / 禁止回退）
- artifact_stage_gate（工件写入门禁）
- is_code_allowed_stage（代码阶段锁）
- stage_index / 常量完整性

这是 PBL 流程正确性的基石——任何阶段推进/工件写入都必须经过这些函数。
"""
from __future__ import annotations

import pytest

from app.services.stage_constants import (
    ARTIFACT_FOR_STAGE,
    ARTIFACT_TO_BLOB_KEY,
    ARTIFACT_TO_FILENAME,
    ARTIFACT_TO_STAGE,
    CODE_ALLOWED_STAGES,
    LIGHT_STAGE_ORDER,
    STAGE_DISPLAY_NAMES,
    STAGE_ORDER,
    artifact_stage_gate,
    can_advance_to,
    is_code_allowed_stage,
    stage_index,
)


class TestStageOrderConstants:
    """阶段顺序常量完整性。"""

    def test_stage_order_has_9_stages(self):
        assert len(STAGE_ORDER) == 9
        assert STAGE_ORDER[0] == "stage_00_bootstrap"
        assert STAGE_ORDER[-1] == "stage_08_evaluate"

    def test_light_order_has_3_steps(self):
        assert LIGHT_STAGE_ORDER == ["step_1", "step_2", "step_3"]

    def test_stage_index(self):
        assert stage_index("stage_00_bootstrap") == 0
        assert stage_index("stage_05_design") == 5
        assert stage_index("stage_08_evaluate") == 8
        assert stage_index("unknown_stage") == -1

    def test_display_names_cover_all_stages(self):
        for stage in STAGE_ORDER:
            assert stage in STAGE_DISPLAY_NAMES, f"{stage} 缺少中文名"

    def test_artifact_mappings_consistent(self):
        """ARTIFACT_FOR_STAGE / TO_BLOB_KEY / TO_FILENAME 三表键一致。"""
        blob_keys = set(ARTIFACT_TO_BLOB_KEY.keys())
        filename_keys = set(ARTIFACT_TO_FILENAME.keys())
        assert blob_keys == filename_keys, "blob_key 和 filename 映射键不一致"
        artifacts_in_stage = {v for v in ARTIFACT_FOR_STAGE.values() if v is not None}
        assert artifacts_in_stage == blob_keys, "FOR_STAGE 和 BLOB_KEY 键不一致"

    def test_artifact_to_stage_reverse_mapping(self):
        """ARTIFACT_TO_STAGE 是 ARTIFACT_FOR_STAGE 的反向映射。"""
        for stage, artifact in ARTIFACT_FOR_STAGE.items():
            if artifact is None:
                continue
            assert ARTIFACT_TO_STAGE[artifact] == stage


class TestCanAdvanceTo:
    """can_advance_to：阶段推进合法性（修复跨阶段跳漏洞）。"""

    def test_next_stage_allowed(self):
        assert can_advance_to("stage_01_brainstorm", "stage_02_brief") is True
        assert can_advance_to("stage_00_bootstrap", "stage_01_brainstorm") is True
        assert can_advance_to("stage_07_execute", "stage_08_evaluate") is True

    def test_skip_multiple_stages_blocked(self):
        """核心修复：禁止跨阶段跳（如 stage_01 直接跳 stage_08）。"""
        assert can_advance_to("stage_01_brainstorm", "stage_08_evaluate") is False
        assert can_advance_to("stage_00_bootstrap", "stage_05_design") is False
        assert can_advance_to("stage_02_brief", "stage_04_track") is False

    def test_backward_blocked(self):
        """禁止回退。"""
        assert can_advance_to("stage_03_constraints", "stage_02_brief") is False
        assert can_advance_to("stage_08_evaluate", "stage_00_bootstrap") is False

    def test_same_stage_blocked(self):
        """禁止停留在当前阶段。"""
        assert can_advance_to("stage_03_constraints", "stage_03_constraints") is False

    def test_unknown_stage_blocked(self):
        assert can_advance_to("stage_01_brainstorm", "stage_99_unknown") is False
        assert can_advance_to("unknown", "stage_02_brief") is False

    def test_from_last_stage_nowhere_to_go(self):
        """stage_08 是终点，不能再推进。"""
        assert can_advance_to("stage_08_evaluate", "stage_08_evaluate") is False


class TestArtifactStageGate:
    """artifact_stage_gate：工件写入门禁（防止越权写后续阶段工件）。"""

    def test_write_current_stage_artifact_allowed(self):
        allowed, reason = artifact_stage_gate("brainstorm", "stage_01_brainstorm")
        assert allowed is True
        assert reason == ""

    def test_write_later_stage_artifact_blocked(self):
        """stage_01 时不能写 stage_08 的 evaluate。"""
        allowed, reason = artifact_stage_gate("evaluate", "stage_01_brainstorm")
        assert allowed is False
        assert "stage_08" in reason
        assert "stage_01" in reason

    def test_write_earlier_stage_artifact_allowed(self):
        """stage_05 时可以补写 stage_01 的 brainstorm（允许回填）。"""
        allowed, reason = artifact_stage_gate("brainstorm", "stage_05_design")
        assert allowed is True

    def test_write_exact_stage_artifact_allowed(self):
        allowed, _ = artifact_stage_gate("design", "stage_05_design")
        assert allowed is True

    def test_unknown_artifact_allowed(self):
        """未知工件不在门禁范围（由 artifact_writer 自身处理）。"""
        allowed, reason = artifact_stage_gate("nonexistent_artifact", "stage_01_brainstorm")
        assert allowed is True

    def test_unknown_stage_allowed(self):
        """未知阶段（如轻项目 step_1）放行，由其他逻辑兜底。"""
        allowed, _ = artifact_stage_gate("brainstorm", "step_1")
        assert allowed is True

    def test_each_artifact_has_gate(self):
        """每个已知工件都有对应的门禁判定。"""
        for artifact_name in ARTIFACT_TO_BLOB_KEY:
            required_stage = ARTIFACT_TO_STAGE[artifact_name]
            req_idx = stage_index(required_stage)
            # 在 required_stage 写自己应该允许
            allowed, _ = artifact_stage_gate(artifact_name, required_stage)
            assert allowed, f"{artifact_name} 在所属阶段 {required_stage} 应允许写入"
            # 在 required_stage 前一阶段写应该禁止
            if req_idx > 0:
                prev_stage = STAGE_ORDER[req_idx - 1]
                allowed, _ = artifact_stage_gate(artifact_name, prev_stage)
                assert not allowed, f"{artifact_name} 在 {prev_stage} 不应允许写入"


class TestCodeAllowedStages:
    """is_code_allowed_stage：阶段代码锁。"""

    def test_design_stage_allows_code(self):
        assert is_code_allowed_stage("stage_05_design") is True

    def test_execute_stage_allows_code(self):
        assert is_code_allowed_stage("stage_07_execute") is True

    def test_evaluate_stage_allows_code(self):
        assert is_code_allowed_stage("stage_08_evaluate") is True

    @pytest.mark.parametrize("stage", [
        "stage_00_bootstrap",
        "stage_01_brainstorm",
        "stage_02_brief",
        "stage_03_constraints",
        "stage_04_track",
        "stage_06_step_plan",
    ])
    def test_non_code_stages_block_code(self, stage):
        """脑爆/开题/范围/轨道/计划阶段禁止出代码。"""
        assert is_code_allowed_stage(stage) is False

    def test_code_allowed_set_has_exactly_3(self):
        assert len(CODE_ALLOWED_STAGES) == 3
