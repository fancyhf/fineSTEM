"""
成果档案卡 API 路由

用途：创建、查看、分享成果档案卡
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from typing import Optional
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from app.schemas.achievements import (
    AchievementCard,
    AchievementCardCreate,
    AchievementCardUpdate,
    FeaturedCard,
    FeatureRequest,
    ShareTokenResponse,
)
from app.schemas.common import ApiResponse, PaginationResult
from app.schemas.auth import UserResponse
from app.repositories.runtime_db import db
from app.api.auth import get_current_user, get_optional_current_user, require_admin
from app.services.providers.image_provider import generate_cover_image
from app.services.storage_service import storage_service
from app.schemas.projects import Project

router = APIRouter(prefix="/achievement-cards", tags=["成果档案卡"])


def _difficulty_rank(value: str) -> int:
    mapping = {"beginner": 1, "intermediate": 2, "advanced": 3}
    return mapping.get(value, 2)


def _difficulty_by_rank(rank: int) -> str:
    reverse = {1: "beginner", 2: "intermediate", 3: "advanced"}
    return reverse.get(rank, "intermediate")


@router.post("/projects/{project_id}", response_model=ApiResponse[AchievementCard])
async def create_achievement_card(
    project_id: str,
    card_data: AchievementCardCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    为项目创建成果档案卡
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )
    if project.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此项目",
        )
    
    card = AchievementCard(
        project_id=project_id,
        author_id=current_user.id,
        title=card_data.title,
        one_liner=card_data.one_liner,
        problem_solved=card_data.problem_solved,
        method_used=card_data.method_used,
        screenshots=card_data.screenshots,
        reflection=card_data.reflection,
        capability_tags=card_data.capability_tags,
        project_mode=card_data.project_mode,
        created_by=current_user.id,
    )
    
    created_card = db.create_achievement_card(card)
    return ApiResponse(data=created_card, message="创建成功")


@router.get("/projects/{project_id}", response_model=ApiResponse[Optional[AchievementCard]])
async def get_project_achievement_card(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取项目的成果档案卡
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )
    if project.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此项目",
        )
    
    card = db.get_achievement_card_by_project(project_id)
    return ApiResponse(data=card, message="获取成功")


@router.patch("/{card_id}", response_model=ApiResponse[AchievementCard])
async def update_achievement_card(
    card_id: str,
    card_update: AchievementCardUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    更新成果档案卡
    """
    card = db.get_achievement_card(card_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="档案卡不存在",
        )
    if card.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此档案卡",
        )
    
    update_data = card_update.model_dump(exclude_unset=True)
    updated_card = db.update_achievement_card(card_id, update_data)
    return ApiResponse(data=updated_card, message="更新成功")


