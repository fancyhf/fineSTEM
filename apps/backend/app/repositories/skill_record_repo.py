"""
Skill 记录 Repository

用途：Skill 安装记录的数据库持久化
维护者：AI Agent
"""

from __future__ import annotations

from sqlalchemy import text

from app.core.time_utils import utc_now
from app.db.models import SkillRecordModel
from app.repositories.base import BaseRepository
from app.repositories.utils import json_dumps, json_loads
from app.schemas.skills import SkillManifest, SkillRecord


def _to_schema(model: SkillRecordModel) -> SkillRecord:
    manifest_data = json_loads(model.manifest, {})
    return SkillRecord(
        id=model.id,
        owner_id=model.owner_id,
        source=model.source,
        status=model.status,
        manifest=SkillManifest(**manifest_data) if manifest_data else SkillManifest(
            skill_id=model.id, name=model.id, version="0.0.0", entrypoint="",
        ),
        config=json_loads(model.config, {}),
        install_date=model.install_date,
        last_used_at=model.last_used_at,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class SkillRecordRepo(BaseRepository):
    def list_skills(self, owner_id: str) -> list[SkillRecord]:
        rows = (
            self.db.query(SkillRecordModel)
            .filter(SkillRecordModel.owner_id == owner_id, SkillRecordModel.is_deleted.is_(False))
            .all()
        )
        return [_to_schema(item) for item in rows]

    def get_skill(self, skill_id: str, owner_id: str) -> SkillRecord | None:
        row = (
            self.db.query(SkillRecordModel)
            .filter(SkillRecordModel.owner_id == owner_id, SkillRecordModel.is_deleted.is_(False))
            .all()
        )
        for r in row:
            manifest_data = json_loads(r.manifest, {})
            if manifest_data.get("skill_id") == skill_id:
                return _to_schema(r)
        row_by_id = (
            self.db.query(SkillRecordModel)
            .filter(SkillRecordModel.id == skill_id, SkillRecordModel.owner_id == owner_id, SkillRecordModel.is_deleted.is_(False))
            .first()
        )
        return _to_schema(row_by_id) if row_by_id else None

    def create_skill(self, skill: SkillRecord) -> SkillRecord:
        row = SkillRecordModel(
            id=skill.id,
            owner_id=skill.owner_id,
            source=skill.source,
            status=skill.status,
            manifest=json_dumps(skill.manifest.model_dump()),
            config=json_dumps(skill.config),
            install_date=skill.install_date or utc_now(),
            last_used_at=skill.last_used_at,
            created_at=skill.created_at,
            updated_at=skill.updated_at,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return _to_schema(row)

    def update_skill_status(self, skill_id: str, owner_id: str, status: str) -> SkillRecord | None:
        row = self._find_by_skill_id(skill_id, owner_id)
        if not row:
            return None
        row.status = status
        row.updated_at = utc_now()
        self.db.commit()
        self.db.refresh(row)
        return _to_schema(row)

    def delete_skill(self, skill_id: str, owner_id: str) -> bool:
        row = self._find_by_skill_id(skill_id, owner_id)
        if not row:
            return False
        row.is_deleted = True
        row.deleted_at = utc_now()
        row.deleted_by = owner_id
        self.db.commit()
        return True

    def _find_by_skill_id(self, skill_id: str, owner_id: str) -> SkillRecordModel | None:
        rows = (
            self.db.query(SkillRecordModel)
            .filter(SkillRecordModel.owner_id == owner_id, SkillRecordModel.is_deleted.is_(False))
            .all()
        )
        for r in rows:
            manifest_data = json_loads(r.manifest, {})
            if manifest_data.get("skill_id") == skill_id:
                return r
        row_by_id = (
            self.db.query(SkillRecordModel)
            .filter(SkillRecordModel.id == skill_id, SkillRecordModel.owner_id == owner_id, SkillRecordModel.is_deleted.is_(False))
            .first()
        )
        return row_by_id
