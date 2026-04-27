"""
灰度开关服务

用途：提供功能开关和按用户百分比放量能力
维护者：AI Agent
"""

from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
from threading import Lock
from typing import Any, Dict

from app.core.config import settings


class FeatureFlagService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._flags: Dict[str, Dict[str, Any]] = {
            "agent_stream": {
                "enabled": settings.FF_AGENT_STREAM_ENABLED,
                "rollout_percent": settings.FF_AGENT_STREAM_ROLLOUT_PERCENT,
            },
            "agent_ws": {
                "enabled": settings.FF_AGENT_WS_ENABLED,
                "rollout_percent": settings.FF_AGENT_WS_ROLLOUT_PERCENT,
            },
            "skill_sandbox": {
                "enabled": settings.FF_SKILL_SANDBOX_ENABLED,
                "rollout_percent": settings.FF_SKILL_SANDBOX_ROLLOUT_PERCENT,
            },
            "provider_fallback": {
                "enabled": settings.FF_PROVIDER_FALLBACK_ENABLED,
                "rollout_percent": settings.FF_PROVIDER_FALLBACK_ROLLOUT_PERCENT,
            },
            "metrics_persistence": {
                "enabled": settings.FF_METRICS_PERSISTENCE_ENABLED,
                "rollout_percent": 100,
            },
        }
        self._path = Path(settings.AGENT_FEATURE_FLAGS_PATH)
        self._load_from_file()

    def _load_from_file(self) -> None:
        if not self._path.exists():
            return
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                return
            for key, value in data.items():
                if isinstance(value, dict) and key in self._flags:
                    self._flags[key]["enabled"] = bool(value.get("enabled", self._flags[key]["enabled"]))
                    rollout = int(value.get("rollout_percent", self._flags[key]["rollout_percent"]))
                    self._flags[key]["rollout_percent"] = max(0, min(100, rollout))
        except Exception:
            return

    def _in_rollout(self, user_id: str, percent: int) -> bool:
        if percent >= 100:
            return True
        if percent <= 0:
            return False
        bucket = int(sha256(user_id.encode("utf-8")).hexdigest(), 16) % 100
        return bucket < percent

    def is_enabled(self, flag: str, user_id: str | None = None) -> bool:
        with self._lock:
            value = self._flags.get(flag)
            if not value:
                return False
            if not bool(value.get("enabled", False)):
                return False
            if user_id:
                return self._in_rollout(user_id, int(value.get("rollout_percent", 0)))
            return True

    def snapshot(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            return {key: dict(value) for key, value in self._flags.items()}


feature_flag_service = FeatureFlagService()
