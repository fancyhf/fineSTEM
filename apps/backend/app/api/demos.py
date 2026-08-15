"""
示例项目 API 路由

用途：获取示例项目列表、详情、管理员收录/编辑/删除/上下架等
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from typing import List, Optional
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.demos import (
    Demo,
    DemoListQuery,
    DemoUpdate,
    DemoCreateFromProject,
    DemoPublicToggle,
)
from app.schemas.common import ApiResponse, PaginationResult
from app.schemas.auth import UserResponse
from app.repositories.runtime_db import db
from app.api.auth import require_admin
from app.core.time_utils import utc_now, utc_now_iso
from app.services.demo_fork import parse_minimal_replica

router = APIRouter(prefix="/demos", tags=["示例项目"])


def _validate_project_demo_ready(project, *, require_public: bool = True) -> List[str]:
    """
    校验项目是否具备被收录为 Demo 的前提条件，返回缺失项列表（空 = 通过）。

    与 app.api.projects._validate_demo_ready 的成果卡部分对齐，独立实现以避免
    跨 api 模块的循环依赖。

    require_public=True（默认）：要求成果卡已发布到灵感墙（is_public=True），
    因为 Demo 本质是公开展示的内容。
    """
    missing: List[str] = []
    project_id = getattr(project, "id", None)
    card = db.get_achievement_card_by_project(project_id) if project_id else None
    if card is None:
        missing.append("achievement_card")
        return missing

    one_liner = (getattr(card, "one_liner", None) or "").strip()
    screenshots = getattr(card, "screenshots", None) or []
    capability_tags = getattr(card, "capability_tags", None) or []
    if not one_liner:
        missing.append("one_liner")
    if not screenshots:
        missing.append("screenshots")
    if not capability_tags:
        missing.append("capability_tags")
    if require_public and not bool(getattr(card, "is_public", False)):
        missing.append("card_not_public")
    return missing


def _auto_sync_capability_tags(project, card) -> None:
    """
    成果卡能力标签为空时，自动从 project_capability_tags + 推荐规则补全并写回。
    收录 demo 时若仅缺能力标签，调用此函数自动修复，避免硬卡。
    """
    # 1) 项目维度能力标签
    project_tags: list[str] = []
    try:
        project_tags = list(db.get_project_capability_tags(project.id) or [])
    except Exception:
        project_tags = []

    # 2) 兜底推荐（基于项目名/阶段关键词）
    name = getattr(project, "name", "") or ""
    stage = getattr(project, "current_stage", "") or ""
    source = f"{name} {stage}".lower()
    recommended: list[str] = []
    if any(k in source for k in ("ai", "智能", "模型", "生成")):
        recommended.append("AI应用")
    if any(k in source for k in ("数据", "分析", "统计", "图表")):
        recommended.append("数据分析")
    if any(k in source for k in ("web", "网页", "html", "javascript", "前端")):
        recommended.append("Web开发")
    if any(k in source for k in ("python", "代码", "编程", "程序")):
        recommended.append("编程")
    if not recommended:
        recommended.extend(["项目规划", "问题解决"])

    merged: list[str] = []
    for t in [*project_tags, *recommended]:
        t = str(t).strip()
        if t and t not in merged:
            merged.append(t)

    if merged:
        db.update_achievement_card(card.id, {"capability_tags": merged})


def _auto_fill_screenshots_from_evidence(project, card) -> bool:
    """
    成果卡截图(screenshots)为空时，自动从项目证据表(evidence)的截图里取第一张写入。
    收录 demo 时若仅缺截图，调用此函数自动修复，避免硬卡。

    返回 True 表示成功补全，False 表示项目无可用的截图证据。
    """
    try:
        screenshots_evidence = db.list_evidence(
            project_id=project.id, skip=0, limit=10, type="screenshot",
        )
    except Exception:
        screenshots_evidence = []

    for ev in screenshots_evidence:
        url = getattr(ev, "content_url", None) or getattr(ev, "content", None)
        if url and isinstance(url, str) and url.strip():
            db.update_achievement_card(card.id, {"screenshots": [url.strip()]})
            return True
    return False





@router.get("", response_model=ApiResponse[PaginationResult[Demo]])
async def list_demos(query: DemoListQuery = Depends()):
    """
    获取示例项目列表（默认仅返回已公开的 Demo，供 Demo 展示墙使用）。
    """
    skip = (query.page - 1) * query.page_size
    # is_public 语义：None（默认）→ 仅返回已公开；显式传 False → 仅返回未公开（管理场景）
    is_public_filter: bool | None = True if query.is_public is None else query.is_public
    demos = db.list_demos(
        skip=skip,
        limit=query.page_size,
        difficulty=query.difficulty,
        subject=query.subject,
        tech_stack=query.tech_stack,
        search=query.search,
        is_public=is_public_filter,
    )
    total = db.count_demos(
        difficulty=query.difficulty,
        subject=query.subject,
        tech_stack=query.tech_stack,
        search=query.search,
        is_public=is_public_filter,
    )
    total_pages = (total + query.page_size - 1) // query.page_size
    
    return ApiResponse(
        data=PaginationResult(
            items=demos,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=total_pages,
        ),
        message="获取成功",
    )


# ──────────────────────────────────────────────────────────────
# 项目 → Demo 字段自动预填充
#   从 project + 成果卡 + skill_state + workspace 自动提取 demo 字段建议值，
#   admin 在收录表单里只需核对/微调，无需手填。尤其 code_url/download_url
#   直接指向项目导出接口，不再要求 admin 手动寻找代码地址。
# ──────────────────────────────────────────────────────────────

# track → 学科标签映射（stage_04 的轨道推导学科维度）
_TRACK_TO_SUBJECTS: dict[str, list[str]] = {
    "web": ["计算机科学", "Web开发"],
    "web_app": ["计算机科学", "Web开发"],
    "game_dev": ["计算机科学", "游戏开发"],
    "ai_ml": ["人工智能", "数据科学"],
    "data_viz": ["数据科学", "数据可视化"],
    "creative_coding": ["创意编程", "计算机科学"],
    "kaggle": ["数据科学", "机器学习"],
    "hardware": ["硬件", "物联网"],
}


def _try_parse_json(raw: str | None) -> dict | list | None:
    if not raw or not isinstance(raw, str):
        return None
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, (dict, list)) else None
    except (json.JSONDecodeError, TypeError):
        return None


def _extract_tech_stack(track_plan_raw: str | None, fallback_tags: list[str] | None = None) -> list[str]:
    """
    从 stage_04 的 track_plan_content（JSON）提取技术栈。
    tech_stack 可能是 list、dict({frontend,backend,tools}) 或 str，统一拍平成字符串列表。
    """
    parsed = _try_parse_json(track_plan_raw)
    if isinstance(parsed, dict):
        ts = parsed.get("tech_stack")
        if isinstance(ts, list):
            return [str(x).strip() for x in ts if str(x).strip()]
        if isinstance(ts, str) and ts.strip():
            return [ts.strip()]
        if isinstance(ts, dict):
            flat: list[str] = []
            for v in ts.values():
                if isinstance(v, list):
                    flat.extend(str(x).strip() for x in v if str(x).strip())
                elif isinstance(v, str) and v.strip():
                    flat.append(v.strip())
            return flat
    # 兜底：用能力标签里偏技术的（含字母/常见技术词）
    if fallback_tags:
        return [t for t in fallback_tags if any(c.isalpha() for c in t)][:5]
    return []


def _build_project_breakdown(
    *,
    evaluate_content: str | None,
    card_method: str | None,
    card_problem: str | None,
) -> str | None:
    """
    拼装 demo 的项目拆解说明：优先用 stage08 验收文档，其次用成果卡的方法/问题字段。
    """
    if evaluate_content and evaluate_content.strip():
        return evaluate_content.strip()
    parts: list[str] = []
    if card_problem and card_problem.strip():
        parts.append(f"目标：{card_problem.strip()}")
    if card_method and card_method.strip():
        parts.append(f"技术方案：{card_method.strip()}")
    return "\n".join(parts) if parts else None


def _build_minimal_replica(workspace: dict | None) -> dict | None:
    """
    从项目 workspace 的 files 构造 demo 的 minimal_replica（{entry_file, files}）。
    仅在 workspace 有实际文件内容时构造，否则返回 None（admin 可后补）。
    """
    if not workspace or not isinstance(workspace, dict):
        return None
    files_list = workspace.get("files")
    # 多文件模式：files 是 [{name, language, content, is_main}, ...]
    if isinstance(files_list, list) and files_list:
        files_map: dict[str, str] = {}
        entry_file = "index.html"
        main_found = False
        for f in files_list:
            if not isinstance(f, dict):
                continue
            fname = str(f.get("name") or "").strip()
            content = str(f.get("content") or "")
            if not fname:
                continue
            files_map[fname] = content
            if f.get("is_main") and not main_found:
                entry_file = fname
                main_found = True
        if not files_map:
            return None
        # 优先 html 作为 entry（demo 展示友好）
        html_files = [n for n in files_map if n.lower().endswith((".html", ".htm"))]
        if html_files:
            entry_file = html_files[0]
        return {"entry_file": entry_file, "files": files_map}
    # 单文件模式：workspace.code + workspace.language/filename
    code = str(workspace.get("code") or "").strip()
    if code:
        filename = str(workspace.get("filename") or "").strip()
        if not filename:
            lang = str(workspace.get("language") or "python").lower()
            ext = {"python": "py", "html": "html", "javascript": "js", "js": "js"}.get(lang, "txt")
            filename = f"main.{ext}"
        entry = "index.html" if filename.lower().endswith((".html", ".htm")) else filename
        return {"entry_file": entry, "files": {filename: code}}
    return None


def _build_demo_prefill(project, card, skill_state, workspace) -> dict:
    """
    汇总：从 project / 成果卡 / skill_state / workspace 提取 demo 字段建议值。
    返回 dict，前端用来预填收录表单。
    """
    standard_data: dict = {}
    if skill_state:
        ssd = getattr(skill_state, "standard_step_data", None)
        if isinstance(ssd, dict):
            standard_data = ssd
        elif isinstance(ssd, str):
            parsed = _try_parse_json(ssd)
            standard_data = parsed if isinstance(parsed, dict) else {}

    # stage_04 tech_stack / track
    track_plan = standard_data.get("track_plan_content")
    track_parsed = _try_parse_json(track_plan) if isinstance(track_plan, str) else None
    track_value = track_parsed.get("track") if isinstance(track_parsed, dict) else None

    # 能力标签（兜底技术栈 + 学科来源）
    capability_tags = list(getattr(card, "capability_tags", None) or []) if card else []

    tech_stack = _extract_tech_stack(
        track_plan if isinstance(track_plan, str) else None,
        fallback_tags=capability_tags,
    )
    subjects = _TRACK_TO_SUBJECTS.get(track_value or "", []) or capability_tags[:3]

    # 代码/下载地址：直接指向项目导出接口（admin 无需手填）
    export_zip_url = f"/api/v1/projects/{project.id}/export?format=zip"

    # 项目拆解：stage08 验收文档 > 成果卡方法+问题
    project_breakdown = _build_project_breakdown(
        evaluate_content=standard_data.get("evaluate_content"),
        card_method=getattr(card, "method_used", None) if card else None,
        card_problem=getattr(card, "problem_solved", None) if card else None,
    )

    # 讲解文档
    explanation_doc = standard_data.get("explanation_content") or None

    # 最小可复刻代码
    minimal_replica = _build_minimal_replica(workspace if isinstance(workspace, dict) else None)

    # 来源 demo 的难度（项目是 fork 自 demo 时继承）
    difficulty = "beginner"
    source_demo_id = getattr(project, "from_demo_id", None)
    if source_demo_id:
        source_demo = db.get_demo(source_demo_id)
        if source_demo:
            difficulty = source_demo.difficulty

    return {
        "name": (project.name or "").strip(),
        "description": (getattr(card, "one_liner", None) or project.description or "").strip() if card else (project.description or "").strip(),
        "screenshots": list(getattr(card, "screenshots", None) or []) if card else [],
        "difficulty": difficulty,
        "subjects": subjects,
        "grade_range": "13-15岁",
        "tech_stack": tech_stack,
        "tags": capability_tags,
        "display_mode": "static",
        "iframe_url": None,
        "code_url": export_zip_url,
        "download_url": export_zip_url,
        "project_breakdown": project_breakdown,
        "explanation_doc": explanation_doc if isinstance(explanation_doc, str) else None,
        "minimal_replica": minimal_replica,
        "is_public": True,
        # 额外信息：帮助 admin 判断字段来源
        "source_track": track_value,
        "has_workspace_code": bool(workspace and isinstance(workspace, dict) and (
            (workspace.get("code") and str(workspace["code"]).strip()) or
            (isinstance(workspace.get("files"), list) and len(workspace["files"]) > 0)
        )),
    }


@router.get("/from-project/{project_id}/prefill", response_model=ApiResponse[dict])
async def get_demo_prefill_from_project(
    project_id: str,
    admin: UserResponse = Depends(require_admin),
):
    """
    收录预填充：从项目已有数据自动提取 demo 字段建议值。

    返回的 dict 直接对应收录表单字段，前端用它预填，admin 只需核对/微调。
    特别地，code_url / download_url 自动指向项目导出接口，admin 无需手填。

    注意：本路由必须注册在 GET /{demo_id} 之前，否则 from-project 会被当成 demo_id。
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )
    card = db.get_achievement_card_by_project(project_id)
    skill_state = db.get_skill_state(project_id)
    workspace = db.get_project_workspace(project_id)
    prefill = _build_demo_prefill(project, card, skill_state, workspace)
    return ApiResponse(data=prefill, message="获取成功")


