"""
⚠️ DEPRECATED — 本文件不在主链路上（2026-07-22 架构审计确认）

当前 AI 主链路：前端 useStreamingChat.ts 直连 ZeroClaw WebSocket（ws://127.0.0.1:42617/ws/chat），
ZeroClaw 通过 MCP 调用后端 tools.py 的 12 个 PBL 工具。本文件（orchestrator.py）实现的
FastAPI 编排路径（/api/v1/agent/ws）没有前端调用方。

保留原因：作为 ZeroClaw 不可用时的潜在 FastAPI 回退路径。但当前不做维护——
其内部的 STAGE_ORDER 等常量已与 stage_constants.py 漂移，门禁检查（如 _execute_tool
对 artifact_writer 的 path 检查）是死代码（取 params["path"] 但真实字段是 artifact_name）。

如果要重新启用本文件，必须：
1. 把内部所有 STAGE_ORDER / CODE_ALLOWED_STAGES 等改为从 stage_constants.py 导入
2. 修复 _execute_tool 的 artifact_writer 门禁字段名（path → artifact_name）
3. 更新 stream_chat_with_events 的截断续接逻辑（已迁至前端 useStreamingChat.ts）

参见：.trae/documents/技术与架构/ZeroClaw集成重构_v1.0.0.md

---

Agent 编排服务（v2：Tool Calling + Skill 路由）

用途：协调 LLM Tool Calling 与 Skill 路由，驱动 PBL 研学流程
维护者：AI Agent
links: .trae/documents/产品与规划/fineSTEM_AI对话流设计规格_v1.0.0.md
"""

from typing import Any, AsyncGenerator, Dict, List, Optional
import re


def _clean_dsml_content(content: str) -> str:
    if not content:
        return content
    cleaned = re.sub(r'<[<｜|/!\-\w\s=":._]*DSML[<｜|/!\-\w\s=":._]*>', '', content, flags=re.IGNORECASE)
    cleaned = re.sub(r'<\|[^|]*\|\|>', '', cleaned)
    cleaned = re.sub(r'<\|[\s\S]*?\|>', '', cleaned)
    cleaned = re.sub(r'^\s*(tool_calls|invoke name=|parameter name=|artifact_writer\b).*$',
                     '',
                     cleaned,
                     flags=re.IGNORECASE | re.MULTILINE)
    if "artifact_writer" in cleaned and ("project_brief" in cleaned or "artifact_name" in cleaned):
        return ""
    safe_lines: list[str] = []
    for raw_line in cleaned.split('\n'):
        line = raw_line.strip()
        if not line:
            continue
        if re.fullmatch(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}", line, flags=re.IGNORECASE):
            continue
        if re.search(r'"op"\s*:\s*"(?:replace|add|remove)"', line) or re.search(r'"path"\s*:\s*"/', line):
            continue
        if re.match(r'^\s*[\[{].*(project_id|tool_call_id|stage_passed|current_stage|teaching_mode).*[\]}]?\s*$', line):
            continue
        safe_lines.append(line)
    return '\n'.join(safe_lines).strip()


def _has_direct_code_intent(message: str) -> bool:
    if not message:
        return False
    return bool(re.search(
        r"(开始编码|开始开发|给我完整的代码|完整代码|用\s*(Python|JavaScript|TypeScript|HTML|CSS)\s*实现|直接进入编码|直接推进到编码|进入执行阶段|直接做|立即做|马上做|不要再问|别再问|别问了|直接实现|直接开发|跳过引导|跳过开题|跳过前置|直接给代码|直接输出代码|直接给出完整代码|写到编辑器|写入编辑器|代码为空|代码是空|没有代码|没代码|重新生成代码|重新写代码|生成代码文件|main\.py\s*(为空|没有|没|空的)|代码文件.*(为空|没有|没|空的))",
        message,
        flags=re.IGNORECASE,
    ))


def _has_strong_code_intent(message: str) -> bool:
    if not message:
        return False
    return bool(re.search(
        r"(开始编码|开始开发|给我完整的代码|完整代码|用\s*(Python|JavaScript|TypeScript|HTML|CSS)\s*实现|直接进入编码|直接推进到编码|进入执行阶段|直接实现|直接开发|直接给代码|直接输出代码|直接给出完整代码|写到编辑器|写入编辑器)",
        message,
        flags=re.IGNORECASE,
    ))
import uuid
import httpx
import time
import json
import logging

from app.core.config import settings
from app.repositories.runtime_db import db
from app.schemas.agent import AgentChatRequest, AgentChatResponse, AgentToolTrace
from app.services.feature_flags import feature_flag_service
from app.services.observability import agent_observability_service
from app.services.providers.zeroclaw_provider import ZeroClawProvider
from app.core.time_utils import utc_now
from app.services.skill_registry import (
    match_skill,
    skill_registry_v2,
    SKILL_REGISTRY,
)
from app.services.tools import get_tool, get_all_tools_definitions, ToolResult
from app.services.pbl_engine import ARTIFACT_TO_BLOB_KEY, advance_with_gate, save_artifact

logger = logging.getLogger(__name__)

MAX_TOOL_CALL_ROUNDS = 5
SKILL_HINT_PATTERN = re.compile(r"^\s*\[\[skill:([A-Za-z0-9_-]+)\]\]\s*")
VALID_TEACHING_MODES = {"guided", "demo", "hands_on", "lecture"}