@router.post("/{card_id}/share", response_model=ApiResponse[ShareTokenResponse])
async def create_share_link(
    card_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    生成私有分享链接
    """
    card = db.get_achievement_card(card_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="档案卡不存在",
        )
    if card.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此档案卡",
        )
    
    token = db.create_share_token(card_id)
    share_url = f"/share/{token}"
    
    return ApiResponse(
        data=ShareTokenResponse(share_token=token, share_url=share_url),
        message="分享链接生成成功",
    )


@router.get("/share/{token}", response_model=ApiResponse[AchievementCard])
async def get_shared_achievement_card(token: str):
    """
    通过分享链接查看（无需登录）
    """
    card = db.get_achievement_card_by_share_token(token)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分享链接无效",
        )
    
    return ApiResponse(data=card, message="获取成功")


@router.post("/{card_id}/submit-public", response_model=ApiResponse[AchievementCard])
async def submit_for_public(card_id: str, current_user: UserResponse = Depends(get_current_user)):
    """
    发布到灵感墙（学生自主开关）
    """
    card = db.get_achievement_card(card_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="档案卡不存在",
        )
    if card.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此档案卡",
        )
    
    updated_card = db.update_achievement_card(
        card_id,
        {"is_public": True, "submitted_at": card.updated_at},
    )
    return ApiResponse(data=updated_card, message="发布成功")


@router.post("/{card_id}/withdraw-public", response_model=ApiResponse[AchievementCard])
async def withdraw_from_public(card_id: str, current_user: UserResponse = Depends(get_current_user)):
    card = db.get_achievement_card(card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="档案卡不存在")
    if card.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此档案卡")
    updated_card = db.update_achievement_card(card_id, {"is_public": False})
    return ApiResponse(data=updated_card, message="已从灵感墙撤回")


@router.post("/{card_id}/admin-withdraw", response_model=ApiResponse[AchievementCard])
async def admin_withdraw_from_public(card_id: str, admin: UserResponse = Depends(require_admin)):
    """
    管理员强制将档案卡从灵感墙下架（不校验作者身份）。

    - 触发场景：管理员在“精选管理 - 全部项目”中判定内容不合规。
    - 副作用：若卡片当前是精选，同时清除精选标记与排序，避免精选残留。
    """
    card = db.get_achievement_card(card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="档案卡不存在")

    # 先撤回精选（若有），再下架公开
    if card.is_featured:
        db.set_card_featured(card_id, featured=False, sort_order=0)
    updated_card = db.update_achievement_card(card_id, {"is_public": False})
    return ApiResponse(data=updated_card, message="已由管理员强制下架")


@router.post("/{card_id}/fork-project", response_model=ApiResponse[Project])
async def fork_project_from_card(card_id: str, current_user: UserResponse = Depends(get_current_user)):
    card = db.get_achievement_card(card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="档案卡不存在")
    source_project = db.get_project(card.project_id)
    if not source_project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="原项目不存在")

    project = Project(
        id=str(uuid.uuid4()),
        name=f"{source_project.name} - Fork",
        mode=source_project.mode,
        from_demo_id=source_project.from_demo_id,
        initial_data=getattr(source_project, "initial_data", {}) or {},
        author_id=current_user.id,
        current_stage="stage_01_brainstorm",
        created_by=current_user.id,
    )
    created_project = db.create_project(project)
    if source_state := db.get_skill_state(source_project.id):
        copied_state = source_state.model_copy(deep=True)
        copied_state.project_id = created_project.id
        copied_state.current_stage = "stage_01_brainstorm"
        copied_state.stage_history = [{"stage": "stage_01_brainstorm", "started_at": copied_state.updated_at.isoformat()}]
        db.create_skill_state(copied_state)
    return ApiResponse(data=created_project, message="Fork 成功")


@router.get("/inspiration-wall", response_model=ApiResponse[PaginationResult[AchievementCard]])
async def get_inspiration_wall(
    page: int = 1,
    page_size: int = 20,
    capability_tag: Optional[str] = None,
    project_mode: Optional[str] = None,
    sort_by: Optional[str] = "latest",
    mine: bool = False,
    author_id: Optional[str] = None,
    keyword: Optional[str] = None,
    author_username: Optional[str] = None,
    current_user: Optional[UserResponse] = Depends(get_optional_current_user),
):
    """
    灵感墙（公开的成果档案卡）

    - `mine=true`：仅返回当前登录用户的作品（需登录）。
    - `author_id`：按指定作者过滤（管理员场景），若同时传入 mine，则 mine 优先。
    - `keyword`：按标题/一句话简介模糊搜索。
    - `author_username`：按作者名字模糊搜索（当 mine=true 时忽略）。
    """
    effective_author_id = current_user.id if mine and current_user else author_id
    effective_author_username = None if mine else author_username
    skip = (page - 1) * page_size
    cards = db.list_public_achievement_cards(
        skip=skip,
        limit=page_size,
        capability_tag=capability_tag,
        project_mode=project_mode,
        author_id=effective_author_id,
        keyword=keyword,
        author_username=effective_author_username,
    )
    total = db.count_public_achievement_cards(
        capability_tag=capability_tag,
        project_mode=project_mode,
        author_id=effective_author_id,
        keyword=keyword,
        author_username=effective_author_username,
    )
    total_pages = (total + page_size - 1) // page_size
    
    return ApiResponse(
        data=PaginationResult(
            items=cards,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ),
        message="获取成功",
    )


@router.get("/featured", response_model=ApiResponse[PaginationResult[FeaturedCard]])
async def get_featured_cards(
    page: int = 1,
    page_size: int = 20,
):
    """
    首页精选作品（无需登录）

    返回管理员精选的公开成果档案卡，并附带关联项目的关键信息。
    """
    skip = (page - 1) * page_size
    cards = db.list_featured_cards(skip=skip, limit=page_size)
    total = db.count_featured_cards()
    total_pages = (total + page_size - 1) // page_size

    featured_items: list[FeaturedCard] = []
    for card in cards:
        project = db.get_project(card.project_id) if card.project_id else None
        featured_items.append(
            FeaturedCard(
                **card.model_dump(),
                project_name=project.name if project else None,
                project_stage=project.current_stage if project else None,
            )
        )

    return ApiResponse(
        data=PaginationResult(
            items=featured_items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ),
        message="获取成功",
    )


@router.post("/{card_id}/feature", response_model=ApiResponse[AchievementCard])
async def set_card_featured(
    card_id: str,
    payload: FeatureRequest,
    admin: UserResponse = Depends(require_admin),
):
    """
    管理员设置/取消精选（需管理员权限）
    """
    card = db.get_achievement_card(card_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="档案卡不存在",
        )
    if payload.featured and not card.is_public:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅可精选已发布到灵感墙的档案卡",
        )

    updated_card = db.set_card_featured(
        card_id,
        featured=payload.featured,
        sort_order=payload.sort_order,
    )
    if not updated_card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="档案卡不存在",
        )
    return ApiResponse(data=updated_card, message="精选设置成功" if payload.featured else "已取消精选")


def _recommend_capability_tags(project_name: str, current_stage: str) -> list[str]:
    """基于项目名称/阶段关键词推荐能力标签（与 capability_tags.py 的规则一致，独立实现避免循环依赖）。"""
    source = f"{project_name} {current_stage}".lower()
    tags: list[str] = []
    if any(k in source for k in ("ai", "智能", "模型", "生成")):
        tags.append("AI应用")
    if any(k in source for k in ("数据", "分析", "统计", "图表")):
        tags.append("数据分析")
    if any(k in source for k in ("web", "网页", "html", "javascript", "前端")):
        tags.append("Web开发")
    if any(k in source for k in ("python", "代码", "编程", "程序")):
        tags.append("编程")
    if not tags:
        tags.extend(["项目规划", "问题解决"])
    return list(dict.fromkeys(tags))


@router.post("/{card_id}/sync-capability-tags", response_model=ApiResponse[AchievementCard])
async def sync_capability_tags_to_card(
    card_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    自动同步能力标签到成果卡（2026-08-04）。

    数据来源优先级（取第一个非空）：
    1. 项目详情页维护的能力标签（project_capability_tags 表）—— 项目维度最权威
    2. 成果卡已有的 capability_tags（避免覆盖用户已设置的）
    3. 基于项目名/阶段关键词自动推荐（兜底，保证不为空）

    结果写入成果卡的 capability_tags，并返回更新后的卡。作者本人或管理员可操作。
    """
    card = db.get_achievement_card(card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="档案卡不存在")
    if card.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此档案卡")

    project = db.get_project(card.project_id) if card.project_id else None

    # 1) 项目维度能力标签
    project_tags: list[str] = []
    if project:
        try:
            project_tags = list(db.get_project_capability_tags(project.id) or [])
        except Exception:
            project_tags = []

    # 2) 成果卡已有标签
    card_tags = list(card.capability_tags or [])

    # 3) 兜底推荐
    recommended = (
        _recommend_capability_tags(project.name, project.current_stage)
        if project else ["项目规划", "问题解决"]
    )

    # 合并去重：project_tags 优先，补 card_tags，再补 recommended
    merged: list[str] = []
    for t in [*project_tags, *card_tags, *recommended]:
        t = str(t).strip()
        if t and t not in merged:
            merged.append(t)

    if not merged:
        return ApiResponse(data=card, message="无可用能力标签")

    updated_card = db.update_achievement_card(card_id, {"capability_tags": merged})
    return ApiResponse(
        data=updated_card or card,
        message=f"已同步 {len(merged)} 个能力标签",
    )


@router.post("/{card_id}/generate-cover", response_model=ApiResponse[AchievementCard])
async def generate_card_cover(card_id: str, current_user: UserResponse = Depends(get_current_user)):
    """
    为成果档案卡生成 AI 封面图（作者本人操作）
    """
    card = db.get_achievement_card(card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="档案卡不存在")
    if card.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此档案卡")

    cover_url = await generate_cover_image(card.title, card.one_liner, card.capability_tags)
    if not cover_url:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="封面图生成失败，请稍后重试")

    local_path = await storage_service.save_cover_image(card_id, cover_url)
    if not local_path:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="封面图保存失败")

    updated_card = db.update_achievement_card(card_id, {"screenshots": [local_path]})
    return ApiResponse(data=updated_card, message="封面图生成成功")


