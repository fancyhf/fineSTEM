"""
Show 内容库服务（内容节目展示子系统）

用途：扫描 content/show 目录（content-as-code），为 /api/v1/show 提供只读数据。
     目录不存在或结构不完整时优雅降级为空数据，不影响主站服务。
设计：.trae/documents/产品与规划/13_内容节目展示子系统_产品与技术设计_V1.0.md
维护者：AI Agent
"""

import json
import logging
import threading
from pathlib import Path
from typing import Optional

from app.schemas.show import (
    DocResource,
    EpisodeDetail,
    EpisodeResources,
    EpisodeSummary,
    FeaturedEpisode,
    InteractiveResource,
    ProjectLink,
    SeriesDetail,
    SeriesSummary,
    ShowHome,
    TagStat,
    VideoResource,
)

logger = logging.getLogger(__name__)

# 内容静态资源 URL 前缀（与 nginx location /content/ 对应，开发环境由后端 mount）
CONTENT_URL_PREFIX = "/content"


def _read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _content_url(*parts: str) -> str:
    return CONTENT_URL_PREFIX + "/" + "/".join(p.strip("/\\") for p in parts)


class _SeriesRecord:
    """单个系列的原始数据 + 已解析节目列表（仅内部使用）"""

    def __init__(self, meta: dict, dir_path: Path):
        self.meta = meta
        self.dir_path = dir_path
        self.episodes: list[dict] = []  # 每个 dict 为 episode.json 原文 + _dir 字段