class AgentOrchestratorService:
    def __init__(self) -> None:
        self.provider = ZeroClawProvider(
            gateway_url=settings.ZEROCLAW_GATEWAY_URL,
            timeout_seconds=settings.ZEROCLAW_TIMEOUT_SECONDS,
            api_key=settings.ZEROCLAW_API_KEY,
        )

    @staticmethod
    def _strip_skill_hint(message: str) -> str:
        if not message:
            return message
        return SKILL_HINT_PATTERN.sub("", message, count=1).strip()

    @staticmethod
    def _get_requested_skill_id(req: AgentChatRequest) -> str | None:
        if req.skill_id:
            return req.skill_id
        if not req.message:
            return None
        match = SKILL_HINT_PATTERN.match(req.message)
        return match.group(1) if match else None

    @staticmethod
    def _get_request_project_id(req: AgentChatRequest) -> str:
        if req.project_id:
            return req.project_id
        context = req.context or {}
        for key in ("project_id", "projectId"):
            value = context.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    @classmethod
    def _resolve_skill(cls, req: AgentChatRequest):
        """优先使用前端显式选择的 skill，避免被关键词误路由到无关技能。"""
        if not req.enable_tools:
            return None
        requested_skill_id = cls._get_requested_skill_id(req)
        user_message = cls._strip_skill_hint(req.message)
        if requested_skill_id:
            selected_skill = skill_registry_v2.get_skill(requested_skill_id)
            if selected_skill:
                logger.info(
                    "skill_resolved_by_request requested=%s resolved=%s",
                    requested_skill_id,
                    selected_skill.skill_id,
                )
                return selected_skill
            logger.warning("skill_request_not_found requested=%s", requested_skill_id)
        matched_skill = match_skill(user_message)
        if matched_skill:
            logger.info("skill_resolved_by_match matched=%s", matched_skill.skill_id)
        else:
            logger.info("skill_resolved_by_match matched=None")
        return matched_skill

    @staticmethod
    def _get_current_stage(req: AgentChatRequest) -> str:
        context = req.context or {}
        for key in ("current_stage", "currentStage"):
            value = context.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        project_id = AgentOrchestratorService._get_request_project_id(req)
        if project_id:
            current_state = db.get_skill_state(project_id)
            stage = getattr(current_state, "current_stage", "") if current_state else ""
            if stage:
                return stage
        return ""

    @staticmethod
    def _get_teaching_mode(req: AgentChatRequest) -> str:
        context = req.context or {}
        for key in ("teaching_mode", "teachingMode"):
            value = context.get(key)
            if isinstance(value, str) and value.strip() in VALID_TEACHING_MODES:
                return value.strip()

        project_id = AgentOrchestratorService._get_request_project_id(req)
        if project_id:
            current_state = db.get_skill_state(project_id)
            if current_state:
                metadata = getattr(current_state, "metadata", {}) or {}
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except Exception:
                        metadata = {}
                teaching_mode = metadata.get("teachingMode", "guided")
                if isinstance(teaching_mode, str) and teaching_mode in VALID_TEACHING_MODES:
                    return teaching_mode
        return "guided"

    @classmethod
    def _build_teaching_mode_instruction(cls, req: AgentChatRequest) -> str:
        current_stage = cls._get_current_stage(req)
        teaching_mode = cls._get_teaching_mode(req)
        if not current_stage.startswith("stage_07") and not current_stage.startswith("stage_08"):
            return ""

        instructions = {
            "guided": """
## 当前教学模式：guided（引导式）
- 优先给学生一个代码框架、分步填空点或待完成的小目标，而不是一上来倾倒全部细节。
- 回答结构优先使用：先做什么 → 学生自己补哪一块 → 你再给关键提示。
- 如果要给代码，优先给可运行骨架和关键片段，并明确指出“下一步你来补什么”。
""".strip(),
            "demo": """
## 当前教学模式：demo（演示式）
- 先展示完整可运行版本，再解释整体结构与模仿路径。
- 回答结构优先使用：完整示例 → 模块拆解 → 建议学生照着改的 2-3 个点。
- 不要把代码拆得太碎，重点让学生先看见完整结果。
""".strip(),
            "hands_on": """
## 当前教学模式：hands_on（动手式）
- 优先把任务拆成一个学生可独立尝试的小挑战，先让学生动手，再给提示。
- 默认不要直接给完整答案，除非学生明确卡住、主动要完整代码，或当前问题已经阻塞继续推进。
- 回答结构优先使用：本轮任务 → 验证标准 → 常见报错提示 → 必要时补关键代码。
""".strip(),
            "lecture": """
## 当前教学模式：lecture（讲解式）
- 先讲清原理、概念、结构和为什么这样设计，再进入代码。
- 回答结构优先使用：概念解释 → 设计思路 → 关键代码 → 结果验证。
- 如果给代码，必须配合解释关键变量、流程和设计取舍。
""".strip(),
        }
        return instructions.get(teaching_mode, "")

    @classmethod
    def _is_achievement_scene(cls, req: AgentChatRequest) -> bool:
        context = req.context or {}
        scene = context.get("scene")
        current_stage = cls._get_current_stage(req)
        if scene == "generate_achievement":
            return True
        return scene == "continue_stage" and current_stage == "stage_08_evaluate"

    @classmethod
    def _build_scene_instruction(cls, req: AgentChatRequest) -> str:
        if not cls._is_achievement_scene(req):
            return ""
        return """
## 当前特殊场景：成果档案卡生成
- 这是成果档案卡生成/验收收口场景，不是代码演示或路径探查场景。
- 禁止输出 `with open(...)`、`print(f.read())`、`python</`、伪代码、文件路径探查脚本。
- 如果当前材料已经足够，必须优先调用 `achievement_card` 工具创建或更新成果档案卡。
- 如需补充信息，只能围绕成果卡字段提问：一句话介绍、解决问题、方法、反思。
- 禁止输出与当前任务无关的通用问题，例如“接下来你想怎么做？”、“换个方向”等。
""".strip()

    def _should_force_code_generation(self, req: AgentChatRequest) -> bool:
        """
        判断是否进入强制代码生成路径。

        与 stem-pbl-guide Skill 状态机严格对齐：
        - 仅 stage_05_design / stage_07_execute / stage_08_evaluate 允许产出可执行代码块；
          stage_05 才生成初始代码框架，stage_07 才正式开发，stage_08 才修订与验收。
        - stage_00～stage_04（含范围裁剪 stage_03_constraints）阶段，无论用户怎么说
          "代码为空 / 没代码 / 重新生成" 等关键词，都不进入 force_code_generation；
          应在系统提示词里引导回当前阶段任务（如 must-have / wont-do）。
        - context.force_code_generation 显式信号最高优先级（前端已做阶段联合判断）。
        """
        context = req.context or {}
        forced_by_context = bool(context.get("force_code_generation"))
        if forced_by_context:
            return True
        normalized_message = self._strip_skill_hint(req.message)
        project_id = self._get_request_project_id(req)
        if not project_id:
            return False
        if _has_strong_code_intent(normalized_message):
            return True
        current_stage = self._get_current_stage(req)
        ALLOWED_CODE_STAGES = {
            "stage_05_design",
            "stage_07_execute",
            "stage_08_evaluate",
        }
        if current_stage not in ALLOWED_CODE_STAGES:
            return False
        # stage_07_execute 不再无条件触发代码生成，必须用户明确要求代码相关操作
        # 修复：用户问"现在什么阶段"等纯信息查询不应触发代码生成/覆盖
        if current_stage == "stage_07_execute":
            return _has_direct_code_intent(normalized_message)
        return _has_direct_code_intent(normalized_message)

    @staticmethod
    def _contains_executable_code_block(content: str) -> bool:
        """检测响应中是否含有可执行语言的完整 Markdown 代码块。

        仅 python/javascript/typescript/html/css 这些"可写入编辑器"的语言才算
        合法代码产出；text/json/markdown/bash 等不算（避免 AI 用 ```text streamlit run...
        这样的命令块伪装成代码已生成）。
        """
        if not content:
            return False
        executable_langs = {"python", "py", "javascript", "js", "typescript", "ts",
                            "tsx", "jsx", "html", "css"}
        # 匹配完整代码块：```lang\n...\n```
        pattern = re.compile(r"```(\w+)?\n([\s\S]*?)```", re.MULTILINE)
        for match in pattern.finditer(content):
            lang = (match.group(1) or "").strip().lower()
            code = (match.group(2) or "").strip()
            if lang in executable_langs and len(code) > 30:
                return True
        return False

    @staticmethod
    def _extract_executable_code_block(content: str) -> dict[str, str] | None:
        """[已废弃 - 2026-07-18 事故修复] 从 AI 回复中提取可执行代码块。

        危险：此函数无法区分代码块用途（项目代码 / 诊断脚本 / 示例 / 反例），
        历史上被用于自动覆盖 workspace.code，导致用户已完成项目的代码被
        AI 的诊断脚本永久覆盖。已从写库链路中移除，保留函数体仅供只读检查
        或未来参考。代码写入 workspace 的唯一合法入口是 AI 显式调用
        ``project_code_writer`` 工具。
        """
        if not content:
            return None
        executable_langs = {
            "python", "py", "javascript", "js", "typescript", "ts",
            "tsx", "jsx", "html", "css",
        }
        candidates: list[dict[str, str]] = []
        pattern = re.compile(r"```(\w+)?\n([\s\S]*?)```", re.MULTILINE)
        for match in pattern.finditer(content):
            language = (match.group(1) or "").strip().lower()
            code = (match.group(2) or "").strip()
            if language in executable_langs and len(code) > 30:
                candidates.append({
                    "language": AgentOrchestratorService._normalize_code_language(language),
                    "code": code,
                })
        if not candidates:
            return None
        html_candidate = next((item for item in candidates if item["language"] == "html"), None)
        if html_candidate:
            return html_candidate
        return max(candidates, key=lambda item: len(item["code"]))

    @staticmethod
    def _normalize_code_language(language: str) -> str:
        normalized = (language or "html").lower()
        if normalized == "py":
            return "python"
        if normalized == "js":
            return "javascript"
        if normalized == "ts":
            return "typescript"
        return normalized

    @staticmethod
    def _guess_code_filename(language: str) -> str:
        normalized = AgentOrchestratorService._normalize_code_language(language)
        if normalized == "html":
            return "index.html"
        if normalized == "javascript":
            return "main.js"
        if normalized == "typescript":
            return "main.ts"
        if normalized == "css":
            return "style.css"
        if normalized == "python":
            return "main.py"
        return "main.txt"

    @staticmethod
    def _build_code_generated_payload(project_id: str, code: str, language: str, saved_at: str) -> dict[str, Any]:
        filename = AgentOrchestratorService._guess_code_filename(language)
        return {
            "project_id": project_id,
            "code": code,
            "language": AgentOrchestratorService._normalize_code_language(language),
            "filename": filename,
            "files": [{
                "name": filename,
                "language": AgentOrchestratorService._normalize_code_language(language),
                "content": code,
                "is_main": True,
            }],
            "saved_at": saved_at,
        }

    @staticmethod
    def _build_fallback_code(req: AgentChatRequest) -> dict[str, str] | None:
        """强制编码但模型未产出源码时的兜底处理。
        
        注意：不再返回硬编码的 MVP 模板代码，而是返回 None
        让调用方决定如何处理（保留现有代码或提示用户）
        """
        # 修复：不再生成 MVP 模板代码，返回 None 表示没有 fallback 代码
        return None

    def _is_complete_missing_artifacts_request(self, req: AgentChatRequest) -> bool:
        """识别"现在补/一次性补全"这类确定性补全文档请求。

        ⚠️ 重要限制：只有在 stage_06 (分步计划) 及之后的阶段才允许触发自动补全。
        在早期阶段（stage_00 ~ stage_05）触发补全会导致严重的阶段跳跃问题。
        """
        if not req.project_id:
            return False

        # ========== 阶段门禁：早期阶段不允许自动补全 ==========
        current_stage = self._get_current_stage(req) or ""
        if current_stage:
            try:
                current_idx = self.STAGE_ORDER_LIST.index(current_stage)
                # 只允许从 stage_06_step_plan (idx=6) 及之后触发自动补全
                MIN_STAGE_FOR_AUTO_COMPLETE = 6
                if current_idx < MIN_STAGE_FOR_AUTO_COMPLETE:
                    logger.info(
                        "auto_complete_blocked_by_early_stage stage=%s min_required=stage_06 message=%s",
                        current_stage, req.message[:50],
                    )
                    return False  # 早期阶段拦截
            except ValueError:
                pass  # 阶段不在列表中（如轻量模式），放行

        normalized_message = self._strip_skill_hint(req.message)
        compact_message = re.sub(r"\s+", "", normalized_message)
        if not compact_message:
            return False
        return bool(re.search(
            r"(回答[:：]?(现在补|立即补|开始补|补全|一次性补全|全部补上)|现在补|立即补|开始补|补全(剩余|缺失|所有|全部)?(文档|工件|资料)|一次性(生成|补全|补齐|补上)|全部补上|推进到验收)",
            compact_message,
            flags=re.IGNORECASE,
        ))

    @staticmethod
    def _build_bootstrap_followup(req: AgentChatRequest) -> tuple[str, dict[str, Any]] | None:
        """Bootstrap 基础三问的确定性续问，避免 LLM 输出半截问题但没有 option。"""
        message = AgentOrchestratorService._strip_skill_hint(req.message or "")
        if not message.startswith("[选择]"):
            return None
        compact_message = re.sub(r"\s+", "", message)

        if re.search(r"(年级|几年级).*回答[:：]?(初中|高中|小学|初一|初二|初三|高一|高二|高三)", compact_message):
            content = "好的，收到！接下来想确认你的时间安排。"
            question = {
                "id": f"q-bootstrap-time-{int(utc_now().timestamp())}",
                "title": "你打算花多长时间完成这个项目？",
                "options": [
                    {"id": "time-2h", "label": "2小时", "description": "适合做可运行版本"},
                    {"id": "time-6h", "label": "6小时", "description": "适合完成完整小项目", "recommended": True},
                    {"id": "time-12h", "label": "12小时+", "description": "适合加入更多功能和展示效果"},
                ],
                "multiple": False,
                "allow_custom": True,
                "stage": "stage_00_bootstrap",
                "step": 2,
                "total_steps": 3,
            }
            return content, question

        if re.search(r"(多长时间|时间).*回答[:：]?(2小时|6小时|12小时|半天|一天|两天|一周|\d+小时)", compact_message):
            content = "好的，时间安排已记录。最后一个问题：你现在有没有初步项目想法？"
            question = {
                "id": f"q-bootstrap-idea-{int(utc_now().timestamp())}",
                "title": "你有初步想法了吗？",
                "options": [
                    {
                        "id": "brainstorm",
                        "label": "完全没想法，需要脑爆",
                        "description": "从零开始，一起探索可做的项目方向",
                    },
                    {
                        "id": "direction",
                        "label": "有个大概方向",
                        "description": "我知道想做什么类型，但还需要一起收敛",
                    },
                    {
                        "id": "idea",
                        "label": "已经有具体想法",
                        "description": "直接基于我的想法进入立项和方案设计",
                        "recommended": True,
                    },
                ],
                "multiple": False,
                "allow_custom": True,
                "stage": "stage_00_bootstrap",
                "step": 3,
                "total_steps": 3,
                "is_stage_final": True,
            }
            return content, question

        return None

    def _build_completion_artifact_content(
        self,
        artifact_name: str,
        project_name: str,
        current_stage: str,
        source_summary: str,
    ) -> str:
        """根据已确认上下文生成阶段工件内容，未确认信息显式标注待确认。"""
        safe_project_name = project_name or "未命名项目"
        source_block = source_summary.strip()[:1200] or "当前对话中没有更多可用细节。"
        common_header = (
            f"# {safe_project_name} - {artifact_name}\n\n"
            f"- 生成方式：根据当前对话和项目状态自动整理\n"
            f"- 当前阶段：{current_stage or '未知'}\n"
            f"- 注意：未在对话中确认的信息均标注为“待确认”，不虚构事实。\n\n"
            f"## 可用上下文\n{source_block}\n\n"
        )
        templates = {
            "brainstorm": "## 脑爆记录\n- 核心方向：围绕项目名称和已确认想法展开。\n- 候选方向：待确认。\n- 推荐方向：优先选择可运行、可展示、可验收的方案。\n",
            "project_brief": "## 项目立项书\n- 项目目标：完成一个可运行、可演示、可复盘的 STEM 项目。\n- 目标用户：待确认。\n- 成功标准：能运行、能说明原理、能展示结果。\n- 风险预案：若时间不足，优先保留核心功能，延后美化和扩展。\n",
            "constraints": "## 范围裁剪\n### must-have\n1. 可运行的核心功能。\n2. 清晰的输入、处理和输出流程。\n3. 可展示的结果或界面。\n\n### nice-to-have\n1. 更好的视觉样式。\n2. 更多交互反馈。\n\n### won't-have\n1. 暂不做复杂账号系统。\n2. 暂不接入未确认的第三方服务。\n",
            "track_plan": "## 技术轨道\n- 推荐轨道：轻量 Web / Python 原型，按项目已有代码形态确认。\n- 选择理由：依赖少、反馈快、适合课堂展示。\n- 替代方案：如果运行环境受限，先用单文件 HTML 或 Python 标准库版本。\n",
            "design": "## 设计蓝图\n- 页面/模块：输入区、核心处理区、结果展示区。\n- 数据流：用户输入 -> 核心逻辑处理 -> 展示/反馈。\n- 验收用例：\n  1. 正常输入时能得到结果。\n  2. 空输入或异常输入时有提示。\n  3. 结果能被学生解释和展示。\n",
            "step_plan": "## 分步计划\n### 里程碑 1：基础框架\n- run：打开或运行项目入口。\n- check：能看到初始界面或输出。\n- rollback：回退到上一版入口文件。\n\n### 里程碑 2：核心功能\n- run：实现核心逻辑并运行。\n- check：核心用例通过。\n- rollback：回退到可运行版本。\n\n### 里程碑 3：完善与验收\n- run：补充提示、样式和说明。\n- check：按验收用例逐条检查。\n- rollback：移除非必要扩展。\n",
            "dev_log": "## 开发日志\n- 已完成：根据当前项目状态整理开发记录。\n- 当前证据：待补充运行截图、运行日志或演示记录。\n- 后续动作：运行核心用例并记录结果。\n",
            "evaluate": "## 验收评估\n- 验收项 1：项目是否能运行。状态：待人工复核。\n- 验收项 2：核心功能是否符合目标。状态：待人工复核。\n- 反思 1：先完成可运行版本，再逐步扩展。\n- 反思 2：每一步都应保留运行证据。\n- 下一步：补充真实运行截图/日志后完成最终成果档案。\n",
        }
        return common_header + templates.get(artifact_name, "## 工件内容\n- 待确认。\n")

    def _complete_missing_artifacts(self, req: AgentChatRequest, owner_id: str) -> dict[str, Any]:
        """确定性补齐 PBL 工件，并按门禁推进。

        ⚠️ 重要修改：只补全当前阶段及之前的工件，不越权补全后续阶段工件。
        阶段推进也只推进一个阶段，不一口气推到 stage_08。
        """
        project_id = req.project_id
        if not project_id:
            return {"success": False, "message": "缺少项目 ID，无法补全文档。"}
        state = db.get_skill_state(project_id)
        project = db.get_project(project_id)
        if not state or not project:
            return {"success": False, "message": "未找到项目或 SKILL_STATE，无法补全文档。"}

        standard_data_raw = getattr(state, "standard_step_data", {})
        if isinstance(standard_data_raw, str):
            try:
                standard_data = json.loads(standard_data_raw)
            except json.JSONDecodeError:
                standard_data = {}
        else:
            standard_data = standard_data_raw if isinstance(standard_data_raw, dict) else {}

        history_messages = self._build_history_messages(req)
        source_summary = "\n".join(
            f"{item.get('role')}: {str(item.get('content') or '').strip()}"
            for item in history_messages[-8:]
            if str(item.get("content") or "").strip()
        )
        current_stage = getattr(state, "current_stage", "")
        project_name = getattr(project, "name", "")
        saved: list[dict[str, Any]] = []
        skipped: list[str] = []

        # ========== 阶段限制：只补全当前阶段及之前的工件 ==========
        ARTIFACT_STAGE_MAP = {
            "brainstorm": 1,   # stage_01
            "project_brief": 2,  # stage_02
            "constraints": 3,   # stage_03
            "track_plan": 4,     # stage_04
            "design": 5,         # stage_05
            "step_plan": 6,      # stage_06
            "dev_log": 7,        # stage_07
            "evaluate": 8,       # stage_08
        }

        try:
            current_idx = self.STAGE_ORDER_LIST.index(current_stage)
        except ValueError:
            current_idx = 8  # 找不到则允许全部（向后兼容）

        for artifact_name, blob_key in ARTIFACT_TO_BLOB_KEY.items():
            artifact_stage_idx = ARTIFACT_STAGE_MAP.get(artifact_name, 99)
            if artifact_stage_idx > current_idx + 1:
                logger.info(
                    "auto_complete_skip_future_artifact artifact=%s current_stage=%s",
                    artifact_name, current_stage,
                )
                continue

            existing_content = standard_data.get(blob_key)
            if isinstance(existing_content, str) and existing_content.strip():
                skipped.append(artifact_name)
                continue
            content = self._build_completion_artifact_content(
                artifact_name=artifact_name,
                project_name=project_name,
                current_stage=current_stage,
                source_summary=source_summary,
            )
            result = save_artifact(project_id, artifact_name, content, db)
            saved.append(result)
            standard_data[blob_key] = content

        # ========== 阶段推进：只推进一个阶段，不一口气推到终点 ==========
        transitions: list[dict[str, Any]] = []
        max_advances = 1  # 最多只推进 1 个阶段
        for _ in range(max_advances):
            before_state = db.get_skill_state(project_id)
            before_stage = getattr(before_state, "current_stage", "") if before_state else ""
            advance_result = advance_with_gate(project_id, db)
            if not advance_result.get("success"):
                break
            after_stage = str(advance_result.get("new_stage") or "")
            transitions.append(advance_result)
            if not after_stage or after_stage == before_stage:
                break

        final_state = db.get_skill_state(project_id)
        final_stage = getattr(final_state, "current_stage", current_stage) if final_state else current_stage
        return {
            "success": True,
            "project_id": project_id,
            "saved": saved,
            "skipped_existing": skipped,
            "transitions": transitions,
            "final_stage": final_stage,
            "message": f"已补齐当前阶段（{current_stage}）及之前的缺失工件，并按门禁推进到下一阶段。",
        }

    @staticmethod
    def _format_completion_report(result: dict[str, Any]) -> str:
        """将确定性补全文档结果格式化为用户可读报告。"""
        if not result.get("success"):
            return str(result.get("message") or "补全文档失败。")
        saved = result.get("saved") or []
        skipped = result.get("skipped_existing") or []
        transitions = result.get("transitions") or []
        lines = ["已执行补全文档流程。", ""]
        if saved:
            lines.append("## 本次补齐")
            for item in saved:
                lines.append(f"- {item.get('artifact_name')} -> {item.get('path') or '已写入'}")
        if skipped:
            lines.append("")
            lines.append("## 已存在，未重复覆盖")
            for artifact_name in skipped:
                lines.append(f"- {artifact_name}")
        if transitions:
            lines.append("")
            lines.append("## 阶段推进")
            for item in transitions:
                lines.append(f"- {item.get('current_stage')} -> {item.get('new_stage')}")
        lines.append("")
        lines.append(f"当前阶段：{result.get('final_stage') or '未知'}")
        lines.append("说明：未在对话中确认的信息已在文档内标注为“待确认”，没有虚构外部数据。")
        return "\n".join(lines)

    def _resolve_stage_with_fallback(self, skill_def: Any, req: AgentChatRequest) -> tuple[Any, Optional[str]]:
        """
        解析当前阶段：优先关键词路由，失败时回退到 context.current_stage。

        修复场景：用户消息"我们继续协作完成【脑爆选题】"不含阶段 trigger 关键词
        （如"多轮脑爆"），导致 route_to_stage 返回 None，system_prompt 缺少
        当前阶段详细规范，AI 给出与阶段无关的回答。

        回退策略：从 context 或项目状态读取 current_stage，若该 stage 在 skill
        的 stages 字典中存在，则使用它，确保 AI 拿到正确的阶段规范。
        """
        if not skill_def:
            return None, None
        user_message = self._strip_skill_hint(req.message)
        stage = skill_def.route_to_stage(user_message)
        if stage:
            return stage, stage.stage_id
        # 关键词路由失败，回退到 context / 项目状态中的 current_stage
        context_stage = self._get_current_stage(req)
        if context_stage and hasattr(skill_def, "stages"):
            fallback_stage = skill_def.stages.get(context_stage)
            if fallback_stage:
                logger.info(
                    "stage_resolved_by_context_fallback stage=%s (keyword_match_failed)",
                    context_stage,
                )
                return fallback_stage, fallback_stage.stage_id
        return None, None

    async def chat(self, owner_id: str, req: AgentChatRequest) -> AgentChatResponse:
        started = time.perf_counter()
        trace_id = str(uuid.uuid4())
        session_id = req.session_id or str(uuid.uuid4())
        logger.info("agent_chat_start trace_id=%s owner_id=%s", trace_id, owner_id)

        try:
            skill_def = self._resolve_skill(req)
            user_message = self._strip_skill_hint(req.message)
            stage, sub_skill_id = self._resolve_stage_with_fallback(skill_def, req)

            system_prompt = self._build_system_prompt(req, skill_def, sub_skill_id)
            context_block = self._build_context_block(req, owner_id)
            messages = self._build_messages(req, system_prompt, context_block)
            available_tools = self._get_available_tools(skill_def, sub_skill_id, req)

            tool_traces: List[AgentToolTrace] = []
            full_content = ""
            model_name = settings.ZEROCLAW_DEFAULT_MODEL

            for round_idx in range(MAX_TOOL_CALL_ROUNDS):
                content, tool_calls, model = await self._call_llm_with_tools(
                    messages, available_tools, owner_id
                )

                if not tool_calls:
                    full_content = _clean_dsml_content(content) if content else ""
                    model_name = model
                    break

                # 保存工具调用时的AI对话内容
                if content and content.strip():
                    cleaned = _clean_dsml_content(content)
                    if cleaned and cleaned.strip():
                        full_content += cleaned + "\n\n"

                for tc in tool_calls:
                    tool_name = tc.get("function", {}).get("name", "")
                    tool_args_str = tc.get("function", {}).get("arguments", "{}")
                    try:
                        tool_args = json.loads(tool_args_str)
                    except json.JSONDecodeError:
                        tool_args = {}

                    tool_started = time.perf_counter()
                    tool_result = await self._execute_tool(tool_name, tool_args, owner_id)
                    tool_latency = int((time.perf_counter() - tool_started) * 1000)

                    tool_traces.append(AgentToolTrace(
                        tool_name=tool_name,
                        status="success" if tool_result.success else "failed",
                        summary=tool_result.to_string()[:500],
                        duration_ms=tool_latency,
                    ))

                    messages.append({"role": "assistant", "content": None, "tool_calls": [tc]})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "content": tool_result.to_string(),
                    })

            if not full_content and tool_traces:
                snippets = "；".join([f"{t.tool_name}: {t.summary[:100]}" for t in tool_traces])
                full_content = f"已完成分析：{snippets}"

            if req.project_id:
                self._write_auto_evidence(req.project_id, owner_id, full_content, tool_traces)

            response = AgentChatResponse(
                role="assistant",
                content=full_content,
                trace_id=trace_id,
                session_id=session_id,
                used_tools=tool_traces,
                model=model_name,
                created_at=utc_now(),
            )
            latency_ms = int((time.perf_counter() - started) * 1000)
            agent_observability_service.record(success=True, latency_ms=latency_ms)
            logger.info("agent_chat_success trace_id=%s latency_ms=%s tools=%s", trace_id, latency_ms, len(tool_traces))
            return response
        except Exception:
            latency_ms = int((time.perf_counter() - started) * 1000)
            agent_observability_service.record(success=False, latency_ms=latency_ms)
            logger.exception("agent_chat_failed trace_id=%s latency_ms=%s", trace_id, latency_ms)
            raise

    async def stream_chat(self, owner_id: str, req: AgentChatRequest) -> AsyncGenerator[str, None]:
        trace_id = str(uuid.uuid4())
        logger.info("agent_stream_start trace_id=%s owner_id=%s", trace_id, owner_id)

        try:
            skill_def = self._resolve_skill(req)
            user_message = self._strip_skill_hint(req.message)
            stage, sub_skill_id = self._resolve_stage_with_fallback(skill_def, req)

            system_prompt = self._build_system_prompt(req, skill_def, sub_skill_id)
            context_block = self._build_context_block(req, owner_id)
            messages = self._build_messages(req, system_prompt, context_block)
            available_tools = self._get_available_tools(skill_def, sub_skill_id, req)

            tool_traces: List[AgentToolTrace] = []
            full_content = ""
            pre_tool_content = ""  # 保存工具调用前的AI对话内容

            for round_idx in range(MAX_TOOL_CALL_ROUNDS):
                content, tool_calls, model = await self._call_llm_with_tools(
                    messages, available_tools, owner_id
                )

                if not tool_calls:
                    full_content = content or ""
                    break

                # ✅ 关键修复：保存工具调用时的AI对话内容
                if content and content.strip():
                    pre_tool_content = content
                    cleaned_content = _clean_dsml_content(content)
                    if cleaned_content and cleaned_content.strip():
                        full_content += cleaned_content + "\n\n"

                        # 立即输出对话内容给前端（让用户看到对话过程）
                        # 注意：stream_chat 方法只 yield string，不 yield tuple
                        # 如果需要发送结构化事件，请使用 stream_chat_with_events 方法
                        yield cleaned_content

                for tc in tool_calls:
                    tool_name = tc.get("function", {}).get("name", "")
                    tool_args_str = tc.get("function", {}).get("arguments", "{}")
                    try:
                        tool_args = json.loads(tool_args_str)
                    except json.JSONDecodeError:
                        tool_args = {}

                    tool_result = await self._execute_tool(tool_name, tool_args, owner_id)
                    tool_traces.append(AgentToolTrace(
                        tool_name=tool_name,
                        status="success" if tool_result.success else "failed",
                        summary=tool_result.to_string()[:500],
                        duration_ms=0,
                    ))

                    messages.append({"role": "assistant", "content": None, "tool_calls": [tc]})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "content": tool_result.to_string(),
                    })

            chain: list[tuple[str | None, str]] = [(settings.ZEROCLAW_GATEWAY_URL, settings.ZEROCLAW_DEFAULT_MODEL)]
            if feature_flag_service.is_enabled("provider_fallback", owner_id):
                chain.append((settings.ZEROCLAW_FALLBACK_GATEWAY_URL, settings.ZEROCLAW_FALLBACK_MODEL))

            streamed = False
            for gateway, model_name in chain:
                if not gateway:
                    continue
                payload = {
                    "model": model_name,
                    "messages": messages,
                    "stream": True,
                    "tools": self._format_tools_for_api(available_tools) if available_tools else None,
                }
                try:
                    async for token in self.provider.stream_complete(payload, gateway_url=gateway):
                        full_content += token
                        yield token
                        streamed = True
                    break
                except (httpx.HTTPError, RuntimeError):
                    continue

            if not streamed:
                fallback_content, _ = await self._generate_fallback(owner_id, req, tool_traces)
                full_content = fallback_content
                for chunk in self.build_stream_tokens(fallback_content):
                    yield chunk

            if req.project_id:
                self._write_auto_evidence(req.project_id, owner_id, full_content, tool_traces)

            logger.info("agent_stream_success trace_id=%s tools=%s", trace_id, len(tool_traces))
        except Exception:
            logger.exception("agent_stream_failed trace_id=%s", trace_id)
            raise

    async def stream_chat_with_events(
        self, owner_id: str, req: AgentChatRequest
    ) -> AsyncGenerator[tuple[str, Dict[str, Any]], None]:
        trace_id = str(uuid.uuid4())
        logger.info("agent_stream_events_start trace_id=%s owner_id=%s", trace_id, owner_id)

        try:
            skill_def = self._resolve_skill(req)
            user_message = self._strip_skill_hint(req.message)
            stage, sub_skill_id = self._resolve_stage_with_fallback(skill_def, req)
            force_code_generation = self._should_force_code_generation(req)

            if skill_def:
                yield ("skill_activated", {
                    "skill_id": skill_def.skill_id,
                    "skill_name": skill_def.name,
                    "sub_skill_id": sub_skill_id,
                    "sub_skill_name": stage.name if stage else None,
                })

            system_prompt = self._build_system_prompt(req, skill_def, sub_skill_id)
            context_block = self._build_context_block(req, owner_id)
            messages = self._build_messages(req, system_prompt, context_block)
            available_tools = self._get_available_tools(skill_def, sub_skill_id, req)

            tool_traces: List[AgentToolTrace] = []
            full_content = ""
            last_known_stage: str | None = None
            code_generated_sent = False

            if req.project_id:
                current_state = db.get_skill_state(req.project_id)
                if current_state:
                    last_known_stage = current_state.current_stage
                    yield ("stage_changed", {
                        "stage": current_state.current_stage,
                        "stage_name": self._get_stage_display_name(current_state.current_stage),
                    })

            bootstrap_followup = self._build_bootstrap_followup(req)
            if bootstrap_followup:
                full_content, question_data = bootstrap_followup
                yield ("content_update", {"content": full_content})
                yield ("question", question_data)
                yield ("final", {"status": "completed", "tools_used": 0, "content": full_content})
                logger.info("agent_stream_events_bootstrap_followup_success trace_id=%s", trace_id)
                return

            if self._is_complete_missing_artifacts_request(req):
                completion_result = self._complete_missing_artifacts(req, owner_id)
                full_content = self._format_completion_report(completion_result)
                yield ("tool_call", {
                    "tool_name": "complete_missing_artifacts",
                    "success": bool(completion_result.get("success")),
                    "data": completion_result,
                })
                final_stage = str(completion_result.get("final_stage") or last_known_stage or "")
                if final_stage:
                    yield ("stage_changed", {
                        "stage": final_stage,
                        "stage_name": self._get_stage_display_name(final_stage),
                    })
                yield ("content_update", {"content": full_content})
                if req.project_id:
                    self._write_auto_evidence(req.project_id, owner_id, full_content, tool_traces)
                yield ("final", {"status": "completed", "tools_used": 1, "content": full_content})
                logger.info("agent_stream_events_completion_success trace_id=%s", trace_id)
                return

            for round_idx in range(MAX_TOOL_CALL_ROUNDS):
                content, tool_calls, model = await self._call_llm_with_tools(
                    messages, available_tools, owner_id
                )

                # 关键修复：累积工具调用前的 content（AI 在调用工具前已生成的用户可见文字）
                # 类似 stream_chat 中的 pre_tool_content 逻辑
                # 重要：只在有 tool_calls 时才 yield token，避免与第二轮流式调用重复推送
                if tool_calls and content and content.strip():
                    cleaned = _clean_dsml_content(content)
                    if cleaned and cleaned.strip():
                        full_content += cleaned + "\n\n"
                        # 实时把工具调用前的对话内容推给前端（让用户看到思考/引导语）
                        yield ("token", {"token": cleaned})
                        if _contains_question_block(cleaned):
                            question_data = _parse_question_block(cleaned)
                            if question_data:
                                yield ("question", question_data)

                if not tool_calls:
                    break

                for tc in tool_calls:
                    tool_name = tc.get("function", {}).get("name", "")
                    tool_args_str = tc.get("function", {}).get("arguments", "{}")
                    try:
                        tool_args = json.loads(tool_args_str)
                    except json.JSONDecodeError:
                        tool_args = {}

                    yield ("tool_start", {
                        "tool_name": tool_name,
                        "tool_args": tool_args,
                    })

                    tool_result = await self._execute_tool(tool_name, tool_args, owner_id)
                    tool_traces.append(AgentToolTrace(
                        tool_name=tool_name,
                        status="success" if tool_result.success else "failed",
                        summary=tool_result.to_string()[:500],
                        duration_ms=0,
                    ))

                    yield ("tool_end", {
                        "tool_name": tool_name,
                        "success": tool_result.success,
                        "data": tool_result.data if tool_result.success else None,
                        "error": tool_result.error if not tool_result.success else None,
                    })

                    yield ("tool_call", {
                        "tool_name": tool_name,
                        "success": tool_result.success,
                        "data": tool_result.data if tool_result.success else None,
                    })

                    if tool_name == "project_creator" and tool_result.success and tool_result.data:
                        project_data = tool_result.data if isinstance(tool_result.data, dict) else {}
                        created_stage = str(project_data.get("current_stage") or "stage_01_brainstorm")
                        yield ("project_created", {
                            "project_id": project_data.get("project_id", str(uuid.uuid4())),
                            "project_name": project_data.get("name") or project_data.get("project_name", "新项目"),
                            "current_stage": created_stage,
                        })
                        last_known_stage = created_stage
                        yield ("stage_changed", {
                            "stage": created_stage,
                            "stage_name": self._get_stage_display_name(created_stage),
                        })

                    if tool_name == "project_code_writer" and tool_result.success and tool_result.data:
                        code_data = tool_result.data if isinstance(tool_result.data, dict) else {}
                        workspace = db.get_project_workspace(str(code_data.get("project_id") or req.project_id or "")) or {}
                        code = str(workspace.get("code") or "")
                        language = str(workspace.get("language") or code_data.get("language") or "html")
                        if code:
                            code_generated_sent = True
                            yield ("code_generated", {
                                "project_id": code_data.get("project_id") or req.project_id,
                                "code": code,
                                "language": language,
                                "filename": workspace.get("filename") or code_data.get("filename"),
                                "files": workspace.get("files") or [],
                                "saved_at": workspace.get("saved_at") or code_data.get("saved_at"),
                                "source": "tool",
                            })

                    if req.project_id:
                        current_state = db.get_skill_state(req.project_id)
                        if current_state and current_state.current_stage != last_known_stage:
                            last_known_stage = current_state.current_stage
                            yield ("stage_changed", {
                                "stage": current_state.current_stage,
                                "stage_name": self._get_stage_display_name(current_state.current_stage),
                            })

                    messages.append({"role": "assistant", "content": None, "tool_calls": [tc]})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "content": tool_result.to_string(),
                    })

            if full_content and _contains_question_block(full_content) and not force_code_generation:
                question_data = _parse_question_block(full_content)
                if question_data:
                    yield ("question", question_data)

            chain: list[tuple[str | None, str]] = [(settings.ZEROCLAW_GATEWAY_URL, settings.ZEROCLAW_DEFAULT_MODEL)]
            if feature_flag_service.is_enabled("provider_fallback", owner_id):
                chain.append((settings.ZEROCLAW_FALLBACK_GATEWAY_URL, settings.ZEROCLAW_FALLBACK_MODEL))

            streamed = False
            active_gateway = None  # 记录实际使用的网关地址
            active_model = None   # 记录实际使用的模型名称

            for gateway, model_name in chain:
                if not gateway:
                    continue
                payload = {
                    "model": model_name,
                    "messages": messages,
                    "stream": True,
                }
                try:
                    stream_finish_reason = None
                    async for token in self.provider.stream_complete(payload, gateway_url=gateway):
                        # 检测 finish_reason 标记
                        if token.startswith("__FINISH_REASON__:"):
                            stream_finish_reason = token.split(":", 1)[1]
                            logger.info("stream_finish_reason_detected reason=%s", stream_finish_reason)
                            continue
                        full_content += token
                        yield ("token", {"token": token})
                        streamed = True
                    # 记录成功使用的网关和模型
                    active_gateway = gateway
                    active_model = model_name
                    # 如果检测到 length 截断，标记为截断
                    if stream_finish_reason == "length":
                        logger.warning("stream_truncated_by_length finish_reason=%s", stream_finish_reason)
                        is_truncated = True
                    break
                except (httpx.HTTPError, RuntimeError):
                    continue

            if not streamed:
                fallback_content, _ = await self._generate_fallback(owner_id, req, tool_traces)
                full_content = fallback_content
                for chunk in self.build_stream_tokens(fallback_content):
                    yield ("token", {"token": chunk})