@router.post("/{card_id}/upload-cover", response_model=ApiResponse[AchievementCard])
async def upload_card_cover(
    card_id: str,
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    上传图片作为成果档案卡封面（作者本人操作）
    """
    card = db.get_achievement_card(card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="档案卡不存在")
    if card.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此档案卡")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅支持图片文件")

    # 复用 covers 目录，以 card_id 命名，覆盖旧封面
    content = await file.read()
    target_path = storage_service.covers_dir / f"{card_id}.png"
    target_path.write_bytes(content)
    public_path = f"/media/covers/{card_id}.png"

    updated_card = db.update_achievement_card(card_id, {"screenshots": [public_path]})
    return ApiResponse(data=updated_card, message="封面上传成功")


@router.get("/projects/{project_id}/screenshots", response_model=ApiResponse[list[dict]])
async def list_project_screenshots(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取项目的所有截图（type=screenshot 的证据），供成果卡选择封面
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此项目")

    evidence_list = db.list_evidence(project_id=project_id, skip=0, limit=100, type="screenshot")
    screenshots = [
        {"id": ev.id, "title": ev.title, "url": ev.content_url}
        for ev in evidence_list
        if ev.content_url
    ]
    return ApiResponse(data=screenshots, message="获取成功")


@router.get("/{card_id}/recommendations", response_model=ApiResponse[list[dict]])
async def get_next_step_recommendations(
    card_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取成果档案卡下一步推荐（规则匹配）
    """
    card = db.get_achievement_card(card_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="档案卡不存在",
        )
    if card.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此档案卡",
        )

    project = db.get_project(card.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )
    source_demo = db.get_demo(project.from_demo_id) if project.from_demo_id else None
    current_rank = _difficulty_rank(source_demo.difficulty) if source_demo else 2
    same_rank = current_rank
    next_rank = min(current_rank + 1, 3)

    all_demos = db.list_demos(skip=0, limit=100)
    capability_tags = set(card.capability_tags or [])
    matched_same = []
    matched_upgrade = []
    for demo in all_demos:
        if source_demo and demo.id == source_demo.id:
            continue
        overlap = len(capability_tags.intersection(set(demo.subjects)))
        score = overlap * 10 + 1
        item = {
            "type": "demo",
            "id": demo.id,
            "title": demo.name,
            "description": demo.description,
            "difficulty": demo.difficulty,
            "score": score,
            "target_url": f"/explore/demos/{demo.id}",
        }
        demo_rank = _difficulty_rank(demo.difficulty)
        if demo_rank == same_rank:
            matched_same.append(item)
        if demo_rank == next_rank:
            matched_upgrade.append(item)

    matched_same.sort(key=lambda x: x["score"], reverse=True)
    matched_upgrade.sort(key=lambda x: x["score"], reverse=True)

    recommendations: list[dict] = []
    if capability_tags:
        recommendations.append(
            {
                "type": "capability",
                "title": f"你已经掌握了：{'、'.join(sorted(capability_tags))}",
                "description": "建议选择同难度变体项目巩固能力，再挑战更高难度。",
                "target_url": f"/research/projects/{project.id}",
            }
        )

    recommendations.extend(matched_same[:2])
    recommendations.extend(matched_upgrade[:2])
    recommendations.append(
        {
            "type": "action",
            "title": "下载到 AI IDE 深度开发",
            "description": "导出项目并在本地继续扩展功能与测试。",
            "difficulty": _difficulty_by_rank(next_rank),
            "target_url": f"/research/projects/{project.id}",
        }
    )

    return ApiResponse(data=recommendations[:6], message="获取成功")


@router.get("/{card_id}", response_model=ApiResponse[AchievementCard])
async def get_public_achievement_card(card_id: str):
    """
    按 ID 查看公开成果档案卡（无需登录）

    仅返回 is_public=True 的卡片；私有卡一律 404，避免越权。
    注意：本路由必须注册在所有字面子路径（/inspiration-wall、/featured、
    /share/{token}、/{card_id}/... 等）之后，以免 /{card_id} 抢先匹配。
    """
    card = db.get_achievement_card(card_id)
    if not card or not card.is_public:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="档案卡不存在或未公开",
        )
    return ApiResponse(data=card, message="获取成功")
