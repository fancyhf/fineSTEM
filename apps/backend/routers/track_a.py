from fastapi import APIRouter, HTTPException
from models.schemas import SimulationConfig, ConfigExport
import json
import os
from datetime import datetime

router = APIRouter(prefix="/track-a", tags=["Track A"])

DATA_DIR = "data"

@router.post("/config/export")
async def export_config(config: SimulationConfig):
    export_data = {
        "meta": {
            "version": "1.0.0",
            "exportedAt": datetime.utcnow().isoformat(),
            "author": "FineSTEM User"
        },
        "config": config.dict()
    }
    
    # Ensure data directory exists
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Save to file (timestamped)
    filename = f"config_{int(datetime.now().timestamp())}.json"
    filepath = os.path.join(DATA_DIR, filename)
    
    with open(filepath, "w") as f:
        json.dump(export_data, f, indent=2)
        
    return {"status": "success", "filename": filename, "data": export_data}

@router.get("/config/latest")
async def get_latest_config():
    # In a real app, we'd query DB. Here, list files and pick newest.
    try:
        if not os.path.exists(DATA_DIR):
            return {"message": "No configs found"}
            
        files = [f for f in os.listdir(DATA_DIR) if f.startswith("config_")]
        if not files:
            return {"message": "No configs found"}
            
        latest_file = max(files, key=lambda f: os.path.getctime(os.path.join(DATA_DIR, f)))
        
        with open(os.path.join(DATA_DIR, latest_file), "r") as f:
            data = json.load(f)
            
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
