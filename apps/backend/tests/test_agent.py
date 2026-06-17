"""
Agent 路由自动化测试

用途：验证 Agent WebSocket 通道会把教学模式上下文正确传到后端，并返回对应流式事件
维护者：AI Agent
links: .trae/documents/testing/
"""

from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient


class _FakeOrchestrator:
    async def stream_chat_with_events(self, owner_id: str, req):
        mode = (req.context or {}).get("teaching_mode", "guided")
        token_map = {
            "guided": "下一步你先补输入框的提交处理。",
            "demo": "下面先给你一个完整可运行示例。",
            "hands_on": "请你先自己尝试完成表头。",
            "lecture": "先讲清原理，再看代码结构。",
        }
        yield ("skill_activated", {
            "skill_id": "stem-pbl-guide",
            "skill_name": "STEM项目式学习导师",
            "sub_skill_id": "stage_07_execute",
            "sub_skill_name": "设计开发",
        })
        yield ("stage_changed", {"stage": "stage_07_execute", "stage_name": "设计开发"})
        yield ("token", {"token": token_map[mode]})
        yield ("final", {"status": "completed", "content": token_map[mode], "session_id": "test-session"})


class TestAgentWebSocketTeachingMode:
    @pytest.mark.parametrize(
        ("teaching_mode", "expected_keyword"),
        [
            ("guided", "下一步你先补"),
            ("demo", "完整可运行示例"),
            ("hands_on", "先自己尝试完成"),
            ("lecture", "先讲清原理"),
        ],
    )
    def test_ws_chat_returns_mode_specific_tokens(
        self,
        client: TestClient,
        registered_user: dict,
        monkeypatch: pytest.MonkeyPatch,
        teaching_mode: str,
        expected_keyword: str,
    ):
        from app.api import agent as agent_api_mod

        monkeypatch.setattr(agent_api_mod, "agent_orchestrator_service", _FakeOrchestrator())
        monkeypatch.setattr(
            agent_api_mod.feature_flag_service,
            "is_enabled",
            lambda feature_name, owner_id: feature_name == "agent_ws",
        )

        ws_url = f"/api/v1/agent/ws?token={quote(registered_user['token'])}"
        with client.websocket_connect(ws_url) as websocket:
            websocket.send_json({
                "message": "继续教我完成这个网页项目",
                "context": {
                    "current_stage": "stage_07_execute",
                    "teaching_mode": teaching_mode,
                    "preferred_output_language": "html",
                },
                "messages": [],
                "project_id": None,
                "session_id": "frontend-session",
                "skill_id": "stem-pbl-guide",
                "enable_tools": True,
            })

            received_events: list[dict] = []
            while True:
                event = websocket.receive_json()
                received_events.append(event)
                if event.get("event") == "final":
                    break

        event_types = [item["event"] for item in received_events]
        assert "skill_activated" in event_types
        assert "stage_changed" in event_types
        assert "token" in event_types
        assert event_types[-1] == "final"

        token_event = next(item for item in received_events if item["event"] == "token")
        assert expected_keyword in token_event["data"]["token"]

        final_event = received_events[-1]
        assert final_event["data"]["status"] == "completed"
        assert final_event["data"]["session_id"] == "test-session"
