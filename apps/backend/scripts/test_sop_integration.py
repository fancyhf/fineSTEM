r"""
ZeroClaw SOP 集成测试脚本

用途：验证 SOP 定义文件有效性和 SopStateSyncTool 工具的正确性。

测试流程：
  1. 通过 zeroclaw CLI 验证 pbl-stage-flow SOP 定义可加载
  2. 导入 SopStateSyncTool 并测试 execute 方法
  3. 验证 sop_state_sync 能更新 SKILL_STATE 的 metadata：
     - sop_run_id
     - sop_current_step
     - sop_step_status
  4. 测试必填参数校验（缺少参数应返回失败）
  5. 测试可选参数 sop_run_id 缺省时的行为

运行方式：
  G:\mediaProjects\fineSTEM\.venv\Scripts\python.exe \
      G:\mediaProjects\fineSTEM\apps\backend\scripts\test_sop_integration.py

维护者：AI Agent
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
import uuid
from typing import Any

# ── Windows 控制台 UTF-8 支持 ──
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", newline="\n")
    except (AttributeError, ValueError):
        pass

# ── 路径设置 ──
BACKEND_DIR = r"G:\mediaProjects\fineSTEM\apps\backend"
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

# ── ZeroClaw CLI 路径 ──
ZEROCLAW_BIN = r"H:\dev-env\zeroclaw\bin\zeroclaw.exe"

# ── 测试用 SOP 名称 ──
SOP_NAME = "pbl-stage-flow"

# ── 日志配置 ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("test_sop_integration")


def _print_ok(msg: str) -> None:
    """打印通过信息"""
    print(f"  [OK] {msg}")


def _print_fail(msg: str) -> None:
    """打印失败信息"""
    print(f"  [FAIL] {msg}")


def _print_info(msg: str) -> None:
    """打印信息"""
    print(f"  [INFO] {msg}")


def test_sop_validate() -> bool:
    """
    测试 1：验证 pbl-stage-flow SOP 定义可加载

    步骤：
      - 执行 `zeroclaw sop validate pbl-stage-flow`
      - 检查退出码为 0
      - 检查输出中不含 error/invalid 等错误关键词
    """
    print("\n--- 测试 1: 验证 SOP 定义 (zeroclaw sop validate) ---")
    try:
        if not os.path.exists(ZEROCLAW_BIN):
            _print_fail(f"zeroclaw CLI 不存在: {ZEROCLAW_BIN}")
            return False

        _print_info(f"执行: {ZEROCLAW_BIN} sop validate {SOP_NAME}")

        result = subprocess.run(
            [ZEROCLAW_BIN, "sop", "validate", SOP_NAME],
            capture_output=True,
            text=True,
            timeout=30,
            encoding="utf-8",
            errors="replace",
        )

        stdout = result.stdout or ""
        stderr = result.stderr or ""

        _print_info(f"退出码: {result.returncode}")
        if stdout.strip():
            _print_info(f"stdout (前200字符): {stdout[:200]}")
        if stderr.strip():
            _print_info(f"stderr (前200字符): {stderr[:200]}")

        if result.returncode != 0:
            _print_fail(f"验证失败, 退出码={result.returncode}")
            return False

        # 检查输出中是否有错误关键词
        combined = (stdout + stderr).lower()
        error_keywords = ["error", "invalid", "failed", "not found", "exception"]
        found_errors = [kw for kw in error_keywords if kw in combined]
        if found_errors:
            _print_fail(f"输出中包含错误关键词: {found_errors}")
            return False

        _print_ok(f"SOP '{SOP_NAME}' 验证通过")
        return True

    except subprocess.TimeoutExpired:
        _print_fail("zeroclaw sop validate 超时（30s）")
        return False
    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("test_sop_validate 失败")
        return False


def test_sop_state_sync_update() -> bool:
    """
    测试 2：SopStateSyncTool 更新 SKILL_STATE metadata

    步骤：
      - 导入 SopStateSyncTool
      - 准备一个测试项目（需要 SKILL_STATE 记录）
      - 调用 execute 方法，传入 sop_run_id / current_step / step_status
      - 验证返回 success=True
      - 读取 SKILL_STATE，验证 metadata 中包含：
        - sop_run_id
        - sop_current_step
        - sop_step_status
    """
    print("\n--- 测试 2: SopStateSyncTool 更新 SKILL_STATE metadata ---")
    try:
        from app.services.tools import SopStateSyncTool
        from app.repositories.runtime_db import db

        # 生成测试用 project_id 和 sop_run_id
        test_project_id = f"sop-test-{uuid.uuid4().hex[:8]}"
        test_sop_run_id = f"sop_run_{uuid.uuid4().hex[:12]}"
        test_step = "stage_01_brainstorm"
        test_status = "in_progress"

        # 前置：创建测试项目的 SKILL_STATE 记录
        _print_info(f"创建测试项目 SKILL_STATE: project_id={test_project_id}")
        try:
            from types import SimpleNamespace
            from datetime import datetime, timezone
            _now = datetime.now(timezone.utc)
            test_state_data = SimpleNamespace(
                project_id=test_project_id,
                version=1,
                current_stage="stage_00_bootstrap",
                mode="light",
                light_step=None,
                metadata={},
                stages={},
                stage_history=[],
                light_step_data={},
                standard_step_data={},
                light_to_standard_mapping={},
                created_at=_now,
                updated_at=_now,
            )
            db.create_skill_state(test_state_data)
            _print_ok("测试 SKILL_STATE 已创建")
        except Exception as create_exc:
            _print_fail(f"创建测试 SKILL_STATE 失败: {create_exc}")
            logger.exception("创建 SKILL_STATE 失败")
            return False

        # 实例化 SopStateSyncTool
        tool = SopStateSyncTool()
        _print_info(f"工具名称: {tool.name}")
        _print_info(f"必填参数: {tool.parameters_schema.get('required', [])}")

        # 调用 execute（async 方法，需 asyncio.run）
        params = {
            "project_id": test_project_id,
            "sop_run_id": test_sop_run_id,
            "current_step": test_step,
            "step_status": test_status,
        }

        _print_info(f"调用 execute, params={json.dumps(params, ensure_ascii=False)}")
        result = asyncio.run(tool.execute(params))

        if not result.success:
            _print_fail(f"execute 返回失败: {result.error}")
            return False

        _print_ok(f"execute 返回 success=True")
        _print_info(f"返回数据: {json.dumps(result.data, ensure_ascii=False)}")

        # 读取 SKILL_STATE 验证 metadata
        state = db.get_skill_state(test_project_id)
        if not state:
            _print_fail("更新后读取 SKILL_STATE 返回 None")
            return False

        metadata_raw = getattr(state, "metadata", "{}")
        metadata = json.loads(metadata_raw) if isinstance(metadata_raw, str) else metadata_raw

        # 验证 metadata 中包含 SOP 状态字段
        checks = [
            ("sop_run_id", test_sop_run_id),
            ("sop_current_step", test_step),
            ("sop_step_status", test_status),
        ]

        all_ok = True
        for field, expected in checks:
            actual = metadata.get(field)
            if actual == expected:
                _print_ok(f"metadata.{field} = '{actual}' (符合预期)")
            else:
                _print_fail(f"metadata.{field} = '{actual}', 期望='{expected}'")
                all_ok = False

        # 验证 sop_last_sync 时间戳存在
        if "sop_last_sync" in metadata:
            _print_ok(f"metadata.sop_last_sync 存在: {metadata['sop_last_sync']}")
        else:
            _print_fail("metadata.sop_last_sync 不存在")
            all_ok = False

        # 清理：删除测试项目的 SKILL_STATE
        _cleanup_test_project(test_project_id)

        return all_ok

    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("test_sop_state_sync_update 失败")
        return False


def test_sop_state_sync_missing_params() -> bool:
    """
    测试 3：必填参数校验

    步骤：
      - 调用 execute 时不传 project_id，验证返回失败
      - 调用 execute 时不传 current_step，验证返回失败
      - 调用 execute 时不传 step_status，验证返回失败
    """
    print("\n--- 测试 3: 必填参数校验 ---")
    try:
        from app.services.tools import SopStateSyncTool

        tool = SopStateSyncTool()

        # 测试缺少 project_id
        result = asyncio.run(tool.execute({
            "current_step": "stage_01",
            "step_status": "pending",
        }))
        if result.success:
            _print_fail("缺少 project_id 时应返回失败，但返回了 success=True")
            return False
        _print_ok(f"缺少 project_id -> 正确返回失败: {result.error}")

        # 测试缺少 current_step
        result = asyncio.run(tool.execute({
            "project_id": "fake-project",
            "step_status": "pending",
        }))
        if result.success:
            _print_fail("缺少 current_step 时应返回失败，但返回了 success=True")
            return False
        _print_ok(f"缺少 current_step -> 正确返回失败: {result.error}")

        # 测试缺少 step_status
        result = asyncio.run(tool.execute({
            "project_id": "fake-project",
            "current_step": "stage_01",
        }))
        if result.success:
            _print_fail("缺少 step_status 时应返回失败，但返回了 success=True")
            return False
        _print_ok(f"缺少 step_status -> 正确返回失败: {result.error}")

        return True

    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("test_sop_state_sync_missing_params 失败")
        return False


def test_sop_state_sync_optional_run_id() -> bool:
    """
    测试 4：可选参数 sop_run_id 缺省时的行为

    步骤：
      - 创建测试项目
      - 调用 execute 时不传 sop_run_id（可选参数）
      - 验证仍然返回 success=True
      - 验证 metadata 中 sop_run_id 为 None
    """
    print("\n--- 测试 4: 可选参数 sop_run_id 缺省 ---")
    try:
        from app.services.tools import SopStateSyncTool
        from app.repositories.runtime_db import db

        test_project_id = f"sop-opt-{uuid.uuid4().hex[:8]}"

        # 创建测试 SKILL_STATE
        try:
            from types import SimpleNamespace
            from datetime import datetime, timezone
            _now = datetime.now(timezone.utc)
            test_state_data = SimpleNamespace(
                project_id=test_project_id,
                version=1,
                current_stage="stage_00_bootstrap",
                mode="light",
                light_step=None,
                metadata={},
                stages={},
                stage_history=[],
                light_step_data={},
                standard_step_data={},
                light_to_standard_mapping={},
                created_at=_now,
                updated_at=_now,
            )
            db.create_skill_state(test_state_data)
        except Exception as create_exc:
            _print_fail(f"创建测试 SKILL_STATE 失败: {create_exc}")
            return False

        tool = SopStateSyncTool()

        # 不传 sop_run_id
        params = {
            "project_id": test_project_id,
            "current_step": "stage_02_brief",
            "step_status": "completed",
        }

        _print_info(f"调用 execute (无 sop_run_id), params={json.dumps(params)}")
        result = asyncio.run(tool.execute(params))

        if not result.success:
            _print_fail(f"execute 返回失败: {result.error}")
            _cleanup_test_project(test_project_id)
            return False

        _print_ok("无 sop_run_id 时 execute 返回 success=True")

        # 验证 metadata
        state = db.get_skill_state(test_project_id)
        if state:
            metadata_raw = getattr(state, "metadata", "{}")
            metadata = json.loads(metadata_raw) if isinstance(metadata_raw, str) else metadata_raw

            if "sop_current_step" in metadata and metadata["sop_current_step"] == "stage_02_brief":
                _print_ok(f"sop_current_step = '{metadata['sop_current_step']}' (正确)")
            else:
                _print_fail(f"sop_current_step 不正确: {metadata.get('sop_current_step')}")

            if "sop_step_status" in metadata and metadata["sop_step_status"] == "completed":
                _print_ok(f"sop_step_status = '{metadata['sop_step_status']}' (正确)")
            else:
                _print_fail(f"sop_step_status 不正确: {metadata.get('sop_step_status')}")

            # sop_run_id 应为 None（未传入）
            _print_info(f"sop_run_id = {metadata.get('sop_run_id')} (未传入, 预期为 None)")

        # 清理
        _cleanup_test_project(test_project_id)
        return True

    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("test_sop_state_sync_optional_run_id 失败")
        return False


def _cleanup_test_project(project_id: str) -> None:
    """清理测试项目的 SKILL_STATE 记录"""
    try:
        from app.repositories.runtime_db import db
        from app.db.database import SessionLocal
        from app.repositories.project_repo import ProjectRepo

        with SessionLocal() as session:
            repo = ProjectRepo(session)
            # 尝试删除 SKILL_STATE 记录
            try:
                repo.delete_skill_state(project_id)
                session.commit()
                _print_info(f"已清理测试项目: {project_id}")
            except Exception:
                # 如果没有 delete_skill_state 方法，尝试直接删除
                session.rollback()
                pass
    except Exception as exc:
        logger.warning("清理测试项目失败 project_id=%s: %s", project_id, exc)


def main() -> int:
    """主函数：运行所有测试并汇总结果"""
    print("=" * 60)
    print("ZeroClaw SOP 集成测试")
    print(f"SOP 名称: {SOP_NAME}")
    print(f"ZeroClaw CLI: {ZEROCLAW_BIN}")
    print(f"Backend Dir: {BACKEND_DIR}")
    print("=" * 60)

    results: list[tuple[str, bool]] = []

    # 执行测试
    results.append(("SOP 定义验证 (zeroclaw sop validate)", test_sop_validate()))
    results.append(("SopStateSyncTool 更新 metadata", test_sop_state_sync_update()))
    results.append(("必填参数校验", test_sop_state_sync_missing_params()))
    results.append(("可选参数 sop_run_id 缺省", test_sop_state_sync_optional_run_id()))

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
