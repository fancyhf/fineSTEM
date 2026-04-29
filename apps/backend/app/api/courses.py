"""
课程 API 路由

用途：探索中心课程库 Tab 的课程列表接口
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from fastapi import APIRouter, Depends
from app.schemas.course_library import Course, CourseCreate
from app.schemas.common import ApiResponse
from app.repositories.runtime_db import db
from app.api.auth import get_current_user

router = APIRouter(prefix="/courses", tags=["课程库"])


@router.get("", response_model=ApiResponse[list[Course]])
async def list_courses(user: dict = Depends(get_current_user)):
    courses = db.list_courses(owner_id=user["id"])
    return ApiResponse(data=courses)


@router.post("", response_model=ApiResponse[Course])
async def create_course(data: CourseCreate, user: dict = Depends(get_current_user)):
    course = Course(
        id="",
        owner_id=user["id"],
        title=data.title,
        summary=data.summary,
        subject=data.subject,
        difficulty=data.difficulty,
        tags=data.tags,
        resource_url=data.resource_url,
    )
    result = db.create_course(course)
    return ApiResponse(data=result)
