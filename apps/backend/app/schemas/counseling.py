"""
升学与辅导模块数据模型

用途：港澳升学、国际升学、背景提升、知识来源、问卷引擎、AI 助手对话、审计日志
维护者：AI Agent
"""

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from .common import AuditFields


class HongKongMacaoPlanBase(BaseModel):
    student_name: str = Field(..., min_length=1, max_length=100)
    grade: str = Field(..., min_length=1, max_length=50)
    target_track: Literal["hk", "macao", "both"] = "both"
    timeline: str = Field(default="")
    requirement_summary: str = Field(default="")
    status: Literal["draft", "active", "completed"] = "draft"


class HongKongMacaoPlanCreate(HongKongMacaoPlanBase):
    pass


class HongKongMacaoPlanUpdate(BaseModel):
    student_name: Optional[str] = None
    grade: Optional[str] = None
    target_track: Optional[Literal["hk", "macao", "both"]] = None
    timeline: Optional[str] = None
    requirement_summary: Optional[str] = None
    status: Optional[Literal["draft", "active", "completed"]] = None


class HongKongMacaoPlan(HongKongMacaoPlanBase, AuditFields):
    id: str
    owner_id: str


class InternationalPlanBase(BaseModel):
    student_name: str = Field(..., min_length=1, max_length=100)
    grade: str = Field(..., min_length=1, max_length=50)
    target_country: str = Field(..., min_length=1, max_length=100)
    target_school_level: str = Field(default="undergraduate")
    timeline: str = Field(default="")
    requirement_summary: str = Field(default="")
    status: Literal["draft", "active", "completed"] = "draft"


class InternationalPlanCreate(InternationalPlanBase):
    pass


class InternationalPlanUpdate(BaseModel):
    student_name: Optional[str] = None
    grade: Optional[str] = None
    target_country: Optional[str] = None
    target_school_level: Optional[str] = None
    timeline: Optional[str] = None
    requirement_summary: Optional[str] = None
    status: Optional[Literal["draft", "active", "completed"]] = None


class InternationalPlan(InternationalPlanBase, AuditFields):
    id: str
    owner_id: str


class ProfileEnhancementPlanBase(BaseModel):
    student_name: str = Field(..., min_length=1, max_length=100)
    objective: str = Field(..., min_length=1, max_length=300)
    activities: List[str] = Field(default_factory=list)
    evidence_targets: List[str] = Field(default_factory=list)
    status: Literal["draft", "active", "completed"] = "draft"


class ProfileEnhancementPlanCreate(ProfileEnhancementPlanBase):
    pass


class ProfileEnhancementPlanUpdate(BaseModel):
    student_name: Optional[str] = None
    objective: Optional[str] = None
    activities: Optional[List[str]] = None
    evidence_targets: Optional[List[str]] = None
    status: Optional[Literal["draft", "active", "completed"]] = None


class ProfileEnhancementPlan(ProfileEnhancementPlanBase, AuditFields):
    id: str
    owner_id: str


class KnowledgeSourceBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    source_type: Literal["article", "official", "report", "video", "other"] = "article"
    url: str = Field(default="")
    summary: str = Field(default="")
    tags: List[str] = Field(default_factory=list)
    reliability_score: int = Field(default=70, ge=0, le=100)


class KnowledgeSourceCreate(KnowledgeSourceBase):
    pass


class KnowledgeSourceUpdate(BaseModel):
    title: Optional[str] = None
    source_type: Optional[Literal["article", "official", "report", "video", "other"]] = None
    url: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None
    reliability_score: Optional[int] = Field(default=None, ge=0, le=100)


class KnowledgeSource(KnowledgeSourceBase, AuditFields):
    id: str
    owner_id: str


class QuestionnaireQuestion(BaseModel):
    id: str
    text: str
    question_type: Literal["single_choice", "multi_choice", "text"] = "text"
    required: bool = True
    options: List[str] = Field(default_factory=list)


class QuestionnaireTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="")
    questions: List[QuestionnaireQuestion] = Field(default_factory=list)


class QuestionnaireTemplateCreate(QuestionnaireTemplateBase):
    pass


class QuestionnaireTemplate(QuestionnaireTemplateBase, AuditFields):
    id: str
    owner_id: str


class QuestionnaireResponseCreate(BaseModel):
    template_id: str
    respondent_name: str
    answers: Dict[str, str | List[str]]


class QuestionnaireResponse(BaseModel):
    id: str
    template_id: str
    respondent_name: str
    answers: Dict[str, str | List[str]]
    completion_rate: float
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AssistantDialogueSession(BaseModel):
    id: str
    owner_id: str
    title: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AssistantDialogueMessage(BaseModel):
    id: str
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AssistantDialogueChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    project_id: Optional[str] = None
    enable_tools: bool = True


class AssistantDialogueChatResponse(BaseModel):
    session: AssistantDialogueSession
    user_message: AssistantDialogueMessage
    assistant_message: AssistantDialogueMessage
    trace_id: str
    model: Optional[str] = None


class AuditLogItem(BaseModel):
    id: str
    owner_id: str
    module: str
    action: str
    resource_id: str
    detail: Dict[str, str] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
