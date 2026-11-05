"""
研学文档数据模型

用途：开题/技术/结题文档生成与导出
维护者：AI Agent
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


DocumentType = Literal["proposal", "technical", "final"]
DocumentFormat = Literal["md", "json", "pdf", "docx"]


class DocumentGenerateRequest(BaseModel):
    document_type: DocumentType
    format: DocumentFormat = "md"


class DocumentArtifact(BaseModel):
    project_id: str
    document_type: DocumentType
    format: DocumentFormat
    file_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PublicProjectDocument(BaseModel):
    """公开成果卡关联项目的过程文档，响应中不包含项目或作者信息。"""

    stage: str
    name: str
    filename: str
    has_content: bool
    summary: str
    content: str
    content_length: int
