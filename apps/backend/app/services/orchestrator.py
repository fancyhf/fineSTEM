"""
Agent 编排服务

用途：协调模型调用与 Skill 调用，返回统一响应
维护者：AI Agent
"""

from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Tuple
import uuid
import httpx
import time
import logging

from app.core.config import settings
from app.repositories.runtime_db import db
from app.schemas.agent import AgentChatRequest, AgentChatResponse, AgentToolTrace
from app.schemas.skills import SkillInvokeInput
from app.services.feature_flags import feature_flag_service
from app.services.observability import agent_observability_service
from app.services.providers.zeroclaw_provider import ZeroClawProvider
from app.services.skill_runtime import skill_runtime_service

logger = logging.getLogger(__name__)


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
        tool_traces: List[AgentToolTrace] = []
        logger.info("agent_chat_start trace_id=%s owner_id=%s", trace_id, owner_id)

        try:
            if req.enable_tools:
                selected_skills = self._select_candidate_skills(owner_id, req.message)
                for skill in selected_skills:
                    try:
                        result = await skill_runtime_service.invoke(
                            skill,
                            SkillInvokeInput(
                                query=req.message,
                                context=req.context,
                                project_id=req.project_id,
                            ),
                        )
                        tool_traces.append(
                            AgentToolTrace(
                                tool_name=result.skill_id,
                                status="success",
                                summary=result.summary,
                                duration_ms=result.latency_ms,
                            )
                        )
                    except Exception as exc:  # noqa: BLE001
                        tool_traces.append(
                            AgentToolTrace(
                                tool_name=skill.manifest.skill_id,
                                status="failed",
                                summary=f"执行失败: {exc}",
                                duration_ms=0,
                            )
                        )

            assistant_content, model_name = await self._generate_answer(owner_id, req, tool_traces)
            if req.project_id:
                skill_runtime_service.write_auto_evidence(req.project_id, owner_id, assistant_content)

            response = AgentChatResponse(
                role="assistant",
                content=assistant_content,
                trace_id=trace_id,
                session_id=session_id,
                used_tools=tool_traces,
                model=model_name,
                created_at=datetime.utcnow(),
            )
            latency_ms = int((time.perf_counter() - started) * 1000)
            agent_observability_service.record(success=True, latency_ms=latency_ms)
            logger.info("agent_chat_success trace_id=%s latency_ms=%s", trace_id, latency_ms)
            return response
        except Exception:
            latency_ms = int((time.perf_counter() - started) * 1000)
            agent_observability_service.record(success=False, latency_ms=latency_ms)
            logger.exception("agent_chat_failed trace_id=%s latency_ms=%s", trace_id, latency_ms)
            raise

    async def _generate_answer(
        self,
        owner_id: str,
        req: AgentChatRequest,
        tool_traces: List[AgentToolTrace],
    ) -> tuple[str, str]:
        tool_context = "\n".join([f"- {item.tool_name}: {item.summary}" for item in tool_traces]) or "无"
        fallback_enabled = feature_flag_service.is_enabled("provider_fallback", owner_id)
        chain: list[tuple[str | None, str]] = [(settings.ZEROCLAW_GATEWAY_URL, settings.ZEROCLAW_DEFAULT_MODEL)]
        if fallback_enabled:
            chain.append((settings.ZEROCLAW_FALLBACK_GATEWAY_URL, settings.ZEROCLAW_FALLBACK_MODEL))
        errors: list[str] = []
        for gateway, model in chain:
            if not gateway:
                continue
            payload: Dict[str, Any] = {
                "message": req.message,
                "context": {
                    "owner_id": owner_id,
                    "project_id": req.project_id,
                    "tool_results": tool_context,
                    **req.context,
                },
                "model": model,
            }
            try:
                content = await self.provider.complete(payload, gateway_url=gateway)
                return content, model
            except (httpx.HTTPError, RuntimeError) as exc:
                errors.append(f"{model}: {exc}")
                continue
        if settings.ZEROCLAW_ENABLE_MOCK_FALLBACK:
            return self._fallback_answer(req.message, tool_traces), settings.ZEROCLAW_LOCAL_SAFE_MODEL
        if not chain or all(not gateway for gateway, _ in chain):
            raise RuntimeError("ZeroClaw 网关未配置，且已禁用 Mock 回退")
        raise RuntimeError(f"ZeroClaw 网关调用失败，且已禁用 Mock 回退：{' | '.join(errors)}")

    def _fallback_answer(self, message: str, tool_traces: List[AgentToolTrace]) -> str:
        if tool_traces:
            snippets = "；".join([f"{item.tool_name}: {item.summary}" for item in tool_traces])
            return f"模型网关暂不可用，我已先完成技能分析：{snippets}"
        return f"已收到你的问题：{message}。当前模型网关不可用，请稍后重试。"

    def _select_candidate_skills(self, owner_id: str, message: str) -> List[Any]:
        installed = db.list_installed_skills(owner_id)
        enabled = [item for item in installed if item.status == "enabled"]
        if not enabled:
            return []

        normalized = message.lower()
        rules: List[Tuple[str, str]] = [
            ("project-inspector", "进度"),
            ("project-inspector", "完成"),
            ("stempbl-guide", "下一步"),
            ("stempbl-guide", "如何做"),
            ("demo-explorer", "demo"),
            ("knowledge-rag", "知识"),
            ("knowledge-rag", "原理"),
        ]
        matched_skill_ids = {skill_id for skill_id, keyword in rules if keyword in normalized}
        if not matched_skill_ids:
            return enabled[:1]
        return [item for item in enabled if item.manifest.skill_id in matched_skill_ids]

    def build_stream_tokens(self, content: str) -> List[str]:
        if not content:
            return []
        chunk_size = 20
        return [content[i : i + chunk_size] for i in range(0, len(content), chunk_size)]

    async def stream_chat(self, owner_id: str, req: AgentChatRequest) -> AsyncGenerator[str, None]:
        trace_id = str(uuid.uuid4())
        logger.info("agent_stream_start trace_id=%s owner_id=%s", trace_id, owner_id)
        tool_traces: List[AgentToolTrace] = []

        try:
            if req.enable_tools:
                selected_skills = self._select_candidate_skills(owner_id, req.message)
                for skill in selected_skills:
                    try:
                        result = await skill_runtime_service.invoke(
                            skill,
                            SkillInvokeInput(
                                query=req.message,
                                context=req.context,
                                project_id=req.project_id,
                            ),
                        )
                        tool_traces.append(
                            AgentToolTrace(
                                tool_name=result.skill_id,
                                status="success",
                                summary=result.summary,
                                duration_ms=result.latency_ms,
                            )
                        )
                    except Exception as exc:  # noqa: BLE001
                        tool_traces.append(
                            AgentToolTrace(
                                tool_name=skill.manifest.skill_id,
                                status="failed",
                                summary=f"执行失败: {exc}",
                                duration_ms=0,
                            )
                        )

            tool_context = "\n".join([f"- {item.tool_name}: {item.summary}" for item in tool_traces]) or "无"
            chain: list[tuple[str | None, str]] = [(settings.ZEROCLAW_GATEWAY_URL, settings.ZEROCLAW_DEFAULT_MODEL)]
            if feature_flag_service.is_enabled("provider_fallback", owner_id):
                chain.append((settings.ZEROCLAW_FALLBACK_GATEWAY_URL, settings.ZEROCLAW_FALLBACK_MODEL))

            full_content = ""
            streamed = False
            for gateway, model in chain:
                if not gateway:
                    continue
                payload: Dict[str, Any] = {
                    "message": req.message,
                    "context": {
                        "owner_id": owner_id,
                        "project_id": req.project_id,
                        "tool_results": tool_context,
                        **req.context,
                    },
                    "model": model,
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
                fallback_content, _ = await self._generate_answer(owner_id, req, tool_traces)
                full_content = fallback_content
                for chunk in self.build_stream_tokens(fallback_content):
                    yield chunk

            if req.project_id:
                skill_runtime_service.write_auto_evidence(req.project_id, owner_id, full_content)

            logger.info("agent_stream_success trace_id=%s", trace_id)
        except Exception:
            logger.exception("agent_stream_failed trace_id=%s", trace_id)
            raise


agent_orchestrator_service = AgentOrchestratorService()
