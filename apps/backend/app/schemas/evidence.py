"""
证据数据模型

用途：项目证据的上传、管理、查看
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Literal
from app.core.text_encoding import ensure_utf8_text
from .common import AuditFields


class EvidenceTextValidation(BaseModel):
    """对所有证据写入 DTO 的文本字段执行相同的 UTF-8 校验。"""

    @field_validator("title", "content", "content_url", "related_step", check_fields=False)
    @classmethod
    def validate_utf8(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return ensure_utf8_text(value, "证据文本")


class EvidenceBase(EvidenceTextValidation):
    """
    证据基础字段
    """
    type: Literal[
        'code_snapshot', 'video_record', 'screenshot', 'text_log', 'file_upload',
        'auto_stage_change', 'auto_ai_summary'
    ] = Field(..., description="证据类型")
    title: str = Field(default="", description="证据标题")
    content: str = Field(..., description="证据内容")
    content_url: Optional[str] = Field(None, description="内容链接")
    related_step: Optional[str] = Field(None, description="关联步骤")


class EvidenceCreate(EvidenceTextValidation):
    """
    证据创建请求
    """
    project_id: str
    type: Literal[
        'code_snapshot', 'video_record', 'screenshot', 'text_log', 'file_upload',
        'auto_stage_change', 'auto_ai_summary'
    ]
    title: str = ""
    content: str
    content_url: Optional[str] = None
    related_step: Optional[str] = None


class EvidenceUpdate(EvidenceTextValidation):
    """
    证据更新请求
    """
    type: Optional[Literal[
        'code_snapshot', 'video_record', 'screenshot', 'text_log', 'file_upload',
        'auto_stage_change', 'auto_ai_summary'
    ]] = None
    title: Optional[str] = None
    content: Optional[str] = None
    content_url: Optional[str] = None
    related_step: Optional[str] = None


class AutoEvidenceCollectRequest(EvidenceTextValidation):
    """
    自动证据采集请求
    """
    type: Literal['auto_stage_change', 'auto_ai_summary']
    content: str = Field(..., min_length=1, description="自动采集内容")
    related_step: Optional[str] = Field(None, description="关联步骤")
    source: Literal['system', 'agent', 'stage_engine'] = Field(default='system', description="证据来源")


class Evidence(EvidenceBase, AuditFields):
    """
    完整证据模型（数据库存储用）
    """
    id: str = Field(default="", description="证据 ID")
    project_id: str = Field(..., description="所属项目 ID")
    author_id: str = Field(..., description="作者 ID")
    
    model_config = ConfigDict(from_attributes=True)
