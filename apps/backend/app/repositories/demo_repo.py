from __future__ import annotations

from datetime import datetime
import json

from app.db.models import DemoModel
from app.repositories.base import BaseRepository
from app.repositories.utils import json_dumps, json_loads
from app.schemas.demos import Demo

SEED_DEMOS: list[dict[str, object]] = [
    {
        "id": "demo_study_timer",
        "name": "Study Sprint Timer",
        "description": "A focused learning timer with sprint / break cycles and session stats.",
        "tech_stack": ["HTML", "CSS", "JavaScript"],
        "difficulty": "beginner",
        "subjects": ["STEM", "Productivity"],
        "grade_range": "10-18",
        "tags": ["timer", "focus", "frontend"],
        "display_mode": "static",
        "iframe_url": "",
        "screenshots": [],
        "demo_video_url": "",
        "project_breakdown": (
            "Goal: build a timer students can actually use.\n"
            "Core modules: countdown engine, mode switch, and history panel.\n"
            "Extension ideas: sound alarm, progress chart, theme toggle."
        ),
        "minimal_replica": {
            "entry_file": "src/main.js",
            "files": {
                "index.html": "<!doctype html><html><head><meta charset='UTF-8'><title>Study Sprint Timer</title><link rel='stylesheet' href='./src/style.css'></head><body><div id='app'></div><script type='module' src='./src/main.js'></script></body></html>",
                "src/style.css": "body{font-family:Arial,sans-serif;background:#f5f7fb;color:#0f172a;padding:24px}button{margin-right:8px;padding:8px 12px;border-radius:8px;border:1px solid #94a3b8;background:white;cursor:pointer}.card{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;max-width:560px}",
                "src/main.js": "let seconds=25*60;let running=false;let timer=null;const app=document.getElementById('app');const fmt=(n)=>String(n).padStart(2,'0');const draw=()=>{const m=Math.floor(seconds/60),s=seconds%60;app.innerHTML=`<div class='card'><h2>Study Sprint Timer</h2><p id='time'>${fmt(m)}:${fmt(s)}</p><button id='start'>Start</button><button id='pause'>Pause</button><button id='reset'>Reset</button></div>`;document.getElementById('start').onclick=()=>{if(running)return;running=true;timer=setInterval(()=>{seconds=Math.max(0,seconds-1);draw();if(seconds===0){clearInterval(timer);running=false;}},1000)};document.getElementById('pause').onclick=()=>{running=false;clearInterval(timer)};document.getElementById('reset').onclick=()=>{running=false;clearInterval(timer);seconds=25*60;draw()}};draw();",
            },
        },
    },
    {
        "id": "demo_weather_card",
        "name": "Weather Insight Card",
        "description": "A city weather dashboard with local mock dataset and trend hints.",
        "tech_stack": ["HTML", "CSS", "JavaScript"],
        "difficulty": "beginner",
        "subjects": ["Earth Science", "Data Literacy"],
        "grade_range": "10-18",
        "tags": ["weather", "data", "visualization"],
        "display_mode": "static",
        "iframe_url": "",
        "screenshots": [],
        "demo_video_url": "",
        "project_breakdown": (
            "Goal: read and compare weather indicators.\n"
            "Core modules: city selector, weather rendering, trend notes.\n"
            "Extension ideas: line chart, more cities, severe weather alerts."
        ),
        "minimal_replica": {
            "entry_file": "src/main.js",
            "files": {
                "index.html": "<!doctype html><html><head><meta charset='UTF-8'><title>Weather Insight Card</title><link rel='stylesheet' href='./src/style.css'></head><body><div id='app'></div><script type='module' src='./src/main.js'></script></body></html>",
                "src/style.css": "body{font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px}.panel{background:#111827;border-radius:12px;padding:16px;max-width:600px}select{margin:8px 0;padding:8px;border-radius:8px}",
                "src/main.js": "const weather={Beijing:{temp:23,humidity:38,wind:4},Shanghai:{temp:26,humidity:61,wind:5},Shenzhen:{temp:29,humidity:74,wind:3}};const app=document.getElementById('app');const render=(city='Beijing')=>{const d=weather[city];app.innerHTML=`<div class='panel'><h2>Weather Insight Card</h2><label>City <select id='city'>${Object.keys(weather).map(c=>`<option ${c===city?'selected':''}>${c}</option>`).join('')}</select></label><p>Temperature: ${d.temp} C</p><p>Humidity: ${d.humidity}%</p><p>Wind: ${d.wind} m/s</p></div>`;document.getElementById('city').onchange=(e)=>render(e.target.value)};render();",
            },
        },
    },
    {
        "id": "demo_task_board",
        "name": "Learning Task Board",
        "description": "A kanban-style board for planning STEM project tasks by stage.",
        "tech_stack": ["HTML", "CSS", "JavaScript"],
        "difficulty": "intermediate",
        "subjects": ["Computer Science", "Project Management"],
        "grade_range": "10-18",
        "tags": ["kanban", "planning", "workflow"],
        "display_mode": "static",
        "iframe_url": "",
        "screenshots": [],
        "demo_video_url": "",
        "project_breakdown": (
            "Goal: organize project execution using columns.\n"
            "Core modules: add task, move task, save in local storage.\n"
            "Extension ideas: priority labels, deadlines, owner assignment."
        ),
        "minimal_replica": {
            "entry_file": "src/main.js",
            "files": {
                "index.html": "<!doctype html><html><head><meta charset='UTF-8'><title>Learning Task Board</title><link rel='stylesheet' href='./src/style.css'></head><body><div id='app'></div><script type='module' src='./src/main.js'></script></body></html>",
                "src/style.css": "body{font-family:Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:16px}.board{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.col{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px}.task{padding:8px;border-radius:8px;background:#e0f2fe;margin-top:8px}",
                "src/main.js": "const data={Todo:['Pick topic'],Doing:['Build MVP'],Done:['Share result']};const app=document.getElementById('app');const draw=()=>{app.innerHTML=`<h2>Learning Task Board</h2><div class='board'>${Object.entries(data).map(([k,v])=>`<div class='col'><h3>${k}</h3>${v.map(t=>`<div class='task'>${t}</div>`).join('')}<button data-col='${k}'>Add</button></div>`).join('')}</div>`;app.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{const name=prompt('Task name');if(!name)return;data[btn.dataset.col].push(name);draw();});};draw();",
            },
        },
    },
]
SEED_DEMOS_BY_ID: dict[str, dict[str, object]] = {str(item["id"]): item for item in SEED_DEMOS}


