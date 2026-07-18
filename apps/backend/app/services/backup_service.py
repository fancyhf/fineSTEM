"""
数据库备份服务

用途：用 sqlite3.backup() 在线热备（避免 cp 到写一半的状态），定时 + 手动触发。
背景：2026-07-18 事故中代码只存数据库一个地方，若 .db 损坏则永久丢失。
     本服务给数据库加一层磁盘冗余。
维护者：AI Agent
"""
from __future__ import annotations

import logging
import re
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from app.core.config import settings
from app.core.time_utils import utc_now

logger = logging.getLogger(__name__)


def _resolve_db_path() -> Path:
    """从 DATABASE_URL 解析 sqlite 文件路径。非 sqlite 抛 ValueError。"""
    url = settings.DATABASE_URL
    # 形如 sqlite:///D:/data/finestem/finestem.db
    m = re.match(r"^sqlite:///?(.+)$", url)
    if not m:
        raise ValueError(f"backup_service 仅支持 sqlite，当前 DATABASE_URL={url}")
    return Path(m.group(1))


def _resolve_backup_dir() -> Path:
    """备份目录：STORAGE_BASE_PATH / BACKUP_DIR。"""
    return Path(settings.STORAGE_BASE_PATH) / settings.BACKUP_DIR


def backup_database(target_path: Path | None = None) -> Path:
    """
    用 sqlite3.backup() 在线热备。

    相比 shutil.copy，backup() 会正确处理并发写入，避免备份到事务未提交的中间状态。

    参数:
        target_path: 显式目标路径；None 则自动生成 finestem_YYYYMMDD_HHMMSS.db

    返回:
        备份文件路径。
    """
    src_path = _resolve_db_path()
    if not src_path.exists():
        raise FileNotFoundError(f"源数据库不存在: {src_path}")

    if target_path is None:
        backup_dir = _resolve_backup_dir()
        backup_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_path = backup_dir / f"finestem_{ts}.db"

    # 用单独的源连接调 backup() 方法；目标也用 sqlite3 连接
    src_conn = sqlite3.connect(str(src_path))
    dst_conn = sqlite3.connect(str(target_path))
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()

    logger.info("backup_success src=%s dst=%s size=%d", src_path, target_path, target_path.stat().st_size)
    return target_path


def cleanup_old_backups(keep_days: int | None = None) -> int:
    """
    删除超过保留期的旧备份。

    参数:
        keep_days: 保留天数；None 用配置 BACKUP_KEEP_DAYS。

    返回:
        删除的文件数。
    """
    if keep_days is None:
        keep_days = settings.BACKUP_KEEP_DAYS
    backup_dir = _resolve_backup_dir()
    if not backup_dir.is_dir():
        return 0

    threshold = utc_now() - timedelta(days=keep_days)
    threshold_ts = threshold.timestamp()
    deleted = 0
    for f in backup_dir.glob("finestem_*.db"):
        try:
            if f.stat().st_mtime < threshold_ts:
                f.unlink()
                deleted += 1
                logger.info("backup_cleanup_deleted file=%s", f)
        except OSError as exc:
            logger.warning("backup_cleanup_failed file=%s err=%s", f, exc)
    return deleted


def run_scheduled_backup() -> dict:
    """
    定时任务/手动 API 共用的入口：备份 + 清理旧备份。

    返回:
        dict: { backup_path, size_bytes, deleted_old }
    """
    path = backup_database()
    deleted = cleanup_old_backups()
    return {
        "backup_path": str(path),
        "size_bytes": path.stat().st_size,
        "deleted_old": deleted,
    }


def compute_seconds_until_next_run(now: datetime | None = None) -> int:
    """
    计算到下次 BACKUP_HOUR 的秒数。供 asyncio 循环 sleep 用。
    若今天的小时数已过 BACKUP_HOUR，则算到明天同一时刻。
    """
    if now is None:
        now = datetime.now()
    target_hour = settings.BACKUP_HOUR
    next_run = now.replace(hour=target_hour, minute=0, second=0, microsecond=0)
    if next_run <= now:
        next_run = next_run + timedelta(days=1)
    return int((next_run - now).total_seconds())
