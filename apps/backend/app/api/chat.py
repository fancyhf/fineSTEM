"""
AI 对话兼容 API 路由

用途：兼容旧客户端，将请求转发到 Agent 编排层
维护者：AI Agent
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from app.api.auth import get_optional_current_user
from app.schemas.agent import AgentChatRequest
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.services.orchestrator import agent_orchestrator_service
from app.services.question_verifier import verify_question_payload

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


# ===== Q-003 修复（2026-07-27）：问题卡片二次确认 =====

class VerifyQuestionOption(BaseModel):
    label: str = Field(..., description="选项标签")
    description: Optional[str] = Field(None, description="选项描述")


class VerifyQuestionRequest(BaseModel):
    title: str = Field(..., description="候选卡片标题")
    options: List[VerifyQuestionOption] = Field(..., description="候选项数组")


class VerifyQuestionResponse(BaseModel):
    is_real_question: bool = Field(..., description="是否是真实问题（true=应渲染，false=应拒绝）")
    reason: str = Field(..., description="判断原因（拒绝时给出理由）")


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


@router.post("/verify-question", response_model=ApiResponse[VerifyQuestionResponse])
async def verify_question(
    req: VerifyQuestionRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_current_user),
):
    """
    问题卡片二次确认（Q-003 修复）。

    前端文本兜底解析出候选问题卡片后，调用本接口做权威二次判断，
    拦截被误识别的功能介绍/状态汇报/列举清单。

    纯规则判断（无 LLM），延迟 <10ms。鉴权与 /chat/completions 一致（支持匿名）。
    """
    # Pydantic 已校验 title/options 结构，直接转 dict 给判断函数
    payload = {
        "title": req.title,
        "options": [opt.model_dump() for opt in req.options],
    }
    result = verify_question_payload(payload)
    return ApiResponse(
        data=VerifyQuestionResponse(
            is_real_question=result["is_real_question"],
            reason=result["reason"],
        ),
        message="确认完成",
    )
