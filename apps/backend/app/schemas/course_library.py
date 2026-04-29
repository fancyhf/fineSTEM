"""
课程库数据模型

用途：课程资源管理
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import AuditFields


class Course(BaseModel):
    id: Optional[str] = None
    owner_id: Optional[str] = None
    title: str
    summary: str = ""
    subject: str = ""
    difficulty: str = "beginner"
    tags: list[str] = Field(default_factory=list)
    resource_url: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CourseCreate(BaseModel):
    title: str
    summary: str = ""
    subject: str = ""
    difficulty: str = "beginner"
    tags: list[str] = Field(default_factory=list)
    resource_url: str = ""


CourseCreateRequest = CourseCreate
