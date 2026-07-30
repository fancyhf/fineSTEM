"""
问题卡片二次确认服务（Q-003 彻底修复，2026-07-27）

用途：前端文本兜底解析出"候选问题卡片"后，调用本服务做权威二次判断，
      拦截被误识别的功能介绍/状态汇报/列举清单。

背景：Q-003 反复出现——前端规则在"误识别"和"漏识别"间拉锯。本服务作为
      后端第二防线，用比前端更严格的独立规则判断"这是不是真问题"。
      与前端 questionParser.ts 形成"前端发现 + 后端确认"双重防线。

设计原则：
  1. 纯规则，无 LLM（<10ms 延迟，零成本，可测试）
  2. 独立于前端规则（两端独立维护，避免单点失效）
  3. 拒绝原因随返回值带出，便于日志和调试

links: .trae/documents/问题清单_长期维护.md (Q-003)
       apps/frontend/src/lib/questionParser.ts (前端第一防线)
"""
from __future__ import annotations

import re
from typing import Any


# ===== 规则常量 =====

# 疑问句标题模式：标题必须像"在提问"。
# 与前端的 QUESTION_TITLE_PATTERN 呼应但独立维护。
# 设计：不用裸 [?？]，要求问号出现在疑问句结构里。
QUESTION_TITLE_PATTERN = re.compile(
    r"(?:吗|呢|啊|呀)\s*[?？]?\s*$"      # 吗/呢/啊/呀 结尾（带或不带问号）
    r"|选\s*[一几个]"                      # 选一个/选几个
    r"|挑\s*[一几个]"                      # 挑一个
    r"|哪种|哪个"                          # 哪种/哪个
    r"|想要.*[?？]"                        # 想要...？
    r"|要不要|想不想"                      # 要不要/想不想
    r"|选.*[?？]"                          # 选...？
    r"|做什么|喜欢什么|想做.{0,4}什么"      # 做什么/喜欢什么/想做什么（无吗呢结尾的常见问句）
    r"|做哪[类种个]|想选"                  # 做哪类/想选
    r"|比如|来选|选吧"                      # Q-011 举例引导（让用户选）
    r"|编码方式|教学模式|学习方式"          # Q-012 编码/教学场景
    r"|哪种方式|哪种模式|怎么学|如何学"
    r"|选.*方式|选.*模式"
    r"|风格|主题|样式|色调|配色|版式"        # Q-020 设计类选择词（风格/主题/样式/色调/配色/版式）
    r"|想要什么|想用.{0,4}什么"              # Q-020 "想要什么/想用什么" 通用选择问句
)

# 列举引导词黑名单：标题含这些词时，几乎一定是功能/特性介绍。
# 比前端更全（后端是权威防线）。
# 2026-07-28 修正：移除"具备/特点/特性"——在正常提问里太常见（如"具备什么功能"），误伤真问题。
LISTING_INTENT_PATTERN = re.compile(
    r"包含|包括|主要有|功能如下|功能有|功能包含|"
    r"组成为|结构如下|清单如下|内容如下|"
    r"如下|分为|涵盖|由以下|组成部分"
)

# 功能描述动作词：选项含这些词时，更像功能特性描述而非可选项。
FUNCTION_DESCRIPTION_WORDS = re.compile(
    r"倒计时|增删改查|增删改|统计|提醒|布局|持久化|合成|渲染|"
    r"计时|管理|通知|存储|自动.*生成|实时|响应式|可视化|"
    r"交互式|可视化图表"
)

# 状态行特征（复用 orchestrator.py 的成熟黑名单）
STATUS_LINE_PATTERN = re.compile(
    r"stage_\d+"
    r"|current_stage|teaching_mode|project_id|brainstorm|artifacts?"
    r"|\b(?:docs|src|assets|tests|reports|public|app|pages|components|backend|frontend)/"
    r"|\.(?:json|md|py|ts|tsx|js|html|css)\b"
    r"|[\u2705\u274c\u2714\u2718\u274e\u2611\u2612\u26a0\u2757\u2753]"
    r"|(已补|已生成|缺失|已完成|未完成|待完成)"
)

# 状态汇报标题（信息展示，不是提问）
STATUS_TITLE_PATTERN = re.compile(
    r"^(项目现状|讨论历史|项目信息|当前状态|历史记录|基本信息|"
    r"当前进度|项目进度|完成情况|工作总结|阶段总结)\s*[：:]*$"
)


def is_real_question(title: str, options: list[dict[str, Any]]) -> tuple[bool, str]:
    """
    判断"标题 + 选项"是否构成一个真实的问题卡片。

    判断顺序（任一不通过即拒绝，返回原因）：
      1. 基本结构：title 非空、options ≥2
      2. 标题不是状态汇报标题
      3. 标题不含列举引导词（功能介绍）
      4. 标题必须是疑问句
      5. 选项不是功能描述清单
      6. 选项不是状态清单（≥50% 是状态行）

    Args:
        title: 候选卡片的标题
        options: 候选项数组，每项 {label, description?}

    Returns:
        (is_real, reason): is_real=True 表示是真实问题（应渲染）；
        is_real=False 表示应拒绝，reason 给出拒绝原因。
    """
    # 1. 基本结构
    if not title or not title.strip():
        return False, "标题为空"
    if not options or len(options) < 2:
        return False, "选项少于2个"

    title_text = title.strip()
    # 标题去掉 markdown 前缀和尾部冒号，便于判断
    title_clean = re.sub(r"^[#\s]+", "", title_text)
    title_clean = re.sub(r"[：:]\s*$", "", title_clean).strip()

    # 2. 状态汇报标题
    if STATUS_TITLE_PATTERN.search(title_clean):
        return False, f"标题是状态汇报（{title_clean}）"

    # 3. 列举引导词黑名单（即使含问号也拒绝）
    if LISTING_INTENT_PATTERN.search(title_clean):
        return False, f"标题含列举引导词，疑似功能介绍（{title_clean}）"

    # 4. 标题必须是疑问句
    if not QUESTION_TITLE_PATTERN.search(title_clean):
        return False, f"标题不像疑问句（{title_clean}）"

    # 5. 选项功能描述检查
    func_desc_count = 0
    for opt in options:
        text = f"{opt.get('label', '')} {opt.get('description', '')}"
        if FUNCTION_DESCRIPTION_WORDS.search(text):
            func_desc_count += 1
    if func_desc_count / len(options) >= 0.5:
        return False, f"≥50%选项含功能动作词，疑似功能清单（{func_desc_count}/{len(options)}）"

    # 6. 状态清单检查
    status_count = 0
    for opt in options:
        text = f"{opt.get('label', '')} {opt.get('description', '')}"
        if STATUS_LINE_PATTERN.search(text):
            status_count += 1
    if status_count / len(options) >= 0.5:
        return False, f"≥50%选项是状态行（{status_count}/{len(options)}）"

    return True, "通过"


# ===== 便于直接调用的轻量封装 =====

def verify_question_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """
    从 API 请求体提取 title/options 并判断。

    Args:
        payload: {"title": str, "options": [{"label": str, "description": str?}]}

    Returns:
        {"is_real_question": bool, "reason": str}
    """
    title = payload.get("title", "") if isinstance(payload, dict) else ""
    raw_options = payload.get("options", []) if isinstance(payload, dict) else []
    options = raw_options if isinstance(raw_options, list) else []

    is_real, reason = is_real_question(title, options)
    return {"is_real_question": is_real, "reason": reason}
