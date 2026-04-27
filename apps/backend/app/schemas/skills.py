"""
Skill 体系数据模型

用途：定义 Skill 清单、安装、启停和执行协议
维护者：AI Agent
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


SkillPermission = Literal[
    "project:read",
    "project:write",
    "evidence:read",
    "evidence:write",
    "network:read",
]

SkillStatus = Literal["installed", "enabled", "disabled"]
SkillSourceType = Literal["builtin", "marketplace", "custom"]


class SkillManifest(BaseModel):
    """
    Skill 描述文件（精简版）
    """

    skill_id: str = Field(..., min_length=2, max_length=80)
    name: str = Field(..., min_length=1, max_length=120)
    version: str = Field(..., min_length=1, max_length=40)
    description: str = Field(default="", max_length=500)
    entrypoint: str = Field(..., min_length=1, max_length=120)
    permissions: List[SkillPermission] = Field(default_factory=list)
    timeout_ms: int = Field(default=10000, ge=1000, le=120000)
    tags: List[str] = Field(default_factory=list)
    provider_tags: List[str] = Field(default_factory=list)
    requires_approval: bool = False


class SkillRecord(BaseModel):
    """
    已安装 Skill 记录
    """

    id: str
    owner_id: str
    source: SkillSourceType = "builtin"
    status: SkillStatus = "enabled"
    manifest: SkillManifest
    config: Dict[str, Any] = Field(default_factory=dict)
    install_date: datetime = Field(default_factory=datetime.utcnow)
    last_used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SkillInstallRequest(BaseModel):
    skill_id: str = Field(..., min_length=2, max_length=80)
    source: SkillSourceType = "marketplace"
    config: Dict[str, Any] = Field(default_factory=dict)


class SkillToggleRequest(BaseModel):
    enabled: bool


class SkillInvokeInput(BaseModel):
    query: str = Field(..., min_length=1)
    context: Dict[str, Any] = Field(default_factory=dict)
    project_id: Optional[str] = None


class SkillInvokeOutput(BaseModel):
    skill_id: str
    summary: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    latency_ms: int
