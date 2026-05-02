"""
Agent 编排服务（v2：Tool Calling + Skill 路由）

用途：协调 LLM Tool Calling 与 Skill 路由，驱动 PBL 研学流程
维护者：AI Agent
links: .trae/documents/产品与规划/fineSTEM_AI对话流设计规格_v1.0.0.md
"""

from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional
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


class AgentOrchestratorService:
    def __init__(self) -> None:
        self.provider = ZeroClawProvider(
            gateway_url=settings.ZEROCLAW_GATEWAY_URL,
            timeout_seconds=settings.ZEROCLAW_TIMEOUT_SECONDS,
            api_key=settings.ZEROCLAW_API_KEY,
        )

    async def chat(self, owner_id: str, req: AgentChatRequest) -> AgentChatResponse:
        started = time.perf_counter()
        trace_id = str(uuid.uuid4())
        session_id = req.session_id or str(uuid.uuid4())
        logger.info("agent_chat_start trace_id=%s owner_id=%s", trace_id, owner_id)

        try:
            skill_def = match_skill(req.message) if req.enable_tools else None
            stage = skill_def.route_to_stage(req.message) if skill_def else None
            sub_skill_id = stage.stage_id if stage else None

            system_prompt = self._build_system_prompt(req, skill_def, sub_skill_id)
            context_block = self._build_context_block(req, owner_id)
            messages = self._build_messages(req, system_prompt, context_block)
            available_tools = self._get_available_tools(skill_def, sub_skill_id)

            tool_traces: List[AgentToolTrace] = []
            full_content = ""
            model_name = settings.ZEROCLAW_DEFAULT_MODEL

            for round_idx in range(MAX_TOOL_CALL_ROUNDS):
                content, tool_calls, model = await self._call_llm_with_tools(
                    messages, available_tools, owner_id
                )

                if not tool_calls:
                    full_content = content or ""
                    model_name = model
                    break

                for tc in tool_calls:
                    tool_name = tc.get("function", {}).get("name", "")
                    tool_args_str = tc.get("function", {}).get("arguments", "{}")
                    try:
                        tool_args = json.loads(tool_args_str)
                    except json.JSONDecodeError:
                        tool_args = {}

                    tool_started = time.perf_counter()
                    tool_result = await self._execute_tool(tool_name, tool_args)
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
            skill_def = match_skill(req.message) if req.enable_tools else None
            stage = skill_def.route_to_stage(req.message) if skill_def else None
            sub_skill_id = stage.stage_id if stage else None

            system_prompt = self._build_system_prompt(req, skill_def, sub_skill_id)
            context_block = self._build_context_block(req, owner_id)
            messages = self._build_messages(req, system_prompt, context_block)
            available_tools = self._get_available_tools(skill_def, sub_skill_id)

            tool_traces: List[AgentToolTrace] = []
            full_content = ""

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

                    tool_result = await self._execute_tool(tool_name, tool_args)
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
            skill_def = match_skill(req.message) if req.enable_tools else None
            stage = skill_def.route_to_stage(req.message) if skill_def else None
            sub_skill_id = stage.stage_id if stage else None

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
            available_tools = self._get_available_tools(skill_def, sub_skill_id)

            tool_traces: List[AgentToolTrace] = []
            full_content = ""

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

                    tool_result = await self._execute_tool(tool_name, tool_args)
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
                        yield ("project_created", {
                            "project_id": project_data.get("project_id", str(uuid.uuid4())),
                            "project_name": project_data.get("name") or project_data.get("project_name", "新项目"),
                        })

                    messages.append({"role": "assistant", "content": None, "tool_calls": [tc]})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "content": tool_result.to_string(),
                    })

            if full_content and _contains_question_block(full_content):
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

            # 输出层去重：修复 LLM 重复输出问题（如"好好想法想法"→"好想法"）
            deduped_content = self.deduplicate_repeated_text(full_content)
            if deduped_content != full_content and len(deduped_content) > 0:
                full_content = deduped_content

            # 剥离 question XML 块（内部协议格式，不显示给用户）
            # 关键：在剥离前先保存原始内容用于解析
            raw_for_question_parse = full_content
            clean_content, has_question = self.strip_question_xml(full_content)
            if clean_content != full_content:
                yield ("content_update", {"content": clean_content})
                full_content = clean_content

            # 用原始内容（含XML）解析question事件，发送给前端渲染选项卡
            if has_question or _contains_question_block(raw_for_question_parse):
                question_data = _parse_question_block(raw_for_question_parse)
                if question_data:
                    yield ("question", question_data)

            if req.project_id:
                self._write_auto_evidence(req.project_id, owner_id, full_content, tool_traces)

            yield ("final", {"status": "completed", "tools_used": len(tool_traces)})
            logger.info("agent_stream_events_success trace_id=%s tools=%s", trace_id, len(tool_traces))
        except Exception:
            logger.exception("agent_stream_events_failed trace_id=%s", trace_id)
            raise

    def _build_system_prompt(self, req: AgentChatRequest, skill_def: Any, sub_skill_id: Optional[str]) -> str:
        if skill_def:
            return skill_def.get_system_prompt_for_stage(sub_skill_id)

        from app.services.providers.zeroclaw_provider import build_system_prompt
        return build_system_prompt(req.context or {})

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
        context = req.context or {}
        if context.get("scene"):
            parts.append(f"场景: {context['scene']}")
        if context.get("demo_id"):
            parts.append(f"当前Demo ID: {context['demo_id']}")
        return "\n".join(parts) if parts else ""

    def _build_messages(self, req: AgentChatRequest, system_prompt: str, context_block: str) -> List[Dict[str, Any]]:
        messages: List[Dict[str, Any]] = []
        full_system = system_prompt
        if context_block:
            full_system += f"\n\n## 当前上下文\n{context_block}"
        messages.append({"role": "system", "content": full_system})
        messages.append({"role": "user", "content": req.message})
        return messages

    def _get_available_tools(self, skill_def: Any, sub_skill_id: Optional[str]) -> List[str]:
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

    async def _execute_tool(self, tool_name: str, params: Dict[str, Any]) -> ToolResult:
        tool = get_tool(tool_name)
        if not tool:
            return ToolResult(False, error=f"未知工具: {tool_name}")
        try:
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
    def deduplicate_repeated_text(text: str) -> str:
        """
        去除重复的文字（如"好好想法想法"→"好想法"）
        
        使用正则检测连续重复的词/字并合并为单个
        """
        if not text or len(text) < 4:
            return text
        
        import re
        
        # 模式1：连续2次重复的字/词（如"好好好"→"好"，"想想想"→"想"）
        # 匹配 2-4 个连续相同的中文字符
        text = re.sub(r'([\u4e00-\u9fff])\1{1,3}', r'\1', text)
        
        # 模式2：连续2次重复的2字词（如"想法想法"→"想法"）
        text = re.sub(r'([\u4e00-\u9fff]{2,4})\1', r'\1', text)
        
        # 模式3：连续重复的英文单词（如"AppApp"→"App"）
        text = re.sub(r'([A-Za-z]{2,})\1', r'\1', text)
        
        # 模式4：标点符号后紧跟重复内容（如"，，"→"，"）
        text = re.sub(r'([，。！？、；：])\1+', r'\1', text)
        
        # 模式5：空格后重复（如"  "→" "）
        text = re.sub(r' {2,}', ' ', text)
        
        # 模式6：特殊符号重复（如"****"→"*"，"----"→"-"）
        text = re.sub(r'([*~\-#]+)\1{1,}', r'\1', text)
        
        return text.strip()

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
        
        # 清理可能残留的多余空行
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        
        return cleaned.strip(), has_question


