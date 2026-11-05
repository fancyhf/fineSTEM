"""
文本编码校验工具

用途：在证据与过程文档写入前保证文本可严格编码为 UTF-8
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""


def ensure_utf8_text(value: str, field_name: str = "文本") -> str:
    """校验并原样返回 UTF-8 可编码文本，不尝试猜测或修复历史编码。"""
    if not isinstance(value, str):
        raise TypeError(f"{field_name}必须是字符串")
    try:
        value.encode("utf-8", errors="strict")
    except UnicodeEncodeError as exc:
        raise ValueError(f"{field_name}必须可编码为 UTF-8") from exc
    return value
