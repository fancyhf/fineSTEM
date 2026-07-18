"""
通用数据模型基类

用途：提供 API 统一响应格式、审计字段、发布字段
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from pydantic import BaseModel, Field
from typing import Generic, TypeVar, Optional
from datetime import datetime
from app.core.time_utils import utc_now

T = TypeVar('T')


class ApiResponse(BaseModel, Generic[T]):
    """
    API 统一响应格式

    所有 API 响应都使用此格式
    """
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    errors: Optional[dict[str, list[str]]] = None


class AuditFields(BaseModel):
    """
    审计字段基类

    所有核心数据模型都继承此类
    时间格式统一使用 MCP 格式：YYYY-MM-DD HH:MM:SS.fff
    """
    created_at: datetime = Field(default_factory=utc_now)
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=utc_now)
    updated_by: Optional[str] = None
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    is_deleted: bool = False


class PublishFields(BaseModel):
    """
    公开发布字段基类

    用于需要申请公开到灵感墙的内容（如成果档案卡）
    """
    is_public: bool = False
    submitted_at: Optional[datetime] = None


class FeatureFields(BaseModel):
    """
    精选字段基类

    用于管理员标记的首页精选内容（如成果档案卡）
    """
    is_featured: bool = False
    featured_sort_order: int = 0
    featured_at: Optional[datetime] = None


class PaginationParams(BaseModel):
    """
    分页查询参数
    """
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量")


class PaginationResult(BaseModel, Generic[T]):
    """
    分页结果
    """
    items: list[T] = Field(description="数据列表")
    total: int = Field(description="总数")
    page: int = Field(description="当前页")
    page_size: int = Field(description="每页数量")
    total_pages: int = Field(description="总页数")