def get_seed_template(demo_id: str) -> dict[str, object]:
    item = SEED_DEMOS_BY_ID.get(demo_id)
    if not item:
        return {}
    template = item.get("minimal_replica", {})
    return template if isinstance(template, dict) else {}


def _to_schema(model: DemoModel) -> Demo:
    return Demo(
        id=model.id,
        name=model.name,
        description=model.description,
        tech_stack=json_loads(model.tech_stack, []),
        difficulty=model.difficulty,
        subjects=json_loads(model.subjects, []),
        grade_range=model.grade_range or "10-18岁",
        tags=json_loads(model.tags, []),
        display_mode=model.display_mode,
        iframe_url=model.iframe_url,
        screenshots=json_loads(model.screenshots, []),
        demo_video_url=model.demo_video_url,
        project_breakdown=model.project_breakdown,
        minimal_replica=model.minimal_replica,
        code_url=model.code_url,
        download_url=model.download_url,
        fork_template_id=model.fork_template_id or f"fork-{model.id}",
        is_public=model.is_public,
        submitted_at=model.submitted_at,
        created_at=model.created_at,
        created_by=model.created_by,
        updated_at=model.updated_at,
        updated_by=model.updated_by,
        deleted_at=model.deleted_at,
        deleted_by=model.deleted_by,
        is_deleted=model.is_deleted,
    )


