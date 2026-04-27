"""
Skill 运行时服务

用途：执行已启用 Skill，并返回结构化结果
维护者：AI Agent
"""

from datetime import datetime
from typing import Dict, List
import asyncio
import time

from app.core.config import settings
from app.repositories.runtime_db import db
from app.schemas.evidence import Evidence
from app.schemas.skills import SkillInvokeInput, SkillInvokeOutput, SkillRecord
from app.services.feature_flags import feature_flag_service
from app.services.skill_policy import skill_policy_service
from app.services.sandbox_executor import sandbox_executor


class SkillRuntimeService:
    async def invoke(self, skill: SkillRecord, payload: SkillInvokeInput) -> SkillInvokeOutput:
        skill_policy_service.validate(skill)
        timeout_seconds = skill.manifest.timeout_ms / 1000
        return await asyncio.wait_for(self._invoke_impl(skill, payload), timeout=timeout_seconds)

    async def _invoke_impl(self, skill: SkillRecord, payload: SkillInvokeInput) -> SkillInvokeOutput:
        started = time.perf_counter()

        if feature_flag_service.is_enabled("skill_sandbox", skill.owner_id):
            sandbox_payload = self._build_sandbox_payload(payload)
            summary, detail = await sandbox_executor.execute(
                skill_id=skill.manifest.skill_id,
                payload=sandbox_payload,
                timeout_ms=skill.manifest.timeout_ms,
                allow_network=settings.AGENT_ALLOW_NETWORK_SKILL,
            )
        else:
            if skill.manifest.skill_id == "stempbl-guide":
                summary, detail = self._run_stempbl_guide(payload)
            elif skill.manifest.skill_id == "project-inspector":
                summary, detail = self._run_project_inspector(payload)
            elif skill.manifest.skill_id == "demo-explorer":
                summary, detail = self._run_demo_explorer(payload)
            elif skill.manifest.skill_id == "knowledge-rag":
                summary, detail = self._run_knowledge_rag(payload)
            else:
                raise RuntimeError(f"不支持的 skill: {skill.manifest.skill_id}")

        latency = max(1, int((time.perf_counter() - started) * 1000))
        return SkillInvokeOutput(
            skill_id=skill.manifest.skill_id,
            summary=summary,
            payload=detail,
            latency_ms=latency,
        )

    def _build_sandbox_payload(self, payload: SkillInvokeInput) -> Dict[str, object]:
        project = db.get_project(payload.project_id) if payload.project_id else None
        evidence_count = len(db.list_evidence_by_project(payload.project_id, skip=0, limit=1000)) if payload.project_id else 0
        has_card = bool(db.get_achievement_card_by_project(payload.project_id)) if payload.project_id else False
        demos = db.list_demos(skip=0, limit=20, search=payload.query)
        project_data = None
        if project:
            project_data = {
                "id": project.id,
                "mode": project.mode,
                "current_stage": project.current_stage,
            }
        return {
            "query": payload.query,
            "project": project_data,
            "evidence_count": evidence_count,
            "has_achievement_card": has_card,
            "demo_names": [item.name for item in demos],
        }

    def _run_stempbl_guide(self, payload: SkillInvokeInput) -> tuple[str, Dict[str, object]]:
        if not payload.project_id:
            return "请先指定项目，再开始 PBL 引导。", {"next_action": "select_project"}

        project = db.get_project(payload.project_id)
        if not project:
            return "未找到对应项目，请检查项目 ID。", {"next_action": "check_project_id"}

        stage = project.current_stage
        hints = {
            "stage_01_brainstorm": "先列出 5 个可执行的选题，再选 1 个做问题定义。",
            "stage_02_brief": "补齐问题陈述、成功标准和风险清单。",
            "stage_03_constraints": "把需求分成 must-have 与 nice-to-have。",
            "stage_04_track": "确认技术轨道和资源可达性。",
            "stage_05_design": "先出验收标准，再细化组件结构。",
            "stage_06_step_plan": "每步都要包含 run/check/rollback。",
            "stage_07_execute": "按里程碑推进并记录开发日志。",
            "stage_08_evaluate": "根据验收标准逐条评估并形成成果卡。",
        }
        suggestion = hints.get(stage, "继续推进当前阶段并补充关键证据。")
        summary = f"项目当前阶段为 {stage}，建议：{suggestion}"
        return summary, {"current_stage": stage, "suggestion": suggestion}

    def _run_project_inspector(self, payload: SkillInvokeInput) -> tuple[str, Dict[str, object]]:
        if not payload.project_id:
            return "缺少项目 ID，无法分析完成度。", {"completion": 0}

        project = db.get_project(payload.project_id)
        if not project:
            return "项目不存在，无法分析。", {"completion": 0}

        evidence_items = db.list_evidence_by_project(payload.project_id, skip=0, limit=1000)
        card = db.get_achievement_card_by_project(payload.project_id)
        stages = [
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
        progress_score = int((stages.index(project.current_stage) + 1) / len(stages) * 100) if project.current_stage in stages else 0
        summary = f"项目完成度约 {progress_score}%，证据 {len(evidence_items)} 条，成果卡{'已' if card else '未'}生成。"
        return summary, {
            "completion": progress_score,
            "evidence_count": len(evidence_items),
            "has_achievement_card": bool(card),
            "current_stage": project.current_stage,
        }

    def _run_demo_explorer(self, payload: SkillInvokeInput) -> tuple[str, Dict[str, object]]:
        demos = db.list_demos(skip=0, limit=20, search=payload.query)
        names: List[str] = [item.name for item in demos[:3]]
        if not names:
            return "未检索到匹配 Demo，建议换个关键词。", {"matches": []}
        return f"已找到 {len(demos)} 个相关 Demo，推荐：{', '.join(names)}。", {"matches": names}

    def _run_knowledge_rag(self, payload: SkillInvokeInput) -> tuple[str, Dict[str, object]]:
        summary = "知识检索模式已启用。当前实现会基于上下文返回结构化摘要，后续可扩展为文档向量检索。"
        return summary, {"query": payload.query, "source": "local-context"}

    def write_auto_evidence(self, project_id: str, user_id: str, summary: str) -> None:
        project = db.get_project(project_id)
        if not project:
            return
        db.create_evidence(
            Evidence(
                id="",
                project_id=project_id,
                author_id=user_id,
                type="text_log",
                content=summary,
                related_step=project.current_stage,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                created_by=user_id,
            )
        )


skill_runtime_service = SkillRuntimeService()
