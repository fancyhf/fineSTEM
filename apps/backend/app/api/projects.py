"""
研学项目 API 路由

用途：项目 CRUD、状态推进等
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from typing import Optional
from urllib.parse import quote
import io
import json
import re
import uuid
import zipfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from app.schemas.projects import (
    Project,
    ProjectCreate,
    ProjectUpdate,
    ProjectTeachingModeUpdate,
    ProjectUpgrade,
    ProjectProgress,
    LightProjectStep1Data,
    LightProjectStep2Data,
    LightProjectStep3Data,
    LightProjectStepsData,
    StandardProjectStepData,
    ProjectCodeSave,
    ProjectChatSave,
    ProjectWorkspaceData,
    ProjectWorkspaceResponse,
    FileEntry,
)
from app.schemas.evidence import Evidence
from app.schemas.achievements import AchievementCard
from app.schemas.common import ApiResponse, PaginationResult
from app.schemas.auth import UserResponse
from app.repositories.runtime_db import db
from app.api.auth import get_current_user
from app.services.document_service import document_service
from app.services.pbl_engine import advance_with_gate, save_artifact
from app.services.stage08_sync import build_stage08_payload, merge_stage08_into_standard_data
from app.services.providers.image_provider import generate_cover_image
from app.services.storage_service import storage_service
from app.core.config import settings
from app.core.time_utils import utc_now, utc_now_iso

router = APIRouter(prefix="/projects", tags=["研学项目"])


ZIP_EXCLUDED_DIRS = {
    ".git",
    ".next",
    ".venv",
    "__pycache__",
    "dist",
    "build",
    "node_modules",
}

# IDE 友好的 .gitignore 模板
_GITIGNORE_CONTENT = """\
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
build/
.next/
out/

# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/

# IDE
.vscode/settings.json
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
logs/
"""


def _safe_zip_path(*parts: str) -> str:
    cleaned: list[str] = []
    for part in parts:
        safe = str(part).replace("\\", "/").strip("/")
        safe = safe.replace("..", "_")
        if safe:
            cleaned.append(safe)
    return "/".join(cleaned)


def _slugify_project_name(name: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", name.lower().strip())
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-") or "project"


def _guess_code_filename(language: str | None, fallback: str | None = None) -> str:
    if fallback:
        return Path(fallback).name
    ext_by_language = {
        "html": "html",
        "css": "css",
        "javascript": "js",
        "js": "js",
        "typescript": "ts",
        "ts": "ts",
        "tsx": "tsx",
        "python": "py",
        "py": "py",
    }
    ext = ext_by_language.get((language or "").lower(), "txt")
    return f"main.{ext}"


def _zip_json(zipf: zipfile.ZipFile, path: str, payload: object) -> None:
    zipf.writestr(
        path,
        json.dumps(payload, ensure_ascii=False, indent=2, default=str),
    )


def _add_directory_to_zip(zipf: zipfile.ZipFile, source_dir: Path, zip_prefix: str) -> None:
    if not source_dir.exists() or not source_dir.is_dir():
        return
    for item in source_dir.rglob("*"):
        if not item.is_file():
            continue
        if any(part in ZIP_EXCLUDED_DIRS for part in item.relative_to(source_dir).parts):
            continue
        try:
            relative = item.relative_to(source_dir)
            zipf.write(item, _safe_zip_path(zip_prefix, relative.as_posix()))
        except OSError:
            continue


def _make_export_filename(project_name: str, ext: str) -> str:
    """生成有意义的导出文件名：项目名_资料包.ext

    保留中文字符，替换不安全字符为下划线。
    """
    safe = re.sub(r'[\\/:*?"<>|]', '_', project_name.strip())
    return f"{safe}_资料包.{ext}"


def _build_content_disposition(filename: str, ascii_fallback: str = "export_package") -> str:
    """构建 Content-Disposition 头，支持中文文件名。

    使用 RFC 5987 编码（filename*=UTF-8''...）并附带 ASCII fallback，
    避免 latin-1 编码报错。现代浏览器会优先使用 filename*=UTF-8'' 编码的名称。
    """
    encoded = quote(filename, safe='')
    return f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded}'


def _build_readme_md(project_name: str, project_mode: str, description: str, generated_at: str) -> str:
    """生成资料包 README.md 文件内容（IDE 友好结构）。"""
    mode_label = "标准 PBL 研学流程" if project_mode == "standard" else "轻量项目流程"
    return f"""# {project_name} — 项目资料包

> 由 fineSTEM AI 导师辅助完成  
> 导出时间：{generated_at}  
> 项目模式：{mode_label}

## 项目简介

{description or '（请在项目详情页补充项目描述）'}

## 目录结构（IDE 友好）

| 目录/文件 | 说明 |
|-----------|------|
| `src/` | **项目源代码** — IDE 可直接识别为源码目录 |
| `docs/` | 项目文档：开题报告、技术报告、结题报告、AI 对话记录 |
| `evidence/` | 项目证据：代码快照、文档、资源文件 |
| `data/` | 项目状态数据：工作区快照、技能状态、步骤数据、成果档案卡 |
| `project_files/` | 原始项目文件备份（storage + repository） |
| `index.html` | 资料包导航页，双击在浏览器中浏览所有内容 |
| `project.json` | 项目完整元数据 |
| `manifest.json` | 资料包内容清单 |
| `.gitignore` | Git 忽略规则，适合直接导入 IDE 管理 |

## 快速开始

1. **导入 IDE**：解压后直接用 VS Code / Trae / Cursor 打开此目录即可
2. **查看代码**：`src/` 目录包含项目源代码文件
3. **浏览资料**：双击 `index.html` 在浏览器中查看完整资料包导航
4. **查阅报告**：`docs/` 中可找到 AI 生成的结题报告（PDF/DOCX/MD）
5. **分享成果**：`data/achievement_card.json` 包含成果档案卡数据

## 文档目录详情

```
├── src/                        # 项目源代码（IDE 自动识别）
│   └── main.{{html|js|py|...}}  # 主代码文件
├── docs/                       # 文档中心
│   ├── proposal/               # 开题报告（MD/JSON/DOCX/PDF）
│   ├── technical/              # 技术报告（MD/JSON/DOCX/PDF）
│   ├── final/                  # 结题报告（MD/JSON/DOCX/PDF）
│   ├── stage_artifacts/        # 各阶段产物文档
│   ├── evidence/               # 证据中的文档/文本
│   └── chat_messages.json      # AI 对话记录
├── evidence/                   # 项目证据
│   ├── code/                   # 证据代码片段
│   ├── assets/                 # 图片等资源引用
│   └── *.json                  # 其他类型证据
├── data/                       # 项目数据
│   ├── workspace.json          # 工作区完整快照
│   ├── skill_state.json        # 研学技能状态
│   ├── steps/                  # 各阶段步骤数据
│   └── achievement_card.json   # 成果档案卡
└── project_files/              # 原始项目文件备份
    ├── storage/                # 磁盘存储备份
    └── repository/             # 仓库文件备份
```

---

