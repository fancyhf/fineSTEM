from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import track_a, track_e, analytics, chat
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get root_path from environment variable for reverse proxy support
root_path = os.getenv("ROOT_PATH", "")

app = FastAPI(title="FineSTEM API", version="0.1.0", root_path=root_path)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend domain
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

# Mount static files if dist exists (Production mode)
# Must be placed after API routes
dist_path = os.path.join(os.path.dirname(__file__), "../web/dist")
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
else:
    @app.get("/")
    def read_root():
        return {"message": "Welcome to FineSTEM API. Build frontend to ../web/dist to see UI."}
