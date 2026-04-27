"""
AI 对话兼容 API 路由

用途：兼容旧客户端，将请求转发到 Agent 编排层
维护者：AI Agent
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from app.api.auth import get_optional_current_user
from app.schemas.agent import AgentChatRequest
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.services.orchestrator import agent_orchestrator_service

router = APIRouter(prefix="/chat", tags=["AI 对话"])
ANON_CHAT_LIMIT = 5
_anon_chat_usage: dict[str, int] = {}


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    context: Optional[Dict[str, Any]] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatResponse(BaseModel):
    message: ChatMessage


@router.post("/completions", response_model=ApiResponse[ChatResponse])
async def chat_completions(
    req: ChatRequest,
    request: Request,
    current_user: Optional[UserResponse] = Depends(get_optional_current_user),
):
    if current_user is None:
        client_host = request.client.host if request.client else "anonymous"
        usage = _anon_chat_usage.get(client_host, 0)
        if usage >= ANON_CHAT_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"未登录用户每日最多提问 {ANON_CHAT_LIMIT} 次，请注册后继续。",
            )
        _anon_chat_usage[client_host] = usage + 1
        user_id = f"anonymous:{client_host}"
    else:
        user_id = current_user.id

    result = await agent_orchestrator_service.chat(
        user_id,
        AgentChatRequest(
            message=req.message,
            context=req.context or {},
            enable_tools=True,
            stream=False,
        ),
    )

    return ApiResponse(
        data=ChatResponse(message=ChatMessage(role="assistant", content=result.content)),
        message="对话成功",
    )
