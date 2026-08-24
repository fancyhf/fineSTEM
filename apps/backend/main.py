"""
fineSTEM API 主入口模块

用途：FastAPI 应用初始化与路由注册
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json

历史合并（2026-08-05）：
    原本存在两个入口文件 `apps/backend/main.py` 与 `apps/backend/app/main.py`，
    uvicorn 实际启动的是本文件（`main:app`），另一份已成死代码但被误维护。
    现将其中仍然必要的能力（建表、每日备份、seed user、system 路由）合并至此，
    并删除死代码文件，确保入口唯一。
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import (
    achievement_cards,
    agent,
    auth,
    capability_tags,
    chat,
    code_execution,
    courses,
    demos,
    documents,
    evidence,
    files,
    notifications,
    projects,
    show,
    skills,
    system,
)
from app.api.auth import get_password_hash
from app.core.config import settings
from app.db.database import Base, SessionLocal, engine
from app.db.models import UserModel


logger = logging.getLogger(__name__)

# 启动即建表：任何新增 SQLAlchemy 模型只要被 import 就会自动建表，
# 无需运行 alembic 或手工执行 SQL。
Base.metadata.create_all(bind=engine)


async def _daily_backup_loop() -> None:
    """
    每日在 BACKUP_HOUR 触发一次数据库备份。

    2026-07-18 事故修复：数据库是代码的唯一存储，损坏即永久丢失。
    本任务给数据库加一层磁盘冗余，保留最近 BACKUP_KEEP_DAYS 天。
    --reload 模式下文件改动会重建此任务，开发期可接受。
    """
    from app.services import backup_service

    while True:
        try:
            seconds = backup_service.compute_seconds_until_next_run()
            await asyncio.sleep(seconds)
            backup_service.run_scheduled_backup()
        except asyncio.CancelledError:
            logger.info("daily_backup_loop_cancelled")
            raise
        except Exception:
            logger.exception("daily_backup_loop_iteration_failed")
            # 失败不中断循环，等下一轮
            await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI 生命周期钩子：启动每日备份任务、退出时优雅取消。"""
    backup_task = None
    if settings.BACKUP_ENABLED:
        backup_task = asyncio.create_task(_daily_backup_loop())
        logger.info("daily_backup_loop_started hour=%d", settings.BACKUP_HOUR)
    yield
    if backup_task is not None:
        backup_task.cancel()
        try:
            await backup_task
        except asyncio.CancelledError:
            pass


def _ensure_seed_user() -> None:
    """空库场景下写入演示用户，便于首次登录与联调。"""
    session = SessionLocal()
    try:
        count = session.query(UserModel).count()
        if count == 0:
            demo_user = UserModel(
                id="demo-user-001",
                name="演示用户",
                email="demo@finestem.dev",
                password=get_password_hash("demo123456"),
                role="student",
                level=5,
                capability_tags='["python", "math", "physics"]',
            )
            session.add(demo_user)
            session.commit()
    finally:
        session.close()


_ensure_seed_user()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="fineSTEM API - 青少年 STEM 研学助手",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = settings.API_V1_STR
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(demos.router, prefix=API_PREFIX)
app.include_router(projects.router, prefix=API_PREFIX)
app.include_router(achievement_cards.router, prefix=API_PREFIX)
app.include_router(evidence.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)
app.include_router(skills.router, prefix=API_PREFIX)
app.include_router(agent.router, prefix=API_PREFIX)
app.include_router(documents.router, prefix=API_PREFIX)
app.include_router(files.router, prefix=API_PREFIX)
app.include_router(courses.router, prefix=API_PREFIX)
app.include_router(courses.router, prefix=f"{API_PREFIX}/course-library")
app.include_router(capability_tags.router, prefix=API_PREFIX)
app.include_router(code_execution.router, prefix=API_PREFIX)
app.include_router(system.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)

# 节目频道（Show 子系统，show.wostemstudio.site）只读接口
app.include_router(show.router, prefix=API_PREFIX)

# Show 内容静态资源（开发环境由后端直接服务；生产环境走 nginx location /content/）
# main.py 位于 apps/backend/，上溯 2 级到仓库根
_SHOW_CONTENT_DIR = settings.SHOW_CONTENT_DIR or str(
    Path(__file__).resolve().parents[2] / "content" / "show"
)
if Path(_SHOW_CONTENT_DIR).is_dir():
    app.mount("/content", StaticFiles(directory=_SHOW_CONTENT_DIR, html=True), name="show-content")

DEMOS_STATIC_DIR = os.environ.get("DEMOS_STATIC_DIR", r"D:\data\finestem\demos")
if os.path.isdir(DEMOS_STATIC_DIR):
    app.mount("/demos", StaticFiles(directory=DEMOS_STATIC_DIR), name="demos-static")

# AI 生成的封面图静态目录（匿名公开访问，用于灵感墙/精选/分享页）
MEDIA_STATIC_DIR = os.path.join(settings.STORAGE_BASE_PATH, "generated")
os.makedirs(MEDIA_STATIC_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_STATIC_DIR), name="media-static")

# 用户上传文件静态目录（匿名公开访问，用于成果卡封面/截图等）
UPLOADS_STATIC_DIR = os.path.join(settings.STORAGE_BASE_PATH, settings.STORAGE_UPLOAD_DIR)
os.makedirs(UPLOADS_STATIC_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_STATIC_DIR), name="uploads-static")


@app.get("/")
async def root():
    """根路径接口，返回应用基本信息。"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "message": "欢迎使用 fineSTEM API！",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """健康检查接口，用于监控服务状态。"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=settings.BACKEND_PORT, reload=True)
