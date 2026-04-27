from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
import uuid

from app.db.database import get_db_session
from app.db.memory import db as memory_db
from app.repositories.achievement_repo import AchievementRepo
from app.repositories.counseling_repo import (
    AuditLogRepo,
    DialogueMessageRepo,
    DialogueSessionRepo,
    HongKongMacaoPlanRepo,
    InternationalPlanRepo,
    KnowledgeSourceRepo,
    ProfileEnhancementPlanRepo,
    QuestionnaireResponseRepo,
    QuestionnaireTemplateRepo,
)
from app.repositories.course_repo import CourseRepo
from app.repositories.demo_repo import DemoRepo
from app.repositories.evidence_repo import EvidenceRepo
from app.repositories.project_repo import ProjectRepo
from app.repositories.skill_record_repo import SkillRecordRepo
from app.repositories.user_repo import UserRepo


class RepositoryBackedDB:
    """
    运行时数据库适配器：
    - 已迁移域（用户/Demo/项目/成果/证据/课程）走 ORM + Repository。
    - 未迁移域暂时回退到 memory_db，保证兼容性。
    """

    @contextmanager
    def _session(self) -> Generator:
        gen = get_db_session()
        session = next(gen)
        try:
            yield session
        finally:
            try:
                next(gen)
            except StopIteration:
                pass

    def get_user(self, user_id: str):
        with self._session() as session:
            return UserRepo(session).get_user(user_id)

    def get_user_by_email(self, email: str):
        with self._session() as session:
            return UserRepo(session).get_user_by_email(email)

    def create_user(self, user):
        if not getattr(user, "id", None):
            user.id = str(uuid.uuid4())
        with self._session() as session:
            return UserRepo(session).create_user(user)

    def update_user(self, user_id: str, user_data: dict):
        with self._session() as session:
            return UserRepo(session).update_user(user_id, user_data)

    def get_demo(self, demo_id: str):
        with self._session() as session:
            return DemoRepo(session).get_demo(demo_id)

    def list_demos(self, **kwargs):
        with self._session() as session:
            return DemoRepo(session).list_demos(**kwargs)

    def count_demos(self, **kwargs):
        with self._session() as session:
            return DemoRepo(session).count_demos(**kwargs)

    def create_demo(self, demo):
        if not getattr(demo, "id", None):
            demo.id = str(uuid.uuid4())
        with self._session() as session:
            return DemoRepo(session).create_demo(demo)

    def update_demo(self, demo_id: str, demo_data: dict):
        with self._session() as session:
            return DemoRepo(session).update_demo(demo_id, demo_data)

    def get_project(self, project_id: str):
        with self._session() as session:
            return ProjectRepo(session).get_project(project_id)

    def list_projects(self, **kwargs):
        with self._session() as session:
            return ProjectRepo(session).list_projects(**kwargs)

    def count_projects(self, **kwargs):
        with self._session() as session:
            return ProjectRepo(session).count_projects(**kwargs)

    def create_project(self, project):
        if not getattr(project, "id", None):
            project.id = str(uuid.uuid4())
        with self._session() as session:
            return ProjectRepo(session).create_project(project)

    def update_project(self, project_id: str, project_data: dict):
        with self._session() as session:
            return ProjectRepo(session).update_project(project_id, project_data)

    def delete_project(self, project_id: str, deleted_by: str):
        with self._session() as session:
            return ProjectRepo(session).delete_project(project_id, deleted_by)

    def get_skill_state(self, project_id: str):
        with self._session() as session:
            return ProjectRepo(session).get_skill_state(project_id)

    def create_skill_state(self, skill_state):
        with self._session() as session:
            return ProjectRepo(session).create_skill_state(skill_state)

    def update_skill_state(self, project_id: str, data: dict):
        with self._session() as session:
            return ProjectRepo(session).update_skill_state(project_id, data)

    def advance_skill_state(self, project_id: str):
        with self._session() as session:
            return ProjectRepo(session).advance_skill_state(project_id)

    def get_project_capability_tags(self, project_id: str):
        with self._session() as session:
            return ProjectRepo(session).get_project_capability_tags(project_id)

    def set_project_capability_tags(self, project_id: str, tags: list[str]):
        with self._session() as session:
            return ProjectRepo(session).set_project_capability_tags(project_id, tags)

    def get_achievement_card(self, card_id: str):
        with self._session() as session:
            return AchievementRepo(session).get_achievement_card(card_id)

    def get_achievement_card_by_project(self, project_id: str):
        with self._session() as session:
            return AchievementRepo(session).get_achievement_card_by_project(project_id)

    def create_or_update_achievement_card(self, card):
        with self._session() as session:
            return AchievementRepo(session).create_or_update_achievement_card(card)

    def create_achievement_card(self, card):
        if not getattr(card, "id", None):
            card.id = str(uuid.uuid4())
        with self._session() as session:
            return AchievementRepo(session).create_achievement_card(card)

    def update_achievement_card(self, card_id: str, data: dict):
        with self._session() as session:
            return AchievementRepo(session).update_achievement_card(card_id, data)

    def create_share_token(self, card_id: str):
        with self._session() as session:
            return AchievementRepo(session).create_share_token(card_id)

    def get_achievement_card_by_share_token(self, share_token: str):
        with self._session() as session:
            return AchievementRepo(session).get_achievement_card_by_share_token(share_token)

    def list_public_achievement_cards(self, **kwargs):
        if "project_mode" in kwargs:
            kwargs["mode"] = kwargs.pop("project_mode")
        with self._session() as session:
            return AchievementRepo(session).list_public_achievement_cards(**kwargs)

    def count_public_achievement_cards(self, **kwargs):
        if "project_mode" in kwargs:
            kwargs["mode"] = kwargs.pop("project_mode")
        with self._session() as session:
            return AchievementRepo(session).count_public_achievement_cards(**kwargs)

    def create_evidence(self, evidence):
        if not getattr(evidence, "id", None):
            evidence.id = str(uuid.uuid4())
        with self._session() as session:
            return EvidenceRepo(session).create_evidence(evidence)

    def get_evidence(self, evidence_id: str):
        with self._session() as session:
            return EvidenceRepo(session).get_evidence(evidence_id)

    def list_evidence_by_project(self, project_id: str, skip: int = 0, limit: int = 50):
        with self._session() as session:
            return EvidenceRepo(session).list_evidence_by_project(project_id, skip=skip, limit=limit)

    def list_evidence(self, project_id: str, skip: int = 0, limit: int = 50, type: str | None = None):
        items = self.list_evidence_by_project(project_id=project_id, skip=skip, limit=limit)
        if type:
            items = [item for item in items if item.type == type]
        return items

    def count_evidence(self, project_id: str, type: str | None = None):
        items = self.list_evidence_by_project(project_id=project_id, skip=0, limit=100000)
        if type:
            items = [item for item in items if item.type == type]
        return len(items)

    def update_evidence(self, evidence_id: str, data: dict):
        with self._session() as session:
            return EvidenceRepo(session).update_evidence(evidence_id, data)

    def delete_evidence(self, evidence_id: str, deleted_by: str):
        with self._session() as session:
            return EvidenceRepo(session).delete_evidence(evidence_id, deleted_by)

    def list_courses(self, owner_id: str | None = None, **kwargs):
        if owner_id:
            kwargs["owner_id"] = owner_id
        with self._session() as session:
            return CourseRepo(session).list_courses(**kwargs)

    def count_courses(self, owner_id: str | None = None, **kwargs):
        if owner_id:
            kwargs["owner_id"] = owner_id
        with self._session() as session:
            return CourseRepo(session).count_courses(**kwargs)

    def create_course(self, course):
        if not getattr(course, "id", None):
            course.id = str(uuid.uuid4())
        with self._session() as session:
            return CourseRepo(session).create_course(course)

    # =========================================================================
    # Skill 记录
    # =========================================================================

    def list_installed_skills(self, owner_id: str):
        with self._session() as session:
            return SkillRecordRepo(session).list_skills(owner_id)

    def get_installed_skill(self, skill_id: str, owner_id: str):
        with self._session() as session:
            return SkillRecordRepo(session).get_skill(skill_id, owner_id)

    def install_skill(self, skill):
        if not getattr(skill, "id", None):
            skill.id = str(uuid.uuid4())
        with self._session() as session:
            return SkillRecordRepo(session).create_skill(skill)

    def upsert_installed_skill(self, owner_id: str, record) -> object:
        with self._session() as session:
            repo = SkillRecordRepo(session)
            existing = repo.get_skill(record.manifest.skill_id, owner_id)
            if existing:
                return repo.update_skill_status(record.manifest.skill_id, owner_id, record.status)
            return repo.create_skill(record)

    def toggle_skill(self, skill_id: str, owner_id: str, status: str):
        with self._session() as session:
            return SkillRecordRepo(session).update_skill_status(skill_id, owner_id, status)

    def uninstall_skill(self, skill_id: str, owner_id: str):
        with self._session() as session:
            return SkillRecordRepo(session).delete_skill(skill_id, owner_id)

    # =========================================================================
    # 港澳升学
    # =========================================================================

    def list_hkmo_plans(self, owner_id: str):
        with self._session() as session:
            return HongKongMacaoPlanRepo(session).list_plans(owner_id)

    def get_hkmo_plan(self, plan_id: str, owner_id: str):
        with self._session() as session:
            return HongKongMacaoPlanRepo(session).get_plan(plan_id, owner_id)

    def create_hkmo_plan(self, plan):
        if not getattr(plan, "id", None):
            plan.id = str(uuid.uuid4())
        with self._session() as session:
            return HongKongMacaoPlanRepo(session).create_plan(plan)

    def update_hkmo_plan(self, plan_id: str, owner_id: str, data: dict):
        with self._session() as session:
            return HongKongMacaoPlanRepo(session).update_plan(plan_id, owner_id, data)

    def delete_hkmo_plan(self, plan_id: str, owner_id: str):
        with self._session() as session:
            return HongKongMacaoPlanRepo(session).delete_plan(plan_id, owner_id)

    # =========================================================================
    # 国际升学
    # =========================================================================

    def list_international_plans(self, owner_id: str):
        with self._session() as session:
            return InternationalPlanRepo(session).list_plans(owner_id)

    def get_international_plan(self, plan_id: str, owner_id: str):
        with self._session() as session:
            return InternationalPlanRepo(session).get_plan(plan_id, owner_id)

    def create_international_plan(self, plan):
        if not getattr(plan, "id", None):
            plan.id = str(uuid.uuid4())
        with self._session() as session:
            return InternationalPlanRepo(session).create_plan(plan)

    def update_international_plan(self, plan_id: str, owner_id: str, data: dict):
        with self._session() as session:
            return InternationalPlanRepo(session).update_plan(plan_id, owner_id, data)

    def delete_international_plan(self, plan_id: str, owner_id: str):
        with self._session() as session:
            return InternationalPlanRepo(session).delete_plan(plan_id, owner_id)

    # =========================================================================
    # 背景提升
    # =========================================================================

    def list_profile_plans(self, owner_id: str):
        with self._session() as session:
            return ProfileEnhancementPlanRepo(session).list_plans(owner_id)

    def get_profile_plan(self, plan_id: str, owner_id: str):
        with self._session() as session:
            return ProfileEnhancementPlanRepo(session).get_plan(plan_id, owner_id)

    def create_profile_plan(self, plan):
        if not getattr(plan, "id", None):
            plan.id = str(uuid.uuid4())
        with self._session() as session:
            return ProfileEnhancementPlanRepo(session).create_plan(plan)

    def update_profile_plan(self, plan_id: str, owner_id: str, data: dict):
        with self._session() as session:
            return ProfileEnhancementPlanRepo(session).update_plan(plan_id, owner_id, data)

    def delete_profile_plan(self, plan_id: str, owner_id: str):
        with self._session() as session:
            return ProfileEnhancementPlanRepo(session).delete_plan(plan_id, owner_id)

    # =========================================================================
    # 知识来源
    # =========================================================================

    def list_knowledge_sources(self, owner_id: str):
        with self._session() as session:
            return KnowledgeSourceRepo(session).list_sources(owner_id)

    def get_knowledge_source(self, source_id: str, owner_id: str):
        with self._session() as session:
            return KnowledgeSourceRepo(session).get_source(source_id, owner_id)

    def create_knowledge_source(self, source):
        if not getattr(source, "id", None):
            source.id = str(uuid.uuid4())
        with self._session() as session:
            return KnowledgeSourceRepo(session).create_source(source)

    def update_knowledge_source(self, source_id: str, owner_id: str, data: dict):
        with self._session() as session:
            return KnowledgeSourceRepo(session).update_source(source_id, owner_id, data)

    def delete_knowledge_source(self, source_id: str, owner_id: str):
        with self._session() as session:
            return KnowledgeSourceRepo(session).delete_source(source_id, owner_id)

    # =========================================================================
    # 问卷模板
    # =========================================================================

    def list_questionnaire_templates(self, owner_id: str):
        with self._session() as session:
            return QuestionnaireTemplateRepo(session).list_templates(owner_id)

    def get_questionnaire_template(self, template_id: str, owner_id: str):
        with self._session() as session:
            return QuestionnaireTemplateRepo(session).get_template(template_id, owner_id)

    def create_questionnaire_template(self, template):
        if not getattr(template, "id", None):
            template.id = str(uuid.uuid4())
        with self._session() as session:
            return QuestionnaireTemplateRepo(session).create_template(template)

    def update_questionnaire_template(self, template_id: str, owner_id: str, data: dict):
        with self._session() as session:
            return QuestionnaireTemplateRepo(session).update_template(template_id, owner_id, data)

    def delete_questionnaire_template(self, template_id: str, owner_id: str):
        with self._session() as session:
            return QuestionnaireTemplateRepo(session).delete_template(template_id, owner_id)

    # =========================================================================
    # 问卷回答
    # =========================================================================

    def list_questionnaire_responses(self, template_id: str):
        with self._session() as session:
            return QuestionnaireResponseRepo(session).list_responses(template_id)

    def create_questionnaire_response(self, response):
        if not getattr(response, "id", None):
            response.id = str(uuid.uuid4())
        with self._session() as session:
            return QuestionnaireResponseRepo(session).create_response(response)

    # =========================================================================
    # 对话会话
    # =========================================================================

    def list_dialogue_sessions(self, owner_id: str):
        with self._session() as session:
            return DialogueSessionRepo(session).list_sessions(owner_id)

    def get_dialogue_session(self, session_id: str, owner_id: str):
        with self._session() as session:
            return DialogueSessionRepo(session).get_session(session_id, owner_id)

    def create_dialogue_session(self, session_obj):
        if not getattr(session_obj, "id", None):
            session_obj.id = str(uuid.uuid4())
        with self._session() as session:
            return DialogueSessionRepo(session).create_session(session_obj)

    def touch_dialogue_session(self, session_id: str):
        with self._session() as session:
            DialogueSessionRepo(session).touch_session(session_id)

    # =========================================================================
    # 对话消息
    # =========================================================================

    def list_dialogue_messages(self, session_id: str):
        with self._session() as session:
            return DialogueMessageRepo(session).list_messages(session_id)

    def create_dialogue_message(self, message):
        if not getattr(message, "id", None):
            message.id = str(uuid.uuid4())
        with self._session() as session:
            return DialogueMessageRepo(session).create_message(message)

    # =========================================================================
    # 审计日志
    # =========================================================================

    def list_audit_logs(self, owner_id: str, module: str | None = None, limit: int = 100):
        with self._session() as session:
            return AuditLogRepo(session).list_logs(owner_id, module=module, limit=limit)

    def create_audit_log(self, log):
        if not getattr(log, "id", None):
            log.id = str(uuid.uuid4())
        with self._session() as session:
            return AuditLogRepo(session).create_log(log)

    def __getattr__(self, name: str):
        return getattr(memory_db, name)


db = RepositoryBackedDB()
