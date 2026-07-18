from __future__ import annotations

from pydantic import BaseModel

from app.db.models import ProjectCapabilityTagModel, ProjectModel, SkillStateModel
from app.core.time_utils import utc_now, utc_now_iso
from app.repositories.base import BaseRepository
from app.repositories.utils import json_dumps, json_loads
from app.schemas.projects import Project, SkillState

STAGES = [
    "stage_00_bootstrap",
    "stage_01_brainstorm",
    "stage_02_brief",
    "stage_03_constraints",
    "stage_04_track",
    "stage_05_design",
    "stage_06_step_plan",
    "stage_07_execute",
    "stage_08_evaluate",
]


def _normalize_stage_statuses(stages: dict) -> dict:
    """兼容清洗历史写入的非法阶段状态。"""
    if not isinstance(stages, dict):
        return {}
    normalized: dict = {}
    for stage_key, stage_value in stages.items():
        if isinstance(stage_value, BaseModel):
            stage_value = stage_value.model_dump(mode="json")
        if isinstance(stage_value, dict):
            if stage_value.get("status") == "valid":
                stage_value["status"] = "completed"
            normalized[stage_key] = stage_value
            continue
        if isinstance(stage_value, str):
            fallback_status = "completed" if "completed" in stage_value or "valid" in stage_value else "active"
            normalized[stage_key] = {"status": fallback_status, "data": {}}
            continue
        normalized[stage_key] = {"status": "locked", "data": {}}
    return normalized


def _normalize_initial_data(raw: object) -> dict:
    if isinstance(raw, dict):
        return raw
    return json_loads(raw, {})


def _to_project(model: ProjectModel) -> Project:
    return Project(
        id=model.id,
        author_id=model.author_id,
        name=model.name,
        mode=model.mode,  # type: ignore[arg-type]
        current_stage=model.current_stage,
        from_demo_id=model.from_demo_id,
        initial_data=_normalize_initial_data(model.initial_data),
        created_at=model.created_at,
        created_by=model.created_by,
        updated_at=model.updated_at,
        updated_by=model.updated_by,
        deleted_at=model.deleted_at,
        deleted_by=model.deleted_by,
        is_deleted=model.is_deleted,
    )


def _to_skill_state(model: SkillStateModel) -> SkillState:
    stages = _normalize_stage_statuses(json_loads(model.stages, {}))
    return SkillState(
        project_id=model.project_id,
        version=model.version or "1.0.0",
        mode=model.mode,  # type: ignore[arg-type]
        current_stage=model.current_stage,  # type: ignore[arg-type]
        light_step=int(model.light_step) if model.light_step else None,  # type: ignore[arg-type]
        stages=stages,
        metadata=json_loads(model.skill_metadata, {}),
        light_to_standard_mapping=json_loads(model.light_to_standard_mapping, None),
        stage_history=json_loads(model.stage_history, []),
        light_step_data=json_loads(model.light_step_data, {}),
        standard_step_data=json_loads(model.standard_step_data, {}),
        created_at=model.created_at,
        created_by=model.created_by,
        updated_at=model.updated_at,
        updated_by=model.updated_by,
        deleted_at=model.deleted_at,
        deleted_by=model.deleted_by,
        is_deleted=model.is_deleted,
    )


