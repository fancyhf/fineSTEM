"""
AI 助手对话模块 API
"""

from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.repositories.runtime_db import db
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.schemas.counseling import (
    AssistantDialogueChatRequest,
    AssistantDialogueChatResponse,
    AssistantDialogueMessage,
    AssistantDialogueSession,
)
from app.schemas.agent import AgentChatRequest
from app.services.audit_logger import audit_logger_service
from app.services.orchestrator import agent_orchestrator_service

router = APIRouter(prefix="/assistant-dialogues", tags=["AI助手对话"])


@router.get("/sessions", response_model=ApiResponse[list[AssistantDialogueSession]])
async def list_sessions(current_user: UserResponse = Depends(get_current_user)):
    return ApiResponse(data=db.list_dialogue_sessions(current_user.id), message="获取成功")


@router.post("/sessions", response_model=ApiResponse[AssistantDialogueSession])
async def create_session(title: str = "新会话", current_user: UserResponse = Depends(get_current_user)):
    session = AssistantDialogueSession(id=str(uuid.uuid4()), owner_id=current_user.id, title=title)
    created = db.create_dialogue_session(session)
    audit_logger_service.record(current_user.id, "assistant_dialogues", "create_session", created.id, {"title": created.title})
    return ApiResponse(data=created, message="创建成功")


@router.get("/sessions/{session_id}/messages", response_model=ApiResponse[list[AssistantDialogueMessage]])
async def list_messages(session_id: str, current_user: UserResponse = Depends(get_current_user)):
    session = db.get_dialogue_session(session_id)
    if not session or session.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")
    return ApiResponse(data=db.list_dialogue_messages(session_id), message="获取成功")


@router.post("/chat", response_model=ApiResponse[AssistantDialogueChatResponse])
async def chat(payload: AssistantDialogueChatRequest, current_user: UserResponse = Depends(get_current_user)):
    session = db.get_dialogue_session(payload.session_id) if payload.session_id else None
    if session and session.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问会话")
    if not session:
        session = db.create_dialogue_session(
            AssistantDialogueSession(
                id=str(uuid.uuid4()),
                owner_id=current_user.id,
                title=payload.message[:20] or "新会话",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )

    user_message = db.create_dialogue_message(
        AssistantDialogueMessage(
            id=str(uuid.uuid4()),
            session_id=session.id,
            role="user",
            content=payload.message,
            created_at=datetime.utcnow(),
        )
    )
    result = await agent_orchestrator_service.chat(
        current_user.id,
        AgentChatRequest(
            message=payload.message,
            project_id=payload.project_id,
            session_id=session.id,
            enable_tools=payload.enable_tools,
        ),
    )
    assistant_message = db.create_dialogue_message(
        AssistantDialogueMessage(
            id=str(uuid.uuid4()),
            session_id=session.id,
            role="assistant",
            content=result.content,
            created_at=datetime.utcnow(),
        )
    )
    db.touch_dialogue_session(session.id)
    audit_logger_service.record(current_user.id, "assistant_dialogues", "chat", session.id, {"trace_id": result.trace_id})
    return ApiResponse(
        data=AssistantDialogueChatResponse(
            session=session,
            user_message=user_message,
            assistant_message=assistant_message,
            trace_id=result.trace_id,
            model=result.model,
        ),
        message="成功",
    )
