"""
辅助模块 API 集成测试

用途：港澳升学/国际升学/背景提升/知识来源/问卷/对话/审计/健康检查
维护者：AI Agent
links: .trae/documents/testing/
"""

from fastapi.testclient import TestClient


class TestHealthCheck:
    def test_root(self, client: TestClient):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json()["name"] == "fineSTEM API"

    def test_health(self, client: TestClient):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


class TestHongKongMacao:
    def test_create_plan(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/hongkong-macao/plans", json={
            "student_name": "张三",
            "grade": "高一",
            "target_track": "both",
            "timeline": "2026-2028",
            "requirement_summary": "目标港大",
            "status": "draft",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["student_name"] == "张三"

    def test_list_plans(self, client: TestClient, auth_headers: dict):
        client.post("/api/v1/hongkong-macao/plans", json={
            "student_name": "李四",
            "grade": "高二",
            "target_track": "hk",
            "timeline": "2026-2028",
            "requirement_summary": "目标科大",
            "status": "active",
        }, headers=auth_headers)

        resp = client.get("/api/v1/hongkong-macao/plans", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["data"]) >= 1


class TestInternationalAdmissions:
    def test_create_plan(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/international-admissions/plans", json={
            "student_name": "王五",
            "grade": "高三",
            "target_country": "美国",
            "target_school_level": "undergraduate",
            "timeline": "2026-2030",
            "requirement_summary": "目标MIT",
            "status": "draft",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["target_country"] == "美国"

    def test_list_plans(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/international-admissions/plans", headers=auth_headers)
        assert resp.status_code == 200


class TestProfileEnhancement:
    def test_create_plan(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/profile-enhancement/plans", json={
            "student_name": "赵六",
            "objective": "提升综合背景",
            "activities": ["参加竞赛", "做项目"],
            "evidence_targets": ["竞赛证书", "项目成果"],
            "status": "draft",
        }, headers=auth_headers)
        assert resp.status_code == 200

    def test_list_plans(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/profile-enhancement/plans", headers=auth_headers)
        assert resp.status_code == 200


class TestKnowledgeSources:
    def test_create_source(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/knowledge-sources", json={
            "title": "AI 学习资源",
            "source_type": "article",
            "url": "https://example.com/ai",
            "summary": "AI 入门文章",
            "tags": ["AI", "入门"],
            "reliability_score": 85,
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "AI 学习资源"

    def test_list_sources(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/knowledge-sources", headers=auth_headers)
        assert resp.status_code == 200


class TestQuestionnaireEngine:
    def test_create_template(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/questionnaire-engine/templates", json={
            "name": "项目评估问卷",
            "description": "评估学生项目完成度",
            "questions": [
                {
                    "id": "q1",
                    "text": "项目是否完成？",
                    "question_type": "single_choice",
                    "required": True,
                    "options": ["是", "否"],
                },
            ],
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "项目评估问卷"

    def test_list_templates(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/questionnaire-engine/templates", headers=auth_headers)
        assert resp.status_code == 200

    def test_submit_response(self, client: TestClient, auth_headers: dict):
        create_resp = client.post("/api/v1/questionnaire-engine/templates", json={
            "name": "测试问卷",
            "description": "测试",
            "questions": [{"id": "q1", "text": "问题1", "question_type": "text", "required": True, "options": []}],
        }, headers=auth_headers)
        template_id = create_resp.json()["data"]["id"]

        resp = client.post("/api/v1/questionnaire-engine/responses", json={
            "template_id": template_id,
            "respondent_name": "测试学生",
            "answers": {"q1": "我的回答"},
        }, headers=auth_headers)
        assert resp.status_code == 200


class TestAssistantDialogues:
    def test_create_session(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/assistant-dialogues/sessions?title=测试对话", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "测试对话"

    def test_list_sessions(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/assistant-dialogues/sessions", headers=auth_headers)
        assert resp.status_code == 200


class TestAuditLogs:
    def test_list_logs(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/audit-logs", headers=auth_headers)
        assert resp.status_code == 200

    def test_list_logs_filter_module(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/audit-logs?module=auth", headers=auth_headers)
        assert resp.status_code == 200