@router.get("/{demo_id}", response_model=ApiResponse[Demo])
async def get_demo(demo_id: str):
    """
    获取示例项目详情
    """
    demo = db.get_demo(demo_id)
    if not demo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )
    
    return ApiResponse(data=demo, message="获取成功")


@router.get("/{demo_id}/use-project", response_model=ApiResponse[dict])
async def use_demo_as_template(demo_id: str):
    """
    使用示例项目作为模板（返回基本信息）
    """
    demo = db.get_demo(demo_id)
    if not demo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )
    
    return ApiResponse(
        data={
            "demo_id": demo.id,
            "name": demo.name,
            "description": demo.description,
            "tech_stack": demo.tech_stack,
            "difficulty": demo.difficulty,
            "subjects": demo.subjects,
            "display_mode": demo.display_mode,
            "fork_template_id": demo.fork_template_id,
        },
        message="获取成功",
    )


@router.get("/{demo_id}/breakdown", response_model=ApiResponse[dict])
async def get_demo_breakdown(demo_id: str):
    """
    获取 Demo 项目拆解文档
    """
    demo = db.get_demo(demo_id)
    if not demo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )

    return ApiResponse(
        data={
            "demo_id": demo.id,
            "project_breakdown": demo.project_breakdown or "",
            "minimal_replica": demo.minimal_replica,
        },
        message="获取成功",
    )


