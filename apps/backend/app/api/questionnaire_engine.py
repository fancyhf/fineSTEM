"""
问卷引擎模块 API
"""

from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.repositories.runtime_db import db
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.schemas.counseling import (
    QuestionnaireResponse,
    QuestionnaireResponseCreate,
    QuestionnaireTemplate,
    QuestionnaireTemplateCreate,
)
from app.services.audit_logger import audit_logger_service

router = APIRouter(prefix="/questionnaire-engine", tags=["问卷引擎"])


@router.get("/templates", response_model=ApiResponse[list[QuestionnaireTemplate]])
async def list_templates(current_user: UserResponse = Depends(get_current_user)):
    return ApiResponse(data=db.list_questionnaire_templates(current_user.id), message="获取成功")


@router.post("/templates", response_model=ApiResponse[QuestionnaireTemplate])
async def create_template(payload: QuestionnaireTemplateCreate, current_user: UserResponse = Depends(get_current_user)):
    item = QuestionnaireTemplate(
        id=str(uuid.uuid4()),
        owner_id=current_user.id,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        **payload.model_dump(),
    )
    created = db.create_questionnaire_template(item)
    audit_logger_service.record(current_user.id, "questionnaire_engine", "create_template", created.id, {"name": created.name})
    return ApiResponse(data=created, message="创建成功")


@router.post("/responses", response_model=ApiResponse[QuestionnaireResponse])
async def submit_response(payload: QuestionnaireResponseCreate, current_user: UserResponse = Depends(get_current_user)):
    template = next((item for item in db.list_questionnaire_templates(current_user.id) if item.id == payload.template_id), None)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模板不存在")
    total = len(template.questions)
    answered = len([item for item in template.questions if payload.answers.get(item.id)])
    completion_rate = round((answered / total * 100), 2) if total else 0.0
    response = QuestionnaireResponse(
        id=str(uuid.uuid4()),
        template_id=payload.template_id,
        respondent_name=payload.respondent_name,
        answers=payload.answers,
        completion_rate=completion_rate,
    )
    created = db.create_questionnaire_response(response)
    audit_logger_service.record(current_user.id, "questionnaire_engine", "submit_response", created.id, {"completion_rate": str(completion_rate)})
    return ApiResponse(data=created, message="提交成功")


@router.get("/templates/{template_id}/responses", response_model=ApiResponse[list[QuestionnaireResponse]])
async def list_responses(template_id: str, current_user: UserResponse = Depends(get_current_user)):
    template = next((item for item in db.list_questionnaire_templates(current_user.id) if item.id == template_id), None)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模板不存在")
    return ApiResponse(data=db.list_questionnaire_responses(template_id), message="获取成功")
