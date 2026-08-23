"""
AI 工具调用层：核心工具定义与注册表

用途：定义 ZeroClaw Agent Loop 可调用的所有工具
维护者：AI Agent
links: .trae/documents/产品与规划/fineSTEM_AI对话流设计规格_v1.0.0.md
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.time_utils import utc_now
from app.repositories.runtime_db import db
from app.services.pbl_engine import ARTIFACT_TO_BLOB_KEY, advance_with_gate, save_artifact
from app.services.demo_fork import build_demo_workspace_payload
# 2026-07-22 重构：门禁判定函数统一从 stage_constants 导入
from app.services.stage_constants import (
    STAGE_ORDER,
    can_advance_to,
    artifact_stage_gate,
    is_code_allowed_stage,
    normalize_artifact_name,
    stage_index,
)


class ToolResult:
    def __init__(self, success: bool, data: Any = None, error: Optional[str] = None):
        self.success = success
        self.data = data or {}
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {"success": self.success}
        if self.data:
            result["data"] = self.data
        if self.error:
            result["error"] = self.error
        return result

    def to_string(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)


def _trigger_auto_export(project_id: str) -> None:
    """
    2026-07-18 事故修复：项目完成后异步导出资料包到 out/ 目录（git 追踪）。

    - 延迟导入 projects.py 避免循环依赖（projects.py 反向依赖 tools 的情况已通过
      pbl_engine 解耦，但保持延迟导入更稳妥）。
    - 用线程池执行（导出是同步 I/O，且可能较慢），不阻塞 asyncio 事件循环。
    - 失败只 log warning，绝不影响阶段推进主流程。
    """
    import asyncio
    import logging
    from pathlib import Path
    from app.core.config import settings

    if not settings.AUTO_EXPORT_ON_COMPLETE:
        return

    _log = logging.getLogger(__name__)

    async def _do_export():
        import asyncio
        loop = asyncio.get_event_loop()
        # 找 out/ 目录：项目根的 out/（与 STORAGE_BASE_PATH 同级或其上）
        # STORAGE_BASE_PATH = D:/data/finestem，项目根 = G:/mediaProjects/fineSTEM
        # 用 projects.py 自身路径反推项目根最稳妥
        from app.api.projects import export_project_to_disk
        out_dir = Path(settings.STORAGE_BASE_PATH).parent if Path(settings.STORAGE_BASE_PATH).name == "finestem" else Path(settings.AUTO_EXPORT_DIR)
        # 优先用配置的相对路径（相对当前工作区根），但为兼容性，也尝试 STORAGE_BASE_PATH 的父
        candidates = [
            Path(settings.AUTO_EXPORT_DIR).resolve() if not Path(settings.AUTO_EXPORT_DIR).is_absolute() else None,
            Path.cwd() / settings.AUTO_EXPORT_DIR,
        ]
        out_dir = next((c for c in candidates if c is not None and (c.parent.exists() or c.parent == Path.cwd())), Path.cwd() / settings.AUTO_EXPORT_DIR)
        out_dir.mkdir(parents=True, exist_ok=True)
        pkg_path = await loop.run_in_executor(None, export_project_to_disk, project_id, out_dir)
        _log.info("auto_export_success project_id=%s path=%s", project_id, pkg_path)

    try:
        loop = asyncio.get_event_loop()
        loop.create_task(_do_export())
    except RuntimeError:
        # 没有 event loop（理论上 tools 都在 async 上下文，这里只是兜底）
        _log.warning("auto_export_no_event_loop project_id=%s", project_id)


class BaseTool:
    name: str = ""
    description: str = ""
    parameters_schema: Dict[str, Any] = {}

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        raise NotImplementedError


class SkillStateReaderTool(BaseTool):
    """读取项目 SKILL_STATE"""

    name = "skill_state_reader"
    description = "读取项目的 SKILL_STATE 状态机数据，包括当前阶段、阶段状态、工件状态、教学模式等"
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "include": {
                "type": "array",
                "items": {"type": "string", "enum": ["stage", "artifacts", "modes", "history", "light_step_data", "standard_step_data"]},
                "description": "要包含的信息类别，默认全部"
            },
        },
        "required": ["project_id"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        if not project_id:
            return ToolResult(False, error="缺少必填参数 project_id")

        include = params.get("include") or ["stage", "artifacts", "modes", "history"]
        state = db.get_skill_state(project_id)
        if not state:
            return ToolResult(False, error=f"未找到项目 {project_id} 的 SKILL_STATE")

        state_dict = state.model_dump(mode="json") if hasattr(state, "model_dump") else state.__dict__
        result: Dict[str, Any] = {"project_id": project_id}

        if "stage" in include:
            result["current_stage"] = getattr(state, "current_stage", "unknown")
            result["mode"] = getattr(state, "mode", "light")

        if "artifacts" in include:
            stages_raw = getattr(state, "stages", "{}")
            stages_dict = json.loads(stages_raw) if isinstance(stages_raw, str) else stages_raw
            artifacts_status = {}
            for stage_id, stage_val in stages_dict.items():
                if isinstance(stage_val, dict):
                    artifacts_status[stage_id] = stage_val.get("status", "unknown")
            result["artifact_statuses"] = artifacts_status

        if "modes" in include:
            metadata_raw = getattr(state, "metadata", "{}")
            metadata_dict = json.loads(metadata_raw) if isinstance(metadata_raw, str) else metadata_raw
            result["teaching_mode"] = metadata_dict.get("teachingMode", "guided")
            result["research_docs"] = metadata_dict.get("researchDocs", False)
            result["paper_mode"] = metadata_dict.get("paperMode", False)
            # Q-017 记忆持久化：返回学生画像，让 AI 重入项目时读到已收集的选择
            student_profile = metadata_dict.get("student_profile")
            if isinstance(student_profile, dict) and student_profile:
                result["student_profile"] = student_profile

        if "history" in include:
            history_raw = getattr(state, "stage_history", "[]")
            history_list = json.loads(history_raw) if isinstance(history_raw, str) else history_raw
            result["stage_history"] = history_list[-5:] if len(history_list) > 5 else history_list

        if "light_step_data" in include:
            light_raw = getattr(state, "light_step_data", "{}")
            light_dict = json.loads(light_raw) if isinstance(light_raw, str) else light_raw
            result["light_step_data"] = light_dict

        if "standard_step_data" in include:
            std_raw = getattr(state, "standard_step_data", "{}")
            std_dict = json.loads(std_raw) if isinstance(std_raw, str) else std_raw
            result["standard_step_data"] = std_dict

        return ToolResult(True, data=result)


class AskQuestionTool(BaseTool):
    """向学生提问结构化选择题（前端渲染成可点击的选项卡片）。

    2026-07-20 新增：替代"从 AI 自由文本反解选项"的不可靠机制。
    AI 要问学生选择题时，调用此工具，参数就是结构化 JSON（title/multiple/options）。
    前端收到 tool_call 事件后直接拿 args 渲染成 QuestionCard，零文本解析。
    """

    name = "ask_question"
    description = (
        "向学生提问一道单选或多选题。前端会把问题渲染成可点击的选项卡片，"
        "学生点选项即可回答（无需打字）。需要学生做选择时必须用此工具，"
        "不要直接输出 markdown 编号列表或 <question> XML——那些前端无法可靠识别。"
        "一次回复可以连续调用多次本工具，实现多张卡片（多问题）。"
    )
    parameters_schema = {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "问题标题，会显示在卡片顶部（如：你现在是哪个年级）",
            },
            "multiple": {
                "type": "boolean",
                "description": "是否多选。true=多选（学生可选多个），false=单选（默认）。不传视为 false。",
            },
            "step": {
                "type": "integer",
                "description": "当前是第几步（可选，用于进度显示，如分 3 轮提问时的轮次）",
            },
            "total_steps": {
                "type": "integer",
                "description": "总共几步（可选，配合 step 显示进度）",
            },
            "options": {
                "type": "array",
                "description": "选项列表（2-8 个）。每个选项是 {id, label, description}。",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "选项唯一标识，用语义化短词（如 junior/senior/web/game/idea）",
                        },
                        "label": {
                            "type": "string",
                            "description": "选项的简短标签（≤15 字），会显示在按钮上，可带 emoji（如：初中、🎮 打游戏）",
                        },
                        "description": {
                            "type": "string",
                            "description": "选项的详细说明（可选，显示在 label 下方）",
                        },
                    },
                    "required": ["id", "label"],
                },
                "minItems": 2,
                "maxItems": 8,
            },
        },
        "required": ["title", "options"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        # 这个工具只是"提问信号"，不需要做任何实际操作或落盘。
        # 把 args 透传回 output，让前端在 tool_result 帧也能拿到结构化数据
        # （与 achievement_card 的 data.message 模式一致）。
        title = str(params.get("title") or "").strip()
        options = params.get("options") or []
        if not title:
            return ToolResult(False, error="缺少必填参数 title")
        if not isinstance(options, list) or len(options) < 2:
            return ToolResult(False, error="options 至少需要 2 个选项")
        return ToolResult(True, data={
            "title": title,
            "multiple": bool(params.get("multiple", False)),
            "step": params.get("step"),
            "total_steps": params.get("total_steps"),
            "options": options,
            "message": "已向学生提问",
        })


class SkillStateWriterTool(BaseTool):
    """更新项目 SKILL_STATE 元数据（白名单字段）"""

    name = "skill_state_writer"
    description = (
        "更新项目的 SKILL_STATE 元数据（如教学模式、论文模式、阶段历史）。"
        "**修改/确认项目显示名**：写 updates.metadata.project_name（如 "
        "updates={'metadata': {'project_name': '新名字'}}），后端会自动同步到侧边栏项目列表——"
        "项目名不是锁定的，与学生确认或学生要求改名时必须这样写。"
        "**禁止**用于推进阶段（必须用 stage_advancer）或写入工件内容（必须用 artifact_writer）——"
        "这两个字段受白名单保护，本工具会拒绝写入。"
    )
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "updates": {"type": "object", "description": "要更新的字段键值对（仅允许元数据字段）"},
            "history_entry": {
                "type": "object",
                "properties": {
                    "action": {"type": "string"},
                    "from_stage": {"type": "string"},
                    "to_stage": {"type": "string"},
                    "note": {"type": "string"},
                },
            },
        },
        "required": ["project_id", "updates"],
    }

    # 2026-07-22 门禁修复：白名单机制。
    # 原实现可写任意字段（含 current_stage / standard_step_data），是绕过 stage_advancer
    # 和 artifact_writer 门禁的裸写入通道——AI 能直接把 current_stage 写成 stage_08_evaluate
    # 同时工件为空，完全绕过 PBL 流程。现改为只允许写元数据类字段。
    ALLOWED_FIELDS: set[str] = {
        "metadata",             # 教学模式、论文模式等元数据
        "stage_history",        # 阶段历史记录（只追加，不改现状）
        "light_step_data",      # 轻项目步骤数据
        "light_to_standard_mapping",  # 轻项目升级映射
    }
    # 这些字段被白名单拦截，必须走专用工具：
    #   current_stage / stages → stage_advancer
    #   standard_step_data     → artifact_writer

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        updates = params.get("updates")
        if not project_id or not updates:
            return ToolResult(False, error="缺少必填参数 project_id 或 updates")

        # Q-026 复测修复（2026-07-31）：AI 改项目名时常把 name/project_name 放在 updates
        # 顶层，原先被白名单一票拒绝，AI 收到 failed 后直接对学生宣称"项目名无法修改"。
        # 现在把这些改名意图键自动搬运进 metadata（不覆盖已显式给出的 metadata 同名键），
        # 让改名走 Q-026 的 metadata→projects.name 同步通道。
        _NAME_ALIAS_KEYS = ("project_name", "display_name", "name")
        _alias_hits = [k for k in _NAME_ALIAS_KEYS if isinstance(updates.get(k), str) and updates[k].strip()]
        if _alias_hits:
            meta_updates = updates.get("metadata")
            if not isinstance(meta_updates, dict):
                meta_updates = {}
            meta_updates.setdefault("project_name", updates[_alias_hits[0]].strip())
            for k in _alias_hits:
                updates.pop(k, None)  # 多个别名键都移除，只取第一个命中的值
            updates["metadata"] = meta_updates
            import logging as _log
            _log.getLogger(__name__).info(
                "[Q-026] 顶层改名键 %s 已搬运至 metadata.project_name", _alias_hits
            )

        # 字段白名单过滤：拦截受保护字段
        blocked_fields = [k for k in updates.keys() if k not in self.ALLOWED_FIELDS]
        if blocked_fields:
            blocked_str = "、".join(blocked_fields)
            return ToolResult(
                False,
                error=(
                    f"skill_state_writer 拒绝写入受保护字段：{blocked_str}。"
                    f"这些字段必须用专用工具：current_stage/stages → stage_advancer；"
                    f"standard_step_data → artifact_writer。"
                    f"本工具只允许更新元数据：{sorted(self.ALLOWED_FIELDS)}。"
                    f"如需修改项目显示名，请写 updates.metadata.project_name。"
                ),
                data={"blocked_fields": blocked_fields, "allowed_fields": sorted(self.ALLOWED_FIELDS)},
            )

        # 2026-07-23 Q-013：当 AI 通过 skill_state_writer 写入 metadata.teachingMode 时，
        # 自动补上 teachingModeConfirmed=true。
        # 这意味着 AI 可以设置教学模式（它收到了学生的 ask_question 回答后才写），
        # 但至少门禁确保了 teachingMode 必须被显式设置，不能完全跳过。
        # 真正的防绕过在前端 UI 按钮路径（POST /teaching-mode API 同时设置 confirmed）。
        if "metadata" in updates:
            metadata_updates = updates["metadata"]
            if isinstance(metadata_updates, dict) and "teachingMode" in metadata_updates:
                if "teachingModeConfirmed" not in metadata_updates:
                    metadata_updates["teachingModeConfirmed"] = True
                updates["metadata"] = metadata_updates

        history_entry = params.get("history_entry")
        if history_entry:
            existing_state = db.get_skill_state(project_id)
            if existing_state:
                history_raw = getattr(existing_state, "stage_history", "[]")
                history_list = json.loads(history_raw) if isinstance(history_raw, str) else history_raw
                history_entry.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
                history_list.append(history_entry)
                updates["stage_history"] = history_list

        # 2026-07-27 P0 防御：JSON 字段值解包。
        # AI 常把 JSON 对象当字符串传入（如 light_step_data 传 '{"project_name":"x"}' 而非 dict），
        # 若不解包，update_skill_state→json_dumps 会对字符串再编码一层，反复读写后形成多层
        # JSON 编码（项目 9b4ac464 的 light_step_data 被编码 3 层即源于此）。
        # 这里在透传前把 json_keys 中仍是字符串的值 json.loads 成 dict/list，
        # 与 StageAdvancerTool.execute (tools.py stage_advancer) 的 light_step_data 处理对齐。
        _JSON_UPDATES_KEYS = {
            "metadata", "stage_history", "light_step_data", "light_to_standard_mapping",
        }
        for _key in _JSON_UPDATES_KEYS:
            if _key in updates and isinstance(updates[_key], str):
                try:
                    updates[_key] = json.loads(updates[_key])
                except json.JSONDecodeError:
                    pass  # 保留原字符串，交给下游处理

        updated = db.update_skill_state(project_id, updates)
        if not updated:
            return ToolResult(False, error=f"更新失败：未找到项目 {project_id}")

        # Q-026：AI 写 metadata.project_name / display_name 时，立即同步到
        # projects.name（项目列表显示用）。此前只落在 skill_states.metadata，
        # 顶层 name 永不更新，AI 反复"改名"都改了个寂寞。
        # 尊重 name_manually_overridden：用户手动改过名则不覆盖（与 Q-022 一致）。
        if "metadata" in updates and isinstance(updates["metadata"], dict):
            confirmed_name = str(
                updates["metadata"].get("project_name")
                or updates["metadata"].get("display_name")
                or ""
            ).strip()
            if confirmed_name:
                try:
                    project = db.get_project(project_id)
                    initial_data = getattr(project, "initial_data", None) if project else None
                    manually_overridden = (
                        isinstance(initial_data, dict)
                        and initial_data.get("name_manually_overridden") is True
                    )
                    current_name = (getattr(project, "name", "") or "").strip() if project else ""
                    if project and not manually_overridden and current_name != confirmed_name:
                        db.update_project(project_id, {"name": confirmed_name})
                        import logging as _log
                        _log.getLogger(__name__).info(
                            "[Q-026] 项目名随 metadata 同步: %s '%s' -> '%s'",
                            project_id[:8], current_name, confirmed_name,
                        )
                except Exception as name_exc:
                    import logging as _log
                    _log.getLogger(__name__).warning(
                        "[Q-026] 项目名同步失败 project=%s: %s", project_id, name_exc
                    )

        return ToolResult(True, data={"updated_fields": list(updates.keys())})


class StageAdvancerTool(BaseTool):
    """推进项目阶段（含门禁检查）"""

    name = "stage_advancer"
    description = "推进项目到下一个阶段，自动执行门禁检查确保满足完成条件"
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "target_stage": {"type": "string", "description": "目标阶段标识（可选，不填则自动推进到下一阶段）"},
            "evidence": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "artifacts": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "required": ["project_id"],
    }

    STAGE_ORDER_LIGHT = ["step_1", "step_2", "step_3"]
    STAGE_ORDER_STANDARD = [
        "stage_00_bootstrap",
        "stage_01_brainstorm",
        "stage_02_brief",
        "stage_03_constraints",
        "stage_04_track",
        "stage_05_design",
        "stage_06_step_plan",
        "stage_07_execute",
        "stage_08_evaluate",
    ]

    GATE_CHECKS = {
        # 2026-08-20（Q-050）：兼容两套字段——后端原字段（project_name/one_liner/
        # core_features、code_url/key_screenshots）或详情主体区表单字段
        # （topic/goal、steps）任一套填齐即过。
        "step_1_to_step_2": lambda s: bool(
            (s.get("project_name") or s.get("topic"))
            and (s.get("one_liner") or s.get("goal"))
        ),
        "step_2_to_step_3": lambda s: bool(
            s.get("code_url") or s.get("key_screenshots") or s.get("steps")
        ),
        "step_3_to_done": lambda s: True,
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        target_stage = params.get("target_stage")
        evidence = params.get("evidence")

        if not project_id:
            return ToolResult(False, error="缺少必填参数 project_id")

        state = db.get_skill_state(project_id)
        if not state:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        current_stage = getattr(state, "current_stage", "stage_01_brainstorm")
        mode = getattr(state, "mode", "light")
        light_step = getattr(state, "light_step", None)

        if target_stage:
            # 2026-07-22 门禁修复：原来指定 target_stage 时只校验索引、不跑门禁，
            # AI 可以传 target_stage="stage_08_evaluate" 直接跳到终点绕过所有工件检查。
            # 现在改为：
            #   1. 必须是下一阶段（can_advance_to 限制，禁止跨阶段跳）
            #   2. 先跑当前阶段的门禁（check_gate），通过才允许推进
            from app.services.pbl_engine import check_gate
            from app.services.stage_constants import LIGHT_STAGE_ORDER

            if mode == "light":
                # 轻项目模式：校验只能推到下一步
                try:
                    cur_idx = LIGHT_STAGE_ORDER.index(current_stage)
                    tgt_idx = LIGHT_STAGE_ORDER.index(target_stage)
                except ValueError:
                    return ToolResult(False, error=f"无效的阶段标识: {target_stage}")
                if tgt_idx != cur_idx + 1:
                    return ToolResult(
                        False,
                        error=f"轻项目只能逐步推进：当前 {current_stage}，目标 {target_stage} 不合法（只能推到下一步）",
                    )
            else:
                # 标准模式：用 can_advance_to 限制只能推到下一阶段
                if not can_advance_to(current_stage, target_stage):
                    return ToolResult(
                        False,
                        error=(
                            f"门禁拦截：只能从 {current_stage} 推进到下一阶段，"
                            f"不允许直接跳到 {target_stage}（禁止跨阶段跳跃）。"
                            f"请按 stage_00 → stage_01 → ... → stage_08 顺序推进。"
                        ),
                    )
                # 先跑当前阶段门禁
                passed, missing = check_gate(current_stage, getattr(state, "standard_step_data", {}), skill_state=state)
                if not passed:
                    return ToolResult(
                        False,
                        error="门禁检查未通过：当前阶段完成条件尚未满足",
                        data={"missing_requirements": missing, "current_stage": current_stage},
                    )
            # target_stage 合法且门禁通过 → 继续走 standard 推进逻辑
            # （下方 standard 分支会用 advance_with_gate 推进，这里不直接推进）
            if mode == "light" and light_step:
                next_map = {1: 2, 2: 3}
                next_light = next_map.get(int(light_step))
                if next_light:
                    gate_key = f"step_{int(light_step)}_to_step_{next_light}"
                    light_data_raw = getattr(state, "light_step_data", "{}")
                    light_data = json.loads(light_data_raw) if isinstance(light_data_raw, str) else light_data_raw
                    # 2026-08-19（Q-048）：复制引导项目从不写 light_step_data 的
                    # code_url/key_screenshots，原门禁会把它们永久拦在 step_2。
                    # 引导全部任务验证通过（copy_guidance.session_status=completed，
                    # 含真实代码改动+运行检查+证据）视为已满足"有可运行成果"。
                    cg_session_completed = False
                    if gate_key == "step_2_to_step_3":
                        try:
                            _meta_raw = getattr(state, "metadata", "{}") or "{}"
                            _meta = json.loads(_meta_raw) if isinstance(_meta_raw, str) else _meta_raw
                            cg_session_completed = (
                                isinstance(_meta, dict)
                                and ((_meta.get("copy_guidance") or {}).get("session_status") == "completed")
                            )
                        except Exception:
                            cg_session_completed = False
                    gate_failed = (
                        gate_key in self.GATE_CHECKS
                        and not self.GATE_CHECKS[gate_key](light_data)
                        and not cg_session_completed
                    )
                    if gate_failed:
                        return ToolResult(
                            False,
                            error="门禁检查未通过：当前阶段完成条件尚未满足",
                            data={"missing_requirements": "请先填写项目名称、一句话描述和核心功能列表"}
                        )
                    updates = {"light_step": str(next_light), "current_stage": f"step_{next_light}"}
                    if evidence:
                        updates["light_step_data"] = {**light_data, **evidence}
                    db.update_skill_state(project_id, updates)

                    hints = {
                        2: "现在可以开始写代码了！试试修改模板中的文字和颜色",
                        3: "最后一步：写一段简短反思，说说你学到了什么",
                    }
                    return ToolResult(True, data={
                        "previous_stage": f"step_{light_step}",
                        "current_stage": f"step_{next_light}",
                        "message": f"已从「步骤{light_step}」推进到「步骤{next_light}」",
                        "next_hint": hints.get(next_light, "继续推进"),
                    })
                else:
                    return ToolResult(True, data={
                        "message": "轻项目已完成所有步骤！可以生成成果档案卡了",
                        "next_hint": "使用 achievement_card 工具生成成果档案卡",
                    })
            else:
                # 标准轨：通过 pbl_engine 带门禁推进
                result = advance_with_gate(project_id, db)
                if result["success"]:
                    new_stage = result.get("new_stage") or "unknown"
                    stage_hints = {
                        "stage_01_brainstorm": "现在来脑爆选题吧！想 5 个你觉得有趣的项目方向",
                        "stage_02_brief": "来写开题立项书，定义你的项目目标和成功标准",
                        "stage_03_constraints": "把需求分成必须做、最好有、不做三类",
                        "stage_04_track": "确认技术轨道和资源可达性",
                        "stage_05_design": "设计蓝图——先出验收标准，再细化组件结构",
                        "stage_06_step_plan": "制定分步计划，每步都要包含 run/check/rollback",
                        "stage_07_execute": "按里程碑推进并记录开发日志",
                        "stage_08_evaluate": "根据验收标准逐条评估并形成成果档案卡",
                    }
                    # 2026-07-18 事故修复：项目刚完成（进入 stage_08）→ 异步触发资料包自动导出
                    # 让代码有第二份磁盘副本（out/，已纳入 git），防止数据库损坏导致代码永久丢失。
                    # 异步执行：不阻塞阶段推进响应；失败只 log，绝不影响主流程。
                    if result.get("just_completed"):
                        _trigger_auto_export(project_id)
                    # 2026-07-22 Memory 增强：推进成功后自动存储阶段进度到 ZeroClaw memory
                    try:
                        from app.services.zeroclaw_memory import store_stage_history
                        from app.services.stage_constants import STAGE_ORDER
                        completed_stages = STAGE_ORDER[:STAGE_ORDER.index(new_stage)] if new_stage in STAGE_ORDER else [current_stage]
                        store_stage_history(project_id, new_stage, completed_stages)
                    except Exception as mem_exc:
                        import logging as _log
                        _log.getLogger(__name__).warning("memory_store_stage_history failed: %s", mem_exc)

                    return ToolResult(True, data={
                        "previous_stage": current_stage,
                        "current_stage": new_stage,
                        "message": f"已从「{current_stage}」推进到「{new_stage}」",
                        "next_hint": stage_hints.get(new_stage, "继续推进当前阶段"),
                    })
                else:
                    return ToolResult(
                        False,
                        error="门禁检查未通过：当前阶段完成条件尚未满足",
                        data={"missing_requirements": result.get("missing", [])},
                    )

        return ToolResult(False, error="无法自动确定下一阶段")


class ArtifactReaderTool(BaseTool):
    """读取工件内容"""

    name = "artifact_reader"
    description = "读取项目已生成的工件文档内容，如开题报告、技术报告、开发日志等"
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "artifact_name": {"type": "string", "description": "工件名称（必填），如 brainstorm/project_brief/design/dev_log 等"},
        },
        "required": ["project_id", "artifact_name"],
    }

    ARTIFACT_MAP = {
        artifact_name: ("standard_step_data", blob_key)
        for artifact_name, blob_key in ARTIFACT_TO_BLOB_KEY.items()
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        artifact_name = params.get("artifact_name")
        if not project_id or not artifact_name:
            return ToolResult(False, error="缺少必填参数")
        # Q-028: 工件名别名归一（如 evaluation → evaluate）
        artifact_name = normalize_artifact_name(artifact_name)

        state = db.get_skill_state(project_id)
        if not state:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        mapping = self.ARTIFACT_MAP.get(artifact_name)
        if mapping:
            container_key, content_key = mapping
            container_raw = getattr(state, container_key, "{}")
            container = json.loads(container_raw) if isinstance(container_raw, str) else container_raw
            content = container.get(content_key, "")
            status = "valid" if content else "draft"
            return ToolResult(True, data={
                "artifact_name": artifact_name,
                "status": status,
                "content": content[:5000],
            })

        return ToolResult(False, error=f"未知工件名称: {artifact_name}")


class ArtifactWriterTool(BaseTool):
    """生成/更新工件文档"""

    name = "artifact_writer"
    description = (
        "生成或更新项目工件文档，如开题报告、技术报告、开发日志、代码文件等。"
        "完成一次成体系的代码/原理讲解后，用 artifact_name=explanation 沉淀讲解要点（默认追加，不会覆盖已有讲解）"
    )
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "artifact_name": {"type": "string", "description": "工件规范名（必填），只能是：brainstorm/project_brief/constraints/track_plan/design/step_plan/dev_log/evaluate/explanation。验收/评估报告必须用 evaluate（不是 evaluation）；讲解沉淀用 explanation（默认追加到讲解文档，不覆盖）。"},
            "content": {"type": "string", "description": "文档内容（必填）。explanation 时为本次讲解的精炼要点（非聊天原文）"},
            "artifact_type": {"type": "string", "enum": ["document", "code", "report"], "description": "工件类型"},
            "mode": {
                "type": "string",
                "enum": ["replace", "append"],
                "description": "写入模式，仅对 explanation 生效：append=追加带时间戳章节（explanation 默认）；replace=整篇覆盖。其他工件始终整篇覆盖。",
            },
            "topic": {"type": "string", "description": "讲解主题（可选，仅 explanation append 时用作章节标题）"},
        },
        "required": ["project_id", "artifact_name", "content"],
    }

    ARTIFACT_CONTAINER_MAP = {
        artifact_name: ("standard_step_data", blob_key)
        for artifact_name, blob_key in ARTIFACT_TO_BLOB_KEY.items()
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        artifact_name = params.get("artifact_name")
        content = params.get("content")
        artifact_type = params.get("artifact_type", "document")

        if not all([project_id, artifact_name, content]):
            return ToolResult(False, error="缺少必填参数 project_id / artifact_name / content")
        # Q-028: 工件名别名归一（AI 照 SKILL.md 文档常写 evaluation，规范名是 evaluate）
        artifact_name = normalize_artifact_name(artifact_name)

        state = db.get_skill_state(project_id)
        if not state:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        # 讲解文档（2026-07-31）：累加式工件，默认 append（防 AI 误覆盖已累加的
        # 讲解历史），显式 mode=replace 才整篇覆盖；无阶段门禁。
        if artifact_name == "explanation" and params.get("mode") != "replace":
            from app.services.explanation_doc import append_explanation_section
            result = append_explanation_section(
                project_id, content, topic=params.get("topic"), db=db,
            )
            if result.get("status") in ("appended", "duplicate"):
                return ToolResult(True, data=result)
            return ToolResult(False, error=result.get("error") or "讲解文档写入失败", data=result)

        # 2026-07-22 阶段门禁：写入某工件时，当前阶段必须 >= 该工件所属阶段。
        # 防止 AI 在 stage_01 脑爆阶段就写 stage_08 的 evaluate 工件（越权写后续工件）。
        current_stage = getattr(state, "current_stage", "")
        if current_stage and artifact_name in self.ARTIFACT_CONTAINER_MAP:
            allowed, reason = artifact_stage_gate(artifact_name, current_stage)
            if not allowed:
                return ToolResult(False, error=f"阶段门禁拦截：{reason}")

        mapping = self.ARTIFACT_CONTAINER_MAP.get(artifact_name)
        if mapping:
            result = save_artifact(project_id, artifact_name, content, db)
            if result.get("status") == "valid":
                # Q-027：AI 更新验收文档（evaluate）时，把新文档解析出的字段正向
                # 覆盖进 step8.payload——否则前端评估卡片读的旧 payload 永远不变，
                # 且水合逻辑会用旧 payload 把 AI 刚写的内容反向回滚
                # （build_stage08_payload 的优先级是"已有 payload 最高"，
                # 对 AI 主动重写的场景必须在这里反转）。
                if artifact_name == "evaluate":
                    try:
                        from app.services.stage08_sync import (
                            _parse_evaluate_content,
                            ensure_dict,
                            merge_stage08_into_standard_data,
                        )
                        parsed_fields = _parse_evaluate_content(content)
                        if parsed_fields:
                            fresh_state = db.get_skill_state(project_id)
                            standard_data = ensure_dict(
                                getattr(fresh_state, "standard_step_data", None) or {}
                            )
                            old_payload = ensure_dict(
                                ensure_dict(standard_data.get("step8")).get("payload")
                            )
                            new_payload = {**old_payload, **{
                                k: v for k, v in parsed_fields.items() if v and v.strip()
                            }}
                            merged = merge_stage08_into_standard_data(
                                standard_data,
                                new_payload,
                                # 不覆盖 evaluate_content：save_artifact 刚写入的 AI 原文是权威源
                                sync_evaluate_content=False,
                            )
                            db.update_skill_state(project_id, {"standard_step_data": merged})
                            result["stage08_payload_synced"] = True
                    except Exception as sync_exc:
                        import logging as _log
                        _log.getLogger(__name__).warning(
                            "stage08_payload_sync_failed project=%s: %s", project_id, sync_exc
                        )
                return ToolResult(True, data=result)
            return ToolResult(False, error=f"写入工件失败: {artifact_name}", data=result)

        return ToolResult(False, error=f"未知工件名称: {artifact_name}")


class EvidenceSaverTool(BaseTool):
    """保存证据"""

    name = "evidence_saver"
    description = "保存项目过程中的证据，包括对话摘要、代码片段、运行结果、截图等"
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "type": {
                "type": "string",
                # 2026-07-22 修复：枚举与 schemas/evidence.py 的合法值对齐。
                # 原来声明 [code, dialogue_summary, screenshot, run_result] 与
                # Evidence.type 的 Literal[code_snapshot, text_log, ...] 交集只有 screenshot，
                # 导致非 screenshot 的证据一落库就 pydantic 校验崩溃。
                "enum": ["code_snapshot", "text_log", "screenshot", "file_upload", "dialogue_summary", "run_result", "code"],
                "description": "证据类型（必填）。推荐用 code_snapshot/text_log/screenshot；dialogue_summary/run_result/code 会被自动映射",
            },
            "title": {"type": "string", "description": "证据标题（必填）"},
            "content": {"type": "string", "description": "证据内容（必填）"},
            "stage": {"type": "string", "description": "关联阶段（可选）"},
        },
        "required": ["project_id", "type", "title", "content"],
    }

    # AI 友好的类型名 → 合法 Evidence.type 的映射
    TYPE_ALIAS_MAP: dict[str, str] = {
        "code": "code_snapshot",
        "code_snapshot": "code_snapshot",
        "dialogue_summary": "auto_ai_summary",
        "run_result": "text_log",
        "text_log": "text_log",
        "screenshot": "screenshot",
        "file_upload": "file_upload",
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        from app.schemas.evidence import Evidence

        project_id = params.get("project_id")
        ev_type_raw = params.get("type")
        title = params.get("title")
        content = params.get("content")
        stage = params.get("stage")

        # 2026-07-22 修复：把 AI 友好的类型名映射成 Evidence 模型的合法枚举值。
        # 避免传 "code"/"dialogue_summary" 等导致 pydantic 校验崩溃。
        ev_type = self.TYPE_ALIAS_MAP.get(ev_type_raw or "", ev_type_raw or "")
        if ev_type not in {"code_snapshot", "video_record", "screenshot", "text_log", "file_upload", "auto_stage_change", "auto_ai_summary"}:
            return ToolResult(
                False,
                error=f"无效的证据类型: {ev_type_raw}。合法值: code_snapshot, text_log, screenshot, file_upload, dialogue_summary, run_result",
            )

        if not all([project_id, ev_type_raw, title, content]):
            return ToolResult(False, error="缺少必填参数")

        project = db.get_project(project_id)
        if not project:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        evidence = Evidence(
            id=str(uuid.uuid4()),
            project_id=project_id,
            author_id=getattr(project, "author_id", ""),
            type=ev_type,
            title=title,
            content=content,
            related_step=stage or getattr(project, "current_stage", ""),
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        created = db.create_evidence(evidence)
        return ToolResult(True, data={
            "evidence_id": created.id,
            "message": f"已保存为证据：{title}",
        })


class CodeRunnerTool(BaseTool):
    """执行代码"""

    name = "code_runner"
    description = "执行 Python 或 JavaScript 代码并返回运行结果"
    parameters_schema = {
        "type": "object",
        "properties": {
            "code": {"type": "string", "description": "要执行的代码（必填）"},
            "language": {"type": "string", "enum": ["python", "javascript"], "description": "编程语言（必填）"},
            "stdin": {"type": "string", "description": "标准输入（可选）"},
        },
        "required": ["code", "language"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        # 2026-07-18 事故修复：原实现 Python 分支用进程内 exec()，脚本和后端共享
        # 进程/内存/密钥/数据库句柄——AI 诊断脚本能扫描 D:/data/finestem/ 全目录、
        # 读取 ZEROCLAW_API_KEY。现改为通过 code_sandbox 模块在隔离的临时目录 +
        # 过滤后的 env 里执行。同时修复了原 exec() 路径的超时死代码 bug。
        import asyncio
        from app.services.code_sandbox import run_python_sandboxed, run_javascript_sandboxed

        code = params.get("code", "")
        language = params.get("language", "python")
        stdin_input = params.get("stdin", "")

        if not code.strip():
            return ToolResult(False, error="代码不能为空")

        started = datetime.now(timezone.utc)
        loop = asyncio.get_event_loop()

        try:
            if language == "javascript":
                result = await loop.run_in_executor(
                    None, run_javascript_sandboxed, code, 10, stdin_input,
                )
            else:
                result = await loop.run_in_executor(
                    None, run_python_sandboxed, code, 10, stdin_input,
                )
        except Exception as exc:
            return ToolResult(True, data={
                "success": False,
                "stdout": "",
                "stderr": str(exc),
                "exit_code": 1,
                "execution_time_ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000),
            })

        exec_time_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)

        return ToolResult(True, data={
            "success": result["success"],
            "stdout": result["stdout"] or "(无输出)",
            "stderr": result["stderr"] or "",
            "exit_code": result["exit_code"],
            "execution_time_ms": exec_time_ms,
        })


class ProjectCodeWriterTool(BaseTool):
    """将生成的代码写入项目工作区。"""

    name = "project_code_writer"
    description = (
        "将完整可运行代码保存到指定项目的编辑器工作区，确保 AI 生成的代码真实落盘。"
        "长代码请分块写入：第一次 mode=replace 写文件开头，后续 mode=append 逐块追加到同一文件，"
        "避免单次 code 参数过大触发 token 截断"
    )
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "code": {"type": "string", "description": "源代码（必填）。mode=append 时为要追加到文件末尾的代码片段"},
            "language": {"type": "string", "description": "代码语言，如 html/python/javascript/typescript/css"},
            "filename": {"type": "string", "description": "主文件名，如 index.html 或 main.py"},
            "mode": {
                "type": "string",
                "enum": ["replace", "append"],
                "description": "写入模式：replace=整文件覆盖（默认）；append=追加到同名文件末尾（长代码分块写入，防截断）",
            },
        },
        "required": ["project_id", "code"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = str(params.get("project_id") or "").strip()
        code = str(params.get("code") or "")
        language = str(params.get("language") or "html").strip().lower() or "html"
        filename = str(params.get("filename") or "").strip() or _guess_code_filename(language)
        mode = str(params.get("mode") or "replace").strip().lower()
        if mode not in ("replace", "append"):
            mode = "replace"
        if not project_id:
            return ToolResult(False, error="缺少必填参数 project_id")
        if len(code.strip()) <= 10:
            return ToolResult(False, error="代码内容为空或过短")

        # === 阶段代码锁（2026-07-23 Q-013 修复）===
        # 只有 stage_05_design / stage_07_execute / stage_08_evaluate 允许写代码。
        # 其他阶段（stage_00~04、stage_06）禁止写代码——PBL 要求先完成设计再编码。
        skill_state = db.get_skill_state(project_id)
        if skill_state:
            current_stage = getattr(skill_state, "current_stage", "")
            if current_stage and not is_code_allowed_stage(current_stage):
                return ToolResult(
                    False,
                    error=(
                        f"阶段代码锁：当前阶段「{current_stage}」不允许写代码。"
                        f"只有设计蓝图（stage_05）、编码实现（stage_07）、验收展示（stage_08）阶段才能写代码。"
                        f"请先通过 stage_advancer 按顺序推进到允许写代码的阶段。"
                    ),
                    data={
                        "gate": "code_stage_lock",
                        "current_stage": current_stage,
                        "allowed_stages": sorted(CODE_ALLOWED_STAGES),
                    },
                )

        # === MVP 模板代码拦截（最后一道防线）===
        mvp_markers = [
            "fineSTEM MVP", "我的 STEM 项目 MVP",
            "actionButton", "已成功运行",
            "这是一个可运行的最小版本",
            "你可以继续让 AI 按你的项目主题扩展功能",
        ]
        detected_mvp = [m for m in mvp_markers if m in code]
        if detected_mvp:
            import logging
            logging.warning(
                "[MVP_BLOCK] project_code_writer 拦截到 MVP 模板代码，拒绝写入! "
                "markers=%s project_id=%s code_len=%d",
                detected_mvp, project_id, len(code),
            )
            return ToolResult(
                False,
                error=(
                    f"检测到模板化占位代码（包含：{', '.join(detected_mvp)}），"
                    f"这不是真实的项目代码。请根据用户实际需求生成完整的项目实现代码，"
                    f"不要使用任何最小版本/MVP/模板/占位符代码。"
                ),
            )

        # === stage_07_execute 教学模式门禁（2026-07-23 Q-012 + Q-013 强化）===
        # 问题：AI 进入编码阶段后不询问学生教学模式（引导/演示/动手/讲解），直接吐代码。
        # 门禁：stage_07_execute 阶段写代码前，必须先通过 ask_question 让学生选择教学模式，
        #       然后调用 skill_state_writer 设置 metadata.teachingMode。未设置则拒绝写代码。
        # Q-013 强化：额外检查 metadata.teachingModeConfirmed == True，
        #       防止 AI 自行通过 skill_state_writer 直接设置 teachingMode 绕过学生交互。
        if skill_state:
            if current_stage == "stage_07_execute":
                metadata_raw = getattr(skill_state, "metadata", "{}")
                metadata_dict = json.loads(metadata_raw) if isinstance(metadata_raw, str) else metadata_raw
                teaching_mode = metadata_dict.get("teachingMode")
                confirmed = metadata_dict.get("teachingModeConfirmed", False)
                valid_modes = {"guided", "demo", "hands_on", "lecture"}
                if teaching_mode not in valid_modes or not confirmed:
                    return ToolResult(
                        False,
                        error=(
                            "教学模式未选择：进入编码阶段（stage_07_execute）后，必须先调用 ask_question "
                            "让学生选择教学模式（引导式/演示式/动手式/讲解式），学生回答后再调用 "
                            "skill_state_writer 设置 metadata.teachingMode 和 metadata.teachingModeConfirmed=true，"
                            "然后才能开始写代码。请现在先向学生提问选择教学模式。"
                        ),
                        data={
                            "gate": "teaching_mode_required",
                            "valid_modes": sorted(valid_modes),
                            "instruction": "请调用 ask_question(title='你想用哪种方式开始编码？', options=[{id:'guided',label:'引导式',description:'给框架+TODO，指出下一步你来补什么'},{id:'demo',label:'演示式',description:'先展示完整代码，再拆解模仿'},{id:'hands_on',label:'动手式',description:'给任务+验证标准，不给完整答案'},{id:'lecture',label:'讲解式',description:'先讲原理→设计思路→关键代码→结果验证'}])",
                        },
                    )

        saved_at = utc_now().isoformat()

        # === 多文件支持：读取现有文件列表，upsert 当前文件 ===
        existing_ws = db.get_project_workspace(project_id)
        existing_files: list[dict] = []
        if existing_ws and isinstance(existing_ws.get("files"), list):
            existing_files = list(existing_ws["files"])

        # === append 分块模式（2026-07-30 截断治理）===
        # 长代码单次作为工具参数传入会触发 LLM output token 上限截断（Q-023 实证）。
        # append 模式允许 AI 把大文件拆成多次调用逐块写入：本片段拼接到同名文件末尾。
        if mode == "append":
            prev_entry = next((f for f in existing_files if f.get("name") == filename), None)
            prev_content = str(prev_entry.get("content") or "") if prev_entry else ""
            if prev_content:
                joiner = "" if prev_content.endswith("\n") or code.startswith("\n") else "\n"
                code = f"{prev_content}{joiner}{code}"
            # 文件不存在时 append 退化为首次写入（不报错，方便 AI 无脑分块）

        # 构建新文件条目
        new_file_entry = {
            "name": filename,
            "language": language,
            "content": code,
            "is_main": True,  # 当前写入的文件标记为主文件
        }

        # Upsert：移除同名旧文件，追加新文件
        updated_files = [f for f in existing_files if f.get("name") != filename]
        updated_files.append(new_file_entry)

        # 确保只有一个 is_main 文件（index.html 优先）
        main_candidates = [f for f in updated_files if f.get("name") in ("index.html", "main.py", "main.ts")]
        if main_candidates:
            for f in updated_files:
                f["is_main"] = f.get("name") == main_candidates[0].get("name")
        else:
            # 没有主文件候选时，保持最后一个写入的为 main
            for i, f in enumerate(updated_files):
                f["is_main"] = (i == len(updated_files) - 1)

        workspace = db.save_project_workspace(project_id, {
            "code": code,
            "language": language,
            "filename": filename,
            "files": updated_files,
            "saved_at": saved_at,
        })
        if workspace is None:
            return ToolResult(False, error=f"未找到项目 {project_id}")
        # 2026-07-28 Q-019 修复：data 必须回带 code/files。
        # 前端 useStreamingChat 的 tool_result 路径会直接读 out.code/out.files 写编辑器
        # （另一条 code_generated 事件路径由 orchestrator 单独发送）。
        # 此前 data 只返回元数据，导致 tool_result 路径拿不到代码，编辑器空白。
        return ToolResult(True, data={
            "project_id": project_id,
            "code": code,
            "language": language,
            "filename": filename,
            "files": updated_files,
            "saved_at": saved_at,
            "code_length": len(code),
            "write_mode": mode,
        })


class ProjectCodeReaderTool(BaseTool):
    """读取项目工作区已保存的代码（2026-07-30 新增）。

    背景：学生汇报"按钮点击没反应"等代码问题时，AI 此前没有任何途径读回
    工作区代码（15 个工具只有写代码的 project_code_writer），只能给泛泛建议。
    本工具让 AI 读取学生编辑器里的真实代码，进行针对性诊断。
    """

    name = "project_code_reader"
    description = (
        "读取项目编辑器工作区中已保存的代码文件。学生汇报 bug/报错/功能不工作时，"
        "必须先调用本工具读取当前代码，再基于真实代码定位问题，不要凭空猜测"
    )
    # 单文件内容返回上限：防止超大文件撑爆 LLM 输入上下文
    MAX_CONTENT_CHARS = 60000

    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "filename": {
                "type": "string",
                "description": "要读取的文件名（可选）。不传则返回全部文件的内容与清单",
            },
            "list_only": {
                "type": "boolean",
                "description": "true 时只返回文件清单（文件名/语言/大小），不返回内容",
            },
        },
        "required": ["project_id"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = str(params.get("project_id") or "").strip()
        filename = str(params.get("filename") or "").strip()
        list_only = bool(params.get("list_only"))
        if not project_id:
            return ToolResult(False, error="缺少必填参数 project_id")

        workspace = db.get_project_workspace(project_id)
        if workspace is None:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        files: list[dict] = []
        if isinstance(workspace.get("files"), list):
            files = [f for f in workspace["files"] if isinstance(f, dict)]
        # 兼容旧数据：files 为空但顶层有 code 时合成单文件条目
        if not files and workspace.get("code"):
            files = [{
                "name": workspace.get("filename") or _guess_code_filename(str(workspace.get("language") or "html")),
                "language": workspace.get("language") or "html",
                "content": workspace.get("code") or "",
                "is_main": True,
            }]

        if not files:
            return ToolResult(True, data={
                "project_id": project_id,
                "files": [],
                "total_files": 0,
                "message": "工作区为空：该项目还没有保存过任何代码文件",
            })

        manifest = [{
            "name": f.get("name"),
            "language": f.get("language"),
            "is_main": bool(f.get("is_main")),
            "chars": len(str(f.get("content") or "")),
        } for f in files]

        if list_only:
            return ToolResult(True, data={
                "project_id": project_id,
                "files": manifest,
                "total_files": len(manifest),
                "saved_at": workspace.get("saved_at"),
            })

        def _pack(entry: dict) -> dict:
            content = str(entry.get("content") or "")
            truncated = len(content) > self.MAX_CONTENT_CHARS
            return {
                "name": entry.get("name"),
                "language": entry.get("language"),
                "is_main": bool(entry.get("is_main")),
                "chars": len(content),
                "truncated": truncated,
                "content": content[: self.MAX_CONTENT_CHARS],
            }

        if filename:
            target = next((f for f in files if f.get("name") == filename), None)
            if target is None:
                return ToolResult(False, error=(
                    f"文件 {filename} 不存在。工作区现有文件："
                    f"{', '.join(str(m['name']) for m in manifest)}"
                ), data={"files": manifest})
            return ToolResult(True, data={
                "project_id": project_id,
                "file": _pack(target),
                "total_files": len(manifest),
                "saved_at": workspace.get("saved_at"),
            })

        return ToolResult(True, data={
            "project_id": project_id,
            "files": [_pack(f) for f in files],
            "total_files": len(manifest),
            "saved_at": workspace.get("saved_at"),
        })


def _guess_code_filename(language: str) -> str:
    normalized = (language or "").lower()
    if normalized == "html":
        return "index.html"
    if normalized in {"javascript", "js"}:
        return "main.js"
    if normalized in {"typescript", "ts"}:
        return "main.ts"
    if normalized == "css":
        return "style.css"
    if normalized in {"python", "py"}:
        return "main.py"
    return "main.txt"


class ResourceSearcherTool(BaseTool):
    """检索和推荐资源"""

    name = "resource_searcher"
    description = "检索 Demo 模板、课程或知识库，推荐匹配的资源给学生"
    parameters_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "搜索关键词（必填）"},
            "type": {"type": "string", "enum": ["demo", "course", "knowledge"], "description": "资源类型（可选，默认全部）"},
            "tags": {"type": "array", "items": {"type": "string"}, "description": "标签过滤（可选）"},
            "limit": {"type": "integer", "description": "返回数量上限（默认5）"},
        },
        "required": ["query"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        query = params.get("query", "")
        res_type = params.get("type")
        tags = params.get("tags", [])
        limit = params.get("limit", 5)

        results = []
        if res_type in (None, "demo"):
            demos = db.list_demos(skip=0, limit=min(limit, 20), search=query)
            for d in demos[:limit]:
                tech_stack_raw = getattr(d, "tech_stack", "[]")
                tech_stack = json.loads(tech_stack_raw) if isinstance(tech_stack_raw, str) else tech_stack_raw
                subjects_raw = getattr(d, "subjects", "[]")
                subjects = json.loads(subjects_raw) if isinstance(subjects_raw, str) else subjects_raw
                match_reason = ""
                if query.lower() in getattr(d, "name", "").lower():
                    match_reason = "名称匹配"
                elif any(t in subjects for t in tags):
                    match_reason = "学科标签匹配"
                elif any(t in tech_stack for t in tags):
                    match_reason = "技术栈匹配"
                else:
                    match_reason = "关键词相关"
                results.append({
                    "id": getattr(d, "id", ""),
                    "type": "demo",
                    "title": getattr(d, "name", ""),
                    "difficulty": getattr(d, "difficulty", "beginner"),
                    "tech_stack": tech_stack,
                    "subjects": subjects,
                    "match_reason": match_reason,
                })

        if res_type in (None, "course"):
            courses = db.list_courses(owner_id="")
            matching_courses = [c for c in courses if query.lower() in getattr(c, "title", "").lower()]
            for c in matching_courses[:min(limit - len(results), 3)]:
                results.append({
                    "id": getattr(c, "id", ""),
                    "type": "course",
                    "title": getattr(c, "title", ""),
                    "subject": getattr(c, "subject", ""),
                    "difficulty": getattr(c, "difficulty", "beginner"),
                    "match_reason": "课程名称匹配",
                })

        return ToolResult(True, data={"results": results[:limit], "total": len(results)})


class ProjectCreatorTool(BaseTool):
    """创建项目 / Fork Demo"""

    name = "project_creator"
    description = "创建新项目或从 Demo Fork 项目"
    parameters_schema = {
        "type": "object",
        "properties": {
            "source_type": {"type": "string", "enum": ["demo_fork", "blank"], "description": "来源类型（必填）"},
            "source_demo_id": {"type": "string", "description": "Demo ID（demo_fork 时必填）"},
            "name": {"type": "string", "description": "项目名称（必填）"},
            "description": {"type": "string", "description": "项目描述（可选）"},
            "mode": {"type": "string", "enum": ["light", "standard"], "description": "项目模式（默认 light）"},
            "author_id": {"type": "string", "description": "作者 ID（必填）"},
        },
        "required": ["source_type", "name", "author_id"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        from app.schemas.projects import Project

        source_type = params.get("source_type")
        name = params.get("name")
        author_id = params.get("author_id")
        mode = params.get("mode", "light")
        description = params.get("description", "")

        if not all([source_type, name, author_id]):
            return ToolResult(False, error="缺少必填参数 source_type / name / author_id")

        initial_data: Dict[str, Any] = {}
        demo = None
        if source_type == "demo_fork":
            demo_id = params.get("source_demo_id")
            if not demo_id:
                return ToolResult(False, error="demo_fork 模式需要提供 source_demo_id")
            demo = db.get_demo(demo_id)
            if not demo:
                return ToolResult(False, error=f"未找到 Demo: {demo_id}")
            initial_data = {
                "from_demo_id": demo_id,
                "demo_name": getattr(demo, "name", ""),
            }

        project = Project(
            id=str(uuid.uuid4()),
            author_id=author_id,
            name=name,
            mode=mode,
            description=description,
            from_demo_id=(getattr(demo, "id", None) if demo else None),
            current_stage=("step_2" if demo and mode == "light" else ("step_1" if mode == "light" else "stage_00_bootstrap")),
            initial_data=initial_data,
        )
        created = db.create_project(project)
        if demo:
            db.save_project_workspace(
                created.id,
                build_demo_workspace_payload(demo.minimal_replica, demo_name=demo.name),
                updated_by=author_id,
            )
        if created.mode == "light":
            step_seed = {
                "project_name": created.name,
                "one_liner": description or f"{created.name} 的首个可运行版本",
                "core_features": [description] if description else ["生成首个可运行版本"],
            }
            db.update_skill_state(
                created.id,
                {
                    "light_step_data": step_seed,
                },
            )

        suggestions = []
        if demo:
            suggestions.extend([
                f"试试修改「{getattr(demo, 'name', '')}」的显示文字",
                "添加一个新功能按钮",
                "改变颜色主题",
            ])
        else:
            suggestions.extend([
                "先确定你想做什么类型的 Web 应用",
                "考虑用 HTML/CSS/JS 做一个简单原型",
                "或者用 Python + Streamlit 做数据分析工具",
            ])

        # 2026-07-22 Memory 增强：创建项目后自动存储项目画像到 ZeroClaw memory
        try:
            from app.services.zeroclaw_memory import store_project_profile
            store_project_profile(created.id, {
                "project_name": created.name,
                "mode": created.mode,
                "description": description,
                "current_stage": created.current_stage,
                "created_at": utc_now().isoformat(),
            })
        except Exception as mem_exc:
            import logging as _log
            _log.getLogger(__name__).warning("memory_store_project_profile failed: %s", mem_exc)

        return ToolResult(True, data={
            "project_id": created.id,
            "name": created.name,
            "mode": created.mode,
            "current_stage": created.current_stage,
            "initial_code": getattr(demo, "minimal_replica", "") if demo else "",
            "suggestions": suggestions,
        })


class AchievementCardTool(BaseTool):
    """生成/更新项目成果档案卡"""

    name = "achievement_card"
    description = "为当前项目生成或更新成果档案卡（成果总结）。当项目完成验收、需要生成最终成果展示时调用此工具。"
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "title": {"type": "string", "description": "档案卡标题，如“XX 项目成果档案卡”（必填）"},
            "one_liner": {"type": "string", "description": "一句话介绍项目成果（必填）"},
            "problem_solved": {"type": "string", "description": "我解决了什么问题，核心挑战是什么（必填）"},
            "method_used": {"type": "string", "description": "我用了什么方法/技术/流程来解决问题（必填）"},
            "reflection": {"type": "string", "description": "我的反思与收获，如果重新做会怎么做（必填）"},
            "capability_tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "AI 总结的能力标签列表，如 ['前端开发', '数据分析', '项目管理']",
            },
            "screenshots": {
                "type": "array",
                "items": {"type": "string"},
                "description": "项目截图或演示链接列表",
            },
        },
        "required": ["project_id", "title", "one_liner", "problem_solved", "method_used", "reflection"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        title = params.get("title", "")
        one_liner = params.get("one_liner", "")
        problem_solved = params.get("problem_solved", "")
        method_used = params.get("method_used", "")
        reflection = params.get("reflection", "")
        capability_tags = params.get("capability_tags", [])
        screenshots = params.get("screenshots", [])

        if not all([project_id, title, one_liner, problem_solved, method_used, reflection]):
            return ToolResult(False, error="缺少必填参数：project_id / title / one_liner / problem_solved / method_used / reflection")

        # 2026-07-22 阶段门禁：成果档案卡只能在 stage_08_evaluate（验收阶段）生成。
        # 原实现无门禁，AI 可在 stage_00 就创建最终成果卡，违背 PBL 流程。
        # 注意：门禁检查必须在延迟 import 之前，否则 import 失败会让门禁形同虚设。
        skill_state = db.get_skill_state(project_id)
        current_stage = getattr(skill_state, "current_stage", "") if skill_state else ""
        if current_stage and current_stage != "stage_08_evaluate":
            # 2026-08-19（Q-048）：light 模式收官放行——复制引导全部任务完成并推进到
            # step_3（展示与反思）后允许生成。原门禁只认标准模式 stage_08，light 项目
            # 永远无法通过 AI 生成正式成果卡（只能走详情页手动按钮）。
            state_mode = getattr(skill_state, "mode", "") if skill_state else ""
            if not (state_mode == "light" and current_stage == "step_3"):
                return ToolResult(
                    False,
                    error=(
                        f"阶段门禁拦截：achievement_card 只能在 stage_08_evaluate（验收阶段）"
                        f"或 light 项目 step_3（展示与反思）生成。当前阶段是 {current_stage}。"
                        f"请先通过 stage_advancer 按门禁推进。"
                    ),
                    data={"current_stage": current_stage, "required_stage": "stage_08_evaluate"},
                )

        # 门禁通过后才延迟导入（避免循环依赖）
        # 注：db.create_achievement_card 期望的是 schema AchievementCard（与 projects.py 一致），
        # 而非 ORM 模型 AchievementCardModel。早前误写为 from app.db.models import
        # AchievementCard 会引发 ImportError（模型名实为 AchievementCardModel），导致成果卡生成失败。
        from app.schemas.achievements import AchievementCard
        from app.schemas.achievements import AchievementCardCreate
        from app.services.stage08_sync import build_stage08_payload, merge_stage08_into_standard_data

        # 检查是否已有该项目的档案卡，有则更新，无则创建
        existing_card = db.get_achievement_card_by_project(project_id)
        if existing_card:
            update_data = {
                "title": title,
                "one_liner": one_liner,
                "problem_solved": problem_solved,
                "method_used": method_used,
                "reflection": reflection,
                "capability_tags": capability_tags or existing_card.capability_tags,
                "screenshots": screenshots or existing_card.screenshots,
            }
            updated = db.update_achievement_card(existing_card.id, update_data)
            skill_state = db.get_skill_state(project_id)
            stage08_payload = build_stage08_payload(
                skill_state.standard_step_data if skill_state else {},
                achievement_card=updated or existing_card,
                draft_data={
                    "title": title,
                    "one_liner": one_liner,
                    "problem_solved": problem_solved,
                    "method_used": method_used,
                    "reflection": reflection,
                },
            )
            merged_standard_data = merge_stage08_into_standard_data(
                skill_state.standard_step_data if skill_state else {},
                stage08_payload,
            )
            db.update_skill_state(project_id, {"standard_step_data": merged_standard_data})
            return ToolResult(True, data={
                "action": "updated",
                "card_id": updated.id if updated else existing_card.id,
                "message": f"已更新项目 {project_id} 的成果档案卡",
            })

        # 获取项目信息确定 author_id 和 mode
        project = db.get_project(project_id)
        if not project:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        card = AchievementCard(
            id=str(uuid.uuid4()),
            project_id=project_id,
            author_id=project.author_id,
            title=title,
            one_liner=one_liner,
            problem_solved=problem_solved,
            method_used=method_used,
            reflection=reflection,
            capability_tags=capability_tags or [],
            screenshots=screenshots or [],
            project_mode=getattr(project, 'mode', 'standard'),
            created_by=project.author_id,
        )
        created = db.create_achievement_card(card)
        skill_state = db.get_skill_state(project_id)
        stage08_payload = build_stage08_payload(
            skill_state.standard_step_data if skill_state else {},
            achievement_card=created,
            draft_data={
                "title": title,
                "one_liner": one_liner,
                "problem_solved": problem_solved,
                "method_used": method_used,
                "reflection": reflection,
            },
        )
        merged_standard_data = merge_stage08_into_standard_data(
            skill_state.standard_step_data if skill_state else {},
            stage08_payload,
        )
        db.update_skill_state(project_id, {"standard_step_data": merged_standard_data})
        return ToolResult(True, data={
            "action": "created",
            "card_id": created.id,
            "message": f"已为项目 {project_id} 创建成果档案卡",
        })




class ProjectMemoryStoreTool(BaseTool):
    """存储项目级记忆到 ZeroClaw memory（跨 session 持久化）"""

    name = "project_memory_store"
    description = (
        "存储项目级记忆到 ZeroClaw 持久记忆库。"
        "用于跨会话持久化学生画像、阶段进度等。"
        "键格式: finestem:project:{project_id}:{key}。"
        "值必须是 JSON 字符串。"
    )
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "key": {
                "type": "string",
                "description": "记忆键后缀（如 profile / stage_history）。完整键为 finestem:project:{project_id}:{key}",
            },
            "value": {"type": "string", "description": "记忆值（JSON 字符串，必填）"},
            "category": {"type": "string", "description": "分类（默认 project）"},
        },
        "required": ["project_id", "key", "value"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        from app.services.zeroclaw_memory import store_memory, KEY_PREFIX

        project_id = params.get("project_id")
        key_suffix = params.get("key")
        value = params.get("value")
        category = params.get("category", "project")

        if not all([project_id, key_suffix, value]):
            return ToolResult(False, error="缺少必填参数 project_id / key / value")

        full_key = f"{KEY_PREFIX}:project:{project_id}:{key_suffix}"
        result = store_memory(full_key, value, category=category)

        if result.get("success"):
            return ToolResult(True, data={
                "key": full_key,
                "action": result.get("action", "stored"),
                "message": f"已存储项目记忆: {key_suffix}",
            })
        return ToolResult(False, error=result.get("error", "存储失败"))


class ProjectMemoryRecallTool(BaseTool):
    """召回项目级记忆"""

    name = "project_memory_recall"
    description = (
        "召回项目级记忆。可指定 key 精确召回，或用 query 关键词模糊搜索。"
        "学生重新打开项目时自动召回 profile 和 stage_history。"
    )
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "key": {
                "type": "string",
                "description": "记忆键后缀（如 profile / stage_history）。指定时精确匹配。",
            },
            "query": {"type": "string", "description": "全文搜索关键词（key 未指定时使用）"},
        },
        "required": ["project_id"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        from app.services.zeroclaw_memory import recall_memory, KEY_PREFIX

        project_id = params.get("project_id")
        key_suffix = params.get("key")
        query = params.get("query")

        if not project_id:
            return ToolResult(False, error="缺少必填参数 project_id")

        if key_suffix:
            full_key = f"{KEY_PREFIX}:project:{project_id}:{key_suffix}"
            result = recall_memory(key=full_key)
        elif query:
            result = recall_memory(query=f"{KEY_PREFIX}:project:{project_id} {query}")
        else:
            # 默认召回该项目的所有记忆
            result = recall_memory(query=f"{KEY_PREFIX}:project:{project_id}")

        if result.get("success"):
            memories = result.get("memories", [])
            # 尝试解析 JSON 值
            parsed_memories = []
            for mem in memories:
                try:
                    parsed = json.loads(mem["content"])
                    parsed_memories.append({"key": mem["key"], "data": parsed})
                except (json.JSONDecodeError, KeyError):
                    parsed_memories.append(mem)
            return ToolResult(True, data={
                "memories": parsed_memories,
                "count": len(parsed_memories),
                "message": f"找到 {len(parsed_memories)} 条记忆" if parsed_memories else "无记忆",
            })
        return ToolResult(False, error=result.get("error", "召回失败"))


class SopStateSyncTool(BaseTool):
    """同步 SOP 运行状态到 SKILL_STATE"""

    name = "sop_state_sync"
    description = (
        "将 ZeroClaw SOP 运行状态同步到项目 SKILL_STATE。"
        "当 SOP 推进到新步骤时，同步更新项目的 current_stage 和 metadata.sop_run_id。"
    )
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "sop_run_id": {"type": "string", "description": "SOP 运行 ID"},
            "current_step": {"type": "string", "description": "当前 SOP 步骤"},
            "step_status": {
                "type": "string",
                "enum": ["pending", "in_progress", "completed", "failed", "skipped"],
                "description": "步骤状态",
            },
        },
        "required": ["project_id", "current_step", "step_status"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        sop_run_id = params.get("sop_run_id")
        current_step = params.get("current_step")
        step_status = params.get("step_status")

        if not all([project_id, current_step, step_status]):
            return ToolResult(False, error="缺少必填参数 project_id / current_step / step_status")

        state = db.get_skill_state(project_id)
        if not state:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        # 更新 metadata 中的 SOP 状态
        metadata_raw = getattr(state, "metadata", "{}")
        metadata = json.loads(metadata_raw) if isinstance(metadata_raw, str) else metadata_raw
        metadata["sop_run_id"] = sop_run_id
        metadata["sop_current_step"] = current_step
        metadata["sop_step_status"] = step_status
        metadata["sop_last_sync"] = utc_now().isoformat()

        updated = db.update_skill_state(project_id, {"metadata": metadata})
        if not updated:
            return ToolResult(False, error=f"更新失败：未找到项目 {project_id}")

        return ToolResult(True, data={
            "project_id": project_id,
            "sop_run_id": sop_run_id,
            "current_step": current_step,
            "step_status": step_status,
            "message": f"SOP 状态已同步: {current_step} ({step_status})",
        })


class CopyGuidanceVerifierTool(BaseTool):
    """复制项目任务完成验证工具（MVP2 P0-07）。

    双层验证的第一层（确定性）：读取当前 workspace 与来源 Demo minimal_replica，
    按任务的 acceptance_checks 做规则化检查；HTML 走结构完整性检查而非 code_runner。
    第二层 AI 语义复核由 copy_project_guidance 场景 prompt 完成。
    """

    name = "copy_guidance_verifier"
    description = (
        "验证复制项目当前任务是否完成。读取真实代码与来源 Demo 对比，按任务的 "
        "acceptance_checks（code_changed/run_success/visible_text_changed/"
        "content_keyword/card_count）做确定性检查。通过时可自动保存证据。"
        "不要凭学生一句话判定通过。"
    )
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "task_id": {"type": "string", "description": "当前任务 ID（必填），如 replace_first_card"},
            "claimed_changes": {
                "type": "string",
                "description": "学生自己描述改成的具体新内容（如新标题文字），用于语义复核；不要填你臆造的期望值",
            },
            "save_evidence": {
                "type": "boolean",
                "description": "验证通过时是否自动保存证据，默认 true",
            },
        },
        "required": ["project_id", "task_id"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        from app.services.copy_guidance_tasks import get_task, get_next_task
        from app.services.demo_fork import parse_minimal_replica

        project_id = str(params.get("project_id") or "").strip()
        task_id = str(params.get("task_id") or "").strip()
        claimed = str(params.get("claimed_changes") or "").strip()
        save_evidence = params.get("save_evidence")
        if save_evidence is None:
            save_evidence = True

        if not project_id or not task_id:
            return ToolResult(False, error="缺少必填参数 project_id / task_id")

        # 按来源 Demo 优先解析任务（两个 Demo 共用任务 ID，靠 demo_ids 区分）
        from_demo_id_pre = None
        _proj = db.get_project(project_id)
        if _proj is not None:
            from_demo_id_pre = getattr(_proj, "from_demo_id", None)
        task = get_task(task_id, demo_id=from_demo_id_pre)
        if not task:
            return ToolResult(False, error=f"未找到任务 {task_id}")

        project = _proj
        if not project:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        from_demo_id = from_demo_id_pre
        if not from_demo_id:
            return ToolResult(False, error="非复制项目不支持任务引导完成验证")

        # 2026-08-18：任务归属校验——AI 曾把 demo_poetry_card 的任务套在
        # demo_video_analyzer 项目上，验收标准错位导致学生改了代码也永远不过。
        task_demo_ids = [str(d) for d in (task.get("demo_ids") or [])]
        if task_demo_ids and from_demo_id not in task_demo_ids:
            return ToolResult(
                False,
                error=(
                    f"任务 {task_id} 不适用于来源 Demo {from_demo_id}"
                    f"（仅适用于 {task_demo_ids}）。请改用该 Demo 对应的任务 ID。"
                ),
            )

        workspace = db.get_project_workspace(project_id) or {}
        current_files = self._collect_files(workspace)

        demo = db.get_demo(from_demo_id)
        demo_files: Dict[str, str] = {}
        if demo is not None:
            _entry, demo_files = parse_minimal_replica(demo.minimal_replica, demo_name=demo.name)

        acceptance_checks = list(task.get("acceptance_checks") or [])
        checks_detail: List[Dict[str, Any]] = []
        first_issue: Optional[str] = None
        next_hint: Optional[str] = task.get("hint")
        all_passed = True

        for check in acceptance_checks:
            detail = self._run_check(check, current_files, demo_files, claimed)
            checks_detail.append(detail)
            if not detail.get("passed"):
                all_passed = False
                if first_issue is None:
                    first_issue = detail.get("reason") or f"{check} 未通过"

        evidence_saved = False
        if all_passed and save_evidence:
            evidence_saved = await self._save_verification_evidence(
                project=project,
                task=task,
                claimed=claimed,
                checks_detail=checks_detail,
            )

        next_task = get_next_task(task_id, demo_id=from_demo_id)
        base_data: Dict[str, Any] = {
            "auto_passed": all_passed,
            "passed": all_passed,
            "task_id": task_id,
            "checks_detail": checks_detail,
            "knowledge_point": task.get("knowledge_point"),
            "next_task_id": (next_task or {}).get("id"),
        }

        # ── 2026-08-19：激活 copy_guidance 会话状态机（Q-048）──────────────────
        # 此前 session_status/current_task 没有任何代码写入（REST 端点存在但无人调），
        # 系统不知道"做到第几项/是否全部完成"，收官链路无从谈起。
        # 现在每次验证后自动推进状态机：
        #   未通过 → active + current_task=本任务；通过且有下一项 → active + 下一项；
        #   通过且已是最后一项 → completed + current_task=None + all_tasks_completed=true
        session_note = self._update_copy_guidance_session(
            project_id=project_id,
            task_id=task_id,
            task_title=str(task.get("title") or ""),
            passed=all_passed,
            next_task=next_task,
            claimed=claimed,
        )
        if isinstance(session_note, dict):
            base_data["session_status"] = session_note.get("session_status")
            base_data["current_task"] = session_note.get("current_task")
            if session_note.get("all_completed"):
                base_data["all_tasks_completed"] = True
                base_data["final_guidance"] = (
                    "全部引导任务已完成。请在正文第一句向学生表示祝贺，然后必须用 ask_question "
                    "询问：「🚀 推进到『展示与反思』并生成成果档案卡」/「🤔 先不推进，继续自由改造」。"
                    "学生同意后：先调用 stage_advancer（target_stage=step_3，复制项目按引导完成放行），"
                    "再调用 achievement_card 生成正式成果卡（light 项目 step_3 已放行），"
                    "最后引导学生到项目详情页查看。学生拒绝则不推进。不得跳过询问自动推进。"
                )

        if all_passed:
            base_data["evidence_saved"] = evidence_saved
            base_data["message"] = "任务已通过全部确定性检查"
            # 服务端强制信号：即便 auto_passed=true，AI 仍必须做语义复核
            # （对照 claimed_changes 与 checks_detail，看是否真的改到位）。
            base_data["semantic_review_required"] = True
            base_data["semantic_review_instruction"] = (
                "auto_passed=true 只代表确定性规则通过。请对照 claimed_changes 与 "
                "checks_detail 判断学生是否真的完成了当前任务的语义目标；若不吻合，"
                "追问细节或判定未完成，不要立刻推进下一项。"
            )
        else:
            base_data["first_issue"] = first_issue or "未检测到有效改动"
            base_data["next_hint"] = next_hint or "先按提示改一处再重新提交"
            base_data["semantic_review_required"] = False

        return ToolResult(True, data=base_data)

    # ---------- 内部辅助 ----------

    @staticmethod
    def _update_copy_guidance_session(
        project_id: str,
        task_id: str,
        task_title: str,
        passed: bool,
        next_task: Optional[Dict[str, Any]],
        claimed: str = "",
    ) -> Optional[Dict[str, Any]]:
        """
        验证后推进 copy_guidance 会话状态机（2026-08-19，Q-048）。

        返回最新节点摘要 {"session_status", "current_task", "all_completed"}；
        任何异常（状态流转非法/DB 失败）只降级为跳过，不影响验证结果本身。
        """
        try:
            from app.services.copy_guidance_state import (
                CopyGuidanceStateError,
                apply_copy_guidance_to_metadata,
                get_copy_guidance,
                update_copy_guidance,
            )

            skill_state = db.get_skill_state(project_id)
            if skill_state is None:
                return None

            metadata_raw = getattr(skill_state, "metadata", {}) or {}
            if isinstance(metadata_raw, str):
                try:
                    metadata = json.loads(metadata_raw)
                except Exception:
                    metadata = {}
            elif isinstance(metadata_raw, dict):
                metadata = metadata_raw
            else:
                metadata = {}
            if not isinstance(metadata, dict):
                metadata = {}
            # 临时挂在 skill_state 上供 update_copy_guidance 读取
            skill_state.metadata = metadata

            current_node = get_copy_guidance(skill_state)
            has_node = current_node is not None

            if passed and next_task:
                target_status = "active"
                target_task = {
                    "id": str(next_task.get("id") or ""),
                    "title": str(next_task.get("title") or ""),
                }
                all_completed = False
            elif passed:
                target_status = "completed"
                target_task = None
                all_completed = True
            else:
                target_status = "active"
                target_task = {"id": task_id, "title": task_title}
                all_completed = False

            patches: List[Dict[str, Any]] = [
                {"session_status": target_status, "current_task": target_task}
            ]
            if not has_node:
                # 旧项目无节点：先落 started（pending→started 合法），
                # 再走 idle→active；若目标是 completed 需要中间补一步 active
                patches.insert(0, {"intro_status": "started", "session_status": "active"})
            elif (
                target_status == "completed"
                and (current_node or {}).get("session_status") == "idle"
            ):
                patches.insert(0, {"session_status": "active"})

            node = current_node
            for patch in patches:
                node = update_copy_guidance(skill_state, patch)
                skill_state.metadata = apply_copy_guidance_to_metadata(metadata, node)

            # 2026-08-20（Q-050）：同步把任务成果写入 light_step_data——
            # 项目详情主体区（LightProjectSteps）只读该字段，不写则主体区全空。
            updates: Dict[str, Any] = {"metadata": skill_state.metadata}
            light_raw = getattr(skill_state, "light_step_data", None)
            light_data = (
                json.loads(light_raw) if isinstance(light_raw, str) else (light_raw or {})
            )
            if not isinstance(light_data, dict):
                light_data = {}
            if passed:
                entry = f"{task_title or task_id}：完成并验证通过"
                steps = list(light_data.get("steps") or [])
                if entry not in steps:
                    steps.append(entry)
                light_data["steps"] = steps
            if all_completed:
                light_data["result"] = (
                    light_data.get("result")
                    or "完成复制项目全部引导任务，已生成成果档案卡"
                )
                if task_id == "explain_changes" and not light_data.get("reflection"):
                    # 学生"说明自己的改动"的口述即反思内容
                    light_data["reflection"] = claimed or task_title
            if light_data:
                updates["light_step_data"] = light_data

            db.update_skill_state(project_id, updates)
            return {
                "session_status": node.get("session_status"),
                "current_task": node.get("current_task"),
                "all_completed": all_completed,
            }
        except CopyGuidanceStateError as exc:
            import logging as _log
            _log.getLogger(__name__).warning("[copy_guidance] 状态机更新被跳过（流转非法）: %s", exc)
            return None
        except Exception as exc:
            import logging as _log
            _log.getLogger(__name__).warning("[copy_guidance] 状态机更新失败（不影响验证）: %s", exc)
            return None

    @staticmethod
    def _collect_files(workspace: Dict[str, Any]) -> Dict[str, str]:
        """把 workspace 的多文件条目/单文件兜底归一化成 {name: content}。"""
        files: Dict[str, str] = {}
        raw_files = workspace.get("files") if isinstance(workspace, dict) else None
        if isinstance(raw_files, list):
            for entry in raw_files:
                if not isinstance(entry, dict):
                    continue
                name = entry.get("name")
                if isinstance(name, str) and name.strip():
                    files[name] = str(entry.get("content") or "")
        if not files and isinstance(workspace, dict) and workspace.get("code"):
            filename = workspace.get("filename") or _guess_code_filename(
                str(workspace.get("language") or "html")
            )
            files[filename] = str(workspace.get("code") or "")
        return files

    @staticmethod
    def _normalize(text: str) -> str:
        return "".join((text or "").split())

    @classmethod
    def _run_check(
        cls,
        check: str,
        current_files: Dict[str, str],
        demo_files: Dict[str, str],
        claimed: str,
    ) -> Dict[str, Any]:
        if check == "code_changed":
            return cls._check_code_changed(current_files, demo_files)
        if check == "run_success":
            return cls._check_run_success(current_files)
        if check == "visible_text_changed":
            return cls._check_visible_text_changed(current_files, demo_files)
        if check == "content_keyword":
            return cls._check_content_keyword(current_files, demo_files, claimed)
        if check == "card_count":
            return cls._check_card_count(current_files, demo_files)
        return {"check": check, "passed": False, "reason": f"未知 check 类型: {check}"}

    @classmethod
    def _check_code_changed(
        cls,
        current_files: Dict[str, str],
        demo_files: Dict[str, str],
    ) -> Dict[str, Any]:
        import hashlib

        if not current_files:
            return {"check": "code_changed", "passed": False, "reason": "当前工作区为空"}

        def _hash(files: Dict[str, str]) -> str:
            joined = "\n".join(
                f"{name}::{cls._normalize(content)}" for name, content in sorted(files.items())
            )
            return hashlib.md5(joined.encode("utf-8")).hexdigest()

        current_hash = _hash(current_files)
        demo_hash = _hash(demo_files) if demo_files else ""
        changed = bool(demo_files) and current_hash != demo_hash
        detail: Dict[str, Any] = {
            "check": "code_changed",
            "passed": changed,
            "current_hash": current_hash,
            "demo_hash": demo_hash,
        }
        if not changed:
            detail["reason"] = "代码与原始 Demo 完全一致，没有检测到改动"
        return detail

    @classmethod
    def _check_run_success(cls, current_files: Dict[str, str]) -> Dict[str, Any]:
        """
        HTML 项目走结构完整性检查（标签配对/括号配对）；
        py/js 只做静态结构检查，真实执行由外层 AI 决定是否调用 code_runner。
        """
        if not current_files:
            return {"check": "run_success", "passed": False, "reason": "当前工作区为空"}

        # 优先检查 HTML 入口
        html_names = [n for n in current_files if n.lower().endswith((".html", ".htm"))]
        js_names = [n for n in current_files if n.lower().endswith((".js", ".mjs", ".cjs"))]

        if html_names:
            for name in html_names:
                content = current_files[name] or ""
                if not cls._html_structure_ok(content):
                    return {
                        "check": "run_success",
                        "passed": False,
                        "reason": f"{name} 结构不完整（标签或括号未配对）",
                        "note": "html 结构检查失败",
                    }
        if js_names:
            for name in js_names:
                content = current_files[name] or ""
                if not cls._brace_balanced(content):
                    return {
                        "check": "run_success",
                        "passed": False,
                        "reason": f"{name} 括号未配对",
                        "note": "js 括号检查失败",
                    }

        return {
            "check": "run_success",
            "passed": True,
            "note": "html 结构完整" if html_names else "js 括号配对",
        }

    @staticmethod
    def _html_structure_ok(html: str) -> bool:
        lowered = html.lower()
        if "<html" in lowered and "</html>" not in lowered:
            return False
        if "<body" in lowered and "</body>" not in lowered:
            return False
        if "<script" in lowered and "</script>" not in lowered:
            return False
        # 括号配对（粗粒度）
        return CopyGuidanceVerifierTool._brace_balanced(html)

    @staticmethod
    def _brace_balanced(text: str) -> bool:
        pairs = {"(": ")", "[": "]", "{": "}"}
        opens = set(pairs.keys())
        closes = {v: k for k, v in pairs.items()}
        stack: List[str] = []
        in_string: Optional[str] = None
        i = 0
        while i < len(text):
            ch = text[i]
            if in_string:
                if ch == "\\":
                    i += 2
                    continue
                if ch == in_string:
                    in_string = None
            else:
                if ch in ("'", '"', "`"):
                    in_string = ch
                elif ch in opens:
                    stack.append(ch)
                elif ch in closes:
                    if not stack or stack[-1] != closes[ch]:
                        return False
                    stack.pop()
            i += 1
        return not stack

    @staticmethod
    def _extract_heading_texts(files: Dict[str, str]) -> Dict[str, List[str]]:
        """提取 HTML 的 <title> 与 h1-h3 标题文本（归一化、按出现顺序）。"""
        import re

        texts: Dict[str, List[str]] = {}
        for name, content in files.items():
            if not name.lower().endswith((".html", ".htm")):
                continue
            for tag in ("title", "h1", "h2", "h3"):
                values = [
                    CopyGuidanceVerifierTool._normalize(re.sub(r"<[^>]+>", "", m.group(2)))
                    for m in re.finditer(
                        rf"<({tag})[^>]*>(.*?)</\1>", content, re.S | re.I
                    )
                ]
                values = [v for v in values if v]
                if values:
                    texts[f"{name}#{tag}"] = values
        return texts

    @classmethod
    def _check_visible_text_changed(
        cls,
        current_files: Dict[str, str],
        demo_files: Dict[str, str],
    ) -> Dict[str, Any]:
        """
        2026-08-18 新增：页面可见标题文本是否与 Demo 原文不同。

        背景（线上实测，项目 b9e0f446）：学生把标题改成"词频分析器-my"（自己的
        个性化），AI 却要求必须改成项目名"UP主视频内容分析器"，content_keyword
        永远不过，学生陷入无限重改。个性化任务的正确验收是"与 Demo 原文不同"，
        任何学生自己的内容（包括 -my 这类后缀）都应通过。
        """
        cur = cls._extract_heading_texts(current_files)
        demo = cls._extract_heading_texts(demo_files)
        if not demo:
            # Demo 无可提取标题：只要有当前文件即视为可继续（退化由 code_changed 把关）
            return {
                "check": "visible_text_changed",
                "passed": bool(cur),
                **({} if cur else {"reason": "当前工作区为空"}),
            }
        changed: List[str] = []
        unchanged: List[str] = []
        for key, demo_values in demo.items():
            if cur.get(key) != demo_values:
                changed.append(key)
            else:
                unchanged.append(key)
        passed = bool(changed)
        detail: Dict[str, Any] = {
            "check": "visible_text_changed",
            "passed": passed,
            "changed": changed,
            "unchanged": unchanged,
        }
        if not passed:
            detail["reason"] = (
                "页面标题等可见文本与 Demo 原文完全一致，没有检测到你的个性化内容"
            )
        return detail

    @classmethod
    def _check_content_keyword(
        cls,
        current_files: Dict[str, str],
        demo_files: Dict[str, str],
        claimed: str,
    ) -> Dict[str, Any]:
        keywords = [kw.strip() for kw in cls._split_keywords(claimed) if kw.strip()]
        if not keywords:
            return {
                "check": "content_keyword",
                "passed": False,
                "reason": "学生未描述具体改动的关键词",
                "keywords": [],
                "matched": [],
            }
        combined = "\n".join(current_files.values())
        demo_combined = "\n".join(demo_files.values()) if demo_files else ""
        matched: List[str] = []
        for kw in keywords:
            if kw in combined and (not demo_combined or kw not in demo_combined):
                matched.append(kw)
        passed = bool(matched)
        detail: Dict[str, Any] = {
            "check": "content_keyword",
            "passed": passed,
            "matched": matched,
            "keywords": keywords,
        }
        if not passed:
            detail["reason"] = "未在当前代码中命中学生描述的新内容关键词"
        return detail

    @staticmethod
    def _split_keywords(claimed: str) -> List[str]:
        if not claimed:
            return []
        # 支持逗号/顿号/空格/中英文标点分隔
        import re
        parts = re.split(r"[\s,，、;；]+", claimed)
        # 中文单字过于宽松、纯符号无意义：中文≥1字、英文/数字≥2字符
        cleaned: List[str] = []
        for raw in parts:
            token = raw.strip()
            if not token:
                continue
            # 全 ASCII 时要求长度≥2，避免命中 'a'/'1' 等噪声
            if all(ord(c) < 128 for c in token):
                if len(token) >= 2:
                    cleaned.append(token)
            else:
                # 含中文/CJK：长度≥1 即可（"杜"/"甫" 常见）
                cleaned.append(token)
        return cleaned

    @classmethod
    def _check_card_count(
        cls,
        current_files: Dict[str, str],
        demo_files: Dict[str, str],
    ) -> Dict[str, Any]:
        import re

        def _count(files: Dict[str, str]) -> int:
            combined = "\n".join(files.values()) if files else ""
            # 粗粒度统计：优先数组条目（{...},），退化到 <li>/<div class="card"/li>
            obj_matches = re.findall(r"\{[^{}]*\}", combined)
            candidates: List[int] = []
            if obj_matches:
                candidates.append(len(obj_matches))
            # 兼容 JSX/map 场景：<Card ... /> / <Card>...</Card>
            jsx_card = len(re.findall(r"<[A-Z][A-Za-z0-9_]*Card\b", combined))
            if jsx_card:
                candidates.append(jsx_card)
            # 兼容数组字符串字面量：['甲','乙','丙']
            str_arr = re.findall(r"\[[^\[\]\n]{0,400}?\]", combined)
            for arr in str_arr:
                items = re.findall(r"['\"][^'\"]+['\"]", arr)
                if len(items) >= 2:
                    candidates.append(len(items))
                    break
            li_count = len(re.findall(r"<li[\s>]", combined, flags=re.IGNORECASE))
            card_count = len(re.findall(r"class=[\"'][^\"']*card", combined, flags=re.IGNORECASE))
            if li_count:
                candidates.append(li_count)
            if card_count:
                candidates.append(card_count)
            return max(candidates) if candidates else 0

        current = _count(current_files)
        demo = _count(demo_files) if demo_files else 0
        passed = current > demo
        detail: Dict[str, Any] = {
            "check": "card_count",
            "passed": passed,
            "current_count": current,
            "demo_count": demo,
        }
        if not passed:
            detail["reason"] = f"当前卡片/条目数量（{current}）未超过 Demo 初始（{demo}）"
        return detail

    @staticmethod
    async def _save_verification_evidence(
        project: Any,
        task: Dict[str, Any],
        claimed: str,
        checks_detail: List[Dict[str, Any]],
    ) -> bool:
        from app.schemas.evidence import Evidence
        try:
            title = f"复制项目任务完成：{task.get('title') or task.get('id')}"
            payload = {
                "task_id": task.get("id"),
                "task_title": task.get("title"),
                "knowledge_point": task.get("knowledge_point"),
                "claimed_changes": claimed,
                "checks_detail": checks_detail,
            }
            evidence = Evidence(
                id=str(uuid.uuid4()),
                project_id=getattr(project, "id", ""),
                author_id=getattr(project, "author_id", ""),
                type="auto_ai_summary",
                title=title,
                content=json.dumps(payload, ensure_ascii=False, indent=2),
                related_step=getattr(project, "current_stage", ""),
                created_at=utc_now(),
                updated_at=utc_now(),
            )
            db.create_evidence(evidence)
            return True
        except Exception:
            return False


TOOL_REGISTRY: Dict[str, BaseTool] = {
    "skill_state_reader": SkillStateReaderTool(),
    "ask_question": AskQuestionTool(),
    "skill_state_writer": SkillStateWriterTool(),
    "stage_advancer": StageAdvancerTool(),
    "artifact_reader": ArtifactReaderTool(),
    "artifact_writer": ArtifactWriterTool(),
    "evidence_saver": EvidenceSaverTool(),
    "code_runner": CodeRunnerTool(),
    "project_code_writer": ProjectCodeWriterTool(),
    "project_code_reader": ProjectCodeReaderTool(),
    "resource_searcher": ResourceSearcherTool(),
    "project_creator": ProjectCreatorTool(),
    "achievement_card": AchievementCardTool(),
    "project_memory_store": ProjectMemoryStoreTool(),
    "project_memory_recall": ProjectMemoryRecallTool(),
    "sop_state_sync": SopStateSyncTool(),
    "copy_guidance_verifier": CopyGuidanceVerifierTool(),
}


def get_tool(name: str) -> Optional[BaseTool]:
    return TOOL_REGISTRY.get(name)


def get_all_tools_definitions() -> List[Dict[str, Any]]:
    return [
        {"name": t.name, "description": t.description, "parameters": t.parameters_schema}
        for t in TOOL_REGISTRY.values()
    ]
