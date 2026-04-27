"""
内存数据库层

用途：MVP 阶段使用内存存储，支持所有业务功能
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime
import uuid
from app.schemas.demos import Demo
from app.schemas.projects import Project, SkillState
from app.schemas.achievements import AchievementCard
from app.schemas.evidence import Evidence
from app.schemas.auth import User
from app.schemas.skills import SkillRecord
from app.schemas.course_library import Course
from app.schemas.counseling import (
    AssistantDialogueMessage,
    AssistantDialogueSession,
    AuditLogItem,
    HongKongMacaoPlan,
    InternationalPlan,
    KnowledgeSource,
    ProfileEnhancementPlan,
    QuestionnaireResponse,
    QuestionnaireTemplate,
)
from app.core.config import settings


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
            "create_hkmo_plan",
            "update_hkmo_plan",
            "create_international_plan",
            "update_international_plan",
            "create_profile_plan",
            "update_profile_plan",
            "create_knowledge_source",
            "update_knowledge_source",
            "create_questionnaire_template",
            "create_questionnaire_response",
            "create_dialogue_session",
            "touch_dialogue_session",
            "create_dialogue_message",
            "create_audit_log",
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
        self.hkmo_plans: Dict[str, HongKongMacaoPlan] = {}
        self.international_plans: Dict[str, InternationalPlan] = {}
        self.profile_plans: Dict[str, ProfileEnhancementPlan] = {}
        self.knowledge_sources: Dict[str, KnowledgeSource] = {}
        self.questionnaire_templates: Dict[str, QuestionnaireTemplate] = {}
        self.questionnaire_responses: Dict[str, QuestionnaireResponse] = {}
        self.courses: Dict[str, Course] = {}
        self.project_capability_tags: Dict[str, List[str]] = {}
        self.dialogue_sessions: Dict[str, AssistantDialogueSession] = {}
        self.dialogue_messages: Dict[str, AssistantDialogueMessage] = {}
        self.audit_logs: Dict[str, AuditLogItem] = {}
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
            "hkmo_plans": self._serialize_dict(self.hkmo_plans),
            "international_plans": self._serialize_dict(self.international_plans),
            "profile_plans": self._serialize_dict(self.profile_plans),
            "knowledge_sources": self._serialize_dict(self.knowledge_sources),
            "questionnaire_templates": self._serialize_dict(self.questionnaire_templates),
            "questionnaire_responses": self._serialize_dict(self.questionnaire_responses),
            "courses": self._serialize_dict(self.courses),
            "project_capability_tags": self.project_capability_tags,
            "dialogue_sessions": self._serialize_dict(self.dialogue_sessions),
            "dialogue_messages": self._serialize_dict(self.dialogue_messages),
            "audit_logs": self._serialize_dict(self.audit_logs),
        }
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

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
            self.hkmo_plans = self._load_model_dict(payload.get("hkmo_plans", {}), HongKongMacaoPlan)
            self.international_plans = self._load_model_dict(payload.get("international_plans", {}), InternationalPlan)
            self.profile_plans = self._load_model_dict(payload.get("profile_plans", {}), ProfileEnhancementPlan)
            self.knowledge_sources = self._load_model_dict(payload.get("knowledge_sources", {}), KnowledgeSource)
            self.questionnaire_templates = self._load_model_dict(payload.get("questionnaire_templates", {}), QuestionnaireTemplate)
            self.questionnaire_responses = self._load_model_dict(payload.get("questionnaire_responses", {}), QuestionnaireResponse)
            self.courses = self._load_model_dict(payload.get("courses", {}), Course)
            self.project_capability_tags = payload.get("project_capability_tags", {})
            self.dialogue_sessions = self._load_model_dict(payload.get("dialogue_sessions", {}), AssistantDialogueSession)
            self.dialogue_messages = self._load_model_dict(payload.get("dialogue_messages", {}), AssistantDialogueMessage)
            self.audit_logs = self._load_model_dict(payload.get("audit_logs", {}), AuditLogItem)
            return True
        except Exception:
            return False
    
    def _init_sample_data(self):
        # =====================================================================
        # 预置 3 个示例 Demo (Phase 1 MVP)
        # =====================================================================
        
        # Demo 1: 诗词生成器
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
            project_breakdown="""
# 项目拆解

## 功能特点
1. 简单的 HTML 界面
2. JavaScript 实现随机诗词生成
3. 美观的 CSS 样式

## 学习要点
- HTML 结构设计
- JavaScript 基础语法
- CSS 美化
            """,
            minimal_replica="/templates/poetry-generator/",
            code_url="https://github.com/",
            download_url="https://github.com/",
            created_by="system",
            is_public=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.demos[demo1.id] = demo1
        
        # Demo 2: 简单计算器
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
            project_breakdown="""
# 项目拆解

## 功能特点
1. 基础计算功能
2. 计算步骤解释
3. 美观的界面设计

## 学习要点
- JavaScript 事件处理
- DOM 操作
- CSS Flexbox 布局
            """,
            minimal_replica="/templates/smart-calculator/",
            code_url="https://github.com/",
            download_url="https://github.com/",
            created_by="system",
            is_public=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.demos[demo2.id] = demo2
        
        # Demo 3: 待办事项清单
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
            project_breakdown="""
