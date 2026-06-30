"""
Agent 问题模板回退测试

用途：验证当 LLM 没有返回结构化 question 时，会从 stem-pbl-guide 的标准模板补发当前缺失的问题
维护者：AI Agent
links: .trae/documents/testing/
"""

from pathlib import Path
from types import SimpleNamespace

from app.schemas.agent import AgentChatRequest
from app.services.orchestrator import AgentOrchestratorService
from app.services.skill_registry import DynamicSkillDefinition
from app.services.skill_loader import LoadedSkill, SkillLoader, SkillManifest, SubSkillDef


BOOTSTRAP_STAGE_CONTENT = """
#### 第 1 轮：询问年级
<question type="single" title="你现在是哪个年级？" step="1" total_steps="3">
  <option id="junior" label="初中（7-9年级）">我会用更简单易懂的方式引导你</option>
  <option id="senior" label="高中（10-12年级）">我们可以深入探讨技术细节</option>
</question>

#### 第 2 轮：询问时间预算
<question type="single" title="你打算花多长时间完成？" step="2" total_steps="3">
  <option id="2h" label="2小时">做一个超简单的MVP，快速体验</option>
  <option id="6h" label="6小时">做一个完整的小项目</option>
  <option id="12h" label="12小时+">做一个有挑战性的项目</option>
</question>

#### 第 3 轮：询问初始想法
<question type="single" title="你有初步想法了吗？" step="3" total_steps="3">
  <option id="brainstorm" label="完全没想法，需要脑爆">从零开始，一起探索</option>
  <option id="direction" label="有个大概方向">我知道想做什么类型</option>
  <option id="idea" label="已经有具体想法">直接立项开干</option>
</question>
"""


def _build_skill() -> LoadedSkill:
    return LoadedSkill(
        manifest=SkillManifest(
            skill_id="stem-pbl-guide",
            name="stem-pbl-guide",
            description="PBL 引导",
        ),
        full_content="",
        base_system_prompt="",
        stages={
            "stage_00_bootstrap": SubSkillDef(
                stage_id="stage_00_bootstrap",
                name="项目初始化",
                description="",
                triggers=[],
                output_artifacts=[],
                gate_conditions=[],
                ask_user_questions=[],
                content=BOOTSTRAP_STAGE_CONTENT,
            )
        },
        triggers=[],
        resource_libraries={},
        templates={},
        state_machine_spec={},
    )


def test_generate_skill_template_question_returns_time_budget_question():
    service = AgentOrchestratorService()
    skill = _build_skill()
    req = AgentChatRequest(
        message="[选择] 你现在是哪个年级？\n回答：初中（7-9年级）",
        messages=[
            {"role": "user", "content": "我想做一个项目"},
            {"role": "assistant", "content": "先告诉我，你现在是哪个年级？"},
        ],
        context={"current_stage": "stage_01_brainstorm"},
        skill_id="stem-pbl-guide",
        enable_tools=True,
    )

    question = service._generate_skill_template_question(skill, req)

    assert question is not None
    assert question["title"] == "你打算花多长时间完成？"
    assert len(question["options"]) == 3
    assert question["step"] == 2


def test_generate_skill_template_question_returns_idea_question_after_time_budget():
    service = AgentOrchestratorService()
    skill = _build_skill()
    req = AgentChatRequest(
        message="[选择] 你打算花多长时间完成？\n回答：2小时",
        messages=[
            {"role": "user", "content": "我想做一个项目"},
            {"role": "assistant", "content": "先告诉我，你现在是哪个年级？"},
            {"role": "user", "content": "[选择] 你现在是哪个年级？\n回答：初中（7-9年级）"},
        ],
        context={"current_stage": "stage_01_brainstorm"},
        skill_id="stem-pbl-guide",
        enable_tools=True,
    )

    question = service._generate_skill_template_question(skill, req)

    assert question is not None
    assert question["title"] == "你有初步想法了吗？"
    assert {item["label"] for item in question["options"]} >= {"完全没想法，需要脑爆", "有个大概方向", "已经有具体想法"}


def test_generate_skill_template_question_ignores_generic_project_name(monkeypatch):
    service = AgentOrchestratorService()
    skill = _build_skill()
    monkeypatch.setattr(
        "app.services.orchestrator.db.get_project",
        lambda _project_id: SimpleNamespace(name="我想做一个项目，帮我选题和规划"),
    )
    req = AgentChatRequest(
        message="[选择] 你打算花多长时间完成？\n回答：2小时",
        messages=[
            {"role": "user", "content": "我想做一个项目"},
            {"role": "assistant", "content": "先告诉我，你现在是哪个年级？"},
            {"role": "user", "content": "[选择] 你现在是哪个年级？\n回答：初中（7-9年级）"},
        ],
        project_id="project-generic-name",
        context={"current_stage": "stage_01_brainstorm"},
        skill_id="stem-pbl-guide",
        enable_tools=True,
    )

    question = service._generate_skill_template_question(skill, req)

    assert question is not None
    assert question["title"] == "你有初步想法了吗？"


def test_generate_skill_template_question_ignores_assistant_mvp_narration():
    service = AgentOrchestratorService()
    skill = _build_skill()
    req = AgentChatRequest(
        message="[选择] 你打算花多长时间完成？\n回答：2小时",
        messages=[
            {"role": "user", "content": "我想做一个项目"},
            {"role": "assistant", "content": "先告诉我，你现在是哪个年级？"},
            {"role": "user", "content": "[选择] 你现在是哪个年级？\n回答：初中（7-9年级）"},
            {
                "role": "assistant",
                "content": "2小时挑战！我们做一个超简单的MVP，让你快速体验到从0到1的成就感。最后一个问题：",
            },
        ],
        context={"current_stage": "stage_01_brainstorm"},
        skill_id="stem-pbl-guide",
        enable_tools=True,
    )

    question = service._generate_skill_template_question(skill, req)

    assert question is not None
    assert question["title"] == "你有初步想法了吗？"


def test_skill_loader_preserves_stage_00_bootstrap_key():
    project_root = Path(__file__).resolve().parents[3]
    skill_path = project_root / ".trae" / "skills" / "stem-pbl-guide" / "SKILL.md"
    loader = SkillLoader()

    loaded = loader.load_skill(skill_path)

    assert loaded is not None
    assert "stage_00_bootstrap" in loaded.stages


def test_generate_skill_template_question_accepts_dynamic_skill_definition():
    service = AgentOrchestratorService()
    dynamic_skill = DynamicSkillDefinition(_build_skill())
    req = AgentChatRequest(
        message="[选择] 你打算花多长时间完成？\n回答：2小时",
        messages=[
            {"role": "user", "content": "我想做一个项目"},
            {"role": "assistant", "content": "先告诉我，你现在是哪个年级？"},
            {"role": "user", "content": "[选择] 你现在是哪个年级？\n回答：初中（7-9年级）"},
        ],
        context={"current_stage": "stage_01_brainstorm"},
        skill_id="stem-pbl-guide",
        enable_tools=True,
    )

    question = service._generate_skill_template_question(dynamic_skill, req)

    assert question is not None
    assert question["title"] == "你有初步想法了吗？"