class DemoRepo(BaseRepository):
    def _ensure_seed_demos(self) -> None:
        existing_ids = {
            item.id
            for item in self.db.query(DemoModel.id).filter(DemoModel.is_deleted.is_(False)).all()
        }
        now = datetime.utcnow()
        inserted = False
        for item in SEED_DEMOS:
            demo_id = str(item["id"])
            if demo_id in existing_ids:
                continue
            model = DemoModel(
                id=demo_id,
                name=str(item["name"]),
                description=str(item["description"]),
                tech_stack=json_dumps(item.get("tech_stack", []), default="[]"),
                difficulty=str(item.get("difficulty", "beginner")),
                subjects=json_dumps(item.get("subjects", []), default="[]"),
                grade_range=str(item.get("grade_range", "10-18岁")),
                tags=json_dumps(item.get("tags", []), default="[]"),
                display_mode=str(item.get("display_mode", "static")),
                iframe_url=str(item.get("iframe_url", "")) or None,
                screenshots=json_dumps(item.get("screenshots", []), default="[]"),
                demo_video_url=str(item.get("demo_video_url", "")) or None,
                project_breakdown=str(item.get("project_breakdown", "")) or None,
                minimal_replica=json_dumps(item.get("minimal_replica", {}), default="{}"),
                code_url=f"/api/v1/demos/{item['id']}/fork-template",
                download_url=f"/api/v1/demos/{item['id']}/fork-template",
                fork_template_id=f"fork-{demo_id}",
                is_public=bool(item.get("is_public", True)),
                submitted_at=now,
                created_at=now,
                created_by="system",
                updated_at=now,
                updated_by="system",
                deleted_at=None,
                deleted_by=None,
                is_deleted=False,
            )
            self.db.add(model)
            inserted = True
        if inserted:
            self.db.commit()

    def get_demo(self, demo_id: str) -> Demo | None:
        self._ensure_seed_demos()
        model = self.db.get(DemoModel, demo_id)
        if not model or model.is_deleted:
            return None
        return _to_schema(model)

    def list_demos(
        self,
        skip: int = 0,
        limit: int = 100,
        subject: str | None = None,
        difficulty: str | None = None,
        tech_stack: str | None = None,
        search: str | None = None,
    ) -> list[Demo]:
        self._ensure_seed_demos()
        rows = self.db.query(DemoModel).filter(DemoModel.is_deleted.is_(False)).all()
        if subject:
            rows = [item for item in rows if subject in json_loads(item.subjects, [])]
        if difficulty:
            rows = [item for item in rows if item.difficulty == difficulty]
        if tech_stack:
            key = tech_stack.lower()
            rows = [item for item in rows if any(key in tech.lower() for tech in json_loads(item.tech_stack, []))]
        if search:
            key = search.lower()
            rows = [item for item in rows if key in item.name.lower() or key in item.description.lower()]
        return [_to_schema(item) for item in rows[skip : skip + limit]]

    def count_demos(
        self,
        subject: str | None = None,
        difficulty: str | None = None,
        tech_stack: str | None = None,
        search: str | None = None,
    ) -> int:
        self._ensure_seed_demos()
        return len(self.list_demos(0, 100000, subject=subject, difficulty=difficulty, tech_stack=tech_stack, search=search))

    def create_demo(self, demo: Demo) -> Demo:
        model = DemoModel(
            id=demo.id,
            name=demo.name,
            description=demo.description,
            tech_stack=json_dumps(demo.tech_stack, default="[]"),
            difficulty=demo.difficulty,
            subjects=json_dumps(demo.subjects, default="[]"),
            grade_range=demo.grade_range,
            tags=json_dumps(demo.tags, default="[]"),
            display_mode=demo.display_mode,
            iframe_url=demo.iframe_url,
            screenshots=json_dumps(demo.screenshots, default="[]"),
            demo_video_url=demo.demo_video_url,
            project_breakdown=demo.project_breakdown,
            minimal_replica=demo.minimal_replica,
            code_url=demo.code_url,
            download_url=demo.download_url,
            fork_template_id=demo.fork_template_id,
            is_public=demo.is_public,
            submitted_at=demo.submitted_at,
            created_at=demo.created_at,
            created_by=demo.created_by,
            updated_at=demo.updated_at,
            updated_by=demo.updated_by,
            deleted_at=demo.deleted_at,
            deleted_by=demo.deleted_by,
            is_deleted=demo.is_deleted,
        )
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return _to_schema(model)

    def update_demo(self, demo_id: str, demo_data: dict) -> Demo | None:
        self._ensure_seed_demos()
        model = self.db.get(DemoModel, demo_id)
        if not model or model.is_deleted:
            return None

        list_fields = {"tech_stack", "subjects", "tags", "screenshots"}
        for key, value in demo_data.items():
            if value is None or not hasattr(model, key):
                continue
            if key in list_fields:
                setattr(model, key, json_dumps(value, default="[]"))
            else:
                setattr(model, key, value)

        model.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(model)
        return _to_schema(model)
