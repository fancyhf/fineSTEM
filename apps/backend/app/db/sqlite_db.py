import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.schemas.demos import Demo
from app.schemas.projects import Project, SkillState
from app.schemas.achievements import AchievementCard
from app.schemas.evidence import Evidence
from app.schemas.auth import User
from app.schemas.skills import SkillRecord
from app.schemas.course_library import Course


class SQLiteDatabase:
    def __init__(self, db_path: Optional[Path] = None):
        self._db_path = db_path or (Path(settings.STORAGE_BASE_PATH) / "finestem.db")
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: Optional[sqlite3.Connection] = None
        self._init_tables()

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self._db_path))
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
        return self._conn

    def _close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

    def _init_tables(self):
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                name TEXT,
                avatar_url TEXT,
                bio TEXT,
                role TEXT DEFAULT 'student',
                is_active INTEGER DEFAULT 1,
                is_verified INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                extra JSON
            );
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                mode TEXT DEFAULT 'standard',
                status TEXT DEFAULT 'active',
                current_stage TEXT DEFAULT 'stage_00',
                stage_progress REAL DEFAULT 0,
                evidence_count INTEGER DEFAULT 0,
                teaching_mode TEXT DEFAULT 'guided',
                tags JSON,
                cover_image_url TEXT,
                initial_data JSON,
                created_at TEXT,
                updated_at TEXT,
                deleted_at TEXT,
                deleted_by TEXT,
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY (owner_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
            CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(is_deleted);

            CREATE TABLE IF NOT EXISTS demos (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                mode TEXT DEFAULT 'standard',
                tags JSON,
                cover_image_url TEXT,
                initial_data JSON,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS skill_states (
                owner_id TEXT NOT NULL,
                skill_id TEXT NOT NULL,
                state JSON,
                updated_at TEXT,
                PRIMARY KEY (owner_id, skill_id)
            );

            CREATE TABLE IF NOT EXISTS achievement_cards (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                author_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                content_url TEXT,
                related_step TEXT,
                created_at TEXT,
                created_by TEXT,
                updated_at TEXT,
                updated_by TEXT,
                deleted_at TEXT,
                deleted_by TEXT,
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );
            CREATE INDEX IF NOT EXISTS idx_achievement_project ON achievement_cards(project_id);

            CREATE TABLE IF NOT EXISTS evidence (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                author_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT,
                content TEXT,
                content_url TEXT,
                related_step TEXT,
                created_at TEXT,
                created_by TEXT,
                updated_at TEXT,
                updated_by TEXT,
                deleted_at TEXT,
                deleted_by TEXT,
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );
            CREATE INDEX IF NOT EXISTS idx_evidence_project ON evidence(project_id);

            CREATE TABLE IF NOT EXISTS installed_skills (
                owner_id TEXT NOT NULL,
                skill_id TEXT NOT NULL,
                status TEXT DEFAULT 'available',
                config JSON,
                installed_at TEXT,
                PRIMARY KEY (owner_id, skill_id)
            );

            CREATE TABLE IF NOT EXISTS courses (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                cover_image_url TEXT,
                stages JSON,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS share_tokens (
                token TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                expires_at TEXT,
                created_by TEXT,
                created_at TEXT,
                max_uses INTEGER DEFAULT -1,
                use_count INTEGER DEFAULT 0,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS project_capability_tags (
                project_id TEXT PRIMARY KEY,
                tags JSON
            );
        """)
        conn.commit()

    def _now(self) -> str:
        return datetime.utcnow().isoformat() + "Z"

    def _row_to_model(self, row: sqlite3.Row, model_class) -> Any:
        if row is None:
            return None
        d = dict(row)
        for key in list(d.keys()):
            v = d[key]
            if isinstance(v, str):
                try:
                    parsed = json.loads(v)
                    d[key] = parsed
                except (json.JSONDecodeError, TypeError):
                    pass
        return model_class(**d)

    def _rows_to_dict(self, rows, key_field, model_class) -> Dict[str, Any]:
        result = {}
        for row in rows:
            obj = self._row_to_model(row, model_class)
            if obj:
                result[getattr(obj, key_field)] = obj
        return result

    # ===== Users =====
    def get_user(self, user_id: str) -> Optional[User]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        return self._row_to_model(row, User)

    def get_user_by_email(self, email: str) -> Optional[User]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM users WHERE email=? AND is_deleted=0", (email,)).fetchone()
        return self._row_to_model(row, User)

    @property
    def user_email_index(self) -> Dict[str, str]:
        conn = self._get_conn()
        rows = conn.execute("SELECT id, email FROM users WHERE is_deleted=0").fetchall()
        return {r["email"]: r["id"] for r in rows}

    def create_user(self, user: User) -> User:
        conn = self._get_conn()
        now = self._now()
        conn.execute("""
            INSERT INTO users (id, email, hashed_password, name, avatar_url, bio, role, is_active, is_verified, created_at, updated_at, extra)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user.id, user.email, user.hashed_password, user.name,
            user.avatar_url, user.bio, user.role,
            int(user.is_active), int(user.is_verified),
            user.created_at or now, user.updated_at or now,
            json.dumps(user.extra) if hasattr(user, 'extra') else None,
        ))
        conn.commit()
        return user

    # ===== Projects =====
    def get_project(self, project_id: str) -> Optional[Project]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM projects WHERE id=? AND is_deleted=0", (project_id,)).fetchone()
        return self._row_to_model(row, Project)

    def get_projects_by_user(self, user_id: str, include_deleted: bool = False) -> List[Project]:
        conn = self._get_conn()
        if include_deleted:
            rows = conn.execute("SELECT * FROM projects WHERE owner_id=? ORDER BY created_at DESC", (user_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM projects WHERE owner_id=? AND is_deleted=0 ORDER BY created_at DESC", (user_id,)).fetchall()
        return [self._row_to_model(r, Project) for r in rows if r]

    def search_projects(self, query: str, limit: int = 20) -> List[Project]:
        conn = self._get_conn()
        pattern = f"%{query}%"
        rows = conn.execute(
            "SELECT * FROM projects WHERE is_deleted=0 AND (name LIKE ? OR description LIKE ?) ORDER BY updated_at DESC LIMIT ?",
            (pattern, pattern, limit)
        ).fetchall()
        return [self._row_to_model(r, Project) for r in rows if r]

    def create_project(self, project: Project) -> Project:
        conn = self._get_conn()
        now = self._now()
        conn.execute("""
            INSERT INTO projects (
                id, owner_id, name, description, mode, status, current_stage,
                stage_progress, evidence_count, teaching_mode, tags, cover_image_url,
                initial_data, created_at, updated_at, deleted_at, deleted_by, is_deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            project.id, project.owner_id, project.name, project.description,
            project.mode, project.status, project.current_stage,
            project.stage_progress, project.evidence_count, project.teaching_mode,
            json.dumps(project.tags) if project.tags else None,
            project.cover_image_url,
            json.dumps(project.initial_data) if project.initial_data else None,
            project.created_at or now, project.updated_at or now,
            project.deleted_at, project.deleted_by, int(bool(project.is_deleted)),
        ))
        conn.commit()
        return project

    def update_project(self, project_id: str, project_data: Dict) -> Optional[Project]:
        conn = self._get_conn()
        existing = conn.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
        if not existing:
            return None
        now = self._now()
        set_clauses = []
        values = []
        for key, value in project_data.items():
            if key == "tags":
                set_clauses.append(f"{key}=?")
                values.append(json.dumps(value) if value else None)
            elif key == "initial_data":
                set_clauses.append(f"{key}=?")
                values.append(json.dumps(value) if value else None)
            elif key == "is_deleted":
                set_clauses.append(f"{key}=?")
                values.append(int(bool(value)))
            elif key in ("stage_progress", "evidence_count"):
                set_clauses.append(f"{key}=?")
                values.append(float(value) if value is not None else 0)
            else:
                set_clauses.append(f"{key}=?")
                values.append(value)
        set_clauses.append("updated_at=?")
        values.append(now)
        values.append(project_id)
        conn.execute(f"UPDATE projects SET {', '.join(set_clauses)} WHERE id=?", values)
        conn.commit()
        return self.get_project(project_id)

    def delete_project(self, project_id: str, deleted_by: str) -> bool:
        conn = self._get_conn()
        now = self._now()
        cursor = conn.execute(
            "UPDATE projects SET is_deleted=1, deleted_at=?, deleted_by=?, updated_at=? WHERE id=? AND is_deleted=0",
            (now, deleted_by, now, project_id)
        )
        conn.commit()
        return cursor.rowcount > 0

    # ===== Demos =====
    @property
    def demos(self) -> Dict[str, Demo]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM demos").fetchall()
        return self._rows_to_dict(rows, "id", Demo)

    # ===== Skill States =====
    @property
    def skill_states(self) -> Dict[str, Dict[str, SkillState]]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM skill_states").fetchall()
        result: Dict[str, Dict[str, SkillState]] = {}
        for r in rows:
            owner_id = r["owner_id"]
            skill_id = r["skill_id"]
            state_data = r.get("state") or {}
            try:
                state = SkillState(**state_data) if isinstance(state_data, dict) else SkillState()
            except Exception:
                state = SkillState()
            result.setdefault(owner_id, {})[skill_id] = state
        return result

    # ===== Achievement Cards =====
    @property
    def achievement_cards(self) -> Dict[str, AchievementCard]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM achievement_cards WHERE is_deleted=0").fetchall()
        return self._rows_to_dict(rows, "id", AchievementCard)

    # ===== Evidence =====
    @property
    def evidence(self) -> Dict[str, Evidence]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM evidence WHERE is_deleted=0").fetchall()
        return self._rows_to_dict(rows, "id", Evidence)

    # ===== Installed Skills =====
    @property
    def installed_skills(self) -> Dict[str, Dict[str, SkillRecord]]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM installed_skills").fetchall()
        result: Dict[str, Dict[str, SkillRecord]] = {}
        for r in rows:
            owner_id = r["owner_id"]
            data = r.get("config") or {}
            try:
                record = SkillRecord(**data) if isinstance(data, dict) else SkillRecord()
            except Exception:
                record = SkillRecord()
            result.setdefault(owner_id, {})[r["skill_id"]] = record
        return result

    # ===== Courses =====
    @property
    def courses(self) -> Dict[str, Course]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM courses").fetchall()
        return self._rows_to_dict(rows, "id", Course)

    # ===== Share Tokens =====
    @property
    def share_tokens(self) -> Dict[str, Any]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM share_tokens").fetchall()
        return {r["token"]: dict(r) for r in rows}

    # ===== Capability Tags =====
    @property
    def project_capability_tags(self) -> Dict[str, List[str]]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM project_capability_tags").fetchall()
        result = {}
        for r in rows:
            tags = r.get("tags") or []
            if isinstance(tags, str):
                try:
                    tags = json.loads(tags)
                except Exception:
                    tags = []
            result[r["project_id"]] = tags
        return result

    def __del__(self):
        try:
            self._close()
        except Exception:
            pass