# 项目拆解

## 功能特点
1. 添加/删除任务
2. 标记完成状态
3. 本地存储持久化

## 学习要点
- LocalStorage 使用
- JavaScript 数组操作
- CSS 动画效果
            """,
            minimal_replica="/templates/todo-list/",
            code_url="https://github.com/",
            download_url="https://github.com/",
            created_by="system",
            is_public=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
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
        user.created_at = datetime.utcnow()
        user.updated_at = datetime.utcnow()
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
        user.updated_at = datetime.utcnow()
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
        demo.created_at = datetime.utcnow()
        demo.updated_at = datetime.utcnow()
        self.demos[demo.id] = demo
        return demo
    
    def update_demo(self, demo_id: str, demo_data: Dict) -> Optional[Demo]:
        if demo_id not in self.demos:
            return None
        demo = self.demos[demo_id]
        for key, value in demo_data.items():
            if value is not None:
                setattr(demo, key, value)
        demo.updated_at = datetime.utcnow()
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
        project.created_at = datetime.utcnow()
        project.updated_at = datetime.utcnow()
        self.projects[project.id] = project
        # 项目创建时同步初始化 SKILL_STATE，避免进度接口 404
        self.skill_states[project.id] = SkillState(
            project_id=project.id,
            mode=project.mode,
            current_stage=project.current_stage,
            stage_history=[{"stage": project.current_stage, "started_at": datetime.utcnow().isoformat()}],
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
        project.updated_at = datetime.utcnow()
        return project
    
    def delete_project(self, project_id: str, deleted_by: str) -> bool:
        if project_id not in self.projects:
            return False
        project = self.projects[project_id]
        project.is_deleted = True
        project.deleted_at = datetime.utcnow()
        project.deleted_by = deleted_by
        return True
    
    # =========================================================================
    # Skill State Methods
    # =========================================================================
    def get_skill_state(self, project_id: str) -> Optional[SkillState]:
        return self.skill_states.get(project_id)
    
    def create_skill_state(self, skill_state: SkillState) -> SkillState:
        skill_state.created_at = datetime.utcnow()
        skill_state.updated_at = datetime.utcnow()
        self.skill_states[skill_state.project_id] = skill_state
        return skill_state
    
    def update_skill_state(self, project_id: str, dict_data: Dict[str, Any]) -> Optional[SkillState]:
        skill_state = self.skill_states.get(project_id)
        if not skill_state:
            return None
        for key, value in dict_data.items():
            if value is not None and hasattr(skill_state, key):
                setattr(skill_state, key, value)
        skill_state.updated_at = datetime.utcnow()
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
                {"stage": next_stage, "started_at": datetime.utcnow().isoformat()}
            )
        skill_state.updated_at = datetime.utcnow()
        self.skill_states[project_id] = skill_state
        project = self.projects.get(project_id)
        if project:
            project.current_stage = skill_state.current_stage
            project.updated_at = datetime.utcnow()
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
        card.created_at = datetime.utcnow()
        card.updated_at = datetime.utcnow()
        self.achievement_cards[card.id] = card
        return card
    
    def update_achievement_card(self, card_id: str, card_data: Dict) -> Optional[AchievementCard]:
        if card_id not in self.achievement_cards:
            return None
        card = self.achievement_cards[card_id]
        for key, value in card_data.items():
            if value is not None:
                setattr(card, key, value)
        card.updated_at = datetime.utcnow()
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
        evidence_item.created_at = datetime.utcnow()
        evidence_item.updated_at = datetime.utcnow()
        self.evidence[evidence_item.id] = evidence_item
        return evidence_item

    def update_evidence(self, evidence_id: str, evidence_data: Dict[str, Any]) -> Optional[Evidence]:
        evidence_item = self.evidence.get(evidence_id)
        if not evidence_item:
            return None
        for key, value in evidence_data.items():
            if value is not None and hasattr(evidence_item, key):
                setattr(evidence_item, key, value)
        evidence_item.updated_at = datetime.utcnow()
        self.evidence[evidence_id] = evidence_item
        return evidence_item
    
    def delete_evidence(self, evidence_id: str, deleted_by: str) -> bool:
        if evidence_id not in self.evidence:
            return False
        e = self.evidence[evidence_id]
        e.is_deleted = True
        e.deleted_at = datetime.utcnow()
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
        record.updated_at = datetime.utcnow()
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
        item.created_at = datetime.utcnow()
        item.updated_at = datetime.utcnow()
        self.courses[item.id] = item
        return item

    def get_project_capability_tags(self, project_id: str) -> List[str]:
        return self.project_capability_tags.get(project_id, [])

    def set_project_capability_tags(self, project_id: str, tags: List[str]) -> List[str]:
        normalized = [tag.strip() for tag in tags if tag and tag.strip()]
        self.project_capability_tags[project_id] = normalized
        return normalized

    # =========================================================================
    # Counseling Methods
    # =========================================================================
    def create_hkmo_plan(self, item: HongKongMacaoPlan) -> HongKongMacaoPlan:
        self.hkmo_plans[item.id] = item
        return item

    def list_hkmo_plans(self, owner_id: str) -> List[HongKongMacaoPlan]:
        return [item for item in self.hkmo_plans.values() if item.owner_id == owner_id and not item.is_deleted]

    def update_hkmo_plan(self, item_id: str, data: Dict[str, Any]) -> Optional[HongKongMacaoPlan]:
        item = self.hkmo_plans.get(item_id)
        if not item:
            return None
        for key, value in data.items():
            if value is not None and hasattr(item, key):
                setattr(item, key, value)
        item.updated_at = datetime.utcnow()
        return item

    def create_international_plan(self, item: InternationalPlan) -> InternationalPlan:
        self.international_plans[item.id] = item
        return item

    def list_international_plans(self, owner_id: str) -> List[InternationalPlan]:
        return [item for item in self.international_plans.values() if item.owner_id == owner_id and not item.is_deleted]

    def update_international_plan(self, item_id: str, data: Dict[str, Any]) -> Optional[InternationalPlan]:
        item = self.international_plans.get(item_id)
        if not item:
            return None
        for key, value in data.items():
            if value is not None and hasattr(item, key):
                setattr(item, key, value)
        item.updated_at = datetime.utcnow()
        return item

    def create_profile_plan(self, item: ProfileEnhancementPlan) -> ProfileEnhancementPlan:
        self.profile_plans[item.id] = item
        return item

    def list_profile_plans(self, owner_id: str) -> List[ProfileEnhancementPlan]:
        return [item for item in self.profile_plans.values() if item.owner_id == owner_id and not item.is_deleted]

    def update_profile_plan(self, item_id: str, data: Dict[str, Any]) -> Optional[ProfileEnhancementPlan]:
        item = self.profile_plans.get(item_id)
        if not item:
            return None
        for key, value in data.items():
            if value is not None and hasattr(item, key):
                setattr(item, key, value)
        item.updated_at = datetime.utcnow()
        return item

    def create_knowledge_source(self, item: KnowledgeSource) -> KnowledgeSource:
        self.knowledge_sources[item.id] = item
        return item

    def list_knowledge_sources(self, owner_id: str) -> List[KnowledgeSource]:
        return [item for item in self.knowledge_sources.values() if item.owner_id == owner_id and not item.is_deleted]

    def update_knowledge_source(self, item_id: str, data: Dict[str, Any]) -> Optional[KnowledgeSource]:
        item = self.knowledge_sources.get(item_id)
        if not item:
            return None
        for key, value in data.items():
            if value is not None and hasattr(item, key):
                setattr(item, key, value)
        item.updated_at = datetime.utcnow()
        return item

    def create_questionnaire_template(self, item: QuestionnaireTemplate) -> QuestionnaireTemplate:
        self.questionnaire_templates[item.id] = item
        return item

    def list_questionnaire_templates(self, owner_id: str) -> List[QuestionnaireTemplate]:
        return [item for item in self.questionnaire_templates.values() if item.owner_id == owner_id and not item.is_deleted]

    def create_questionnaire_response(self, item: QuestionnaireResponse) -> QuestionnaireResponse:
        self.questionnaire_responses[item.id] = item
        return item

    def list_questionnaire_responses(self, template_id: str) -> List[QuestionnaireResponse]:
        return [item for item in self.questionnaire_responses.values() if item.template_id == template_id]

    def create_dialogue_session(self, item: AssistantDialogueSession) -> AssistantDialogueSession:
        self.dialogue_sessions[item.id] = item
        return item

    def get_dialogue_session(self, session_id: str) -> Optional[AssistantDialogueSession]:
        return self.dialogue_sessions.get(session_id)

    def list_dialogue_sessions(self, owner_id: str) -> List[AssistantDialogueSession]:
        sessions = [item for item in self.dialogue_sessions.values() if item.owner_id == owner_id]
        return sorted(sessions, key=lambda item: item.updated_at, reverse=True)

    def touch_dialogue_session(self, session_id: str) -> None:
        session = self.dialogue_sessions.get(session_id)
        if session:
            session.updated_at = datetime.utcnow()

    def create_dialogue_message(self, item: AssistantDialogueMessage) -> AssistantDialogueMessage:
        self.dialogue_messages[item.id] = item
        return item

    def list_dialogue_messages(self, session_id: str) -> List[AssistantDialogueMessage]:
        msgs = [item for item in self.dialogue_messages.values() if item.session_id == session_id]
        return sorted(msgs, key=lambda item: item.created_at)

    def create_audit_log(self, item: AuditLogItem) -> AuditLogItem:
        self.audit_logs[item.id] = item
        return item

    def list_audit_logs(self, owner_id: str, module: Optional[str] = None) -> List[AuditLogItem]:
        items = [item for item in self.audit_logs.values() if item.owner_id == owner_id]
        if module:
            items = [item for item in items if item.module == module]
        return sorted(items, key=lambda item: item.created_at, reverse=True)


db = MemoryDatabase()
