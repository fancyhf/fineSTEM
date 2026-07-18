"""
重置用户密码脚本（仅供运维手动执行）

强制要求：
- 必须显式传入 --email 与 --password 参数；
- 必须通过交互式二次确认才能写库；
- 禁止硬编码任何用户邮箱或密码，避免误操作"折腾"个人账户。

用法示例：
    python scripts/reset_password.py --email user@example.com --password "<NEW>"
    # 通过 --yes 跳过二次确认（仅限自动化场景，慎用）：
    python scripts/reset_password.py --email user@example.com --password "<NEW>" --yes
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

from passlib.context import CryptContext

# 数据库路径（与后端 config 保持一致：D:/data/finestem/finestem.db）
DEFAULT_DB_PATH = Path("D:/data/finestem/finestem.db")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="重置 fineSTEM 用户密码（必须显式提供邮箱与新密码）",
    )
    parser.add_argument("--email", required=True, help="目标用户邮箱（必填）")
    parser.add_argument("--password", required=True, help="新密码（必填，最少 8 位）")
    parser.add_argument(
        "--db",
        default=str(DEFAULT_DB_PATH),
        help=f"SQLite 数据库路径，默认 {DEFAULT_DB_PATH}",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="跳过二次确认（仅供受控自动化使用，慎用）",
    )
    return parser.parse_args()


def confirm(email: str) -> bool:
    """交互式二次确认，避免误操作。"""
    prompt = (
        f"\n即将重置用户密码：{email}\n"
        f"此操作不可撤销。请输入完整邮箱以确认（或直接回车取消）：\n> "
    )
    try:
        typed = input(prompt).strip()
    except EOFError:
        return False
    return typed == email


def main() -> int:
    args = parse_args()

    if len(args.password) < 8:
        print("[错误] 新密码长度必须 >= 8 位", file=sys.stderr)
        return 2

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"[错误] 数据库不存在：{db_path}", file=sys.stderr)
        return 2

    if not args.yes and not confirm(args.email):
        print("[已取消] 输入与目标邮箱不一致，未执行任何修改。")
        return 1

    new_hash = pwd_context.hash(args.password)

    conn = sqlite3.connect(str(db_path))
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET hashed_password = ?, updated_at = datetime('now') "
            "WHERE email = ?",
            (new_hash, args.email),
        )
        if cur.rowcount == 0:
            print(f"[错误] 未找到用户：{args.email}", file=sys.stderr)
            conn.rollback()
            return 3
        conn.commit()
    finally:
        conn.close()

    print(f"[成功] 已重置用户 {args.email} 的密码（哈希长度 {len(new_hash)}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
