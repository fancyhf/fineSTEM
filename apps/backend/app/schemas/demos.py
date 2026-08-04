"""
Demo 项目数据模型

用途：Demo 项目展示、列表、详情的数据定义
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Literal, Dict, Any
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
    explanation_doc: Optional[str] = Field(None, description="讲解文档（Markdown，原理/设计/关键代码拆解）")
    minimal_replica: Optional[str] = Field(None, description="最小可复刻代码路径")
    code_url: str = Field(..., description="代码浏览地址")
    download_url: str = Field(..., description="项目包下载地址")
    fork_template_id: Optional[str] = Field(None, description="关联的 fork 模板 ID")
    # 2026-08-03：收录来源项目（admin 把合格 project 收录为 demo 时写入），种子数据为空
    source_project_id: Optional[str] = Field(None, description="收录来源项目 ID（admin 收录时写入）")


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
    explanation_doc: Optional[str] = None
    # minimal_replica 接受 dict 或 str（JSON）；repo 层 json_dumps 统一编码存储
    minimal_replica: Optional[Any] = None
    code_url: Optional[str] = None
    download_url: Optional[str] = None
    fork_template_id: Optional[str] = None
    source_project_id: Optional[str] = None


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
    is_public: Optional[bool] = Field(None, description="公开状态过滤：None 默认仅返回已公开；False 仅返回未公开（管理用途）")
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量")


class DemoCreateFromProject(BaseModel):
    """
    把项目收录为 Demo 的请求（admin 提交 demo 独有字段）。

    name / description / screenshots 由后端从 project + 成果卡自动映射，
    其余 demo 独有字段由 admin 在收录表单中填写。所有"必填"字段用空串兜底默认值，
    避免与后端二次校验冲突——后端会校验非空。
    """
    # 必填（admin 提供）
    difficulty: Literal['beginner', 'intermediate', 'advanced'] = Field(
        default='beginner', description="难度"
    )
    subjects: List[str] = Field(default_factory=list, description="学科标签")
    grade_range: str = Field(default="13-15岁", description="适用年级")
    code_url: str = Field(default="", description="代码浏览地址")
    download_url: str = Field(default="", description="项目包下载地址")
    # 选填（admin 提供）
    tech_stack: List[str] = Field(default_factory=list, description="技术栈标签")
    tags: List[str] = Field(default_factory=list, description="通用标签")
    display_mode: Literal['iframe', 'static'] = Field(default='static', description="展示模式")
    iframe_url: Optional[str] = Field(default=None, description="iframe 嵌入地址")
    demo_video_url: Optional[str] = Field(default=None, description="关键流程录屏")
    project_breakdown: Optional[str] = Field(default=None, description="项目拆解说明（Markdown）")
    explanation_doc: Optional[str] = Field(default=None, description="讲解文档（Markdown）")
    minimal_replica: Optional[Dict[str, Any]] = Field(None, description="最小可复刻代码（{entry_file, files}）")
    is_public: bool = Field(default=True, description="是否公开（收录后默认公开上首页）")


class DemoPublicToggle(BaseModel):
    """
    Demo 上下架请求
    """
    is_public: bool = Field(..., description="是否公开（上架/下架）")