*本资料包由 fineSTEM 平台自动生成，记录了你完整的研学项目旅程。*
"""


def _build_index_html(project_name: str, generated_at: str) -> str:
    """生成资料包 index.html 导航页。"""
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{project_name} — 项目资料包</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; background: #f5f7fa; color: #1a1a2e; line-height: 1.6; }}
  header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; }}
  header h1 {{ font-size: 1.75rem; margin-bottom: 0.5rem; }}
  header p {{ opacity: 0.85; font-size: 0.9rem; }}
  main {{ max-width: 900px; margin: 2rem auto; padding: 0 1rem; }}
  section {{ background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }}
  section h2 {{ font-size: 1.2rem; color: #667eea; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #eef0f5; }}
  .file-list {{ display: grid; gap: 0.5rem; }}
  .file-item {{ display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border-radius: 8px; transition: background 0.2s; }}
  .file-item:hover {{ background: #f0f3ff; }}
  .file-icon {{ font-size: 1.25rem; width: 28px; text-align: center; flex-shrink: 0; }}
  .file-link {{ color: #4a6cf7; text-decoration: none; word-break: break-all; }}
  .file-link:hover {{ text-decoration: underline; }}
  .file-desc {{ color: #888; font-size: 0.8rem; margin-left: auto; flex-shrink: 0; }}
  footer {{ text-align: center; color: #aaa; font-size: 0.8rem; padding: 2rem; }}
  .badge {{ display: inline-block; background: #eef0ff; color: #667eea; padding: 0.15rem 0.6rem; border-radius: 20px; font-size: 0.75rem; margin-left: 0.5rem; }}
</style>
</head>
<body>
<header>
  <h1>📦 {project_name}</h1>
  <p>fineSTEM 项目资料包 · 导出时间：{generated_at}</p>
</header>
<main>
  <section>
    <h2>📄 项目文档</h2>
    <div class="file-list">
      <div class="file-item">
        <span class="file-icon">📋</span>
        <span>project.json</span>
        <span class="file-desc">项目元数据</span>
      </div>
      <div class="file-item">
        <span class="file-icon">📝</span>
        <a class="file-link" href="README.md">README.md</a>
        <span class="file-desc">使用说明</span>
      </div>
    </div>
  </section>
  <section>
    <h2>📚 AI 生成文档 <span class="badge">AI 辅助</span></h2>
    <div class="file-list">
      <div class="file-item">
        <span class="file-icon">📖</span>
        <span>docs/proposal/</span>
        <span class="file-desc">开题报告 (MD/JSON/DOCX/PDF)</span>
      </div>
      <div class="file-item">
        <span class="file-icon">🔧</span>
        <span>docs/technical/</span>
        <span class="file-desc">技术报告 (MD/JSON/DOCX/PDF)</span>
      </div>
      <div class="file-item">
        <span class="file-icon">🏁</span>
        <span>docs/final/</span>
        <span class="file-desc">结题报告 (MD/JSON/DOCX/PDF)</span>
      </div>
      <div class="file-item">
        <span class="file-icon">💬</span>
        <a class="file-link" href="docs/chat_messages.json">docs/chat_messages.json</a>
        <span class="file-desc">AI 对话记录</span>
      </div>
    </div>
  </section>
  <section>
    <h2>💻 源代码 <span class="badge">IDE 就绪</span></h2>
    <div class="file-list">
      <div class="file-item">
        <span class="file-icon">💾</span>
        <span>src/</span>
        <span class="file-desc">项目源代码（IDE 自动识别）</span>
      </div>
      <div class="file-item">
        <span class="file-icon">📋</span>
        <a class="file-link" href="project.json">project.json</a>
        <span class="file-desc">项目元数据</span>
      </div>
      <div class="file-item">
        <span class="file-icon">⚙️</span>
        <a class="file-link" href=".gitignore">.gitignore</a>
        <span class="file-desc">Git 忽略规则</span>
      </div>
    </div>
  </section>
  <section>
    <h2>🏆 成果与数据</h2>
    <div class="file-list">
      <div class="file-item">
        <span class="file-icon">🏅</span>
        <span>data/achievement_card.json</span>
        <span class="file-desc">成果档案卡</span>
      </div>
      <div class="file-item">
        <span class="file-icon">📦</span>
        <span>data/workspace.json</span>
        <span class="file-desc">工作区完整快照</span>
      </div>
      <div class="file-item">
        <span class="file-icon">📌</span>
        <span>data/skill_state.json</span>
        <span class="file-desc">技能状态</span>
      </div>
      <div class="file-item">
        <span class="file-icon">📑</span>
        <span>data/steps/</span>
        <span class="file-desc">各阶段步骤数据</span>
      </div>
    </div>
  </section>
  <section>
    <h2>📊 证据与备份</h2>
    <div class="file-list">
      <div class="file-item">
        <span class="file-icon">🔍</span>
        <span>evidence/</span>
        <span class="file-desc">项目证据（代码/文档/资源）</span>
      </div>
      <div class="file-item">
        <span class="file-icon">🗂️</span>
        <span>project_files/</span>
        <span class="file-desc">原始项目文件备份</span>
      </div>
    </div>
  </section>
</main>
<footer>
  <p>本资料包由 fineSTEM 平台自动生成 · 记录你完整的研学旅程</p>
</footer>
</body>
</html>
"""


def _get_teaching_mode_from_state(skill_state) -> str:
    metadata = getattr(skill_state, "metadata", {}) or {}
    if isinstance(metadata, str):
        try:
            import json
            metadata = json.loads(metadata)
        except Exception:
            metadata = {}
    teaching_mode = metadata.get("teachingMode", "guided")
    if teaching_mode in {"guided", "demo", "hands_on", "lecture"}:
        return teaching_mode
    return "guided"


def _build_workspace_payload(project_id: str) -> tuple[ProjectProgress, ProjectWorkspaceData]:
    skill_state = db.get_skill_state(project_id)
    if not skill_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目状态不存在",
        )
    workspace = db.get_project_workspace(project_id) or {}
    project = db.get_project(project_id)
    standard_step_data = skill_state.standard_step_data or {}
    if project:
        draft_data, _ = _build_achievement_draft(project_id, project)
        achievement = db.get_achievement_card_by_project(project_id)
        hydrated_stage8 = build_stage08_payload(
            standard_step_data,
            achievement_card=achievement,
            draft_data=draft_data,
        )
        hydrated_standard_data = merge_stage08_into_standard_data(standard_step_data, hydrated_stage8)
        if hydrated_standard_data != standard_step_data:
            updated_state = db.update_skill_state(project_id, {"standard_step_data": hydrated_standard_data})
            if updated_state:
                skill_state = updated_state
                standard_step_data = updated_state.standard_step_data or hydrated_standard_data
            else:
                standard_step_data = hydrated_standard_data
    progress = ProjectProgress(
        current_stage=skill_state.current_stage,
        stage_history=skill_state.stage_history,
        light_step_data=skill_state.light_step_data,
        standard_step_data=standard_step_data,
        teaching_mode=_get_teaching_mode_from_state(skill_state),
    )
    workspace_data = ProjectWorkspaceData(
        code=str(workspace.get("code") or ""),
        language=str(workspace.get("language") or "python"),
        filename=workspace.get("filename"),
        chat_messages=workspace.get("chat_messages") or [],
        preview_html=str(workspace.get("preview_html") or ""),
        saved_at=workspace.get("saved_at"),
        chat_saved_at=workspace.get("chat_saved_at"),
        files=[FileEntry(**f) for f in (workspace.get("files") or []) if isinstance(f, dict)],
    )
    return progress, workspace_data

