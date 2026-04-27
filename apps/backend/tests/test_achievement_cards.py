"""
成果档案卡模块 API 集成测试

用途：创建/更新/分享/灵感墙/推荐/Fork
维护者：AI Agent
links: .trae/documents/testing/
"""

from fastapi.testclient import TestClient


class TestAchievementCardCreate:
    def test_create_card(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/achievement-cards/projects/{created_project['id']}",
            json={
                "title": "我的成果",
                "one_liner": "一句话介绍",
                "problem_solved": "解决了什么问题",
                "method_used": "用了什么方法",
                "screenshots": ["s1.png"],
                "reflection": "我的反思",
                "capability_tags": ["编程", "AI"],
                "project_mode": "light",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["title"] == "我的成果"
        assert body["data"]["project_id"] == created_project["id"]

    def test_create_card_project_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.post(
            "/api/v1/achievement-cards/projects/nonexistent",
            json={
                "title": "不存在的项目",
                "one_liner": "描述",
                "problem_solved": "问题",
                "method_used": "方法",
                "reflection": "反思",
                "project_mode": "light",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_create_card_forbidden(self, client: TestClient, second_auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/achievement-cards/projects/{created_project['id']}",
            json={
                "title": "越权创建",
                "one_liner": "描述",
                "problem_solved": "问题",
                "method_used": "方法",
                "reflection": "反思",
                "project_mode": "light",
            },
            headers=second_auth_headers,
        )
        assert resp.status_code == 403


class TestAchievementCardGet:
    def test_get_by_project(self, client: TestClient, auth_headers: dict, created_project: dict):
        client.post(
            f"/api/v1/achievement-cards/projects/{created_project['id']}",
            json={
                "title": "获取测试",
                "one_liner": "描述",
                "problem_solved": "问题",
                "method_used": "方法",
                "reflection": "反思",
                "project_mode": "light",
            },
            headers=auth_headers,
        )
        resp = client.get(
            f"/api/v1/achievement-cards/projects/{created_project['id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "获取测试"


class TestAchievementCardUpdate:
    def test_update_card(self, client: TestClient, auth_headers: dict, created_project: dict):
        create_resp = client.post(
            f"/api/v1/achievement-cards/projects/{created_project['id']}",
            json={
                "title": "原始标题",
                "one_liner": "描述",
                "problem_solved": "问题",
                "method_used": "方法",
                "reflection": "反思",
                "project_mode": "light",
            },
            headers=auth_headers,
        )
        card_id = create_resp.json()["data"]["id"]

        update_resp = client.patch(
            f"/api/v1/achievement-cards/{card_id}",
            json={"title": "更新标题"},
            headers=auth_headers,
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["data"]["title"] == "更新标题"


class TestAchievementCardShare:
    def test_create_share_link(self, client: TestClient, auth_headers: dict, created_project: dict):
        create_resp = client.post(
            f"/api/v1/achievement-cards/projects/{created_project['id']}",
            json={
                "title": "分享测试",
                "one_liner": "描述",
                "problem_solved": "问题",
                "method_used": "方法",
                "reflection": "反思",
                "project_mode": "light",
            },
            headers=auth_headers,
        )
        card_id = create_resp.json()["data"]["id"]

        share_resp = client.post(f"/api/v1/achievement-cards/{card_id}/share", headers=auth_headers)
        assert share_resp.status_code == 200
        share_data = share_resp.json()["data"]
        assert share_data["share_token"]
        assert share_data["share_url"]

    def test_get_shared_card(self, client: TestClient, auth_headers: dict, created_project: dict):
        create_resp = client.post(
            f"/api/v1/achievement-cards/projects/{created_project['id']}",
            json={
                "title": "匿名访问测试",
                "one_liner": "描述",
                "problem_solved": "问题",
                "method_used": "方法",
                "reflection": "反思",
                "project_mode": "light",
            },
            headers=auth_headers,
        )
        card_id = create_resp.json()["data"]["id"]
        share_resp = client.post(f"/api/v1/achievement-cards/{card_id}/share", headers=auth_headers)
        token = share_resp.json()["data"]["share_token"]

        public_resp = client.get(f"/api/v1/achievement-cards/share/{token}")
        assert public_resp.status_code == 200
        assert public_resp.json()["data"]["title"] == "匿名访问测试"

    def test_get_shared_invalid_token(self, client: TestClient):
        resp = client.get("/api/v1/achievement-cards/share/invalid_token")
        assert resp.status_code == 404


class TestInspirationWall:
    def test_inspiration_wall_empty(self, client: TestClient):
        resp = client.get("/api/v1/achievement-cards/inspiration-wall")
        assert resp.status_code == 200
        assert resp.json()["data"]["total"] == 0

    def test_submit_to_wall(self, client: TestClient, auth_headers: dict, created_project: dict):
        create_resp = client.post(
            f"/api/v1/achievement-cards/projects/{created_project['id']}",
            json={
                "title": "灵感墙测试",
                "one_liner": "描述",
                "problem_solved": "问题",
                "method_used": "方法",
                "reflection": "反思",
                "project_mode": "light",
            },
            headers=auth_headers,
        )
        card_id = create_resp.json()["data"]["id"]

        submit_resp = client.post(f"/api/v1/achievement-cards/{card_id}/submit-public", json={"submit_public": True}, headers=auth_headers)
        assert submit_resp.status_code == 200
        assert submit_resp.json()["data"]["is_public"] is True

        wall_resp = client.get("/api/v1/achievement-cards/inspiration-wall")
        assert wall_resp.status_code == 200
        assert wall_resp.json()["data"]["total"] >= 1

    def test_withdraw_from_wall(self, client: TestClient, auth_headers: dict, created_project: dict):
        create_resp = client.post(
            f"/api/v1/achievement-cards/projects/{created_project['id']}",
            json={
                "title": "撤回测试",
                "one_liner": "描述",
                "problem_solved": "问题",
                "method_used": "方法",
                "reflection": "反思",
                "project_mode": "light",
            },
            headers=auth_headers,
        )
        card_id = create_resp.json()["data"]["id"]
        client.post(f"/api/v1/achievement-cards/{card_id}/submit-public", json={"submit_public": True}, headers=auth_headers)

        withdraw_resp = client.post(f"/api/v1/achievement-cards/{card_id}/withdraw-public", headers=auth_headers)
        assert withdraw_resp.status_code == 200
        assert withdraw_resp.json()["data"]["is_public"] is False


class TestForkFromCard:
    def test_fork_project_from_card(self, client: TestClient, auth_headers: dict, created_project: dict):
        create_resp = client.post(
            f"/api/v1/achievement-cards/projects/{created_project['id']}",
            json={
                "title": "Fork 测试",
                "one_liner": "描述",
                "problem_solved": "问题",
                "method_used": "方法",
                "reflection": "反思",
                "project_mode": "light",
            },
            headers=auth_headers,
        )
        card_id = create_resp.json()["data"]["id"]

        fork_resp = client.post(f"/api/v1/achievement-cards/{card_id}/fork-project", headers=auth_headers)
        assert fork_resp.status_code == 200
        forked = fork_resp.json()["data"]
        assert "Fork" in forked["name"]


class TestRecommendations:
    def test_get_recommendations(self, client: TestClient, auth_headers: dict, created_project: dict, seeded_demo_id: str):
        create_resp = client.post(
            f"/api/v1/achievement-cards/projects/{created_project['id']}",
            json={
                "title": "推荐测试",
                "one_liner": "描述",
                "problem_solved": "问题",
                "method_used": "方法",
                "reflection": "反思",
                "capability_tags": ["AI"],
                "project_mode": "light",
            },
            headers=auth_headers,
        )
        card_id = create_resp.json()["data"]["id"]

        rec_resp = client.get(f"/api/v1/achievement-cards/{card_id}/recommendations", headers=auth_headers)
        assert rec_resp.status_code == 200
        recs = rec_resp.json()["data"]
        assert isinstance(recs, list)
