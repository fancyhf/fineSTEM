from __future__ import annotations

from datetime import datetime

from app.db.models import ProjectCapabilityTagModel, ProjectModel, SkillStateModel
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


def _to_project(model: ProjectModel) -> Project:
    return Project(
        id=model.id,
        author_id=model.author_id,
        name=model.name,
        mode=model.mode,  # type: ignore[arg-type]
        current_stage=model.current_stage,
        from_demo_id=model.from_demo_id,
        initial_data=json_loads(model.initial_data, {}),
        created_at=model.created_at,
        created_by=model.created_by,
        updated_at=model.updated_at,
        updated_by=model.updated_by,
        deleted_at=model.deleted_at,
        deleted_by=model.deleted_by,
        is_deleted=model.is_deleted,
    )


def _to_skill_state(model: SkillStateModel) -> SkillState:
    return SkillState(
        project_id=model.project_id,
        version=model.version or "1.0.0",
        mode=model.mode,  # type: ignore[arg-type]
        current_stage=model.current_stage,  # type: ignore[arg-type]
        light_step=int(model.light_step) if model.light_step else None,  # type: ignore[arg-type]
        stages=json_loads(model.stages, {}),
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
                stage_history=json_dumps([{"stage": project.current_stage, "started_at": datetime.utcnow().isoformat()}], "[]"),
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
            setattr(row, key, value)
        row.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(row)
        return _to_project(row)

    def delete_project(self, project_id: str, deleted_by: str) -> bool:
        row = self.db.get(ProjectModel, project_id)
        if not row or row.is_deleted:
            return False
        row.is_deleted = True
        row.deleted_at = datetime.utcnow()
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
                setattr(row, key, json_dumps(value))
            elif key == "metadata":
                row.skill_metadata = json_dumps(value)
            elif key == "light_step":
                row.light_step = str(value) if value else None
            else:
                setattr(row, key, value)
        row.updated_at = datetime.utcnow()
        project = self.db.get(ProjectModel, project_id)
        if project:
            project.current_stage = row.current_stage
            project.updated_at = datetime.utcnow()
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
            history.append({"stage": row.current_stage, "started_at": datetime.utcnow().isoformat()})
            row.stage_history = json_dumps(history, "[]")
            project = self.db.get(ProjectModel, project_id)
            if project:
                project.current_stage = row.current_stage
                project.updated_at = datetime.utcnow()
        row.updated_at = datetime.utcnow()
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
            row.updated_at = datetime.utcnow()
        self.db.commit()
        return normalized
