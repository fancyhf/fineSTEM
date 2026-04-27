"""
证据模块 API 集成测试

用途：证据创建/列表/更新/自动采集/截图上传
维护者：AI Agent
links: .trae/documents/testing/
"""

import io

from fastapi.testclient import TestClient


class TestEvidenceCreate:
    def test_create_evidence(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/evidence/projects/{created_project['id']}",
            json={
                "project_id": created_project["id"],
                "type": "text_log",
                "title": "手动上传证据",
                "content": "这是手动上传的证据内容",
                "related_step": "light_step_1",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["type"] == "text_log"
        assert resp.json()["data"]["project_id"] == created_project["id"]

    def test_create_evidence_project_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.post(
            "/api/v1/evidence/projects/00000000-0000-0000-0000-000000000000",
            json={
                "project_id": "00000000-0000-0000-0000-000000000000",
                "type": "text_log",
                "content": "内容",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_create_evidence_forbidden(self, client: TestClient, second_auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/evidence/projects/{created_project['id']}",
            json={
                "project_id": created_project["id"],
                "type": "text_log",
                "content": "越权",
            },
            headers=second_auth_headers,
        )
        assert resp.status_code == 403


class TestEvidenceList:
    def test_list_evidence(self, client: TestClient, auth_headers: dict, created_project: dict):
        client.post(
            f"/api/v1/evidence/projects/{created_project['id']}",
            json={"project_id": created_project["id"], "type": "text_log", "content": "证据1"},
            headers=auth_headers,
        )
        resp = client.get(
            f"/api/v1/evidence/projects/{created_project['id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["total"] >= 1

    def test_list_evidence_filter_type(self, client: TestClient, auth_headers: dict, created_project: dict):
        client.post(
            f"/api/v1/evidence/projects/{created_project['id']}",
            json={"project_id": created_project["id"], "type": "auto_stage_change", "content": "自动证据"},
            headers=auth_headers,
        )
        resp = client.get(
            f"/api/v1/evidence/projects/{created_project['id']}?type=auto_stage_change",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        items = resp.json()["data"]["items"]
        assert all(e["type"] == "auto_stage_change" for e in items)


class TestEvidenceGet:
    def test_get_evidence(self, client: TestClient, auth_headers: dict, created_project: dict):
        create_resp = client.post(
            f"/api/v1/evidence/projects/{created_project['id']}",
            json={"project_id": created_project["id"], "type": "text_log", "content": "获取测试"},
            headers=auth_headers,
        )
        assert create_resp.status_code == 200
        evidence_id = create_resp.json()["data"]["id"]

        resp = client.get(f"/api/v1/evidence/{evidence_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == evidence_id

    def test_get_evidence_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/evidence/nonexistent", headers=auth_headers)
        assert resp.status_code == 404


class TestEvidenceUpdate:
    def test_update_evidence(self, client: TestClient, auth_headers: dict, created_project: dict):
        create_resp = client.post(
            f"/api/v1/evidence/projects/{created_project['id']}",
            json={"project_id": created_project["id"], "type": "text_log", "content": "原始内容"},
            headers=auth_headers,
        )
        assert create_resp.status_code == 200
        evidence_id = create_resp.json()["data"]["id"]

        update_resp = client.patch(
            f"/api/v1/evidence/{evidence_id}",
            json={"content": "更新内容"},
            headers=auth_headers,
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["data"]["content"] == "更新内容"


class TestAutoCollectEvidence:
    def test_auto_collect_stage_change(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/evidence/projects/{created_project['id']}/auto-collect",
            json={
                "type": "auto_stage_change",
                "source": "system",
                "content": "阶段从 step1 推进到 step2",
                "related_step": "light_step_2",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["type"] == "auto_stage_change"

    def test_auto_collect_ai_summary(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/evidence/projects/{created_project['id']}/auto-collect",
            json={
                "type": "auto_ai_summary",
                "source": "agent",
                "content": "AI 对话摘要：讨论了项目架构",
                "related_step": "light_step_1",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["type"] == "auto_ai_summary"


class TestScreenshotUpload:
    def test_upload_screenshot(self, client: TestClient, auth_headers: dict, created_project: dict):
        img_content = io.BytesIO(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde')
        resp = client.post(
            f"/api/v1/evidence/projects/{created_project['id']}/screenshots",
            files={"file": ("test.png", img_content, "image/png")},
            data={"related_step": "light_step_1"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["type"] == "screenshot"

    def test_upload_non_image_rejected(self, client: TestClient, auth_headers: dict, created_project: dict):
        text_content = io.BytesIO(b"not an image")
        resp = client.post(
            f"/api/v1/evidence/projects/{created_project['id']}/screenshots",
            files={"file": ("test.txt", text_content, "text/plain")},
            headers=auth_headers,
        )
        assert resp.status_code == 400
