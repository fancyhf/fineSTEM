"""
copy_guidance_state 服务测试（MVP2 P0-09）。

覆盖：
- init_copy_guidance 默认值与自定义值
- get_copy_guidance：str/dict metadata 兼容、缺失返回 None
- update_copy_guidance：合法流转、非法流转抛错、current_task 更新
- API 端点：POST /projects/{id}/copy-guidance 状态流转、404/400/403
"""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.services.copy_guidance_state import (
    CopyGuidanceStateError,
    COPY_GUIDANCE_VERSION,
    get_copy_guidance,
    init_copy_guidance,
    update_copy_guidance,
)


class _FakeState:
    def __init__(self, metadata):
        self.metadata = metadata


class TestInitCopyGuidance:
    def test_default_values(self):
        node = init_copy_guidance()
        assert node["version"] == COPY_GUIDANCE_VERSION
        assert node["intro_status"] == "pending"
        assert node["session_status"] == "idle"
        assert node["current_task"] is None
        assert node["started_at"]
        assert node["updated_at"]

    def test_custom_values(self):
        node = init_copy_guidance(
            intro_status="started",
            session_status="active",
            current_task={"id": "replace_first_card"},
        )
        assert node["intro_status"] == "started"
        assert node["session_status"] == "active"
        assert node["current_task"] == {"id": "replace_first_card"}

    def test_invalid_intro_status(self):
        with pytest.raises(CopyGuidanceStateError):
            init_copy_guidance(intro_status="bogus")

    def test_invalid_session_status(self):
        with pytest.raises(CopyGuidanceStateError):
            init_copy_guidance(session_status="bogus")


class TestGetCopyGuidance:
    def test_returns_none_when_metadata_missing(self):
        assert get_copy_guidance(None) is None
        assert get_copy_guidance(_FakeState({})) is None
        assert get_copy_guidance(_FakeState({"other": 1})) is None

    def test_reads_dict_metadata(self):
        node = init_copy_guidance()
        state = _FakeState({"copy_guidance": node})
        assert get_copy_guidance(state) == node

    def test_reads_string_metadata(self):
        node = init_copy_guidance()
        raw = json.dumps({"copy_guidance": node})
        state = _FakeState(raw)
        assert get_copy_guidance(state) == node

    def test_reads_broken_string_metadata(self):
        state = _FakeState("not-json")
        assert get_copy_guidance(state) is None


class TestUpdateCopyGuidance:
    def _state(self, intro_status="pending", session_status="idle", current_task=None):
        node = init_copy_guidance(intro_status=intro_status, session_status=session_status, current_task=current_task)
        return _FakeState({"copy_guidance": node})

    def test_intro_pending_to_started(self):
        state = self._state()
        updated = update_copy_guidance(state, {"intro_status": "started"})
        assert updated["intro_status"] == "started"

    def test_intro_pending_to_dismissed(self):
        state = self._state()
        updated = update_copy_guidance(state, {"intro_status": "dismissed"})
        assert updated["intro_status"] == "dismissed"

    def test_intro_started_cannot_go_back(self):
        state = self._state(intro_status="started")
        with pytest.raises(CopyGuidanceStateError):
            update_copy_guidance(state, {"intro_status": "pending"})

    def test_intro_dismissed_cannot_become_started(self):
        state = self._state(intro_status="dismissed")
        with pytest.raises(CopyGuidanceStateError):
            update_copy_guidance(state, {"intro_status": "started"})

    def test_session_idle_to_active(self):
        state = self._state()
        updated = update_copy_guidance(state, {"session_status": "active"})
        assert updated["session_status"] == "active"

    def test_session_active_to_waiting_verify(self):
        state = self._state(session_status="active")
        updated = update_copy_guidance(state, {"session_status": "waiting_verify"})
        assert updated["session_status"] == "waiting_verify"

    def test_session_idle_cannot_jump_to_completed(self):
        state = self._state()
        with pytest.raises(CopyGuidanceStateError):
            update_copy_guidance(state, {"session_status": "completed"})

    def test_current_task_update(self):
        state = self._state(session_status="active")
        updated = update_copy_guidance(
            state, {"current_task": {"id": "add_card_data", "title": "增加一条卡片"}}
        )
        assert updated["current_task"]["id"] == "add_card_data"

    def test_empty_patch_raises(self):
        state = self._state()
        with pytest.raises(CopyGuidanceStateError):
            update_copy_guidance(state, {})

    def test_bootstraps_when_no_existing_node(self):
        state = _FakeState({})
        updated = update_copy_guidance(state, {"intro_status": "started"})
        assert updated["intro_status"] == "started"
        assert updated["version"] == COPY_GUIDANCE_VERSION


