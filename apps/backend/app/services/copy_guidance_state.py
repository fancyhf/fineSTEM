"""
复制项目任务引导状态服务（纯函数，MVP2 P0-03）。

用途：读写 SkillState.metadata.copy_guidance 节点，含状态流转校验。
维护者：AI Agent
links: .trae/documents/产品与规划/09_fineSTEM_MVP2_Create任务引导_功能与开发说明书_V1.0.md
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from app.core.time_utils import utc_now


COPY_GUIDANCE_VERSION = "1.0"

# 合法状态枚举
VALID_INTRO_STATUS = {"pending", "dismissed", "started"}
VALID_SESSION_STATUS = {"idle", "active", "waiting_verify", "completed"}

# 允许的 intro_status 流转：pending → dismissed | started（不允许回退）
INTRO_STATUS_TRANSITIONS: Dict[str, set[str]] = {
    "pending": {"dismissed", "started"},
    "dismissed": set(),
    "started": set(),
}

# 允许的 session_status 流转：idle → active → waiting_verify → completed
# 允许 waiting_verify ↔ active 回退（学生检查失败后重新做）
SESSION_STATUS_TRANSITIONS: Dict[str, set[str]] = {
    "idle": {"active"},
    "active": {"waiting_verify", "completed"},
    "waiting_verify": {"active", "completed"},
    "completed": {"active"},  # 允许再进入下一项（重启为 active）
}


class CopyGuidanceStateError(ValueError):
    """copy_guidance 状态流转非法。"""


def _coerce_metadata(skill_state: Any) -> Dict[str, Any]:
    """把 skill_state.metadata 归一化成 dict（兼容 str）。"""
    metadata = getattr(skill_state, "metadata", {}) or {}
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except Exception:
            metadata = {}
    if not isinstance(metadata, dict):
        return {}
    return metadata


def get_copy_guidance(skill_state: Any) -> Optional[Dict[str, Any]]:
    """从 skill_state.metadata 读取 copy_guidance 节点，缺失返回 None。"""
    if skill_state is None:
        return None
    metadata = _coerce_metadata(skill_state)
    node = metadata.get("copy_guidance")
    if isinstance(node, dict) and node:
        return node
    return None


def init_copy_guidance(
    intro_status: str = "pending",
    session_status: str = "idle",
    current_task: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """构造初始 copy_guidance 节点（不落库，返回 dict）。"""
    if intro_status not in VALID_INTRO_STATUS:
        raise CopyGuidanceStateError(f"非法 intro_status: {intro_status}")
    if session_status not in VALID_SESSION_STATUS:
        raise CopyGuidanceStateError(f"非法 session_status: {session_status}")

    now = utc_now().isoformat()
    return {
        "version": COPY_GUIDANCE_VERSION,
        "intro_status": intro_status,
        "session_status": session_status,
        "current_task": current_task,
        "started_at": now,
        "updated_at": now,
    }


def _validate_transition(field: str, old: str, new: str, table: Dict[str, set[str]]) -> None:
    if old == new:
        return
    allowed = table.get(old, set())
    if new not in allowed:
        raise CopyGuidanceStateError(
            f"非法 {field} 流转：{old} → {new}（合法：{sorted(allowed) or '无'}）"
        )


def update_copy_guidance(
    skill_state: Any,
    patch: Dict[str, Any],
) -> Dict[str, Any]:
    """
    合并 patch 到当前 copy_guidance 节点并返回新节点。

    支持字段：intro_status / session_status / current_task。
    非法流转抛 CopyGuidanceStateError。
    """
    if not isinstance(patch, dict) or not patch:
        raise CopyGuidanceStateError("patch 为空")

    current = get_copy_guidance(skill_state) or init_copy_guidance()

    new_intro = patch.get("intro_status", current.get("intro_status", "pending"))
    new_session = patch.get("session_status", current.get("session_status", "idle"))

    if new_intro not in VALID_INTRO_STATUS:
        raise CopyGuidanceStateError(f"非法 intro_status: {new_intro}")
    if new_session not in VALID_SESSION_STATUS:
        raise CopyGuidanceStateError(f"非法 session_status: {new_session}")

    _validate_transition(
        "intro_status",
        current.get("intro_status", "pending"),
        new_intro,
        INTRO_STATUS_TRANSITIONS,
    )
    _validate_transition(
        "session_status",
        current.get("session_status", "idle"),
        new_session,
        SESSION_STATUS_TRANSITIONS,
    )

    updated = dict(current)
    updated["intro_status"] = new_intro
    updated["session_status"] = new_session

    if "current_task" in patch:
        current_task = patch.get("current_task")
        if current_task is not None and not isinstance(current_task, dict):
            raise CopyGuidanceStateError("current_task 必须是 dict 或 None")
        updated["current_task"] = current_task

    updated["version"] = current.get("version") or COPY_GUIDANCE_VERSION
    updated.setdefault("started_at", current.get("started_at") or utc_now().isoformat())
    updated["updated_at"] = utc_now().isoformat()
    return updated


def apply_copy_guidance_to_metadata(
    metadata: Dict[str, Any],
    copy_guidance: Dict[str, Any],
) -> Dict[str, Any]:
    """把 copy_guidance 节点合并到 metadata dict 里，返回新 metadata。"""
    new_meta = dict(metadata) if isinstance(metadata, dict) else {}
    new_meta["copy_guidance"] = copy_guidance
    return new_meta
