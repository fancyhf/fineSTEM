"""ZeroClaw WebSocket 测试脚本的公共 token 读取。

token 不再硬编码在各个脚本里（避免密钥散落）。读取顺序：
1. 环境变量 ZC_WS_TOKEN
2. apps/frontend/.env.development 的 VITE_ZC_TOKEN（本地开发 token 的存放点）
"""
from pathlib import Path
import os


def load_zc_token() -> str:
    token = os.environ.get("ZC_WS_TOKEN", "").strip()
    if token:
        return token
    env_path = Path(__file__).resolve().parents[2] / "frontend" / ".env.development"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if line.startswith("VITE_ZC_TOKEN="):
                token = line.split("=", 1)[1].strip()
                if token:
                    return token
    raise SystemExit(
        "未找到 ZeroClaw token：请设置环境变量 ZC_WS_TOKEN，"
        "或在 apps/frontend/.env.development 配置 VITE_ZC_TOKEN"
    )
