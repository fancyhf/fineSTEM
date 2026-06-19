"""
用户认证数据模型

用途：用户认证、注册、登录相关的数据定义
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal
from datetime import datetime
from .common import AuditFields


class UserBase(BaseModel):
    """
    用户基础字段
    """
    name: str = Field(..., description="用户昵称")
    email: str = Field(..., description="邮箱")
    role: Literal['student'] = Field(default='student', description="角色")
    level: int = Field(default=1, ge=1, le=5, description="用户等级")
    capability_tags: Optional[list[str]] = Field(default_factory=list, description="能力标签")


class UserCreate(UserBase):
    """
    用户注册请求
    """
    password: str = Field(..., min_length=6, description="密码")


class UserLogin(BaseModel):
    """
    用户登录请求
    """
    email: str = Field(..., description="邮箱")
    password: str = Field(..., description="密码")


class ChangePasswordRequest(BaseModel):
    """
    修改密码请求
    """
    current_password: str = Field(..., min_length=6, description="当前密码")
    new_password: str = Field(..., min_length=6, description="新密码")


class UserUpdate(BaseModel):
    """
    用户信息更新请求
    """
    name: Optional[str] = None
    capability_tags: Optional[list[str]] = None


class User(UserBase, AuditFields):
    """
    完整用户模型（数据库存储用）
    """
    id: str = Field(..., description="用户 ID")
    password: str = Field(..., description="加密后的密码")


class UserResponse(UserBase):
    """
    用户响应模型（API 返回用）
    """
    id: str = Field(..., description="用户 ID")
    created_at: datetime = Field(..., description="创建时间")


class AuthResponse(BaseModel):
    """
    认证响应模型（登录/注册后返回）
    """
    user: UserResponse = Field(..., description="用户信息")
    access_token: str = Field(..., description="JWT 访问令牌")
    token_type: str = Field(default="bearer", description="令牌类型")