@router.get("/{demo_id}/fork-template", response_model=ApiResponse[dict])
async def get_demo_fork_template(demo_id: str):
    """
    获取 Demo 最小可改版 Fork 模板
    """
    demo = db.get_demo(demo_id)
    if not demo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )

    editable_markers = [
        "修改页面标题与项目名称",
        "调整核心交互参数",
        "替换默认数据与主题样式",
    ]
    suggestions = [
        f"保持 {demo.name} 核心逻辑不变，先改 UI 风格与配色",
        "增加一个可视化反馈（图表、提示区或动画）",
        "扩展一个与学科相关的新功能并记录验证结果",
    ]

    template_entry, template_files = parse_minimal_replica(demo.minimal_replica, demo_name=demo.name)

    return ApiResponse(
        data={
            "demo_id": demo.id,
            "skeleton_code": template_entry,
            "template_files": template_files,
            "entry_file": template_entry,
            "editable_markers": editable_markers,
            "suggestions": suggestions,
            "default_goal": f"在保留 {demo.name} 核心功能的前提下完成一次可演示改造",
            "default_template": "我解决了什么 -> 我做了哪些改动 -> 我如何验证 -> 下一步优化",
        },
        message="获取成功",
    )


# ──────────────────────────────────────────────────────────────
# 管理员路由：收录项目为 Demo / 编辑 / 删除 / 上下架
# ──────────────────────────────────────────────────────────────
# 注意：POST /from-project/{project_id} 与 GET /{demo_id} 方法不同，不会冲突。
# 但为避免路径段数歧义，from-project 这种固定段放在 {demo_id} 子路径之前更稳妥；
# 由于本模块 GET /{demo_id} 是 GET，而收录是 POST，实际不冲突。


