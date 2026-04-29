"""
fineSTEM 后端全量自动化测试配置

用途：pytest fixtures、测试客户端、数据清理
维护者：AI Agent
links: .trae/documents/testing/
"""

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-automated-testing")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("DATABASE_URL", "sqlite:///D:/data/finestem/test_finestem.db")
os.environ.setdefault("STORAGE_BASE_PATH", "D:/data/finestem/test_uploads")

from app.db.database import Base, get_db_session
from app.db.models import (
    UserModel,
    DemoModel,
    ProjectModel,
    SkillStateModel,
    AchievementCardModel,
    EvidenceModel,
    CourseModel,
    ProjectCapabilityTagModel,
    SkillRecordModel,
)
from main import app


TEST_DB_PATH = "D:/data/finestem/test_finestem.db"
TEST_ENGINE = create_engine(f"sqlite:///{TEST_DB_PATH}", connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(bind=TEST_ENGINE, autocommit=False, autoflush=False)


def _override_get_db_session():
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)
    TEST_ENGINE.dispose()
    try:
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)
    except PermissionError:
        pass


@pytest.fixture(autouse=True)
def clean_tables():
    session = TestSessionLocal()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
    finally:
        session.close()
    yield


@pytest.fixture(scope="module")
def client() -> Generator:
    from app.db import database as db_mod
    original = db_mod.get_db_session
    db_mod.get_db_session = _override_get_db_session
    from app.repositories.runtime_db import RepositoryBackedDB
    test_db = RepositoryBackedDB()
    from app.repositories import runtime_db as rt_mod
    original_rt_db = rt_mod.db
    rt_mod.db = test_db

    from app.api import auth as auth_mod
    auth_mod.db = test_db
    from app.api import demos as demos_mod
    demos_mod.db = test_db
    from app.api import projects as projects_mod
    projects_mod.db = test_db
    from app.api import achievement_cards as ac_mod
    ac_mod.db = test_db
    from app.api import evidence as ev_mod
    ev_mod.db = test_db
    from app.api import skills as skills_mod
    skills_mod.db = test_db

    with TestClient(app) as c:
        yield c

    db_mod.get_db_session = original
    rt_mod.db = original_rt_db
    auth_mod.db = original_rt_db
    demos_mod.db = original_rt_db
    projects_mod.db = original_rt_db
    ac_mod.db = original_rt_db
    ev_mod.db = original_rt_db
    skills_mod.db = original_rt_db
    cl_mod.db = original_rt_db


@pytest.fixture
def registered_user(client: TestClient) -> dict:
    email = f"test_{uuid.uuid4().hex[:8]}@finestem.test"
    resp = client.post("/api/v1/auth/register", json={
        "name": "测试学生",
        "email": email,
        "password": "TestPass123!",
    })
    assert resp.status_code == 200, f"注册失败: {resp.text}"
    data = resp.json()["data"]
    return {
        "id": data["user"]["id"],
        "email": email,
        "password": "TestPass123!",
        "token": data["access_token"],
        "name": "测试学生",
    }


@pytest.fixture
def auth_headers(registered_user: dict) -> dict:
    return {"Authorization": f"Bearer {registered_user['token']}"}


@pytest.fixture
def second_user(client: TestClient) -> dict:
    email = f"test2_{uuid.uuid4().hex[:8]}@finestem.test"
    resp = client.post("/api/v1/auth/register", json={
        "name": "第二学生",
        "email": email,
        "password": "TestPass456!",
    })
    data = resp.json()["data"]
    return {
        "id": data["user"]["id"],
        "email": email,
        "password": "TestPass456!",
        "token": data["access_token"],
        "name": "第二学生",
    }


@pytest.fixture
def second_auth_headers(second_user: dict) -> dict:
    return {"Authorization": f"Bearer {second_user['token']}"}


def _seed_demo(session) -> str:
    demo_id = f"demo_{uuid.uuid4().hex[:8]}"
    demo = DemoModel(
        id=demo_id,
        name="诗词生成器",
        description="基于 AI 的古诗词创作助手",
        tech_stack='["python", "ai"]',
        difficulty="beginner",
        subjects='["语文", "AI"]',
        grade_range="10-18岁",
        tags='["诗词", "AI"]',
        display_mode="iframe",
        iframe_url="https://example.com/demo",
        screenshots='["screenshot1.png"]',
        code_url="https://github.com/example/demo",
        download_url="https://github.com/example/demo/archive/main.zip",
        fork_template_id="tpl_poetry",
        is_public=True,
    )
    session.add(demo)
    session.commit()
    return demo_id


def _seed_demo_with_breakdown(session) -> str:
    demo_id = f"demo_{uuid.uuid4().hex[:8]}"
    demo = DemoModel(
        id=demo_id,
        name="智能计算器",
        description="支持科学计算的智能计算器",
        tech_stack='["javascript", "html"]',
        difficulty="intermediate",
        subjects='["数学", "编程"]',
        grade_range="12-18岁",
        tags='["计算器", "数学"]',
        display_mode="static",
        screenshots='["calc1.png", "calc2.png"]',
        project_breakdown="## 项目架构\n前端使用原生 JS 实现...",
        minimal_replica='{"entry_file":"index.html","files":{"index.html":"<h1>Calculator</h1>","src/main.js":"console.log(\'calc\');"}}',
        code_url="https://github.com/example/calc",
        download_url="https://github.com/example/calc/archive/main.zip",
        is_public=True,
    )
    session.add(demo)
    session.commit()
    return demo_id


@pytest.fixture
def seeded_demo_id() -> str:
    session = TestSessionLocal()
    try:
        return _seed_demo(session)
    finally:
        session.close()


@pytest.fixture
def seeded_demo_with_breakdown_id() -> str:
    session = TestSessionLocal()
    try:
        return _seed_demo_with_breakdown(session)
    finally:
        session.close()


@pytest.fixture
def created_project(client: TestClient, auth_headers: dict, seeded_demo_id: str) -> dict:
    resp = client.post("/api/v1/projects", json={
        "name": "我的测试项目",
        "mode": "light",
        "from_demo_id": seeded_demo_id,
    }, headers=auth_headers)
    assert resp.status_code == 200, f"创建项目失败: {resp.text}"
    return resp.json()["data"]
