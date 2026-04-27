"""
课程库与能力标签数据模型

用途：课程资源管理与项目能力标签推荐
维护者：AI Agent
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CourseBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    summary: str = Field(default="")
    subject: str = Field(default="")
    difficulty: Literal["beginner", "intermediate", "advanced"] = "beginner"
    tags: list[str] = Field(default_factory=list)
    resource_url: str = Field(default="")


class CourseCreate(CourseBase):
    pass


class Course(CourseBase):
    id: str
    owner_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CapabilityTagSuggestion(BaseModel):
    project_id: str
    tags: list[str] = Field(default_factory=list)
    reason: str = Field(default="")


class CapabilityTagApplyRequest(BaseModel):
    tags: list[str] = Field(default_factory=list)