# ========== 检测输出是否被截断并自动续接 ==========
            # 问题：AI 输出经常在代码块中间、句子中间被截断，导致用户需要不断输入"继续"
            # 解决方案：检测截断特征（未闭合的代码块、不完整的语句），自动请求 AI 继续完成
            # 注意：is_truncated 可能在流处理时已经被设置为 True（当 finish_reason == "length"）
            if 'is_truncated' not in locals():
                is_truncated = False

            # 在检测前先记录当前状态
            if full_content:
                logger.info(
                    "checking_truncation length=%d last_50_chars=%s streamed=%s gateway=%s model=%s",
                    len(full_content),
                    repr(full_content[-50:]) if len(full_content) > 50 else repr(full_content),
                    streamed,
                    active_gateway,
                    active_model,
                )

            if full_content and self._is_output_truncated(full_content):
                is_truncated = True
                logger.warning(
                    "output_truncated_detected length=%d last_100_chars=%s will_attempt_auto_continue gateway=%s model=%s",
                    len(full_content),
                    repr(full_content[-100:]) if len(full_content) > 100 else repr(full_content),
                    active_gateway,
                    active_model,
                )
                print(f"[AUTO-CONTINUE] Truncation detected! length={len(full_content)}, gateway={active_gateway}, model={active_model}")  # 添加打印以便调试

                # 使用记录的网关和模型创建新的 payload
                if active_gateway and active_model:
                    # 添加续接提示到消息列表 - 使用副本避免修改原始 messages
                    continue_prompt = """请继续完成上面的输出。你的回复在中间被截断了。

续接规则：
1. **不要重复**已经输出的内容，直接从截断的地方继续
2. **保持格式一致**：如果之前是代码块，继续输出代码；如果是文本，继续输出文本
3. **确保完整性**：确保代码块正确闭合（```），语句完整
4. **不要添加**"好的，我继续"之类的过渡语，直接输出内容"""

                    # 创建消息副本用于续接对话
                    continue_messages = messages.copy()
                    continue_messages.append({"role": "assistant", "content": full_content})
                    continue_messages.append({"role": "user", "content": continue_prompt})

                    continue_payload = {
                        "model": active_model,
                        "messages": continue_messages,
                        "stream": True,
                    }

                    # 最多尝试续接 2 次
                    max_continue_attempts = 2
                    for attempt in range(max_continue_attempts):
                        continued_content = ""
                        continue_finish_reason = None
                        try:
                            async for token in self.provider.stream_complete(continue_payload, gateway_url=active_gateway):
                                # 检测 finish_reason 标记
                                if token.startswith("__FINISH_REASON__:"):
                                    continue_finish_reason = token.split(":", 1)[1]
                                    continue
                                continued_content += token
                                yield ("token", {"token": token})
                                full_content += token
                                streamed = True

                            # 检查续接后是否仍然截断
                            still_truncated = self._is_output_truncated(full_content)
                            # 如果续接仍然因为 length 截断，继续尝试
                            if continue_finish_reason == "length":
                                still_truncated = True
                                logger.warning("auto_continue_still_length_truncated attempt=%d", attempt + 1)

                            if not still_truncated:
                                logger.info("auto_continue_success attempt=%d total_length=%d", attempt + 1, len(full_content))
                                break
                            else:
                                logger.warning("auto_continue_still_truncated attempt=%d will_retry", attempt + 1)
                                # 添加续接的对话到消息列表用于下一次尝试
                                continue_messages.append({"role": "assistant", "content": continued_content})
                                continue_messages.append({"role": "user", "content": "请继续完成，确保输出完整。"})
                                # 更新 payload 以包含新的消息
                                continue_payload["messages"] = continue_messages.copy()
                        except (httpx.HTTPError, RuntimeError) as e:
                            logger.error("auto_continue_failed attempt=%d error=%s", attempt + 1, str(e))
                            break
                else:
                    logger.error("auto_continue_skipped no_active_gateway model=%s", active_model)

            # ========== 强制续接：确保输出完整性 ==========
            # 即使 _is_output_truncated 没有检测到截断，如果输出看起来不完整（太短或以可疑模式结尾），
            # 也尝试续接一次
            if not is_truncated and full_content and active_gateway and active_model:
                # 检查输出是否可能不完整
                might_be_incomplete = False

                # 检查 1：输出太短（少于 100 字符）且不是纯对话
                if len(full_content.strip()) < 100 and '```' in full_content:
                    might_be_incomplete = True
                    logger.info("output_might_be_incomplete reason=too_short_with_code length=%d", len(full_content))

                # 检查 2：输出以常见的编程语言名称结尾（可能是代码块标记被截断）
                last_line = full_content.strip().split('\n')[-1].strip() if full_content.strip() else ""
                lang_names = ['python', 'javascript', 'typescript', 'html', 'css', 'java',
                               'c', 'cpp', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'bash']
                if last_line.lower() in lang_names and '```' in full_content:
                    might_be_incomplete = True
                    logger.info("output_might_be_incomplete reason=ends_with_lang_name last_line=%s", last_line)

                if might_be_incomplete:
                    continue_payload = {
                        "model": active_model,
                        "messages": messages + [{"role": "user", "content": "请继续完成上面的输出，确保代码块完整闭合。"}],
                        "stream": True,
                    }
                    try:
                        force_continue_finish_reason = None
                        async for token in self.provider.stream_complete(continue_payload, gateway_url=active_gateway):
                            # 检测 finish_reason 标记
                            if token.startswith("__FINISH_REASON__:"):
                                force_continue_finish_reason = token.split(":", 1)[1]
                                continue
                            yield ("token", {"token": token})
                            full_content += token
                        if force_continue_finish_reason == "length":
                            logger.warning("force_continue_still_truncated finish_reason=length")
                        else:
                            logger.info("force_continue_success total_length=%d", len(full_content))
                    except (httpx.HTTPError, RuntimeError) as e:
                        logger.error("force_continue_failed error=%s", str(e))

            full_content = _clean_dsml_content(full_content)

            # 输出层去重：修复 LLM 重复输出问题（如"好好想法想法"→"好想法"）
            deduped_content = self.deduplicate_repeated_text(full_content)
            if deduped_content != full_content and len(deduped_content) > 0:
                full_content = deduped_content

            # ========== 阶段越权检测与拦截（核心防御）==========
            # 检测 AI 是否在非代码阶段输出了代码、跳跃了阶段、或生成了后续工件
            # 关键修复：即使在 force_code_generation 模式（stage_07_execute），也要检测阶段跳跃和提前结案
            if last_known_stage and full_content.strip():
                violation = self._detect_stage_violation(last_known_stage, full_content, tool_traces, force_code_generation)
                if violation:
                    logger.warning(
                        "stage_violation_detected stage=%s violation_type=%s will_intercept=True",
                        last_known_stage, violation.get("type"),
                    )
                    # 生成纠正内容，替换 AI 的违规输出
                    correction = self._generate_stage_violation_correction(
                        last_known_stage, violation, skill_def, req
                    )
                    if correction:
                        # 发送纠正内容给前端（覆盖 AI 的违规输出）
                        yield ("content_update", {"content": correction})
                        full_content = correction
                        # 发送当前阶段的正确 question
                        recovery_question = self._detect_incomplete_stage_and_recover(
                            skill_def, req, correction, tool_traces, last_known_stage
                        )
                        if recovery_question:
                            yield ("question", recovery_question)
                        # 跳过后续的 question 检测逻辑，避免重复发送
                        if req.project_id:
                            self._write_auto_evidence(req.project_id, owner_id, full_content, tool_traces)
                        yield ("final", {"status": "completed", "tools_used": len(tool_traces), "content": full_content})
                        logger.info("agent_stream_events_success_with_violation_correction trace_id=%s", trace_id)
                        return

            # 剥离 question XML 块（内部协议格式，不显示给用户）
            raw_for_question_parse = full_content
            clean_content, has_question = self.strip_question_xml(full_content)
            if clean_content != full_content:
                yield ("content_update", {"content": clean_content})
                full_content = clean_content

            if not force_code_generation:
                # 用原始内容（含XML）解析 question 事件，发送给前端渲染选项卡
                # 关键修复：当 _contains_question_block 为 True 但 _parse_question_block 解析失败时
                # （AI 输出了残破/不规范的 <question>/<option> 标签），必须回退到 fallback，
                # 否则前端永远收不到 question 事件，选项按钮不显示
                question_data = None
                if has_question or _contains_question_block(raw_for_question_parse):
                    question_data = _parse_question_block(raw_for_question_parse)
                    if question_data:
                        question_data["stage"] = last_known_stage
                        question_data["is_stage_final"] = _is_stage_final_question(question_data)
                        yield ("question", question_data)

                # 普通对话不要再硬编码通用按钮。
                # 只有在明确的成果卡补充场景下，才允许用专用 fallback question。
                if not question_data and full_content.strip():
                    fallback_question = self._generate_fallback_question(req, full_content, tool_traces)
                    if fallback_question:
                        yield ("question", fallback_question)
                    else:
                        template_question = self._generate_skill_template_question(skill_def, req)
                        if template_question:
                            yield ("question", template_question)
                        elif has_question or _contains_question_block(raw_for_question_parse):
                            logger.warning("question_block_parse_failed_without_fallback stage=%s", last_known_stage)
                        else:
                            # 阶段完整性检测：AI 既没输出 question 也没调工具写工件
                            # 从 SKILL.md 阶段定义中检测是否应该有 question，自动补发
                            recovery_question = self._detect_incomplete_stage_and_recover(
                                skill_def, req, full_content, tool_traces, last_known_stage
                            )
                            if recovery_question:
                                yield ("question", recovery_question)

            if req.project_id:
                self._write_auto_evidence(req.project_id, owner_id, full_content, tool_traces)

            # ========== 关键修复：移除自动结案检测 ==========
            # 原因：阶段推进应该由 AI 主动控制，通过调用 stage_advancer 工具来完成
            # 自动根据 AI 文本输出推进阶段会导致：
            # 1. AI 可能口头上说"项目完成"但实际上还没满足门禁条件
            # 2. 违背了 PBL Skill "门禁检查 → 工具调用 → 阶段推进"的流程设计
            # 3. 导致 AI 擅自跳跃阶段，提前标记项目完成
            #
            # 正确做法：
            # - AI 必须显式调用 stage_advancer 工具来推进阶段
            # - 系统在 stage_advancer 中执行门禁检查
            # - 如果 AI 口头说完成但没调用工具，系统应该提醒 AI 调用工具，而不是自动推进
            #
            # 已移除：self._auto_complete_project_if_needed(req.project_id, full_content, owner_id)

            # ========== 代码写入 workspace 的唯一入口：AI 显式调用 project_code_writer 工具 ==========
            # 历史 bug 修复（2026-07-18 事故）：
            #   原实现会从 AI 回复文本里自动提取 ```python / ```html 代码块并覆盖 workspace.code。
            #   但 AI 回复里的代码块有 4 种用途（项目代码 / 诊断脚本 / 示例 / 反例），系统无法区分。
            #   当 AI 为"生成成果档案卡"等任务在回复里贴诊断脚本（os.walk 扫描目录）时，
            #   原机制会误把脚本当作项目代码，永久覆盖原代码（且无历史快照可恢复）。
            #
            # 正确做法：代码落库必须由 AI 显式调用 project_code_writer 工具触发（工具执行环节已写库，
            #   并在上方 tool_name == "project_code_writer" 分支发送 code_generated 事件）。
            #   本处仅在 force_code_generation 下未交付代码时提示，绝不再自动捞取文本代码块。
            if force_code_generation and not code_generated_sent:
                if req.project_id:
                    logger.info(
                        "force_code_generation_ai_no_writer_tool trace_id=%s "
                        "workspace_unchanged (no auto-extract)",
                        trace_id,
                    )
                    yield ("code_generation_failed", {
                        "project_id": req.project_id,
                        "reason": "ai_did_not_use_writer_tool",
                        "message": "代码尚未写入。请调用 project_code_writer 工具将项目代码写入工作区，而不是在回复中贴代码块。",
                    })
                else:
                    yield ("code_generation_failed", {
                        "project_id": req.project_id,
                        "reason": "missing_project_id",
                        "message": "已检测到代码，但缺少项目 ID，无法保存到编辑器工作区。",
                    })

            yield ("final", {"status": "completed", "tools_used": len(tool_traces), "content": full_content})
            logger.info("agent_stream_events_success trace_id=%s tools=%s", trace_id, len(tool_traces))
        except Exception:
            logger.exception("agent_stream_events_failed trace_id=%s", trace_id)
            raise

    def _build_system_prompt(self, req: AgentChatRequest, skill_def: Any, sub_skill_id: Optional[str]) -> str:
        teaching_mode_instruction = self._build_teaching_mode_instruction(req)
        scene_instruction = self._build_scene_instruction(req)
        if self._should_force_code_generation(req):
            # ========== 关键修复：从"纯代码生成"改为"教学式编码" ==========
            # 问题：原来的提示词让 AI 变成纯代码生成器，完全跳过 PBL 教学引导
            # 修复：即使生成代码，也要保持"研学导师"角色，引导学生理解代码
            force_prompt = """
你是 fineSTEM 的 AI 研学导师，当前进入编码实现环节。

## 角色定位（重要）
你不是单纯的"代码生成器"，而是**引导学生学习编程的导师**。即使生成代码，也要：
1. **先讲解设计思路** —— 这段代码要解决什么问题、关键逻辑是什么
2. **再给出代码实现** —— 完整可运行的代码块
3. **最后引导下一步** —— 如何测试、可能遇到的问题、如何改进

## 编码目标
- 用户明确要求生成或修复代码
- 当前项目处于执行或验收阶段
- 产出完整可运行的代码，但**不要只给代码**

## 教学式编码规则
- ✅ **必须**：先简要说明代码的设计思路（2-3句话）
- ✅ **必须**：代码要有清晰注释，解释关键逻辑
- ✅ **必须**：给出后说明如何测试这段代码
- ❌ **禁止**：直接丢代码不给任何解释
- ❌ **禁止**：使用"MVP"、"最小版本"等模板化词汇
- ❌ **禁止**：声称"已生成"、"已写入"等固定套话

## 代码质量要求
- 代码块语言标签：python / javascript / html / css / typescript
- 禁止用 ```text / ```bash / ```markdown 等非代码块
- 必须完整可运行，不要省略关键部分
- 优先单文件、零配置版本，但功能要完整

## 输出格式
1. **设计思路**（2-3句）：这段代码要解决什么、关键逻辑是什么
2. **代码实现**（带注释的完整代码块）
3. **测试引导**（1-2句）：如何验证代码、可能遇到的问题

如果信息不完整，根据已有信息生成代码，并在注释中标注"TODO：需要确认..."
""".strip()
            if teaching_mode_instruction:
                force_prompt += f"\n\n{teaching_mode_instruction}"
            if scene_instruction:
                force_prompt += f"\n\n{scene_instruction}"
            return force_prompt

        direct_code_override = ""
        if skill_def:
            prompt = skill_def.get_system_prompt_for_stage(sub_skill_id)
            current_stage_id = self._get_current_stage(req) or ""
            stage_code_lock = ""
            # 定义每个阶段允许到达的最大阶段索引（用于防止跳跃）
            STAGE_ORDER = [
                "stage_00_bootstrap", "stage_01_brainstorm", "stage_02_brief",
                "stage_03_constraints", "stage_04_track", "stage_05_design",
                "stage_06_step_plan", "stage_07_execute", "stage_08_evaluate",
            ]
            CURRENT_STAGE_IDX = STAGE_ORDER.index(current_stage_id) if current_stage_id in STAGE_ORDER else -1
            # 代码生成只允许在 design 及之后
            CODE_ALLOWED_STAGES = {"stage_05_design", "stage_07_execute", "stage_08_evaluate"}
            # 分步计划（step_plan）只允许在 design 之后
            STEP_PLAN_ALLOWED_FROM = "stage_05_design"
            # 验收/评估内容只允许在 evaluate 阶段
            EVALUATE_ONLY_STAGE = "stage_08_evaluate"

            if current_stage_id and current_stage_id not in CODE_ALLOWED_STAGES:
                # 根据当前阶段动态生成具体的任务描述
                STAGE_TASK_MAP = {
                    "stage_00_bootstrap": "完成项目初始化，收集项目名称、年级、时间预算、初步想法",
                    "stage_01_brainstorm": "进行头脑风暴，探索多个创意方向并锁定一个",
                    "stage_02_brief": "撰写开题立项书，定义问题陈述、目标用户、成功标准、风险预案",
                    "stage_03_constraints": "裁剪项目范围，收集 must-have（必须做）、nice-to-have（可以做）、won't-have（不做）",
                    "stage_04_track": "选择技术轨道（网页/硬件/数据建模等），确定技术栈方向",
                }
                current_task = STAGE_TASK_MAP.get(current_stage_id, "完成当前阶段的任务和工件")

                stage_code_lock = f"""

---

## ⚠️ 当前阶段硬约束（系统强制执行 — 违反将被拦截）

**当前阶段**: `{current_stage_id}`
**本阶段任务**: {current_task}
**阶段顺序**: {' → '.join(STAGE_ORDER[:CURRENT_STAGE_IDX+1])} → **下一步按顺序推进**

### 🚫 绝对禁止（系统会检测并拦截）
1. **禁止输出任何代码块**：不要输出 ```python / ```javascript / ```html / ```css 等任何可执行代码
2. **禁止声称已生成代码**：不要说"已写入编辑器"、"代码已生成"、"main.py 已创建"等
3. **禁止讨论后续阶段的内容**：
   - 当前在 stage_00~stage_04，**禁止**讨论 step_plan（分步计划）、execute（编码实现）、evaluate（验收）
   - 不要列出从当前到 stage_08 的所有步骤表格
   - 不要说"即将生成 05_step_plan.json"或"准备进入执行阶段"
4. **禁止调用工具写后续阶段的工件**：不要尝试用 artifact_writer 写不属于当前阶段的文件

### ✅ 你应该做的事
1. **聚焦当前阶段任务**：{current_task}
2. **使用 <question> 与学生交互**：如果需要信息，输出选项让学生选择
3. **调用 artifact_writer 写当前阶段工件**：如 02_constraints.json（stage_03）或 track 选择结果（stage_04）
4. **完成后提示**：当前阶段工件写完后，简短说"本阶段已完成，下一步将进入 XX 阶段"

### 💡 学生要求生成代码时的标准回复
> "我理解你想看到代码！不过按照 PBL 流程，我们需要先完成当前的【{current_stage_id}】阶段（{current_task}）。\n> 这个阶段完成后，我们会自动进入设计阶段（stage_05），那时我会生成完整的代码框架。\n> 让我们先一起把当前阶段的工作做好，好吗？"

**记住：你的每次回复都会被系统检测。如果在非代码阶段输出了代码或跳跃了阶段，你的回复会被自动纠正。**
"""
            # 追加 XML 交互格式指令，确保需要选择题时输出可解析的 <question> 标签。
            xml_instruction = """

---

## 交互规则（仅在需要学生做选择时使用）

只有当你确实需要学生做选择、补充关键信息、或确认下一步方向时，才输出一个可解析的选项块。

- 当前上下文已经给出的项目 ID、项目名称、当前阶段、年级、时间预算、项目想法都视为已确认信息，禁止再次提问确认。
- 禁止把"项目名称 / 项目名 / 叫什么名字"作为 question，除非上下文明确没有项目名称且用户正在新建项目。
- 如果当前阶段是 stage_02_brief，问题必须围绕问题陈述、目标用户、成功标准、风险预案，不得回到项目名称。
- 如果当前阶段是 stage_03_constraints，问题必须围绕 must-have / nice-to-have / won't-have，不得回到项目名称。
- 如果当前阶段是 stage_05_design，问题必须围绕页面结构、模块、数据流、验收条件，不得回到项目名称。
- 如果当前阶段是 stage_07_execute，禁止再输出 question；必须直接生成可运行代码。
- 如果聊天历史或当前上下文里已经出现过年级、时间预算、初步想法，就不要重复问这三项。
- 如果信息已经足够推进当前阶段，就直接继续推进，不要为了凑交互而重复提问。
- 如果年级、时间预算、初步想法已经齐全，必须主动给出具体创意方向、实现方案或建议，不能继续停留在空泛提问。
- 如果用户明确要求"直接进入编码实现 / 直接给代码 / 写入编辑器 / 直接做"，且当前上下文已明确要求跳过引导或当前已在执行/验收阶段，才切到编码实现；否则继续当前 PBL 阶段，先给创意收敛、方向选择或方案建议。
- 生成代码、给出设计方案、总结结果时，默认不要额外附带 `<question>`，除非下一步真的需要用户选择。
- 同一轮回复最多包含一个 `<question>` 块。
- 禁止输出通用标题，例如"接下来你想怎么做？"、"你想怎么继续？"、"请选择"。
- 禁止输出通用按钮，例如"继续 / 详细说说 / 换个方向 / 了解更多"；按钮必须对应当前阶段、当前材料缺口或当前方案分支。
- **绝对禁止在回复末尾追加"已生成一个可运行的xxx版本，并写入编辑器"、"已成功运行"等固定套话**
- **禁止使用"MVP"、"最小版本"、"最小代码"、"可运行的最小"等词汇描述你的产出**

```xml
<question type="single" title="脑暴方向里，你更想先收敛哪一种？">
<option id="opt_poetry" label="古诗词生成器">先做一个能输入关键词生成古诗的小工具</option>
<option id="opt_story" label="互动故事机">先做一个能根据选择推进剧情的网页故事</option>
<option id="opt_other" label="其他">我有其他想法</option>
</question>
```

当你决定提问时：
- 优先使用 `<question>` / `<option>` XML。
- 如果你沿用阶段文档里的 AskUserQuestion 示例，也可以输出等价的 JSON 结构。
- 如果你已经在正文里列出 2-6 个明确备选项，也可以直接输出清晰的编号列表，每个选项单独一行。
- 选项要和当前阶段强相关，避免回到已经问过的起始问题。
- question 的 title 必须能单独成立，用户只看按钮区也能知道自己在选什么。
- 不要把选项藏在大段散文里；要让系统能够从 XML、JSON 或编号列表中稳定提取出来。
"""

            # 追加输出完整性和阶段推进约束（修复卡断 + 防跳跃）
            output_integrity_instruction = f"""

---

## 输出完整性约束（最高优先级 — 防止回复卡断）

- **每一轮回复都必须完整、自包含**。不要因为内容长就中途截断或省略关键部分。
- 如果你发现要输出的内容很多，**优先保证核心结论和下一步动作完整输出**，细节可以后续补充。
- **绝对禁止**在回复末尾输出"（继续...）"、"（未完待续）"、"请输入'继续'获取更多内容"之类的截断标记。
- **绝对禁止**故意留一半内容不输出，诱导用户不断发"继续"。每轮回复必须是一个语义完整的单元。
- **绝对禁止**说"由于篇幅限制"、"内容较长"、"这里只展示部分"等暗示输出被截断的话。
- **绝对禁止**在代码块中间截断，如果代码较长，优先给出完整可运行的核心代码，注释说明"完整代码已写入编辑器"。
- 如果同时需要：① 回答用户问题 ② 展示文档状态 ③ 给出选项 → 请把三者控制在合理长度内一起输出，而不是只输出其中一部分。
- 回复结构建议：先给核心回答/结论（2-4句），再给文档状态表（紧凑格式），最后给 `<question>`（如果需要）。不要写长篇大论。
- **关键原则**：宁可精简内容，也要保证输出的完整性。用户不需要输入"继续"就能看到完整的回复。
"""

            stage_progression_lock = f"""

---

## 🔒 阶段逐序推进硬约束（系统强制 — 违反将被自动纠正）

**当前阶段**: `{current_stage_id}` (第 {CURRENT_STAGE_IDX + 1}/9 阶段)
PBL 流程的核心价值在于**每个阶段的深度参与**，而非快速跳到终点。

### 🚫 以下行为会被系统检测并拦截
1. **阶段跳跃**：不要讨论或声称要进入比当前阶段更靠后的阶段
2. **快进假象**：禁止列出从当前到 stage_08 的完整步骤表格（截图中的「步骤6.2: 生成分步计划」就是违规示例）
3. **越权操作**：禁止在当前阶段生成后续阶段的工件（如在 stage_04 生成 step_plan）
4. **验收前置**：禁止在 stage_07 之前讨论验收标准或展示内容

### ✅ 正确的回复模式
- **只聚焦当前阶段**：你的回复应该只围绕 {current_stage_id} 的任务展开
- **工件导向**：当前阶段的任务是生成对应的工件（见上方硬约束部分）
- **交互式引导**：使用 <question> 收集学生意见，而不是直接替学生做决定
- **自然过渡**：只有当 artifact_writer 成功写入当前阶段工件后，才简短提示下一步

### 📋 当前阶段可用的工具
- `artifact_writer`: 写入**当前阶段**的工件文件
- `skill_state_reader`: 读取项目状态（随时可用）
- `stage_advancer`: **仅当当前阶段工件已完成后**才能调用
- `project_code_writer`: **仅在 stage_05 及之后可用**

### ⚠️ 常见错误示例（不要这样做）
❌ "好的，让我们开始制定分步执行计划！步骤6.2..." （在 stage_04 说这话 = 跳跃）
❌ "现在准备生成 05_step_plan.json 并更新状态" （越权写后续工件）
❌ "验收选项卡：功能完整/基本可用/还需要继续开发" （在非 evaluate 阶段显示验收）
✅ "好的！关于技术轨道选择，你更倾向于哪个方向？" （聚焦当前阶段）
"""
            full_prompt = prompt + direct_code_override + xml_instruction + output_integrity_instruction + stage_progression_lock + stage_code_lock
            if teaching_mode_instruction:
                full_prompt += f"\n\n{teaching_mode_instruction}"
            if scene_instruction:
                full_prompt += f"\n\n{scene_instruction}"
            return full_prompt

        from app.services.providers.zeroclaw_provider import build_system_prompt
        fallback_prompt = build_system_prompt(req.context or {}) + direct_code_override
        if teaching_mode_instruction:
            fallback_prompt += f"\n\n{teaching_mode_instruction}"
        if scene_instruction:
            fallback_prompt += f"\n\n{scene_instruction}"
        return fallback_prompt

    def _build_context_block(self, req: AgentChatRequest, owner_id: str) -> str:
        parts: List[str] = []
        if req.project_id:
            parts.append(f"当前项目ID: {req.project_id}")
            project = db.get_project(req.project_id)
            if project:
                parts.append(f"项目名称: {getattr(project, 'name', '')}")
                parts.append(f"当前阶段: {getattr(project, 'current_stage', '')}")
                parts.append(f"项目模式: {getattr(project, 'mode', '')}")
                state = db.get_skill_state(req.project_id)
                if state:
                    import json as _json
                    metadata_raw = getattr(state, "metadata", "{}")
                    metadata = _json.loads(metadata_raw) if isinstance(metadata_raw, str) else metadata_raw
                    teaching_mode = metadata.get("teachingMode", "guided")
                    parts.append(f"教学模式: {teaching_mode}")
                    evidence_count = db.count_evidence(req.project_id)
                    parts.append(f"证据数量: {evidence_count}")
        profile = self._collect_confirmed_profile(req)
        if profile.get("grade"):
            parts.append(f"已确认年级: {profile['grade']}")
        if profile.get("timeBudget"):
            parts.append(f"已确认时间预算: {profile['timeBudget']}")
        if profile.get("idea"):
            parts.append(f"已确认项目想法: {profile['idea']}")
        confirmed_fields = [name for name in ("grade", "timeBudget", "idea") if profile.get(name)]
        if confirmed_fields:
            missing_labels: List[str] = []
            if not profile.get("grade"):
                missing_labels.append("年级")
            if not profile.get("timeBudget"):
                missing_labels.append("时间预算")
            if not profile.get("idea"):
                missing_labels.append("初步想法")
            if missing_labels:
                parts.append(f"首次信息采集状态: 已确认部分基础信息；仅可追问缺失项：{'、'.join(missing_labels)}。")
            else:
                parts.append("首次信息采集状态: 年级、时间预算、初步想法均已确认，禁止重复追问。")
        context = req.context or {}
        if context.get("scene"):
            parts.append(f"场景: {context['scene']}")
        if context.get("project_name"):
            parts.append(f"前端已确认项目名称: {context['project_name']}")
        if context.get("force_code_generation"):
            parts.append("本轮强制目标: 直接生成可运行代码，禁止继续提问。")
        if context.get("preferred_output_language"):
            parts.append(f"期望输出语言: {context['preferred_output_language']}")
        if context.get("teaching_mode"):
            parts.append(f"请求教学模式: {context['teaching_mode']}")
        if context.get("demo_id"):
            parts.append(f"当前Demo ID: {context['demo_id']}")
        parts.append(
            "【禁止行为（最高优先级）】"
            "禁止把 project_id（UUID 格式）写入回复正文；"
            "禁止在正文中输出 'Skill' / 'skill_state_writer' / 工具名称等内部标识符；"
            "禁止伪造工具调用——需要写入文档时必须真正调用 skill_state_writer 工具，"
            "不得只在文字里声称'已写入'或'已生成'而不实际调用工具。"
        )
        return "\n".join(parts) if parts else ""

    def _build_messages(self, req: AgentChatRequest, system_prompt: str, context_block: str) -> List[Dict[str, Any]]:
        messages: List[Dict[str, Any]] = []
        full_system = system_prompt
        if context_block:
            full_system += f"\n\n## 当前上下文\n{context_block}"
        messages.append({"role": "system", "content": full_system})
        history_messages = self._build_history_messages(req)
        if history_messages:
            messages.extend(history_messages)
        messages.append({"role": "user", "content": self._strip_skill_hint(req.message)})
        return messages

    def _build_history_messages(self, req: AgentChatRequest) -> List[Dict[str, str]]:
        raw_messages: List[Any] = list(req.messages or [])
        if not raw_messages and req.project_id:
            workspace = db.get_project_workspace(req.project_id) or {}
            raw_messages = workspace.get("chat_messages") or []

        history_messages: List[Dict[str, str]] = []
        for item in raw_messages[-12:]:
            role = getattr(item, "role", None)
            content = getattr(item, "content", None)
            if isinstance(item, dict):
                role = item.get("role")
                content = item.get("content")
            if role not in {"user", "assistant"}:
                continue
            if not isinstance(content, str):
                continue
            cleaned_content = content.strip()
            if not cleaned_content:
                continue
            history_messages.append({"role": role, "content": cleaned_content})
        return history_messages

    @staticmethod
    def _is_generic_project_name(project_name: str) -> bool:
        """
        过滤创建阶段的通用项目名，避免把“我想做一个项目”误判成已有具体想法。
        """
        normalized = re.sub(r"\s+", "", project_name or "")
        normalized = re.sub(r"[。.!！？,，、…]+$", "", normalized)
        normalized = re.sub(r"\.{3,}$", "", normalized)
        if not normalized:
            return True
        if normalized in {"未命名项目", "新项目", "创建新项目", "开始项目"}:
            return True
        return bool(re.fullmatch(
            r"(?:我想做(?:一?个)?项目(?:[，,、]?(?:帮我(?:选题(?:和规划)?|规划)|先(?:选题|脑爆)|需要(?:选题|脑爆)|一起(?:选题|规划)))?|帮我(?:选题(?:和规划)?|规划))",
            normalized,
        ))

    def _collect_confirmed_profile(self, req: AgentChatRequest) -> Dict[str, str]:
        history_messages = self._build_history_messages(req)
        text_parts = [item["content"] for item in history_messages if item.get("content")]
        user_text_parts = [item["content"] for item in history_messages if item.get("role") == "user" and item.get("content")]
        current_message = self._strip_skill_hint(req.message)
        if current_message:
            text_parts.append(current_message)
            user_text_parts.append(current_message)

        project_name = ""
        if req.project_id:
            project = db.get_project(req.project_id)
            if project and getattr(project, "name", ""):
                project_name = str(getattr(project, "name", "")).strip()

        full_text = "\n".join(text_parts)
        user_text = "\n".join(user_text_parts)
        profile: Dict[str, str] = {}

        grade_matches = re.findall(r"(初中生|高中生|初中|高中)", full_text)
        if grade_matches:
            raw_grade = grade_matches[-1]
            profile["grade"] = "高中" if "高" in raw_grade else "初中"

        time_matches = re.findall(
            r"((?:\d+\s*-\s*\d+|\d+\s*到\s*\d+|\d+)\s*小时(?:间)?(?:以上|\+)?|半天|一天|两天|一周|2小时|4-6小时|6小时|12小时\+?)",
            full_text,
            flags=re.IGNORECASE,
        )
        if time_matches:
            profile["timeBudget"] = re.sub(r"\s+", "", time_matches[-1])

        if project_name and not self._is_generic_project_name(project_name):
            profile["idea"] = project_name
        else:
            if re.search(r"回答[:：]?(完全没想法|有个大概方向|已经有具体想法|需要脑爆)", user_text):
                profile["idea"] = "需要脑爆" if "完全没想法" in user_text or "需要脑爆" in user_text else "已确认起点"
                return profile
