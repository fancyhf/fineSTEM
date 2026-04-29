"""
辅助模块 API 集成测试

用途：健康检查等基础功能测试
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
