"""
内容节目展示子系统（Show）数据模型

用途：/api/v1/know 只读接口的响应模型，字段与 content/know 目录下
     series.json / episode.json 一一对应（服务端补全为可直接访问的 URL）
维护者：AI Agent
links: .trae/documents/产品与规划/13_内容节目展示子系统_产品与技术设计_V1.0.md
"""

from pydantic import BaseModel
from typing import Optional


class VideoResource(BaseModel):
    """外部嵌入视频（B 站等），服务器不存 mp4"""

    id: str
    audience: Optional[str] = None  # parent | child | None(通用)
    title: str
    embed_url: str
    page: Optional[str] = None  # 播放页原链（可选，供"去 B 站看"）


class DocResource(BaseModel):
    title: str
    url: str
    format: str = ""


class ProjectLink(BaseModel):
    title: str
    url: str
    note: str = ""


class InteractiveResource(BaseModel):
    title: str
    url: str
    ratio: str = "16/9"


class EpisodeResources(BaseModel):
    interactive: Optional[InteractiveResource] = None
    videos: list[VideoResource] = []
    docs: list[DocResource] = []
    projects: list[ProjectLink] = []


class EpisodeSummary(BaseModel):
    series_slug: str
    series_title: str
    brand: str  # jiwa | finestem
    theme_color: str = "#3E6B8C"
    slug: str
    episode_no: int
    title: str
    summary: str
    audience: str  # family | parent | child
    tags: list[str] = []
    published_at: Optional[str] = None
    cover: Optional[str] = None
    url: str  # 前端路由 /ep/<series>/<slug>
    has_interactive: bool = False
    video_audiences: list[str] = []
    has_docs: bool = False
    has_projects: bool = False


class EpisodeDetail(EpisodeSummary):
    description_md: str = ""
    announce: dict[str, str] = {}
    default_tab: Optional[str] = None
    resources: EpisodeResources = EpisodeResources()
    prev: Optional[EpisodeSummary] = None
    next: Optional[EpisodeSummary] = None


class SeriesSummary(BaseModel):
    slug: str
    title: str
    subtitle: str = ""
    brand: str
    description: str = ""
    tags: list[str] = []
    audience: str = "family"
    theme_color: str = "#3E6B8C"
    cover: Optional[str] = None
    url: str
    episode_count: int = 0
    latest_published_at: Optional[str] = None


class SeriesDetail(SeriesSummary):
    episodes: list[EpisodeSummary] = []
    docs: list[DocResource] = []


class FeaturedEpisode(BaseModel):
    note: str = ""
    episode: EpisodeSummary


class TagStat(BaseModel):
    name: str
    count: int


class KnowHome(BaseModel):
    site: dict
    featured: Optional[FeaturedEpisode] = None
    series: list[SeriesSummary] = []
    episodes: list[EpisodeSummary] = []  # 全部已发布节目（新→旧），首页客户端筛选用
    tags: list[TagStat] = []
