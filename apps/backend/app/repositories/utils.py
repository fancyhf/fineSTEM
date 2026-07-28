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


def json_loads(raw: str | None, default: Any, *, max_depth: int = 4) -> Any:
    """
    解析 JSON 字符串，返回非 JSON 类型。

    2026-07-27 修复：自动解开多层 JSON 编码（最多 max_depth 层）。
    背景：部分历史/AI 写入会把 dict 重复 json.dumps 多次（如项目 9b4ac464 的
    light_step_data 被编码 3 层），单次 json.loads 后仍是字符串，喂给要求 dict 的
    Pydantic 字段会触发 ValidationError → 接口 500。此处循环解码直到结果不再是
    JSON 字符串为止，保证返回值始终是最终的对象/标量类型。
    """
    if not raw:
        return default
    value: Any = raw
    for _ in range(max_depth):
        if not isinstance(value, str):
            break
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return default
    return value
