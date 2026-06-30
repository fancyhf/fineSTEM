"""
Demo 项目数据模型

用途：Demo 项目展示、列表、详情的数据定义
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Literal
from .common import AuditFields, PublishFields


class DemoBase(BaseModel):
    """
    Demo 基础字段
    """
    name: str = Field(..., min_length=1, max_length=200, description="Demo 名称")
    description: str = Field(..., min_length=1, max_length=2000, description="项目简介")
    tech_stack: List[str] = Field(default_factory=list, description="技术栈标签")
    difficulty: Literal['beginner', 'intermediate', 'advanced'] = Field(default='beginner', description="难度")
    subjects: List[str] = Field(default_factory=list, description="学科标签")
    grade_range: str = Field(default="10-18岁", description="适用年级")
    tags: List[str] = Field(default_factory=list, description="通用标签")
    display_mode: Literal['iframe', 'static'] = Field(default='iframe', description="展示模式")
    iframe_url: Optional[str] = Field(None, description="iframe 嵌入地址")
    screenshots: List[str] = Field(default_factory=list, description="截图文件路径列表")
    demo_video_url: Optional[str] = Field(None, description="关键流程录屏")
    project_breakdown: Optional[str] = Field(None, description="项目拆解说明（Markdown）")
    minimal_replica: Optional[str] = Field(None, description="最小可复刻代码路径")
    code_url: str = Field(..., description="代码浏览地址")
    download_url: str = Field(..., description="项目包下载地址")
    fork_template_id: Optional[str] = Field(None, description="关联的 fork 模板 ID")


class DemoCreate(DemoBase):
    """
    Demo 创建请求
    """
    pass


class DemoUpdate(BaseModel):
    """
    Demo 更新请求
    """
    name: Optional[str] = None
    description: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    difficulty: Optional[Literal['beginner', 'intermediate', 'advanced']] = None
    subjects: Optional[List[str]] = None
    grade_range: Optional[str] = None
    tags: Optional[List[str]] = None
    display_mode: Optional[Literal['iframe', 'static']] = None
    iframe_url: Optional[str] = None
    screenshots: Optional[List[str]] = None
    demo_video_url: Optional[str] = None
    project_breakdown: Optional[str] = None
    minimal_replica: Optional[str] = None
    code_url: Optional[str] = None
    download_url: Optional[str] = None
    fork_template_id: Optional[str] = None


class Demo(DemoBase, AuditFields, PublishFields):
    """
    完整 Demo 模型（数据库存储用）
    """
    id: str = Field(description="Demo ID")
    
    model_config = ConfigDict(from_attributes=True)


class DemoListQuery(BaseModel):
    """
    Demo 列表查询参数
    """
    subject: Optional[str] = Field(None, description="学科筛选")
    difficulty: Optional[Literal['beginner', 'intermediate', 'advanced']] = Field(None, description="难度筛选")
    tech_stack: Optional[str] = Field(None, description="技术栈关键词筛选")
    search: Optional[str] = Field(None, description="名称/描述关键词搜索")
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量")