# idea 只能从用户表达中提取，避免把 assistant 的"做一个超简单的项目"误判成已确认想法。
            idea_match = re.search(r"(?:想做一个项目[，,：:]?|做一个|项目主题是|主题是)([^。\n]{4,60})", user_text)
            if idea_match:
                profile["idea"] = idea_match.group(1).strip(" ，,：:")

        return profile

    def _get_available_tools(self, skill_def: Any, sub_skill_id: Optional[str], req: Optional[AgentChatRequest] = None) -> List[str]:
        if req and self._should_force_code_generation(req):
            return ["project_code_writer", "code_runner"]
        if not skill_def:
            tools = ["skill_state_reader", "resource_searcher", "code_runner"]
        else:
            tools = skill_def.get_tools_for_stage(sub_skill_id)
        if req and self._is_achievement_scene(req):
            tools = list(tools) + ["artifact_reader", "resource_searcher", "achievement_card"]
        return list(dict.fromkeys(tools))

    def _format_tools_for_api(self, tool_names: List[str]) -> List[Dict[str, Any]]:
        all_defs = {t["name"]: t for t in get_all_tools_definitions()}
        result = []
        for name in tool_names:
            if name in all_defs:
                result.append({"type": "function", "function": all_defs[name]})
        return result

    async def _call_llm_with_tools(
        self,
        messages: List[Dict[str, Any]],
        available_tools: List[str],
        owner_id: str,
    ) -> tuple[str, List[Dict[str, Any]], str]:
        chain: list[tuple[str | None, str]] = [(settings.ZEROCLAW_GATEWAY_URL, settings.ZEROCLAW_DEFAULT_MODEL)]
        if feature_flag_service.is_enabled("provider_fallback", owner_id):
            chain.append((settings.ZEROCLAW_FALLBACK_GATEWAY_URL, settings.ZEROCLAW_FALLBACK_MODEL))

        tools_api = self._format_tools_for_api(available_tools) if available_tools else None

        for gateway, model in chain:
            if not gateway:
                continue
            payload = {
                "model": model,
                "messages": messages,
                "stream": False,
            }
            if tools_api:
                payload["tools"] = tools_api
                payload["tool_choice"] = "auto"

            try:
                result = await self.provider.complete_with_tool_calls(payload, gateway_url=gateway)
                content = result["content"]
                tool_calls = result["tool_calls"]
                finish_reason = result.get("finish_reason", "")

                # 检查输出是否被截断
                if finish_reason == "length":
                    logger.warning("llm_response_truncated finish_reason=length model=%s", model)
                    # 添加截断警告到内容末尾
                    content += "\n\n[系统提示：AI 回复可能因长度限制被截断。如需完整内容，请尝试简化请求或分批处理。]"

                return content, tool_calls, model
            except (httpx.HTTPError, RuntimeError):
                continue

        if settings.ZEROCLAW_ENABLE_MOCK_FALLBACK:
            return "AI 模型暂时不可用，请稍后重试。", [], settings.ZEROCLAW_LOCAL_SAFE_MODEL
        raise RuntimeError("ZeroClaw 网关调用失败，且已禁用 Mock 回退")

    async def _execute_tool(self, tool_name: str, params: Dict[str, Any], owner_id: str) -> ToolResult:
        """
        执行工具调用，增加阶段门禁检查。

        防止 AI 在错误阶段调用不应该使用的工具：
        - project_code_writer: 仅 stage_05 及之后可用
        - artifact_writer 写特定工件: 需要在对应阶段或之后
        - stage_advancer: 仅当当前阶段工件完成后可用
        """
        tool = get_tool(tool_name)
        if not tool:
            return ToolResult(False, error=f"未知工具: {tool_name}")

        # ========== 阶段门禁检查 ==========
        project_id = params.get("project_id", "")
        if project_id:
            current_state = db.get_skill_state(project_id)
            current_stage = getattr(current_state, "current_stage", "") if current_state else ""

            if current_stage:
                # 门禁 1: project_code_writer 只在 stage_05 及之后可用
                if tool_name == "project_code_writer":
                    CODE_WRITER_ALLOWED_FROM = "stage_05_design"
                    try:
                        current_idx = self.STAGE_ORDER_LIST.index(current_stage)
                        allowed_idx = self.STAGE_ORDER_LIST.index(CODE_WRITER_ALLOWED_FROM)
                        if current_idx < allowed_idx:
                            logger.warning(
                                "tool_stage_gate_blocked tool=%s current_stage=%s required_from=%s",
                                tool_name, current_stage, CODE_WRITER_ALLOWED_FROM,
                            )
                            return ToolResult(False, error=(
                                f"阶段门禁拦截：{tool_name} 工具只能在 {CODE_WRITER_ALLOWED_FROM} 及之后的阶段使用。"
                                f"当前阶段是 {current_stage}，请先完成当前阶段的任务。"
                                f"如果学生要求生成代码，请引导：当前阶段不产出代码，代码框架在 design 阶段才会生成。"
                            ))
                    except ValueError:
                        pass  # 阶段不在列表中，放行

                # 门禁 2: artifact_writer 写入后续阶段工件时拦截
                if tool_name == "artifact_writer":
                    artifact_path = str(params.get("path", "") or params.get("artifact_path", ""))
                    ARTIFACT_STAGE_MAP = {
                        "05_step_plan": (6, "stage_05_design"),
                        "04_design": (5, "stage_05_design"),
                        "06_code": (7, "stage_07_execute"),
                    }
                    for artifact_prefix, (required_idx, allowed_from) in ARTIFACT_STAGE_MAP.items():
                        if artifact_prefix in artifact_path:
                            try:
                                current_idx = self.STAGE_ORDER_LIST.index(current_stage)
                                if current_idx < required_idx:
                                    logger.warning(
                                        "artifact_stage_gate_blocked artifact=%s current_stage=%s required=%s",
                                        artifact_path, current_stage, allowed_from,
                                    )
                                    return ToolResult(False, error=(
                                        f"阶段门禁拦截：工件 {artifact_path} 属于后续阶段，当前 {current_stage} 不允许写入。"
                                        f"请先完成当前阶段的工件，按顺序推进后再生成此文件。"
                                    ))
                            except ValueError:
                                pass
                            break

        # 执行工具
        try:
            if tool_name == "project_creator":
                params = {
                    **params,
                    "author_id": owner_id,
                }
            return await tool.execute(params)
        except Exception as exc:
            logger.exception("tool_execution_failed tool=%s", tool_name)
            return ToolResult(False, error=f"工具执行失败: {exc}")

    def _write_auto_evidence(
        self,
        project_id: str,
        user_id: str,
        content: str,
        tool_traces: List[AgentToolTrace],
    ) -> None:
        from app.schemas.evidence import Evidence

        project = db.get_project(project_id)
        if not project:
            return

        summary_parts = [content[:500]]
        if tool_traces:
            tools_summary = "；".join([f"{t.tool_name}({t.status})" for t in tool_traces])
            summary_parts.append(f"工具调用: {tools_summary}")

        db.create_evidence(Evidence(
            id=str(uuid.uuid4()),
            project_id=project_id,
            author_id=user_id,
            type="text_log",
            content="\n".join(summary_parts),
            related_step=getattr(project, "current_stage", ""),
            created_at=utc_now(),
            updated_at=utc_now(),
            created_by=user_id,
        ))

    def _auto_complete_project_if_needed(
        self,
        project_id: str,
        ai_reply_content: str,
        owner_id: str,
    ) -> None:
        """
        自动结案检测：当 AI 声称项目已结案/完成时，自动更新 current_stage 为最终阶段。

        ⚠️ 重要修改（v2）：
        1. 收紧阶段限制：只允许在 stage_07_execute 及之后触发，防止中间阶段误判
        2. 添加排除规则：进度汇报类内容（里程碑、待完成等）不触发结案
        3. 要求更强的结案信号：必须明确提到"结案/归档/验收通过"等最终状态词汇
        """
        import re

        # ========== 排除规则：以下情况不触发自动结案 ==========
        # 这些是进度汇报或中间状态描述，不是真正的结案声明
        exclusion_patterns = [
            r"里程碑.*?(?:完成|待完成|待达成|进行中)",  # 里程碑进度列表
            r"待完成|待达成|待测试|待验证|待修复",         # 未完成任务列表
            r"步骤\d+.*?(?:完成|待)",                       # 分步计划中的步骤状态
            r"(?:框架|核心逻辑|基础功能).*?完成",           # 部分功能完成（非整体）
            r"代码.*?(?:未测试|未运行|需要测试|需要调试)",   # 明确说代码还没测好
            r"接下来.*?(?:继续|下一步|然后)",              # 还有后续动作
            r"让我们.*?(?:继续|开始|进入)",                 # 引导继续工作
            r"当前阶段|本阶段|这一步",                      # 强调当前阶段的表述
        ]

        for exclusion in exclusion_patterns:
            if re.search(exclusion, ai_reply_content, re.IGNORECASE):
                logger.info(
                    "auto_complete_excluded project=%s reason=progress_report pattern=%s content_preview=%s",
                    project_id, exclusion, ai_reply_content[:100],
                )
                return  # 排除：这是进度汇报，不是结案声明

        # ========== 结案意图关键词模式（更严格，要求明确的项目级结案信号）==========
        # 只匹配明确的项目完结声明，不包括中间进度的"完成"
        completion_patterns = [
            r"项目(?:已)?(?:正式)?(?:结[案案]|完[成结]|归档|封存)",  # 项目级完结
            r"(?:恭喜|祝贺).*?项目.*?(?:完成|结[案案])",               # 祝贺项目完成
            r"验收.*?(?:通过|完成).*(?:项目|PBL|流程)",                  # 验收通过
            r"PBL.*?(?:流程|项目).*(?:完成|结束|结案)",                   # PBL 流程结束
            r"已.*?(?:正式)?(?:提交|归档|存档).*?(?:报告|文档|成果)",     # 提交最终成果
            r"项目.*?状态.*?(?:已)?(?:完结|完成|结案)",                   # 状态更新为完成
        ]

        # 检测是否有结案意图
        has_completion_intent = False
        matched_pattern = None
        for pattern in completion_patterns:
            if re.search(pattern, ai_reply_content, re.IGNORECASE):
                has_completion_intent = True
                matched_pattern = pattern
                break

        if not has_completion_intent:
            return

        # 获取当前项目信息（提前获取用于阶段检查）
        project = db.get_project(project_id)
        if not project:
            logger.warning("auto_complete_skipped project=%s reason=project_not_found", project_id)
            return

        current_stage = getattr(project, "current_stage", "") or ""
        project_mode = getattr(project, "mode", "") or "standard"

        # ========== 阶段保护：收紧到只在执行和评估阶段允许自动结案 ==========
        try:
            current_idx = self.STAGE_ORDER_LIST.index(current_stage)
            # 收紧：只允许从 stage_07_execute (idx=7) 及之后自动结案
            # 因为 stage_06 只是分步计划，代码都还没写，不可能真正完成
            MIN_AUTO_COMPLETE_STAGE_IDX = 7  # stage_07_execute
            if current_idx < MIN_AUTO_COMPLETE_STAGE_IDX:
                logger.warning(
                    "auto_complete_blocked_by_strict_stage_gate project=%s current_stage=%s "
                    "min_required=stage_07_execute pattern=%s content_preview=%s",
                    project_id, current_stage, matched_pattern, ai_reply_content[:80],
                )
                return  # 在中期阶段拦截自动结案
        except ValueError:
            pass  # 阶段不在列表中（如轻量模式的 step_1/2/3），放行

        logger.info(
            "auto_complete_detected project=%s pattern=%s",
            project_id, matched_pattern,
        )

        # 确定最终阶段
        if project_mode == "light":
            final_stage = "step_3"
        else:
            final_stage = "stage_08_evaluate"

        # 如果已经在最终阶段，无需更新
        if current_stage == final_stage:
            logger.info(
                "auto_complete_skipped project=%s reason=already_at_final_stage stage=%s",
                project_id, current_stage,
            )
            return

        # 阶段顺序检查 - 放宽限制：允许从分步计划阶段（stage_06）及之后都可以自动结案
        # 因为用户已经明确要求结案/AI 已经确认结案
        standard_stages = [
            "stage_00_bootstrap", "stage_01_brainstorm", "stage_02_brief",
            "stage_03_constraints", "stage_04_track", "stage_05_design",
            "stage_06_step_plan", "stage_07_execute", "stage_08_evaluate",
        ]
        light_stages = ["step_1", "step_2", "step_3"]

        stages_order = light_stages if project_mode == "light" else standard_stages

        try:
            current_idx = stages_order.index(current_stage)
            final_idx = stages_order.index(final_stage)
            # 放宽限制：允许从后 50% 的阶段开始自动结案
            # 标准模式：从 stage_05_design (idx=5) 开始允许
            # 轻量模式：从 step_2 开始允许
            min_allowed_idx = final_idx // 2
            if current_idx < min_allowed_idx:
                logger.info(
                    "auto_complete_skipped project=%s current_stage=%s mode=%s "
                    "current_idx=%d min_allowed_idx=%d reason=too_early_to_complete",
                    project_id, current_stage, project_mode, current_idx, min_allowed_idx,
                )
                return
        except ValueError:
            # 当前阶段不在预期顺序中，允许更新（可能是旧数据或自定义阶段）
            logger.info(
                "auto_complete_allow project=%s current_stage=%s reason=stage_not_in_order",
                project_id, current_stage,
            )

        # 执行状态更新
        try:
            db.update_project(project_id, {"current_stage": final_stage})
            # 同时更新 skill_state 中的阶段信息
            skill_state = db.get_skill_state(project_id)
            if skill_state:
                db.update_skill_state(project_id, {
                    "current_stage": final_stage,
                })

            logger.info(
                "auto_completed_project project=%s stage=%s->%s mode=%s trigger=ai_completion_intent",
                project_id, current_stage, final_stage, project_mode,
            )
        except Exception as exc:
            logger.exception(
                "auto_complete_failed project=%s error=%s",
                project_id, exc,
            )

    async def _generate_fallback(
        self,
        owner_id: str,
        req: AgentChatRequest,
        tool_traces: List[AgentToolTrace],
    ) -> tuple[str, str]:
        if tool_traces:
            snippets = "；".join([f"{item.tool_name}: {item.summary}" for item in tool_traces])
            return f"AI 模型暂时不可用，但我已通过内置技能完成分析：{snippets}\n\n你可以稍后重试。", settings.ZEROCLAW_LOCAL_SAFE_MODEL
        return f"已收到你的问题：「{req.message}」\n\n当前 AI 模型服务繁忙，请稍后重试。", settings.ZEROCLAW_LOCAL_SAFE_MODEL

    def build_stream_tokens(self, content: str) -> List[str]:
        if not content:
            return []
        chunk_size = 20
        return [content[i : i + chunk_size] for i in range(0, len(content), chunk_size)]

    @staticmethod
    def _get_stage_display_name(stage_id: str) -> str:
        mapping = {
            "stage_00_bootstrap": "初始化",
            "stage_01_brainstorm": "脑爆选题",
            "stage_02_brief": "开题立项",
            "stage_03_constraints": "范围裁剪",
            "stage_04_track": "轨道选择",
            "stage_05_design": "设计蓝图",
            "stage_06_step_plan": "分步计划",
            "stage_07_execute": "编码实现",
            "stage_08_evaluate": "验收展示",
        }
        return mapping.get(stage_id, stage_id)

    @staticmethod
    def deduplicate_repeated_text(text: str) -> str:
        """
        去除重复的文字（如"好好想法想法"→"好想法"）
        
        使用正则检测连续重复的词/字并合并为单个
        """
        if not text or len(text) < 4:
            return text
        
        import re
        
        for _ in range(3):
            # 模式1：连续重复的单字（如"好好好"→"好"）
            text = re.sub(r'([\u4e00-\u9fff])\1{1,3}', r'\1', text)

            # 模式2：连续重复的短词/短句（如"想法想法"→"想法"）
            text = re.sub(r'([\u4e00-\u9fff]{2,12})\1{1,2}', r'\1', text)

            # 模式3：连续重复的英文单词（如"AppApp"→"App"）
            text = re.sub(r'([A-Za-z]{2,})\1{1,2}', r'\1', text)

            # 模式4：标点符号后紧跟重复内容（如"，，"→"，"）
            text = re.sub(r'([，。！？、；：,.!?])\1+', r'\1', text)

            # 模式5：空格后重复（如"  "→" "）
            text = re.sub(r' {2,}', ' ', text)

            # 模式6：特殊符号重复（如"****"→"*"，"----"→"-"）
            text = re.sub(r'([*~\-#`]+)\1{1,}', r'\1', text)

        lines = text.splitlines()
        compact_lines: list[str] = []
        for line in lines:
            if compact_lines and compact_lines[-1] == line and line.strip():
                continue
            compact_lines.append(line)

        return '\n'.join(compact_lines).strip()

    @staticmethod
    def strip_question_xml(text: str) -> tuple[str, bool]:
        """
        剥离 question XML 块，返回 (干净文本, 是否包含question)
        
        XML 标签是内部协议格式，不应显示给用户
        """
        if not text:
            return text, False
        
        import re
        
        has_question = _contains_question_block(text)
        
        # 移除 <question>...</question> 整块（包括嵌套的子标签）
        cleaned = re.sub(
            r'<question[^>]*>.*?</question>',
            '',
            text,
            flags=re.DOTALL | re.IGNORECASE
        )
        
        # 移除裸露的 <option>...</option> 标签（AI 有时不用 question 包裹）
        cleaned = re.sub(
            r'<option\s+id=["\'][^"\']*["\'][^>]*>.*?</option>',
            '',
            cleaned,
            flags=re.DOTALL | re.IGNORECASE
        )
        
        # 清理可能残留的多余空行
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        
        return cleaned.strip(), has_question

    def _generate_fallback_question(self, req: AgentChatRequest, content: str, tool_traces: List[Any]) -> dict | None:
        """
        仅为明确业务场景生成专用 fallback question。

        普通对话禁止猜测式地生成“继续 / 详细说说 / 换个方向”这类通用按钮，
        否则会与 AI 正文脱节，造成按钮看起来像硬编码。
        """
        if self._is_achievement_scene(req):
            return {
                "id": f"q-achievement-fallback-{int(utc_now().timestamp())}",
                "title": "成果档案卡还缺一点信息，你想先补哪一项？",
                "options": [
                    {"id": "opt_one_liner", "label": "一句话介绍", "description": "补一句最精炼的成果总结", "recommended": True},
                    {"id": "opt_problem", "label": "解决了什么问题", "description": "补核心问题和挑战"},
                    {"id": "opt_method", "label": "用了什么方法", "description": "补实现方法、流程或技术"},
                    {"id": "opt_reflection", "label": "我的反思", "description": "补收获、反思和下次改进"},
                    {"id": "opt_other", "label": "其他", "description": "我想自己补充说明"},
                ],
                "multiple": False,
                "allow_custom": True,
            }
        trimmed_content = content.strip()
        if (
            re.search(r"(最后一个问题|最后一题)[:：]?\s*$", trimmed_content)
            or (
                re.search(r"(最后一个问题|最后一题)", content)
                and re.search(r"(初步项目想法|初步想法|项目想法|你的起点)", content)
            )
            or re.search(r"(你(?:已经|现在)?有初步(?:项目)?想法了吗|有没有初步(?:项目)?想法|有具体想法了吗)", content)
        ):
            return {
                "id": f"q-bootstrap-idea-fallback-{int(utc_now().timestamp())}",
                "title": "你有初步想法了吗？",
                "options": [
                    {
                        "id": "brainstorm",
                        "label": "完全没想法，需要脑爆",
                        "description": "从零开始，一起探索可做的项目方向",
                    },
                    {
                        "id": "direction",
                        "label": "有个大概方向",
                        "description": "我知道想做什么类型，但还需要一起收敛",
                    },
                    {
                        "id": "idea",
                        "label": "已经有具体想法",
                        "description": "直接基于我的想法进入立项和方案设计",
                        "recommended": True,
                    },
                ],
                "multiple": False,
                "allow_custom": True,
                "stage": "stage_00_bootstrap",
                "step": 3,
                "total_steps": 3,
                "is_stage_final": True,
            }
        if req.project_id and re.search(r"(补齐|补全|补上|缺失文档|推进到验收|stage_08_evaluate|这样可以吗|是否现在)", content):
            return {
                "id": f"q-complete-missing-{int(utc_now().timestamp())}",
                "title": "要现在补齐缺失文档并推进到验收吗？",
                "options": [
                    {
                        "id": "opt_complete_now",
                        "label": "现在补",
                        "description": "按当前已有内容补齐缺失阶段文档，并按门禁推进到验收",
                        "recommended": True,
                    },
                    {
                        "id": "opt_not_now",
                        "label": "暂不补",
                        "description": "先停在当前阶段，继续手动补充项目信息",
                    },
                ],
                "multiple": False,
                "allow_custom": True,
            }
        if re.search(r"((怎么才算|如何定义).*项目做好|什么是.*成功标准)\?$", content.strip()):
            return {
                "id": f"q-brief-success-criteria-{int(utc_now().timestamp())}",
                "title": "怎么才算这个项目做好了？",
                "options": [
                    {
                        "id": "core_playable",
                        "label": "能完整玩一局",
                        "description": "能输入数字、判断高低、猜中后结束",
                        "recommended": True,
                    },
                    {
                        "id": "restartable",
                        "label": "可以重新开始",
                        "description": "猜中或放弃后能开启新一局",
                    },
                    {
                        "id": "clear_feedback",
                        "label": "提示清楚",
                        "description": "每次猜测都有明确的高了、低了或猜中了反馈",
                    },
                ],
                "multiple": True,
                "allow_custom": True,
                "stage": "stage_02_brief",
            }
        return None

    def _generate_skill_template_question(self, skill_def: Any, req: AgentChatRequest) -> dict | None:
        """
        当 LLM 只输出自然语言问题、却没有产出结构化 question 时，
        从 stem-pbl-guide 的标准模板中补发当前缺失的资料采集题。

        覆盖范围：不再只处理 stage_00/stage_01，而是覆盖所有有 question 模板的阶段。
        优先级：stage_00/01 用已确认信息匹配 → 其他阶段用当前阶段定义中的第一个 question 模板。
        """
        resolved_skill_id = (
            getattr(skill_def, "skill_id", None)
            or getattr(getattr(skill_def, "manifest", None), "skill_id", "")
        )
        if not skill_def or resolved_skill_id != "stem-pbl-guide":
            return None

        current_stage = self._get_current_stage(req)
        stages_dict = getattr(skill_def, "stages", {}) or {}

        # === stage_00 / stage_01：用已确认信息做智能匹配（原有逻辑） ===
        if current_stage in {"stage_00_bootstrap", "stage_01_brainstorm", None}:
            bootstrap_stage = stages_dict.get("stage_00_bootstrap")
            if not bootstrap_stage or not getattr(bootstrap_stage, "content", "").strip():
                # 尝试从 stage_01 取模板
                bootstrap_stage = stages_dict.get("stage_01_brainstorm")
            if not bootstrap_stage or not getattr(bootstrap_stage, "content", "").strip():
                return None

            template_blocks = re.findall(
                r"<question\b[^>]*>[\s\S]*?</question>",
                bootstrap_stage.content,
                flags=re.IGNORECASE,
            )
            if not template_blocks:
                return None

            parsed_templates: list[dict[str, Any]] = []
            for block in template_blocks:
                parsed = _parse_question_block(block)
                if parsed:
                    parsed["stage"] = current_stage or "stage_00_bootstrap"
                    parsed["is_stage_final"] = _is_stage_final_question(parsed)
                    parsed_templates.append(parsed)

            if not parsed_templates:
                return None

            confirmed_profile = self._collect_confirmed_profile(req)
            desired_keywords: list[str] | None = None
            if "grade" not in confirmed_profile:
                desired_keywords = ["年级"]
            elif "timeBudget" not in confirmed_profile:
                desired_keywords = ["多长时间", "完成"]
            elif "idea" not in confirmed_profile:
                desired_keywords = ["初步想法", "想法"]
            else:
                return None

            for question in parsed_templates:
                title = str(question.get("title") or "")
                if any(keyword in title for keyword in desired_keywords):
                    return question
            return None

        # === 其他阶段（stage_02 ~ stage_08）：从当前阶段定义中提取 question 模板 ===
        if not current_stage or current_stage not in stages_dict:
            return None

        stage_def = stages_dict.get(current_stage)
        if not stage_def or not getattr(stage_def, "content", "").strip():
            return None

        # 从阶段内容中提取所有 <question> 模板
        template_blocks = re.findall(
            r"<question\b[^>]*>[\s\S]*?</question>",
            stage_def.content,
            flags=re.IGNORECASE,
        )
        if not template_blocks:
            return None

        # 解析第一个有效的 question 模板作为 fallback
        for block in template_blocks:
            parsed = _parse_question_block(block)
            if parsed:
                parsed["stage"] = current_stage
                parsed["is_stage_final"] = _is_stage_final_question(parsed)
                parsed["_source"] = "stage_template_fallback"
                logger.info(
                    "stage_template_fallback_question stage=%s title=%s",
                    current_stage,
                    parsed.get("title", ""),
                )
                return parsed

        return None

    # ========== 阶段越权检测与纠正方法 ==========

    STAGE_ORDER_LIST = [
        "stage_00_bootstrap", "stage_01_brainstorm", "stage_02_brief",
        "stage_03_constraints", "stage_04_track", "stage_05_design",
        "stage_06_step_plan", "stage_07_execute", "stage_08_evaluate",
    ]

    # 每个阶段允许讨论/生成的最大阶段索引（含）
    STAGE_MAX_ALLOWED_MAP = {
        "stage_00_bootstrap": 0,  # 只能讨论 stage_00
        "stage_01_brainstorm": 1,   # 只能讨论 stage_01
        "stage_02_brief": 2,        # 只能讨论 stage_02
        "stage_03_constraints": 3,  # 只能讨论 stage_03
        "stage_04_track": 4,        # 只能讨论 stage_04
        "stage_05_design": 6,       # 可以讨论到 step_plan
        "stage_06_step_plan": 6,    # 可以讨论到 step_plan
        "stage_07_execute": 8,      # 可以讨论全部
        "stage_08_evaluate": 8,     # 可以讨论全部
    }

    # 后续阶段的关键词（用于检测跳跃）
    FUTURE_STAGE_KEYWORDS = {
        # (关键词, 目标阶段)
        "step_plan": 6,
        "分步计划": 6,
        "分步执行计划": 6,
        "步骤6": 6,
        "步骤 6": 6,
        "execute": 7,
        "编码实现": 7,
        "执行开发": 7,
        "evaluate": 8,
        "验收": 8,
        "验收选项卡": 8,
        "功能完整.*可以运行": 8,
        "基本可用": 8,
        "还需要继续开发": 8,
    }

    def _detect_stage_violation(
        self,
        current_stage: str,
        ai_content: str,
        tool_traces: List[Any],
        force_code_generation: bool = False,
    ) -> dict | None:
        """
        检测 AI 回复是否存在阶段越权行为。

        Args:
            force_code_generation: 是否为强制代码生成模式（stage_07_execute 时允许代码）

        Returns:
            违规信息字典，或 None（无违规）
            {
                "type": "code_generation" | "stage_jump" | "artifact_ahead" | "evaluate_preemptive",
                "evidence": "检测到的具体违规内容",
                "severity": "high" | "medium",
            }
        """
        if not current_stage or not ai_content:
            return None

        current_idx = self.STAGE_ORDER_LIST.index(current_stage) if current_stage in self.STAGE_ORDER_LIST else -1
        if current_idx < 0:
            return None

        max_allowed_idx = self.STAGE_MAX_ALLOWED_MAP.get(current_stage, current_idx)
        violation = None

        # 检测 1：非代码阶段输出了代码块
        # 关键修复：即使在 force_code_generation 模式，也要检测代码生成
        # 但 stage_05_design / stage_07_execute / stage_08_evaluate 是允许的
        CODE_ALLOWED_STAGES = {"stage_05_design", "stage_07_execute", "stage_08_evaluate"}
        if current_stage not in CODE_ALLOWED_STAGES:
            import re as _re
            code_block_pattern = _re.compile(r'```(?:python|javascript|js|typescript|ts|html|css|java|cpp|c)\b', _re.IGNORECASE)
            if code_block_pattern.search(ai_content):
                # 排除误报：如果只是提到代码但不是真正输出代码块
                if not _re.search(r'```text|```markdown|``\s*$', ai_content[:200]):
                    match = code_block_pattern.search(ai_content)
                    violation = {
                        "type": "code_generation",
                        "evidence": f"在 {current_stage} 阶段检测到代码块: {ai_content[match.start():match.start()+50]}...",
                        "severity": "high",
                    }
                    return violation

        # 检测 2：讨论了后续阶段的内容（如 step_plan、execute、evaluate）
        for keyword, target_idx in self.FUTURE_STAGE_KEYWORDS.items():
            if target_idx > max_allowed_idx:
                import re as _re
                try:
                    pattern = _re.compile(keyword, _re.IGNORECASE)
                    match = pattern.search(ai_content)
                    if match:
                        # 获取匹配位置的上下文（前后各 50 字符）
                        start = max(0, match.start() - 50)
                        end = min(len(ai_content), match.end() + 50)
                        context_around = ai_content[start:end]
                        
                        # 强跳跃指标：明确在生成/创建后续阶段的工件或内容
                        strong_jump_indicators = [
                            r'生成.*' + keyword.replace('\\', ''),
                            r'创建.*' + keyword.replace('\\', ''),
                            r'准备.*' + keyword.replace('\\', ''),
                            r'现在.*' + keyword.replace('\\', ''),
                            r'开始.*' + keyword.replace('\\', ''),
                            r'步骤[6-9]',  # 步骤6-9 明确属于后期阶段
                            r'step[_ ]?6',  # step 6
                            r'05_step_plan',  # 直接提到文件名
                            r'M\d+\s+\d+\.\d+',  # M1 1.1 这样的任务编号格式
                        ]
                        
                        is_strong_jump = False
                        for indicator in strong_jump_indicators:
                            try:
                                if _re.search(indicator, ai_content, _re.IGNORECASE):
                                    is_strong_jump = True
                                    break
                            except _re.error:
                                pass
                        
                        if is_strong_jump:
                            violation = {
                                "type": "stage_jump",
                                "evidence": f"在 {current_stage} 阶段检测到后续阶段内容({keyword}): {context_around[:80]}",
                                "severity": "high",
                            }
                            return violation
                except _re.error:
                    pass  # 无效正则，跳过

        # 检测 3：尝试写入后续阶段的工件
        artifact_stage_map = {
            "05_step_plan.json": 6,
            "04_design.json": 5,
            "06_code": 7,
        }
        for trace in tool_traces:
            if trace.tool_name == "artifact_writer":
                for artifact_name, required_stage_idx in artifact_stage_map.items():
                    if artifact_name in trace.summary and required_stage_idx > max_allowed_idx:
                        violation = {
                            "type": "artifact_ahead",
                            "evidence": f"在 {current_stage} 尝试写入 {artifact_name}（需要 stage_{required_stage_idx}）",
                            "severity": "high",
                        }
                        return violation

        # 检测 4：在早期阶段显示验收/评估内容
        if current_idx < 7:  # stage_07 之前
            evaluate_patterns = [r'验收', r'功能完整.*可以运行', r'基本可用.*bug', r'还需要继续开发']
            import re as _re
            for pattern in evaluate_patterns:
                if _re.search(pattern, ai_content):
                    # 确认是作为 question 选项出现（像截图中的场景）
                    if 'option' in ai_content.lower() or '选项' in ai_content or '功能完整' in ai_content:
                        violation = {
                            "type": "evaluate_preemptive",
                            "evidence": f"在 {current_stage} 阶段显示验收评估内容",
                            "severity": "medium",
                        }
                        return violation

        return violation

    def _generate_stage_violation_correction(
        self,
        current_stage: str,
        violation: dict,
        skill_def: Any,
        req: AgentChatRequest,
    ) -> str | None:
        """
        当检测到阶段越权时，生成纠正内容替换 AI 的违规输出。
        """
        violation_type = violation.get("type", "unknown")
        evidence = violation.get("evidence", "")

        STAGE_NAME_MAP = {
            "stage_00_bootstrap": "项目初始化",
            "stage_01_brainstorm": "脑爆选题",
            "stage_02_brief": "开题立项",
            "stage_03_constraints": "范围裁剪",
            "stage_04_track": "轨道选择",
            "stage_05_design": "设计蓝图",
            "stage_06_step_plan": "分步计划",
            "stage_07_execute": "编码实现",
            "stage_08_evaluate": "验收展示",
        }
        stage_name = STAGE_NAME_MAP.get(current_stage, current_stage)

        # 根据违规类型生成不同的纠正消息
        if violation_type == "code_generation":
            correction = f"🔒 **阶段提醒**\n\n我注意到刚才的回复包含了代码内容。不过我们当前还在【{stage_name}】阶段（{current_stage}），这个阶段不产出代码哦。\n\n按照 PBL 流程，我们需要先完成当前阶段的任务。让我们回到正轨吧！"
        elif violation_type == "stage_jump":
            correction = f"🔒 **阶段提醒**\n\n我注意到刚才的回复跳到了后面的阶段。我们当前应该在【{stage_name}】阶段（{current_stage}），需要先完成这里的任务才能继续推进。\n\n让我们聚焦当前阶段的工作吧！"
        elif violation_type == "artifact_ahead":
            correction = f"🔒 **阶段提醒**\n\n我注意到刚才尝试生成了后续阶段的工件。我们需要按顺序来，先完成当前的【{stage_name}】阶段。\n\n让我们先做好当前阶段该做的事！"
        elif violation_type == "evaluate_preemptive":
            correction = f"🔒 **阶段提醒**\n\n我们当前还在【{stage_name}】阶段（{current_stage}），还没到验收环节呢。让我们先把当前阶段的工作完成！"
        else:
            correction = f"🔒 **阶段提醒**\n\n让我们回到当前阶段【{stage_name}】的任务上来。"

        logger.info(
            "stage_violation_correction_generated stage=%s type=%s correction_len=%d",
            current_stage, violation_type, len(correction),
        )
        return correction

    @staticmethod
    def _is_output_truncated(content: str) -> bool:
        """
        检测 AI 输出是否被截断。

        截断特征：
        1. 未闭合的代码块（有 ``` 开头但没有结尾）
        2. 未闭合的 XML/HTML 标签（如 <question> 没有 </question>）
        3. 不完整的语句（以不完整的单词或符号结尾）
        4. 输出在句子中间被切断（最后一个字符不是句号、问号、感叹号、闭合括号等）
        """
        if not content or not content.strip():
            return False

        content = content.strip()

        # 检查未闭合的代码块
        code_block_count = content.count('```')
        if code_block_count % 2 != 0:
            return True

        # 检查未闭合的常见标签
        unclosed_tags = ['<question>', '<option>', '<div>', '<p>', '<span>', '<table>']
        for tag in unclosed_tags:
            open_count = content.count(tag)
            close_tag = tag.replace('<', '</') if not tag.startswith('</') else tag.replace('</', '</')
            close_count = content.count(close_tag)
            if open_count > close_count:
                return True

        # 检查是否以不完整的语句结尾
        # 正常结束的字符：句号、问号、感叹号、闭合括号、引号、代码块结束符等
        normal_endings = ('.', '!', '?', '》', '」', '』', ')', ']', '}', '"', "'", '`',
                          '\n```', '\n```\n', '...', '。', '！', '？')

        # 获取最后 100 个字符来检查
        last_part = content[-100:] if len(content) > 100 else content

        # 如果内容以换行和正常结尾字符结束，可能没有截断
        stripped = last_part.rstrip()
        if not stripped:
            return False

        # 检查最后非空行是否以正常字符结束
        lines = [l for l in stripped.split('\n') if l.strip()]
        if not lines:
            return False

        last_line = lines[-1].strip()
        if not last_line:
            return False

        # 如果最后一行是代码且以分号、大括号、小括号等结束，可能是正常的
        code_endings = (';', '{', '}', '()', '[]', "''", '""', ':')
        if any(last_line.endswith(ending) for ending in code_endings):
            # 但如果是在函数定义中间，可能还是截断的
            if '(' in last_line and ')' not in last_line:
                return True
            return False

        # 检查是否有明显的截断特征
        truncated_patterns = [
            r'[,;:]\s*$',  # 以逗号、分号、冒号结尾（可能有后续内容）
            r'\+\s*$',  # 以加号结尾（字符串拼接未完成）
            r'=\s*$',  # 以等号结尾（赋值未完成）
            r'\.\s*$',  # 以点结尾（属性访问未完成）
        ]

        import re as _re
        for pattern in truncated_patterns:
            if _re.search(pattern, last_line):
                return True

        # 特殊检查：如果最后一行只是一个单独的编程语言名称（如 python, javascript, html 等）
        # 且前面有代码块内容，这很可能是代码块被截断了
        language_names = ['python', 'javascript', 'typescript', 'html', 'css', 'java',
                         'c', 'cpp', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin']
        if last_line.lower() in language_names:
            # 检查前面是否有代码块标记
            if '```' in content:
                return True

        # 检查是否以单独的英文字母/数字结尾（没有标点符号）
        # 这种情况在中文上下文中通常是截断的
        if _re.match(r'^[a-zA-Z0-9_]+$', last_line) and _re.search(r'[\u4e00-\u9fff]', content):
            # 如果这个单词很短且是常见的语言/技术名称，很可能是截断
            if len(last_line) <= 10:
                return True

        return False

    def _detect_incomplete_stage_and_recover(
        self,
        skill_def: Any,
        req: AgentChatRequest,
        ai_content: str,
        tool_traces: List[Any],
        current_stage: str | None,
    ) -> dict | None:
        """
        阶段任务完整性检测器（核心修复：解决 AI 说一半就停的问题）

        问题场景：
        - stage_03_constraints：AI 只收集了 must_have 就停了，没收集 nice_to_have / wont_do
        - stage_02_brief：AI 只问了项目名称就停了，没问成功标准/风险
        - 任何阶段：AI 输出了一段文字但没有输出 <question> 也没有调用工具写工件

        检测逻辑：
        1. 确认当前阶段在 SKILL.md 中有 question 模板定义
        2. 确认 AI 回复中没有 <question> 块
        3. 确认没有调用 artifact_writer / stage_advancer 等关键工具
        4. 从阶段定义中提取"应该问但没问"的 question 模板，自动补发

        Returns:
            补发的 question dict，或 None（不需要补发）
        """
        resolved_skill_id = (
            getattr(skill_def, "skill_id", None)
            or getattr(getattr(skill_def, "manifest", None), "skill_id", "")
        )
        if not skill_def or resolved_skill_id != "stem-pbl-guide":
            return None

        stage_id = current_stage or self._get_current_stage(req)
        if not stage_id:
            return None

        stages_dict = getattr(skill_def, "stages", {}) or {}
        stage_def = stages_dict.get(stage_id)
        if not stage_def or not getattr(stage_def, "content", "").strip():
            return None

        # 检查 AI 是否已经调用了关键工具（artifact_writer / stage_advancer / project_code_writer）
        tool_names_called = {t.tool_name for t in tool_traces}
        critical_tools = {"artifact_writer", "stage_advancer", "project_code_writer"}
        has_critical_tool_call = bool(tool_names_called & critical_tools)

        # 如果已经调了关键工具写工件，说明任务可能已完成，不补发
        if has_critical_tool_call:
            return None

        # 从阶段内容中提取所有 AskUserQuestion JSON 模板（不只是 XML question）
        # SKILL.md 阶段定义中的 ```json {...questions...} ``` 块
        ask_user_json_blocks = re.findall(
            r'```json\s*(\{[^`]*?"questions"[^`]*?\})\s*```',
            stage_def.content,
            re.DOTALL,
        )

        # 同时提取 XML question 块
        xml_question_blocks = re.findall(
            r"<question\b[^>]*>[\s\S]*?</question>",
            stage_def.content,
            flags=re.IGNORECASE,
        )

        # 如果阶段定义中没有任何 question 模板，无法补发
        if not ask_user_json_blocks and not xml_question_blocks:
            return None

        # === 核心启发式：判断 AI 是否"说一半就停" ===
        # 特征：
        # 1. AI 内容较短（< 300 字）→ 可能只是开场白
        # 2. AI 内容包含"接下来"、"然后"、"另外"、"还有"等承接词 → 表示还有后续
        # 3. AI 内容提到应该收集的信息但没收集完 → 如只提到 must_have 但没提到 wont_do
        content_trimmed = ai_content.strip()
        is_short_response = len(content_trimmed) < 400
        has_continuation_marker = bool(re.search(
            r"(接下来|然后|另外|还有|下面|再|此外|同时|以及|接着|之后|下一步)",
            content_trimmed,
        ))
        has_incomplete_marker = bool(re.search(
            r"(帮你整理|我来整理|让我|我帮你|范围文档|约束文档|立项书|下面.*question|接下来.*选择)",
            content_trimmed,
            re.IGNORECASE,
        ))

        should_recover = is_short_response or has_continuation_marker or has_incomplete_marker

        if not should_recover:
            return None

        # === 优先从 JSON AskUserQuestion 模板补发（更结构化） ===
        
        # 先收集所有可用的 question 模板，做语义匹配
        all_candidates: list[dict[str, Any]] = []
        for json_block in ask_user_json_blocks:
            try:
                q_data = json.loads(json_block)
                questions_list = q_data.get("questions", [])
                for q in questions_list:
                    header = str(q.get("header", "") or q.get("question", "") or "")
                    options = q.get("options", [])
                    multi = q.get("multiSelect", False)
                    if header and options:
                        all_candidates.append({
                            "header": header,
                            "question_text": str(q.get("question", "")),
                            "options": options,
                            "multiSelect": multi,
                            "_raw": q,
                        })
            except (json.JSONDecodeError, KeyError):
                continue

        # === 语义匹配：根据 AI 回复内容选择最相关的模板 ===
        if all_candidates:
            best_match = self._select_best_question_match(ai_content, all_candidates, stage_id)
            if best_match:
                recovery = {
                    "id": f"q-stage-recover-{stage_id}-{int(utc_now().timestamp())}",
                    "title": best_match["header"],
                    "options": [],
                    "multiple": best_match["multiSelect"],
                    "allow_custom": True,
                    "stage": stage_id,
                    "_source": "semantic_match_recovery",
                }
                for opt in best_match["options"]:
                    recovery["options"].append({
                        "id": opt.get("id", f"opt_{len(recovery['options'])}"),
                        "label": opt.get("label", ""),
                        "description": opt.get("description", ""),
                    })

                if recovery["options"]:
                    logger.info(
                        "semantic_match_recovery stage=%s title=%s multi=%s candidates=%d",
                        stage_id,
                        best_match["header"],
                        best_match["multiSelect"],
                        len(all_candidates),
                    )
                    return recovery

        # === 特殊情况：AI 问的是"确认/调整"类问题，但模板都不匹配 → 生成通用确认选项 ===
        if re.search(r"(可以吗|觉得.*怎么样|想调整|满意吗|确认.*吗|需要改|要修改|OK\?|好吗)", ai_content, re.IGNORECASE):
            confirm_q = self._build_confirmation_question(stage_id, ai_content)
            if confirm_q:
                logger.info(
                    "confirmation_fallback stage=%s title=%s",
                    stage_id,
                    confirm_q.get("title", ""),
                )
                return confirm_q

        # === 回退：从 XML question 模板补发 ===
        for xml_block in xml_question_blocks:
            parsed = _parse_question_block(xml_block)
            if parsed and parsed.get("options"):
                parsed["id"] = f"q-stage-recover-{stage_id}-{int(utc_now().timestamp())}"
                parsed["stage"] = stage_id
                parsed["_source"] = "incomplete_stage_recovery_xml"
                logger.info(
                    "incomplete_stage_recovery stage=%s title=%s source=xml_template",
                    stage_id,
                    parsed.get("title", ""),
                )
                return parsed

        return None

    def _select_best_question_match(
        self,
        ai_content: str,
        candidates: list[dict[str, Any]],
        stage_id: str,
    ) -> dict[str, Any] | None:
        """
        从候选 question 模板中，选择与 AI 回复内容最语义匹配的一个。

        匹配策略：
        1. 关键词匹配：AI 内容中的关键词与模板 header/question_text 的重叠度
        2. 上下文连贯：AI 最后讨论的主题与模板主题的一致性
        3. 兜底：返回第一个候选（至少不会比之前差）
        """
        content_lower = ai_content.lower().strip()

        # 关键词 → 模板类别的映射
        topic_keywords = {
            "风格": ["风格", "样式", "外观", "科技感", "古风", "活泼", "简约", "颜色", "色彩", "配色"],
            "元素": ["功能", "元素", "组件", "模块", "上传", "展示", "输入", "图表", "按钮"],
            "布局": ["布局", "结构", "分栏", "分区", "全屏", "沉浸", "卡片", "左右", "上下", "顶部", "底部", "中间"],
            "里程碑": ["里程碑", "计划", "步骤", "执行", "开发"],
            "验收": ["验收", "完成度", "评估", "反思", "收获", "下一步"],
            "成功标准": ["成功", "标准", "目标", "验收"],
            "风险": ["风险", "问题", "难点", "fallback", "应对"],
            "目标用户": ["用户", "谁会", "使用", "面向"],
            "must": ["必须", "必须有", "must", "核心"],
            "nice": ["锦上添花", "有时间", "nice", "额外", "还可以"],
            "wont": ["不做", "这次不做", "wont", "放弃", "排除"],
            "技术栈": ["技术栈", "技术", "框架", "语言", "python", "streamlit", "flask", "pygame"],
            "轨道": ["轨道", "方向", "类型", "web", "kaggle", "硬件"],
        }

        # 计算每个候选的匹配分数
        scored_candidates: list[tuple[dict[str, Any], int]] = []
        for cand in candidates:
            header_lower = cand["header"].lower()
            qtext_lower = cand["question_text"].lower()
            combined = f"{header_lower} {qtext_lower}"

            score = 0
            for topic, keywords in topic_keywords.items():
                if any(kw in content_lower for kw in keywords):
                    if any(kw in combined for kw in keywords):
                        score += 10  # 强匹配：AI 提到该话题且模板也是该话题
                    else:
                        score += 1   # 弱匹配：AI 提到该话题但模板不相关

            # 额外加分：AI 内容直接提到 header 文本
            if header_lower and header_lower in content_lower:
                score += 5

            scored_candidates.append((cand, score))

        # 按分数排序，取最高分
        scored_candidates.sort(key=lambda x: x[1], reverse=True)

        best, best_score = scored_candidates[0]
        if best_score > 0:
            return best

        # 所有分数都为 0（无匹配）→ 返回第一个候选（兜底）
        return scored_candidates[0][0] if scored_candidates else None

    def _build_confirmation_question(self, stage_id: str, ai_content: str) -> dict | None:
        """
        当 AI 问的是确认/调整类问题时，生成通用的确认选项。

        这解决了以下场景：
        - AI 总结了设计方案后问"你觉得这个结构可以吗？"
        - AI 列出选项后问"想调整什么？"
        - 但 AI 没有输出 <question> XML

        生成的选项是通用的"确认/调整/重做"，不依赖具体阶段模板。
        """
        content_lower = ai_content.lower()

        # 根据阶段和内容动态调整选项
        options = []

        # 检测是否涉及布局/结构调整
        is_layout_related = bool(re.search(
            r"(布局|结构|分区|分栏|全屏|顶部|中间|底部|位置|排列)",
            ai_content,
        ))

        # 检测是否涉及颜色/风格调整
        is_style_related = bool(re.search(
            r"(风格|颜色|色彩|样式|外观|科技|活泼|简约|古风)",
            ai_content,
        ))

        # 基础确认选项（总是出现）
        options.append({
            "id": "opt_confirm",
            "label": "没问题，继续下一步",
            "description": "当前方案OK，推进到下一阶段",
            "recommended": True,
        })

        # 根据内容添加调整选项
        if is_layout_related:
            options.append({
                "id": "opt_adjust_layout",
                "label": "想调整布局结构",
                "description": "修改区域划分或排列方式",
            })
        elif is_style_related:
            options.append({
                "id": "opt_adjust_style",
                "label": "想调整视觉风格",
                "description": "修改颜色、字体或整体感觉",
            })
        else:
            options.append({
                "id": "opt_adjust",
                "label": "想做一些调整",
                "description": "对当前方案有修改意见",
            })

        options.append({
            "id": "opt_redo",
            "label": "重新设计",
            "description": "换一个完全不同的方案",
        })

        return {
            "id": f"q-confirm-{stage_id}-{int(utc_now().timestamp())}",
            "title": "你觉得这个方案可以吗？或者想调整什么？",
            "options": options,
            "multiple": False,
            "allow_custom": True,
            "stage": stage_id,
            "_source": "confirmation_fallback",
        }


def _is_stage_final_question(question_data: dict) -> bool:
    """
    轻量启发式：判断当前 question 是否是该阶段的最后一个问题。
    基于 question_data 中的 step/total_steps 字段。
    这是一个辅助信号而非硬约束——即使误判为 False，LLM 仍可通过 stage_advancer 工具推进。
    """
    step = question_data.get("step")
    total_steps = question_data.get("total_steps") or question_data.get("totalSteps")
    if step is not None and total_steps is not None:
        try:
            return int(step) >= int(total_steps)
        except (ValueError, TypeError):
            pass
    return False


def _extract_plaintext_question_options(text: str) -> tuple[str | None, list[dict[str, Any]]]:
    if not text:
        return None, []

    lines = [line.rstrip() for line in text.splitlines()]
    option_pattern = re.compile(
        r"^\s*(?:"
        r"[-*•]\s+|"
        r"(?:\d{1,2}|[A-Za-z]|[一二三四五六七八九十]+)[\.\)、]\s+|"
        r"(?:[0-9]\ufe0f?\u20e3|🔟|[①②③④⑤⑥⑦⑧⑨⑩])\s*"
        r")(.+?)\s*$"
    )

    def is_status_list_line(line: str) -> bool:
        """判断一行是否属于"状态/结构/说明列表"而非"用户可选择的选项"。"""
        line_lower = line.lower()
        # 原有规则：包含状态图标
        if re.search(r"[✅❌✔✘☑☒⚠❗❓]", line):
            return True
        # 原有规则：文件路径
        if re.search(r"\b(?:docs|src|assets|tests|reports|public|app|pages|components|backend|frontend)/", line):
            return True
        # 原有规则：文件扩展名
        if re.search(r"\.(?:json|md|py|ts|tsx|js|html|css)\b", line):
            return True
        # 原有规则：完成状态标记
        if re.search(r"[（(](?:已补|已生成|缺失|已完成|未完成|待完成)[）)]", line):
            return True
        
        # 新增规则1：文档结构/章节描述关键词
        doc_structure_markers = [
            "文档将包含", "包括以下", "主要包含", "由以下",
            "截图", "描述", "评估", "评价", "建议", "结论",
            "清单", "完成度", "质量", "评审", "分析", "总结",
            r"第[一二三四五六七八九十]章", r"第\d+部分",
            r"步骤\s*\d+", r"阶段\s*\d+",
        ]
        for marker in doc_structure_markers:
            if re.search(marker, line_lower) or re.search(marker, line):
                return True
        
        # 新增规则2：无选择含义的陈述性列表项
        # 如果列表项以动词或名词开头，且没有明显的"可选"暗示
        non_option_patterns = [
            r"^[\d]+[\.\）、]\s*(当前|代码|功能|交互|最终|运行|设计|实现|测试|部署|文档)",
            r"^[\d]+[\.\）、]\s*(第一|第二|第三|第四|第五|第六|第七|第八|第九|第十)",
            r"^[\d]+[\.\）、]\s*(接下来|然后|之后|首先|其次|最后|另外|此外)",
            r"^[\d]+[\.\）、]\s*(请稍等|让我开始|我将|我会|正在|准备)",
            r"^[\d]+[\.\），]\s*(这份|该|此|本)",
        ]
        for pattern in non_option_patterns:
            if re.search(pattern, line):
                return True
        
        # 新增规则3：如果整行是纯名词短语（没有冒号分隔的 label:description 格式）
        # 且上下文看起来像是说明性内容
        if re.match(r"^[\d]+[\.\）、]\s*[^\n:：]{2,40}$", line):
            # 短的纯文本行，可能是说明而非选项
            pass  # 这个规则太激进，暂时不启用
        
        return False

    def is_question_context_before(block_start: int, lines: list[str]) -> bool:
        """检查列表块之前是否有明确的提问语境。"""
        # 检查列表前的几行是否有问号或疑问词
        for i in range(max(0, block_start - 5), block_start):
            line = lines[i].strip()
            if not line:
                continue
            # 有明确的提问词
            question_words = ["你想", "你希望", "你喜欢", "你更想", "请选择", "哪个", "哪种", 
                              "是否", "有没有", "要不要", "可以吗", "愿意", "倾向于"]
            for qw in question_words:
                if qw in line:
                    return True
            # 有问号
            if "?" in line or "？" in line or "吗" in line:
                return True
            break
        return False

    def is_status_list_block(start: int, end: int) -> bool:
        """判断一个列表块是否为"状态/结构说明列表"而非"用户可选择的选项"。"""
        block_lines = [line for line in lines[start:end] if option_pattern.match(line)]
        if not block_lines:
            return False
        
        # 规则1：超过50%的行匹配状态/结构模式
        status_count = sum(1 for line in block_lines if is_status_list_line(line))
        if status_count / len(block_lines) >= 0.5:
            return True
        
        # 规则2（新增）：检查列表前是否有明确的提问语境
        # 如果没有提问语境，且列表项看起来像是陈述性内容，则认为是非选项
        if not is_question_context_before(start, lines):
            # 检查所有行是否都是纯描述性内容（没有冒号分隔的 label:description）
            non_selectable_count = 0
            for line in block_lines:
                match = option_pattern.match(line)
                if match:
                    body = match.group(1).strip()
                    # 如果没有冒号分隔，且内容较短，可能是纯描述
                    if "：" not in body and ":" not in body and len(body) < 30:
                        non_selectable_count += 1
                    elif re.match(r"^(当前|代码|功能|交互|最终|运行|设计|实现|测试|部署|文档|这份|该|此|本)", body):
                        non_selectable_count += 1
            if non_selectable_count == len(block_lines) and len(block_lines) >= 3:
                return True
        
        return False

    # ========== _extract_plaintext_question_options 主逻辑 ==========
    candidate_blocks: list[tuple[int, int]] = []
    block_start = -1
    for index, line in enumerate(lines):
        if option_pattern.match(line):
            if block_start < 0:
                block_start = index
        elif block_start >= 0:
            if index - block_start >= 2:
                candidate_blocks.append((block_start, index))
            block_start = -1
    if block_start >= 0 and len(lines) - block_start >= 2:
        candidate_blocks.append((block_start, len(lines)))

    if not candidate_blocks:
        return None, []

    selectable_blocks = [block for block in candidate_blocks if not is_status_list_block(*block)]
    if not selectable_blocks:
        return None, []

    start, end = selectable_blocks[-1]
    trailing_question = next(
        (
            line.strip()
            for line in lines[end:]
            if line.strip() and re.search(r"[？?]", line.strip()) and len(line.strip()) <= 120
        ),
        None,
    )
    title = trailing_question
    if not title:
        for idx in range(start - 1, -1, -1):
            candidate = lines[idx].strip()
            if not candidate:
                continue
            if any(marker in candidate for marker in ("？", "?", "：", ":")):
                title = candidate.rstrip("：:")
                break
            if len(candidate) <= 80:
                title = candidate
                break

    options: list[dict[str, Any]] = []
    for index, raw_line in enumerate(lines[start:end], 1):
        match = option_pattern.match(raw_line)
        if not match:
            continue
        body = match.group(1).strip()
        if not body:
            continue
        label, separator, description = body.partition("：")
        if not separator:
            label, separator, description = body.partition(":")
        final_label = re.sub(r"^[*_`\s]+|[*_`\s]+$", "", (label or body).strip())[:100]
        final_description = description.strip()[:200] if separator and description.strip() else None
        options.append({
            "id": f"opt-{index}",
            "label": final_label,
            "description": final_description,
            "recommended": index == 1,
        })

    return title, options


def _extract_json_question_payload(text: str) -> dict[str, Any] | None:
    if not text:
        return None

    decoder = json.JSONDecoder()
    candidate_blocks = [block.strip() for block in re.findall(r"```json\s*([\s\S]*?)```", text, re.IGNORECASE) if block.strip()]
    if '"questions"' in text:
        candidate_blocks.append(text.strip())

    for candidate in candidate_blocks:
        if '"questions"' not in candidate:
            continue
        for match in re.finditer(r"\{", candidate):
            try:
                payload, _ = decoder.raw_decode(candidate[match.start():])
            except Exception:
                continue
            if not isinstance(payload, dict):
                continue
            questions = payload.get("questions")
            if not isinstance(questions, list) or not questions:
                continue
            first_question = questions[0]
            if not isinstance(first_question, dict):
                continue
            raw_options = first_question.get("options")
            if not isinstance(raw_options, list) or not raw_options:
                continue

            options: list[dict[str, Any]] = []
            for index, option in enumerate(raw_options, 1):
                if not isinstance(option, dict):
                    continue
                label = str(option.get("label") or "").strip()
                if not label:
                    continue
                description = str(option.get("description") or "").strip() or None
                options.append({
                    "id": f"opt-{index}",
                    "label": label[:100],
                    "description": description[:200] if description else None,
                    "recommended": index == 1,
                })

            if not options:
                continue

            return {
                "title": str(first_question.get("question") or first_question.get("header") or "请选择").strip(),
                "options": options,
                "multiple": bool(first_question.get("multiSelect", False)),
            }
    return None


def _contains_question_block(text: str) -> bool:
    if not text:
        return False
    import re
    # 支持 <question>、<question type="...">、<question\n 等多种格式
    markers = ["<question>", "<question ", "<question\n", "【提问】", "[提问]", "::question::", "{{question}}"]
    if any(m in text.lower() for m in markers):
        return True
    if _extract_json_question_payload(text):
        return True
    # 支持裸露的 <option 标签（AI 有时不用 question 包裹）
    if re.search(r'<option\s+id=["\']', text, re.IGNORECASE):
        return True
    _, options = _extract_plaintext_question_options(text)
    return len(options) >= 2


def _parse_question_block(text: str) -> dict | None:
    import re
    from datetime import datetime

    json_question = _extract_json_question_payload(text)
    if json_question:
        return {
                "id": f"q-{int(utc_now().timestamp())}",
            "title": json_question["title"],
            "options": json_question["options"][:8],
            "multiple": json_question.get("multiple", False),
            "allow_custom": True,
            "step": None,
            "total_steps": None,
        }

    raw = None
    question_block_source = None

    # 首先尝试直接匹配 <question>...</question>
    pattern = r'<question[^>]*>(.*?)</question>'
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    
    if match:
        raw = match.group(1).strip()
        question_block_source = match.group(0)
        q_tag_match = re.search(r'<question[^>]*title=["\']([^"\']*)["\']', text, re.IGNORECASE)
        q_title = q_tag_match.group(1).strip() if q_tag_match else None
    else:
        # 尝试从代码块中提取（AI 有时会把 question 放在 ``` 代码块中）
        code_block_pattern = r'```(?:xml)?\s*\n?(<question[^>]*>.*?</question>)\s*\n?```'
        match = re.search(code_block_pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            raw = match.group(1).strip()
            question_block_source = match.group(1)
            q_tag_match = re.search(r'<question[^>]*title=["\']([^"\']*)["\']', text, re.IGNORECASE)
            q_title = q_tag_match.group(1).strip() if q_tag_match else None
        else:
            q_title = None
    
    # 如果没有 <question> 包裹，尝试直接从文本中提取裸露的 <option> 标签
    if not raw and re.search(r'<option\s+id=["\']', text, re.IGNORECASE):
        raw = text

    title = "请选择"
    options = []

    if raw:
        title_match = re.search(r'<title>(.*?)</title>', raw, re.DOTALL | re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()
        elif q_title:
            title = q_title
        elif '<option' not in raw.split('\n')[0]:
            title = raw.split('\n')[0][:200]

        opt_pattern = r'<option\s+id=["\']([^"\']*)["\'](?:[^>]*?label=["\']([^"\']*)["\'])?[^>]*>(.*?)</option>'
        for om in re.finditer(opt_pattern, raw, re.DOTALL | re.IGNORECASE):
            opt_id = om.group(1).strip()
            attr_label = om.group(2).strip() if om.group(2) else None
            opt_body = om.group(3).strip()

            child_label_match = re.search(r'<label>(.*?)</label>', opt_body, re.DOTALL | re.IGNORECASE)
            desc_match = re.search(r'<desc>(.*?)</desc>', opt_body, re.DOTALL | re.IGNORECASE)

            final_label = attr_label
            if not final_label:
                if child_label_match:
                    final_label = child_label_match.group(1).strip()
                else:
                    clean_body = re.sub(r'</?(?:label|desc)[^>]*>', '', opt_body).strip()
                    final_label = clean_body.split('\n')[0][:100]

            options.append({
                "id": opt_id or f"opt-{len(options)}",
                "label": final_label,
                "description": desc_match.group(1).strip() if desc_match else None,
                "recommended": "推荐" in opt_body or "recommended" in opt_body.lower(),
            })

    if not options:
        plaintext_title, plaintext_options = _extract_plaintext_question_options(text)
        if not plaintext_options:
            return None
        title = plaintext_title or title
        options = plaintext_options

    raw_text = question_block_source or raw or text
    multiple = "multiple" in raw_text.lower() or "多选" in raw_text
    step_m = re.search(r'\bstep\b\s*(?:=|:)\s*["\']?(\d+)', raw_text, re.IGNORECASE)
    total_m = re.search(r'\b(?:total_steps|totalSteps|total)\b\s*(?:=|:)\s*["\']?(\d+)', raw_text, re.IGNORECASE)

    question_data = {
        "id": f"q-{int(utc_now().timestamp())}",
        "title": title,
        "options": options[:8],
        "multiple": multiple,
        "allow_custom": True,
        "step": int(step_m.group(1)) if step_m else None,
        "total_steps": int(total_m.group(1)) if total_m else None,
    }

    normalized_title = str(question_data["title"]).strip()
    normalized_option_labels = {
        str(option.get("label") or "").strip()
        for option in question_data["options"]
        if str(option.get("label") or "").strip()
    }
    generic_titles = {
        "请选择",
        "接下来你想怎么做？",
        "接下来你想怎么做",
        "你想怎么继续？",
        "你想怎么继续",
    }
    generic_option_labels = {
        "继续",
        "详细说说",
        "换个方向",
        "了解更多",
        "其他",
    }
    if normalized_title in generic_titles:
        return None
    if normalized_option_labels and normalized_option_labels.issubset(generic_option_labels):
        return None

    return question_data


agent_orchestrator_service = AgentOrchestratorService()
