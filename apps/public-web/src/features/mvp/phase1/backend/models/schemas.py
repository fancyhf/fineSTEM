from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Union

# --- Track A 模型定义 ---
class PendulumArm(BaseModel):
    length: float = Field(..., ge=50, le=400)
    mass: float = Field(..., ge=1, le=50)
    initialAngle: float

class SimulationConfig(BaseModel):
    gravity: float = Field(1.0, ge=0.0, le=2.0)
    frictionAir: float = Field(0.005, ge=0.0, le=0.1)
    length1: float
    length2: float
    mass1: float
    mass2: float
    initialAngle1: float
    initialAngle2: float
    trailLength: int = 200
    colorMode: str = "neon"

class ConfigExport(BaseModel):
    meta: Dict[str, str]
    config: SimulationConfig

# --- Track E Models ---
class SeriesData(BaseModel):
    name: str
    value: float
    rank: Optional[int] = None

class VisualizationDataset(BaseModel):
    meta: Dict[str, str]
    timeline: List[str]
    categories: List[str]
    series: Dict[str, List[Dict[str, Union[float, str, int]]]] # 为 Pydantic 简化的类型定义