def _collect_auto_evidence(project_id: str, user_id: str, evidence_type: str, content: str, related_step: str | None = None) -> None:
    db.create_evidence(
        Evidence(
            project_id=project_id,
            author_id=user_id,
            type=evidence_type,
            content=content,
            related_step=related_step,
            created_by=user_id,
        )
    )


@router.post("", response_model=ApiResponse[Project])
async def create_project(
    project_data: ProjectCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    创建新项目
    """
    project = Project(
        id=str(uuid.uuid4()),
        author_id=current_user.id,
        name=project_data.name,
        mode=project_data.mode,
        from_demo_id=project_data.from_demo_id,
        initial_data=project_data.initial_data or {},
        created_by=current_user.id,
    )
    
    created_project = db.create_project(project)
    _collect_auto_evidence(
        project_id=created_project.id,
        user_id=current_user.id,
        evidence_type="auto_ai_summary",
        content=f"项目已创建：{created_project.name}",
        related_step=created_project.current_stage,
    )
    return ApiResponse(data=created_project, message="创建成功")


@router.get("", response_model=ApiResponse[PaginationResult[Project]])
async def list_user_projects(
    page: int = 1,
    page_size: int = 20,
    mode: Optional[str] = None,
    stage: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取用户项目列表
    """
    skip = (page - 1) * page_size
    projects = db.list_projects(
        user_id=current_user.id,
        skip=skip,
        limit=page_size,
        mode=mode,
        stage=stage,
    )
    total = db.count_projects(
        user_id=current_user.id,
        mode=mode,
        stage=stage,
    )
    total_pages = (total + page_size - 1) // page_size
    
    return ApiResponse(
        data=PaginationResult(
            items=projects,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ),
        message="获取成功",
    )


@router.get("/{project_id}", response_model=ApiResponse[Project])
async def get_project(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取项目详情
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
            detail="无权查看此项目",
        )
    
    return ApiResponse(data=project, message="获取成功")


@router.get("/{project_id}/progress", response_model=ApiResponse[ProjectProgress])
async def get_project_progress(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取项目进度（当前阶段、步骤数据）
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
            detail="无权查看此项目",
        )
    
    progress, _ = _build_workspace_payload(project_id)
    return ApiResponse(data=progress, message="获取成功")


@router.get("/{project_id}/workspace", response_model=ApiResponse[ProjectWorkspaceResponse])
async def get_project_workspace(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取项目工作台恢复数据（项目 + 进度 + 代码/聊天工作区）
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
            detail="无权查看此项目",
        )

    progress, workspace = _build_workspace_payload(project_id)
    return ApiResponse(
        data=ProjectWorkspaceResponse(
            project=project,
            progress=progress,
            workspace=workspace,
        ),
        message="获取成功",
    )


@router.post("/{project_id}/teaching-mode", response_model=ApiResponse[ProjectProgress])
async def update_project_teaching_mode(
    project_id: str,
    payload: ProjectTeachingModeUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    更新项目教学模式
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
            detail="无权修改此项目",
        )

    skill_state = db.get_skill_state(project_id)
    if not skill_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目状态不存在",
        )

    metadata = getattr(skill_state, "metadata", {}) or {}
    if isinstance(metadata, str):
        try:
            import json
            metadata = json.loads(metadata)
        except Exception:
            metadata = {}
    metadata["teachingMode"] = payload.teaching_mode
    db.update_skill_state(project_id, {"metadata": metadata})

    progress, _ = _build_workspace_payload(project_id)
    return ApiResponse(data=progress, message="教学模式更新成功")


@router.patch("/{project_id}", response_model=ApiResponse[Project])
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    更新项目基本信息
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
    
    update_data = project_update.model_dump(exclude_unset=True)
    updated_project = db.update_project(project_id, update_data)
    return ApiResponse(data=updated_project, message="更新成功")


