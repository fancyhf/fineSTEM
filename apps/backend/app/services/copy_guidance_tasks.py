"""
复制项目任务引导：Demo 任务配置（MVP2 P0-08）。

配置驱动，与 Demo 解耦：第二个 Demo 只需在此追加任务配置，不改 verifier。

维护者：AI Agent
links: .trae/documents/产品与规划/09_fineSTEM_MVP2_Create任务引导_功能与开发说明书_V1.0.md
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


# 首个样板 demo_poetry_card 的 5 项任务
_DEMO_POETRY_CARD_TASKS: List[Dict[str, Any]] = [
    {
        "id": "replace_first_card",
        "title": "替换标题和第一张卡片",
        # 2026-08-18：content_keyword → visible_text_changed。此前 AI 把"换成自己
        # 喜欢的内容"强解为"必须改成项目名"，学生改成任何自己的内容都判不过。
        "acceptance_checks": ["code_changed", "run_success", "visible_text_changed"],
        "knowledge_point": "字符串、数据与页面",
        "hint": "在 index.html 里找到页面标题和第一张卡片的位置",
        "demo_ids": ["demo_poetry_card"],
    },
    {
        "id": "add_card_data",
        "title": "增加一条卡片数据",
        "acceptance_checks": ["code_changed", "card_count"],
        "knowledge_point": "数组、重复渲染",
        "hint": "找到 data 数组，照着已有条目加一条",
        "demo_ids": ["demo_poetry_card"],
    },
    {
        "id": "modify_interaction",
        "title": "修改一个交互或样式参数",
        "acceptance_checks": ["code_changed", "run_success"],
        "knowledge_point": "事件或条件",
        "hint": "改一个颜色、过滤条件或点击行为",
        "demo_ids": ["demo_poetry_card"],
    },
    {
        "id": "fix_error",
        "title": "制造并修复一次小错误",
        "acceptance_checks": ["code_changed", "run_success"],
        "knowledge_point": "报错、AI 协作和核验",
        "hint": "故意删一个引号或括号，看报错，再修回来",
        "demo_ids": ["demo_poetry_card"],
    },
    {
        "id": "explain_changes",
        "title": "说明自己的改动",
        "acceptance_checks": ["code_changed"],
        "knowledge_point": "反思与表达",
        "hint": "用一句话说出你改了哪一处、为什么",
        "demo_ids": ["demo_poetry_card"],
    },
]


# 2026-08-18：第二个样板 demo_video_analyzer（线上实测项目 b9e0f446 用的就是它，
# 此前没有任务配置，AI 即兴发明"必须改成项目名"的验收标准导致学生无限重改）。
# 与 poetry 卡使用同一套任务 ID，靠 demo_ids 区分归属。
_DEMO_VIDEO_ANALYZER_TASKS: List[Dict[str, Any]] = [
    {
        "id": "replace_first_card",
        "title": "把页面标题换成你自己的",
        "acceptance_checks": ["code_changed", "run_success", "visible_text_changed"],
        "knowledge_point": "字符串、数据与页面",
        "hint": "在 index.html 里找到 <title> 和 <h1>（现在都是“词频分析器”），换成任何你喜欢的名字",
        "demo_ids": ["demo_video_analyzer"],
    },
    {
        "id": "add_card_data",
        "title": "增加一条数据或列表项",
        "acceptance_checks": ["code_changed", "card_count"],
        "knowledge_point": "数组、重复渲染",
        "hint": "找到页面里的数据列表，照着已有条目加一条",
        "demo_ids": ["demo_video_analyzer"],
    },
    {
        "id": "modify_interaction",
        "title": "修改一个交互或样式参数",
        "acceptance_checks": ["code_changed", "run_success"],
        "knowledge_point": "事件或条件",
        "hint": "改一个颜色、按钮文字或统计行为",
        "demo_ids": ["demo_video_analyzer"],
    },
    {
        "id": "fix_error",
        "title": "制造并修复一次小错误",
        "acceptance_checks": ["code_changed", "run_success"],
        "knowledge_point": "报错、AI 协作和核验",
        "hint": "故意删一个引号或括号，看报错，再修回来",
        "demo_ids": ["demo_video_analyzer"],
    },
    {
        "id": "explain_changes",
        "title": "说明自己的改动",
        "acceptance_checks": ["code_changed"],
        "knowledge_point": "反思与表达",
        "hint": "用一句话说出你改了哪一处、为什么",
        "demo_ids": ["demo_video_analyzer"],
    },
]


# 所有任务扁平列表（按 demo_ids 匹配）
_ALL_TASKS: List[Dict[str, Any]] = _DEMO_POETRY_CARD_TASKS + _DEMO_VIDEO_ANALYZER_TASKS


def get_tasks_for_demo(demo_id: Optional[str]) -> List[Dict[str, Any]]:
    """返回指定 Demo 的任务列表，保持顺序。demo_id 缺失返回空列表。"""
    if not demo_id:
        return []
    return [task for task in _ALL_TASKS if demo_id in (task.get("demo_ids") or [])]


def get_task(task_id: Optional[str], demo_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    按 task_id 查找任务，找不到返回 None。

    2026-08-18：两个 Demo 共用同一套任务 ID，靠 demo_ids 区分归属。
    提供 demo_id 时优先返回归属该 Demo 的版本；找不到再退回全局首个匹配
    （由调用方做归属校验）。
    """
    if not task_id:
        return None
    if demo_id:
        for task in _ALL_TASKS:
            if task.get("id") == task_id and demo_id in (task.get("demo_ids") or []):
                return task
    for task in _ALL_TASKS:
        if task.get("id") == task_id:
            return task
    return None


def get_next_task(
    current_task_id: Optional[str],
    demo_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    返回给定任务在其 Demo 序列中的下一项；current_task_id 为空则返回首项。

    优先按 demo_id 过滤，未提供时从 current_task 归属的 demo 推断。
    """
    if demo_id is None and current_task_id:
        current = get_task(current_task_id)
        demo_ids = (current or {}).get("demo_ids") or []
        demo_id = demo_ids[0] if demo_ids else None

    tasks = get_tasks_for_demo(demo_id) if demo_id else list(_ALL_TASKS)
    if not tasks:
        return None
    if not current_task_id:
        return tasks[0]

    for idx, task in enumerate(tasks):
        if task.get("id") == current_task_id:
            if idx + 1 < len(tasks):
                return tasks[idx + 1]
            return None
    # 找不到当前任务，退回首项
    return tasks[0]
