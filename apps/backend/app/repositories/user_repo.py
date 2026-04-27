from __future__ import annotations

from app.db.models import UserModel
from app.repositories.base import BaseRepository
from app.repositories.utils import json_dumps, json_loads
from app.schemas.auth import User


def _to_schema(model: UserModel) -> User:
    return User(
        id=model.id,
        name=model.name,
        email=model.email,
        password=model.password,
        role=model.role,
        level=model.level,
        capability_tags=json_loads(model.capability_tags, []),
        created_at=model.created_at,
        created_by=model.created_by,
        updated_at=model.updated_at,
        updated_by=model.updated_by,
        deleted_at=model.deleted_at,
        deleted_by=model.deleted_by,
        is_deleted=model.is_deleted,
    )


class UserRepo(BaseRepository):
    def get_user(self, user_id: str) -> User | None:
        model = self.db.get(UserModel, user_id)
        if not model or model.is_deleted:
            return None
        return _to_schema(model)

    def get_user_by_email(self, email: str) -> User | None:
        model = self.db.query(UserModel).filter(UserModel.email == email, UserModel.is_deleted.is_(False)).first()
        if not model:
            return None
        return _to_schema(model)

    def create_user(self, user: User) -> User:
        model = UserModel(
            id=user.id,
            name=user.name,
            email=user.email,
            password=user.password,
            role=user.role,
            level=user.level,
            capability_tags=json_dumps(user.capability_tags, default="[]"),
            created_at=user.created_at,
            created_by=user.created_by,
            updated_at=user.updated_at,
            updated_by=user.updated_by,
            deleted_at=user.deleted_at,
            deleted_by=user.deleted_by,
            is_deleted=user.is_deleted,
        )
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return _to_schema(model)

    def update_user(self, user_id: str, user_data: dict) -> User | None:
        model = self.db.get(UserModel, user_id)
        if not model or model.is_deleted:
            return None
        for key, value in user_data.items():
            if value is None:
                continue
            if key == "capability_tags":
                setattr(model, key, json_dumps(value, default="[]"))
            else:
                setattr(model, key, value)
        self.db.commit()
        self.db.refresh(model)
        return _to_schema(model)
