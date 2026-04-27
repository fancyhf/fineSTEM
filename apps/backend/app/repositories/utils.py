from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel


def json_dumps(value: Any, default: str = "{}") -> str:
    if value is None:
        return default
    if isinstance(value, BaseModel):
        value = value.model_dump(mode="json")
    return json.dumps(value, ensure_ascii=False, default=str)


def json_loads(raw: str | None, default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default