@router.post("/from-project/{project_id}", response_model=ApiResponse[Demo])
async def promote_project_to_demo(
    project_id: str,
    payload: DemoCreateFromProject,
    admin: UserResponse = Depends(require_admin),
):
    """
    把一个合格项目「收录为 Demo」——在 demos 表新建一条记录。

    业务逻辑：
    1. 校验 project 存在；
    2. 校验项目具备 Demo 上线前提：有成果卡 + 截图 + 能力标签 + one_liner 齐全 + 成果卡已公开；
       缺失则返回 422（details.missing_fields），前端据此引导 admin/作者去补齐；
    3. 从 project + 成果卡自动映射 name / description / screenshots；
    4. 合并 admin 在表单填写的 demo 独有字段；
    5. 生成 demo id（demo_<uuid8>）+ fork_template_id（fork-<id>）；
    6. created_by 设为 admin.id（非 'system'），确保不被 _ensure_seed_demos 误删；
    7. 写入 source_project_id 便于追溯。

    幂等性：若该项目已被收录过（存在未删除的 source_project_id 记录），返回 409，
    避免重复收录。前端可改为调 PATCH 编辑已存在的 demo。
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )

    # Demo 上线前提校验：要求成果卡存在 + 截图 + 能力标签 + one_liner 齐全。
    # 注意：不要求成果卡"已公开"——收录动作本身会把成果卡自动发布（Demo 是公开展示内容）。
    # 可自动修复的缺失项（无需 admin 手动处理）：
    #   - capability_tags：从 project_capability_tags + 推荐规则补全
    #   - screenshots：从项目证据(evidence)的截图取第一张补到成果卡
    missing = _validate_project_demo_ready(project, require_public=False)
    if missing:
        card_for_fix = db.get_achievement_card_by_project(project_id)
        if card_for_fix:
            fixed = False
            # 能力标签缺失：自动同步
            if "capability_tags" in missing:
                _auto_sync_capability_tags(project, card_for_fix)
                fixed = True
            # 截图缺失：从项目证据补
            if "screenshots" in missing:
                if _auto_fill_screenshots_from_evidence(project, card_for_fix):
                    fixed = True
            if fixed:
                project = db.get_project(project_id)  # 刷新缓存
                missing = _validate_project_demo_ready(project, require_public=False)
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "DEMO_FIELDS_INCOMPLETE",
                    "message": "项目未达到 Demo 收录要求，请补齐成果卡必要字段",
                    "details": {"missing_fields": missing},
                },
            )

    # 幂等：避免同一 project 被重复收录
    existing = db.get_demo_by_source_project(project_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "PROJECT_ALREADY_PROMOTED",
                "message": "该项目已被收录为 Demo，请直接编辑该 Demo",
                "details": {"existing_demo_id": existing.id},
            },
        )

    # 映射 project + 成果卡 → demo 基础字段
    card = db.get_achievement_card_by_project(project_id)
    skill_state = db.get_skill_state(project_id)
    workspace = db.get_project_workspace(project_id)
    now = utc_now()
    demo_id = f"demo_{uuid.uuid4().hex[:8]}"
    name = (project.name or "").strip() or "未命名项目"
    description = (getattr(card, "one_liner", None) or project.description or "").strip()
    screenshots = list(getattr(card, "screenshots", None) or [])

    # 收录即公开：Demo 是公开展示内容，自动把成果卡发布到灵感墙（若尚未公开）
    if card and not bool(getattr(card, "is_public", False)):
        db.update_achievement_card(card.id, {"is_public": True, "submitted_at": now})
        card = db.get_achievement_card_by_project(project_id) or card

    # 自动预填充：从 skill_state/workspace 提取智能默认值，admin 传参优先覆盖
    prefill = _build_demo_prefill(project, card, skill_state, workspace)
    export_zip_url = f"/api/v1/projects/{project_id}/export?format=zip"

    # 必填字段兜底：code_url / download_url 优先用 admin 传入，否则指向项目导出接口
    code_url = (payload.code_url or "").strip() or export_zip_url
    download_url = (payload.download_url or "").strip() or export_zip_url

    # demo 独有字段：admin 显式传值优先，否则用预填充默认值（避免 admin 漏填空值）
    tech_stack = payload.tech_stack if payload.tech_stack else prefill.get("tech_stack", [])
    subjects = payload.subjects if payload.subjects else prefill.get("subjects", [])
    tags = payload.tags if payload.tags else prefill.get("tags", [])
    project_breakdown = payload.project_breakdown or prefill.get("project_breakdown")
    explanation_doc = payload.explanation_doc or prefill.get("explanation_doc")
    minimal_replica_raw = payload.minimal_replica if payload.minimal_replica is not None else prefill.get("minimal_replica")

    demo = Demo(
        id=demo_id,
        name=name,
        description=description,
        tech_stack=tech_stack,
        difficulty=payload.difficulty,
        subjects=subjects,
        grade_range=payload.grade_range,
        tags=tags,
        display_mode=payload.display_mode,
        iframe_url=payload.iframe_url,
        screenshots=screenshots,
        demo_video_url=payload.demo_video_url,
        project_breakdown=project_breakdown,
        explanation_doc=explanation_doc,
        minimal_replica=json.dumps(minimal_replica_raw, ensure_ascii=False) if minimal_replica_raw else None,
        code_url=code_url,
        download_url=download_url,
        fork_template_id=f"fork-{demo_id}",
        source_project_id=project_id,
        is_public=payload.is_public,
        submitted_at=now if payload.is_public else None,
        created_at=now,
        created_by=admin.id,
        updated_at=now,
        updated_by=admin.id,
    )
    created = db.create_demo(demo)
    return ApiResponse(data=created, message="已收录为 Demo")


@router.patch("/{demo_id}", response_model=ApiResponse[Demo])
async def update_demo(
    demo_id: str,
    payload: DemoUpdate,
    admin: UserResponse = Depends(require_admin),
):
    """
    管理员编辑 Demo（全字段可选更新）。
    """
    existing = db.get_demo(demo_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return ApiResponse(data=existing, message="无更新内容")

    update_data["updated_by"] = admin.id
    updated = db.update_demo(demo_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )
    return ApiResponse(data=updated, message="更新成功")


@router.delete("/{demo_id}", response_model=ApiResponse[Demo])
async def delete_demo(
    demo_id: str,
    admin: UserResponse = Depends(require_admin),
):
    """
    管理员删除 Demo（软删除）。

    种子 demo（created_by='system'）也允许删除——_ensure_seed_demos 下次同步会
    检测到种子缺失并重新插入，相当于"重置种子"。admin 收录的 demo 删除后不恢复。
    """
    existing = db.get_demo(demo_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )

    deleted = db.soft_delete_demo(demo_id, deleted_by=admin.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )
    return ApiResponse(data=deleted, message="已删除")


@router.post("/{demo_id}/toggle-public", response_model=ApiResponse[Demo])
async def toggle_demo_public(
    demo_id: str,
    payload: DemoPublicToggle,
    admin: UserResponse = Depends(require_admin),
):
    """
    管理员上架/下架 Demo（切换 is_public）。
    上架后出现在首页/Demo 列表；下架后仅管理页可见。
    """
    existing = db.get_demo(demo_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )

    updated = db.set_demo_public(demo_id, payload.is_public)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="示例项目不存在",
        )
    return ApiResponse(
        data=updated,
        message="已上架" if payload.is_public else "已下架",
    )

