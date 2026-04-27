"""
升学与辅导 Repository

用途：港澳升学、国际升学、背景提升、知识来源、问卷、对话、审计日志的数据库持久化
维护者：AI Agent
"""

from __future__ import annotations

from datetime import datetime

from app.db.models import (
    AuditLogModel,
    DialogueMessageModel,
    DialogueSessionModel,
    HongKongMacaoPlanModel,
    InternationalPlanModel,
    KnowledgeSourceModel,
    ProfileEnhancementPlanModel,
    QuestionnaireResponseModel,
    QuestionnaireTemplateModel,
)
from app.repositories.base import BaseRepository
from app.repositories.utils import json_dumps, json_loads
from app.schemas.counseling import (
    AssistantDialogueMessage,
    AssistantDialogueSession,
    AuditLogItem,
    HongKongMacaoPlan,
    InternationalPlan,
    KnowledgeSource,
    ProfileEnhancementPlan,
    QuestionnaireQuestion,
    QuestionnaireResponse,
    QuestionnaireTemplate,
)


class HongKongMacaoPlanRepo(BaseRepository):
    def list_plans(self, owner_id: str) -> list[HongKongMacaoPlan]:
        rows = (
            self.db.query(HongKongMacaoPlanModel)
            .filter(HongKongMacaoPlanModel.owner_id == owner_id, HongKongMacaoPlanModel.is_deleted.is_(False))
            .all()
        )
        return [self._to_schema(item) for item in rows]

    def get_plan(self, plan_id: str, owner_id: str) -> HongKongMacaoPlan | None:
        row = self.db.get(HongKongMacaoPlanModel, plan_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return None
        return self._to_schema(row)

    def create_plan(self, plan: HongKongMacaoPlan) -> HongKongMacaoPlan:
        row = HongKongMacaoPlanModel(
            id=plan.id, owner_id=plan.owner_id, student_name=plan.student_name,
            grade=plan.grade, target_track=plan.target_track, timeline=plan.timeline,
            requirement_summary=plan.requirement_summary, status=plan.status,
            created_at=plan.created_at, created_by=plan.created_by,
            updated_at=plan.updated_at, updated_by=plan.updated_by,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def update_plan(self, plan_id: str, owner_id: str, data: dict) -> HongKongMacaoPlan | None:
        row = self.db.get(HongKongMacaoPlanModel, plan_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(row, key, value)
        row.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def delete_plan(self, plan_id: str, owner_id: str) -> bool:
        row = self.db.get(HongKongMacaoPlanModel, plan_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return False
        row.is_deleted = True
        row.deleted_at = datetime.utcnow()
        row.deleted_by = owner_id
        self.db.commit()
        return True

    @staticmethod
    def _to_schema(model: HongKongMacaoPlanModel) -> HongKongMacaoPlan:
        return HongKongMacaoPlan(
            id=model.id, owner_id=model.owner_id, student_name=model.student_name,
            grade=model.grade, target_track=model.target_track, timeline=model.timeline,
            requirement_summary=model.requirement_summary, status=model.status,
            created_at=model.created_at, created_by=model.created_by,
            updated_at=model.updated_at, updated_by=model.updated_by,
            deleted_at=model.deleted_at, deleted_by=model.deleted_by, is_deleted=model.is_deleted,
        )


class InternationalPlanRepo(BaseRepository):
    def list_plans(self, owner_id: str) -> list[InternationalPlan]:
        rows = (
            self.db.query(InternationalPlanModel)
            .filter(InternationalPlanModel.owner_id == owner_id, InternationalPlanModel.is_deleted.is_(False))
            .all()
        )
        return [self._to_schema(item) for item in rows]

    def get_plan(self, plan_id: str, owner_id: str) -> InternationalPlan | None:
        row = self.db.get(InternationalPlanModel, plan_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return None
        return self._to_schema(row)

    def create_plan(self, plan: InternationalPlan) -> InternationalPlan:
        row = InternationalPlanModel(
            id=plan.id, owner_id=plan.owner_id, student_name=plan.student_name,
            grade=plan.grade, target_country=plan.target_country,
            target_school_level=plan.target_school_level, timeline=plan.timeline,
            requirement_summary=plan.requirement_summary, status=plan.status,
            created_at=plan.created_at, created_by=plan.created_by,
            updated_at=plan.updated_at, updated_by=plan.updated_by,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def update_plan(self, plan_id: str, owner_id: str, data: dict) -> InternationalPlan | None:
        row = self.db.get(InternationalPlanModel, plan_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(row, key, value)
        row.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def delete_plan(self, plan_id: str, owner_id: str) -> bool:
        row = self.db.get(InternationalPlanModel, plan_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return False
        row.is_deleted = True
        row.deleted_at = datetime.utcnow()
        row.deleted_by = owner_id
        self.db.commit()
        return True

    @staticmethod
    def _to_schema(model: InternationalPlanModel) -> InternationalPlan:
        return InternationalPlan(
            id=model.id, owner_id=model.owner_id, student_name=model.student_name,
            grade=model.grade, target_country=model.target_country,
            target_school_level=model.target_school_level, timeline=model.timeline,
            requirement_summary=model.requirement_summary, status=model.status,
            created_at=model.created_at, created_by=model.created_by,
            updated_at=model.updated_at, updated_by=model.updated_by,
            deleted_at=model.deleted_at, deleted_by=model.deleted_by, is_deleted=model.is_deleted,
        )


class ProfileEnhancementPlanRepo(BaseRepository):
    def list_plans(self, owner_id: str) -> list[ProfileEnhancementPlan]:
        rows = (
            self.db.query(ProfileEnhancementPlanModel)
            .filter(ProfileEnhancementPlanModel.owner_id == owner_id, ProfileEnhancementPlanModel.is_deleted.is_(False))
            .all()
        )
        return [self._to_schema(item) for item in rows]

    def get_plan(self, plan_id: str, owner_id: str) -> ProfileEnhancementPlan | None:
        row = self.db.get(ProfileEnhancementPlanModel, plan_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return None
        return self._to_schema(row)

    def create_plan(self, plan: ProfileEnhancementPlan) -> ProfileEnhancementPlan:
        row = ProfileEnhancementPlanModel(
            id=plan.id, owner_id=plan.owner_id, student_name=plan.student_name,
            objective=plan.objective, activities=json_dumps(plan.activities, "[]"),
            evidence_targets=json_dumps(plan.evidence_targets, "[]"), status=plan.status,
            created_at=plan.created_at, created_by=plan.created_by,
            updated_at=plan.updated_at, updated_by=plan.updated_by,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def update_plan(self, plan_id: str, owner_id: str, data: dict) -> ProfileEnhancementPlan | None:
        row = self.db.get(ProfileEnhancementPlanModel, plan_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return None
        for key, value in data.items():
            if value is None:
                continue
            if key in ("activities", "evidence_targets"):
                setattr(row, key, json_dumps(value))
            else:
                setattr(row, key, value)
        row.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def delete_plan(self, plan_id: str, owner_id: str) -> bool:
        row = self.db.get(ProfileEnhancementPlanModel, plan_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return False
        row.is_deleted = True
        row.deleted_at = datetime.utcnow()
        row.deleted_by = owner_id
        self.db.commit()
        return True

    @staticmethod
    def _to_schema(model: ProfileEnhancementPlanModel) -> ProfileEnhancementPlan:
        return ProfileEnhancementPlan(
            id=model.id, owner_id=model.owner_id, student_name=model.student_name,
            objective=model.objective, activities=json_loads(model.activities, []),
            evidence_targets=json_loads(model.evidence_targets, []), status=model.status,
            created_at=model.created_at, created_by=model.created_by,
            updated_at=model.updated_at, updated_by=model.updated_by,
            deleted_at=model.deleted_at, deleted_by=model.deleted_by, is_deleted=model.is_deleted,
        )


class KnowledgeSourceRepo(BaseRepository):
    def list_sources(self, owner_id: str) -> list[KnowledgeSource]:
        rows = (
            self.db.query(KnowledgeSourceModel)
            .filter(KnowledgeSourceModel.owner_id == owner_id, KnowledgeSourceModel.is_deleted.is_(False))
            .all()
        )
        return [self._to_schema(item) for item in rows]

    def get_source(self, source_id: str, owner_id: str) -> KnowledgeSource | None:
        row = self.db.get(KnowledgeSourceModel, source_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return None
        return self._to_schema(row)

    def create_source(self, source: KnowledgeSource) -> KnowledgeSource:
        row = KnowledgeSourceModel(
            id=source.id, owner_id=source.owner_id, title=source.title,
            source_type=source.source_type, url=source.url, summary=source.summary,
            tags=json_dumps(source.tags, "[]"), reliability_score=source.reliability_score,
            created_at=source.created_at, created_by=source.created_by,
            updated_at=source.updated_at, updated_by=source.updated_by,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def update_source(self, source_id: str, owner_id: str, data: dict) -> KnowledgeSource | None:
        row = self.db.get(KnowledgeSourceModel, source_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return None
        for key, value in data.items():
            if value is None:
                continue
            if key == "tags":
                row.tags = json_dumps(value)
            else:
                setattr(row, key, value)
        row.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def delete_source(self, source_id: str, owner_id: str) -> bool:
        row = self.db.get(KnowledgeSourceModel, source_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return False
        row.is_deleted = True
        row.deleted_at = datetime.utcnow()
        row.deleted_by = owner_id
        self.db.commit()
        return True

    @staticmethod
    def _to_schema(model: KnowledgeSourceModel) -> KnowledgeSource:
        return KnowledgeSource(
            id=model.id, owner_id=model.owner_id, title=model.title,
            source_type=model.source_type, url=model.url, summary=model.summary,
            tags=json_loads(model.tags, []), reliability_score=model.reliability_score,
            created_at=model.created_at, created_by=model.created_by,
            updated_at=model.updated_at, updated_by=model.updated_by,
            deleted_at=model.deleted_at, deleted_by=model.deleted_by, is_deleted=model.is_deleted,
        )


class QuestionnaireTemplateRepo(BaseRepository):
    def list_templates(self, owner_id: str) -> list[QuestionnaireTemplate]:
        rows = (
            self.db.query(QuestionnaireTemplateModel)
            .filter(QuestionnaireTemplateModel.owner_id == owner_id, QuestionnaireTemplateModel.is_deleted.is_(False))
            .all()
        )
        return [self._to_schema(item) for item in rows]

    def get_template(self, template_id: str, owner_id: str) -> QuestionnaireTemplate | None:
        row = self.db.get(QuestionnaireTemplateModel, template_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return None
        return self._to_schema(row)

    def create_template(self, template: QuestionnaireTemplate) -> QuestionnaireTemplate:
        row = QuestionnaireTemplateModel(
            id=template.id, owner_id=template.owner_id, name=template.name,
            description=template.description,
            questions=json_dumps([q.model_dump() for q in template.questions], "[]"),
            created_at=template.created_at, created_by=template.created_by,
            updated_at=template.updated_at, updated_by=template.updated_by,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def update_template(self, template_id: str, owner_id: str, data: dict) -> QuestionnaireTemplate | None:
        row = self.db.get(QuestionnaireTemplateModel, template_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return None
        for key, value in data.items():
            if value is None:
                continue
            if key == "questions":
                row.questions = json_dumps([q.model_dump() if hasattr(q, "model_dump") else q for q in value])
            else:
                setattr(row, key, value)
        row.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def delete_template(self, template_id: str, owner_id: str) -> bool:
        row = self.db.get(QuestionnaireTemplateModel, template_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return False
        row.is_deleted = True
        row.deleted_at = datetime.utcnow()
        row.deleted_by = owner_id
        self.db.commit()
        return True

    @staticmethod
    def _to_schema(model: QuestionnaireTemplateModel) -> QuestionnaireTemplate:
        raw_questions = json_loads(model.questions, [])
        questions = [QuestionnaireQuestion(**q) for q in raw_questions if isinstance(q, dict)]
        return QuestionnaireTemplate(
            id=model.id, owner_id=model.owner_id, name=model.name,
            description=model.description, questions=questions,
            created_at=model.created_at, created_by=model.created_by,
            updated_at=model.updated_at, updated_by=model.updated_by,
            deleted_at=model.deleted_at, deleted_by=model.deleted_by, is_deleted=model.is_deleted,
        )


class QuestionnaireResponseRepo(BaseRepository):
    def list_responses(self, template_id: str) -> list[QuestionnaireResponse]:
        rows = (
            self.db.query(QuestionnaireResponseModel)
            .filter(QuestionnaireResponseModel.template_id == template_id)
            .all()
        )
        return [self._to_schema(item) for item in rows]

    def create_response(self, response: QuestionnaireResponse) -> QuestionnaireResponse:
        row = QuestionnaireResponseModel(
            id=response.id, template_id=response.template_id,
            respondent_name=response.respondent_name,
            answers=json_dumps(response.answers, "{}"),
            completion_rate=response.completion_rate,
            created_at=response.created_at,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    @staticmethod
    def _to_schema(model: QuestionnaireResponseModel) -> QuestionnaireResponse:
        return QuestionnaireResponse(
            id=model.id, template_id=model.template_id,
            respondent_name=model.respondent_name,
            answers=json_loads(model.answers, {}),
            completion_rate=model.completion_rate,
            created_at=model.created_at,
        )


class DialogueSessionRepo(BaseRepository):
    def list_sessions(self, owner_id: str) -> list[AssistantDialogueSession]:
        rows = (
            self.db.query(DialogueSessionModel)
            .filter(DialogueSessionModel.owner_id == owner_id, DialogueSessionModel.is_deleted.is_(False))
            .order_by(DialogueSessionModel.updated_at.desc())
            .all()
        )
        return [self._to_schema(item) for item in rows]

    def get_session(self, session_id: str, owner_id: str) -> AssistantDialogueSession | None:
        row = self.db.get(DialogueSessionModel, session_id)
        if not row or row.is_deleted or row.owner_id != owner_id:
            return None
        return self._to_schema(row)

    def create_session(self, session: AssistantDialogueSession) -> AssistantDialogueSession:
        row = DialogueSessionModel(
            id=session.id, owner_id=session.owner_id, title=session.title,
            created_at=session.created_at, updated_at=session.updated_at,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def touch_session(self, session_id: str) -> None:
        row = self.db.get(DialogueSessionModel, session_id)
        if row:
            row.updated_at = datetime.utcnow()
            self.db.commit()

    @staticmethod
    def _to_schema(model: DialogueSessionModel) -> AssistantDialogueSession:
        return AssistantDialogueSession(
            id=model.id, owner_id=model.owner_id, title=model.title,
            created_at=model.created_at, updated_at=model.updated_at,
        )


class DialogueMessageRepo(BaseRepository):
    def list_messages(self, session_id: str) -> list[AssistantDialogueMessage]:
        rows = (
            self.db.query(DialogueMessageModel)
            .filter(DialogueMessageModel.session_id == session_id)
            .order_by(DialogueMessageModel.created_at.asc())
            .all()
        )
        return [self._to_schema(item) for item in rows]

    def create_message(self, message: AssistantDialogueMessage) -> AssistantDialogueMessage:
        row = DialogueMessageModel(
            id=message.id, session_id=message.session_id,
            role=message.role, content=message.content,
            created_at=message.created_at,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    @staticmethod
    def _to_schema(model: DialogueMessageModel) -> AssistantDialogueMessage:
        return AssistantDialogueMessage(
            id=model.id, session_id=model.session_id,
            role=model.role, content=model.content,
            created_at=model.created_at,
        )


class AuditLogRepo(BaseRepository):
    def list_logs(self, owner_id: str, module: str | None = None, limit: int = 100) -> list[AuditLogItem]:
        query = self.db.query(AuditLogModel).filter(AuditLogModel.owner_id == owner_id)
        if module:
            query = query.filter(AuditLogModel.module == module)
        rows = query.order_by(AuditLogModel.created_at.desc()).limit(limit).all()
        return [self._to_schema(item) for item in rows]

    def create_log(self, log: AuditLogItem) -> AuditLogItem:
        row = AuditLogModel(
            id=log.id, owner_id=log.owner_id, module=log.module,
            action=log.action, resource_id=log.resource_id,
            detail=json_dumps(log.detail, "{}"), created_at=log.created_at,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    @staticmethod
    def _to_schema(model: AuditLogModel) -> AuditLogItem:
        return AuditLogItem(
            id=model.id, owner_id=model.owner_id, module=model.module,
            action=model.action, resource_id=model.resource_id,
            detail=json_loads(model.detail, {}), created_at=model.created_at,
        )
