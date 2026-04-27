"""
Skill/课程/能力标签等模块 API 集成测试

用途：Skill 市场/安装/启停/卸载、课程库、能力标签
维护者：AI Agent
links: .trae/documents/testing/
"""

from fastapi.testclient import TestClient


class TestSkillMarketplace:
    def test_list_marketplace(self, client: TestClient):
        resp = client.get("/api/v1/skills/marketplace")
        assert resp.status_code == 200
        assert isinstance(resp.json()["data"], list)


class TestSkillInstall:
    def test_install_skill(self, client: TestClient, auth_headers: dict):
        marketplace_resp = client.get("/api/v1/skills/marketplace")
        marketplace = marketplace_resp.json()["data"]
        if not marketplace:
            return

        skill_id = marketplace[0]["skill_id"]
        resp = client.post("/api/v1/skills/install", json={
            "skill_id": skill_id,
            "source": "builtin",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "enabled"

    def test_list_installed_skills(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/skills", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json()["data"], list)


class TestSkillToggle:
    def test_toggle_skill(self, client: TestClient, auth_headers: dict):
        marketplace_resp = client.get("/api/v1/skills/marketplace")
        marketplace = marketplace_resp.json()["data"]
        if not marketplace:
            return

        skill_id = marketplace[0]["skill_id"]
        client.post("/api/v1/skills/install", json={"skill_id": skill_id, "source": "builtin"}, headers=auth_headers)

        toggle_resp = client.post(f"/api/v1/skills/{skill_id}/toggle", json={"enabled": False}, headers=auth_headers)
        assert toggle_resp.status_code == 200
        assert toggle_resp.json()["data"]["status"] == "disabled"

        toggle_back = client.post(f"/api/v1/skills/{skill_id}/toggle", json={"enabled": True}, headers=auth_headers)
        assert toggle_back.status_code == 200
        assert toggle_back.json()["data"]["status"] == "enabled"


class TestSkillUninstall:
    def test_uninstall_skill(self, client: TestClient, auth_headers: dict):
        marketplace_resp = client.get("/api/v1/skills/marketplace")
        marketplace = marketplace_resp.json()["data"]
        if not marketplace:
            return

        skill_id = marketplace[0]["skill_id"]
        client.post("/api/v1/skills/install", json={"skill_id": skill_id, "source": "builtin"}, headers=auth_headers)

        del_resp = client.delete(f"/api/v1/skills/{skill_id}", headers=auth_headers)
        assert del_resp.status_code == 200


class TestCourseLibrary:
    def test_list_courses_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/course-library/courses", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json()["data"], list)

    def test_create_course(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/course-library/courses", json={
            "title": "Python 入门课程",
            "summary": "面向零基础学生的 Python 编程入门",
            "subject": "编程",
            "difficulty": "beginner",
            "tags": ["python", "入门"],
            "resource_url": "https://example.com/course",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "Python 入门课程"

    def test_create_and_list_courses(self, client: TestClient, auth_headers: dict):
        client.post("/api/v1/course-library/courses", json={
            "title": "数据分析课程",
            "summary": "数据分析基础",
            "subject": "数据科学",
            "difficulty": "intermediate",
            "tags": ["data", "analysis"],
        }, headers=auth_headers)

        resp = client.get("/api/v1/course-library/courses", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["data"]) >= 1


class TestCapabilityTags:
    def test_recommend_tags(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(
            f"/api/v1/capability-tags/projects/{created_project['id']}/recommend",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "tags" in body["data"]
        assert isinstance(body["data"]["tags"], list)

    def test_apply_tags(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/capability-tags/projects/{created_project['id']}/apply",
            json={"tags": ["编程", "AI应用"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert "编程" in resp.json()["data"]

    def test_get_tags(self, client: TestClient, auth_headers: dict, created_project: dict):
        client.post(
            f"/api/v1/capability-tags/projects/{created_project['id']}/apply",
            json={"tags": ["数据分析"]},
            headers=auth_headers,
        )
        resp = client.get(
            f"/api/v1/capability-tags/projects/{created_project['id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert "数据分析" in resp.json()["data"]

    def test_recommend_tags_project_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/capability-tags/projects/nonexistent/recommend", headers=auth_headers)
        assert resp.status_code == 404