def _contains_question_block(text: str) -> bool:
    if not text:
        return False
    # 支持 <question>、<question type="...">、<question\n 等多种格式
    markers = ["<question>", "<question ", "<question\n", "【提问】", "[提问]", "::question::", "{{question}}"]
    return any(m in text.lower() for m in markers)


def _parse_question_block(text: str) -> dict | None:
    import re

    # 首先尝试直接匹配 <question>...</question>
    pattern = r'<question[^>]*>(.*?)</question>'
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    
    if not match:
        # 尝试从代码块中提取（AI 有时会把 question 放在 ``` 代码块中）
        code_block_pattern = r'```(?:xml)?\s*\n?(<question[^>]*>.*?</question>)\s*\n?```'
        match = re.search(code_block_pattern, text, re.DOTALL | re.IGNORECASE)
    
    if not match:
        return None

    raw = match.group(1).strip()

    title_match = re.search(r'<title>(.*?)</title>', raw, re.DOTALL | re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else raw.split('\n')[0][:200]

    options = []
    opt_pattern = r'<option\s+id=["\']([^"\']*)["\'][^>]*>(.*?)</option>'
    for om in re.finditer(opt_pattern, raw, re.DOTALL | re.IGNORECASE):
        opt_id = om.group(1).strip()
        opt_body = om.group(2).strip()
        label_match = re.search(r'<label>(.*?)</label>', opt_body, re.DOTALL | re.IGNORECASE)
        desc_match = re.search(r'<desc>(.*?)</desc>', opt_body, re.DOTALL | re.IGNORECASE)
        options.append({
            "id": opt_id or f"opt-{len(options)}",
            "label": label_match.group(1).strip() if label_match else opt_body.split('\n')[0][:100],
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
