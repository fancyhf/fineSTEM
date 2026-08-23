"""
copy_guidance_verifier 工具测试（MVP2 P0-09）。

覆盖 4 种 check 与证据保存：
- code_changed：改动/未改动
- run_success：HTML 结构完整 / 括号不配对
- content_keyword：命中 / 未命中
- card_count：条目增加 / 未增加
- evidence_saver：通过时自动保存证据
- 失败只报 first_issue + next_hint
- 非复制项目拒绝
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.services.tools import CopyGuidanceVerifierTool


def _make_demo(minimal_replica: str) -> SimpleNamespace:
    return SimpleNamespace(
        id="demo_poetry_card",
        name="诗词卡片",
        minimal_replica=minimal_replica,
    )


def _make_project(from_demo_id: str = "demo_poetry_card") -> SimpleNamespace:
    return SimpleNamespace(
        id="proj_test",
        author_id="user_test",
        from_demo_id=from_demo_id,
        current_stage="stage_07_execute",
    )


def _workspace(files: dict) -> dict:
    return {
        "code": next(iter(files.values()), ""),
        "language": "html",
        "filename": next(iter(files.keys()), "index.html"),
        "files": [
            {"name": name, "content": content, "language": "html", "is_main": True}
            for name, content in files.items()
        ],
    }


DEMO_HTML_FILES = {
    "index.html": (
        "<!doctype html><html><body><h1>原始标题</h1>"
        "<div>{name: '甲', poem: '诗一'}, {name: '乙', poem: '诗二'}</div>"
        "</body></html>"
    ),
}

DEMO_MINIMAL_REPLICA = (
    '{"entry_file":"index.html","files":{"index.html":'
    '"<!doctype html><html><body><h1>原始标题</h1>'
    '<div>{name: \'甲\', poem: \'诗一\'}, {name: \'乙\', poem: \'诗二\'}</div>'
    '</body></html>"}}'
)


class TestVerifierNonCopyProject:
    """非复制项目应被拒绝。"""

    @pytest.mark.asyncio
    async def test_rejects_project_without_from_demo(self):
        tool = CopyGuidanceVerifierTool()
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project(from_demo_id=None)
            result = await tool.execute(
                {"project_id": "proj_test", "task_id": "replace_first_card"}
            )
        assert not result.success
        assert "非复制项目" in (result.error or "")


class TestVerifierMissingParams:
    @pytest.mark.asyncio
    async def test_missing_project_id(self):
        tool = CopyGuidanceVerifierTool()
        result = await tool.execute({"task_id": "replace_first_card"})
        assert not result.success
        assert "缺少必填" in result.error

    @pytest.mark.asyncio
    async def test_unknown_task_id(self):
        tool = CopyGuidanceVerifierTool()
        with patch("app.services.tools.db"):
            result = await tool.execute(
                {"project_id": "proj_test", "task_id": "not_exist"}
            )
        assert not result.success
        assert "未找到任务" in result.error


class TestCodeChangedCheck:
    @pytest.mark.asyncio
    async def test_no_change_fails(self):
        tool = CopyGuidanceVerifierTool()
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(DEMO_HTML_FILES)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "replace_first_card",
                    "claimed_changes": "杜甫",
                    "save_evidence": False,
                }
            )
        assert result.success
        data = result.data
        assert data["auto_passed"] is False
        code_check = next(d for d in data["checks_detail"] if d["check"] == "code_changed")
        assert code_check["passed"] is False
        # 只报 first_issue + next_hint
        assert data.get("first_issue")
        assert data.get("next_hint")

    @pytest.mark.asyncio
    async def test_change_passes(self):
        tool = CopyGuidanceVerifierTool()
        modified = {
            "index.html": (
                "<!doctype html><html><body><h1>杜甫诗词卡</h1>"
                "<div>{name: '杜甫', poem: '春望'}, {name: '乙', poem: '诗二'}</div>"
                "</body></html>"
            )
        }
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(modified)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "replace_first_card",
                    "claimed_changes": "杜甫,春望",
                    "save_evidence": False,
                }
            )
        assert result.success
        assert result.data["auto_passed"] is True
        assert result.data.get("evidence_saved") is False


class TestRunSuccessCheck:
    @pytest.mark.asyncio
    async def test_broken_html_fails(self):
        tool = CopyGuidanceVerifierTool()
        broken = {
            "index.html": "<!doctype html><html><body><h1>缺闭合",  # 无 </html>
        }
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(broken)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "modify_interaction",
                    "claimed_changes": "颜色",
                    "save_evidence": False,
                }
            )
        assert result.success
        detail = next(
            d for d in result.data["checks_detail"] if d["check"] == "run_success"
        )
        assert detail["passed"] is False


class TestContentKeywordCheck:
    """content_keyword 检查函数仍保留在分发器中（其他任务可引用），直接单测。

    2026-08-18：replace_first_card 不再使用 content_keyword——它依赖 AI 填写的
    claimed_changes 关键词，AI 臆造期望值（如项目名）会导致学生无限重改。
    """

    def test_keyword_missing_fails(self):
        detail = CopyGuidanceVerifierTool._check_content_keyword(
            {"index.html": "<h1>另一个标题</h1>"}, DEMO_HTML_FILES, "李白,静夜思"
        )
        assert detail["passed"] is False

    def test_keyword_hit_passes(self):
        detail = CopyGuidanceVerifierTool._check_content_keyword(
            {"index.html": "<h1>李白的诗词卡</h1>"}, DEMO_HTML_FILES, "李白"
        )
        assert detail["passed"] is True


class TestCardCountCheck:
    @pytest.mark.asyncio
    async def test_no_add_fails(self):
        """add_card_data 任务：条目数未增加 → 失败。"""
        tool = CopyGuidanceVerifierTool()
        # 与 demo 的对象数一致
        same_count = {
            "index.html": (
                "<!doctype html><html><body>"
                "<div>{name: '甲', poem: '改后'}, {name: '乙', poem: '诗二'}</div>"
                "</body></html>"
            )
        }
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(same_count)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "add_card_data",
                    "save_evidence": False,
                }
            )
        detail = next(
            d for d in result.data["checks_detail"] if d["check"] == "card_count"
        )
        assert detail["passed"] is False

    @pytest.mark.asyncio
    async def test_add_passes(self):
        tool = CopyGuidanceVerifierTool()
        added = {
            "index.html": (
                "<!doctype html><html><body>"
                "<div>{name: '甲', poem: '诗一'}, {name: '乙', poem: '诗二'}, "
                "{name: '丙', poem: '新加'}</div>"
                "</body></html>"
            )
        }
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(added)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "add_card_data",
                    "save_evidence": False,
                }
            )
        detail = next(
            d for d in result.data["checks_detail"] if d["check"] == "card_count"
        )
        assert detail["passed"] is True


class TestEvidenceSave:
    @pytest.mark.asyncio
    async def test_saves_evidence_when_passed(self):
        """全部检查通过 & save_evidence=true → 自动保存证据。"""
        tool = CopyGuidanceVerifierTool()
        modified = {
            "index.html": (
                "<!doctype html><html><body><h1>杜甫诗词卡</h1>"
                "<div>{name: '杜甫', poem: '春望'}, {name: '乙', poem: '诗二'}</div>"
                "</body></html>"
            )
        }
        created_evidences = []

        def _capture_create(evidence_item):
            created_evidences.append(evidence_item)
            return evidence_item

        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(modified)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            mock_db.create_evidence.side_effect = _capture_create
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "replace_first_card",
                    "claimed_changes": "杜甫,春望",
                    "save_evidence": True,
                }
            )
        assert result.success
        assert result.data["auto_passed"] is True
        assert result.data["evidence_saved"] is True
        assert len(created_evidences) == 1
        assert created_evidences[0].type == "auto_ai_summary"


class TestNextTaskId:
    @pytest.mark.asyncio
    async def test_next_task_id_present(self):
        """通过后应给出下一项 task_id。"""
        tool = CopyGuidanceVerifierTool()
        modified = {
            "index.html": (
                "<!doctype html><html><body><h1>杜甫诗词卡</h1>"
                "<div>{name: '杜甫', poem: '春望'}, {name: '乙', poem: '诗二'}</div>"
                "</body></html>"
            )
        }
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(modified)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "replace_first_card",
                    "claimed_changes": "杜甫,春望",
                    "save_evidence": False,
                }
            )
        assert result.data["next_task_id"] == "add_card_data"


class TestSemanticReviewSignal:
    """auto_passed=true 时后端强制返回 semantic_review_required=true，
    让 AI 端更难忽略语义复核步骤。"""

    @pytest.mark.asyncio
    async def test_passed_result_flags_semantic_review(self):
        tool = CopyGuidanceVerifierTool()
        modified = {
            "index.html": (
                "<!doctype html><html><body><h1>杜甫诗词卡</h1>"
                "<div>{name: '杜甫', poem: '春望'}, {name: '乙', poem: '诗二'}</div>"
                "</body></html>"
            )
        }
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(modified)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "replace_first_card",
                    "claimed_changes": "杜甫,春望",
                    "save_evidence": False,
                }
            )
        assert result.data["auto_passed"] is True
        assert result.data["semantic_review_required"] is True
        assert "auto_passed=true" in result.data["semantic_review_instruction"]

    @pytest.mark.asyncio
    async def test_failed_result_flags_no_semantic_review(self):
        tool = CopyGuidanceVerifierTool()
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(DEMO_HTML_FILES)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "replace_first_card",
                    "claimed_changes": "李白",
                    "save_evidence": False,
                }
            )
        assert result.data["auto_passed"] is False
        assert result.data["semantic_review_required"] is False


class TestKeywordGranularity:
    """content_keyword 关键词粒度：中文单字命中，英文<2字符不命中。

    2026-08-18：replace_first_card 已改用 visible_text_changed（不再挂
    content_keyword），这里改为直接调用检查函数验证粒度逻辑。
    """

    def test_single_char_cjk_hits(self):
        """中文 1 字关键词（如 '杜'/'甫'）应能命中，避免短姓氏漏判。"""
        modified = {"index.html": "<h1>杜甫</h1><div>{name: '杜甫', poem: '春望'}</div>"}
        detail = CopyGuidanceVerifierTool._check_content_keyword(
            modified, DEMO_HTML_FILES, "杜 甫"
        )
        assert detail["passed"] is True
        assert "杜" in detail["matched"] or "甫" in detail["matched"]

    def test_short_ascii_ignored(self):
        """英文单字符（如 'a'）不应作为关键词参与判定，避免噪声。"""
        modified = {"index.html": "<h1>Another Title</h1>"}
        detail = CopyGuidanceVerifierTool._check_content_keyword(
            modified, DEMO_HTML_FILES, "a b c"
        )
        assert detail["passed"] is False
        assert detail["keywords"] == []


class TestCardCountJsxAndArray:
    """card_count 兼容 JSX 组件与字符串数组场景。"""

    @pytest.mark.asyncio
    async def test_jsx_card_count_grows(self):
        tool = CopyGuidanceVerifierTool()
        # Demo：2 个 <PoemCard/>；改后：3 个
        demo_replica = (
            '{"entry_file":"App.tsx","files":{"App.tsx":'
            '"function App(){return(<div><PoemCard/><PoemCard/></div>);}"}}'
        )
        added = {
            "App.tsx": (
                "function App(){return(<div>"
                "<PoemCard/><PoemCard/><PoemCard/>"
                "</div>);}"
            ),
        }
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(added)
            mock_db.get_demo.return_value = _make_demo(demo_replica)
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "add_card_data",
                    "save_evidence": False,
                }
            )
        detail = next(
            d for d in result.data["checks_detail"] if d["check"] == "card_count"
        )
        assert detail["passed"] is True
        assert detail["current_count"] > detail["demo_count"]



VIDEO_DEMO_MINIMAL_REPLICA = (
    '{"entry_file":"index.html","files":{"index.html":'
    '"<!doctype html><html><head><title>词频分析器</title></head>'
    '<body><h1>词频分析器</h1></body></html>"}}'
)


class TestVisibleTextChanged:
    """2026-08-18 线上问题（项目 b9e0f446）防回归。

    学生把标题改成"词频分析器-my"（自己的个性化），AI 却要求必须改成项目名，
    content_keyword 永远不过 → 学生陷入无限重改。新检查 visible_text_changed
    的验收标准是"与 Demo 原文不同"，任何学生自己的内容（含 -my 后缀）都通过。
    """

    @pytest.mark.asyncio
    async def test_suffix_personalization_passes(self):
        tool = CopyGuidanceVerifierTool()
        modified = {
            "index.html": (
                "<!doctype html><html><head><title>词频分析器-my</title></head>"
                "<body><h1>词频分析器-my</h1></body></html>"
            )
        }
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(modified)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "replace_first_card",
                    "claimed_changes": "词频分析器-my",
                    "save_evidence": False,
                }
            )
        assert result.success
        detail = next(
            d for d in result.data["checks_detail"] if d["check"] == "visible_text_changed"
        )
        assert detail["passed"] is True
        assert result.data["auto_passed"] is True

    @pytest.mark.asyncio
    async def test_text_unchanged_fails(self):
        """只改了注释等不可见内容、标题未变 → visible_text_changed 失败。"""
        tool = CopyGuidanceVerifierTool()
        modified = {
            "index.html": (
                "<!doctype html><html><body><h1>原始标题</h1>"
                "<!-- 只改了注释 --></body></html>"
            )
        }
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(modified)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            result = await tool.execute(
                {
                    "project_id": "proj_test",
                    "task_id": "replace_first_card",
                    "save_evidence": False,
                }
            )
        detail = next(
            d for d in result.data["checks_detail"] if d["check"] == "visible_text_changed"
        )
        assert detail["passed"] is False
        assert "可见文本" in (detail.get("reason") or "")


class TestTaskOwnership:
    """共用任务 ID 的 Demo 归属解析与校验（2026-08-18）。"""

    @pytest.mark.asyncio
    async def test_video_analyzer_resolves_own_task(self):
        """demo_video_analyzer 项目 + replace_first_card 应解析到自己的任务版本。"""
        tool = CopyGuidanceVerifierTool()
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project(from_demo_id="demo_video_analyzer")
            # 未改代码：失败路径会带出任务 hint，用来证明解析到的是 video 版任务
            mock_db.get_project_workspace.return_value = _workspace(
                {"index.html": "<!doctype html><html><head><title>词频分析器</title></head><body><h1>词频分析器</h1></body></html>"}
            )
            mock_db.get_demo.return_value = _make_demo(VIDEO_DEMO_MINIMAL_REPLICA)
            result = await tool.execute(
                {"project_id": "proj_test", "task_id": "replace_first_card", "save_evidence": False}
            )
        assert result.success
        assert "不适用" not in (result.error or "")
        # video 版任务的 hint 提到 <title>；poetry 版 hint 是"页面标题和第一张卡片"
        assert "title" in (result.data.get("next_hint") or "")

    @pytest.mark.asyncio
    async def test_task_without_config_for_demo_rejected(self):
        """来源 Demo 没有配置任何任务 → 明确报错，防止套用其他 Demo 的验收标准。"""
        tool = CopyGuidanceVerifierTool()
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project(from_demo_id="demo_unknown")
            mock_db.get_project_workspace.return_value = _workspace(DEMO_HTML_FILES)
            mock_db.get_demo.return_value = None
            result = await tool.execute(
                {"project_id": "proj_test", "task_id": "replace_first_card", "save_evidence": False}
            )
        assert not result.success
        assert "不适用于来源 Demo" in (result.error or "")


class TestVideoAnalyzerTaskConfig:
    def test_five_tasks_configured(self):
        from app.services.copy_guidance_tasks import get_tasks_for_demo, get_task

        ids = [t["id"] for t in get_tasks_for_demo("demo_video_analyzer")]
        assert ids == [
            "replace_first_card",
            "add_card_data",
            "modify_interaction",
            "fix_error",
            "explain_changes",
        ]
        # 共用 ID 时按 demo 解析到不同版本
        video_task = get_task("replace_first_card", demo_id="demo_video_analyzer")
        poetry_task = get_task("replace_first_card", demo_id="demo_poetry_card")
        assert video_task is not poetry_task
        assert "visible_text_changed" in video_task["acceptance_checks"]
        assert "content_keyword" not in poetry_task["acceptance_checks"]


def _make_skill_state(session_status: str = "active", current_task: dict | None = None):
    """带 copy_guidance 节点的 skill_state（metadata 为 dict）。"""
    return SimpleNamespace(
        current_stage="step_2",
        mode="light",
        light_step="2",
        metadata={
            "copy_guidance": {
                "version": "1.0",
                "intro_status": "started",
                "session_status": session_status,
                "current_task": current_task,
                "started_at": "2026-08-19T00:00:00+00:00",
                "updated_at": "2026-08-19T00:00:00+00:00",
            }
        },
    )


MODIFIED_PASS_FILES = {
    "index.html": (
        "<!doctype html><html><head><title>杜甫诗词卡</title></head><body><h1>杜甫诗词卡</h1>"
        "<div>{name: '杜甫', poem: '春望'}, {name: '乙', poem: '诗二'}</div>"
        "</body></html>"
    )
}


class TestSessionStateMachine:
    """2026-08-19（Q-048）：verifier 自动推进 copy_guidance 会话状态机。"""

    @pytest.mark.asyncio
    async def test_pass_middle_task_advances_to_next(self):
        """通过中间任务 → active + current_task 切到下一项。"""
        tool = CopyGuidanceVerifierTool()
        state = _make_skill_state(session_status="active", current_task={"id": "replace_first_card", "title": "替换标题"})
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(MODIFIED_PASS_FILES)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            mock_db.get_skill_state.return_value = state
            result = await tool.execute(
                {"project_id": "proj_test", "task_id": "replace_first_card", "save_evidence": False}
            )
        assert result.success
        assert result.data["session_status"] == "active"
        assert result.data["current_task"]["id"] == "add_card_data"
        assert "all_tasks_completed" not in result.data
        # 状态机已落库
        saved = mock_db.update_skill_state.call_args[0][1]["metadata"]
        assert saved["copy_guidance"]["current_task"]["id"] == "add_card_data"

    @pytest.mark.asyncio
    async def test_pass_last_task_completes_session(self):
        """通过最后一项（explain_changes）→ completed + all_tasks_completed + 收官指引。"""
        tool = CopyGuidanceVerifierTool()
        state = _make_skill_state(session_status="active", current_task={"id": "explain_changes", "title": "说明自己的改动"})
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(MODIFIED_PASS_FILES)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            mock_db.get_skill_state.return_value = state
            result = await tool.execute(
                {"project_id": "proj_test", "task_id": "explain_changes", "save_evidence": False}
            )
        assert result.success
        assert result.data["auto_passed"] is True
        assert result.data["session_status"] == "completed"
        assert result.data["current_task"] is None
        assert result.data["all_tasks_completed"] is True
        assert "stage_advancer" in result.data["final_guidance"]
        assert "achievement_card" in result.data["final_guidance"]

    @pytest.mark.asyncio
    async def test_fail_keeps_current_task_active(self):
        """未通过 → active + current_task 保持本任务。"""
        tool = CopyGuidanceVerifierTool()
        state = _make_skill_state(session_status="active", current_task={"id": "replace_first_card", "title": "替换标题"})
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(DEMO_HTML_FILES)  # 未改动
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            mock_db.get_skill_state.return_value = state
            result = await tool.execute(
                {"project_id": "proj_test", "task_id": "replace_first_card", "save_evidence": False}
            )
        assert result.success
        assert result.data["auto_passed"] is False
        assert result.data["session_status"] == "active"
        assert result.data["current_task"]["id"] == "replace_first_card"

    @pytest.mark.asyncio
    async def test_legacy_project_without_node_bootstraps(self):
        """旧项目无 copy_guidance 节点 → 自动引导落 started+active，不报错。"""
        tool = CopyGuidanceVerifierTool()
        state = SimpleNamespace(current_stage="step_2", mode="light", metadata={})
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(MODIFIED_PASS_FILES)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            mock_db.get_skill_state.return_value = state
            result = await tool.execute(
                {"project_id": "proj_test", "task_id": "replace_first_card", "save_evidence": False}
            )
        assert result.success
        assert result.data["session_status"] == "active"
        saved = mock_db.update_skill_state.call_args[0][1]["metadata"]
        assert saved["copy_guidance"]["intro_status"] == "started"


class TestLightStepDataSync:
    """2026-08-20（Q-050）：引导成果同步写入 light_step_data（主体区数据源）。"""

    @pytest.mark.asyncio
    async def test_pass_appends_step_entry(self):
        tool = CopyGuidanceVerifierTool()
        state = _make_skill_state(session_status="active", current_task={"id": "replace_first_card", "title": "替换标题"})
        state.light_step_data = {"topic": "我的项目", "goal": "复刻 Demo"}
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(MODIFIED_PASS_FILES)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            mock_db.get_skill_state.return_value = state
            result = await tool.execute(
                {"project_id": "proj_test", "task_id": "replace_first_card", "save_evidence": False}
            )
        assert result.success
        updates = mock_db.update_skill_state.call_args[0][1]
        lsd = updates["light_step_data"]
        assert any("替换标题" in s for s in lsd["steps"])
        # 已有字段不被覆盖
        assert lsd["topic"] == "我的项目"

    @pytest.mark.asyncio
    async def test_completion_sets_result(self):
        tool = CopyGuidanceVerifierTool()
        state = _make_skill_state(session_status="active", current_task={"id": "explain_changes", "title": "说明自己的改动"})
        state.light_step_data = {}
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(MODIFIED_PASS_FILES)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            mock_db.get_skill_state.return_value = state
            result = await tool.execute(
                {"project_id": "proj_test", "task_id": "explain_changes",
                 "claimed_changes": "我把标题和副标题都改成了自己的内容", "save_evidence": False}
            )
        assert result.success
        updates = mock_db.update_skill_state.call_args[0][1]
        lsd = updates["light_step_data"]
        assert "成果档案卡" in lsd["result"]
        assert lsd["reflection"] == "我把标题和副标题都改成了自己的内容"

    @pytest.mark.asyncio
    async def test_fail_does_not_touch_steps(self):
        tool = CopyGuidanceVerifierTool()
        state = _make_skill_state(session_status="active")
        state.light_step_data = {"steps": ["已有记录"]}
        with patch("app.services.tools.db") as mock_db:
            mock_db.get_project.return_value = _make_project()
            mock_db.get_project_workspace.return_value = _workspace(DEMO_HTML_FILES)
            mock_db.get_demo.return_value = _make_demo(DEMO_MINIMAL_REPLICA)
            mock_db.get_skill_state.return_value = state
            result = await tool.execute(
                {"project_id": "proj_test", "task_id": "replace_first_card", "save_evidence": False}
            )
        assert result.success
        updates = mock_db.update_skill_state.call_args[0][1]
        assert updates["light_step_data"]["steps"] == ["已有记录"]
