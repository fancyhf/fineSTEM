"""
阶段 8（评估展示）数据同步工具

用途：
1. 从 evaluate_content / 成果档案卡 / 草稿中回填 stage8 表单 payload。
2. 将 stage8 表单 payload 同步为 evaluate_content 工件文本。
3. 为历史项目修复“成果卡已有，但阶段8表单仍为空”的问题。

维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from __future__ import annotations

import json
import re
from typing import Any


def ensure_dict(value: Any) -> dict[str, Any]:
    """兼容 dict / JSON 字符串，统一转为 dict。"""
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return dict(parsed) if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}


def _pick_value(source: Any, key: str) -> str:
    if isinstance(source, dict):
        value = source.get(key)
    else:
        value = getattr(source, key, None)
    return str(value or "").strip()


def _parse_evaluate_content(raw: str) -> dict[str, str]:
    """从验收文档中提取阶段 8 表单字段。"""
    if not raw.strip():
        return {}

    key_map = {
        "验收总结": "acceptance_summary",
        "学习反思": "reflection",
        "我的反思": "reflection",
        "下一轮迭代": "next_iteration",
        "下一步计划": "next_iteration",
    }
    parsed: dict[str, str] = {}
    current_key: str | None = None
    lines_buffer: list[str] = []

    for line in raw.splitlines():
        stripped = line.strip()
        heading_match = re.match(r"^(?:#{1,3})\s+(.+)", stripped)
        if heading_match:
            if current_key and lines_buffer:
                parsed[current_key] = "\n".join(lines_buffer).strip()
            heading = heading_match.group(1).strip()
            current_key = key_map.get(heading)
            lines_buffer = []
            continue

        if current_key:
            lines_buffer.append(line)

    if current_key and lines_buffer:
        parsed[current_key] = "\n".join(lines_buffer).strip()

    if parsed:
        return {key: value for key, value in parsed.items() if value}

    regex_map = {
        "acceptance_summary": r"(?:验收总结|总结)[：:]\s*(.+)",
        "reflection": r"(?:学习反思|我的反思|反思)[：:]\s*(.+)",
        "next_iteration": r"(?:下一轮迭代|下一步计划)[：:]\s*(.+)",
    }
    fallback: dict[str, str] = {}
    for key, pattern in regex_map.items():
        matched = re.search(pattern, raw)
        if matched:
            fallback[key] = matched.group(1).strip()
    return fallback


def _compose_acceptance_summary(source: Any) -> str:
    one_liner = _pick_value(source, "one_liner")
    problem_solved = _pick_value(source, "problem_solved")
    method_used = _pick_value(source, "method_used")
    parts = []
    if one_liner:
        parts.append(f"一句话介绍：{one_liner}")
    if problem_solved:
        parts.append(f"解决了什么问题：{problem_solved}")
    if method_used:
        parts.append(f"用了什么方法：{method_used}")
    return "\n".join(parts).strip()


def build_stage08_payload(
    standard_step_data: Any,
    *,
    achievement_card: Any | None = None,
    draft_data: dict[str, Any] | None = None,
) -> dict[str, str]:
    """
    基于已有资料构建阶段 8 payload。

    优先级：
    1. step8.payload 现有值
    2. evaluate_content 验收文档
    3. 成果档案卡
    4. 成果卡草稿
    """
    standard_data = ensure_dict(standard_step_data)
    step8_raw = ensure_dict(standard_data.get("step8"))
    existing_payload = ensure_dict(step8_raw.get("payload"))
    evaluate_payload = _parse_evaluate_content(str(standard_data.get("evaluate_content") or ""))

    payload = {
        "acceptance_summary": str(existing_payload.get("acceptance_summary") or "").strip(),
        "reflection": str(existing_payload.get("reflection") or "").strip(),
        "next_iteration": str(existing_payload.get("next_iteration") or "").strip(),
    }

    for key, value in evaluate_payload.items():
        if not payload.get(key):
            payload[key] = value.strip()

    for source in (achievement_card, draft_data):
        if not source:
            continue
        if not payload["acceptance_summary"]:
            payload["acceptance_summary"] = _compose_acceptance_summary(source)
        if not payload["reflection"]:
            payload["reflection"] = _pick_value(source, "reflection")
        if not payload["next_iteration"]:
            payload["next_iteration"] = _pick_value(source, "next_iteration")

    return payload


def build_evaluate_content(payload: dict[str, Any]) -> str:
    """将阶段 8 payload 渲染为验收文档文本。"""
    sections: list[str] = []
    acceptance_summary = str(payload.get("acceptance_summary") or "").strip()
    reflection = str(payload.get("reflection") or "").strip()
    next_iteration = str(payload.get("next_iteration") or "").strip()

    if acceptance_summary:
        sections.append(f"## 验收总结\n{acceptance_summary}")
    if reflection:
        sections.append(f"## 学习反思\n{reflection}")
    if next_iteration:
        sections.append(f"## 下一轮迭代\n{next_iteration}")
    return "\n\n".join(sections).strip()


def merge_stage08_into_standard_data(
    standard_step_data: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """将阶段 8 payload 写回 standard_step_data，同时同步 evaluate_content。"""
    standard_data = ensure_dict(standard_step_data)
    step8_raw = ensure_dict(standard_data.get("step8"))
    next_payload = {
        "acceptance_summary": str(payload.get("acceptance_summary") or "").strip(),
        "reflection": str(payload.get("reflection") or "").strip(),
        "next_iteration": str(payload.get("next_iteration") or "").strip(),
    }
    step8_raw["schema_version"] = str(step8_raw.get("schema_version") or "2.0.0")
    step8_raw["payload"] = next_payload
    standard_data["step8"] = step8_raw

    evaluate_content = build_evaluate_content(next_payload)
    if evaluate_content:
        standard_data["evaluate_content"] = evaluate_content
    return standard_data

