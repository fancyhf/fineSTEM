"""
fineSTEM API 主入口模块

用途：FastAPI 应用初始化与路由注册
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import demos, projects, auth, achievement_cards, evidence, chat, skills, agent
from app.api import (
    assistant_dialogues,
    audit_logs,
    course_library,
    documents,
    files,
    hongkong_macao,
    international_admissions,
    knowledge_sources,
    profile_enhancement,
    questionnaire_engine,
)

# 创建 FastAPI 应用实例
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="fineSTEM API - 青少年 STEM 研学助手",
)

# 配置 CORS 中间件，允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由
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
app.include_router(hongkong_macao.router, prefix=API_PREFIX)
app.include_router(international_admissions.router, prefix=API_PREFIX)
app.include_router(profile_enhancement.router, prefix=API_PREFIX)
app.include_router(knowledge_sources.router, prefix=API_PREFIX)
app.include_router(questionnaire_engine.router, prefix=API_PREFIX)
app.include_router(assistant_dialogues.router, prefix=API_PREFIX)
app.include_router(audit_logs.router, prefix=API_PREFIX)
app.include_router(files.router, prefix=API_PREFIX)
app.include_router(course_library.router, prefix=API_PREFIX)
app.include_router(course_library.cap_router, prefix=API_PREFIX)


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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