@router.post("/{project_id}/code", response_model=ApiResponse[dict])
async def save_project_code(
    project_id: str,
    code_data: ProjectCodeSave,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    保存项目代码（持久化到数据库，下次打开可恢复）
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此项目")

    workspace_payload = {
        "code": code_data.code,
        "language": code_data.language,
        "filename": code_data.filename,
        "saved_at": utc_now_iso(),
    }
    # 多文件支持：如果传了 files 字段，一并保存
    if code_data.files is not None:
        workspace_payload["files"] = [f.model_dump() for f in code_data.files]
    # 运行预览 HTML：用于成果卡封面自动截图（无头浏览器对预览页拍照）
    # 只在显式传入时覆盖，避免 autosave 只存代码时把已有 preview_html 清空
    if code_data.preview_html is not None:
        workspace_payload["preview_html"] = code_data.preview_html

    db.save_project_workspace(
        project_id,
        workspace_payload,
        updated_by=current_user.id,
    )
    return ApiResponse(data={'saved': True, 'project_id': project_id}, message="代码已保存")


@router.get("/{project_id}/code", response_model=ApiResponse[dict])
async def get_project_code(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取项目保存的代码
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权查看此项目")

    workspace = db.get_project_workspace(project_id) or {}
    code = str(workspace.get('code') or '')
    language = str(workspace.get('language') or 'python')
    filename = workspace.get('filename')
    saved_at = workspace.get('saved_at')
    files = workspace.get('files') or []

    return ApiResponse(data={
        'code': code,
        'language': language,
        'filename': filename,
        'saved_at': saved_at,
        'has_code': bool(code),
        'files': files,
    }, message="获取成功")


@router.post("/{project_id}/chat", response_model=ApiResponse[dict])
async def save_project_chat(
    project_id: str,
    chat_data: ProjectChatSave,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    保存项目聊天记录（持久化到数据库，下次打开可恢复）
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此项目")

    db.save_project_workspace(
        project_id,
        {
            "chat_messages": chat_data.messages,
            "chat_saved_at": utc_now_iso(),
        },
        updated_by=current_user.id,
    )
    return ApiResponse(data={'saved': True, 'message_count': len(chat_data.messages), 'project_id': project_id}, message="聊天记录已保存")


@router.get("/{project_id}/chat", response_model=ApiResponse[dict])
async def get_project_chat(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取项目保存的聊天记录
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权查看此项目")

    workspace = db.get_project_workspace(project_id) or {}
    messages = workspace.get('chat_messages', [])
    chat_saved_at = workspace.get('chat_saved_at')

    return ApiResponse(data={
        'messages': messages,
        'message_count': len(messages),
        'has_messages': bool(messages),
        'saved_at': chat_saved_at,
    }, message="获取成功")


# ── 项目文档列表/内容接口（阶段工件浏览） ───────────────────────────

# 阶段工件元数据：阶段标识 → (工件名, 显示名, blob_key, 文件名)
_ARTIFACT_META = [
    ("stage_01_brainstorm", "头脑风暴", "brainstorm_content", "00_brainstorm.md"),
    ("stage_02_opening",    "开题立项", "brief_content",      "01_project_brief.md"),
    ("stage_03_scope",      "范围裁剪", "constraints_content", "02_constraints.md"),
    ("stage_04_track",      "技术轨道", "track_plan_content",  "03_track_plan.md"),
    ("stage_05_design",     "设计蓝图", "design_content",      "04_design.md"),
    ("stage_06_plan",       "分步计划", "step_plan_content",   "05_step_plan.md"),
    ("stage_07_execute",    "开发日志", "dev_log_content",     "06_dev_log.md"),
    ("stage_08_review",     "验收评估", "evaluate_content",    "07_evaluation.md"),
]


@router.get("/{project_id}/documents", response_model=ApiResponse[list])
async def list_project_documents(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取项目阶段文档列表（从 standard_step_data 和 light_step_data 中提取）
    返回每个文档的：阶段、名称、是否有内容、摘要
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权查看此项目")

    skill_state = db.get_skill_state(project_id)
    if not skill_state:
        return ApiResponse(data=[], message="项目状态不存在")

    documents = []
    standard_data = skill_state.standard_step_data or {}
    light_data = {}
    if skill_state.light_step_data:
        light_data = skill_state.light_step_data.model_dump() if hasattr(skill_state.light_step_data, 'model_dump') else {}

    for stage, display_name, blob_key, filename in _ARTIFACT_META:
        content = ""
        # 优先从 standard_step_data 获取
        if isinstance(standard_data, dict):
            content = str(standard_data.get(blob_key, "") or "")
        # 回退到 light_step_data
        if not content and isinstance(light_data, dict):
            content = str(light_data.get(blob_key, "") or "")

        documents.append({
            'stage': stage,
            'name': display_name,
            'filename': filename,
            'has_content': bool(content.strip()),
            'summary': content[:200] if content else "",
            'content_length': len(content),
        })

    return ApiResponse(data=documents, message="获取成功")


@router.get("/{project_id}/documents/{stage}", response_model=ApiResponse[dict])
async def get_project_document(
    project_id: str,
    stage: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取指定阶段文档的完整内容
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权查看此项目")

    skill_state = db.get_skill_state(project_id)
    if not skill_state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目状态不存在")

    # 查找对应阶段的工件元数据
    artifact_info = None
    for s, display_name, blob_key, filename in _ARTIFACT_META:
        if s == stage:
            artifact_info = (display_name, blob_key, filename)
            break

    if not artifact_info:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"未知阶段: {stage}")

    display_name, blob_key, filename = artifact_info
    standard_data = skill_state.standard_step_data or {}
    light_data = {}
    if skill_state.light_step_data:
        light_data = skill_state.light_step_data.model_dump() if hasattr(skill_state.light_step_data, 'model_dump') else {}

    content = ""
    if isinstance(standard_data, dict):
        content = str(standard_data.get(blob_key, "") or "")
    if not content and isinstance(light_data, dict):
        content = str(light_data.get(blob_key, "") or "")

    return ApiResponse(data={
        'stage': stage,
        'name': display_name,
        'filename': filename,
        'content': content,
        'has_content': bool(content.strip()),
    }, message="获取成功")


@router.get("/{project_id}/achievement-draft", response_model=ApiResponse[Optional[dict]])
async def get_achievement_draft(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    获取成果档案卡草稿数据，按优先级依次尝试：
    1. MD 文件（AI 直接生成了成果档案卡.md）
    2. 工作台聊天记录（AI 在对话中描述了成果卡内容）
    3. 项目元数据自动生成（兜底，让用户至少有个起点）
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问此项目")

    result, source_message = _build_achievement_draft(project_id, project)
    return ApiResponse(data=result, message=source_message)


@router.post("/{project_id}/achievement-generate", response_model=ApiResponse[AchievementCard])
async def generate_project_achievement_card(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    根据项目已有材料自动创建或更新成果档案卡。
    优先使用 AI 已整理的草稿，其次回退到聊天记录和项目元数据。
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此项目")

    draft, source_message = _build_achievement_draft(project_id, project)
    title = str(draft.get("title") or project.name).strip()
    one_liner = str(draft.get("one_liner") or "").strip()
    problem_solved = str(draft.get("problem_solved") or "").strip()
    method_used = str(draft.get("method_used") or "").strip()
    reflection = str(draft.get("reflection") or "").strip()
    capability_tags_raw = draft.get("capability_tags")
    screenshots_raw = draft.get("screenshots")
    capability_tags = [str(item).strip() for item in capability_tags_raw if str(item).strip()] if isinstance(capability_tags_raw, list) else []
    screenshots = [str(item).strip() for item in screenshots_raw if str(item).strip()] if isinstance(screenshots_raw, list) else []

    if not all([title, one_liner, problem_solved, method_used, reflection]):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="成果卡关键字段仍不完整，暂时无法自动生成")

    existing_card = db.get_achievement_card_by_project(project_id)
    if existing_card:
        final_screenshots = screenshots or existing_card.screenshots
        # 封面图为空时自动生成
        if not final_screenshots:
            cover_url = await generate_cover_image(title, one_liner, capability_tags)
            if cover_url:
                local_path = await storage_service.save_cover_image(existing_card.id, cover_url)
                if local_path:
                    final_screenshots = [local_path]
        update_data = {
            "title": title,
            "one_liner": one_liner,
            "problem_solved": problem_solved,
            "method_used": method_used,
            "reflection": reflection,
            "capability_tags": capability_tags or existing_card.capability_tags,
            "screenshots": final_screenshots,
        }
        updated_card = db.update_achievement_card(existing_card.id, update_data)
        stage08_payload = build_stage08_payload(
            skill_state.standard_step_data if (skill_state := db.get_skill_state(project_id)) else {},
            achievement_card=updated_card or existing_card,
            draft_data=draft,
        )
        merged_standard_data = merge_stage08_into_standard_data(
            skill_state.standard_step_data if skill_state else {},
            stage08_payload,
        )
        db.update_skill_state(project_id, {"standard_step_data": merged_standard_data})
        return ApiResponse(
            data=updated_card or existing_card,
            message=f"{source_message}，已更新成果档案卡",
        )

    card = AchievementCard(
        project_id=project_id,
        author_id=current_user.id,
        title=title,
        one_liner=one_liner,
        problem_solved=problem_solved,
        method_used=method_used,
        screenshots=screenshots,
        reflection=reflection,
        capability_tags=capability_tags,
        project_mode=project.mode,
        created_by=current_user.id,
    )
    created_card = db.create_achievement_card(card)
    # 封面图为空时自动生成
    if not created_card.screenshots:
        cover_url = await generate_cover_image(title, one_liner, capability_tags)
        if cover_url:
            local_path = await storage_service.save_cover_image(created_card.id, cover_url)
            if local_path:
                created_card = db.update_achievement_card(
                    created_card.id, {"screenshots": [local_path]}
                ) or created_card
    skill_state = db.get_skill_state(project_id)
    stage08_payload = build_stage08_payload(
        skill_state.standard_step_data if skill_state else {},
        achievement_card=created_card,
        draft_data=draft,
    )
    merged_standard_data = merge_stage08_into_standard_data(
        skill_state.standard_step_data if skill_state else {},
        stage08_payload,
    )
    db.update_skill_state(project_id, {"standard_step_data": merged_standard_data})
    return ApiResponse(
        data=created_card,
        message=f"{source_message}，已生成成果档案卡",
    )


def _build_achievement_draft(project_id: str, project) -> tuple[dict[str, object], str]:
    slug = _slugify_project_name(project.name)
    draft_path = Path(settings.STORAGE_BASE_PATH) / "projects" / slug / "docs" / "reports" / "成果档案卡.md"

    if draft_path.exists():
        try:
            raw = draft_path.read_text(encoding="utf-8")
            result: dict[str, object] = {"raw": raw, "project_id": project_id, "project_name": project.name, "source": "markdown_file"}
            result.update(_parse_achievement_md(raw))
            return result, "已从 AI 生成的成果卡草稿提取内容"
        except Exception:
            pass

    workspace = db.get_project_workspace(project_id) or {}
    chat_messages: list[dict] = workspace.get("chat_messages", [])
    if chat_messages:
        parsed_from_chat = _extract_achievement_from_chat(chat_messages, project.name)
        if parsed_from_chat:
            result = {"project_id": project_id, "project_name": project.name, "source": "chat_history"}
            result.update(parsed_from_chat)
            fallback = _auto_generate_achievement(project)
            for key in ("title", "one_liner", "problem_solved", "method_used", "reflection", "capability_tags"):
                if not result.get(key) and fallback.get(key):
                    result[key] = fallback[key]
            return result, "已从工作台对话记录提取成果卡内容"

    auto_generated = _auto_generate_achievement(project)
    result = {"project_id": project_id, "project_name": project.name, "source": "auto_generated"}
    result.update(auto_generated)
    return result, "已根据项目现有资料自动生成基础成果卡"


def _extract_achievement_from_chat(messages: list[dict], project_name: str) -> dict[str, object] | None:
    """从聊天记录中扫描 AI 最近生成的成果卡相关内容。"""
    # 收集最后几条 assistant 消息
    assistant_texts: list[str] = []
    for msg in reversed(messages):
        if msg.get("role") == "assistant" and msg.get("content"):
            assistant_texts.append(str(msg["content"]))
        if len(assistant_texts) >= 5:
            break
    if not assistant_texts:
        return None

    # 合并所有 assistant 文本
    combined = "\n".join(reversed(assistant_texts))

    # 尝试按 Markdown 标题格式解析
    parsed = _parse_achievement_md(combined)
    # 至少需要有一个有意义字段才算成功
    has_content = any(
        parsed.get(k) for k in ("title", "one_liner", "problem_solved", "method_used", "reflection")
    )
    if has_content:
        return parsed

    # Markdown 标题解析失败 → 用简单正则匹配"字段名：内容"格式
    field_patterns = {
        "title": r"(?:项目名称|标题)[：:]\s*(.+)",
        "one_liner": r"一句话介绍[：:]\s*(.+)",
        "problem_solved": r"(?:解决了什么问题|最终完成了)[：:]\s*(.+)",
        "method_used": r"(?:用了什么方法|技术栈|实现思路)[：:]\s*(.+)",
        "reflection": r"(?:反思|学到了什么|关键收获)[：:]\s*(.+)",
    }
    extracted: dict[str, str] = {}
    for key, pattern in field_patterns.items():
        import re as re_module
        m = re_module.search(pattern, combined)
        if m:
            extracted[key] = m.group(1).strip()

    if extracted:
        return extracted
    return None


def _auto_generate_achievement(project) -> dict[str, object]:
    """从项目元数据自动生成成果卡基础数据（兜底方案）。"""
    mode_label = "标准研学 PBL 流程" if project.mode == "standard" else "轻量项目流程"
    desc = getattr(project, "description", None) or ""
    return {
        "title": project.name,
        "one_liner": desc or f"在 AI 导师引导下完成的 {project.name} 项目",
        "problem_solved": f"通过 {mode_label}，从选题、设计到实现，完成了「{project.name}」的完整开发过程。",
        "method_used": f"使用 {mode_label} 方法论，包括阶段化推进、AI 辅助编程和迭代验证。",
        "reflection": "项目已完成全部阶段。建议回顾各阶段的学习记录，补充具体的收获和反思。",
        "capability_tags": [],
    }


# emoji 和装饰符号的 Unicode 范围，用于清洗标题文本
_EMOJI_CLEAN_PATTERN = re.compile(
    "[" + "".join((
        "\U0001F300-\U0001F9FF",  # Emoticons, Symbols, Pictographs
        "\U0001FA00-\U0001FA6F",  # Chess Symbols
        "\U0001FA70-\U0001FAFF",  # Symbols Extended-A
        "\u2600-\u27BF",           # Misc symbols (☀–➿)
        "\u2B50",                  # ⭐
        "\uFE00-\uFE0F",           # Variation Selectors
        "\u200D",                   # Zero Width Joiner
        "\U0001F000-\U0001F02F",  # Mahjong, Domino tiles
        "\U0001F0A0-\U0001F0FF",  # Playing Cards
        "\U0001F100-\U0001F64F",  # Enclosed chars, Emoticons
        "\U0001F680-\U0001F6FF",  # Transport & Map
        "\U0001F900-\U0001F9FF",  # Supplemental Symbols
        "\U0001FA00-\U0001FA6F",  # Chess
        "\U0001FA70-\U0001FAFF",  # Symbols Extended-A
    )) + "]",
)


def _clean_heading(text: str) -> str:
    """移除 emoji，保留中文/英文/数字/空格。"""
    cleaned = _EMOJI_CLEAN_PATTERN.sub("", text)
    # 移除 **text** 和 __text__ 的 Markdown 加粗标记
    cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.+?)__", r"\1", cleaned)
    return cleaned.strip()


def _match_heading_key(heading: str, key_map: dict[str, str]) -> str | None:
    """先清洗再匹配：精确 → 包含 → 返回 mapped key。"""
    cleaned = _clean_heading(heading)
    if not cleaned:
        return None
    # 精确匹配
    if cleaned in key_map:
        return key_map[cleaned]
    # 子串包含匹配（取最长命中，避免"反思"误匹配"我的反思"）
    matched = None
    matched_len = 0
    for label, mapped in key_map.items():
        if label in cleaned and len(label) > matched_len:
            matched = mapped
            matched_len = len(label)
    return matched


def _parse_table_rows(raw: str, key_map: dict[str, str]) -> dict[str, object]:
    """从 Markdown 表格行提取 key-value 对。"""
    import re as re_mod
    result: dict[str, object] = {}
    table_pattern = re_mod.compile(r"^\|(.+)\|$")
    for line in raw.splitlines():
        m = table_pattern.match(line.strip())
        if not m:
            continue
        cells = [c.strip() for c in m.group(1).split("|")]
        if len(cells) != 2:
            continue
        key_cell, value_cell = cells
        # 跳过表头行
        if not value_cell or value_cell.startswith("---"):
            continue
        # 清洗 key 单元格（去除 emoji、**加粗**、— 破折号等装饰）
        cleaned_key = _clean_heading(key_cell)
        # 中文冒号转换
        cleaned_key = cleaned_key.replace("：", "").replace(":", "").strip()
        mapped = _match_heading_key(cleaned_key, key_map)
        if mapped and mapped not in result:
            # 清洗 value（去除内联 ** ** 但保留内容）
            value_cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", value_cell)
            result[mapped] = value_cleaned.strip()
    return result


def _parse_achievement_md(raw: str) -> dict[str, object]:
    """从成果档案卡 Markdown 中按 ## 标题解析字段。
    支持 emoji 标题（如 ## 📋 项目名称）、### 三级标题、表格格式。
    """
    parsed: dict[str, object] = {}
    current_key: str | None = None
    lines_buffer: list[str] = []

    # 标题 → 字段名映射
    key_map = {
        "项目名称": "title",
        "一句话介绍": "one_liner",
        "一句话描述": "one_liner",
        "解决了什么问题": "problem_solved",
        "我解决了什么问题": "problem_solved",
        "最终完成了什么": "problem_solved",
        "核心功能": "problem_solved",
        "用了什么方法": "method_used",
        "我用了什么方法": "method_used",
        "技术方案": "method_used",
        "核心技术方案": "method_used",
        "反思": "reflection",
        "我的反思": "reflection",
        "学到了什么": "reflection",
        "能力标签": "capability_tags",
        "标签": "capability_tags",
    }

    # 先尝试从表格中提取 key-value 对
    table_parsed = _parse_table_rows(raw, key_map)
    parsed.update(table_parsed)

    for line in raw.splitlines():
        stripped = line.strip()
        # 支持 ## 和 ### 级别的标题
        heading_match = re.match(r"^(?:#{2,3})\s+(.+)", stripped)
        if heading_match:
            # 保存上一个段落
            if current_key and lines_buffer:
                value = "\n".join(lines_buffer).strip()
                if current_key not in parsed:  # 表格已有则不覆盖
                    parsed[current_key] = value
            heading = heading_match.group(1)
            mapped = _match_heading_key(heading, key_map)
            if mapped and mapped not in parsed:  # 表格已有则不覆盖
                current_key = mapped
                lines_buffer = []
            else:
                current_key = None
                lines_buffer = []
        elif current_key:
            # 收集段落内容，跳过空行开头
            if lines_buffer or stripped:
                lines_buffer.append(stripped)

    # 最后一个段落
    if current_key and lines_buffer:
        value = "\n".join(lines_buffer).strip()
        if current_key not in parsed:
            parsed[current_key] = value

    # capability_tags 特殊处理：拆分为列表
    if "capability_tags" in parsed:
        raw_tags = str(parsed["capability_tags"])
        if raw_tags.startswith("- "):
            tags = [t.lstrip("- ").strip() for t in raw_tags.splitlines() if t.strip().startswith("-")]
        elif "," in raw_tags:
            tags = [t.strip() for t in raw_tags.split(",") if t.strip()]
        else:
            tags = [raw_tags] if raw_tags else []
        parsed["capability_tags"] = tags

    return parsed


@router.post("/{project_id}/progress/light/step1", response_model=ApiResponse[ProjectProgress])
async def save_light_step1(
    project_id: str,
    step_data: LightProjectStep1Data,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    轻量项目：保存步骤1数据
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
    if project.mode != "light":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅轻量项目可用",
        )
    
    skill_state = db.get_skill_state(project_id)
    if not skill_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目状态不存在",
        )
    
    # 更新步骤数据
    updated_skill_state = db.update_skill_state(
        project_id,
        {"light_step_data": step_data},
    )
    _collect_auto_evidence(
        project_id=project_id,
        user_id=current_user.id,
        evidence_type="auto_ai_summary",
        content=f"已保存轻项目 Step1 数据：{step_data.model_dump_json()}",
        related_step="light_step_1",
    )
    
    return ApiResponse(
        data=ProjectProgress(
            current_stage=updated_skill_state.current_stage,
            stage_history=updated_skill_state.stage_history,
            light_step_data=updated_skill_state.light_step_data,
            standard_step_data=updated_skill_state.standard_step_data,
        ),
        message="保存成功",
    )


@router.post("/{project_id}/progress/light/step2", response_model=ApiResponse[ProjectProgress])
async def save_light_step2(
    project_id: str,
    step_data: LightProjectStep2Data,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    轻量项目：保存步骤2数据
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
    if project.mode != "light":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅轻量项目可用",
        )
    
    skill_state = db.get_skill_state(project_id)
    if not skill_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目状态不存在",
        )
    
    # 更新步骤数据
    current_light_data = dict(skill_state.light_step_data or {})
    updated_light_data = {**current_light_data, **step_data.model_dump()}
    
    updated_skill_state = db.update_skill_state(
        project_id,
        {"light_step_data": updated_light_data},
    )
    _collect_auto_evidence(
        project_id=project_id,
        user_id=current_user.id,
        evidence_type="auto_ai_summary",
        content=f"已保存轻项目 Step2 数据：{step_data.model_dump_json()}",
        related_step="light_step_2",
    )
    
    return ApiResponse(
        data=ProjectProgress(
            current_stage=updated_skill_state.current_stage,
            stage_history=updated_skill_state.stage_history,
            light_step_data=updated_skill_state.light_step_data,
            standard_step_data=updated_skill_state.standard_step_data,
        ),
        message="保存成功",
    )


@router.post("/{project_id}/progress/light/step3", response_model=ApiResponse[ProjectProgress])
async def save_light_step3(
    project_id: str,
    step_data: LightProjectStep3Data,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    轻量项目：保存步骤3数据
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
    if project.mode != "light":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅轻量项目可用",
        )
    
    skill_state = db.get_skill_state(project_id)
    if not skill_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目状态不存在",
        )
    
    # 更新步骤数据
    current_light_data = dict(skill_state.light_step_data or {})
    updated_light_data = {**current_light_data, **step_data.model_dump()}
    
    updated_skill_state = db.update_skill_state(
        project_id,
        {"light_step_data": updated_light_data},
    )
    _collect_auto_evidence(
        project_id=project_id,
        user_id=current_user.id,
        evidence_type="auto_ai_summary",
        content=f"已保存轻项目 Step3 数据：{step_data.model_dump_json()}",
        related_step="light_step_3",
    )
    
    return ApiResponse(
        data=ProjectProgress(
            current_stage=updated_skill_state.current_stage,
            stage_history=updated_skill_state.stage_history,
            light_step_data=updated_skill_state.light_step_data,
            standard_step_data=updated_skill_state.standard_step_data,
        ),
        message="保存成功",
    )


@router.post("/{project_id}/upgrade", response_model=ApiResponse[Project])
async def upgrade_project_to_standard(
    project_id: str,
    upgrade_data: ProjectUpgrade,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    轻量项目升级为标准项目
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
    if project.mode != "light":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅轻量项目可升级",
        )
    
    skill_state = db.get_skill_state(project_id)
    if not skill_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目状态不存在",
        )

    DEFAULT_LIGHT_TO_STANDARD = {
        "light_step_1_mapped_to": ["stage_00_bootstrap", "stage_01_brainstorm"],
        "light_step_2_mapped_to": ["stage_02_brief", "stage_03_constraints", "stage_04_track", "stage_05_design", "stage_06_step_plan"],
        "light_step_3_mapped_to": ["stage_07_execute", "stage_08_evaluate"],
    }

    mapping = upgrade_data.mapping
    if not mapping or (not mapping.light_step_1_mapped_to and not mapping.light_step_2_mapped_to and not mapping.light_step_3_mapped_to):
        from app.schemas.projects import LightToStandardMapping
        mapping = LightToStandardMapping(**DEFAULT_LIGHT_TO_STANDARD)

    updated_project = db.update_project(project_id, {"mode": "standard"})

    light_step_data = skill_state.light_step_data or {}
    standard_step_data = skill_state.standard_step_data or {}
    for step_key, stage_keys in [
        ("light_step_1", mapping.light_step_1_mapped_to),
        ("light_step_2", mapping.light_step_2_mapped_to),
        ("light_step_3", mapping.light_step_3_mapped_to),
    ]:
        step_data = light_step_data.get(step_key)
        if step_data:
            for stage_key in stage_keys:
                if stage_key not in standard_step_data:
                    standard_step_data[stage_key] = step_data

    db.update_skill_state(project_id, {
        "light_to_standard_mapping": mapping,
        "current_stage": "stage_00_bootstrap",
        "standard_step_data": standard_step_data,
    })
    _collect_auto_evidence(
        project_id=project_id,
        user_id=current_user.id,
        evidence_type="auto_stage_change",
        content="项目已从 light 升级为 standard",
        related_step="stage_01_brainstorm",
    )
    
    return ApiResponse(data=updated_project, message="升级成功")


@router.post("/{project_id}/progress/standard/{step}", response_model=ApiResponse[ProjectProgress])
async def save_standard_step(
    project_id: str,
    step: int,
    step_data: StandardProjectStepData,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    标准项目：保存任意阶段数据
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
    if project.mode != "standard":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅标准项目可用",
        )
    
    skill_state = db.get_skill_state(project_id)
    if not skill_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目状态不存在",
        )
    
    # 更新步骤数据
    current_standard_data = dict(skill_state.standard_step_data or {})
    step_key = f"step{step}"
    current_standard_data[step_key] = step_data.model_dump()
    if step == 8:
        payload = step_data.model_dump().get("payload") if isinstance(step_data.model_dump(), dict) else {}
        if isinstance(payload, dict):
            current_standard_data = merge_stage08_into_standard_data(current_standard_data, payload)
    
    updated_skill_state = db.update_skill_state(
        project_id,
        {"standard_step_data": current_standard_data},
    )
    _collect_auto_evidence(
        project_id=project_id,
        user_id=current_user.id,
        evidence_type="auto_ai_summary",
        content=f"已保存标准项目 Step{step} 数据：{step_data.model_dump_json()}",
        related_step=step_key,
    )
    
    return ApiResponse(
        data=ProjectProgress(
            current_stage=updated_skill_state.current_stage,
            stage_history=updated_skill_state.stage_history,
            light_step_data=updated_skill_state.light_step_data,
            standard_step_data=updated_skill_state.standard_step_data,
        ),
        message="保存成功",
    )


