"""
SQLAlchemy ORM 模型定义

用途：定义所有业务实体的数据库表结构
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class AuditMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)


class UserModel(AuditMixin, Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password: Mapped[str] = mapped_column("hashed_password", String(255))
    role: Mapped[str] = mapped_column(String(32), default="student")
    level: Mapped[int] = mapped_column(Integer, default=1)
    capability_tags: Mapped[str] = mapped_column(Text, default="[]")


class DemoModel(AuditMixin, Base):
    __tablename__ = "demos"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    tech_stack: Mapped[str] = mapped_column(Text, default="[]")
    difficulty: Mapped[str] = mapped_column(String(32), default="beginner")
    subjects: Mapped[str] = mapped_column(Text, default="[]")
    grade_range: Mapped[str] = mapped_column(String(64), default="10-18岁")
    tags: Mapped[str] = mapped_column(Text, default="[]")
    display_mode: Mapped[str] = mapped_column(String(32), default="iframe")
    iframe_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    screenshots: Mapped[str] = mapped_column(Text, default="[]")
    demo_video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    project_breakdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    minimal_replica: Mapped[str | None] = mapped_column(Text, nullable=True)
    code_url: Mapped[str] = mapped_column(String(500))
    download_url: Mapped[str] = mapped_column(String(500))
    fork_template_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ProjectModel(AuditMixin, Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    author_id: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255))
    mode: Mapped[str] = mapped_column(String(32), default="light")
    description: Mapped[str] = mapped_column(Text, default="")
    current_stage: Mapped[str] = mapped_column(String(64), default="stage_01_brainstorm")
    from_demo_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    initial_data: Mapped[str] = mapped_column(Text, default="{}")


class SkillStateModel(AuditMixin, Base):
    __tablename__ = "skill_states"
    project_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    version: Mapped[str] = mapped_column(String(16), default="1.0.0")
    mode: Mapped[str] = mapped_column(String(32))
    current_stage: Mapped[str] = mapped_column(String(64))
    light_step: Mapped[str | None] = mapped_column(String(8), nullable=True)
    stages: Mapped[str] = mapped_column(Text, default="{}")
    skill_metadata: Mapped[str] = mapped_column("metadata", Text, default="{}")
    light_to_standard_mapping: Mapped[str | None] = mapped_column(Text, nullable=True)
    stage_history: Mapped[str] = mapped_column(Text, default="[]")
    light_step_data: Mapped[str] = mapped_column(Text, default="{}")
    standard_step_data: Mapped[str] = mapped_column(Text, default="{}")


class AchievementCardModel(AuditMixin, Base):
    __tablename__ = "achievement_cards"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    author_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    one_liner: Mapped[str] = mapped_column(Text)
    problem_solved: Mapped[str] = mapped_column(Text)
    method_used: Mapped[str] = mapped_column(Text)
    screenshots: Mapped[str] = mapped_column(Text, default="[]")
    reflection: Mapped[str] = mapped_column(Text)
    capability_tags: Mapped[str] = mapped_column(Text, default="[]")
    project_mode: Mapped[str] = mapped_column(String(32), default="light")
    share_token: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    featured_sort_order: Mapped[int] = mapped_column(Integer, default=0)
    featured_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class EvidenceModel(AuditMixin, Base):
    __tablename__ = "evidence"
    __table_args__ = (
        Index("ix_evidence_project_deleted_created", "project_id", "is_deleted", "created_at"),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(64), index=True)
    author_id: Mapped[str] = mapped_column(String(64), index=True)
    type: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    content_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    related_step: Mapped[str | None] = mapped_column(String(64), nullable=True)


class CourseModel(Base):
    __tablename__ = "courses"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(150))
    summary: Mapped[str] = mapped_column(Text, default="")
    subject: Mapped[str] = mapped_column(String(64), default="")
    difficulty: Mapped[str] = mapped_column(String(32), default="beginner")
    tags: Mapped[str] = mapped_column(Text, default="[]")
    resource_url: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ProjectCapabilityTagModel(Base):
    __tablename__ = "project_capability_tags"
    project_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tags: Mapped[str] = mapped_column(Text, default="[]")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class SkillRecordModel(AuditMixin, Base):
    __tablename__ = "skill_records"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(64), index=True)
    source: Mapped[str] = mapped_column(String(32), default="builtin")
    status: Mapped[str] = mapped_column(String(32), default="enabled")
    manifest: Mapped[str] = mapped_column(Text, default="{}")
    config: Mapped[str] = mapped_column(Text, default="{}")
    install_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

