# -*- coding: utf-8 -*-
"""
讲解文档（explanation 工件）累加写入服务。

设计（2026-07-31）：
- 讲解是持续的、累加的：每次沉淀以带时间戳的章节追加到同一份
  standard_step_data.explanation_content 文档，不整篇覆盖。
- 判重：新内容已存在于文档中（子串包含）则跳过，防止「保存为讲解」
  按钮双击 / AI 重复调用产生重复章节。
- 底层复用 pbl_engine.save_artifact（落盘 08_code_explanation.md +
  last_updated_at 维护），explanation 不在 ARTIFACT_FOR_STAGE 中，
  不触发阶段完成标记、不受阶段门禁约束。
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.services.pbl_engine import save_artifact
from app.services.stage_constants import ARTIFACT_TO_BLOB_KEY

logger = logging.getLogger(__name__)

EXPLANATION_BLOB_KEY = ARTIFACT_TO_BLOB_KEY["explanation"]

_DOC_HEADER = "# 讲解文档\n\n> 本文档由 AI 讲解沉淀而来，按时间累加，可随时回顾。"

# 单次沉淀内容上限（防聊天全文原样灌入撑爆 blob）
MAX_SECTION_LENGTH = 20000


def _ensure_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            import json
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _derive_topic(content: str) -> str:
    """topic 缺省：取内容首个 markdown 标题；无标题则取首个非空行截断 30 字。"""
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        heading = re.match(r"^#{1,4}\s+(.+)", stripped)
        if heading:
            return heading.group(1).strip()[:40]
        return stripped[:30]
    return "代码讲解"


def append_explanation_section(
    project_id: str,
    content: str,
    topic: str | None = None,
    db: Any = None,
) -> dict:
    """
    追加一个讲解章节到项目讲解文档。

    返回:
        dict: status（appended/duplicate/error）、content_length、topic。
    """
    if db is None:
        from app.repositories.runtime_db import db as runtime_db
        db = runtime_db

    body = str(content or "").strip()
    if not body:
        return {"status": "error", "error": "讲解内容为空", "content_length": 0}
    if len(body) > MAX_SECTION_LENGTH:
        body = body[:MAX_SECTION_LENGTH] + "\n\n…（内容过长已截断）"

    state = db.get_skill_state(project_id)
    if not state:
        return {"status": "error", "error": f"未找到项目 {project_id}", "content_length": 0}

    data = _ensure_dict(getattr(state, "standard_step_data", None))
    existing = str(data.get(EXPLANATION_BLOB_KEY, "") or "")

    # 判重：正文已在文档中（忽略首尾空白差异）则跳过
    if body and body in existing:
        return {
            "status": "duplicate",
            "content_length": len(existing),
            "topic": topic or _derive_topic(body),
        }

    section_topic = (topic or "").strip() or _derive_topic(body)
    timestamp = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M")
    section = f"## 📖 {section_topic} · {timestamp}\n\n{body}"

    if existing.strip():
        new_doc = f"{existing.rstrip()}\n\n---\n\n{section}"
    else:
        new_doc = f"{_DOC_HEADER}\n\n---\n\n{section}"

    result = save_artifact(project_id, "explanation", new_doc, db)
    if result.get("status") != "valid":
        logger.warning("append_explanation_section: save_artifact 失败 project=%s", project_id)
        return {"status": "error", "error": "讲解文档写入失败", "content_length": len(existing)}

    return {
        "status": "appended",
        "content_length": len(new_doc),
        "topic": section_topic,
        "path": result.get("path"),
    }
