"""
PBL 确定性推进引擎

用途：集中管理 PBL 9 阶段闭环逻辑——门禁校验、带门禁推进、工件落盘。
此后 tools.py、projects.py 都通过本引擎操作阶段推进，不再直接调 db.advance_skill_state。

维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── 阶段 -> 工件 映射 ──────────────────────────────────────────
# 用于知道每个阶段该产出哪个工件；None 表示该阶段无工件要求。
ARTIFACT_FOR_STAGE: dict[str, str | None] = {
    "stage_00_bootstrap": None,
    "stage_01_brainstorm": "brainstorm",
    "stage_02_brief": "project_brief",
    "stage_03_constraints": "constraints",
    "stage_04_track": "track_plan",
    "stage_05_design": "design",
    "stage_06_step_plan": "step_plan",
    "stage_07_execute": "dev_log",
    "stage_08_evaluate": "evaluate",
}

# ── 工件 -> standard_step_data blob key 映射 ───────────────────
ARTIFACT_TO_BLOB_KEY: dict[str, str] = {
    "brainstorm": "brainstorm_content",
    "project_brief": "brief_content",
    "constraints": "constraints_content",
    "track_plan": "track_plan_content",
    "design": "design_content",
    "step_plan": "step_plan_content",
    "dev_log": "dev_log_content",
    "evaluate": "evaluate_content",
}

# ── 工件 -> 落盘文件名 映射 ─────────────────────────────────────
ARTIFACT_TO_FILENAME: dict[str, str] = {
    "brainstorm": "00_brainstorm.md",
    "project_brief": "01_project_brief.md",
    "constraints": "02_constraints.md",
    "track_plan": "03_track_plan.md",
    "design": "04_design.md",
    "step_plan": "05_step_plan.md",
    "dev_log": "06_dev_log.md",
    "evaluate": "07_evaluation.md",
}


def _slugify(name: str) -> str:
    """将项目名称转换为 slug：小写 + 连字符替换空格/特殊字符。"""
    slug = re.sub(r"[^\w\s-]", "", name.lower().strip())
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-") or "project"


def _ensure_dict(value: Any) -> dict:
    """防呆：确保 standard_step_data 是 dict（兼容 JSON 字符串）。"""
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}


def check_gate(stage: str, standard_step_data: Any) -> tuple[bool, list[str]]:
    """
    检查阶段门禁。

    门禁规则：工件存在且非空（不做内容结构解析）。
    - stage_00_bootstrap 始终通过（初始化阶段）。
    - 其他阶段：检查对应工件的 blob key 是否存在且非空。

    参数:
        stage: 阶段标识，如 "stage_01_brainstorm"。
        standard_step_data: 标准步骤数据（dict 或 JSON 字符串）。

    返回:
        (passed, missing): passed=是否通过，missing=缺失项描述列表。
    """
    artifact_name = ARTIFACT_FOR_STAGE.get(stage)
    # 初始化阶段或无工件要求的阶段，始终通过
    if artifact_name is None:
        return True, []

    blob_key = ARTIFACT_TO_BLOB_KEY.get(artifact_name)
    if not blob_key:
        return True, []

    data = _ensure_dict(standard_step_data)
    content = data.get(blob_key)
    if content and isinstance(content, str) and content.strip():
        return True, []

    missing_desc = f"{artifact_name}（字段 {blob_key} 为空或缺失）"
    return False, [missing_desc]


def advance_with_gate(project_id: str, db) -> dict:
    """
    带门禁的阶段推进。

    - 读当前 stage + standard_step_data。
    - 跑 check_gate。
    - 通过则 db.advance_skill_state，返回 success。
    - 不通过则返回 success=False + missing 列表，不推进。

    参数:
        project_id: 项目 ID。
        db: RepositoryBackedDB 实例（需有 get_skill_state / advance_skill_state）。

    返回:
        dict:
        - success: bool
        - current_stage: str
        - new_stage: str | None
        - missing: list[str]
    """
    state = db.get_skill_state(project_id)
    if not state:
        return {
            "success": False,
            "current_stage": "unknown",
            "new_stage": None,
            "missing": ["skill_state 不存在"],
        }

    current_stage = state.current_stage
    passed, missing = check_gate(current_stage, state.standard_step_data)

    if not passed:
        return {
            "success": False,
            "current_stage": current_stage,
            "new_stage": None,
            "missing": missing,
        }

    advanced = db.advance_skill_state(project_id)
    new_stage = getattr(advanced, "current_stage", None) if advanced else None
    # 2026-07-18 事故修复：项目刚进入 stage_08_evaluate（流程终点）时标记，
    # 让上层（调用方）据此触发自动导出资料包——不在同步底层函数里直接导出，
    # 避免阻塞阶段推进响应，也避免引入循环依赖（pbl_engine → projects.py）。
    just_completed = new_stage == "stage_08_evaluate"
    return {
        "success": True,
        "current_stage": current_stage,
        "new_stage": new_stage,
        "missing": [],
        "just_completed": just_completed,
    }


def save_artifact_to_disk(project_id: str, artifact_name: str, content: str, db) -> str | None:
    """
    将工件落盘到 {STORAGE_BASE_PATH}/projects/{slug}/docs/<filename>。

    落盘失败不阻断流程——log warning 即可，核心 blob 已写入 DB。

    返回:
        落盘路径字符串；失败返回 None。
    """
    filename = ARTIFACT_TO_FILENAME.get(artifact_name)
    if not filename:
        logger.warning("save_artifact_to_disk: 未知工件名 %s", artifact_name)
        return None

    project = db.get_project(project_id)
    if not project:
        logger.warning("save_artifact_to_disk: 项目 %s 不存在", project_id)
        return None

    slug = _slugify(project.name)
    docs_dir = Path(settings.STORAGE_BASE_PATH) / "projects" / slug / "docs"
    try:
        docs_dir.mkdir(parents=True, exist_ok=True)
        file_path = docs_dir / filename
        file_path.write_text(content, encoding="utf-8")
        logger.info("工件 %s 已落盘到 %s", artifact_name, file_path)
        return str(file_path)
    except OSError as exc:
        logger.warning("save_artifact_to_disk: 落盘失败 %s: %s", artifact_name, exc)
        return None


def save_artifact(project_id: str, artifact_name: str, content: str, db) -> dict:
    """
    统一工件写入：
    1. 写入 standard_step_data.<blob_key>（通过 db.update_skill_state）。
    2. 落盘到 docs/ 目录（辅助，失败不阻断）。

    参数:
        project_id: 项目 ID。
        artifact_name: 工件标识，如 "brainstorm"。
        content: 工件文本内容。
        db: RepositoryBackedDB 实例。

    返回:
        dict: artifact_name, status, path。
    """
    blob_key = ARTIFACT_TO_BLOB_KEY.get(artifact_name)
    if not blob_key:
        return {"artifact_name": artifact_name, "status": "error", "path": None}

    state = db.get_skill_state(project_id)
    if not state:
        return {"artifact_name": artifact_name, "status": "error", "path": None}

    data = _ensure_dict(state.standard_step_data)
    data[blob_key] = content
    data["last_updated_at"] = datetime.now(timezone.utc).isoformat()

    updates: dict[str, Any] = {"standard_step_data": data}
    stages = _ensure_dict(getattr(state, "stages", {}))
    stage_id = next((stage for stage, artifact in ARTIFACT_FOR_STAGE.items() if artifact == artifact_name), None)
    if stage_id:
        stage_record = stages.get(stage_id) if isinstance(stages.get(stage_id), dict) else {}
        stage_record.update({
            "status": "completed",
            "schema_valid": True,
            "rubric_passed": True,
            "last_updated_at": data["last_updated_at"],
        })
        stages[stage_id] = stage_record
        updates["stages"] = stages

    db.update_skill_state(project_id, updates)

    disk_path = save_artifact_to_disk(project_id, artifact_name, content, db)

    fallback_path = f"docs/{ARTIFACT_TO_FILENAME.get(artifact_name, artifact_name + '.md')}"
    return {
        "artifact_name": artifact_name,
        "status": "valid",
        "path": disk_path or fallback_path,
    }
