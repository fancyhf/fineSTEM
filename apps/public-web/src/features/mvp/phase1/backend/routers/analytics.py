from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Dict, Any, Optional

router = APIRouter(prefix="/analytics", tags=["Analytics"])

class EventLog(BaseModel):
    event_name: str
    category: str  # e.g., "track_a", "track_e", "general"
    metadata: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None

# In-memory storage for MVP. In production, use a database.
events_db = []

@router.post("/events")
async def log_event(event: EventLog):
    if not event.timestamp:
        event.timestamp = datetime.utcnow().isoformat()
    
    events_db.append(event.dict())
    print(f"[ANALYTICS] {event.timestamp} - {event.category}: {event.event_name} | {event.metadata}")
    return {"status": "logged", "count": len(events_db)}

@router.get("/summary")
async def get_summary():
    # Simple aggregation
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
