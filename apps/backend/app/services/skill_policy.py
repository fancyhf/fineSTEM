"""
Skill 策略与沙箱校验

用途：统一校验技能执行权限、超时与敏感能力开关
维护者：AI Agent
"""

from app.core.config import settings
from app.schemas.skills import SkillRecord


class SkillPolicyError(RuntimeError):
    pass


class SkillPolicyService:
    def validate(self, skill: SkillRecord) -> None:
        if skill.status != "enabled":
            raise SkillPolicyError("Skill 未启用")
        if skill.manifest.timeout_ms > settings.AGENT_SKILL_TIMEOUT_MS:
            raise SkillPolicyError("Skill 超时配置超过系统上限")
        if "network:read" in skill.manifest.permissions and not settings.AGENT_ALLOW_NETWORK_SKILL:
            raise SkillPolicyError("当前环境禁止网络型 Skill")


skill_policy_service = SkillPolicyService()
