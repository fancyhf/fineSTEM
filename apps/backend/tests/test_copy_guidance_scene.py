"""
copy_project_guidance 场景 prompt 双链路一致性测试（MVP2 P0-09）。

覆盖：
- 主链路：`zeroclaw_provider.SCENE_SYSTEM_PROMPTS["copy_project_guidance"]` 存在
  且包含关键工具调用顺序约束（skill_state_reader/project_code_reader/
  copy_guidance_verifier/ask_question/evidence_saver）。
- 回退链路：`AgentOrchestratorService._build_scene_instruction` 在 scene 命中
  `copy_project_guidance` 时返回统一常量文本。
- 两处文本一致（均基于同一 `COPY_PROJECT_GUIDANCE_PROMPT` 常量）。
- 教学模式提示（guided / demo / hands_on / lecture）内嵌于 prompt（P0-06）。
"""
from __future__ import annotations

from app.schemas.agent import AgentChatRequest
from app.services.copy_guidance_scene import (
    COPY_PROJECT_GUIDANCE_PROMPT,
    COPY_PROJECT_GUIDANCE_SCENE_KEY,
)
from app.services.orchestrator import AgentOrchestratorService
from app.services.providers.zeroclaw_provider import SCENE_SYSTEM_PROMPTS


class TestSceneSystemPrompts:
    """主链路：SCENE_SYSTEM_PROMPTS 注册 & 内容校验。"""

    def test_scene_key_present(self):
        assert COPY_PROJECT_GUIDANCE_SCENE_KEY == "copy_project_guidance"
        assert COPY_PROJECT_GUIDANCE_SCENE_KEY in SCENE_SYSTEM_PROMPTS

    def test_scene_prompt_contains_core_tools(self):
        text = SCENE_SYSTEM_PROMPTS[COPY_PROJECT_GUIDANCE_SCENE_KEY]
        for token in [
            "skill_state_reader",
            "project_code_reader",
            "copy_guidance_verifier",
            "ask_question",
            "evidence_saver",
        ]:
            assert token in text, f"主链路场景 prompt 缺少工具引用: {token}"

    def test_scene_prompt_contains_ordering_hints(self):
        text = SCENE_SYSTEM_PROMPTS[COPY_PROJECT_GUIDANCE_SCENE_KEY]
        # 关键约束文本
        assert "一次只" in text
        assert "auto_passed" in text

    def test_scene_prompt_contains_all_four_teaching_modes(self):
        """P0-06：教学模式作为场景 prompt 的一部分内嵌，覆盖 4 种模式。"""
        text = SCENE_SYSTEM_PROMPTS[COPY_PROJECT_GUIDANCE_SCENE_KEY]
        for mode in ["guided", "demo", "hands_on", "lecture"]:
            assert mode in text, f"教学模式缺失: {mode}"
        assert "teachingMode" in text


class TestOrchestratorFallback:
    """回退链路：_build_scene_instruction 返回同一常量。"""

    def _make_request(self, scene: str) -> AgentChatRequest:
        return AgentChatRequest(
            message="开始",
            project_id="proj_test",
            context={"scene": scene},
        )

    def test_fallback_returns_copy_guidance_prompt(self):
        req = self._make_request("copy_project_guidance")
        instruction = AgentOrchestratorService._build_scene_instruction(req)
        assert instruction == COPY_PROJECT_GUIDANCE_PROMPT

    def test_fallback_returns_empty_for_unknown_scene(self):
        req = self._make_request("unrelated_scene")
        instruction = AgentOrchestratorService._build_scene_instruction(req)
        assert "copy_project_guidance" not in instruction


class TestBothPathsAligned:
    """两处链路文本一致：主链路以 STEM_SYSTEM_PROMPT + 场景 prompt 拼接，
    但都必须包含同一份 COPY_PROJECT_GUIDANCE_PROMPT。"""

    def test_main_path_includes_shared_prompt(self):
        main_text = SCENE_SYSTEM_PROMPTS[COPY_PROJECT_GUIDANCE_SCENE_KEY]
        assert COPY_PROJECT_GUIDANCE_PROMPT in main_text

    def test_fallback_equals_shared_prompt(self):
        req = AgentChatRequest(
            message="开始",
            project_id="proj_test",
            context={"scene": "copy_project_guidance"},
        )
        instruction = AgentOrchestratorService._build_scene_instruction(req)
        assert instruction == COPY_PROJECT_GUIDANCE_PROMPT


class TestScenePromptFinalization:
    """2026-08-19（Q-048）：收官链路与阶段映射规则写进场景 prompt。"""

    def test_prompt_contains_finalization_rules(self):
        text = SCENE_SYSTEM_PROMPTS[COPY_PROJECT_GUIDANCE_SCENE_KEY]
        for token in [
            "all_tasks_completed",
            "stage_advancer",
            "achievement_card",
            "step_3",
            "不得跳过询问自动推进",
        ]:
            assert token in text, f"主链路场景 prompt 缺少收官规则: {token}"

    def test_prompt_contains_stage_mapping(self):
        text = SCENE_SYSTEM_PROMPTS[COPY_PROJECT_GUIDANCE_SCENE_KEY]
        assert "阶段映射" in text
        assert "step_2" in text and "step_3" in text
        # 不重新布置任务（session completed 后再次进入）
        assert "不重新布置任务" in text
