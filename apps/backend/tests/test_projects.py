"""
研学项目模块 API 集成测试

用途：项目 CRUD、轻项目步骤、标准项目、升级、推进、导出
维护者：AI Agent
links: .trae/documents/testing/
"""

from fastapi.testclient import TestClient


class TestProjectCreate:
    def test_create_light_project(self, client: TestClient, auth_headers: dict, seeded_demo_id: str):
        resp = client.post("/api/v1/projects", json={
            "name": "我的轻项目",
            "mode": "light",
            "from_demo_id": seeded_demo_id,
        }, headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["name"] == "我的轻项目"
        assert body["data"]["mode"] == "light"
        assert body["data"]["from_demo_id"] == seeded_demo_id

    def test_create_standard_project(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/projects", json={
            "name": "标准研学项目",
            "mode": "standard",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["mode"] == "standard"

    def test_create_project_unauthenticated(self, client: TestClient):
        resp = client.post("/api/v1/projects", json={
            "name": "未授权项目",
            "mode": "light",
        })
        assert resp.status_code == 401


class TestProjectList:
    def test_list_projects(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get("/api/v1/projects", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["total"] >= 1

    def test_list_projects_filter_mode(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get("/api/v1/projects?mode=light", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json()["data"]["items"]
        assert all(p["mode"] == "light" for p in items)

    def test_list_projects_pagination(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get("/api/v1/projects?page=1&page_size=5", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["page"] == 1
        assert body["data"]["page_size"] == 5

    def test_list_projects_empty_for_new_user(self, client: TestClient, second_auth_headers: dict):
        resp = client.get("/api/v1/projects", headers=second_auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["total"] == 0


class TestProjectDetail:
    def test_get_project(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == created_project["id"]

    def test_get_project_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/projects/nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    def test_get_project_forbidden(self, client: TestClient, second_auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}", headers=second_auth_headers)
        assert resp.status_code == 403


class TestProjectUpdate:
    def test_update_project_name(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.patch(f"/api/v1/projects/{created_project['id']}", json={
            "name": "更新后的项目名",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "更新后的项目名"


class TestProjectDelete:
    def test_delete_project(self, client: TestClient, auth_headers: dict, seeded_demo_id: str):
        resp = client.post("/api/v1/projects", json={
            "name": "待删除项目",
            "mode": "light",
        }, headers=auth_headers)
        project_id = resp.json()["data"]["id"]

        del_resp = client.delete(f"/api/v1/projects/{project_id}", headers=auth_headers)
        assert del_resp.status_code == 200

        get_resp = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    def test_delete_project_forbidden(self, client: TestClient, second_auth_headers: dict, created_project: dict):
        resp = client.delete(f"/api/v1/projects/{created_project['id']}", headers=second_auth_headers)
        assert resp.status_code == 403


class TestProjectProgress:
    def test_get_progress(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/progress", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "current_stage" in body["data"]
        assert "light_step_data" in body["data"]


class TestLightProjectSteps:
    def test_save_step1(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/projects/{created_project['id']}/progress/light/step1",
            json={"project_name": "测试项目", "one_liner": "一句话介绍", "core_features": ["功能1", "功能2"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert "current_stage" in resp.json()["data"]

    def test_save_step2(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/projects/{created_project['id']}/progress/light/step2",
            json={"code_url": "https://github.com/example/code", "key_screenshots": ["s1.png"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_save_step3(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/projects/{created_project['id']}/progress/light/step3",
            json={"brief_reflection": "学到了很多"},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_save_step_wrong_mode(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/projects", json={"name": "标准项目", "mode": "standard"}, headers=auth_headers)
        pid = resp.json()["data"]["id"]
        step_resp = client.post(
            f"/api/v1/projects/{pid}/progress/light/step1",
            json={"project_name": "测试", "one_liner": "描述", "core_features": []},
            headers=auth_headers,
        )
        assert step_resp.status_code == 400


class TestStandardProjectSteps:
    def test_save_standard_step(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/projects", json={"name": "标准项目", "mode": "standard"}, headers=auth_headers)
        pid = resp.json()["data"]["id"]

        step_resp = client.post(
            f"/api/v1/projects/{pid}/progress/standard/1",
            json={"payload": {"topic": "AI 诗词"}, "notes": "脑爆记录"},
            headers=auth_headers,
        )
        assert step_resp.status_code == 200

    def test_save_standard_step_wrong_mode(self, client: TestClient, auth_headers: dict, created_project: dict):
        step_resp = client.post(
            f"/api/v1/projects/{created_project['id']}/progress/standard/1",
            json={"payload": {}, "notes": "错误"},
            headers=auth_headers,
        )
        assert step_resp.status_code == 400


class TestProjectUpgrade:
    def test_upgrade_light_to_standard(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(f"/api/v1/projects/{created_project['id']}/upgrade", json={"confirm_upgrade": True}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["mode"] == "standard"

    def test_upgrade_standard_project_fails(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/projects", json={"name": "已是标准", "mode": "standard"}, headers=auth_headers)
        pid = resp.json()["data"]["id"]
        upgrade_resp = client.post(f"/api/v1/projects/{pid}/upgrade", json={"confirm_upgrade": True}, headers=auth_headers)
        assert upgrade_resp.status_code == 400


class TestProjectAdvance:
    def test_advance_stage(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(f"/api/v1/projects/{created_project['id']}/advance", headers=auth_headers)
        assert resp.status_code == 200
        assert "current_stage" in resp.json()["data"]


class TestProjectExport:
    def test_export_md(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/export?format=md", headers=auth_headers)
        assert resp.status_code == 200

    def test_export_json(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/export?format=json", headers=auth_headers)
        assert resp.status_code == 200

    def test_export_zip(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/export?format=zip", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.headers.get("content-type") == "application/zip"

    def test_export_pdf(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/export?format=pdf", headers=auth_headers)
        assert resp.status_code == 200

    def test_export_docx(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/export?format=docx", headers=auth_headers)
        assert resp.status_code == 200
