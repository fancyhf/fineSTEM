"""
研学项目 API 路由

用途：项目 CRUD、状态推进等
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from datetime import datetime
from typing import Optional
import io
import json
import uuid
import zipfile
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
)
from app.schemas.evidence import Evidence
from app.schemas.common import ApiResponse, PaginationResult
from app.schemas.auth import UserResponse
from app.repositories.runtime_db import db
from app.api.auth import get_current_user
from app.services.document_service import document_service
from app.services.pbl_engine import advance_with_gate, save_artifact

router = APIRouter(prefix="/projects", tags=["研学项目"])


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
    progress = ProjectProgress(
        current_stage=skill_state.current_stage,
        stage_history=skill_state.stage_history,
        light_step_data=skill_state.light_step_data,
        standard_step_data=skill_state.standard_step_data,
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

    db.save_project_workspace(
        project_id,
        {
            "code": code_data.code,
            "language": code_data.language,
            "filename": code_data.filename,
            "saved_at": datetime.utcnow().isoformat(),
        },
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

    return ApiResponse(data={
        'code': code,
        'language': language,
        'filename': filename,
        'saved_at': saved_at,
        'has_code': bool(code),
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
            "chat_saved_at": datetime.utcnow().isoformat(),
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
            md_name, _, md_text = document_service.generate(project_id, "final", "md")
            json_name, _, json_text = document_service.generate(project_id, "final", "json")
            zipf.writestr(md_name, md_text if isinstance(md_text, str) else md_text.decode("utf-8"))
            zipf.writestr(json_name, json_text if isinstance(json_text, str) else json_text.decode("utf-8"))

            skill_state = db.get_skill_state(project_id)
            if skill_state:
                zipf.writestr(
                    "skill_state.json",
                    json.dumps(skill_state.model_dump(mode="json"), ensure_ascii=False, indent=2),
                )
                for step_key, step_data in skill_state.light_step_data.items():
                    safe_name = step_key.replace("/", "_").replace("\\", "_")
                    zipf.writestr(
                        f"steps/light_{safe_name}.json",
                        json.dumps(step_data, ensure_ascii=False, indent=2) if isinstance(step_data, dict) else str(step_data),
                    )
                for step_key, step_data in skill_state.standard_step_data.items():
                    safe_name = step_key.replace("/", "_").replace("\\", "_")
                    zipf.writestr(
                        f"steps/standard_{safe_name}.json",
                        json.dumps(step_data, ensure_ascii=False, indent=2) if isinstance(step_data, dict) else str(step_data),
                    )

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
                    zipf.writestr(f"code/{safe_id}_{idx}.{ext}", ev.content)
                elif ev.type == "markdown" or ev.type == "text":
                    zipf.writestr(f"docs/{safe_id}_{idx}.md", ev.content)
                elif ev.type == "image" and ev.content_url:
                    zipf.writestr(f"assets/{safe_id}_{idx}.url", ev.content_url)
                else:
                    zipf.writestr(
                        f"evidence/{ev.type}_{safe_id}_{idx}.json",
                        json.dumps(ev.model_dump(mode="json"), ensure_ascii=False, indent=2),
                    )

            achievement = db.get_achievement_card_by_project(project_id)
            if achievement:
                zipf.writestr(
                    "achievement_card.json",
                    json.dumps(achievement.model_dump(mode="json"), ensure_ascii=False, indent=2),
                )

        headers = {"Content-Disposition": f'attachment; filename="{project_id}_package.zip"'}
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
        return Response(
            content=json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"),
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{project_id}.json"'},
        )

    # md
    md_name, _, md_text = document_service.generate(project_id, "final", "md")
    return PlainTextResponse(
        content=md_text if isinstance(md_text, str) else md_text.decode("utf-8"),
        headers={"Content-Disposition": f'attachment; filename="{md_name}"'},
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
