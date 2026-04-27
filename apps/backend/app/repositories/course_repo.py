from __future__ import annotations

from app.db.models import CourseModel
from app.repositories.base import BaseRepository
from app.repositories.utils import json_dumps, json_loads
from app.schemas.course_library import Course


def _to_schema(model: CourseModel) -> Course:
    return Course(
        id=model.id,
        owner_id=model.owner_id,
        title=model.title,
        summary=model.summary,
        subject=model.subject,
        difficulty=model.difficulty,  # type: ignore[arg-type]
        tags=json_loads(model.tags, []),
        resource_url=model.resource_url,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class CourseRepo(BaseRepository):
    def list_courses(
        self,
        owner_id: str | None = None,
        skip: int = 0,
        limit: int = 20,
        subject: str | None = None,
        difficulty: str | None = None,
        tag: str | None = None,
        search: str | None = None,
    ) -> list[Course]:
        rows = self.db.query(CourseModel).all()
        if owner_id:
            rows = [item for item in rows if item.owner_id == owner_id]
        if subject:
            rows = [item for item in rows if item.subject == subject]
        if difficulty:
            rows = [item for item in rows if item.difficulty == difficulty]
        if tag:
            rows = [item for item in rows if tag in json_loads(item.tags, [])]
        if search:
            q = search.lower()
            rows = [item for item in rows if q in item.title.lower() or q in item.summary.lower()]
        rows = sorted(rows, key=lambda item: item.created_at, reverse=True)
        return [_to_schema(item) for item in rows[skip : skip + limit]]

    def count_courses(
        self,
        owner_id: str | None = None,
        subject: str | None = None,
        difficulty: str | None = None,
        tag: str | None = None,
        search: str | None = None,
    ) -> int:
        return len(
            self.list_courses(
                owner_id=owner_id,
                skip=0,
                limit=100000,
                subject=subject,
                difficulty=difficulty,
                tag=tag,
                search=search,
            )
        )

    def create_course(self, course: Course) -> Course:
        row = CourseModel(
            id=course.id,
            owner_id=course.owner_id,
            title=course.title,
            summary=course.summary,
            subject=course.subject,
            difficulty=course.difficulty,
            tags=json_dumps(course.tags, default="[]"),
            resource_url=course.resource_url,
            created_at=course.created_at,
            updated_at=course.updated_at,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return _to_schema(row)