@router.post("/{project_id}/advance", response_model=ApiResponse[ProjectProgress])
async def advance_project_stage(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    推进到下一阶段
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
    
    skill_state = db.get_skill_state(project_id)
    if not skill_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目状态不存在",
        )
    
    # 带门禁推进（仅标准项目受 PBL 门禁约束；轻项目直接推进）
    if project.mode == "standard":
        result = advance_with_gate(project_id, db)
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": "当前阶段未满足推进条件",
                    "current_stage": result["current_stage"],
                    "missing_requirements": result["missing"],
                },
            )
    else:
        db.advance_skill_state(project_id)

    updated_skill_state = db.get_skill_state(project_id)
    if updated_skill_state:
        _collect_auto_evidence(
            project_id=project_id,
            user_id=current_user.id,
            evidence_type="auto_stage_change",
            content=f"阶段自动推进到 {updated_skill_state.current_stage}",
            related_step=updated_skill_state.current_stage,
        )
    return ApiResponse(
        data=ProjectProgress(
            current_stage=updated_skill_state.current_stage if updated_skill_state else result.get("new_stage", ""),
            stage_history=updated_skill_state.stage_history if updated_skill_state else [],
            light_step_data=updated_skill_state.light_step_data if updated_skill_state else {},
            standard_step_data=updated_skill_state.standard_step_data if updated_skill_state else {},
            teaching_mode=_get_teaching_mode_from_state(updated_skill_state) if updated_skill_state else "guided",
        ),
        message="推进成功",
    )


