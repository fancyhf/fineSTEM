"""
项目精选管理（Admin）测试

用途：
- 验证 `/projects/admin/featured` 端点 `author_name` 模糊搜索能力（Task 1）
- 验证 `PATCH /projects/{id}/featured` 在设为 Demo 时对项目字段的强制校验（Task 2）

维护者：AI Agent
links: .trae/specs/admin-featured-tabs-and-demo-gate/spec.md
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.db.models import (
    AchievementCardModel,
    ProjectModel,
    UserModel,
)


# =============================================================================
# 辅助 fixtures
# =============================================================================

@pytest.fixture
def admin_user(client: TestClient) -> dict:
    """注册并提升为 admin 的用户"""
    from conftest import TestSessionLocal  # type: ignore

    email = f"admin_{uuid.uuid4().hex[:8]}@finestem.test"
    resp = client.post("/api/v1/auth/register", json={
        "name": "管理员小明",
        "email": email,
        "password": "AdminPass123!",
    })
    assert resp.status_code == 200
    data = resp.json()["data"]
    user_id = data["user"]["id"]

    # 直接改数据库把角色设为 admin
    session = TestSessionLocal()
    try:
        user = session.get(UserModel, user_id)
        user.role = "admin"
        session.commit()
    finally:
        session.close()

    return {
        "id": user_id,
        "email": email,
        "token": data["access_token"],
        "name": "管理员小明",
    }


@pytest.fixture
def admin_headers(admin_user: dict) -> dict:
    return {"Authorization": f"Bearer {admin_user['token']}"}


def _create_project_row(
    author_id: str,
    *,
    name: str = "测试项目",
    description: str = "这是一个测试项目",
    mode: str = "light",
    visibility: str = "private",
    current_stage: str = "stage_01_brainstorm",
) -> str:
    """直接在 DB 插入项目行，返回项目 ID。"""
    from conftest import TestSessionLocal  # type: ignore
    from datetime import datetime, timezone

    session = TestSessionLocal()
    try:
        project_id = f"proj_{uuid.uuid4().hex[:12]}"
        session.add(ProjectModel(
            id=project_id,
            author_id=author_id,
            name=name,
            mode=mode,
            description=description,
            visibility=visibility,
            current_stage=current_stage,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ))
        session.commit()
        return project_id
    finally:
        session.close()


def _create_achievement_card(
    project_id: str,
    author_id: str,
    *,
    one_liner: str = "一段介绍",
    screenshots: str = '["a.png"]',
    capability_tags: str = '["coding"]',
) -> str:
    """给项目挂一张成果卡（用于 Demo 校验通过场景）"""
    from conftest import TestSessionLocal  # type: ignore
    from datetime import datetime, timezone

    session = TestSessionLocal()
    try:
        card_id = f"card_{uuid.uuid4().hex[:12]}"
        session.add(AchievementCardModel(
            id=card_id,
            project_id=project_id,
            author_id=author_id,
            title="成果卡标题",
            one_liner=one_liner,
            problem_solved="解决了什么",
            method_used="使用什么方法",
            screenshots=screenshots,
            reflection="学到了什么",
            capability_tags=capability_tags,
            project_mode="light",
            is_public=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ))
        session.commit()
        return card_id
    finally:
        session.close()


# =============================================================================
# Task 1：author_name 模糊搜索
# =============================================================================

class TestListForAdminAuthorNameFilter:

    def test_response_includes_author_name(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        project_id = _create_project_row(
            registered_user["id"],
            name="带作者名项目",
            current_stage="stage_08_evaluate",
        )

        resp = client.get(
            "/api/v1/projects/admin/featured?completed_only=true",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        items = resp.json()["data"]["items"]
        target = next((p for p in items if p["id"] == project_id), None)
        assert target is not None
        assert target["author_name"] == registered_user["name"]

    def test_author_name_ilike_match(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
        second_user: dict,
    ):
        # registered_user.name = "测试学生"，second_user.name = "第二学生"
        _create_project_row(registered_user["id"], name="AI 项目 A")
        _create_project_row(second_user["id"], name="AI 项目 B")

        # 按第一个用户姓名子串搜索
        resp = client.get(
            "/api/v1/projects/admin/featured?author_name=测试",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        items = resp.json()["data"]["items"]
        author_ids = {p["author_id"] for p in items}
        assert registered_user["id"] in author_ids
        assert second_user["id"] not in author_ids

    def test_author_name_and_search_combined(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
        second_user: dict,
    ):
        _create_project_row(registered_user["id"], name="AI 项目")
        _create_project_row(registered_user["id"], name="音乐项目")
        _create_project_row(second_user["id"], name="AI 项目 B")

        resp = client.get(
            "/api/v1/projects/admin/featured?search=AI&author_name=测试",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        items = resp.json()["data"]["items"]
        # 只应命中 registered_user 名下且项目名含 "AI" 的那一条
        assert len(items) == 1
        assert items[0]["author_id"] == registered_user["id"]
        assert "AI" in items[0]["name"]

    def test_author_id_priority_over_author_name(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
        second_user: dict,
    ):
        _create_project_row(registered_user["id"], name="Alpha")
        _create_project_row(second_user["id"], name="Beta")

        # 同时提供 author_id（指向 second_user）和 author_name（"测试" 匹配 registered_user）
        # author_id 应优先，返回 second_user 的项目
        resp = client.get(
            f"/api/v1/projects/admin/featured?author_id={second_user['id']}&author_name=测试",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        items = resp.json()["data"]["items"]
        assert len(items) == 1
        assert items[0]["author_id"] == second_user["id"]

    def test_non_admin_forbidden(
        self,
        client: TestClient,
        auth_headers: dict,
    ):
        resp = client.get(
            "/api/v1/projects/admin/featured?author_name=x",
            headers=auth_headers,
        )
        assert resp.status_code == 403


# =============================================================================
# Task 1.5：completed_only 过滤（精选管理"全部项目"页签只展示已完成阶段9/评估展示）
# =============================================================================

class TestListForAdminCompletedOnlyFilter:

    def test_completed_only_returns_stage08_projects_only(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        """completed_only=true 时只返回 current_stage=stage_08_evaluate 的项目。"""
        _create_project_row(registered_user["id"], name="开发中项目", current_stage="stage_07_execute")
        _create_project_row(registered_user["id"], name="脑暴项目", current_stage="stage_01_brainstorm")
        _create_project_row(registered_user["id"], name="已完成项目", current_stage="stage_08_evaluate")

        resp = client.get(
            "/api/v1/projects/admin/featured?completed_only=true",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["total"] == 1
        items = data["items"]
        assert len(items) == 1
        assert items[0]["name"] == "已完成项目"
        assert items[0]["current_stage"] == "stage_08_evaluate"

    def test_completed_only_false_includes_all_stages(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        """不传 completed_only（或 false）时保持原行为：各阶段项目都返回（mine/demo 页签不受影响）。"""
        _create_project_row(registered_user["id"], name="开发中项目", current_stage="stage_07_execute")
        _create_project_row(registered_user["id"], name="已完成项目", current_stage="stage_08_evaluate")

        resp = client.get(
            "/api/v1/projects/admin/featured?completed_only=false",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["total"] == 2
        stages = {item["current_stage"] for item in data["items"]}
        assert stages == {"stage_07_execute", "stage_08_evaluate"}

    def test_completed_only_combines_with_search(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        """completed_only 与项目名搜索叠加：仅命中已完成阶段9且名称匹配的项目。"""
        _create_project_row(registered_user["id"], name="AI 已完成项目", current_stage="stage_08_evaluate")
        _create_project_row(registered_user["id"], name="AI 开发中项目", current_stage="stage_07_execute")
        _create_project_row(registered_user["id"], name="音乐项目", current_stage="stage_08_evaluate")

        resp = client.get(
            "/api/v1/projects/admin/featured?completed_only=true&search=AI",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["total"] == 1
        assert data["items"][0]["name"] == "AI 已完成项目"


# =============================================================================
# Task 1.6：管理员查看他人项目/成果卡 + 项目响应携带成果卡摘要
# =============================================================================

class TestAdminViewOthersContent:

    def test_admin_can_get_other_users_project(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        """管理员可查看任意用户的项目详情（精选管理跳转成果卡页依赖）。"""
        project_id = _create_project_row(
            registered_user["id"],
            name="他人项目",
            current_stage="stage_08_evaluate",
        )
        resp = client.get(f"/api/v1/projects/{project_id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == project_id

    def test_non_admin_still_forbidden_to_view_others_project(
        self,
        client: TestClient,
        second_auth_headers: dict,
        registered_user: dict,
    ):
        """非作者且非 admin 仍无权查看他人项目（权限未过度放宽）。"""
        project_id = _create_project_row(registered_user["id"], name="他人项目 B")
        resp = client.get(f"/api/v1/projects/{project_id}", headers=second_auth_headers)
        assert resp.status_code == 403

    def test_admin_can_get_other_users_achievement_card(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        """管理员可获取任意用户项目的成果档案卡（跳转成果卡页依赖）。"""
        project_id = _create_project_row(
            registered_user["id"],
            name="他人项目 C",
            current_stage="stage_08_evaluate",
        )
        card_id = _create_achievement_card(project_id, registered_user["id"])
        resp = client.get(
            f"/api/v1/achievement-cards/projects/{project_id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == card_id

    def test_admin_project_list_includes_achievement_card_summary(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        """admin/featured 列表返回关联成果卡摘要，供前端"设为精品/跳转成果卡"。"""
        project_id = _create_project_row(
            registered_user["id"],
            name="带成果卡项目",
            current_stage="stage_08_evaluate",
        )
        card_id = _create_achievement_card(project_id, registered_user["id"])

        resp = client.get(
            "/api/v1/projects/admin/featured?completed_only=true",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        items = resp.json()["data"]["items"]
        target = next((p for p in items if p["id"] == project_id), None)
        assert target is not None
        assert target["achievement_card_id"] == card_id
        assert target["achievement_card_is_public"] is True
        assert target["achievement_card_is_featured"] is False


# =============================================================================
# Task 2：Demo 上线字段校验
# =============================================================================

class TestUpdateFeaturedDemoValidation:

    def test_set_demo_fails_when_no_achievement_card(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        """项目没有成果卡时，设为 Demo 应返回 422，缺失字段含 achievement_card"""
        project_id = _create_project_row(
            registered_user["id"],
            name="有名字",
            description="有描述",
            mode="light",
        )

        resp = client.patch(
            f"/api/v1/projects/{project_id}/featured",
            json={"is_featured_demo": True},
            headers=admin_headers,
        )
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert detail["code"] == "DEMO_FIELDS_INCOMPLETE"
        assert "achievement_card" in detail["details"]["missing_fields"]

    def test_set_demo_fails_when_screenshots_missing(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        """成果卡截图为空时应报错并列出 screenshots"""
        project_id = _create_project_row(
            registered_user["id"],
            name="项目 X",
            description="描述 X",
            mode="light",
        )
        _create_achievement_card(
            project_id,
            registered_user["id"],
            screenshots="[]",
        )

        resp = client.patch(
            f"/api/v1/projects/{project_id}/featured",
            json={"is_featured_demo": True},
            headers=admin_headers,
        )
        assert resp.status_code == 422
        missing = resp.json()["detail"]["details"]["missing_fields"]
        assert "screenshots" in missing

    def test_set_demo_fails_when_multiple_card_fields_missing(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        """成果卡多个字段（screenshots/capability_tags）同时缺失时应列出全部缺字段"""
        project_id = _create_project_row(
            registered_user["id"],
            name="项目 Y",
            description="描述 Y",
            mode="light",
        )
        _create_achievement_card(
            project_id,
            registered_user["id"],
            screenshots="[]",
            capability_tags="[]",
        )

        resp = client.patch(
            f"/api/v1/projects/{project_id}/featured",
            json={"is_featured_demo": True},
            headers=admin_headers,
        )
        assert resp.status_code == 422
        missing = resp.json()["detail"]["details"]["missing_fields"]
        assert "screenshots" in missing
        assert "capability_tags" in missing

    def test_set_demo_success_when_all_fields_ready(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        """字段齐全时应 200，项目变为 Demo"""
        project_id = _create_project_row(
            registered_user["id"],
            name="完备项目",
            description="完备描述",
            mode="light",
        )
        _create_achievement_card(project_id, registered_user["id"])

        resp = client.patch(
            f"/api/v1/projects/{project_id}/featured",
            json={"is_featured_demo": True},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["is_featured_demo"] is True

    def test_unset_demo_skips_validation(
        self,
        client: TestClient,
        admin_headers: dict,
        registered_user: dict,
    ):
        """取消 Demo（is_featured_demo=false）不触发字段校验，即便项目缺关联成果卡也应成功"""
        # 项目仅有本体基本字段、无成果卡，仍能取消 Demo
        project_id = _create_project_row(
            registered_user["id"],
            name="仅本体字段项目",
            description="仅本体字段描述",
            mode="light",
        )

        resp = client.patch(
            f"/api/v1/projects/{project_id}/featured",
            json={"is_featured_demo": False},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["is_featured_demo"] is False
