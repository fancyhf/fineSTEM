"""
AI 对话兼容 API 路由

用途：兼容旧客户端，将请求转发到 Agent 编排层
维护者：AI Agent
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field
from app.api.auth import get_optional_current_user
from app.schemas.agent import AgentChatRequest
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.services.orchestrator import agent_orchestrator_service
from app.services.providers.image_provider import describe_chat_image
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


# ===== 2026-07-30 聊天发图：截图/图片 → GLM-4V 视觉识别 → 文字描述 =====

_ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB


class DescribeImageResponse(BaseModel):
    description: str = Field(..., description="图片的文字描述（代码/报错会被逐字转录）")


@router.post("/describe-image", response_model=ApiResponse[DescribeImageResponse])
async def describe_image(
    file: UploadFile = File(...),
    current_user: Optional[UserResponse] = Depends(get_optional_current_user),
):
    """
    识别学生在聊天框发送的截图/图片。

    主对话模型（DeepSeek）不支持视觉，前端先调本接口用 GLM-4V 把图片
    转成文字描述（报错/代码逐字转录），再把描述拼进发给 AI 的消息。
    鉴权与 /chat/completions 一致（支持匿名）。
    """
    content_type = (file.content_type or "").lower()
    if content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的图片格式: {content_type or '未知'}，仅支持 png/jpeg/webp/gif",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="图片内容为空")
    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="图片超过 5MB，请压缩后重试",
        )

    description = await describe_chat_image(image_bytes, content_type)
    if not description:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="图片识别服务暂不可用，请稍后重试或直接用文字描述问题",
        )

    return ApiResponse(
        data=DescribeImageResponse(description=description),
        message="识别成功",
    )
