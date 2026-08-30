"""
内容节目展示子系统 API 路由

用途：Know 频道（know.wostemstudio.site）的只读公开接口，数据来自
     content/know 内容目录（content-as-code），无用户态、无写操作。
维护者：AI Agent
links: .trae/documents/产品与规划/13_内容节目展示子系统_产品与技术设计_V1.0.md
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.schemas.common import ApiResponse
from app.schemas.know import EpisodeDetail, EpisodeSummary, SeriesDetail, SeriesSummary, KnowHome
from app.services.know_content import KnowContentService, get_know_content_service

router = APIRouter(prefix="/know", tags=["节目频道"])


@router.get("/home", response_model=ApiResponse[KnowHome])
async def show_home(svc: KnowContentService = Depends(get_know_content_service)):
    """频道首页数据：站点信息 + 本期主打 + 全部系列 + 全部节目 + 标签云。"""
    return ApiResponse(data=svc.home())


@router.get("/series", response_model=ApiResponse[list[SeriesSummary]])
async def list_series(svc: KnowContentService = Depends(get_know_content_service)):
    """系列列表。"""
    return ApiResponse(data=svc.list_series())


@router.get("/series/{slug}", response_model=ApiResponse[SeriesDetail])
async def get_series(slug: str, svc: KnowContentService = Depends(get_know_content_service)):
    """系列详情（含集列表）。"""
    data = svc.get_series(slug)
    if data is None:
        raise HTTPException(status_code=404, detail="系列不存在")
    return ApiResponse(data=data)


@router.get("/episodes", response_model=ApiResponse[list[EpisodeSummary]])
async def list_episodes(
    q: Optional[str] = Query(default=None, description="标题/摘要/标签/系列名包含匹配"),
    tag: Optional[list[str]] = Query(default=None, description="标签，多值任一命中"),
    audience: Optional[str] = Query(default=None, description="parent | child | family"),
    series: Optional[str] = Query(default=None, description="系列 slug"),
    svc: KnowContentService = Depends(get_know_content_service),
):
    """节目筛选列表（首页一次拉全量后客户端过滤，此接口供搜索扩展与 SEO 预留）。"""
    if audience is not None and audience not in ("parent", "child", "family"):
        raise HTTPException(status_code=422, detail="audience 仅支持 parent/child/family")
    return ApiResponse(data=svc.list_episodes(q=q, tags=tag, audience=audience, series_slug=series))


@router.get("/episodes/{series_slug}/{slug}", response_model=ApiResponse[EpisodeDetail])
async def get_episode(
    series_slug: str,
    slug: str,
    svc: KnowContentService = Depends(get_know_content_service),
):
    """节目详情：说明、资源清单（互动/嵌入视频/资料/相关项目）、上下集。"""
    data = svc.get_episode(series_slug, slug)
    if data is None:
        raise HTTPException(status_code=404, detail="节目不存在")
    return ApiResponse(data=data)