class ShowContentService:
    """
    内容库只读查询服务。

    - 启动后首次访问触发扫描，之后按 *.json 文件指纹（路径+mtime）判断是否重扫，
      发布新内容（rsync 目录）后无需重启进程。
    - 线程安全：扫描在锁内完成，读取无锁（发布后引用切换，Python 引用赋值原子）。
    """

    def __init__(self, root: Path):
        self.root = Path(root)
        self._lock = threading.Lock()
        self._fingerprint: Optional[tuple] = None
        self._series: dict[str, _SeriesRecord] = {}
        self._index_meta: dict = {}

    # ── 扫描与缓存 ──────────────────────────────────────────────

    def _compute_fingerprint(self) -> tuple:
        if not self.root.is_dir():
            return ()
        items = []
        for p in sorted(self.root.rglob("*.json")):
            try:
                items.append((str(p.relative_to(self.root)), p.stat().st_mtime_ns))
            except OSError:
                continue
        return tuple(items)

    def _ensure_loaded(self) -> None:
        fp = self._compute_fingerprint()
        if self._series or self._index_meta:
            if fp == self._fingerprint:
                return
        with self._lock:
            fp2 = self._compute_fingerprint()
            if self._series or self._index_meta:
                if fp2 == self._fingerprint:
                    return
            try:
                self._scan()
            except Exception:
                logger.exception("show_content_scan_failed root=%s", self.root)
            self._fingerprint = fp2

    def _scan(self) -> None:
        series: dict[str, _SeriesRecord] = {}
        if self.root.is_dir():
            for sdir in sorted(self.root.glob("series/*")):
                if not sdir.is_dir():
                    continue
                meta_path = sdir / "series.json"
                if not meta_path.is_file():
                    continue
                try:
                    meta = _read_json(meta_path)
                except (json.JSONDecodeError, OSError):
                    logger.exception("show_series_json_invalid dir=%s", sdir)
                    continue
                slug = str(meta.get("slug") or sdir.name)
                rec = _SeriesRecord(meta, sdir)
                for edir in sorted(sdir.iterdir()):
                    ep_path = edir / "episode.json"
                    if not edir.is_dir() or not ep_path.is_file():
                        continue
                    try:
                        ep = _read_json(ep_path)
                    except (json.JSONDecodeError, OSError):
                        logger.exception("show_episode_json_invalid dir=%s", edir)
                        continue
                    ep["_dir_name"] = edir.name
                    rec.episodes.append(ep)
                series[slug] = rec

        index_path = self.root / "index.json"
        index_meta: dict = {}
        if index_path.is_file():
            try:
                index_meta = _read_json(index_path)
            except (json.JSONDecodeError, OSError):
                logger.exception("show_index_json_invalid path=%s", index_path)

        self._series = series
        self._index_meta = index_meta

    # ── 组装 ──────────────────────────────────────────────

    def _sort_episodes(self, eps: list[dict]) -> list[dict]:
        return sorted(
            eps,
            key=lambda e: (str(e.get("published_at") or ""), e.get("episode_no") or 0),
            reverse=True,
        )

    def _published_episodes(self, rec: _SeriesRecord) -> list[dict]:
        return [e for e in rec.episodes if e.get("status", "published") == "published"]

    def _episode_cover(self, rec: _SeriesRecord, ep: dict) -> Optional[str]:
        cover = ep.get("cover")
        if cover:
            return _content_url("series", rec.meta.get("slug", ""), ep["_dir_name"], cover)
        return None

    def _series_cover(self, rec: _SeriesRecord) -> Optional[str]:
        cover = rec.meta.get("cover")
        if cover:
            return _content_url("series", rec.meta.get("slug", ""), cover)
        eps = self._sort_episodes(self._published_episodes(rec))
        if eps:
            return self._episode_cover(rec, eps[0])
        return None

    def _episode_summary(self, rec: _SeriesRecord, ep: dict) -> EpisodeSummary:
        res = ep.get("resources") or {}
        videos = res.get("videos") or []
        slug = str(ep.get("slug") or ep["_dir_name"])
        return EpisodeSummary(
            series_slug=str(rec.meta.get("slug") or rec.dir_path.name),
            series_title=str(rec.meta.get("title") or rec.dir_path.name),
            brand=str(rec.meta.get("brand") or ""),
            theme_color=str(rec.meta.get("theme_color") or "#3E6B8C"),
            slug=slug,
            episode_no=int(ep.get("episode_no") or 0),
            title=str(ep.get("title") or slug),
            summary=str(ep.get("summary") or ""),
            audience=str(ep.get("audience") or rec.meta.get("audience") or "family"),
            tags=[str(t) for t in (ep.get("tags") or [])],
            published_at=ep.get("published_at"),
            cover=self._episode_cover(rec, ep),
            url=f"/ep/{rec.meta.get('slug', rec.dir_path.name)}/{slug}",
            has_interactive=bool(res.get("interactive")),
            video_audiences=sorted(
                {v.get("audience") for v in videos if v.get("audience")} - {""}
            ) or (["video"] if videos else []),
            has_docs=bool(res.get("docs")),
            has_projects=bool(res.get("projects")),
        )

    def _episode_detail(self, rec: _SeriesRecord, ep: dict) -> EpisodeDetail:
        res = ep.get("resources") or {}
        sslug = str(rec.meta.get("slug") or rec.dir_path.name)
        edir = ep["_dir_name"]

        interactive = None
        if res.get("interactive"):
            it = res["interactive"]
            interactive = InteractiveResource(
                title=str(it.get("title") or "互动演示"),
                url=_content_url("series", sslug, edir, str(it.get("path") or "")),
                ratio=str(it.get("ratio") or "16/9"),
            )

        videos = [
            VideoResource(
                id=str(v.get("id") or f"video-{i}"),
                audience=v.get("audience"),
                title=str(v.get("title") or "视频"),
                embed_url=str(v.get("embed_url") or ""),
                page=v.get("page"),
            )
            for i, v in enumerate(res.get("videos") or [])
            if v.get("embed_url")
        ]

        docs = [
            DocResource(
                title=str(d.get("title") or d.get("path") or "资料"),
                url=_content_url("series", sslug, edir, str(d.get("path") or "")),
                format=str(d.get("format") or ""),
            )
            for d in (res.get("docs") or [])
            if d.get("path")
        ]

        projects = [
            ProjectLink(
                title=str(p.get("title") or p.get("url") or "相关项目"),
                url=str(p.get("url") or ""),
                note=str(p.get("note") or ""),
            )
            for p in (res.get("projects") or [])
            if p.get("url")
        ]

        summary = self._episode_summary(rec, ep)

        # 上/下一集：同系列按集数相邻
        siblings = sorted(
            self._published_episodes(rec), key=lambda e: e.get("episode_no") or 0
        )
        prev_ep = next_ep = None
        for i, e in enumerate(siblings):
            if e is ep:
                prev_ep = siblings[i - 1] if i > 0 else None
                next_ep = siblings[i + 1] if i + 1 < len(siblings) else None
                break

        return EpisodeDetail(
            **summary.model_dump(),
            description_md=str(ep.get("description_md") or ""),
            announce={str(k): str(v) for k, v in (ep.get("announce") or {}).items()},
            default_tab=ep.get("default_tab"),
            resources=EpisodeResources(
                interactive=interactive, videos=videos, docs=docs, projects=projects
            ),
            prev=self._episode_summary(rec, prev_ep) if prev_ep else None,
            next=self._episode_summary(rec, next_ep) if next_ep else None,
        )

    def _series_summary(self, rec: _SeriesRecord) -> SeriesSummary:
        eps = self._published_episodes(rec)
        sorted_eps = self._sort_episodes(eps)
        slug = str(rec.meta.get("slug") or rec.dir_path.name)
        return SeriesSummary(
            slug=slug,
            title=str(rec.meta.get("title") or slug),
            subtitle=str(rec.meta.get("subtitle") or ""),
            brand=str(rec.meta.get("brand") or ""),
            description=str(rec.meta.get("description") or ""),
            tags=[str(t) for t in (rec.meta.get("tags") or [])],
            audience=str(rec.meta.get("audience") or "family"),
            theme_color=str(rec.meta.get("theme_color") or "#3E6B8C"),
            cover=self._series_cover(rec),
            url=f"/series/{slug}",
            episode_count=len(eps),
            latest_published_at=sorted_eps[0].get("published_at") if sorted_eps else None,
        )

    # ── 公开查询 ──────────────────────────────────────────────

    def home(self) -> ShowHome:
        self._ensure_loaded()
        site = dict(self._index_meta.get("site") or {})
        series = [self._series_summary(r) for r in self._series.values()]

        all_eps: list[EpisodeSummary] = []
        for rec in self._series.values():
            for ep in self._sort_episodes(self._published_episodes(rec)):
                all_eps.append(self._episode_summary(rec, ep))
        all_eps.sort(key=lambda e: (e.published_at or "", e.episode_no), reverse=True)

        tag_counts: dict[str, int] = {}
        for e in all_eps:
            for t in e.tags:
                tag_counts[t] = tag_counts.get(t, 0) + 1
        tags = [TagStat(name=k, count=v) for k, v in sorted(tag_counts.items(), key=lambda kv: (-kv[1], kv[0]))]

        featured = None
        f = self._index_meta.get("featured") or {}
        rec = self._series.get(str(f.get("series") or ""))
        if rec:
            for ep in self._published_episodes(rec):
                if str(ep.get("slug") or ep["_dir_name"]) == str(f.get("episode")):
                    featured = FeaturedEpisode(
                        note=str(f.get("note") or ""),
                        episode=self._episode_summary(rec, ep),
                    )
                    break

        return ShowHome(
            site=site, featured=featured, series=series, episodes=all_eps, tags=tags
        )

    def list_series(self) -> list[SeriesSummary]:
        self._ensure_loaded()
        return [self._series_summary(r) for r in self._series.values()]

    def get_series(self, slug: str) -> Optional[SeriesDetail]:
        self._ensure_loaded()
        rec = self._series.get(slug)
        if not rec:
            return None
        summary = self._series_summary(rec)
        episodes = [
            self._episode_summary(rec, ep)
            for ep in self._sort_episodes(self._published_episodes(rec))
        ]
        docs = [
            DocResource(
                title=str(d.get("title") or d.get("path") or "资料"),
                url=_content_url("series", slug, str(d.get("path") or "")),
                format=str(d.get("format") or ""),
            )
            for d in (rec.meta.get("docs") or [])
            if d.get("path")
        ]
        return SeriesDetail(**summary.model_dump(), episodes=episodes, docs=docs)

    def list_episodes(
        self,
        q: Optional[str] = None,
        tags: Optional[list[str]] = None,
        audience: Optional[str] = None,
        series_slug: Optional[str] = None,
    ) -> list[EpisodeSummary]:
        """节目筛选。q 命中标题/摘要/标签/系列名；audience 为 parent/child 时包含 family。"""
        self._ensure_loaded()
        result: list[EpisodeSummary] = []
        for sslug, rec in self._series.items():
            if series_slug and sslug != series_slug:
                continue
            for ep in self._sort_episodes(self._published_episodes(rec)):
                e = self._episode_summary(rec, ep)
                if q:
                    needle = q.strip().lower()
                    haystack = " ".join(
                        [e.title, e.summary, e.series_title, " ".join(e.tags)]
                    ).lower()
                    if needle and needle not in haystack:
                        continue
                if tags:
                    if not ({t for t in tags} & set(e.tags)):
                        continue
                if audience:
                    allow = {"family"}
                    if audience == "parent":
                        allow.add("parent")
                    elif audience == "child":
                        allow.add("child")
                    else:
                        allow.add(audience)
                    if e.audience not in allow:
                        continue
                result.append(e)
        result.sort(key=lambda e: (e.published_at or "", e.episode_no), reverse=True)
        return result

    def get_episode(self, series_slug: str, slug: str) -> Optional[EpisodeDetail]:
        self._ensure_loaded()
        rec = self._series.get(series_slug)
        if not rec:
            return None
        for ep in rec.episodes:
            if ep.get("status", "published") != "published":
                continue
            if str(ep.get("slug") or ep["_dir_name"]) == slug:
                return self._episode_detail(rec, ep)
        return None


# ── 进程级单例与依赖注入 ──────────────────────────────────────

_default_service: Optional[ShowContentService] = None


def get_show_content_service() -> ShowContentService:
    """FastAPI 依赖：默认指向配置的内容目录；测试可用 dependency_overrides 替换。"""
    global _default_service
    if _default_service is None:
        from app.core.config import settings

        # 默认仓库根 content/show（…/apps/backend/app/services → 上溯 4 级到仓库根）
        root = settings.SHOW_CONTENT_DIR or (
            Path(__file__).resolve().parents[4] / "content" / "show"
        )
        _default_service = ShowContentService(root)
    return _default_service


def set_show_content_service(service: Optional[ShowContentService]) -> None:
    """测试/运维：替换或重置进程级单例。"""
    global _default_service
    _default_service = service
