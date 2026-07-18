"""
应用配置模块

用途：加载环境变量与配置管理
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    """
    应用配置类
    
    从环境变量加载配置，提供默认值
    """
    APP_NAME: str = "fineSTEM API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    BACKEND_PORT: int = 3200

    CORS_ALLOW_ORIGINS: list[str] = [
        "http://localhost:5184",
        "http://localhost:3300",
    ]
    
    # 数据库配置（MVP 阶段使用内存数据库）
    # 后续逐步切换到 SQLAlchemy ORM + Alembic
    DATABASE_URL: str = "sqlite:///D:/data/finestem/finestem.db"
    
    # ZeroClaw Gateway 配置（真实 AI 必填）
    ZEROCLAW_GATEWAY_URL: Optional[str] = None
    ZEROCLAW_FALLBACK_GATEWAY_URL: Optional[str] = None
    ZEROCLAW_API_KEY: Optional[str] = None
    ZEROCLAW_DEFAULT_MODEL: str = "glm-5-turbo"
    ZEROCLAW_FALLBACK_MODEL: str = "qwen-plus"
    ZEROCLAW_LOCAL_SAFE_MODEL: str = "local-safe"
    ZEROCLAW_ENABLE_MOCK_FALLBACK: bool = False
    ZEROCLAW_TIMEOUT_SECONDS: int = 120
    ZEROCLAW_MAX_TOKENS: int = 16384
    glm_key: Optional[str] = None
    deepseek_key: Optional[str] = None
    AGENT_SKILL_TIMEOUT_MS: int = 15000
    AGENT_ALLOW_NETWORK_SKILL: bool = False
    AGENT_ALLOWED_FS_PATHS: list[str] = []
    AGENT_METRICS_STORAGE_PATH: str = str(Path("runtime") / "agent_metrics.json")
    AGENT_FEATURE_FLAGS_PATH: str = str(Path("runtime") / "feature_flags.json")

    # 灰度开关（默认可被 feature_flags.json 覆盖）
    FF_AGENT_STREAM_ENABLED: bool = True
    FF_AGENT_STREAM_ROLLOUT_PERCENT: int = 100
    FF_AGENT_WS_ENABLED: bool = True
    FF_AGENT_WS_ROLLOUT_PERCENT: int = 100
    FF_SKILL_SANDBOX_ENABLED: bool = True
    FF_SKILL_SANDBOX_ROLLOUT_PERCENT: int = 100
    FF_PROVIDER_FALLBACK_ENABLED: bool = True
    FF_PROVIDER_FALLBACK_ROLLOUT_PERCENT: int = 100
    FF_METRICS_PERSISTENCE_ENABLED: bool = True
    # 文件存储配置
    STORAGE_BASE_PATH: str = r"D:\data\finestem"
    STORAGE_UPLOAD_DIR: str = "uploads"
    STORAGE_PACKAGES_DIR: str = "packages"
    STORAGE_EXPORTS_DIR: str = "exports"
    STORAGE_INDEX_FILE: str = "file_index.json"

    # JWT 配置（生产环境必须通过环境变量覆盖）
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    def model_post_init(self, __context) -> None:
        if not self.ZEROCLAW_API_KEY and self.deepseek_key:
            self.ZEROCLAW_API_KEY = self.deepseek_key
        if not self.ZEROCLAW_API_KEY and self.glm_key:
            self.ZEROCLAW_API_KEY = self.glm_key
        if not self.ZEROCLAW_GATEWAY_URL and self.ZEROCLAW_API_KEY:
            if self.deepseek_key:
                self.ZEROCLAW_GATEWAY_URL = "https://api.deepseek.com/v1"
            else:
                self.ZEROCLAW_GATEWAY_URL = "https://open.bigmodel.cn/api/paas/v4"

        insecure_values = {
            "",
            "change-this-in-production",
            "please-change-this-secret-key",
            "dev-secret-key",
        }
        if not self.SECRET_KEY:
            if self.DEBUG:
                self.SECRET_KEY = "dev-secret-key"
            else:
                raise ValueError("SECRET_KEY 未正确配置：请在环境变量中设置强随机密钥")
        if not self.DEBUG and self.SECRET_KEY in insecure_values:
            raise ValueError("SECRET_KEY 未正确配置：生产环境必须使用强随机密钥")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )


# 全局配置实例
settings = Settings()
