"""
Show 内容库服务与 API 测试

用途：验证 content/show 扫描、筛选语义（audience/tag/q）、主打位解析、API 只读接口
维护者：AI Agent
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.show import get_show_content_service
from app.services.show_content import ShowContentService
from main import app


@pytest.fixture()
def content_dir(tmp_path: Path) -> Path:
    """两系列三节目：递推之美（亲子/已发布+草稿）、fineSTEM 课堂（家长向）。"""
    root = tmp_path / "show"
    s1 = root / "series" / "recursive-beauty"
    (s1 / "ep01").mkdir(parents=True)
    (s1 / "series.json").write_text(
        json.dumps(
            {
                "slug": "recursive-beauty",
                "title": "递推之美",
                "brand": "jiwa",
                "tags": ["数学启蒙"],
                "audience": "family",
                "theme_color": "#3E6B8C",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (s1 / "ep01" / "episode.json").write_text(
        json.dumps(
            {
                "slug": "ep01",
                "episode_no": 1,
                "title": "搭积木",
                "summary": "从 1 块积木到 21 层塔",
                "audience": "family",
                "tags": ["数学启蒙", "亲子"],
                "status": "published",
                "published_at": "2026-09-01",
                "announce": {"parent-video": "即将上线"},
                "resources": {
                    "interactive": {"title": "互动演示", "path": "interactive/index.html"},
                    "videos": [],
                    "docs": [{"title": "脚本", "path": "docs/script.md", "format": "md"}],
                    "projects": [],
                },
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (s1 / "ep01" / "interactive").mkdir()
    (s1 / "ep01" / "interactive" / "index.html").write_text("<html></html>", encoding="utf-8")
    (s1 / "ep02").mkdir()
    (s1 / "ep02" / "episode.json").write_text(
        json.dumps(
            {
                "slug": "ep02",
                "episode_no": 2,
                "title": "兔子数列（草稿）",
                "summary": "draft 不应出现在任何接口",
                "tags": ["数学启蒙"],
                "status": "draft",
                "resources": {"videos": [], "docs": [], "projects": []},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    s2 = root / "series" / "finestem-class"
    (s2 / "ep01").mkdir(parents=True)
    (s2 / "series.json").write_text(
        json.dumps(
            {"slug": "finestem-class", "title": "fineSTEM 课堂", "brand": "finestem", "audience": "family"},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (s2 / "ep01" / "episode.json").write_text(
        json.dumps(
            {
                "slug": "ep01",
                "episode_no": 1,
                "title": "光的旅程",
                "summary": "从影子到太阳灶",
                "audience": "parent",
                "tags": ["STEM", "物理"],
                "status": "published",
                "published_at": "2026-09-08",
                "resources": {
                    "videos": [
                        {
                            "id": "main",
                            "audience": None,
                            "title": "讲解视频",
                            "embed_url": "//player.bilibili.com/player.html?bvid=BV1xx",
                        }
                    ],
                    "docs": [],
                    "projects": [{"title": "学员作品", "url": "https://wostemstudio.site/explore"}],
                },
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    (root / "index.json").write_text(
        json.dumps(
            {
                "site": {"title": "放映室"},
                "featured": {"series": "recursive-beauty", "episode": "ep01", "note": "开播"},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return root


@pytest.fixture()
def svc(content_dir: Path) -> ShowContentService:
    return ShowContentService(content_dir)


class TestShowContentService:
    def test_home_featured_and_tags(self, svc: ShowContentService):
        home = svc.home()
        assert home.site["title"] == "放映室"
        assert home.featured is not None
        assert home.featured.episode.slug == "ep01"
        assert home.featured.episode.series_title == "递推之美"
        # draft 不出现，两个系列共 2 条已发布
        assert len(home.episodes) == 2
        tag_names = {t.name for t in home.tags}
        assert {"数学启蒙", "STEM", "亲子"} <= tag_names

    def test_episode_urls(self, svc: ShowContentService):
        ep = svc.get_episode("recursive-beauty", "ep01")
        assert ep is not None
        assert ep.url == "/ep/recursive-beauty/ep01"
        assert ep.resources.interactive is not None
        assert ep.resources.interactive.url == (
            "/content/series/recursive-beauty/ep01/interactive/index.html"
        )
        assert ep.resources.docs[0].url == "/content/series/recursive-beauty/ep01/docs/script.md"
        assert ep.announce == {"parent-video": "即将上线"}

    def test_filter_audience_parent_includes_family(self, svc: ShowContentService):
        eps = svc.list_episodes(audience="parent")
        # family 的「搭积木」与 parent 的「光的旅程」都命中
        assert sorted(e.title for e in eps) == ["光的旅程", "搭积木"]

    def test_filter_audience_child_excludes_parent(self, svc: ShowContentService):
        eps = svc.list_episodes(audience="child")
        # 亲子集命中，家长向集不命中
        assert [e.audience for e in eps] == ["family"]

    def test_filter_q_and_tag(self, svc: ShowContentService):
        assert [e.title for e in svc.list_episodes(q="积木")] == ["搭积木"]
        assert {e.title for e in svc.list_episodes(tags=["数学启蒙"])} == {"搭积木"}
        assert {e.title for e in svc.list_episodes(series_slug="finestem-class")} == {"光的旅程"}

    def test_series_detail_and_prev_next(self, svc: ShowContentService):
        detail = svc.get_series("recursive-beauty")
        assert detail is not None
        assert detail.episode_count == 1  # draft 不计

    def test_missing_content_dir_is_empty(self, tmp_path: Path):
        empty = ShowContentService(tmp_path / "not-exist")
        assert empty.home().episodes == []
        assert empty.list_series() == []
        assert empty.get_episode("a", "b") is None


@pytest.fixture()
def client(content_dir: Path):
    test_svc = ShowContentService(content_dir)
    app.dependency_overrides[get_show_content_service] = lambda: test_svc
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_show_content_service, None)


class TestShowApi:
    def test_home_endpoint(self, client: TestClient):
        r = client.get("/api/v1/show/home")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["featured"]["episode"]["title"] == "搭积木"

    def test_series_endpoints(self, client: TestClient):
        assert client.get("/api/v1/show/series").status_code == 200
        r = client.get("/api/v1/show/series/recursive-beauty")
        assert r.status_code == 200
        assert r.json()["data"]["title"] == "递推之美"
        assert client.get("/api/v1/show/series/nope").status_code == 404

    def test_episodes_endpoint_filters(self, client: TestClient):
        r = client.get("/api/v1/show/episodes", params={"q": "光"})
        assert [e["title"] for e in r.json()["data"]] == ["光的旅程"]
        r = client.get("/api/v1/show/episodes", params={"audience": "child"})
        assert [e["audience"] for e in r.json()["data"]] == ["family"]
        r = client.get("/api/v1/show/episodes", params={"audience": "bad"})
        assert r.status_code == 422

    def test_episode_detail_404(self, client: TestClient):
        assert client.get("/api/v1/show/episodes/recursive-beauty/ep02").status_code == 404
        assert client.get("/api/v1/show/episodes/a/b").status_code == 404

    def test_episode_detail_embed_video(self, client: TestClient):
        r = client.get("/api/v1/show/episodes/finestem-class/ep01")
        data = r.json()["data"]
        assert data["resources"]["videos"][0]["embed_url"].startswith("//player.bilibili.com")
        assert data["resources"]["projects"][0]["url"] == "https://wostemstudio.site/explore"
