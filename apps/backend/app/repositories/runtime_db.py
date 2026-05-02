from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
import uuid

from app.db.database import get_db_session
from app.db.memory import db as memory_db
from app.repositories.achievement_repo import AchievementRepo
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
        with self._session() as session:
            repo = UserRepo(session)
            result = repo.create_user(user)
            session.commit()
            return result

    def update_user(self, user_id: str, user_data: dict):
        with self._session() as session:
            repo = UserRepo(session)
            result = repo.update_user(user_id, user_data)
            session.commit()
            return result

    def get_demo(self, demo_id: str):
        with self._session() as session:
            return DemoRepo(session).get_demo(demo_id)

    def list_demos(self, skip=0, limit=100, subject=None, difficulty=None, tech_stack=None, search=None):
        with self._session() as session:
            return DemoRepo(session).list_demos(skip=skip, limit=limit, subject=subject, difficulty=difficulty, tech_stack=tech_stack, search=search)

    def count_demos(self, subject=None, difficulty=None, tech_stack=None, search=None):
        with self._session() as session:
            return DemoRepo(session).count_demos(subject=subject, difficulty=difficulty, tech_stack=tech_stack, search=search)

    def create_demo(self, demo):
        with self._session() as session:
            repo = DemoRepo(session)
            result = repo.create_demo(demo)
            session.commit()
            return result

    def update_demo(self, demo_id: str, demo_data: dict):
        with self._session() as session:
            repo = DemoRepo(session)
            result = repo.update_demo(demo_id, demo_data)
            session.commit()
            return result

    def get_project(self, project_id: str):
        with self._session() as session:
            return ProjectRepo(session).get_project(project_id)

    def list_projects(self, user_id: str, skip=0, limit=100, mode=None, stage=None):
        with self._session() as session:
            return ProjectRepo(session).list_projects(user_id, skip=skip, limit=limit, mode=mode, stage=stage)

    def count_projects(self, user_id: str, mode=None, stage=None):
        with self._session() as session:
            return ProjectRepo(session).count_projects(user_id, mode=mode, stage=stage)

    def create_project(self, project):
        with self._session() as session:
            repo = ProjectRepo(session)
            result = repo.create_project(project)
            session.commit()
            return result

    def update_project(self, project_id: str, project_data: dict):
        with self._session() as session:
            repo = ProjectRepo(session)
            result = repo.update_project(project_id, project_data)
            session.commit()
            return result

    def delete_project(self, project_id: str, deleted_by: str):
        with self._session() as session:
            repo = ProjectRepo(session)
            result = repo.delete_project(project_id, deleted_by)
            session.commit()
            return result

    def get_skill_state(self, project_id: str):
        return memory_db.get_skill_state(project_id)

    def create_skill_state(self, skill_state):
        return memory_db.create_skill_state(skill_state)

    def update_skill_state(self, project_id: str, dict_data: dict):
        return memory_db.update_skill_state(project_id, dict_data)

    def advance_skill_state(self, project_id: str):
        return memory_db.advance_skill_state(project_id)

    def get_achievement_card(self, card_id: str):
        with self._session() as session:
            return AchievementRepo(session).get_achievement_card(card_id)

    def get_achievement_card_by_project(self, project_id: str):
        with self._session() as session:
            return AchievementRepo(session).get_achievement_card_by_project(project_id)

    def get_achievement_card_by_share_token(self, token: str):
        with self._session() as session:
            return AchievementRepo(session).get_achievement_card_by_share_token(token)

    def list_public_achievement_cards(self, skip=0, limit=100, capability_tag=None, project_mode=None):
        with self._session() as session:
            return AchievementRepo(session).list_public_achievement_cards(skip=skip, limit=limit, capability_tag=capability_tag, mode=project_mode)

    def count_public_achievement_cards(self, capability_tag=None, project_mode=None):
        with self._session() as session:
            return AchievementRepo(session).count_public_achievement_cards(capability_tag=capability_tag, mode=project_mode)

    def create_achievement_card(self, card):
        with self._session() as session:
            repo = AchievementRepo(session)
            result = repo.create_achievement_card(card)
            session.commit()
            return result

    def update_achievement_card(self, card_id: str, card_data: dict):
        with self._session() as session:
            repo = AchievementRepo(session)
            result = repo.update_achievement_card(card_id, card_data)
            session.commit()
            return result

    def create_share_token(self, card_id: str):
        with self._session() as session:
            repo = AchievementRepo(session)
            result = repo.create_share_token(card_id)
            session.commit()
            return result

    def get_evidence(self, evidence_id: str):
        with self._session() as session:
            return EvidenceRepo(session).get_evidence(evidence_id)

    def list_evidence(self, project_id: str, skip=0, limit=100, type=None):
        with self._session() as session:
            return EvidenceRepo(session).list_evidence(project_id, skip=skip, limit=limit, type=type)

    def count_evidence(self, project_id: str, type=None):
        with self._session() as session:
            return EvidenceRepo(session).count_evidence(project_id, type=type)

    def create_evidence(self, evidence_item):
        with self._session() as session:
            repo = EvidenceRepo(session)
            result = repo.create_evidence(evidence_item)
            session.commit()
            return result

    def update_evidence(self, evidence_id: str, evidence_data: dict):
        with self._session() as session:
            repo = EvidenceRepo(session)
            result = repo.update_evidence(evidence_id, evidence_data)
            session.commit()
            return result

    def delete_evidence(self, evidence_id: str, deleted_by: str):
        with self._session() as session:
            repo = EvidenceRepo(session)
            result = repo.delete_evidence(evidence_id, deleted_by)
            session.commit()
            return result

    def list_installed_skills(self, owner_id: str):
        return memory_db.list_installed_skills(owner_id)

    def get_installed_skill(self, owner_id: str, skill_id: str):
        return memory_db.get_installed_skill(owner_id, skill_id)

    def upsert_installed_skill(self, owner_id: str, record):
        return memory_db.upsert_installed_skill(owner_id, record)

    def remove_installed_skill(self, owner_id: str, skill_id: str):
        return memory_db.remove_installed_skill(owner_id, skill_id)

    def list_courses(self, owner_id: str):
        with self._session() as session:
            return CourseRepo(session).list_courses(owner_id=owner_id)

    def create_course(self, item):
        with self._session() as session:
            repo = CourseRepo(session)
            result = repo.create_course(item)
            session.commit()
            return result

    def get_project_capability_tags(self, project_id: str):
        return memory_db.get_project_capability_tags(project_id)

    def set_project_capability_tags(self, project_id: str, tags: list):
        return memory_db.set_project_capability_tags(project_id, tags)


db = RepositoryBackedDB()