class CompleteStageRequest(BaseModel):
    """确定性推进请求体：写入指定阶段的工件并尝试推进。"""
    stage: str
    artifacts: dict[str, str]


@router.post("/{project_id}/pbl/complete-stage", response_model=ApiResponse[ProjectProgress])
async def complete_pbl_stage(
    project_id: str,
    body: CompleteStageRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    确定性推进：写入指定阶段的工件，并尝试带门禁推进到下一阶段。
    用于自动化测试——用固定工件样本逐阶段调用即可推完整条 PBL 链。
    """
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此项目")

    # 1. 逐 artifact 写入（blob + 落盘）
    for artifact_name, content in body.artifacts.items():
        save_artifact(project_id, artifact_name, content, db)

    # 2. 尝试带门禁推进
    result = advance_with_gate(project_id, db)

    # 3. 返回当前状态
    skill_state = db.get_skill_state(project_id)
    if not skill_state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目状态不存在")

    return ApiResponse(
        data=ProjectProgress(
            current_stage=skill_state.current_stage,
            stage_history=skill_state.stage_history,
            light_step_data=skill_state.light_step_data,
            standard_step_data=skill_state.standard_step_data,
            teaching_mode=_get_teaching_mode_from_state(skill_state),
        ),
        message="推进成功" if result["success"] else "工件已保存，但门禁未通过",
    )


@router.get("/{project_id}/export")
async def export_project(
    project_id: str,
    format: str = Query("md", pattern="^(md|json|zip|pdf|docx)$"),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    导出项目（MD/JSON/ZIP/PDF/DOCX）
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

    if format == "zip":
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zipf:
            _zip_json(
                zipf,
                "manifest.json",
                {
                    "project_id": project_id,
                    "project_name": project.name,
                    "generated_at": utc_now_iso(),
                    "includes": [
                        "README.md",
                        "index.html",
                        ".gitignore",
                        "src",
                        "docs",
                        "evidence",
                        "data",
                        "project_files",
                    ],
                },
            )
            _zip_json(zipf, "project.json", project.model_dump(mode="json"))

            # 生成 README.md、index.html 和 .gitignore
            export_time = utc_now()
            export_time_str = export_time.strftime("%Y-%m-%d %H:%M UTC")
            desc = getattr(project, "description", None) or ""
            readme_content = _build_readme_md(project.name, project.mode, desc, export_time_str)
            zipf.writestr("README.md", readme_content)
            index_content = _build_index_html(project.name, export_time_str)
            zipf.writestr("index.html", index_content)
            zipf.writestr(".gitignore", _GITIGNORE_CONTENT)

            for document_type in ("proposal", "technical", "final"):
                for output_format in ("md", "json", "docx", "pdf"):
                    file_name, _, payload = document_service.generate(project_id, document_type, output_format)
                    zip_path = _safe_zip_path("docs", document_type, file_name)
                    if isinstance(payload, str):
                        zipf.writestr(zip_path, payload)
                    else:
                        zipf.writestr(zip_path, payload)

            workspace = db.get_project_workspace(project_id) or {}
            _zip_json(zipf, "data/workspace.json", workspace)
            code = str(workspace.get("code") or "")
            written_source_paths: set[str] = set()
            workspace_files = workspace.get("files") or []
            if isinstance(workspace_files, list):
                for file_entry in workspace_files:
                    if not isinstance(file_entry, dict):
                        continue
                    file_name = str(file_entry.get("name") or "").strip()
                    if not file_name:
                        continue
                    zip_path = _safe_zip_path("src", file_name)
                    if not zip_path or zip_path in written_source_paths:
                        continue
                    zipf.writestr(zip_path, str(file_entry.get("content") or ""))
                    written_source_paths.add(zip_path)
            if code.strip():
                language = str(workspace.get("language") or "")
                code_name = _guess_code_filename(language, workspace.get("filename"))
                zip_path = _safe_zip_path("src", code_name)
                if zip_path not in written_source_paths:
                    zipf.writestr(zip_path, code)
            chat_messages = workspace.get("chat_messages") or []
            if chat_messages:
                _zip_json(zipf, "docs/chat_messages.json", chat_messages)

            skill_state = db.get_skill_state(project_id)
            if skill_state:
                _zip_json(zipf, "data/skill_state.json", skill_state.model_dump(mode="json"))
                for step_key, step_data in (skill_state.light_step_data or {}).items():
                    safe_name = step_key.replace("/", "_").replace("\\", "_")
                    _zip_json(zipf, f"data/steps/light_{safe_name}.json", step_data)
                for step_key, step_data in (skill_state.standard_step_data or {}).items():
                    safe_name = step_key.replace("/", "_").replace("\\", "_")
                    if isinstance(step_data, str) and step_data.strip().startswith("#"):
                        zipf.writestr(f"data/steps/standard_{safe_name}.md", step_data)
                    else:
                        _zip_json(zipf, f"data/steps/standard_{safe_name}.json", step_data)

                    if isinstance(step_data, dict):
                        for key, value in step_data.items():
                            if key.endswith("_content") and isinstance(value, str) and value.strip():
                                zipf.writestr(_safe_zip_path("docs/stage_artifacts", f"{key}.md"), value)

            evidence_list = db.list_evidence_by_project(project_id, skip=0, limit=1000)
            for idx, ev in enumerate(evidence_list):
                safe_id = ev.id.replace("/", "_").replace("\\", "_")
                if ev.type == "code" or ev.type == "code_snapshot":
                    ext = "js"
                    if "python" in (ev.content[:200] or "").lower() or ev.content.strip().startswith(("import ", "def ", "from ")):
                        ext = "py"
                    elif "html" in (ev.content[:200] or "").lower() or ev.content.strip().startswith("<"):
                        ext = "html"
                    elif "css" in (ev.content[:200] or "").lower() or ev.content.strip().startswith((".", "@", "body", "html")):
                        ext = "css"
                    zipf.writestr(f"evidence/code/{safe_id}_{idx}.{ext}", ev.content)
                elif ev.type == "markdown" or ev.type == "text":
                    zipf.writestr(f"docs/evidence/{safe_id}_{idx}.md", ev.content)
                elif ev.type == "image" and ev.content_url:
                    zipf.writestr(f"evidence/assets/{safe_id}_{idx}.url", ev.content_url)
                else:
                    _zip_json(zipf, f"evidence/{ev.type}_{safe_id}_{idx}.json", ev.model_dump(mode="json"))

            achievement = db.get_achievement_card_by_project(project_id)
            if achievement:
                _zip_json(zipf, "data/achievement_card.json", achievement.model_dump(mode="json"))

            project_slug = _slugify_project_name(project.name)
            storage_project_dir = document_service.base_path / "projects" / project_slug
            repo_project_dir = Path(__file__).resolve().parents[4] / "projects" / project_slug
            _add_directory_to_zip(zipf, storage_project_dir, "project_files/storage")
            _add_directory_to_zip(zipf, repo_project_dir, "project_files/repository")

        zip_filename = _make_export_filename(project.name, "zip")
        headers = {"Content-Disposition": _build_content_disposition(zip_filename, "project_export.zip")}
        return Response(content=buffer.getvalue(), media_type="application/zip", headers=headers)

    if format in {"pdf", "docx"}:
        file_name, media_type, payload = document_service.generate(project_id, "final", format)
        headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
        if isinstance(payload, str):
            return Response(content=payload.encode("utf-8"), media_type=media_type, headers=headers)
        return Response(content=payload, media_type=media_type, headers=headers)

    if format == "json":
        payload = {
            "project": project.model_dump(mode="json"),
            "skill_state": db.get_skill_state(project_id).model_dump(mode="json") if db.get_skill_state(project_id) else None,
            "evidence": [item.model_dump(mode="json") for item in db.list_evidence_by_project(project_id, skip=0, limit=1000)],
        }
        json_filename = _make_export_filename(project.name, "json")
        return Response(
            content=json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"),
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": _build_content_disposition(json_filename, "project_export.json")},
        )

    # md
    md_name, _, md_text = document_service.generate(project_id, "final", "md")
    md_filename = _make_export_filename(project.name, "md")
    return PlainTextResponse(
        content=md_text if isinstance(md_text, str) else md_text.decode("utf-8"),
        headers={"Content-Disposition": _build_content_disposition(md_filename, "project_export.md")},
        media_type="text/markdown; charset=utf-8",
    )


@router.delete("/{project_id}", response_model=ApiResponse[None])
async def delete_project(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    删除项目
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
    
    success = db.delete_project(project_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在",
        )
    
    return ApiResponse(data=None, message="删除成功")
