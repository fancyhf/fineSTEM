from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import track_a, track_e

app = FastAPI(title="FineSTEM API", version="0.1.0")

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

@app.get("/")
def read_root():
    return {"message": "Welcome to FineSTEM API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
