from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import track_a, track_e, analytics, chat
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(".env.development")

# 从环境变量获取 root_path 以支持反向代理
root_path = os.getenv("ROOT_PATH", "")

app = FastAPI(title="FineSTEM API", version="0.1.0", root_path=root_path)

# CORS 设置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中，指定前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(track_a.router)
app.include_router(track_e.router)
app.include_router(chat.router)
app.include_router(analytics.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

# 如果存在 dist 目录（生产模式），则挂载静态文件
# 必须放在 API 路由之后
dist_path = os.path.join(os.path.dirname(__file__), "../web/dist")
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
else:
    @app.get("/")
    def read_root():
        return {"message": "欢迎使用 FineSTEM API。请构建前端到 ../web/dist 以查看 UI。"}
