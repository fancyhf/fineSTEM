from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel


def _to_json_safe(value: Any) -> Any:
    """递归转换为 JSON 安全对象，禁止嵌套 Pydantic 对象被 default=str 写坏。"""
    if isinstance(value, BaseModel):
        return _to_json_safe(value.model_dump(mode="json"))
    if isinstance(value, dict):
        return {str(key): _to_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_json_safe(item) for item in value]
    return value


def json_dumps(value: Any, default: str = "{}") -> str:
    if value is None:
        return default
    value = _to_json_safe(value)
    return json.dumps(value, ensure_ascii=False, default=str)


def json_loads(raw: str | None, default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default
