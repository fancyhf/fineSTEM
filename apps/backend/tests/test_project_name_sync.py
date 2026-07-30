"""
项目名自动同步单元测试（Q-022 修复，2026-07-28）

覆盖 _extract_confirmed_project_name（从 PBL 数据提取 AI 确认的项目名）
和 _sync_project_name_from_skill_state（检测不一致时同步到 projects.name）。

links: .trae/documents/问题清单_长期维护.md (Q-022)
       apps/backend/app/api/projects.py
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import patch

from app.api.projects import _extract_confirmed_project_name, _sync_project_name_from_skill_state


# ── 辅助：构造 mock skill_state ──

def _ssd_state(brief_content=None, top_name=None):
    """构造带 standard_step_data 的 skill_state mock。"""
    ssd = {}
    if brief_content is not None:
        ssd["brief_content"] = brief_content
    if top_name is not None:
        ssd["project_name"] = top_name
    return SimpleNamespace(standard_step_data=ssd, light_step_data=None)


def _light_state(name=None):
    """构造 light 项目 skill_state mock。"""
    lsd = {"project_name": name} if name else {}
    return SimpleNamespace(standard_step_data={}, light_step_data=lsd)


# ── _extract_confirmed_project_name 正例 ──


def test_extract_from_brief_content_json_string():
    """主路径：brief_content 是 JSON 字符串，含 project_name。"""
    brief = json.dumps({"project_name": "英语单词学习助手", "one_liner": "背单词"})
    state = _ssd_state(brief_content=brief)
    assert _extract_confirmed_project_name(state) == "英语单词学习助手"


def test_extract_from_brief_content_dict():
    """brief_content 已是 dict（已被解析）。"""
    state = _ssd_state(brief_content={"project_name": "数据分析仪表盘"})
    assert _extract_confirmed_project_name(state) == "数据分析仪表盘"


def test_extract_from_top_level_project_name():
    """顶层 project_name（部分流程直接写）。"""
    state = _ssd_state(top_name="智能番茄钟")
    assert _extract_confirmed_project_name(state) == "智能番茄钟"


def test_extract_from_light_step_data():
    """轻项目 light_step_data.project_name。"""
    state = _light_state(name="轻量小测验")
    assert _extract_confirmed_project_name(state) == "轻量小测验"


def test_extract_title_fallback():
    """brief_content 无 project_name 时回退到 title。"""
    brief = json.dumps({"title": "标题测试", "one_liner": "x"})
    state = _ssd_state(brief_content=brief)
    assert _extract_confirmed_project_name(state) == "标题测试"


# ── _extract_confirmed_project_name 反例（找不到名字）──


def test_extract_none_when_no_name():
    """brief_content 无 project_name / title。"""
    state = _ssd_state(brief_content=json.dumps({"one_liner": "x"}))
    assert _extract_confirmed_project_name(state) is None


def test_extract_none_when_whitespace_only():
    """名字是纯空白。"""
    state = _ssd_state(top_name="   ")
    assert _extract_confirmed_project_name(state) is None


def test_extract_none_when_invalid_json():
    """brief_content 不是合法 JSON。"""
    state = _ssd_state(brief_content="这不是JSON")
    assert _extract_confirmed_project_name(state) is None


def test_extract_none_when_empty_state():
    """空 skill_state / None。"""
    assert _extract_confirmed_project_name(None) is None
    assert _extract_confirmed_project_name(SimpleNamespace()) is None


# ── _sync_project_name_from_skill_state ──


def test_sync_updates_when_name_differs():
    """AI 确认的名字与 projects.name 不同 → 调 db.update_project 同步。"""
    state = _ssd_state(top_name="英语单词学习助手")
    project = SimpleNamespace(name="我想做一个英语单词学习...")
    with patch("app.api.projects.db") as mock_db:
        mock_db.update_project.return_value = SimpleNamespace(name="英语单词学习助手")
        result = _sync_project_name_from_skill_state("proj-1", project, state)
    assert result == "英语单词学习助手"
    mock_db.update_project.assert_called_once_with("proj-1", {"name": "英语单词学习助手"})


def test_sync_skips_when_manually_overridden():
    """用户手动改名后（name_manually_overridden=true）→ 跳过自愈，不覆盖（Q-022 回归修正）。"""
    state = _ssd_state(top_name="AI早期确认名")
    # 用户已手动改成"我的新名字"，且标记了 name_manually_overridden
    project = SimpleNamespace(name="我的新名字", initial_data={"name_manually_overridden": True})
    with patch("app.api.projects.db") as mock_db:
        result = _sync_project_name_from_skill_state("proj-1", project, state)
    assert result == "我的新名字"  # 保留用户手动改的名字
    mock_db.update_project.assert_not_called()  # 没有反向覆盖


def test_sync_works_when_not_manually_overridden():
    """未手动改名（标志为 false/缺失）→ 自愈正常工作（不误伤 Q-022 原功能）。"""
    state = _ssd_state(top_name="AI确认名")
    project = SimpleNamespace(name="默认长名字", initial_data={"name_manually_overridden": False})
    with patch("app.api.projects.db") as mock_db:
        mock_db.update_project.return_value = SimpleNamespace(name="AI确认名")
        result = _sync_project_name_from_skill_state("proj-1", project, state)
    assert result == "AI确认名"
    mock_db.update_project.assert_called_once()


def test_sync_skips_when_name_already_matches():
    """名字已一致 → 不调 db.update_project。"""
    state = _ssd_state(top_name="英语单词学习助手")
    project = SimpleNamespace(name="英语单词学习助手")
    with patch("app.api.projects.db") as mock_db:
        result = _sync_project_name_from_skill_state("proj-1", project, state)
    assert result == "英语单词学习助手"
    mock_db.update_project.assert_not_called()


def test_sync_skips_when_confirmed_is_prefix_of_current():
    """确认名是当前名前缀（避免无意义写入）→ 跳过。"""
    state = _ssd_state(top_name="英语单词")
    project = SimpleNamespace(name="英语单词学习助手")  # currentName.startswith(confirmed)
    with patch("app.api.projects.db") as mock_db:
        result = _sync_project_name_from_skill_state("proj-1", project, state)
    assert result == "英语单词学习助手"  # 返回当前名
    mock_db.update_project.assert_not_called()


def test_sync_skips_when_no_confirmed_name():
    """找不到 AI 确认的名字 → 跳过，返回原 projects.name。"""
    state = _ssd_state(brief_content=json.dumps({"one_liner": "x"}))  # 无 project_name
    project = SimpleNamespace(name="原始默认名")
    with patch("app.api.projects.db") as mock_db:
        result = _sync_project_name_from_skill_state("proj-1", project, state)
    assert result == "原始默认名"
    mock_db.update_project.assert_not_called()


def test_sync_returns_current_name_when_update_fails():
    """db.update_project 抛异常 → 不崩，返回原 projects.name。"""
    state = _ssd_state(top_name="新名字")
    project = SimpleNamespace(name="旧名字")
    with patch("app.api.projects.db") as mock_db:
        mock_db.update_project.side_effect = Exception("DB down")
        result = _sync_project_name_from_skill_state("proj-1", project, state)
    assert result == "旧名字"  # 不崩，返回原名字


def test_sync_handles_no_project():
    """project 为 None → 返回空字符串，不崩。"""
    state = _ssd_state(top_name="某名字")
    with patch("app.api.projects.db"):
        result = _sync_project_name_from_skill_state("proj-1", None, state)
    assert result == ""
