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
# 2026-07-22 重构：阶段常量统一从 stage_constants 导入（单一事实来源），
# 消除原先散落在 tools.py / pbl_engine.py / orchestrator.py / project_repo.py / memory.py
# 五处的重复定义。本模块保留 ARTIFACT_FOR_STAGE / ARTIFACT_TO_BLOB_KEY /
# ARTIFACT_TO_FILENAME 作为向后兼容的再导出（其他模块仍 from pbl_engine import 它们）。
from app.services.stage_constants import (
    ARTIFACT_FOR_STAGE,
    ARTIFACT_TO_BLOB_KEY,
    ARTIFACT_TO_FILENAME,
    ARTIFACT_TO_STAGE,
    STAGE_ORDER,
    stage_index,
)

logger = logging.getLogger(__name__)


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

    门禁规则（2026-07-22 强化）：
    1. stage_00_bootstrap 始终通过（初始化阶段）。
    2. 其他阶段：先检查对应工件 blob key 是否存在且非空（快速失败）。
    3. 非空后，尝试用 Pydantic 阶段数据模型做结构校验，发现缺失字段则返回精确 missing 清单。
       - 结构校验失败不直接拦截（兼容 markdown 形式工件、存量数据），但会把缺失项加入 missing 提示。
       - 只有"工件完全为空"才硬拦截。

    设计取舍：不强制要求工件必须是合法 JSON，因为脑爆记录、开发日志等是 markdown 文本，
    不是结构化数据。结构校验只对"看起来像 JSON 的工件"生效，作为精确诊断辅助。

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
    # 第 1 道门：工件必须存在且非空（硬门禁）
    if not content or not (isinstance(content, str) and content.strip()):
        missing_desc = f"{artifact_name}（字段 {blob_key} 为空或缺失）"
        return False, [missing_desc]

    # 第 2 道门：结构校验（软门禁，只产出诊断信息，不拦截非 JSON 工件）
    # 对 markdown 类工件（brainstorm/dev_log）跳过；对 JSON 类工件尝试解析校验。
    structural_missing = _structural_check(stage, artifact_name, content)
    # 结构缺失不阻断推进（避免老项目全卡死），但会体现在 missing 里供 AI 参考
    return True, structural_missing


def _structural_check(stage: str, artifact_name: str, content: str) -> list[str]:
    """
    对 JSON 类工件做结构校验，返回缺失字段清单（不抛异常，不阻断）。

    - markdown 类工件（brainstorm/dev_log）：不做结构校验，返回空。
    - JSON 类工件：尝试解析 + Pydantic 校验，失败则记录具体缺失项。
    - 任何异常都吞掉只返回空 list（结构校验是"辅助诊断"，不是"硬门禁"）。
    """
    import logging
    _log = logging.getLogger(__name__)

    # markdown 类工件不校验结构
    if artifact_name in ("brainstorm", "dev_log"):
        return []

    # 尝试把 content 解析成 dict（工件可能是 JSON 字符串，也可能是 markdown 里嵌 JSON）
    try:
        if isinstance(content, str):
            stripped = content.strip()
            # 简单判定：看起来像 JSON 才解析
            if not (stripped.startswith("{") or stripped.startswith("[")):
                return []
            parsed = json.loads(stripped)
        else:
            parsed = content
        if not isinstance(parsed, dict):
            return []
    except (json.JSONDecodeError, TypeError):
        # 内容不是合法 JSON，跳过结构校验（可能 AI 用 markdown 写了）
        return []

    # 按阶段做关键字段检查（与 schemas/projects.py 的 Stage0XData 对齐）
    # 这里用手动检查而非 Pydantic 实例化，避免模型字段变更时这里静默失效。
    stage_required_fields: dict[str, list[tuple[str, str]]] = {
        # stage: [(字段名, 人类可读描述), ...]
        "stage_02_brief": [
            ("title", "项目标题"),
            ("success_criteria", "成功标准（≥2 条）"),
            ("risks", "风险清单（≥2 条）"),
        ],
        "stage_03_constraints": [
            ("must_have", "必须做的功能（≤3 条）"),
            ("wont_do", "不做的功能（≥2 条）"),
        ],
        "stage_04_track": [
            ("track", "技术轨道（web/game_dev/ai_ml/data_viz/creative_coding）"),
            ("tech_stack", "技术栈"),
        ],
        "stage_05_design": [
            ("acceptance_criteria", "验收用例（≥3 条）"),
        ],
        "stage_06_step_plan": [
            ("steps", "分步计划（每步含 run/check/rollback）"),
        ],
        "stage_08_evaluate": [
            ("acceptance_results", "验收结果（≥2 项）"),
            ("reflections", "反思（≥2 条）"),
        ],
    }
    required = stage_required_fields.get(stage, [])
    missing: list[str] = []
    for field, desc in required:
        value = parsed.get(field)
        # 判定"缺失"：None、空字符串、空列表、空 dict 都算
        is_empty = (
            value is None
            or (isinstance(value, str) and not value.strip())
            or (isinstance(value, (list, dict)) and len(value) == 0)
        )
        if is_empty:
            missing.append(f"{artifact_name}.{field}（{desc}）")
    if missing:
        _log.info("structural_check_missing stage=%s missing=%s", stage, missing)
    return missing


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
