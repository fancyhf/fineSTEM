from __future__ import annotations

import uuid

from app.core.time_utils import utc_now
from app.db.models import EvidenceModel
from app.repositories.base import BaseRepository
from app.schemas.evidence import Evidence


def _to_schema(model: EvidenceModel) -> Evidence:
    return Evidence(
        id=model.id,
        project_id=model.project_id,
        author_id=model.author_id,
        type=model.type,  # type: ignore[arg-type]
        title=model.title,
        content=model.content,
        content_url=model.content_url,
        related_step=model.related_step,
        created_at=model.created_at,
        created_by=model.created_by,
        updated_at=model.updated_at,
        updated_by=model.updated_by,
        deleted_at=model.deleted_at,
        deleted_by=model.deleted_by,
        is_deleted=model.is_deleted,
    )


class EvidenceRepo(BaseRepository):
    def create_evidence(self, evidence: Evidence) -> Evidence:
        row = EvidenceModel(
            id=evidence.id or str(uuid.uuid4()),
            project_id=evidence.project_id,
            author_id=evidence.author_id,
            type=evidence.type,
            title=evidence.title or evidence.related_step or "",
            content=evidence.content,
            content_url=evidence.content_url,
            related_step=evidence.related_step,
            created_at=evidence.created_at,
            created_by=evidence.author_id,
            updated_at=evidence.updated_at,
            updated_by=evidence.updated_by,
            deleted_at=evidence.deleted_at,
            deleted_by=evidence.deleted_by,
            is_deleted=evidence.is_deleted,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return _to_schema(row)

    def get_evidence(self, evidence_id: str) -> Evidence | None:
        row = self.db.get(EvidenceModel, evidence_id)
        if not row or row.is_deleted:
            return None
        return _to_schema(row)

    def list_evidence_by_project(self, project_id: str, skip: int = 0, limit: int = 50) -> list[Evidence]:
        rows = (
            self.db.query(EvidenceModel)
            .filter(EvidenceModel.project_id == project_id, EvidenceModel.is_deleted.is_(False))
            .order_by(EvidenceModel.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return [_to_schema(item) for item in rows]

    def list_evidence(
        self,
        project_id: str,
        skip: int = 0,
        limit: int = 50,
        type: str | None = None,
    ) -> list[Evidence]:
        query = self.db.query(EvidenceModel).filter(
            EvidenceModel.project_id == project_id,
            EvidenceModel.is_deleted.is_(False),
        )
        if type:
            query = query.filter(EvidenceModel.type == type)
        rows = query.order_by(EvidenceModel.created_at.desc()).offset(skip).limit(limit).all()
        return [_to_schema(item) for item in rows]

    def count_evidence(self, project_id: str, type: str | None = None) -> int:
        query = self.db.query(EvidenceModel).filter(
            EvidenceModel.project_id == project_id,
            EvidenceModel.is_deleted.is_(False),
        )
        if type:
            query = query.filter(EvidenceModel.type == type)
        return query.count()

    def update_evidence(self, evidence_id: str, data: dict) -> Evidence | None:
        row = self.db.get(EvidenceModel, evidence_id)
        if not row or row.is_deleted:
            return None
        for key, value in data.items():
            if value is not None:
                if key == "related_step":
                    row.related_step = value
                    if not row.title:
                        row.title = value
                elif key == "content_url":
                    row.content_url = value
                else:
                    setattr(row, key, value)
        row.updated_at = utc_now()
        self.db.commit()
        self.db.refresh(row)
        return _to_schema(row)

    def delete_evidence(self, evidence_id: str, deleted_by: str) -> bool:
        row = self.db.get(EvidenceModel, evidence_id)
        if not row or row.is_deleted:
            return False
        row.is_deleted = True
        row.deleted_at = utc_now()
        row.deleted_by = deleted_by
        self.db.commit()
        return True
