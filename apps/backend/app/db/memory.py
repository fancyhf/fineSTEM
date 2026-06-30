"""
内存数据库层

用途：MVP 阶段使用内存存储，支持核心业务功能
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid
from app.schemas.demos import Demo
from app.schemas.projects import Project, SkillState
from app.schemas.achievements import AchievementCard
from app.schemas.evidence import Evidence
from app.schemas.auth import User
from app.schemas.skills import SkillRecord
from app.schemas.course_library import Course
from app.core.config import settings
from app.core.time_utils import utc_now, utc_now_iso
from app.db.sqlite_db import SQLiteDatabase


class MemoryDatabase:
    def __init__(self):
        self._state_file = Path(settings.STORAGE_BASE_PATH) / "memory_state.json"
        self._mutating_methods = {
            "create_user",
            "update_user",
            "create_demo",
            "update_demo",
            "create_project",
            "update_project",
            "delete_project",
            "create_skill_state",
            "update_skill_state",
            "advance_skill_state",
            "create_achievement_card",
            "update_achievement_card",
            "create_share_token",
            "create_evidence",
            "update_evidence",
            "delete_evidence",
            "upsert_installed_skill",
            "remove_installed_skill",
            "create_course",
            "set_project_capability_tags",
        }
        self.users: Dict[str, User] = {}
        self.user_email_index: Dict[str, str] = {}
        self.demos: Dict[str, Demo] = {}
        self.projects: Dict[str, Project] = {}
        self.skill_states: Dict[str, SkillState] = {}
        self.achievement_cards: Dict[str, AchievementCard] = {}
        self.evidence: Dict[str, Evidence] = {}
        self.share_tokens: Dict[str, str] = {}
        self.installed_skills: Dict[str, Dict[str, SkillRecord]] = {}
        self.courses: Dict[str, Course] = {}
        self.project_capability_tags: Dict[str, List[str]] = {}
        if not self._restore_state():
            self._init_sample_data()
            self._persist_state()

    def __getattribute__(self, name: str):
        attr = object.__getattribute__(self, name)
        if callable(attr):
            mutating_methods = object.__getattribute__(self, "_mutating_methods")
            if name in mutating_methods:
                def wrapped(*args, **kwargs):
                    result = attr(*args, **kwargs)
                    object.__getattribute__(self, "_persist_state")()
                    return result
                return wrapped
        return attr

    def _serialize_dict(self, source: Dict[str, Any]) -> Dict[str, Any]:
        result: Dict[str, Any] = {}
        for key, value in source.items():
            if hasattr(value, "model_dump"):
                result[key] = value.model_dump(mode="json")
            else:
                result[key] = value
        return result

    def _load_model_dict(self, data: Dict[str, Any], model_cls: Any) -> Dict[str, Any]:
        result: Dict[str, Any] = {}
        for key, value in data.items():
            result[key] = model_cls.model_validate(value)
        return result

    def _persist_state(self) -> None:
        import logging
        logger = logging.getLogger(__name__)
        payload = {
            "users": self._serialize_dict(self.users),
            "user_email_index": self.user_email_index,
            "demos": self._serialize_dict(self.demos),
            "projects": self._serialize_dict(self.projects),
            "skill_states": self._serialize_dict(self.skill_states),
            "achievement_cards": self._serialize_dict(self.achievement_cards),
            "evidence": self._serialize_dict(self.evidence),
            "share_tokens": self.share_tokens,
            "installed_skills": {
                owner: self._serialize_dict(items) for owner, items in self.installed_skills.items()
            },
            "courses": self._serialize_dict(self.courses),
            "project_capability_tags": self.project_capability_tags,
        }
        try:
            self._state_file.parent.mkdir(parents=True, exist_ok=True)
            self._state_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            logger.info(f"[persist] OK projects={len(payload.get('projects',{}))} users={len(payload.get('users',{}))}")
        except Exception as e:
            logger.error(f"[persist] FAILED: {e}")

    def _restore_state(self) -> bool:
        if not self._state_file.exists():
            return False
        try:
            payload = json.loads(self._state_file.read_text(encoding="utf-8"))
            self.users = self._load_model_dict(payload.get("users", {}), User)
            self.user_email_index = payload.get("user_email_index", {})
            self.demos = self._load_model_dict(payload.get("demos", {}), Demo)
            self.projects = self._load_model_dict(payload.get("projects", {}), Project)
            self.skill_states = self._load_model_dict(payload.get("skill_states", {}), SkillState)
            self.achievement_cards = self._load_model_dict(payload.get("achievement_cards", {}), AchievementCard)
            self.evidence = self._load_model_dict(payload.get("evidence", {}), Evidence)
            self.share_tokens = payload.get("share_tokens", {})
            self.installed_skills = {
                owner: self._load_model_dict(items, SkillRecord)
                for owner, items in payload.get("installed_skills", {}).items()
            }
            self.courses = self._load_model_dict(payload.get("courses", {}), Course)
            self.project_capability_tags = payload.get("project_capability_tags", {})
            return True
        except Exception:
            return False

    def _init_sample_data(self):
        demo1 = Demo(
            id=str(uuid.uuid4()),
            name="AI 诗词生成器",
            description="使用 AI 生成优美的古诗词，体验 AI 创作的魅力",
            tech_stack=["HTML", "CSS", "JavaScript"],
            difficulty="beginner",
            subjects=["语文", "计算机"],
            grade_range="12-18岁",
            tags=["AI", "诗词", "前端"],
            display_mode="iframe",
            iframe_url="https://codepen.io/pen/",
            screenshots=[],
            project_breakdown="# 项目拆解\n\n## 功能特点\n1. 简单的 HTML 界面\n2. JavaScript 实现随机诗词生成\n3. 美观的 CSS 样式\n\n## 学习要点\n- HTML 结构设计\n- JavaScript 基础语法\n- CSS 美化",
            minimal_replica="/templates/poetry-generator/",
            code_url="https://github.com/",
            download_url="https://github.com/",
            created_by="system",
            is_public=True,
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        self.demos[demo1.id] = demo1

        demo2 = Demo(
            id=str(uuid.uuid4()),
            name="智能计算器",
            description="不仅能计算，还能解释计算过程的学习型计算器",
            tech_stack=["HTML", "CSS", "JavaScript"],
            difficulty="beginner",
            subjects=["数学", "计算机"],
            grade_range="10-16岁",
            tags=["数学", "前端", "计算器"],
            display_mode="iframe",
            iframe_url="https://codepen.io/pen/",
            screenshots=[],
            project_breakdown="# 项目拆解\n\n## 功能特点\n1. 基础计算功能\n2. 计算步骤解释\n3. 美观的界面设计\n\n## 学习要点\n- JavaScript 事件处理\n- DOM 操作\n- CSS Flexbox 布局",
            minimal_replica="/templates/smart-calculator/",
            code_url="https://github.com/",
            download_url="https://github.com/",
            created_by="system",
            is_public=True,
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        self.demos[demo2.id] = demo2

        demo3 = Demo(
            id=str(uuid.uuid4()),
            name="待办清单管理器",
            description="管理你的学习任务，养成良好的时间管理习惯",
            tech_stack=["HTML", "CSS", "JavaScript"],
            difficulty="beginner",
            subjects=["计算机"],
            grade_range="10-18岁",
            tags=["任务管理", "前端", "LocalStorage"],
            display_mode="iframe",
            iframe_url="https://codepen.io/pen/",
            screenshots=[],
            project_breakdown="# 项目拆解\n\n## 功能特点\n1. 添加/删除任务\n2. 标记完成状态\n3. 本地存储持久化\n\n## 学习要点\n- LocalStorage 使用\n- JavaScript 数组操作\n- CSS 动画效果",
            minimal_replica="/templates/todo-list/",
            code_url="https://github.com/",
            download_url="https://github.com/",
            created_by="system",
            is_public=True,
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        self.demos[demo3.id] = demo3

    # =========================================================================
    # User Methods
    # =========================================================================
    def get_user(self, user_id: str) -> Optional[User]:
        return self.users.get(user_id)

    def get_user_by_email(self, email: str) -> Optional[User]:
        user_id = self.user_email_index.get(email)
        return self.get_user(user_id) if user_id else None

    def create_user(self, user: User) -> User:
        user.id = str(uuid.uuid4())
        user.created_at = utc_now()
        user.updated_at = utc_now()
        self.users[user.id] = user
        self.user_email_index[user.email] = user.id
        return user

    def update_user(self, user_id: str, user_data: Dict) -> Optional[User]:
        if user_id not in self.users:
            return None
        user = self.users[user_id]
        for key, value in user_data.items():
            if value is not None:
                setattr(user, key, value)
        user.updated_at = utc_now()
        return user

    # =========================================================================
    # Demo Methods
    # =========================================================================
    def get_demo(self, demo_id: str) -> Optional[Demo]:
        return self.demos.get(demo_id)

    def list_demos(
        self,
        skip: int = 0,
        limit: int = 100,
        subject: Optional[str] = None,
        difficulty: Optional[str] = None,
        tech_stack: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Demo]:
        demos = list(self.demos.values())

        if subject:
            demos = [d for d in demos if subject in d.subjects]
        if difficulty:
            demos = [d for d in demos if d.difficulty == difficulty]
        if tech_stack:
            demos = [d for d in demos if any(tech_stack.lower() in item.lower() for item in d.tech_stack)]
        if search:
            keyword = search.lower()
            demos = [
                d for d in demos
                if keyword in d.name.lower() or keyword in d.description.lower()
            ]

        return demos[skip:skip+limit]

    def count_demos(
        self,
        subject: Optional[str] = None,
        difficulty: Optional[str] = None,
        tech_stack: Optional[str] = None,
        search: Optional[str] = None,
    ) -> int:
        return len(self.list_demos(0, 100000, subject, difficulty, tech_stack, search))

    def create_demo(self, demo: Demo) -> Demo:
        demo.id = str(uuid.uuid4())
        demo.created_at = utc_now()
        demo.updated_at = utc_now()
        self.demos[demo.id] = demo
        return demo

    def update_demo(self, demo_id: str, demo_data: Dict) -> Optional[Demo]:
        if demo_id not in self.demos:
            return None
        demo = self.demos[demo_id]
        for key, value in demo_data.items():
            if value is not None:
                setattr(demo, key, value)
        demo.updated_at = utc_now()
        return demo

    # =========================================================================
    # Project Methods
    # =========================================================================
    def get_project(self, project_id: str) -> Optional[Project]:
        return self.projects.get(project_id)

    def list_projects_by_author(
        self,
        author_id: str,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Project]:
        return [p for p in self.projects.values() if p.author_id == author_id and not p.is_deleted][skip:skip+limit]

    def count_projects_by_author(self, author_id: str) -> int:
        return len([p for p in self.projects.values() if p.author_id == author_id and not p.is_deleted])

    def create_project(self, project: Project) -> Project:
        project.id = str(uuid.uuid4())
        project.created_at = utc_now()
        project.updated_at = utc_now()
        self.projects[project.id] = project
        self.skill_states[project.id] = SkillState(
            project_id=project.id,
            mode=project.mode,
            current_stage=project.current_stage,
            stage_history=[{"stage": project.current_stage, "started_at": utc_now_iso()}],
            light_step_data={},
            standard_step_data={},
        )
        return project

    def list_projects(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        mode: Optional[str] = None,
        stage: Optional[str] = None,
    ) -> List[Project]:
        projects = [p for p in self.projects.values() if p.author_id == user_id and not p.is_deleted]
        if mode:
            projects = [p for p in projects if p.mode == mode]
        if stage:
            projects = [p for p in projects if p.current_stage == stage]
        return projects[skip:skip + limit]

    def count_projects(
        self,
        user_id: str,
        mode: Optional[str] = None,
        stage: Optional[str] = None,
    ) -> int:
        return len(self.list_projects(user_id=user_id, mode=mode, stage=stage, skip=0, limit=100000))

    def update_project(self, project_id: str, project_data: Dict) -> Optional[Project]:
        if project_id not in self.projects:
            return None
        project = self.projects[project_id]
        for key, value in project_data.items():
            if value is not None:
                setattr(project, key, value)
        project.updated_at = utc_now()
        return project

    def delete_project(self, project_id: str, deleted_by: str) -> bool:
        if project_id not in self.projects:
            return False
        project = self.projects[project_id]
        project.is_deleted = True
        project.deleted_at = utc_now()
        project.deleted_by = deleted_by
        return True

    # =========================================================================
    # Skill State Methods
    # =========================================================================
    def get_skill_state(self, project_id: str) -> Optional[SkillState]:
        return self.skill_states.get(project_id)

    def create_skill_state(self, skill_state: SkillState) -> SkillState:
        skill_state.created_at = utc_now()
        skill_state.updated_at = utc_now()
        self.skill_states[skill_state.project_id] = skill_state
        return skill_state

    def update_skill_state(self, project_id: str, dict_data: Dict[str, Any]) -> Optional[SkillState]:
        skill_state = self.skill_states.get(project_id)
        if not skill_state:
            return None
        for key, value in dict_data.items():
            if value is not None and hasattr(skill_state, key):
                setattr(skill_state, key, value)
        skill_state.updated_at = utc_now()
        self.skill_states[project_id] = skill_state
        return skill_state

    def advance_skill_state(self, project_id: str) -> Optional[SkillState]:
        skill_state = self.skill_states.get(project_id)
        if not skill_state:
            return None
        stages = [
            "stage_00_bootstrap",
            "stage_01_brainstorm",
            "stage_02_brief",
            "stage_03_constraints",
            "stage_04_track",
            "stage_05_design",
            "stage_06_step_plan",
            "stage_07_execute",
            "stage_08_evaluate",
        ]
        try:
            idx = stages.index(skill_state.current_stage)
        except ValueError:
            idx = 0
        if idx < len(stages) - 1:
            next_stage = stages[idx + 1]
            skill_state.current_stage = next_stage
            skill_state.stage_history.append(
                {"stage": next_stage, "started_at": utc_now_iso()}
            )
        skill_state.updated_at = utc_now()
        self.skill_states[project_id] = skill_state
        project = self.projects.get(project_id)
        if project:
            project.current_stage = skill_state.current_stage
            project.updated_at = utc_now()
        return skill_state

    # =========================================================================
    # Achievement Card Methods
    # =========================================================================
    def get_achievement_card(self, card_id: str) -> Optional[AchievementCard]:
        return self.achievement_cards.get(card_id)

    def get_achievement_card_by_project(self, project_id: str) -> Optional[AchievementCard]:
        for card in self.achievement_cards.values():
            if card.project_id == project_id:
                return card
        return None

    def get_achievement_card_by_share_token(self, token: str) -> Optional[AchievementCard]:
        card_id = self.share_tokens.get(token)
        return self.get_achievement_card(card_id) if card_id else None

    def list_public_achievement_cards(
        self,
        skip: int = 0,
        limit: int = 100,
        capability_tag: Optional[str] = None,
        project_mode: Optional[str] = None,
    ) -> List[AchievementCard]:
        cards = [c for c in self.achievement_cards.values() if c.is_public and not c.is_deleted]

        if capability_tag:
            cards = [c for c in cards if capability_tag in c.capability_tags]
        if project_mode:
            cards = [c for c in cards if c.project_mode == project_mode]

        return cards[skip:skip+limit]

    def count_public_achievement_cards(
        self,
        capability_tag: Optional[str] = None,
        project_mode: Optional[str] = None,
    ) -> int:
        return len(self.list_public_achievement_cards(0, 100000, capability_tag, project_mode))

    def create_achievement_card(self, card: AchievementCard) -> AchievementCard:
        card.id = str(uuid.uuid4())
        card.created_at = utc_now()
        card.updated_at = utc_now()
        self.achievement_cards[card.id] = card
        return card

    def update_achievement_card(self, card_id: str, card_data: Dict) -> Optional[AchievementCard]:
        if card_id not in self.achievement_cards:
            return None
        card = self.achievement_cards[card_id]
        for key, value in card_data.items():
            if value is not None:
                setattr(card, key, value)
        card.updated_at = utc_now()
        return card

    def create_share_token(self, card_id: str) -> str:
        token = str(uuid.uuid4())
        self.share_tokens[token] = card_id
        card = self.achievement_cards.get(card_id)
        if card:
            card.share_token = token
        return token

    # =========================================================================
    # Evidence Methods
    # =========================================================================
    def get_evidence(self, evidence_id: str) -> Optional[Evidence]:
        return self.evidence.get(evidence_id)

    def list_evidence(
        self,
        project_id: str,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
    ) -> List[Evidence]:
        items = [e for e in self.evidence.values() if e.project_id == project_id and not e.is_deleted]
        if type:
            items = [e for e in items if e.type == type]
        return items[skip:skip + limit]

    def list_evidence_by_project(self, project_id: str, skip: int = 0, limit: int = 100) -> List[Evidence]:
        return self.list_evidence(project_id=project_id, skip=skip, limit=limit)

    def count_evidence(
        self,
        project_id: str,
        type: Optional[str] = None,
    ) -> int:
        return len(self.list_evidence(project_id=project_id, type=type, skip=0, limit=100000))

    def create_evidence(self, evidence_item: Evidence) -> Evidence:
        evidence_item.id = str(uuid.uuid4())
        evidence_item.created_at = utc_now()
        evidence_item.updated_at = utc_now()
        self.evidence[evidence_item.id] = evidence_item
        return evidence_item

    def update_evidence(self, evidence_id: str, evidence_data: Dict[str, Any]) -> Optional[Evidence]:
        evidence_item = self.evidence.get(evidence_id)
        if not evidence_item:
            return None
        for key, value in evidence_data.items():
            if value is not None and hasattr(evidence_item, key):
                setattr(evidence_item, key, value)
        evidence_item.updated_at = utc_now()
        self.evidence[evidence_id] = evidence_item
        return evidence_item

    def delete_evidence(self, evidence_id: str, deleted_by: str) -> bool:
        if evidence_id not in self.evidence:
            return False
        e = self.evidence[evidence_id]
        e.is_deleted = True
        e.deleted_at = utc_now()
        e.deleted_by = deleted_by
        return True

    # =========================================================================
    # Skill Install Methods
    # =========================================================================
    def list_installed_skills(self, owner_id: str) -> List[SkillRecord]:
        return list(self.installed_skills.get(owner_id, {}).values())

    def get_installed_skill(self, owner_id: str, skill_id: str) -> Optional[SkillRecord]:
        return self.installed_skills.get(owner_id, {}).get(skill_id)

    def upsert_installed_skill(self, owner_id: str, record: SkillRecord) -> SkillRecord:
        if owner_id not in self.installed_skills:
            self.installed_skills[owner_id] = {}
        record.updated_at = utc_now()
        self.installed_skills[owner_id][record.manifest.skill_id] = record
        return record

    def remove_installed_skill(self, owner_id: str, skill_id: str) -> bool:
        if owner_id not in self.installed_skills:
            return False
        if skill_id not in self.installed_skills[owner_id]:
            return False
        del self.installed_skills[owner_id][skill_id]
        return True

    # =========================================================================
    # Course / Capability Methods
    # =========================================================================
    def list_courses(self, owner_id: str) -> List[Course]:
        return [item for item in self.courses.values() if item.owner_id == owner_id]

    def create_course(self, item: Course) -> Course:
        item.id = str(uuid.uuid4())
        item.created_at = utc_now()
        item.updated_at = utc_now()
        self.courses[item.id] = item
        return item

    def get_project_capability_tags(self, project_id: str) -> List[str]:
        return self.project_capability_tags.get(project_id, [])

    def set_project_capability_tags(self, project_id: str, tags: List[str]) -> List[str]:
        normalized = [tag.strip() for tag in tags if tag and tag.strip()]
        self.project_capability_tags[project_id] = normalized
        return normalized


db = MemoryDatabase()
