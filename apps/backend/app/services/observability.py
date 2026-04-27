"""
Agent 观测服务

用途：记录调用指标，提供基础成功率与时延统计
维护者：AI Agent
"""

import json
from pathlib import Path
from threading import Lock
from typing import Dict, List

from app.core.config import settings
from app.services.feature_flags import feature_flag_service


class AgentObservabilityService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._total_requests = 0
        self._success_requests = 0
        self._error_requests = 0
        self._latency_ms: List[int] = []
        self._storage_path = Path(settings.AGENT_METRICS_STORAGE_PATH)
        self._restore()

    def record(self, success: bool, latency_ms: int) -> None:
        with self._lock:
            self._total_requests += 1
            if success:
                self._success_requests += 1
            else:
                self._error_requests += 1
            self._latency_ms.append(latency_ms)
            if len(self._latency_ms) > 2000:
                self._latency_ms = self._latency_ms[-2000:]
            if feature_flag_service.is_enabled("metrics_persistence"):
                self._persist()

    def snapshot(self) -> Dict[str, float | int]:
        with self._lock:
            latencies = sorted(self._latency_ms)
            p95 = self._percentile(latencies, 95)
            p99 = self._percentile(latencies, 99)
            success_rate = (self._success_requests / self._total_requests * 100) if self._total_requests else 0
            return {
                "total_requests": self._total_requests,
                "success_requests": self._success_requests,
                "error_requests": self._error_requests,
                "success_rate": round(success_rate, 2),
                "p95_ms": p95,
                "p99_ms": p99,
            }

    def _restore(self) -> None:
        if not self._storage_path.exists():
            return
        try:
            data = json.loads(self._storage_path.read_text(encoding="utf-8"))
            self._total_requests = int(data.get("total_requests", 0))
            self._success_requests = int(data.get("success_requests", 0))
            self._error_requests = int(data.get("error_requests", 0))
            raw_latencies = data.get("latency_ms", [])
            if isinstance(raw_latencies, list):
                self._latency_ms = [int(item) for item in raw_latencies[-2000:]]
        except Exception:
            return

    def _persist(self) -> None:
        payload = {
            "total_requests": self._total_requests,
            "success_requests": self._success_requests,
            "error_requests": self._error_requests,
            "latency_ms": self._latency_ms[-2000:],
        }
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._storage_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _percentile(self, values: List[int], percentile: int) -> int:
        if not values:
            return 0
        index = int((len(values) - 1) * (percentile / 100))
        return values[index]


agent_observability_service = AgentObservabilityService()
