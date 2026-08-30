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
        "http://localhost:5185",
        "http://localhost:3200",
    ]
    
    # 数据库配置（MVP 阶段使用内存数据库）
    # 后续逐步切换到 SQLAlchemy ORM + Alembic
    DATABASE_URL: str = "sqlite:///D:/data/finestem/finestem.db"

    # 数据库自动备份配置（2026-07-18 事故修复：避免 .db 损坏导致代码永久丢失）
    BACKUP_ENABLED: bool = True
    BACKUP_DIR: str = "backups"            # 相对 STORAGE_BASE_PATH
    BACKUP_HOUR: int = 3                   # 每日触发点（本地时区，0-23）
    BACKUP_KEEP_DAYS: int = 14             # 旧备份保留天数

    # 项目完成自动导出资料包（2026-07-18 事故修复：让代码有第二份磁盘副本）
    AUTO_EXPORT_ON_COMPLETE: bool = True
    AUTO_EXPORT_DIR: str = "out"           # 相对项目根（git 追踪目录）
    
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

    # ── LLM API Keys —— 全项目唯一设置点：apps/backend/.env ──────────────────
    # 规范命名（新配置一律用这两个）：
    #   GLM_API_KEY      智谱 GLM：GLM-4V 截图识别、CogView 封面图、GLM 直连对话
    #   DEEPSEEK_API_KEY DeepSeek：直连对话回退链路
    # 旧命名 glm_key / deepseek_key 仅作兼容别名（model_post_init 自动映射）。
    # 注意：AI 聊天主链路的模型 key 存在 ZeroClaw daemon 的 config.toml（keyring
    # 加密），不在本文件——这里只管后端进程自己发起的 LLM 调用。
    GLM_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    # 旧命名（兼容保留，勿在新配置中使用）
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
    # 非高峰时段切换 DeepSeek（默认关闭=全程 qwen-plus；开启后非高峰用 deepseek-v4-flash）
    FF_OFFPEAK_DEEPSEEK_ENABLED: bool = False
    # 文件存储配置
    STORAGE_BASE_PATH: str = r"D:\data\finestem"
    STORAGE_UPLOAD_DIR: str = "uploads"
    STORAGE_PACKAGES_DIR: str = "packages"
    STORAGE_EXPORTS_DIR: str = "exports"
    STORAGE_INDEX_FILE: str = "file_index.json"

    # 节目频道（Know 子系统）内容目录：默认仓库 content/know，生产环境用环境变量
    # 指向 /opt/finestem/know/content
    KNOW_CONTENT_DIR: Optional[str] = None

    # JWT 配置（生产环境必须通过环境变量覆盖）
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    def model_post_init(self, __context) -> None:
        # LLM key 统一解析：规范命名优先，旧命名自动映射（只在一个地方设 key）
        self.GLM_API_KEY = self.GLM_API_KEY or self.glm_key
        self.DEEPSEEK_API_KEY = self.DEEPSEEK_API_KEY or self.deepseek_key
        # 直连回退链路（orchestrator，非主链路）：未单独配置 ZEROCLAW_API_KEY 时
        # 按 DeepSeek → GLM 顺延，并根据可用 key 推断 OpenAI 兼容端点
        if not self.ZEROCLAW_API_KEY and self.DEEPSEEK_API_KEY:
            self.ZEROCLAW_API_KEY = self.DEEPSEEK_API_KEY
        if not self.ZEROCLAW_API_KEY and self.GLM_API_KEY:
            self.ZEROCLAW_API_KEY = self.GLM_API_KEY
        if not self.ZEROCLAW_GATEWAY_URL and self.ZEROCLAW_API_KEY:
            if self.DEEPSEEK_API_KEY:
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
        # .env 允许存在未声明的变量（如备用 key 存档、部署模板注释项）
        extra="ignore",
    )


# 全局配置实例
settings = Settings()
