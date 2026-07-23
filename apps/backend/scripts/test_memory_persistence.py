r"""
ZeroClaw Memory 持久化测试脚本

用途：验证通过 zeroclaw_memory 模块存储的记忆能正确持久化到 brain.db，
      并支持精确召回、全文搜索、更新（非重复）和删除。

测试流程：
  1. 存储项目画像（store_project_profile）
  2. 存储阶段进度（store_stage_history）
  3. 按精确 key 召回并验证内容
  4. 按 FTS 关键词召回
  5. 测试更新（同 key 存新值，验证是更新而非新增）
  6. 清理所有测试记忆

运行方式：
  G:\mediaProjects\fineSTEM\.venv\Scripts\python.exe \
      G:\mediaProjects\fineSTEM\apps\backend\scripts\test_memory_persistence.py

维护者：AI Agent
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from typing import Any

# ── Windows 控制台 UTF-8 支持 ──
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", newline="\n")
    except (AttributeError, ValueError):
        pass

# ── 路径设置：确保能 import app.services.zeroclaw_memory ──
BACKEND_DIR = r"G:\mediaProjects\fineSTEM\apps\backend"
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

# ── ZeroClaw memory 配置常量 ──
BRAIN_DB_PATH = r"H:\dev-env\zeroclaw\config\data\memory\brain.db"
ASSISTANT_AGENT_ID = "9cd44b6d-779e-4e88-9602-2f75079f0eec"

# ── 测试用项目 ID（使用时间戳避免冲突）──
TEST_PROJECT_ID = f"test-persist-{int(time.time())}"

# ── 日志配置 ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("test_memory_persistence")


def _print_ok(msg: str) -> None:
    """打印通过信息"""
    print(f"  [OK] {msg}")


def _print_fail(msg: str) -> None:
    """打印失败信息"""
    print(f"  [FAIL] {msg}")


def _print_info(msg: str) -> None:
    """打印信息"""
    print(f"  [INFO] {msg}")


def test_store_and_recall_profile() -> bool:
    """
    测试 1：存储项目画像并按精确 key 召回

    步骤：
      - 调用 store_project_profile 存储画像
      - 调用 recall_memory 按 key 精确召回
      - 验证召回内容与存储内容一致
    """
    print("\n--- 测试 1: 存储并召回项目画像 ---")
    try:
        from app.services.zeroclaw_memory import (
            store_project_profile,
            recall_memory,
            KEY_PREFIX,
        )

        # 构造测试画像数据
        profile: dict[str, Any] = {
            "project_id": TEST_PROJECT_ID,
            "student_name": "测试学生",
            "grade": "初中",
            "interest": "游戏开发",
            "time_budget": "6小时",
            "created_at": "2026-07-22T10:00:00Z",
        }

        # 存储画像
        store_result = store_project_profile(TEST_PROJECT_ID, profile)
        if not store_result.get("success"):
            _print_fail(f"存储画像失败: {store_result.get('error')}")
            return False
        _print_ok(f"画像已存储, action={store_result.get('action')}, key={store_result.get('key')}")

        # 按精确 key 召回
        expected_key = f"{KEY_PREFIX}:project:{TEST_PROJECT_ID}:profile"
        recall_result = recall_memory(key=expected_key)
        if not recall_result.get("success"):
            _print_fail(f"召回画像失败: {recall_result.get('error')}")
            return False

        memories = recall_result.get("memories", [])
        if len(memories) != 1:
            _print_fail(f"期望 1 条记忆, 实际 {len(memories)} 条")
            return False

        # 验证内容匹配
        recalled_content = json.loads(memories[0]["content"])
        if recalled_content != profile:
            _print_fail(f"内容不匹配:\n  期望: {profile}\n  实际: {recalled_content}")
            return False

        _print_ok("召回内容与存储内容完全匹配")
        return True

    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("test_store_and_recall_profile 失败")
        return False


def test_store_and_recall_stage_history() -> bool:
    """
    测试 2：存储阶段进度并按精确 key 召回

    步骤：
      - 调用 store_stage_history 存储阶段进度
      - 调用 recall_memory 按 key 精确召回
      - 验证 current_stage 和 completed_stages 字段
    """
    print("\n--- 测试 2: 存储并召回阶段进度 ---")
    try:
        from app.services.zeroclaw_memory import (
            store_stage_history,
            recall_memory,
            KEY_PREFIX,
        )

        current_stage = "stage_03_constraints"
        completed_stages = ["stage_00_bootstrap", "stage_01_brainstorm", "stage_02_brief"]

        # 存储阶段进度
        store_result = store_stage_history(TEST_PROJECT_ID, current_stage, completed_stages)
        if not store_result.get("success"):
            _print_fail(f"存储阶段进度失败: {store_result.get('error')}")
            return False
        _print_ok(f"阶段进度已存储, action={store_result.get('action')}")

        # 按精确 key 召回
        expected_key = f"{KEY_PREFIX}:project:{TEST_PROJECT_ID}:stage_history"
        recall_result = recall_memory(key=expected_key)
        if not recall_result.get("success"):
            _print_fail(f"召回阶段进度失败: {recall_result.get('error')}")
            return False

        memories = recall_result.get("memories", [])
        if len(memories) != 1:
            _print_fail(f"期望 1 条记忆, 实际 {len(memories)} 条")
            return False

        # 验证内容
        recalled_content = json.loads(memories[0]["content"])
        if recalled_content.get("current_stage") != current_stage:
            _print_fail(f"current_stage 不匹配: 期望={current_stage}, 实际={recalled_content.get('current_stage')}")
            return False
        if recalled_content.get("completed_stages") != completed_stages:
            _print_fail(f"completed_stages 不匹配")
            return False

        _print_ok(f"阶段进度验证通过: current_stage={current_stage}, completed={len(completed_stages)} 阶段")
        return True

    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("test_store_and_recall_stage_history 失败")
        return False


def test_fts_recall() -> bool:
    """
    测试 3：FTS5 全文搜索召回

    步骤：
      - 使用 recall_memory 的 query 参数搜索关键词
      - 验证能搜到之前存储的测试记忆
    """
    print("\n--- 测试 3: FTS5 全文搜索召回 ---")
    try:
        from app.services.zeroclaw_memory import recall_memory, KEY_PREFIX

        # 用项目 ID 作为搜索关键词（确保能命中我们的测试数据）
        query = f"{KEY_PREFIX}:project:{TEST_PROJECT_ID}"
        recall_result = recall_memory(query=query, limit=20)
        if not recall_result.get("success"):
            _print_fail(f"FTS 搜索失败: {recall_result.get('error')}")
            return False

        memories = recall_result.get("memories", [])
        _print_info(f"FTS 搜索 '{query}' 返回 {len(memories)} 条记忆")

        if len(memories) < 2:
            _print_fail(f"期望至少 2 条记忆（profile + stage_history），实际 {len(memories)} 条")
            return False

        # 验证至少包含 profile 和 stage_history 两条
        keys = [m["key"] for m in memories]
        has_profile = any("profile" in k for k in keys)
        has_stage = any("stage_history" in k for k in keys)

        if not has_profile:
            _print_fail("FTS 结果中未找到 profile 记忆")
            return False
        if not has_stage:
            _print_fail("FTS 结果中未找到 stage_history 记忆")
            return False

        _print_ok(f"FTS 搜索验证通过: profile={has_profile}, stage_history={has_stage}")
        return True

    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("test_fts_recall 失败")
        return False


def test_update_not_duplicate() -> bool:
    """
    测试 4：更新记忆（同 key 存新值，验证是更新而非重复插入）

    步骤：
      - 对已有 profile key 存储新值
      - 验证 action 为 "updated"
      - 召回验证只有 1 条记忆（未重复）
      - 验证内容已更新为新值
    """
    print("\n--- 测试 4: 更新记忆（非重复插入） ---")
    try:
        from app.services.zeroclaw_memory import (
            store_project_profile,
            recall_memory,
            KEY_PREFIX,
        )

        # 存储更新后的画像
        updated_profile: dict[str, Any] = {
            "project_id": TEST_PROJECT_ID,
            "student_name": "测试学生（已更新）",
            "grade": "高中",
            "interest": "AI/机器学习",
            "time_budget": "12小时+",
            "updated_at": "2026-07-22T12:00:00Z",
        }

        store_result = store_project_profile(TEST_PROJECT_ID, updated_profile)
        if not store_result.get("success"):
            _print_fail(f"更新画像失败: {store_result.get('error')}")
            return False

        action = store_result.get("action")
        if action != "updated":
            _print_fail(f"期望 action='updated', 实际 action='{action}'")
            return False
        _print_ok(f"action='{action}'，确认是更新而非新增")

        # 召回验证只有 1 条（未重复）
        expected_key = f"{KEY_PREFIX}:project:{TEST_PROJECT_ID}:profile"
        recall_result = recall_memory(key=expected_key)
        if not recall_result.get("success"):
            _print_fail(f"召回失败: {recall_result.get('error')}")
            return False

        memories = recall_result.get("memories", [])
        if len(memories) != 1:
            _print_fail(f"期望 1 条记忆（更新后不重复），实际 {len(memories)} 条")
            return False

        # 验证内容已更新
        recalled_content = json.loads(memories[0]["content"])
        if recalled_content.get("grade") != "高中":
            _print_fail(f"内容未更新: grade={recalled_content.get('grade')}, 期望='高中'")
            return False
        if recalled_content.get("student_name") != "测试学生（已更新）":
            _print_fail(f"内容未更新: student_name={recalled_content.get('student_name')}")
            return False

        _print_ok("更新验证通过: 内容已更新, 记忆未重复")
        return True

    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("test_update_not_duplicate 失败")
        return False


def test_forget_memory() -> bool:
    """
    测试 5：删除测试记忆（清理）

    步骤：
      - 调用 forget_memory 删除 profile 和 stage_history
      - 召回验证已删除
    """
    print("\n--- 测试 5: 删除测试记忆（清理） ---")
    try:
        from app.services.zeroclaw_memory import forget_memory, recall_memory, KEY_PREFIX

        keys_to_delete = [
            f"{KEY_PREFIX}:project:{TEST_PROJECT_ID}:profile",
            f"{KEY_PREFIX}:project:{TEST_PROJECT_ID}:stage_history",
        ]

        all_deleted = True
        for key in keys_to_delete:
            result = forget_memory(key)
            if not result.get("success"):
                _print_fail(f"删除失败 key={key}: {result.get('error')}")
                all_deleted = False
            else:
                deleted_count = result.get("deleted", 0)
                _print_ok(f"已删除 key={key}, deleted={deleted_count}")

        # 验证已删除
        for key in keys_to_delete:
            recall_result = recall_memory(key=key)
            if recall_result.get("success"):
                memories = recall_result.get("memories", [])
                if memories:
                    _print_fail(f"记忆仍存在 key={key}")
                    all_deleted = False

        if all_deleted:
            _print_ok("所有测试记忆已清理完毕")
        return all_deleted

    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("test_forget_memory 失败")
        return False


def test_brain_db_exists() -> bool:
    """
    前置检查：确认 brain.db 数据库文件存在
    """
    print("\n--- 前置检查: brain.db 存在性 ---")
    if os.path.exists(BRAIN_DB_PATH):
        _print_ok(f"brain.db 存在: {BRAIN_DB_PATH}")
        return True
    else:
        _print_fail(f"brain.db 不存在: {BRAIN_DB_PATH}")
        return False


def main() -> int:
    """主函数：运行所有测试并汇总结果"""
    print("=" * 60)
    print("ZeroClaw Memory 持久化测试")
    print(f"测试项目 ID: {TEST_PROJECT_ID}")
    print(f"Brain DB: {BRAIN_DB_PATH}")
    print(f"Agent ID: {ASSISTANT_AGENT_ID}")
    print("=" * 60)

    results: list[tuple[str, bool]] = []

    # 前置检查
    results.append(("brain.db 存在性检查", test_brain_db_exists()))

    # 如果数据库不存在，后续测试无意义
    if not results[-1][1]:
        print("\n[FAIL] 前置检查失败，终止测试")
        return 1

    # 执行测试
    results.append(("存储并召回项目画像", test_store_and_recall_profile()))
    results.append(("存储并召回阶段进度", test_store_and_recall_stage_history()))
    results.append(("FTS5 全文搜索召回", test_fts_recall()))
    results.append(("更新记忆（非重复插入）", test_update_not_duplicate()))
    results.append(("删除测试记忆（清理）", test_forget_memory()))

    # 汇总
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    passed = 0
    failed = 0
    for name, ok in results:
        status = "[OK]" if ok else "[FAIL]"
        print(f"  {status} {name}")
        if ok:
            passed += 1
        else:
            failed += 1

    print(f"\n总计: {passed} 通过, {failed} 失败, 共 {len(results)} 项")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
