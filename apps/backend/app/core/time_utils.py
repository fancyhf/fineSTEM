"""
UTC 时间工具

用途：统一生成带时区的 UTC 时间与字符串，避免使用已弃用的 datetime.utcnow()
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from datetime import datetime, timezone


def utc_now() -> datetime:
    """返回带 UTC 时区的当前时间。"""
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    """返回 ISO 8601 格式的 UTC 时间字符串。"""
    return utc_now().isoformat()


def utc_now_millis_z() -> str:
    """返回毫秒精度、以 Z 结尾的 UTC 时间字符串。"""
    return utc_now().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
