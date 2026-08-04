"""
Demo 管理 API 测试（admin 收录/编辑/删除/上下架）

覆盖：
- POST /demos/from-project/{project_id} 收录项目为 demo
  · 成功收录（成果卡齐全且已公开）
  · 成果卡缺失 → 422
  · 成果卡字段不全（缺截图/标签/one_liner）→ 422 + missing_fields
  · 成果卡未公开 → 422 + card_not_public
  · 重复收录 → 409
  · 项目不存在 → 404
  · 非 admin → 403
- PATCH /demos/{demo_id} 编辑
- DELETE /demos/{demo_id} 软删除
- POST /demos/{demo_id}/toggle-public 上下架

维护者：AI Agent
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.db.models import UserModel, ProjectModel, AchievementCardModel


# ── fixtures（复用 test_projects_admin 的模式，本文件独立定义避免耦合）──

@pytest.fixture
def admin_user(client: TestClient) -> dict:
    from conftest import TestSessionLocal  # type: ignore

    email = f"admin_{uuid.uuid4().hex[:8]}@finestem.test"
    resp = client.post("/api/v1/auth/register", json={
        "name": "管理员",
        "email": email,
        "password": "AdminPass123!",
    })
    assert resp.status_code == 200
    data = resp.json()["data"]
    user_id = data["user"]["id"]

    session = TestSessionLocal()
    try:
        user = session.get(UserModel, user_id)
        user.role = "admin"
        session.commit()
    finally:
        session.close()

    return {"id": user_id, "email": email, "token": data["access_token"], "name": "管理员"}


@pytest.fixture
def admin_headers(admin_user: dict) -> dict:
    return {"Authorization": f"Bearer {admin_user['token']}"}


@pytest.fixture
def student_user(registered_user: dict) -> dict:
    return registered_user


@pytest.fixture
def student_headers(auth_headers: dict) -> dict:
    return auth_headers


def _create_project(
    author_id: str,
    *,
    name: str = "可收录项目",
    description: str = "项目简介",
) -> str:
    from conftest import TestSessionLocal  # type: ignore
    session = TestSessionLocal()
    try:
        project_id = f"proj_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        session.add(ProjectModel(
            id=project_id,
            author_id=author_id,
            name=name,
            mode="light",
            description=description,
            visibility="public",
            current_stage="stage_08_evaluate",
            created_at=now,
            updated_at=now,
        ))
        session.commit()
        return project_id
    finally:
        session.close()


def _create_card(
    project_id: str,
    author_id: str,
    *,
    one_liner: str = "一句话介绍",
    screenshots: str = '["/covers/a.png"]',
    capability_tags: str = '["数据分析"]',
    is_public: bool = True,
) -> str:
    from conftest import TestSessionLocal  # type: ignore
    session = TestSessionLocal()
    try:
        card_id = f"card_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        session.add(AchievementCardModel(
            id=card_id,
            project_id=project_id,
            author_id=author_id,
            title="成果卡",
            one_liner=one_liner,
            problem_solved="解决了什么",
            method_used="用了什么方法",
            screenshots=screenshots,
            reflection="反思",
            capability_tags=capability_tags,
            project_mode="light",
            is_public=is_public,
            submitted_at=now if is_public else None,
            created_at=now,
            updated_at=now,
        ))
        session.commit()
        return card_id
    finally:
        session.close()


def _promote_payload(**overrides) -> dict:
    payload = {
        "difficulty": "intermediate",
        "subjects": ["计算机科学"],
        "grade_range": "高中",
        "code_url": "https://example.com/code",
        "download_url": "https://example.com/download",
        "tech_stack": ["Python"],
        "tags": ["测试"],
        "display_mode": "static",
    }
    payload.update(overrides)
    return payload


# ── 收录测试 ──────────────────────────────────────────────

class TestPromoteProjectToDemo:
    def test_promote_success(self, client, admin_user, admin_headers):
        project_id = _create_project(admin_user["id"], name="优秀项目")
        _create_card(project_id, admin_user["id"])

        resp = client.post(
            f"/api/v1/demos/from-project/{project_id}",
            json=_promote_payload(),
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["name"] == "优秀项目"
        assert data["source_project_id"] == project_id
        assert data["difficulty"] == "intermediate"
        assert data["is_public"] is True
        assert data["created_by"] == admin_user["id"]
        assert data["id"].startswith("demo_")

    def test_promote_maps_fields_from_project_and_card(self, client, admin_user, admin_headers):
        project_id = _create_project(admin_user["id"], name="映射测试", description="项目描述")
        _create_card(
            project_id,
            admin_user["id"],
            one_liner="成果卡一句话",
            screenshots='["/covers/x.png"]',
        )
        resp = client.post(
            f"/api/v1/demos/from-project/{project_id}",
            json=_promote_payload(),
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        # description 优先用成果卡 one_liner
        assert data["description"] == "成果卡一句话"
        assert data["screenshots"] == ["/covers/x.png"]

    def test_promote_missing_card_returns_422(self, client, admin_user, admin_headers):
        project_id = _create_project(admin_user["id"])
        # 不创建成果卡
        resp = client.post(
            f"/api/v1/demos/from-project/{project_id}",
            json=_promote_payload(),
            headers=admin_headers,
        )
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert "achievement_card" in detail["details"]["missing_fields"]

    def test_promote_incomplete_card_auto_fix_tags_but_422_on_screenshots(self, client, admin_user, admin_headers):
        """缺截图+缺标签：标签自动补全，但截图无项目证据可补 → 仍 422 且仅缺 screenshots。"""
        project_id = _create_project(admin_user["id"])
        _create_card(
            project_id,
            admin_user["id"],
            screenshots="[]",  # 缺截图
            capability_tags="[]",  # 缺标签（会被自动补全）
        )
        resp = client.post(
            f"/api/v1/demos/from-project/{project_id}",
            json=_promote_payload(),
            headers=admin_headers,
        )
        # 截图无 evidence 可补 → 422
        assert resp.status_code == 422
        missing = resp.json()["detail"]["details"]["missing_fields"]
        assert "screenshots" in missing
        # capability_tags 已被自动修复，不应再出现在 missing 里
        assert "capability_tags" not in missing

    def test_promote_auto_fill_screenshots_from_evidence(self, client, admin_user, admin_headers):
        """成果卡缺截图但项目有截图证据：自动取第一张证据补到成果卡，收录成功。"""
        from app.db.models import EvidenceModel
        from conftest import TestSessionLocal  # type: ignore
        from datetime import datetime, timezone

        project_id = _create_project(admin_user["id"])
        _create_card(project_id, admin_user["id"], screenshots="[]")  # 成果卡缺截图
        # 造一条截图证据
        session = TestSessionLocal()
        try:
            now = datetime.now(timezone.utc)
            session.add(EvidenceModel(
                id=f"ev_{uuid.uuid4().hex[:8]}",
                project_id=project_id,
                author_id=admin_user["id"],
                type="screenshot",
                title="运行截图",
                content="",
                content_url="/uploads/test_screenshot.png",
                created_at=now,
                updated_at=now,
                created_by=admin_user["id"],
            ))
            session.commit()
        finally:
            session.close()

        resp = client.post(
            f"/api/v1/demos/from-project/{project_id}",
            json=_promote_payload(),
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["screenshots"] == ["/uploads/test_screenshot.png"]

    def test_promote_unpublic_card_auto_publishes(self, client, admin_user, admin_headers):
        """成果卡未公开时收录：不再 422，而是自动发布成果卡后收录成功。"""
        project_id = _create_project(admin_user["id"])
        _create_card(project_id, admin_user["id"], is_public=False)
        resp = client.post(
            f"/api/v1/demos/from-project/{project_id}",
            json=_promote_payload(),
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        # 收录成功后成果卡应被自动设为公开
        card_resp = client.get(f"/api/v1/achievement-cards/projects/{project_id}", headers=admin_headers)
        assert card_resp.status_code == 200
        assert card_resp.json()["data"]["is_public"] is True

    def test_promote_duplicate_returns_409(self, client, admin_user, admin_headers):
        project_id = _create_project(admin_user["id"])
        _create_card(project_id, admin_user["id"])
        # 第一次收录
        resp1 = client.post(
            f"/api/v1/demos/from-project/{project_id}",
            json=_promote_payload(),
            headers=admin_headers,
        )
        assert resp1.status_code == 200
        # 重复收录
        resp2 = client.post(
            f"/api/v1/demos/from-project/{project_id}",
            json=_promote_payload(),
            headers=admin_headers,
        )
        assert resp2.status_code == 409
        assert resp2.json()["detail"]["code"] == "PROJECT_ALREADY_PROMOTED"

    def test_promote_nonexistent_project_returns_404(self, client, admin_headers):
        resp = client.post(
            "/api/v1/demos/from-project/proj_nonexistent",
            json=_promote_payload(),
            headers=admin_headers,
        )
        assert resp.status_code == 404

    def test_promote_non_admin_forbidden(self, client, student_user, student_headers):
        project_id = _create_project(student_user["id"])
        _create_card(project_id, student_user["id"])
        resp = client.post(
            f"/api/v1/demos/from-project/{project_id}",
            json=_promote_payload(),
            headers=student_headers,
        )
        assert resp.status_code == 403


# ── 预填充接口测试 ──────────────────────────────────────────

class TestDemoPrefill:
    def test_prefill_returns_auto_mapped_fields(self, client, admin_user, admin_headers):
        """预填充接口应从 project + 成果卡自动提取 demo 字段建议值。"""
        project_id = _create_project(admin_user["id"], name="自动填充测试项目")
        _create_card(
            project_id,
            admin_user["id"],
            one_liner="成果卡一句话",
            screenshots='["/covers/auto.png"]',
            capability_tags='["Python", "数据分析"]',
        )
        resp = client.get(
            f"/api/v1/demos/from-project/{project_id}/prefill",
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        # 基础字段从 project/成果卡映射
        assert data["name"] == "自动填充测试项目"
        assert data["description"] == "成果卡一句话"
        assert data["screenshots"] == ["/covers/auto.png"]
        # code_url/download_url 自动指向项目导出接口（核心需求）
        assert data["code_url"] == f"/api/v1/projects/{project_id}/export?format=zip"
        assert data["download_url"] == f"/api/v1/projects/{project_id}/export?format=zip"
        # 能力标签映射到 tags
        assert "Python" in data["tags"]
        assert "数据分析" in data["tags"]

    def test_prefill_nonexistent_project_404(self, client, admin_headers):
        resp = client.get(
            "/api/v1/demos/from-project/proj_nonexistent/prefill",
            headers=admin_headers,
        )
        assert resp.status_code == 404

    def test_prefill_non_admin_forbidden(self, client, student_user, student_headers):
        project_id = _create_project(student_user["id"])
        _create_card(project_id, student_user["id"])
        resp = client.get(
            f"/api/v1/demos/from-project/{project_id}/prefill",
            headers=student_headers,
        )
        assert resp.status_code == 403

    def test_promote_with_empty_code_url_uses_export_url(self, client, admin_user, admin_headers):
        """admin 不传 code_url/download_url 时，收录后应自动用项目导出 URL。"""
        project_id = _create_project(admin_user["id"])
        _create_card(project_id, admin_user["id"])
        payload = _promote_payload()
        payload["code_url"] = ""
        payload["download_url"] = ""
        resp = client.post(
            f"/api/v1/demos/from-project/{project_id}",
            json=payload,
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["code_url"] == f"/api/v1/projects/{project_id}/export?format=zip"
        assert data["download_url"] == f"/api/v1/projects/{project_id}/export?format=zip"


# ── 编辑/删除/上下架测试 ──────────────────────────────────

class TestDemoMutations:
    @pytest.fixture
    def promoted_demo_id(self, client, admin_user, admin_headers) -> str:
        project_id = _create_project(admin_user["id"])
        _create_card(project_id, admin_user["id"])
        resp = client.post(
            f"/api/v1/demos/from-project/{project_id}",
            json=_promote_payload(),
            headers=admin_headers,
        )
        assert resp.status_code == 200
        return resp.json()["data"]["id"]

    def test_update_demo(self, client, admin_headers, promoted_demo_id):
        resp = client.patch(
            f"/api/v1/demos/{promoted_demo_id}",
            json={"name": "改名后的Demo", "difficulty": "advanced"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["name"] == "改名后的Demo"
        assert data["difficulty"] == "advanced"

    def test_update_demo_minimal_replica_stored_as_json(self, client, admin_headers, promoted_demo_id):
        """回归：minimal_replica 之前被 update_demo 当原始值 setattr（存了 dict），读取失败。"""
        replica = {"entry_file": "main.py", "files": {"main.py": "print(1)"}}
        resp = client.patch(
            f"/api/v1/demos/{promoted_demo_id}",
            json={"minimal_replica": replica},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        # 再 GET fork-template 验证能正确解析
        ft = client.get(f"/api/v1/demos/{promoted_demo_id}/fork-template")
        assert ft.status_code == 200
        assert ft.json()["data"]["entry_file"] == "main.py"

    def test_update_nonexistent_returns_404(self, client, admin_headers):
        resp = client.patch(
            "/api/v1/demos/demo_nonexistent",
            json={"name": "x"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    def test_delete_demo_soft(self, client, admin_headers, promoted_demo_id):
        resp = client.delete(
            f"/api/v1/demos/{promoted_demo_id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        # 软删后 GET 应 404
        get_resp = client.get(f"/api/v1/demos/{promoted_demo_id}")
        assert get_resp.status_code == 404

    def test_toggle_public_offline(self, client, admin_headers, promoted_demo_id):
        resp = client.post(
            f"/api/v1/demos/{promoted_demo_id}/toggle-public",
            json={"is_public": False},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["is_public"] is False
        # 下架后公开列表不应包含它
        public = client.get("/api/v1/demos?is_public=true")
        ids = [d["id"] for d in public.json()["data"]["items"]]
        assert promoted_demo_id not in ids

    def test_toggle_public_online(self, client, admin_headers, promoted_demo_id):
        # 先下架再上架
        client.post(
            f"/api/v1/demos/{promoted_demo_id}/toggle-public",
            json={"is_public": False},
            headers=admin_headers,
        )
        resp = client.post(
            f"/api/v1/demos/{promoted_demo_id}/toggle-public",
            json={"is_public": True},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["is_public"] is True

    def test_mutations_non_admin_forbidden(self, client, student_headers, promoted_demo_id):
        # 编辑
        assert client.patch(
            f"/api/v1/demos/{promoted_demo_id}",
            json={"name": "x"},
            headers=student_headers,
        ).status_code == 403
        # 删除
        assert client.delete(
            f"/api/v1/demos/{promoted_demo_id}",
            headers=student_headers,
        ).status_code == 403
        # 上下架
        assert client.post(
            f"/api/v1/demos/{promoted_demo_id}/toggle-public",
            json={"is_public": False},
            headers=student_headers,
        ).status_code == 403
