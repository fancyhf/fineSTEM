"""
Skill 注册表服务

用途：维护平台可安装 Skill 市场清单
维护者：AI Agent
"""

from typing import Dict, List, Optional
from app.schemas.skills import SkillManifest


class SkillRegistryService:
    def __init__(self) -> None:
        self._marketplace: Dict[str, SkillManifest] = {
            "stempbl-guide": SkillManifest(
                skill_id="stempbl-guide",
                name="STEM PBL Guide",
                version="1.0.0",
                description="按项目式学习流程引导学生推进任务。",
                entrypoint="stempbl_guide.execute",
                permissions=["project:read", "project:write", "evidence:write"],
                timeout_ms=15000,
                tags=["education", "workflow"],
                provider_tags=["zeroclaw"],
            ),
            "project-inspector": SkillManifest(
                skill_id="project-inspector",
                name="Project Inspector",
                version="1.0.0",
                description="分析项目阶段、证据和成果完成度。",
                entrypoint="project_inspector.execute",
                permissions=["project:read", "evidence:read"],
                timeout_ms=12000,
                tags=["analysis"],
                provider_tags=["zeroclaw"],
            ),
            "demo-explorer": SkillManifest(
                skill_id="demo-explorer",
                name="Demo Explorer",
                version="1.0.0",
                description="检索 Demo 与模板推荐。",
                entrypoint="demo_explorer.execute",
                permissions=["project:read"],
                timeout_ms=10000,
                tags=["demo", "search"],
            ),
            "knowledge-rag": SkillManifest(
                skill_id="knowledge-rag",
                name="Knowledge RAG",
                version="1.0.0",
                description="对文档进行知识检索并返回答案摘要。",
                entrypoint="knowledge_rag.execute",
                permissions=["network:read"],
                timeout_ms=20000,
                tags=["knowledge", "rag"],
                provider_tags=["zeroclaw"],
            ),
        }

    def list_marketplace(self) -> List[SkillManifest]:
        return list(self._marketplace.values())

    def get_manifest(self, skill_id: str) -> Optional[SkillManifest]:
        return self._marketplace.get(skill_id)


skill_registry_service = SkillRegistryService()
