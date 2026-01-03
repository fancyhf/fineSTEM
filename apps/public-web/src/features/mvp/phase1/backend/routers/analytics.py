from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Dict, Any, Optional

router = APIRouter(prefix="/analytics", tags=["Analytics"])

class EventLog(BaseModel):
    event_name: str
    category: str  # 例如: "track_a", "track_e", "general"
    metadata: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None

# MVP 阶段使用内存存储。生产环境请使用数据库。
events_db = []

@router.post("/events")
async def log_event(event: EventLog):
    if not event.timestamp:
        event.timestamp = datetime.utcnow().isoformat()
    
    events_db.append(event.dict())
    print(f"[分析] {event.timestamp} - {event.category}: {event.event_name} | {event.metadata}")
    return {"status": "logged", "count": len(events_db)}

@router.get("/summary")
async def get_summary():
    # 简单的聚合统计
    summary = {}
    for e in events_db:
        cat = e['category']
        name = e['event_name']
        if cat not in summary:
            summary[cat] = {}
        if name not in summary[cat]:
            summary[cat][name] = 0
        summary[cat][name] += 1
    return summary