class ProjectRepo(BaseRepository):
    @staticmethod
    def _extract_workspace(initial_data: dict) -> dict:
        workspace = initial_data.get("workspace")
        if not isinstance(workspace, dict):
            workspace = {}
        # Backward compatibility for older projects that stored fields at root level.
        if "code" in initial_data and "code" not in workspace:
            workspace["code"] = initial_data.get("code", "")
        if "language" in initial_data and "language" not in workspace:
            workspace["language"] = initial_data.get("language", "python")
        if "filename" in initial_data and "filename" not in workspace:
            workspace["filename"] = initial_data.get("filename")
        if "saved_at" in initial_data and "saved_at" not in workspace:
            workspace["saved_at"] = initial_data.get("saved_at")
        if "preview_html" in initial_data and "preview_html" not in workspace:
            workspace["preview_html"] = initial_data.get("preview_html", "")
        if "chat_messages" in initial_data and "chat_messages" not in workspace:
            workspace["chat_messages"] = initial_data.get("chat_messages", [])
        if "chat_saved_at" in initial_data and "chat_saved_at" not in workspace:
            workspace["chat_saved_at"] = initial_data.get("chat_saved_at")
        workspace.setdefault("code", "")
        workspace.setdefault("language", "python")
        workspace.setdefault("filename", None)
        workspace.setdefault("preview_html", "")
        workspace.setdefault("chat_messages", [])
        workspace.setdefault("saved_at", None)
        workspace.setdefault("chat_saved_at", None)
        workspace.setdefault("files", [])  # 多文件支持，默认空列表
        return workspace

    def _save_project_row(self, row: ProjectModel, *, updated_by: str | None = None) -> None:
        row.updated_at = utc_now()
        if updated_by:
            row.updated_by = updated_by
        self.db.commit()
        self.db.refresh(row)

    def get_project(self, project_id: str) -> Project | None:
        model = self.db.get(ProjectModel, project_id)
        if not model or model.is_deleted:
            return None
        return _to_project(model)

    def list_projects(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        mode: str | None = None,
        stage: str | None = None,
    ) -> list[Project]:
        query = self.db.query(ProjectModel).filter(ProjectModel.author_id == user_id, ProjectModel.is_deleted.is_(False))
        if mode:
            query = query.filter(ProjectModel.mode == mode)
        if stage:
            query = query.filter(ProjectModel.current_stage == stage)
        rows = query.order_by(ProjectModel.created_at.desc()).offset(skip).limit(limit).all()
        return [_to_project(item) for item in rows]

    def count_projects(self, user_id: str, mode: str | None = None, stage: str | None = None) -> int:
        query = self.db.query(ProjectModel).filter(ProjectModel.author_id == user_id, ProjectModel.is_deleted.is_(False))
        if mode:
            query = query.filter(ProjectModel.mode == mode)
        if stage:
            query = query.filter(ProjectModel.current_stage == stage)
        return query.count()

    def create_project(self, project: Project) -> Project:
        row = ProjectModel(
            id=project.id,
            author_id=project.author_id,
            name=project.name,
            mode=project.mode,
            description="",
            current_stage=project.current_stage,
            from_demo_id=project.from_demo_id,
            initial_data=json_dumps(project.initial_data, "{}"),
            created_at=project.created_at,
            created_by=project.created_by,
            updated_at=project.updated_at,
            updated_by=project.updated_by,
            deleted_at=project.deleted_at,
            deleted_by=project.deleted_by,
            is_deleted=project.is_deleted,
        )
        self.db.add(row)
        self.db.add(
            SkillStateModel(
                project_id=project.id,
                version="1.0.0",
                mode=project.mode,
                current_stage=project.current_stage,
                light_step="1" if project.mode == "light" else None,
                stages="{}",
                metadata="{}",
                light_to_standard_mapping=None,
                stage_history=json_dumps([{"stage": project.current_stage, "started_at": utc_now_iso()}], "[]"),
                light_step_data="{}",
                standard_step_data="{}",
            )
        )
        self.db.commit()
        self.db.refresh(row)
        return _to_project(row)

    def update_project(self, project_id: str, project_data: dict) -> Project | None:
        row = self.db.get(ProjectModel, project_id)
        if not row or row.is_deleted:
            return None
        for key, value in project_data.items():
            if value is None:
                continue
            if key == "initial_data":
                row.initial_data = json_dumps(value, "{}")
            else:
                setattr(row, key, value)
        self._save_project_row(row)
        return _to_project(row)

    def get_project_workspace(self, project_id: str) -> dict | None:
        row = self.db.get(ProjectModel, project_id)
        if not row or row.is_deleted:
            return None
        return self._extract_workspace(_normalize_initial_data(row.initial_data))

    def save_project_workspace(self, project_id: str, workspace_data: dict, updated_by: str | None = None) -> dict | None:
        row = self.db.get(ProjectModel, project_id)
        if not row or row.is_deleted:
            return None

        # === 终极 MVP 模板代码拦截（数据库写入层 - 最后一道防线）===
        _mvp_fingerprints = [
            "fineSTEM MVP", "我的 STEM 项目 MVP", "actionButton",
            "已成功运行", "这是一个可运行的最小版本",
            "你可以继续让 AI 按你的项目主题扩展功能",
            "已生成一个可运行的最小代码版本",
        ]
        _code_to_check = workspace_data.get("code", "")
        if any(marker in _code_to_check for marker in _mvp_fingerprints):
            import logging
            logging.warning(
                "[MVP_BLOCK_DB_LAYER] save_project_workspace 拦截到 MVP 模板代码，拒绝写入! "
                "project_id=%s code_len=%d updated_by=%s",
                project_id, len(_code_to_check), updated_by,
            )
            # 返回当前 workspace 数据但不做任何修改（静默拒绝）
            initial_data = _normalize_initial_data(row.initial_data)
            return self._extract_workspace(initial_data)

        # 同时检查 files 数组中的每个文件
        _files = workspace_data.get("files")
        if isinstance(_files, list):
            for _f in _files:
                _fcontent = (_f.get("content") or "") if isinstance(_f, dict) else ""
                if any(marker in _fcontent for marker in _mvp_fingerprints):
                    import logging
                    logging.warning(
                        "[MVP_BLOCK_DB_LAYER] save_project_workspace 拦截到 files 中含 MVP (file=%s)，拒绝写入!",
                        _f.get("name", "?"),
                    )
                    initial_data = _normalize_initial_data(row.initial_data)
                    return self._extract_workspace(initial_data)

        initial_data = _normalize_initial_data(row.initial_data)
        workspace = self._extract_workspace(initial_data)

        # ========== 历史快照 + 可疑覆盖检测（2026-07-18 事故修复）==========
        # 背景：原合并式写入 workspace.update(...) 会无条件覆盖旧 code，导致任何
        #   误调用（如自动捞代码块、前端 JSON 污染重置反向写库）都会永久丢失原代码。
        # 保护策略：
        #   1. 当 code 即将变化时，把旧 code 推入 workspace.code_history（保留最近 5 版），
        #      使任何覆盖都能通过 history 字段恢复。
        #   2. 可疑覆盖检测：新 code 长度 < 旧 code 长度 × 10% 且 language 发生变化，
        #      几乎必定是误覆盖（例如把完整 HTML 项目代码换成一段 Python 诊断脚本），
        #      记 warning 便于事后追溯。这里不阻断写入（避免误伤合法的"删改重构"），
        #      但快照已经留底，必要时可手动回滚。
        new_code = workspace_data.get("code")
        if isinstance(new_code, str):
            old_code = workspace.get("code") or ""
            old_code_stripped = old_code.strip()
            new_code_stripped = new_code.strip()
            # 仅在两者都非空、且内容确有变化时才记录快照（避免空字符串占位污染 history）
            if old_code_stripped and new_code_stripped and old_code_stripped != new_code_stripped:
                new_language = workspace_data.get("language")
                old_language = workspace.get("language")
                # 可疑覆盖告警（不阻断）
                if (
                    len(new_code_stripped) < len(old_code_stripped) * 0.1
                    and isinstance(new_language, str)
                    and isinstance(old_language, str)
                    and new_language != old_language
                ):
                    import logging
                    logging.warning(
                        "[SUSPICIOUS_OVERWRITE] project_id=%s updated_by=%s "
                        "code %d -> %d chars, language %r -> %r; "
                        "old code backed up to workspace.code_history",
                        project_id, updated_by,
                        len(old_code_stripped), len(new_code_stripped),
                        old_language, new_language,
                    )
                # 推入历史快照
                history = workspace.get("code_history")
                if not isinstance(history, list):
                    history = []
                history.append({
                    "code": old_code,
                    "language": old_language,
                    "filename": workspace.get("filename"),
                    "saved_at": workspace.get("saved_at"),
                    "archived_at": utc_now_iso(),
                    "archived_reason": "overwrite",
                })
                # 保留最近 5 版，丢弃更早的（避免 initial_data 无限膨胀）
                workspace["code_history"] = history[-5:]

        workspace.update({key: value for key, value in workspace_data.items() if value is not None})
        initial_data["workspace"] = workspace
        row.initial_data = json_dumps(initial_data, "{}")
        self._save_project_row(row, updated_by=updated_by)
        return workspace

    def delete_project(self, project_id: str, deleted_by: str) -> bool:
        row = self.db.get(ProjectModel, project_id)
        if not row or row.is_deleted:
            return False
        row.is_deleted = True
        row.deleted_at = utc_now()
        row.deleted_by = deleted_by
        self.db.commit()
        return True

    def get_skill_state(self, project_id: str) -> SkillState | None:
        row = self.db.get(SkillStateModel, project_id)
        if not row or row.is_deleted:
            return None
        return _to_skill_state(row)

    def create_skill_state(self, skill_state: SkillState) -> SkillState:
        row = (
            self.db.query(SkillStateModel)
            .filter(SkillStateModel.project_id == skill_state.project_id)
            .first()
        )
        if not row:
            row = SkillStateModel(project_id=skill_state.project_id)
            self.db.add(row)
        row.version = skill_state.version
        row.mode = skill_state.mode
        row.current_stage = skill_state.current_stage
        row.light_step = str(skill_state.light_step) if skill_state.light_step else None
        row.stages = json_dumps(skill_state.stages, "{}")
        row.skill_metadata = json_dumps(skill_state.metadata, "{}")
        row.light_to_standard_mapping = json_dumps(skill_state.light_to_standard_mapping) if skill_state.light_to_standard_mapping else None
        row.stage_history = json_dumps(skill_state.stage_history, "[]")
        row.light_step_data = json_dumps(skill_state.light_step_data, "{}")
        row.standard_step_data = json_dumps(skill_state.standard_step_data, "{}")
        row.created_at = skill_state.created_at
        row.created_by = getattr(skill_state, 'created_by', None)
        row.updated_at = skill_state.updated_at
        row.updated_by = getattr(skill_state, 'updated_by', None)
        row.deleted_at = getattr(skill_state, 'deleted_at', None)
        row.deleted_by = getattr(skill_state, 'deleted_by', None)
        row.is_deleted = getattr(skill_state, 'is_deleted', False)
        self.db.commit()
        return self.get_skill_state(skill_state.project_id) or skill_state

    def update_skill_state(self, project_id: str, dict_data: dict) -> SkillState | None:
        row = self.db.get(SkillStateModel, project_id)
        if not row or row.is_deleted:
            return None
        json_keys = {
            "stage_history", "light_step_data", "standard_step_data",
            "stages", "light_to_standard_mapping",
        }
        for key, value in dict_data.items():
            if value is None:
                continue
            if key in json_keys:
                if key == "stages":
                    value = _normalize_stage_statuses(value)
                setattr(row, key, json_dumps(value))
            elif key == "metadata":
                row.skill_metadata = json_dumps(value)
            elif key == "light_step":
                row.light_step = str(value) if value else None
            else:
                setattr(row, key, value)
        row.updated_at = utc_now()
        project = self.db.get(ProjectModel, project_id)
        if project:
            project.current_stage = row.current_stage
            project.updated_at = utc_now()
        self.db.commit()
        return _to_skill_state(row)

    def advance_skill_state(self, project_id: str) -> SkillState | None:
        row = self.db.get(SkillStateModel, project_id)
        if not row or row.is_deleted:
            return None
        try:
            idx = STAGES.index(row.current_stage)
        except ValueError:
            idx = 0
        if idx < len(STAGES) - 1:
            row.current_stage = STAGES[idx + 1]
            history = json_loads(row.stage_history, [])
            history.append({"stage": row.current_stage, "started_at": utc_now_iso()})
            row.stage_history = json_dumps(history, "[]")
            project = self.db.get(ProjectModel, project_id)
            if project:
                project.current_stage = row.current_stage
                project.updated_at = utc_now()
        row.updated_at = utc_now()
        self.db.commit()
        return _to_skill_state(row)

    def get_project_capability_tags(self, project_id: str) -> list[str]:
        row = self.db.get(ProjectCapabilityTagModel, project_id)
        if not row:
            return []
        return json_loads(row.tags, [])

    def set_project_capability_tags(self, project_id: str, tags: list[str]) -> list[str]:
        normalized = [item.strip() for item in tags if item and item.strip()]
        row = self.db.get(ProjectCapabilityTagModel, project_id)
        if not row:
            row = ProjectCapabilityTagModel(project_id=project_id, tags=json_dumps(normalized, "[]"))
            self.db.add(row)
        else:
            row.tags = json_dumps(normalized, "[]")
            row.updated_at = utc_now()
        self.db.commit()
        return normalized
