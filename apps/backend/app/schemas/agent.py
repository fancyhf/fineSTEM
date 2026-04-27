"""
Agent 编排数据模型

用途：定义 Agent 对话请求、事件和响应结构
维护者：AI Agent
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


AgentRole = Literal["system", "user", "assistant", "tool"]
AgentEventType = Literal["token", "tool_start", "tool_end", "final", "error"]


class AgentMessage(BaseModel):
    role: AgentRole
    content: str = Field(..., min_length=1)


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    messages: List[AgentMessage] = Field(default_factory=list)
    context: Dict[str, Any] = Field(default_factory=dict)
    project_id: Optional[str] = None
    session_id: Optional[str] = None
    enable_tools: bool = True
    stream: bool = False


class AgentToolTrace(BaseModel):
    tool_name: str
    status: Literal["success", "failed"]
    summary: str
    duration_ms: int


class AgentChatResponse(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str
    trace_id: str
    session_id: str
    used_tools: List[AgentToolTrace] = Field(default_factory=list)
    model: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AgentStreamEvent(BaseModel):
    event: AgentEventType
    trace_id: str
    session_id: str
    data: Dict[str, Any] = Field(default_factory=dict)
