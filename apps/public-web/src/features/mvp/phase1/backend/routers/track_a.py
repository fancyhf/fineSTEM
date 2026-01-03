from fastapi import APIRouter, HTTPException
from models.schemas import SimulationConfig, ConfigExport
import json
import os
from datetime import datetime

router = APIRouter(prefix="/track-a", tags=["Track A"])

DATA_DIR = "data"

@router.post("/config/export")
async def export_config(config: SimulationConfig):
    """
    导出当前的模拟配置。

    职责：
    - 接收前端传递的 SimulationConfig 对象
    - 附加元数据（版本、导出时间、作者）
    - 将配置保存为 JSON 文件到 data 目录

    Args:
        config (SimulationConfig): 包含物理参数的配置对象

    Returns:
        dict: 包含状态、文件名和完整导出数据的字典
    """
    export_data = {
        "meta": {
            "version": "1.0.0",
            "exportedAt": datetime.utcnow().isoformat(),
            "author": "FineSTEM 用户"
        },
        "config": config.dict()
    }
    
    # 确保数据目录存在
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # 保存到文件（使用时间戳命名）
    filename = f"config_{int(datetime.now().timestamp())}.json"
    filepath = os.path.join(DATA_DIR, filename)
    
    with open(filepath, "w") as f:
        json.dump(export_data, f, indent=2)
        
    return {"status": "success", "filename": filename, "data": export_data, "message": "配置导出成功"}

@router.get("/config/latest")
async def get_latest_config():
    """
    获取最新的模拟配置。

    职责：
    - 扫描 data 目录下的配置文件
    - 按创建时间查找最新的文件
    - 读取并返回配置内容

    Returns:
        dict: 最新的配置数据

    Raises:
        HTTPException: 
            - 500: 读取文件失败或发生其他未知错误
    """
    # 在真实应用中，我们会查询数据库。这里仅列出文件并选取最新的一个。
    try:
        if not os.path.exists(DATA_DIR):
            return {"message": "未找到任何配置文件"}
            
        files = [f for f in os.listdir(DATA_DIR) if f.startswith("config_")]
        if not files:
            return {"message": "未找到任何配置文件"}
            
        latest_file = max(files, key=lambda f: os.path.getctime(os.path.join(DATA_DIR, f)))
        
        with open(os.path.join(DATA_DIR, latest_file), "r") as f:
            data = json.load(f)
            
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取最新配置失败: {str(e)}")
