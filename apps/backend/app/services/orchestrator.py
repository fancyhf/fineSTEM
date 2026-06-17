"""
Agent 编排服务（v2：Tool Calling + Skill 路由）

用途：协调 LLM Tool Calling 与 Skill 路由，驱动 PBL 研学流程
维护者：AI Agent
links: .trae/documents/产品与规划/fineSTEM_AI对话流设计规格_v1.0.0.md
"""

from datetime import datetime
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
    lines = [l.strip() for l in cleaned.split('\n') if l.strip()]
    return '\n'.join(lines).strip() or content


def _has_direct_code_intent(message: str) -> bool:
    if not message:
        return False
    return bool(re.search(
        r"(直接进入编码|直接推进到编码|进入执行阶段|直接做|立即做|马上做|不要再问|别再问|别问了|直接实现|直接开发|跳过引导|跳过开题|跳过前置|直接给代码|直接输出代码|直接给出完整代码|写到编辑器|写入编辑器)",
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
from app.services.skill_registry import (
    match_skill,
    skill_registry_v2,
    SKILL_REGISTRY,
)
from app.services.tools import get_tool, get_all_tools_definitions, ToolResult

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
- 优先给学生一个最小代码框架、分步填空点或待完成的小目标，而不是一上来倾倒全部细节。
- 回答结构优先使用：先做什么 → 学生自己补哪一块 → 你再给关键提示。
- 如果要给代码，优先给可运行骨架和关键片段，并明确指出“下一步你来补什么”。
""".strip(),
            "demo": """
## 当前教学模式：demo（演示式）
- 先展示完整、最小可运行版本，再解释整体结构与模仿路径。
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

    def _should_force_code_generation(self, req: AgentChatRequest) -> bool:
        context = req.context or {}
        forced_by_context = bool(context.get("force_code_generation"))
        normalized_message = self._strip_skill_hint(req.message)
        project_id = self._get_request_project_id(req)
        if not project_id and not forced_by_context:
            return False
        if forced_by_context:
            return True
        if not _has_direct_code_intent(normalized_message):
            return False
        current_stage = self._get_current_stage(req)
        return current_stage in {"stage_07_execute", "stage_08_evaluate"}

    async def chat(self, owner_id: str, req: AgentChatRequest) -> AgentChatResponse:
        started = time.perf_counter()
        trace_id = str(uuid.uuid4())
        session_id = req.session_id or str(uuid.uuid4())
        logger.info("agent_chat_start trace_id=%s owner_id=%s", trace_id, owner_id)

        try:
            skill_def = self._resolve_skill(req)
            user_message = self._strip_skill_hint(req.message)
            stage = skill_def.route_to_stage(user_message) if skill_def else None
            sub_skill_id = stage.stage_id if stage else None

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
                created_at=datetime.utcnow(),
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
            stage = skill_def.route_to_stage(user_message) if skill_def else None
            sub_skill_id = stage.stage_id if stage else None

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
                        yield ("token", {"token": cleaned_content})

                        # 检查是否包含question块，如果有立即发送
                        if _contains_question_block(cleaned_content):
                            question_data = _parse_question_block(cleaned_content)
                            if question_data:
                                yield ("question", question_data)

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
            stage = skill_def.route_to_stage(user_message) if skill_def else None
            sub_skill_id = stage.stage_id if stage else None
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

            if req.project_id:
                current_state = db.get_skill_state(req.project_id)
                if current_state:
                    last_known_stage = current_state.current_stage
                    yield ("stage_changed", {
                        "stage": current_state.current_stage,
                        "stage_name": self._get_stage_display_name(current_state.current_stage),
                    })

            for round_idx in range(MAX_TOOL_CALL_ROUNDS):
                content, tool_calls, model = await self._call_llm_with_tools(
                    messages, available_tools, owner_id
                )

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
            for gateway, model_name in chain:
                if not gateway:
                    continue
                payload = {
                    "model": model_name,
                    "messages": messages,
                    "stream": True,
                }
                try:
                    async for token in self.provider.stream_complete(payload, gateway_url=gateway):
                        full_content += token
                        yield ("token", {"token": token})
                        streamed = True
                    break
                except (httpx.HTTPError, RuntimeError):
                    continue

            if not streamed:
                fallback_content, _ = await self._generate_fallback(owner_id, req, tool_traces)
                full_content = fallback_content
                for chunk in self.build_stream_tokens(fallback_content):
                    yield ("token", {"token": chunk})

            full_content = _clean_dsml_content(full_content)

            # 输出层去重：修复 LLM 重复输出问题（如"好好想法想法"→"好想法"）
            deduped_content = self.deduplicate_repeated_text(full_content)
            if deduped_content != full_content and len(deduped_content) > 0:
                full_content = deduped_content

            # 剥离 question XML 块（内部协议格式，不显示给用户）
            raw_for_question_parse = full_content
            clean_content, has_question = self.strip_question_xml(full_content)
            if clean_content != full_content:
                yield ("content_update", {"content": clean_content})
                full_content = clean_content

            if not force_code_generation:
                # 用原始内容（含XML）解析 question 事件，发送给前端渲染选项卡
                if has_question or _contains_question_block(raw_for_question_parse):
                    question_data = _parse_question_block(raw_for_question_parse)
                    if question_data:
                        question_data["stage"] = last_known_stage
                        question_data["is_stage_final"] = _is_stage_final_question(question_data)
                        yield ("question", question_data)
                elif full_content.strip() and not _contains_question_block(full_content):
                    # 保底逻辑：如果 AI 没有输出 question，根据内容自动生成选项
                    fallback_question = self._generate_fallback_question(full_content, tool_traces)
                    if fallback_question:
                        yield ("question", fallback_question)

            if req.project_id:
                self._write_auto_evidence(req.project_id, owner_id, full_content, tool_traces)

            yield ("final", {"status": "completed", "tools_used": len(tool_traces)})
            logger.info("agent_stream_events_success trace_id=%s tools=%s", trace_id, len(tool_traces))
        except Exception:
            logger.exception("agent_stream_events_failed trace_id=%s", trace_id)
            raise

    def _build_system_prompt(self, req: AgentChatRequest, skill_def: Any, sub_skill_id: Optional[str]) -> str:
        teaching_mode_instruction = self._build_teaching_mode_instruction(req)
        if self._should_force_code_generation(req):
            force_prompt = """
你是 fineSTEM 的代码生成助手，现在必须直接完成编码实现。

## 强制目标
- 用户已经明确要求直接生成代码
- 当前项目已经处于执行或验收阶段
- 本轮回复必须以“可运行代码”为核心产出

## 强制规则
- 禁止继续追问年级、基础、时间安排、偏好、方案选择
- 禁止继续输出脑爆、开题、范围裁剪、计划确认之类内容
- 禁止输出任何 XML、DSML、tool_calls、artifact、question 协议文本
- 必须输出完整 Markdown 代码块，代码要尽量最小可运行
- 默认优先生成单文件、零配置、少依赖的版本，但不要默认收窄成 Python 小程序
- 必须根据用户目标和项目类型主动选择最合适的技术形式：
  - 如果是网页、可视化、交互界面、作品展示，优先生成 HTML/CSS/JavaScript 版本
  - 如果是脚本、数据处理、命令行工具、算法演示，可以优先生成 Python 版本
  - 如果用户明确指定语言、框架或已有工作区语言，就严格跟随，不要擅自改成别的语言
- 如果生成 Python 代码，优先使用标准库；如果生成前端代码，优先生成可直接预览的原生 HTML/CSS/JavaScript
- 不要为了“容易执行”把原本应做成网页/界面的需求强行改写成命令行程序
- 若当前环境不适合运行某类程序，也要先给出正确技术方向的代码，再用简短说明交代运行方式
- 先给完整代码，再给 3 条以内的简短运行说明

## 输出格式
1. 一句中文说明
2. 一个完整 Markdown 代码块
3. 最多 3 条运行说明

如果信息不完整，也不要继续追问，直接采用最稳妥默认值生成 MVP 代码。
""".strip()
            if teaching_mode_instruction:
                force_prompt += f"\n\n{teaching_mode_instruction}"
            return force_prompt

        direct_code_override = ""
        if skill_def:
            prompt = skill_def.get_system_prompt_for_stage(sub_skill_id)
            # 追加 XML 交互格式指令，确保需要选择题时输出可解析的 <question> 标签。
            xml_instruction = """

---

## 交互规则（仅在需要学生做选择时使用）

只有当你确实需要学生做选择、补充关键信息、或确认下一步方向时，才输出一个 `<question>` 选项块。

- 如果聊天历史或当前上下文里已经出现过年级、时间预算、初步想法，就不要重复问这三项。
- 如果信息已经足够推进当前阶段，就直接继续推进，不要为了凑交互而重复提问。
- 如果年级、时间预算、初步想法已经齐全，必须主动给出具体创意方向、MVP 方案或实现建议，不能继续停留在空泛提问。
- 如果用户明确要求“直接进入编码实现 / 直接给代码 / 写入编辑器 / 直接做”，且当前上下文已明确要求跳过引导或当前已在执行/验收阶段，才切到编码实现；否则继续当前 PBL 阶段，先给创意收敛、方向选择或方案建议。
- 生成代码、给出设计方案、总结结果时，默认不要额外附带 `<question>`，除非下一步真的需要用户选择。
- 同一轮回复最多包含一个 `<question>` 块。

```xml
<question type="single" title="接下来你想怎么做？">
<option id="opt_1" label="选项A">选项A描述</option>
<option id="opt_2" label="选项B">选项B描述</option>
<option id="opt_other" label="其他">我有其他想法</option>
</question>
```

当你决定提问时：
- 必须使用 `<question>` / `<option>` XML，而不是 JSON 或 Markdown 列表。
- 选项要和当前阶段强相关，避免回到已经问过的起始问题。
"""
            full_prompt = prompt + direct_code_override + xml_instruction
            if teaching_mode_instruction:
                full_prompt += f"\n\n{teaching_mode_instruction}"
            return full_prompt

        from app.services.providers.zeroclaw_provider import build_system_prompt
        fallback_prompt = build_system_prompt(req.context or {}) + direct_code_override
        if teaching_mode_instruction:
            fallback_prompt += f"\n\n{teaching_mode_instruction}"
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
        if context.get("preferred_output_language"):
            parts.append(f"期望输出语言: {context['preferred_output_language']}")
        if context.get("teaching_mode"):
            parts.append(f"请求教学模式: {context['teaching_mode']}")
        if context.get("demo_id"):
            parts.append(f"当前Demo ID: {context['demo_id']}")
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

    def _collect_confirmed_profile(self, req: AgentChatRequest) -> Dict[str, str]:
        history_messages = self._build_history_messages(req)
        text_parts = [item["content"] for item in history_messages if item.get("content")]
        current_message = self._strip_skill_hint(req.message)
        if current_message:
            text_parts.append(current_message)

        project_name = ""
        if req.project_id:
            project = db.get_project(req.project_id)
            if project and getattr(project, "name", ""):
                project_name = str(getattr(project, "name", "")).strip()

        full_text = "\n".join(text_parts)
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

        if project_name and project_name not in {"未命名项目", "新项目"}:
            profile["idea"] = project_name
        else:
            idea_match = re.search(r"(?:想做一个项目[，,：:]?|做一个|项目主题是|主题是)([^。\n]{4,60})", full_text)
            if idea_match:
                profile["idea"] = idea_match.group(1).strip(" ，,：:")

        return profile

    def _get_available_tools(self, skill_def: Any, sub_skill_id: Optional[str], req: Optional[AgentChatRequest] = None) -> List[str]:
        if req and self._should_force_code_generation(req):
            return []
        if not skill_def:
            return ["skill_state_reader", "resource_searcher", "code_runner"]
        return skill_def.get_tools_for_stage(sub_skill_id)

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
                return result["content"], result["tool_calls"], model
            except (httpx.HTTPError, RuntimeError):
                continue

        if settings.ZEROCLAW_ENABLE_MOCK_FALLBACK:
            return "AI 模型暂时不可用，请稍后重试。", [], settings.ZEROCLAW_LOCAL_SAFE_MODEL
        raise RuntimeError("ZeroClaw 网关调用失败，且已禁用 Mock 回退")

    async def _execute_tool(self, tool_name: str, params: Dict[str, Any], owner_id: str) -> ToolResult:
        tool = get_tool(tool_name)
        if not tool:
            return ToolResult(False, error=f"未知工具: {tool_name}")
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
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            created_by=user_id,
        ))

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

    @staticmethod
    def _generate_fallback_question(content: str, tool_traces: List[Any]) -> dict | None:
        """
        根据AI回复内容自动生成选项（保底逻辑）

        当AI没有输出<question>标签时，根据内容智能生成合适的交互选项
        """
        from datetime import datetime

        content_lower = content.lower()
        has_code = '```' in content or 'def ' in content or 'function' in content_lower or 'import ' in content
        has_project = any(t.tool_name == 'project_creator' for t in tool_traces)
        has_code_gen = any(t.tool_name in ['code_generator', 'code_runner'] for t in tool_traces)

        options = []

        if has_code and not has_code_gen:
            # AI生成了代码但还没运行
            options = [
                {"id": "opt_run", "label": "运行代码", "description": "执行并查看运行结果", "recommended": True},
                {"id": "opt_write_editor", "label": "写入编辑器", "description": "打开代码编辑器查看和修改"},
                {"id": "opt_modify", "label": "修改需求", "description": "调整代码功能或添加新特性"},
                {"id": "opt_other", "label": "其他想法", "description": "我有其他问题或想法"},
            ]
        elif has_code:
            # 已经有代码且可能已运行
            options = [
                {"id": "opt_next_step", "label": "下一步", "description": "继续项目开发的下一步", "recommended": True},
                {"id": "opt_modify_code", "label": "修改代码", "description": "调整或优化当前代码"},
                {"id": "opt_new_feature", "label": "添加新功能", "description": "为项目增加新特性"},
                {"id": "opt_other", "label": "其他", "description": "我有其他想法"},
            ]
        elif has_project:
            # 项目刚创建
            options = [
                {"id": "opt_start_coding", "label": "开始编码", "description": "进入代码编写阶段", "recommended": True},
                {"id": "opt_plan", "label": "详细规划", "description": "制定详细的开发计划"},
                {"id": "opt_change_idea", "label": "换个方向", "description": "修改项目方向或主题"},
                {"id": "opt_other", "label": "其他", "description": "我有其他想法"},
            ]
        else:
            # 通用对话场景
            if any(word in content_lower for word in ['问题', '不懂', '解释', '什么', '怎么']):
                options = [
                    {"id": "opt_understand", "label": "明白了，继续", "description": "理解了，进行下一步", "recommended": True},
                    {"id": "opt_example", "label": "举个例子", "description": "给我具体的例子说明"},
                    {"id": "opt_detail", "label": "详细说明", "description": "更深入地解释这个概念"},
                    {"id": "opt_other", "label": "其他问题", "description": "我想问别的问题"},
                ]
            elif any(word in content_lower for word in ['建议', '推荐', '选择', '考虑']):
                options = [
                    {"id": "opt_accept", "label": "好的，采纳建议", "description": "按照这个方案进行", "recommended": True},
                    {"id": "opt_alt", "label": "有其他方案吗", "description": "看看有没有其他选择"},
                    {"id": "opt_custom", "label": "我自己决定", "description": "我想按自己的想法来"},
                    {"id": "opt_other", "label": "其他", "description": "我有其他想法"},
                ]
            else:
                options = [
                    {"id": "opt_continue", "label": "继续", "description": "继续下一步操作", "recommended": True},
                    {"id": "opt_more_info", "label": "了解更多", "description": "提供更多相关信息"},
                    {"id": "opt_change", "label": "换个方向", "description": "尝试不同的方法或路径"},
                    {"id": "opt_other", "label": "其他", "description": "我有其他想法或问题"},
                ]

        if not options:
            return None

        return {
            "id": f"q-fallback-{int(datetime.utcnow().timestamp())}",
            "title": "接下来你想怎么做？",
            "options": options[:6],
            "multiple": False,
            "allow_custom": True,
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


def _contains_question_block(text: str) -> bool:
    if not text:
        return False
    import re
    # 支持 <question>、<question type="...">、<question\n 等多种格式
    markers = ["<question>", "<question ", "<question\n", "【提问】", "[提问]", "::question::", "{{question}}"]
    if any(m in text.lower() for m in markers):
        return True
    # 支持裸露的 <option 标签（AI 有时不用 question 包裹）
    return bool(re.search(r'<option\s+id=["\']', text, re.IGNORECASE))


def _parse_question_block(text: str) -> dict | None:
    import re
    from datetime import datetime

    raw = None

    # 首先尝试直接匹配 <question>...</question>
    pattern = r'<question[^>]*>(.*?)</question>'
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    
    if match:
        raw = match.group(1).strip()
        q_tag_match = re.search(r'<question[^>]*title=["\']([^"\']*)["\']', text, re.IGNORECASE)
        q_title = q_tag_match.group(1).strip() if q_tag_match else None
    else:
        # 尝试从代码块中提取（AI 有时会把 question 放在 ``` 代码块中）
        code_block_pattern = r'```(?:xml)?\s*\n?(<question[^>]*>.*?</question>)\s*\n?```'
        match = re.search(code_block_pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            raw = match.group(1).strip()
            q_tag_match = re.search(r'<question[^>]*title=["\']([^"\']*)["\']', text, re.IGNORECASE)
            q_title = q_tag_match.group(1).strip() if q_tag_match else None
        else:
            q_title = None
    
    # 如果没有 <question> 包裹，尝试直接从文本中提取裸露的 <option> 标签
    if not raw and re.search(r'<option\s+id=["\']', text, re.IGNORECASE):
        raw = text

    if not raw:
        return None

    title_match = re.search(r'<title>(.*?)</title>', raw, re.DOTALL | re.IGNORECASE)
    if title_match:
        title = title_match.group(1).strip()
    elif q_title:
        title = q_title
    elif '<option' not in raw.split('\n')[0]:
        title = raw.split('\n')[0][:200]
    else:
        title = "请选择"

    options = []
    opt_pattern = r'<option\s+id=["\']([^"\']*)["\'](?:[^>]*?label=["\']([^"\']*)["\'])?[^>]*>(.*?)</option>'
    for om in re.finditer(opt_pattern, raw, re.DOTALL | re.IGNORECASE):
        opt_id = om.group(1).strip()
        attr_label = om.group(2).strip() if om.group(2) else None
        opt_body = om.group(3).strip()
        
        # 支持三种 label 来源优先级: 属性 > 子标签 <label> > 内部文本首行
        child_label_match = re.search(r'<label>(.*?)</label>', opt_body, re.DOTALL | re.IGNORECASE)
        desc_match = re.search(r'<desc>(.*?)</desc>', opt_body, re.DOTALL | re.IGNORECASE)
        
        final_label = attr_label
        if not final_label:
            if child_label_match:
                final_label = child_label_match.group(1).strip()
            else:
                # 清理 opt_body 中的 XML 标签，取纯文本首行
                clean_body = re.sub(r'</?(?:label|desc)[^>]*>', '', opt_body).strip()
                final_label = clean_body.split('\n')[0][:100]
        
        options.append({
            "id": opt_id or f"opt-{len(options)}",
            "label": final_label,
            "description": desc_match.group(1).strip() if desc_match else None,
            "recommended": "推荐" in opt_body or "recommended" in opt_body.lower(),
        })

    if not options:
        lines = [l.strip() for l in raw.split('\n') if l.strip()]
        for i, line in enumerate(lines[1:], 1):
            if line.startswith('- ') or line.startswith('* '):
                options.append({
                    "id": f"opt-{i}",
                    "label": line[2:].strip(),
                    "description": None,
                    "recommended": False,
                })

    multiple = "multiple" in raw.lower() or "多选" in raw
    step_m = re.search(r'step["\s:]+(\d+)', raw, re.IGNORECASE)
    total_m = re.search(r'total["\s:]+(\d+)', raw, re.IGNORECASE)

    return {
        "id": f"q-{int(datetime.utcnow().timestamp())}",
        "title": title,
        "options": options[:8],
        "multiple": multiple,
        "allow_custom": True,
        "step": int(step_m.group(1)) if step_m else None,
        "total_steps": int(total_m.group(1)) if total_m else None,
    }


agent_orchestrator_service = AgentOrchestratorService()
