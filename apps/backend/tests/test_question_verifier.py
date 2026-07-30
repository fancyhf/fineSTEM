"""
问题卡片二次确认服务单元测试（Q-003 彻底修复，2026-07-27）

覆盖 question_verifier.is_real_question 的正例（真问题放行）和反例（功能介绍等拒绝），
含番茄钟截图中的真实 case。

对应测试计划 TC-DATA-007。
links: .trae/documents/问题清单_长期维护.md (Q-003)
       .trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md
"""
from __future__ import annotations

import pytest

from app.services.question_verifier import is_real_question, verify_question_payload


# ── 反例：应被拒绝（功能介绍 / 状态汇报 / 非疑问句）──


def test_reject_pomodoro_feature_intro():
    """番茄钟截图 case：功能介绍列表被误识别为选项卡。"""
    title = "一个番茄钟专注计时器，包含"
    options = [
        {"label": "25分钟精确倒计时"},
        {"label": "待办任务增删改查"},
        {"label": "每日专注次数统计"},
        {"label": "4种Web Audio合成音效"},
    ]
    ok, reason = is_real_question(title, options)
    assert ok is False, f"应拒绝功能介绍，但放行了：{reason}"
    assert "列举" in reason or "功能" in reason


def test_reject_feature_list_marker():
    """标题含'功能如下'列举词。"""
    ok, _ = is_real_question("这个应用功能如下", [{"label": "计时器"}, {"label": "任务管理"}])
    assert ok is False


def test_reject_status_report_title():
    """状态汇报标题（当前进度）。"""
    ok, _ = is_real_question("当前进度", [{"label": "选题完成"}, {"label": "开题进行中"}])
    assert ok is False


def test_reject_non_question_statement():
    """陈述句（我建议做番茄钟）。"""
    ok, _ = is_real_question("我建议做一个番茄钟", [{"label": "功能A"}, {"label": "功能B"}])
    assert ok is False


def test_reject_function_description_options():
    """选项全是功能描述（含技术动作词），即使标题像问句也拒绝。"""
    title = "你想包含哪些功能？"
    options = [
        {"label": "倒计时"},
        {"label": "数据统计"},
        {"label": "自动提醒"},
    ]
    ok, _ = is_real_question(title, options)
    assert ok is False


def test_reject_question_with_listing_word_even_has_qmark():
    """含问号但同时含列举词（包含）→ 拒绝（列举词优先级高于问号）。"""
    ok, _ = is_real_question(
        "你想做番茄钟吗？好的！这个应用包含：",
        [{"label": "倒计时"}, {"label": "任务管理"}],
    )
    assert ok is False


def test_reject_status_line_options():
    """选项 ≥50% 是状态行（含 ✅/文件路径）。"""
    ok, _ = is_real_question(
        "你想选哪个？",
        [
            {"label": "✅ 选题完成"},
            {"label": "✅ 开题完成"},
            {"label": "docs/report.md"},
        ],
    )
    assert ok is False


def test_reject_empty_title():
    ok, _ = is_real_question("", [{"label": "A"}, {"label": "B"}])
    assert ok is False


def test_reject_too_few_options():
    ok, _ = is_real_question("选哪个？", [{"label": "A"}])
    assert ok is False


# ── 正例：应放行（真实问题）──


def test_accept_track_selection():
    """选轨道（标准 PBL 场景）。"""
    ok, _ = is_real_question(
        "你想做哪个方向？选一个",
        [{"label": "Web应用"}, {"label": "游戏开发"}, {"label": "AI/ML"}],
    )
    assert ok is True


def test_accept_teaching_mode():
    """教学模式选择（Q-012 场景，不能退化）。"""
    ok, _ = is_real_question(
        "请选择你喜欢的编码方式",
        [{"label": "引导式"}, {"label": "演示式"}, {"label": "动手式"}, {"label": "讲解式"}],
    )
    assert ok is True


def test_accept_grade_question():
    """年级提问（吗结尾）。"""
    ok, _ = is_real_question("你现在是哪个年级吗？", [{"label": "初中"}, {"label": "高中"}])
    assert ok is True


def test_accept_hobby_multiselect():
    """兴趣爱好多选（做什么结尾，无吗呢）——不能误杀。"""
    ok, _ = is_real_question(
        "你平时喜欢做什么（可以多选）",
        [{"label": "打游戏"}, {"label": "看视频"}, {"label": "运动"}],
    )
    assert ok is True


def test_accept_which_type_question():
    ok, _ = is_real_question("你想做哪种类型？", [{"label": "网页"}, {"label": "小程序"}])
    assert ok is True


def test_accept_pick_one():
    ok, _ = is_real_question("挑一个你感兴趣的", [{"label": "A"}, {"label": "B"}])
    assert ok is True


