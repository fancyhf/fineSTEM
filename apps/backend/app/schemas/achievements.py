"""
成果档案卡数据模型

用途：成果档案卡的创建、查看、分享、公开
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime
from .common import AuditFields, PublishFields


class AchievementCardBase(BaseModel):
    """
    成果档案卡基础字段
    """
    title: str = Field(..., min_length=1, max_length=200, description="档案卡标题")
    one_liner: str = Field(..., min_length=1, max_length=500, description="一句话介绍")
    problem_solved: str = Field(..., min_length=1, max_length=2000, description="我解决了什么问题")
    method_used: str = Field(..., min_length=1, max_length=2000, description="我用了什么方法")
    screenshots: List[str] = Field(default_factory=list, description="项目截图或演示链接")
    reflection: str = Field(..., min_length=1, max_length=2000, description="我的反思")
    capability_tags: List[str] = Field(default_factory=list, description="AI 总结的能力标签")
    project_mode: Literal['light', 'standard'] = Field(default='light', description="项目模式")


class AchievementCardCreate(AchievementCardBase):
    """
    成果档案卡创建请求
    """
    pass


class AchievementCardUpdate(BaseModel):
    """
    成果档案卡更新请求
    """
    title: Optional[str] = None
    one_liner: Optional[str] = None
    problem_solved: Optional[str] = None
    method_used: Optional[str] = None
    screenshots: Optional[List[str]] = None
    reflection: Optional[str] = None
    capability_tags: Optional[List[str]] = None


class AchievementCard(AchievementCardBase, AuditFields, PublishFields):
    """
    完整成果档案卡模型（数据库存储用）
    """
    id: str = Field(default="", description="档案卡 ID")
    project_id: str = Field(description="所属项目 ID")
    author_id: str = Field(description="作者 ID")
    share_token: Optional[str] = Field(None, description="私有分享令牌")
    
    model_config = ConfigDict(from_attributes=True)


class ShareTokenResponse(BaseModel):
    """
    生成分享链接的响应
    """
    share_token: str = Field(..., description="分享令牌")
    share_url: str = Field(..., description="完整分享链接")


class SubmitPublicRequest(BaseModel):
    """
    申请公开到灵感墙的请求
    """
    submit_public: bool = Field(..., description="确认申请公开")
