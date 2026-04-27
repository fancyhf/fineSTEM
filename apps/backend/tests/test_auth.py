"""
认证模块 API 集成测试

用途：注册/登录/轻注册/获取用户信息/更新用户信息
维护者：AI Agent
links: .trae/documents/testing/
"""

import uuid

from fastapi.testclient import TestClient


class TestRegister:
    def test_register_success(self, client: TestClient):
        email = f"new_{uuid.uuid4().hex[:8]}@finestem.test"
        resp = client.post("/api/v1/auth/register", json={
            "name": "新用户",
            "email": email,
            "password": "SecurePass123!",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["user"]["email"] == email
        assert body["data"]["user"]["name"] == "新用户"
        assert body["data"]["user"]["role"] == "student"
        assert body["data"]["user"]["level"] == 1
        assert body["data"]["access_token"]
        assert body["data"]["token_type"] == "bearer"

    def test_register_duplicate_email(self, client: TestClient, registered_user: dict):
        resp = client.post("/api/v1/auth/register", json={
            "name": "重复用户",
            "email": registered_user["email"],
            "password": "AnotherPass!",
        })
        assert resp.status_code == 400

    def test_register_missing_fields(self, client: TestClient):
        resp = client.post("/api/v1/auth/register", json={"name": "无邮箱"})
        assert resp.status_code == 422


class TestLightRegister:
    def test_light_register_default_name(self, client: TestClient):
        resp = client.post("/api/v1/auth/light-register", json={})
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["user"]["name"] == "同学"
        assert body["data"]["access_token"]

    def test_light_register_custom_name(self, client: TestClient):
        resp = client.post("/api/v1/auth/light-register", json={"name": "小明"})
        assert resp.status_code == 200
        assert resp.json()["data"]["user"]["name"] == "小明"


class TestLogin:
    def test_login_success(self, client: TestClient, registered_user: dict):
        resp = client.post("/api/v1/auth/login", data={
            "username": registered_user["email"],
            "password": registered_user["password"],
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["access_token"]
        assert body["data"]["user"]["email"] == registered_user["email"]

    def test_login_wrong_password(self, client: TestClient, registered_user: dict):
        resp = client.post("/api/v1/auth/login", data={
            "username": registered_user["email"],
            "password": "WrongPassword!",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_email(self, client: TestClient):
        resp = client.post("/api/v1/auth/login", data={
            "username": "nonexistent@finestem.test",
            "password": "Whatever123!",
        })
        assert resp.status_code == 401


class TestGetCurrentUser:
    def test_get_me_authenticated(self, client: TestClient, auth_headers: dict, registered_user: dict):
        resp = client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["email"] == registered_user["email"]

    def test_get_me_unauthenticated(self, client: TestClient):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_get_me_invalid_token(self, client: TestClient):
        resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert resp.status_code == 401


class TestUpdateUser:
    def test_update_name(self, client: TestClient, auth_headers: dict):
        resp = client.patch("/api/v1/auth/me", json={"name": "新名字"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "新名字"

    def test_update_without_auth(self, client: TestClient):
        resp = client.patch("/api/v1/auth/me", json={"name": "无权修改"})
        assert resp.status_code == 401