class TestCopyGuidanceApi:
    """POST /projects/{id}/copy-guidance 端点集成测试。"""

    def _create_demo_project(self, client: TestClient, auth_headers: dict, demo_id: str) -> str:
        resp = client.post(
            "/api/v1/projects",
            json={"name": "复制项目引导测试", "mode": "light", "from_demo_id": demo_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        return resp.json()["data"]["id"]

    def test_create_from_demo_initializes_copy_guidance(
        self, client: TestClient, auth_headers: dict, seeded_demo_id: str
    ):
        pid = self._create_demo_project(client, auth_headers, seeded_demo_id)
        resp = client.get(f"/api/v1/projects/{pid}/workspace", headers=auth_headers)
        assert resp.status_code == 200
        progress = resp.json()["data"]["progress"]
        cg = progress.get("copy_guidance")
        assert cg is not None
        assert cg["intro_status"] == "pending"
        assert cg["session_status"] == "idle"

    def test_self_created_project_has_no_copy_guidance(
        self, client: TestClient, auth_headers: dict
    ):
        resp = client.post(
            "/api/v1/projects",
            json={"name": "自建项目", "mode": "light"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        pid = resp.json()["data"]["id"]
        wr = client.get(f"/api/v1/projects/{pid}/workspace", headers=auth_headers)
        assert wr.status_code == 200
        assert wr.json()["data"]["progress"]["copy_guidance"] is None

    def test_update_intro_status_pending_to_started(
        self, client: TestClient, auth_headers: dict, seeded_demo_id: str
    ):
        pid = self._create_demo_project(client, auth_headers, seeded_demo_id)
        resp = client.post(
            f"/api/v1/projects/{pid}/copy-guidance",
            json={"intro_status": "started"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["copy_guidance"]["intro_status"] == "started"

    def test_illegal_transition_returns_400(
        self, client: TestClient, auth_headers: dict, seeded_demo_id: str
    ):
        pid = self._create_demo_project(client, auth_headers, seeded_demo_id)
        # 先推进到 started
        r1 = client.post(
            f"/api/v1/projects/{pid}/copy-guidance",
            json={"intro_status": "started"},
            headers=auth_headers,
        )
        assert r1.status_code == 200
        # 再尝试回退到 pending
        r2 = client.post(
            f"/api/v1/projects/{pid}/copy-guidance",
            json={"intro_status": "pending"},
            headers=auth_headers,
        )
        assert r2.status_code == 400

    def test_non_demo_project_rejected(
        self, client: TestClient, auth_headers: dict
    ):
        resp = client.post(
            "/api/v1/projects",
            json={"name": "自建项目", "mode": "light"},
            headers=auth_headers,
        )
        pid = resp.json()["data"]["id"]
        rr = client.post(
            f"/api/v1/projects/{pid}/copy-guidance",
            json={"intro_status": "started"},
            headers=auth_headers,
        )
        assert rr.status_code == 400

    def test_not_found_returns_404(self, client: TestClient, auth_headers: dict):
        rr = client.post(
            "/api/v1/projects/nonexistent/copy-guidance",
            json={"intro_status": "started"},
            headers=auth_headers,
        )
        assert rr.status_code == 404

    def test_forbidden_for_other_user(
        self,
        client: TestClient,
        auth_headers: dict,
        second_auth_headers: dict,
        seeded_demo_id: str,
    ):
        pid = self._create_demo_project(client, auth_headers, seeded_demo_id)
        rr = client.post(
            f"/api/v1/projects/{pid}/copy-guidance",
            json={"intro_status": "started"},
            headers=second_auth_headers,
        )
        assert rr.status_code == 403
