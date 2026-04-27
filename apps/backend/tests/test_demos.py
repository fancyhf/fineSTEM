"""
Demo 模块 API 集成测试

用途：Demo 列表/详情/拆解/Fork模板
维护者：AI Agent
links: .trae/documents/testing/
"""

from fastapi.testclient import TestClient


class TestDemoList:
    def test_list_demos_returns_items(self, client: TestClient, seeded_demo_id: str):
        resp = client.get("/api/v1/demos")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["total"] >= 1
        assert any(d["id"] == seeded_demo_id for d in body["data"]["items"])

    def test_list_demos_pagination(self, client: TestClient, seeded_demo_id: str):
        resp = client.get("/api/v1/demos?page=1&page_size=1")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["page"] == 1
        assert body["data"]["page_size"] == 1
        assert len(body["data"]["items"]) <= 1

    def test_list_demos_filter_difficulty(self, client: TestClient, seeded_demo_id: str):
        resp = client.get("/api/v1/demos?difficulty=beginner")
        assert resp.status_code == 200
        items = resp.json()["data"]["items"]
        assert all(d["difficulty"] == "beginner" for d in items)

    def test_list_demos_filter_returns_empty_for_no_match(self, client: TestClient, seeded_demo_id: str):
        resp = client.get("/api/v1/demos?difficulty=advanced")
        assert resp.status_code == 200
        items = resp.json()["data"]["items"]
        assert all(d["difficulty"] == "advanced" for d in items)


class TestDemoDetail:
    def test_get_demo_detail(self, client: TestClient, seeded_demo_id: str):
        resp = client.get(f"/api/v1/demos/{seeded_demo_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["id"] == seeded_demo_id
        assert body["data"]["name"] == "诗词生成器"

    def test_get_demo_not_found(self, client: TestClient):
        resp = client.get("/api/v1/demos/nonexistent_id")
        assert resp.status_code == 404


class TestDemoUseAsTemplate:
    def test_use_as_template(self, client: TestClient, seeded_demo_id: str):
        resp = client.get(f"/api/v1/demos/{seeded_demo_id}/use-project")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["demo_id"] == seeded_demo_id
        assert "name" in body["data"]
        assert "tech_stack" in body["data"]
        assert "difficulty" in body["data"]

    def test_use_as_template_not_found(self, client: TestClient):
        resp = client.get("/api/v1/demos/nonexistent/use-project")
        assert resp.status_code == 404


class TestDemoBreakdown:
    def test_get_breakdown(self, client: TestClient, seeded_demo_with_breakdown_id: str):
        resp = client.get(f"/api/v1/demos/{seeded_demo_with_breakdown_id}/breakdown")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["demo_id"] == seeded_demo_with_breakdown_id
        assert body["data"]["project_breakdown"]

    def test_get_breakdown_no_content(self, client: TestClient, seeded_demo_id: str):
        resp = client.get(f"/api/v1/demos/{seeded_demo_id}/breakdown")
        assert resp.status_code == 200
        assert resp.json()["data"]["project_breakdown"] == ""


class TestDemoForkTemplate:
    def test_get_fork_template(self, client: TestClient, seeded_demo_with_breakdown_id: str):
        resp = client.get(f"/api/v1/demos/{seeded_demo_with_breakdown_id}/fork-template")
        assert resp.status_code == 200
        body = resp.json()
        data = body["data"]
        assert data["demo_id"] == seeded_demo_with_breakdown_id
        assert "editable_markers" in data
        assert "suggestions" in data
        assert len(data["suggestions"]) == 3
        assert "default_goal" in data
        assert "template_files" in data

    def test_get_fork_template_no_replica(self, client: TestClient, seeded_demo_id: str):
        resp = client.get(f"/api/v1/demos/{seeded_demo_id}/fork-template")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "template_files" in data
        assert len(data["template_files"]) >= 1
