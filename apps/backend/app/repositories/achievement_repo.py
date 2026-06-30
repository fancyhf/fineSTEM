from __future__ import annotations

import secrets
import uuid

from app.core.time_utils import utc_now
from app.db.models import AchievementCardModel
from app.repositories.base import BaseRepository
from app.repositories.utils import json_dumps, json_loads
from app.schemas.achievements import AchievementCard


def _to_schema(model: AchievementCardModel) -> AchievementCard:
    return AchievementCard(
        id=model.id,
        project_id=model.project_id,
        author_id=model.author_id,
        title=model.title,
        one_liner=model.one_liner,
        problem_solved=model.problem_solved,
        method_used=model.method_used,
        screenshots=json_loads(model.screenshots, []),
        reflection=model.reflection,
        capability_tags=json_loads(model.capability_tags, []),
        project_mode=model.project_mode,  # type: ignore[arg-type]
        is_public=model.is_public,
        submitted_at=model.submitted_at,
        created_at=model.created_at,
        created_by=model.created_by,
        updated_at=model.updated_at,
        updated_by=model.updated_by,
        deleted_at=model.deleted_at,
        deleted_by=model.deleted_by,
        is_deleted=model.is_deleted,
    )


class AchievementRepo(BaseRepository):
    def get_achievement_card(self, card_id: str) -> AchievementCard | None:
        row = self.db.get(AchievementCardModel, card_id)
        if not row or row.is_deleted:
            return None
        return _to_schema(row)

    def get_achievement_card_by_project(self, project_id: str) -> AchievementCard | None:
        row = (
            self.db.query(AchievementCardModel)
            .filter(AchievementCardModel.project_id == project_id, AchievementCardModel.is_deleted.is_(False))
            .first()
        )
        if not row:
            return None
        return _to_schema(row)

    def create_or_update_achievement_card(self, card: AchievementCard) -> AchievementCard:
        row = (
            self.db.query(AchievementCardModel)
            .filter(AchievementCardModel.project_id == card.project_id, AchievementCardModel.is_deleted.is_(False))
            .first()
        )
        if not row:
            row = AchievementCardModel(id=card.id, project_id=card.project_id, author_id=card.author_id)
            self.db.add(row)
        row.title = card.title
        row.one_liner = card.one_liner
        row.problem_solved = card.problem_solved
        row.method_used = card.method_used
        row.screenshots = json_dumps(card.screenshots, default="[]")
        row.reflection = card.reflection
        row.capability_tags = json_dumps(card.capability_tags, default="[]")
        row.project_mode = card.project_mode
        row.is_public = card.is_public
        row.submitted_at = card.submitted_at
        row.updated_at = utc_now()
        self.db.commit()
        self.db.refresh(row)
        return _to_schema(row)

    def create_achievement_card(self, card: AchievementCard) -> AchievementCard:
        if not card.id:
            card.id = str(uuid.uuid4())
        return self.create_or_update_achievement_card(card)

    def update_achievement_card(self, card_id: str, update_data: dict) -> AchievementCard | None:
        row = self.db.get(AchievementCardModel, card_id)
        if not row or row.is_deleted:
            return None
        for key, value in update_data.items():
            if value is None:
                continue
            if key in {"screenshots", "capability_tags"}:
                setattr(row, key, json_dumps(value, default="[]"))
            else:
                setattr(row, key, value)
        row.updated_at = utc_now()
        self.db.commit()
        self.db.refresh(row)
        return _to_schema(row)

    def list_public_achievement_cards(
        self,
        skip: int = 0,
        limit: int = 20,
        capability_tag: str | None = None,
        mode: str | None = None,
    ) -> list[AchievementCard]:
        rows = (
            self.db.query(AchievementCardModel)
            .filter(AchievementCardModel.is_deleted.is_(False), AchievementCardModel.is_public.is_(True))
            .order_by(AchievementCardModel.updated_at.desc())
            .all()
        )
        if capability_tag:
            rows = [item for item in rows if capability_tag in json_loads(item.capability_tags, [])]
        if mode:
            rows = [item for item in rows if item.project_mode == mode]
        return [_to_schema(item) for item in rows[skip : skip + limit]]

    def count_public_achievement_cards(self, capability_tag: str | None = None, mode: str | None = None) -> int:
        return len(self.list_public_achievement_cards(0, 100000, capability_tag=capability_tag, mode=mode))

    def create_share_token(self, card_id: str) -> str | None:
        row = self.db.get(AchievementCardModel, card_id)
        if not row or row.is_deleted:
            return None
        row.share_token = secrets.token_urlsafe(16)
        row.updated_at = utc_now()
        self.db.commit()
        return row.share_token

    def get_achievement_card_by_share_token(self, share_token: str) -> AchievementCard | None:
        row = (
            self.db.query(AchievementCardModel)
            .filter(AchievementCardModel.share_token == share_token, AchievementCardModel.is_deleted.is_(False))
            .first()
        )
        if not row:
            return None
        return _to_schema(row)
