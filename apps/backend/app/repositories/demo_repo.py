from __future__ import annotations

from datetime import datetime
import json

from app.db.models import DemoModel
from app.repositories.base import BaseRepository
from app.repositories.utils import json_dumps, json_loads
from app.schemas.demos import Demo

SEED_DEMOS: list[dict[str, object]] = [
    {
        "id": "demo_poetry_card",
        "name": "文学知识卡",
        "description": "二次元漫画风格的古诗词学习应用，卡片式浏览、搜索筛选、收藏管理，还能 AI 生成二次元插画。",
        "tech_stack": ["Python", "Flask", "HTML", "CSS", "JavaScript"],
        "difficulty": "beginner",
        "subjects": ["文学", "AI应用"],
        "grade_range": "13-15岁",
        "tags": ["诗词", "卡片", "AI插画", "Flask"],
        "display_mode": "static",
        "iframe_url": "",
        "screenshots": ["/demos/demo_poetry_card/screenshots/01-home.png", "/demos/demo_poetry_card/screenshots/02-card-flip.png", "/demos/demo_poetry_card/screenshots/03-stats.png"],
        "demo_video_url": "",
        "project_breakdown": (
            "目标：做一个能浏览、搜索、收藏古诗词的卡片式应用。\n"
            "核心模块：诗词卡片展示与翻转、分类筛选与搜索、收藏管理、AI 二次元插画生成。\n"
            "技术要点：Flask 路由与模板渲染、JSON 数据持久化、SiliconFlow API 图像生成。\n"
            "扩展方向：诗词背诵测验、社区分享、语音朗读。"
        ),
        "minimal_replica": {
            "entry_file": "index.html",
            "files": {
                "index.html": "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='UTF-8'><title>文学知识卡</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:linear-gradient(135deg,#fce4ec,#f3e5f5);min-height:100vh;padding:1rem}.container{max-width:900px;margin:0 auto}header{text-align:center;margin-bottom:1.5rem}h1{color:#6a1b9a;font-size:1.8rem}.search{width:100%;padding:.6rem;border:2px solid #ce93d8;border-radius:20px;font-size:.9rem;margin-bottom:1rem;outline:none}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}.card{background:#fff;border-radius:12px;padding:1rem;box-shadow:0 2px 8px rgba(0,0,0,.1);cursor:pointer;transition:transform .2s}.card:hover{transform:translateY(-4px)}.card h3{color:#6a1b9a;font-size:1rem;margin-bottom:.3rem}.card .author{color:#9c27b0;font-size:.8rem;margin-bottom:.5rem}.card .content{color:#424242;font-size:.85rem;line-height:1.5}.badge{display:inline-block;background:#e1bee7;color:#6a1b9a;padding:.15rem .5rem;border-radius:10px;font-size:.7rem;margin-bottom:.5rem}.fav{color:#f44336;font-size:1.2rem;float:right;cursor:pointer}</style></head><body><div class='container'><header><h1>文学知识卡</h1><p style='color:#9c27b0'>二次元漫画风格古诗词学习</p></header><input class='search' placeholder='搜索诗词、作者...' oninput='filter(this.value)'><div class='cards' id='cards'></div></div><script>const data=[{id:1,title:'静夜思',author:'李白 · 唐',content:'床前明月光，疑是地上霜。举头望明月，低头思故乡。',cat:'唐诗',fav:false},{id:2,title:'春晓',author:'孟浩然 · 唐',content:'春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。',cat:'唐诗',fav:false},{id:3,title:'登鹳雀楼',author:'王之涣 · 唐',content:'白日依山尽，黄河入海流。欲穷千里目，更上一层楼。',cat:'唐诗',fav:false},{id:4,title:'水调歌头',author:'苏轼 · 宋',content:'明月几时有？把酒问青天。不知天上宫阙，今夕是何年。',cat:'宋词',fav:false}];function render(list){document.getElementById('cards').innerHTML=list.map(p=>`<div class='card'><span class='fav' onclick='event.stopPropagation();toggleFav(${p.id})'>${p.fav?'★':'☆'}</span><span class='badge'>${p.cat}</span><h3>${p.title}</h3><p class='author'>${p.author}</p><p class='content'>${p.content}</p></div>`).join('')}function filter(q){q=q.toLowerCase();render(data.filter(p=>p.title.toLowerCase().includes(q)||p.author.toLowerCase().includes(q)||p.content.toLowerCase().includes(q)))}function toggleFav(id){const p=data.find(x=>x.id===id);if(p)p.fav=!p.fav;filter(document.querySelector('.search').value)}render(data)</script></body></html>",
            },
        },
    },
    {
        "id": "demo_video_analyzer",
        "name": "UP主视频内容分析器",
        "description": "上传视频字幕或输入B站链接，AI 自动生成词云、统计分析和内容总结，支持导出报告。",
        "tech_stack": ["Python", "Streamlit", "jieba", "wordcloud", "matplotlib"],
        "difficulty": "intermediate",
        "subjects": ["数据科学", "AI应用"],
        "grade_range": "高中",
        "tags": ["词云", "数据分析", "Streamlit", "B站"],
        "display_mode": "static",
        "iframe_url": "",
        "screenshots": ["/demos/demo_video_analyzer/screenshots/01-upload.png", "/demos/demo_video_analyzer/screenshots/02-wordcloud.png", "/demos/demo_video_analyzer/screenshots/03-stats.png"],
        "demo_video_url": "",
        "project_breakdown": (
            "目标：分析视频字幕文本，生成词云与统计报告。\n"
            "核心模块：字幕上传与B站链接提取、jieba 中文分词与词频统计、wordcloud 词云可视化、AI 智能总结。\n"
            "技术要点：Streamlit 交互式界面、pandas 数据处理、matplotlib 图表渲染。\n"
            "扩展方向：多视频对比分析、情感分析、时间轴关键词分布。"
        ),
        "minimal_replica": {
            "entry_file": "index.html",
            "files": {
                "index.html": "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='UTF-8'><title>词频分析器</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:1.5rem}.container{max-width:800px;margin:0 auto}h1{color:#38bdf8;margin-bottom:.5rem}textarea{width:100%;height:120px;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:.75rem;font-size:.9rem;margin-bottom:.75rem;resize:vertical}button{background:#38bdf8;color:#0f172a;border:none;padding:.6rem 1.5rem;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer;margin-bottom:1rem}.result{background:#1e293b;border-radius:12px;padding:1rem;margin-bottom:1rem}.bar-row{display:flex;align-items:center;margin-bottom:.4rem}.bar-label{width:60px;text-align:right;margin-right:.5rem;font-size:.8rem;color:#94a3b8}.bar{height:20px;background:linear-gradient(90deg,#38bdf8,#818cf8);border-radius:4px;min-width:2px}.bar-val{margin-left:.5rem;font-size:.8rem;color:#94a3b8}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-top:1rem}.stat{background:#1e293b;border-radius:8px;padding:.75rem;text-align:center}.stat .num{font-size:1.5rem;font-weight:700;color:#38bdf8}.stat .label{font-size:.75rem;color:#94a3b8}</style></head><body><div class='container'><h1>词频分析器</h1><p style='color:#94a3b8;margin-bottom:1rem'>粘贴文本，一键分析高频词</p><textarea id='text' placeholder='在这里粘贴字幕或文本内容...'></textarea><button onclick='analyze()'>分析</button><div id='output'></div></div><script>function analyze(){const text=document.getElementById('text').value;if(!text.trim()){document.getElementById('output').innerHTML='<p style=color:#f87171>请先输入文本</p>';return}const seg=text.match(/[\\u4e00-\\u9fff]{2,}/g)||[];const freq={};seg.forEach(w=>freq[w]=(freq[w]||0)+1);const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,20);const max=sorted[0][1];const totalChars=text.length;const uniqueWords=Object.keys(freq).length;document.getElementById('output').innerHTML=`<div class='stats'><div class='stat'><div class='num'>${totalChars}</div><div class='label'>总字符数</div></div><div class='stat'><div class='num'>${uniqueWords}</div><div class='label'>不同词语</div></div><div class='stat'><div class='num'>${sorted.length}</div><div class='label'>高频词数</div></div></div><div class='result' style='margin-top:1rem'><h3 style='margin-bottom:.75rem;color:#38bdf8'>高频词 Top ${sorted.length}</h3>${sorted.map(([w,c])=>`<div class='bar-row'><span class='bar-label'>${w}</span><div class='bar' style='width:${Math.round(c/max*300)}px'></div><span class='bar-val'>${c}</span></div>`).join('')}</div>`}</script></body></html>",
            },
        },
    },
    {
        "id": "demo_smart_todo",
        "name": "智能待办清单",
        "description": "自动排序优先级的待办 App，根据重要性和紧急度智能排序，AI 帮你决定先做什么。",
        "tech_stack": ["HTML", "CSS", "JavaScript", "LocalStorage"],
        "difficulty": "beginner",
        "subjects": ["计算机科学", "产品设计"],
        "grade_range": "13-15岁",
        "tags": ["待办", "优先级排序", "LocalStorage", "前端"],
        "display_mode": "iframe",
        "iframe_url": "",
        "screenshots": ["/demos/demo_smart_todo/screenshots/01-main.png", "/demos/demo_smart_todo/screenshots/02-add-task.png"],
        "demo_video_url": "",
        "project_breakdown": (
            "目标：做一个能自动按优先级排序的待办清单应用。\n"
            "核心模块：任务添加（标题/描述/截止日期/重要性/紧急度）、优先级评分算法、任务完成与删除、LocalStorage 持久化。\n"
            "技术要点：优先级评分 = 重要性权重 + 紧急度权重 + 截止日期加成、CSS 优先级色标、响应式布局。\n"
            "扩展方向：AI 智能建议、任务分类标签、数据统计面板。"
        ),
        "minimal_replica": {
            "entry_file": "index.html",
            "files": {
                "index.html": "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='UTF-8'><title>智能待办清单</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;padding:2rem}.container{max-width:800px;margin:0 auto}header{text-align:center;color:#fff;margin-bottom:2rem}.task{background:#fff;padding:1rem;border-radius:12px;margin-bottom:.75rem;border-left:4px solid #ccc}.task.high{border-left-color:#f44336}.task.medium{border-left-color:#ff9800}.task.low{border-left-color:#4caf50}.badge{font-size:.75rem;padding:.2rem .5rem;border-radius:4px;font-weight:700;margin-right:.5rem}.add-btn{width:100%;padding:1rem;background:#4caf50;color:#fff;border:none;border-radius:8px;font-size:1.1rem;cursor:pointer;margin-bottom:1rem}</style></head><body><div class='container'><header><h1>智能待办清单</h1><p>AI 智能优先级排序</p></header><button class='add-btn' onclick='addTask()'>+ 添加新任务</button><div id='list'></div></div><script>let tasks=JSON.parse(localStorage.getItem('smart-todo-tasks')||'[]');function score(t){const i={high:3,medium:2,low:1};let s=i[t.importance]*10+i[t.urgency]*10;if(t.deadline){const d=Math.ceil((new Date(t.deadline)-Date.now())/864e5);if(d<=1)s+=50;else if(d<=3)s+=30;else if(d<=7)s+=10}return s}function label(s){return s>=70?'高':s>=40?'中':'低'}function cls(s){return s>=70?'high':s>=40?'medium':'low'}function render(){const sorted=[...tasks].sort((a,b)=>a.completed===b.completed?score(b)-score(a):a.completed?1:-1);document.getElementById('list').innerHTML=sorted.map(t=>{const s=score(t);return `<div class='task ${cls(s)}${t.completed?' style=\"opacity:.6\"':''}'><span class='badge'>${label(s)}</span><input type='checkbox' ${t.completed?'checked':''} onchange='toggle(\"${t.id}\")'> <b>${t.title}</b> <button onclick='del(\"${t.id}\")' style='float:right;color:#f44336;border:none;background:none;cursor:pointer'>删除</button></div>`}).join('')}function addTask(){const title=prompt('任务标题');if(!title)return;tasks.push({id:Date.now().toString(),title,description:'',deadline:'',importance:'medium',urgency:'medium',completed:false,createdAt:Date.now()});localStorage.setItem('smart-todo-tasks',JSON.stringify(tasks));render()}function toggle(id){const t=tasks.find(x=>x.id===id);if(t)t.completed=!t.completed;localStorage.setItem('smart-todo-tasks',JSON.stringify(tasks));render()}function del(id){tasks=tasks.filter(x=>x.id!==id);localStorage.setItem('smart-todo-tasks',JSON.stringify(tasks));render()}render()</script></body></html>",
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
        seed_ids = {str(item["id"]) for item in SEED_DEMOS}
        stale_ids = existing_ids - seed_ids
        now = datetime.utcnow()
        if stale_ids:
            self.db.query(DemoModel).filter(
                DemoModel.id.in_(stale_ids),
                DemoModel.created_by == "system",
            ).update({DemoModel.is_deleted: True, DemoModel.deleted_at: now, DemoModel.deleted_by: "system"}, synchronize_session=False)
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
        if inserted or stale_ids:
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
