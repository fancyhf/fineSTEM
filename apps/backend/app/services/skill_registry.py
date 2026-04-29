"""
Skill 路由注册表 - 可插拔架构（v2.0）

用途：基于 SkillLoader 动态加载 SKILL.md，提供 Skill 路由和 Prompt 注入
维护者：AI Agent
links: .trae/documents/产品与规划/fineSTEM_AI对话流设计规格_v1.0.0.md

重要变更：
- v1.0: 硬编码 Skill 定义（已废弃）
- v2.0: 从磁盘动态加载 SKILL.md（当前版本）
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from app.services.skill_loader import (
    LoadedSkill,
    SkillLoader,
    SubSkillDef,
    get_skill_loader,
    load_stem_pbl_skill,
)


class DynamicSkillDefinition:
    """
    动态 Skill 定义包装器
    
    将从磁盘加载的 LoadedSkill 适配为统一的接口
    """
    
    def __init__(self, loaded: LoadedSkill):
        self._loaded = loaded
    
    @property
    def skill_id(self) -> str:
        return self._loaded.manifest.skill_id
    
    @property
    def name(self) -> str:
        return self._loaded.manifest.name
    
    @property
    def description(self) -> str:
        return self._loaded.manifest.description
    
    @property
    def triggers(self) -> List[str]:
        return self._loaded.triggers
    
    @property
    def stages(self) -> Dict[str, SubSkillDef]:
        return self._loaded.stages
    
    @property
    def base_system_prompt(self) -> str:
        """返回完整的 SKILL.md 内容作为 system prompt"""
        return self._loaded.base_system_prompt
    
    @property
    def full_content(self) -> str:
        """返回原始完整内容"""
        return self._loaded.full_content
    
    @property
    def resource_libraries(self) -> Dict[str, Any]:
        return self._loaded.resource_libraries
    
    @property
    def state_machine_spec(self) -> Dict[str, Any]:
        return self._loaded.state_machine_spec
    
    def match_trigger(self, message: str) -> bool:
        """检查消息是否匹配触发词"""
        normalized = message.lower()
        return any(t.lower() in normalized for t in self.triggers)
    
    def route_to_stage(self, message: str) -> Optional[SubSkillDef]:
        """根据消息路由到对应阶段"""
        normalized = message.lower()
        best_match: Optional[SubSkillDef] = None
        best_score = 0
        
        for stage_id, stage in self._loaded.stages.items():
            score = sum(1 for t in stage.triggers if t.lower() in normalized)
            if score > best_score:
                best_score = score
                best_match = stage
        
        return best_match
    
    def get_system_prompt_for_stage(self, stage_id: Optional[str] = None) -> str:
        """
        获取指定阶段的 system prompt
        
        Args:
            stage_id: 阶段 ID，如果为 None 返回完整 prompt
            
        Returns:
            完整的 system prompt 字符串
        """
        if stage_id and stage_id in self._loaded.stages:
            stage = self._loaded.stages[stage_id]
            prompt = self._loaded.base_system_prompt
            prompt += f"\n\n## 当前阶段\n"
            prompt += f"- 阶段 ID: {stage.stage_id}\n"
            prompt += f"- 阶段名称: {stage.name}\n"
            prompt += f"- 描述: {stage.description}\n"
            if stage.output_artifacts:
                prompt += f"- 输出工件: {', '.join(stage.output_artifacts)}\n"
            if stage.gate_conditions:
                prompt += f"- 通过条件: {'; '.join(stage.gate_conditions)}\n"
            prompt += f"\n### 阶段详细规范\n{stage.content}\n"
            return prompt
        
        return self._loaded.base_system_prompt
    
    def get_tools_for_stage(self, stage_id: Optional[str] = None) -> List[str]:
        """获取阶段所需的工具列表"""
        base_tools = [
            "skill_state_reader",
            "skill_state_writer",
            "stage_advancer",
            "artifact_writer",
            "artifact_reader",
            "project_creator",
            "code_generator",
            "code_runner",
        ]
        
        if stage_id and stage_id in self._loaded.stages:
            stage = self._loaded.stages[stage_id]
            if "bootstrap" in stage_id or "00" in stage_id:
                base_tools.append("project_creator")
                base_tools.append("resource_searcher")
            elif "brainstorm" in stage_id or "01" in stage_id:
                base_tools.append("artifact_writer")
                base_tools.append("skill_state_writer")
            elif "execute" in stage_id or "07" in stage_id:
                base_tools.append("code_runner")
                base_tools.append("evidence_saver")
        
        return base_tools
    
    def to_dict(self) -> Dict[str, Any]:
        """序列化为字典（用于 API 响应）"""
        return {
            'skill_id': self.skill_id,
            'name': self.name,
            'description': self.description,
            'version': self._loaded.manifest.version,
            'tags': self._loaded.manifest.tags,
            'triggers': self.triggers[:20],
            'stages': {
                sid: {
                    'name': s.name,
                    'description': s.description,
                    'trigger_count': len(s.triggers),
                    'output_artifacts': s.output_artifacts,
                    'gate_conditions': s.gate_conditions,
                }
                for sid, s in self._loaded.stages.items()
            },
            'loaded_at': self._loaded.manifest.loaded_at,
        }


class SkillRegistryServiceV2:
    """
    Skill 注册表服务 v2.0 - 动态加载版
    
    从磁盘加载 Skills，支持热重载和查询
    """
    
    def __init__(self):
        self._loader: SkillLoader = get_skill_loader()
        self._skills: Dict[str, DynamicSkillDefinition] = {}
        self._initialized = False
    
    def _ensure_loaded(self):
        """确保 Skills 已加载"""
        if not self._initialized:
            self.reload_all()
            self._initialized = True
    
    def reload_all(self):
        """重新加载所有 Skills"""
        loaded_skills = self._loader.load_all_skills()
        self._skills = {}
        
        for skill_id, loaded in loaded_skills.items():
            self._skills[skill_id] = DynamicSkillDefinition(loaded)
    
    def list_skills(self) -> List[Dict[str, Any]]:
        """列出所有可用 Skill"""
        self._ensure_loaded()
        return [skill.to_dict() for skill in self._skills.values()]
    
    def get_skill(self, skill_id: str) -> Optional[DynamicSkillDefinition]:
        """获取指定 Skill"""
        self._ensure_loaded()
        
        if skill_id in self._skills:
            return self._skills[skill_id]
        
        loaded = self._loader.get_skill(skill_id)
        if loaded:
            dynamic = DynamicSkillDefinition(loaded)
            self._skills[skill_id] = dynamic
            return dynamic
        
        return None
    
    def match_skill(self, message: str) -> Optional[DynamicSkillDefinition]:
        """根据消息匹配最佳 Skill"""
        self._ensure_loaded()
        
        best_skill: Optional[DynamicSkillDefinition] = None
        best_score = 0
        
        for skill in self._skills.values():
            if skill.match_trigger(message):
                score = sum(1 for t in skill.triggers if t.lower() in message.lower())
                if score > best_score:
                    best_score = score
                    best_skill = skill
        
        return best_skill
    
    def get_default_skill(self) -> Optional[DynamicSkillDefinition]:
        """获取默认 Skill（stem-pbl-guide）"""
        return self.get_skill("stem-pbl-guide")
    
    def reload_skill(self, skill_id: str) -> Optional[DynamicSkillDefinition]:
        """重载指定 Skill"""
        loaded = self._loader.reload_skill(skill_id)
        if loaded:
            dynamic = DynamicSkillDefinition(loaded)
            self._skills[skill_id] = dynamic
            return dynamic
        return None


# 全局服务实例
skill_registry_v2 = SkillRegistryServiceV2()


# ==================== 兼容性接口（供旧代码使用）====================

def match_skill(message: str) -> Optional[DynamicSkillDefinition]:
    """兼容旧接口：匹配 Skill"""
    return skill_registry_v2.match_skill(message)


def get_stem_pbl_skill() -> Optional[DynamicSkillDefinition]:
    """兼容旧接口：获取 STEM PBL Skill"""
    return skill_registry_v2.get_skill("stem-pbl-guide")


def list_marketplace() -> list:
    """兼容旧接口：列出 Skill 市场"""
    return skill_registry_v2.list_skills()


SKILL_REGISTRY: Dict[str, DynamicSkillDefinition] = {}


def _init_legacy_compat():
    """初始化兼容性接口"""
    global SKILL_REGISTRY
    skill_registry_v2._ensure_loaded()
    SKILL_REGISTRY = {sid: skill for sid, skill in skill_registry_v2._skills.items()}


# 启动时自动初始化
_init_legacy_compat()
