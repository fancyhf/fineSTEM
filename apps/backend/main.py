"""
fineSTEM API 主入口模块

用途：FastAPI 应用初始化与路由注册
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api import demos, projects, auth, achievement_cards, evidence, chat, skills, agent, documents, files, courses, code_execution, capability_tags
import os

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="fineSTEM API - 青少年 STEM 研学助手",
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

DEMOS_STATIC_DIR = os.environ.get("DEMOS_STATIC_DIR", r"D:\data\finestem\demos")
if os.path.isdir(DEMOS_STATIC_DIR):
    app.mount("/demos", StaticFiles(directory=DEMOS_STATIC_DIR), name="demos-static")


@app.get("/")
async def root():
    """
    根路径接口，返回应用基本信息

    返回：应用名称、版本、欢迎消息、文档链接
    """
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "message": "欢迎使用 fineSTEM API！",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """
    健康检查接口，用于监控服务状态

    返回：健康状态
    """
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.BACKEND_PORT, reload=True)