# ── verify_question_payload 封装 ──


def test_verify_question_payload_pass():
    payload = {
        "title": "选哪个方向？",
        "options": [{"label": "A", "description": "desc"}, {"label": "B"}],
    }
    result = verify_question_payload(payload)
    assert result["is_real_question"] is True


def test_verify_question_payload_reject():
    payload = {
        "title": "功能包含",
        "options": [{"label": "倒计时"}, {"label": "统计"}],
    }
    result = verify_question_payload(payload)
    assert result["is_real_question"] is False
    assert result["reason"]


def test_verify_question_payload_invalid_input():
    """非法输入不崩溃。"""
    assert verify_question_payload({})["is_real_question"] is False
    assert verify_question_payload(None)["is_real_question"] is False
    assert verify_question_payload({"title": "x", "options": "notalist"})["is_real_question"] is False


# ── Q-003 误伤修正（2026-07-28）：TC-DATA-009/010 ──


def test_accept_jubei_real_question():
    """TC-DATA-009: '具备什么核心功能'真问题不再被'具备'误杀。"""
    title = "你想让它具备什么核心功能？选一个"
    options = [
        {"label": "智能复习"},
        {"label": "拼写测试"},
        {"label": "进度统计"},
    ]
    ok, reason = is_real_question(title, options)
    assert ok is True, f"应放行真问题，但拒绝了：{reason}"


def test_accept_tedian_real_question():
    """TC-DATA-009 补充: '特点'不在黑名单中。"""
    ok, _ = is_real_question(
        "它有什么特点？选一个",
        [{"label": "功能A"}, {"label": "功能B"}],
    )
    assert ok is True


def test_reject_open_ended_question():
    """TC-DATA-010: 开放追问'任选 1-2 个回答'不构成选项卡（正确行为）。"""
    title = "请任选 1-2 个回答"
    options = [
        {"label": "你想做什么类型的项目？"},
        {"label": "你有偏好的技术栈吗？"},
        {"label": "项目名称想好了吗？"},
    ]
    ok, reason = is_real_question(title, options)
    assert ok is False, f"开放追问不应被识别为选项卡：{reason}"


def test_reject_pomodoro_still_blocked():
    """TC-DATA-010 回归: 番茄钟功能介绍仍被拦截。"""
    title = "一个番茄钟专注计时器，包含"
    options = [
        {"label": "25分钟倒计时"},
        {"label": "待办任务增删改查"},
    ]
    ok, _ = is_real_question(title, options)
    assert ok is False


# ── Q-020（2026-07-28）：风格/主题类文字选择不渲染卡片 ──
# 根因：QUESTION_TITLE_PATTERN 不含"风格/主题/样式/色调/配色"等设计选择词，
#   AI 用文字列风格选项（DeepSeek 不调 ask_question 时）后端二次确认会拒绝。
# 修复：QUESTION_TITLE_PATTERN 新增设计类关键词。
# links: .trae/documents/问题清单_长期维护.md (Q-020)


@pytest.mark.parametrize(
    "title",
    [
        "你想要什么风格？",
        "你想用什么风格？",
        "选择一个你喜欢的风格",
        "想要什么设计风格",
        "风格选哪个？",
        "你想要什么主题？",
        "选个主题色吧",
        "你想要什么样式",
        "想要什么配色",
    ],
)
def test_accept_style_theme_questions(title):
    """TC-DATA-011: 各种风格/主题提问句式都应放行为真问题。"""
    options = [
        {"label": "极简即用型"},
        {"label": "分析洞察型"},
        {"label": "趣味互动型"},
    ]
    ok, reason = is_real_question(title, options)
    assert ok is True, f"应放行风格/主题真问题，但拒绝了：{reason}（title={title}）"


def test_accept_style_question_full_case():
    """TC-DATA-012: '你想要什么风格？' + 选项 → 真问题。"""
    ok, reason = is_real_question(
        "你想要什么风格？",
        [
            {"label": "极简即用型", "description": "一打开就用"},
            {"label": "分析洞察型", "description": "侧重图表"},
        ],
    )
    assert ok is True, f"应放行：{reason}"


@pytest.mark.parametrize(
    "title",
    [
        "支持多种风格，包含现代和复古",
        "风格包含极简和华丽",
        "这个主题包含三个模块",
    ],
)
def test_reject_style_in_feature_intro(title):
    """回归: 含"风格/主题"但带列举引导词（功能介绍）仍被拒绝（Q-003 不退化）。"""
    options = [
        {"label": "现代"},
        {"label": "复古"},
    ]
    ok, _ = is_real_question(title, options)
    assert ok is False, f"功能介绍句不应放行：{title}"
