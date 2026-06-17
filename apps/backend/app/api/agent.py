"""
Agent API 路由

用途：统一 AI 助手对话入口（同步 / SSE / WebSocket）
维护者：AI Agent
"""

import json
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt

from app.api.auth import get_current_user, SECRET_KEY, ALGORITHM
from app.schemas.agent import AgentChatRequest, AgentChatResponse
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.services.feature_flags import feature_flag_service
from app.services.observability import agent_observability_service
from app.services.orchestrator import agent_orchestrator_service
from app.repositories.runtime_db import db

router = APIRouter(prefix="/agent", tags=["Agent"])
ANON_STREAM_LIMIT = 5
_anon_stream_usage: dict[str, int] = {}


def _verify_ws_token(token: str | None) -> str | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id:
            user = db.get_user(user_id)
            if user:
                return user_id
    except JWTError:
        pass
    return None


@router.post("/chat", response_model=ApiResponse[AgentChatResponse])
async def chat(
    req: AgentChatRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    try:
        response = await agent_orchestrator_service.chat(current_user.id, req)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent 编排失败: {exc}",
        ) from exc
    return ApiResponse(data=response, message="成功")


@router.get("/stream")
async def stream_chat(
    message: str = Query(..., min_length=1),
    project_id: str | None = Query(default=None),
    current_user: UserResponse = Depends(get_current_user),
):
    if not feature_flag_service.is_enabled("agent_stream", current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号未开通流式能力")

    async def event_generator() -> AsyncGenerator[str, None]:
        request = AgentChatRequest(message=message, project_id=project_id, stream=True)
        try:
            async for token in agent_orchestrator_service.stream_chat(current_user.id, request):
                token_payload = {"token": token}
                data = json.dumps(token_payload, ensure_ascii=False)
                yield f"event: token\ndata: {data}\n\n"
        except Exception as exc:
            error_payload = {"error": str(exc)}
            data = json.dumps(error_payload, ensure_ascii=False)
            yield f"event: error\ndata: {data}\n\n"
        yield f"event: final\ndata: {{\"status\": \"completed\"}}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.websocket("/ws")
async def ws_chat(websocket: WebSocket):
    token = websocket.query_params.get("token")
    authenticated_user_id = _verify_ws_token(token)
    if token and not authenticated_user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await websocket.accept()
    try:
        while True:
            incoming = await websocket.receive_json()
            message = incoming.get("message")
            if not message:
                await websocket.send_json({"event": "error", "message": "缺少 message"})
                continue

            if authenticated_user_id:
                user_id_str = authenticated_user_id
            else:
                user_id_str = incoming.get("user_id", f"anon-{id(websocket)}")
                if user_id_str.startswith("anon-") or user_id_str.startswith("anonymous:"):
                    usage = _anon_stream_usage.get(user_id_str, 0)
                    if usage >= ANON_STREAM_LIMIT:
                        await websocket.send_json(
                            {
                                "event": "error",
                                "message": f"匿名用户最多提问 {ANON_STREAM_LIMIT} 次，请先轻注册或登录。",
                            }
                        )
                        continue
                    _anon_stream_usage[user_id_str] = usage + 1
            if not feature_flag_service.is_enabled("agent_ws", user_id_str):
                await websocket.send_json({"event": "error", "message": "当前账号未开通 WebSocket 能力"})
                continue
            request = AgentChatRequest(
                message=message,
                messages=incoming.get("messages", []),
                context=incoming.get("context", {}),
                project_id=incoming.get("project_id"),
                session_id=incoming.get("session_id"),
                skill_id=incoming.get("skill_id"),
                stream=True,
                enable_tools=True,
            )
            try:
                async for event_type, event_data in agent_orchestrator_service.stream_chat_with_events(user_id_str, request):
                    await websocket.send_json({
                        "event": event_type,
                        "data": event_data,
                    })
            except Exception as exc:
                await websocket.send_json(
                    {"event": "error", "message": f"流式对话失败: {exc}"}
                )
    except WebSocketDisconnect:
        return


@router.get("/metrics", response_model=ApiResponse[dict])
async def metrics(current_user: UserResponse = Depends(get_current_user)):
    return ApiResponse(data=agent_observability_service.snapshot(), message=f"获取成功: {current_user.id}")


@router.get("/feature-flags", response_model=ApiResponse[dict])
async def feature_flags(current_user: UserResponse = Depends(get_current_user)):
    return ApiResponse(data=feature_flag_service.snapshot(), message=f"获取成功: {current_user.id}")
