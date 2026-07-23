"""
ZeroClaw Memory 直接访问层

用途：让 fineSTEM MCP 工具能直接读写 ZeroClaw 的 memory sqlite 数据库，
实现跨 session 的项目级记忆持久化。

ZeroClaw memory 数据库路径：{data_dir}/memory/brain.db
agent_id for "assistant": 9cd44b6d-779e-4e88-9602-2f75079f0eec

维护者：AI Agent
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── ZeroClaw memory 数据库路径 ──
# ZeroClaw data_dir 默认在 config 目录下的 data 目录
_ZC_CONFIG_DIR = os.environ.get(
    "ZEROCLAW_CONFIG_DIR",
    r"H:\dev-env\zeroclaw\config",
)

# 尝试从环境变量获取 data_dir，如果该路径下不存在 brain.db，
# 则回退到 config_dir/data（ZeroClaw 默认数据目录）
_env_data_dir = os.environ.get("ZEROCLAW_DATA_DIR")
_config_data_dir = os.path.join(_ZC_CONFIG_DIR, "data")

if _env_data_dir and os.path.exists(os.path.join(_env_data_dir, "memory", "brain.db")):
    _ZC_DATA_DIR = _env_data_dir
elif os.path.exists(os.path.join(_config_data_dir, "memory", "brain.db")):
    _ZC_DATA_DIR = _config_data_dir
    if _env_data_dir and _env_data_dir != _config_data_dir:
        logger.warning(
            "ZEROCLAW_DATA_DIR=%s does not contain brain.db, "
            "falling back to %s",
            _env_data_dir, _config_data_dir,
        )
else:
    # 两者都不存在，使用 config_dir/data 作为默认值（后续连接时会报错）
    _ZC_DATA_DIR = _config_data_dir

BRAIN_DB_PATH = os.path.join(_ZC_DATA_DIR, "memory", "brain.db")

# assistant agent 的 UUID（从 brain.db agents 表查得）
ASSISTANT_AGENT_ID = "9cd44b6d-779e-4e88-9602-2f75079f0eec"

# 记忆键前缀
KEY_PREFIX = "finestem"


def _get_conn() -> sqlite3.Connection:
    """获取 brain.db 的数据库连接。"""
    if not os.path.exists(BRAIN_DB_PATH):
        raise FileNotFoundError(f"ZeroClaw memory DB not found: {BRAIN_DB_PATH}")
    conn = sqlite3.connect(BRAIN_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _utc_now() -> str:
    """返回 UTC ISO 时间戳。"""
    return datetime.now(timezone.utc).isoformat()


def store_memory(
    key: str,
    value: str,
    category: str = "project",
    agent_id: str = ASSISTANT_AGENT_ID,
) -> dict[str, Any]:
    """
    存储一条记忆到 ZeroClaw brain.db。

    如果 key 已存在（per agent_id unique），则更新 content 和 updated_at。

    参数:
        key: 记忆键（如 "finestem:project:abc123:profile"）
        value: 记忆值（JSON 字符串）
        category: 分类（默认 "project"）
        agent_id: Agent ID（默认 assistant）

    返回:
        dict: {success, key, action, id}
    """
    try:
        conn = _get_conn()
        cursor = conn.cursor()

        now = _utc_now()
        mem_id = str(uuid.uuid4())

        # 检查是否已存在（UNIQUE(agent_id, key)）
        cursor.execute(
            "SELECT id FROM memories WHERE agent_id = ? AND key = ?",
            (agent_id, key),
        )
        existing = cursor.fetchone()

        if existing:
            # 更新现有记忆
            cursor.execute(
                """UPDATE memories
                   SET content = ?, updated_at = ?, category = ?
                   WHERE agent_id = ? AND key = ?""",
                (value, now, category, agent_id, key),
            )
            action = "updated"
            mem_id = existing["id"]
        else:
            # 插入新记忆
            cursor.execute(
                """INSERT INTO memories
                   (id, key, content, category, created_at, updated_at, agent_id, pinned)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0)""",
                (mem_id, key, value, category, now, now, agent_id),
            )
            action = "created"

        conn.commit()
        conn.close()

        logger.info("memory_store key=%s action=%s", key, action)
        return {"success": True, "key": key, "action": action, "id": mem_id}

    except Exception as exc:
        logger.error("memory_store failed key=%s: %s", key, exc)
        return {"success": False, "error": str(exc), "key": key}


def recall_memory(
    key: str | None = None,
    query: str | None = None,
    agent_id: str = ASSISTANT_AGENT_ID,
    limit: int = 10,
) -> dict[str, Any]:
    """
    召回记忆。

    参数:
        key: 精确匹配键（优先）。如指定则忽略 query。
        query: FTS5 全文搜索关键词。
        agent_id: Agent ID。
        limit: 返回条数上限。

    返回:
        dict: {success, memories: [...], count}
    """
    try:
        conn = _get_conn()
        cursor = conn.cursor()

        if key:
            # 精确匹配
            cursor.execute(
                """SELECT id, key, content, category, created_at, updated_at
                   FROM memories
                   WHERE agent_id = ? AND key = ?""",
                (agent_id, key),
            )
        elif query:
            # FTS5 全文搜索
            
            # FTS5: wrap query in double quotes to escape special chars (like : in keys)
            fts_query = '"' + query.replace('"', '""') + '"'
            cursor.execute(
                """SELECT m.id, m.key, m.content, m.category, m.created_at, m.updated_at
                   FROM memories m
                   JOIN memories_fts f ON f.rowid = m.rowid
                   WHERE m.agent_id = ? AND memories_fts MATCH ?
                   ORDER BY rank
                   LIMIT ?""",
                (agent_id, fts_query, limit),
            )
        else:
            # 返回最近的所有记忆
            cursor.execute(
                """SELECT id, key, content, category, created_at, updated_at
                   FROM memories
                   WHERE agent_id = ?
                   ORDER BY updated_at DESC
                   LIMIT ?""",
                (agent_id, limit),
            )

        rows = cursor.fetchall()
        conn.close()

        memories = []
        for row in rows:
            memories.append({
                "key": row["key"],
                "content": row["content"],
                "category": row["category"],
                "updated_at": row["updated_at"],
            })

        logger.info("memory_recall key=%s query=%s found=%d", key, query, len(memories))
        return {"success": True, "memories": memories, "count": len(memories)}

    except Exception as exc:
        logger.error("memory_recall failed key=%s query=%s: %s", key, query, exc)
        return {"success": False, "error": str(exc), "memories": [], "count": 0}


def forget_memory(
    key: str,
    agent_id: str = ASSISTANT_AGENT_ID,
) -> dict[str, Any]:
    """
    删除一条记忆。

    参数:
        key: 要删除的记忆键。
        agent_id: Agent ID。

    返回:
        dict: {success, key, deleted}
    """
    try:
        conn = _get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM memories WHERE agent_id = ? AND key = ?",
            (agent_id, key),
        )
        deleted = cursor.rowcount
        conn.commit()
        conn.close()

        logger.info("memory_forget key=%s deleted=%d", key, deleted)
        return {"success": True, "key": key, "deleted": deleted}

    except Exception as exc:
        logger.error("memory_forget failed key=%s: %s", key, exc)
        return {"success": False, "error": str(exc), "key": key}


def store_project_profile(
    project_id: str,
    profile: dict[str, Any],
) -> dict[str, Any]:
    """存储项目画像（便捷方法）。"""
    key = f"{KEY_PREFIX}:project:{project_id}:profile"
    value = json.dumps(profile, ensure_ascii=False)
    return store_memory(key, value, category="project")


def recall_project_profile(project_id: str) -> dict[str, Any]:
    """召回项目画像（便捷方法）。"""
    key = f"{KEY_PREFIX}:project:{project_id}:profile"
    result = recall_memory(key=key)
    if result["success"] and result["memories"]:
        try:
            return json.loads(result["memories"][0]["content"])
        except (json.JSONDecodeError, IndexError):
            pass
    return {}


def store_stage_history(
    project_id: str,
    current_stage: str,
    completed_stages: list[str],
) -> dict[str, Any]:
    """存储阶段进度（便捷方法）。"""
    key = f"{KEY_PREFIX}:project:{project_id}:stage_history"
    value = json.dumps({
        "current_stage": current_stage,
        "completed_stages": completed_stages,
        "last_updated": _utc_now(),
    }, ensure_ascii=False)
    return store_memory(key, value, category="project")


def recall_stage_history(project_id: str) -> dict[str, Any]:
    """召回阶段进度（便捷方法）。"""
    key = f"{KEY_PREFIX}:project:{project_id}:stage_history"
    result = recall_memory(key=key)
    if result["success"] and result["memories"]:
        try:
            return json.loads(result["memories"][0]["content"])
        except (json.JSONDecodeError, IndexError):
            pass
    return {}
