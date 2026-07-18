"""
fineSTEM PBL 闭环自动化测试一键脚本

用途：一键运行 PBL 闭环的后端单测+集成测试和前端 E2E，产出 summary JSON + 日志。
维护者：AI Agent
links: .trae/documents/testing/
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import IO, Sequence
from urllib import error, request


PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "apps" / "backend"
FRONTEND_E2E_DIR = PROJECT_ROOT / "apps" / "frontend" / "tests"
REPORT_DIR = PROJECT_ROOT / ".trae" / "documents" / "testing"
REPORT_DIR.mkdir(parents=True, exist_ok=True)
TEST_DATABASE_PATH = Path("D:/data/finestem/test_finestem.db")

BACKEND_HEALTH_URL = "http://127.0.0.1:3200/health"
FRONTEND_CREATE_URL = "http://127.0.0.1:5184/create"
BACKEND_START_TIMEOUT_SECONDS = 30
FRONTEND_START_TIMEOUT_SECONDS = 45

# 后端 PBL 测试目标：确定性引擎单测 + 闭环集成测试
BACKEND_PBL_TARGETS = [
    "tests/test_pbl_engine.py",
    "tests/test_projects.py::TestPBLFullLoop",
]

# 前端 PBL 闭环 E2E 目标
FRONTEND_PBL_TARGETS = [
    "specs/create-pbl-full-loop.spec.ts",
]


@dataclass
class PblLoopResult:
    """单个测试阶段的结果。"""
    module: str
    command: str
    exit_code: int
    elapsed_seconds: float
    passed: bool
    detail: str = ""
    log_path: str = ""


@dataclass
class ManagedService:
    """受脚本管理的服务（自动启动/停止）。"""
    name: str
    url: str
    command: list[str]
    cwd: Path
    timeout_seconds: int
    log_path: Path
    process: subprocess.Popen[str] | None = None
    log_handle: IO[str] | None = None
    started_by_script: bool = False


def utc_timestamp_for_filename() -> str:
    """文件名用的时间戳（无分隔符）。"""
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def utc_timestamp_for_report() -> str:
    """报告用的时间戳（MCP 格式）。"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def ensure_test_dirs() -> None:
    """清理测试数据库，确保干净的测试环境。"""
    TEST_DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if TEST_DATABASE_PATH.exists():
        try:
            TEST_DATABASE_PATH.unlink()
        except PermissionError:
            # Windows 下可能被占用，等待后重试
            time.sleep(1)
            try:
                TEST_DATABASE_PATH.unlink()
            except PermissionError:
                print(f"  警告：无法删除测试数据库 {TEST_DATABASE_PATH}，可能被占用")


def check_http_service(url: str, service_name: str) -> None:
    """强制检查服务是否就绪，未就绪则抛异常。"""
    try:
        with request.urlopen(url, timeout=5) as response:
            if response.status >= 400:
                raise RuntimeError(f"{service_name} 返回异常状态码 {response.status}")
    except (error.URLError, TimeoutError, RuntimeError) as exc:
        raise RuntimeError(
            f"{service_name} 未就绪，请先启动对应服务后再运行测试。检查地址：{url}"
        ) from exc


def is_http_service_ready(url: str) -> bool:
    """探测服务是否就绪（非阻塞）。"""
    try:
        with request.urlopen(url, timeout=3) as response:
            return response.status < 400
    except (error.URLError, TimeoutError):
        return False


def read_log_tail(log_path: Path, max_lines: int = 20) -> str:
    """读取日志末尾若干行，用于错误诊断。"""
    if not log_path.exists():
        return ""
    lines = log_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    tail = lines[-max_lines:]
    return "\n".join(tail)


def ensure_service(service: ManagedService) -> None:
    """确保服务已启动：若已就绪则跳过，否则启动并等待。"""
    if is_http_service_ready(service.url):
        print(f"  {service.name} 已就绪，跳过启动")
        return

    service.log_path.parent.mkdir(parents=True, exist_ok=True)
    service.log_handle = service.log_path.open("w", encoding="utf-8")
    service.process = subprocess.Popen(
        service.command,
        cwd=str(service.cwd),
        stdout=service.log_handle,
        stderr=subprocess.STDOUT,
        text=True,
        env=os.environ.copy(),
    )
    service.started_by_script = True

    deadline = time.time() + service.timeout_seconds
    while time.time() < deadline:
        if is_http_service_ready(service.url):
            print(f"  {service.name} 已就绪")
            return
        if service.process.poll() is not None:
            log_tail = read_log_tail(service.log_path)
            raise RuntimeError(
                f"{service.name} 启动失败，进程已退出。\n日志摘录：\n{log_tail or '无可用日志'}"
            )
        time.sleep(1)

    log_tail = read_log_tail(service.log_path)
    raise RuntimeError(
        f"{service.name} 启动超时，{service.timeout_seconds} 秒内未就绪。\n日志摘录：\n{log_tail or '无可用日志'}"
    )


def cleanup_service(service: ManagedService) -> None:
    """停止由脚本启动的服务。"""
    try:
        if service.process and service.started_by_script and service.process.poll() is None:
            service.process.terminate()
            try:
                service.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                service.process.kill()
                service.process.wait(timeout=5)
    finally:
        if service.log_handle:
            service.log_handle.close()


def run_command(
    *,
    title: str,
    command: Sequence[str],
    cwd: Path,
    env_overrides: dict[str, str] | None = None,
    log_path: Path | None = None,
) -> PblLoopResult:
    """执行命令并记录结果。"""
    print("\n" + "=" * 72)
    print(f"  {title}")
    print("=" * 72)
    print("  cwd:", cwd)
    print("  cmd:", " ".join(command))
    print()

    env = os.environ.copy()
    if env_overrides:
        env.update(env_overrides)

    started = datetime.now(timezone.utc)
    result = subprocess.run(
        command,
        cwd=str(cwd),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    combined_output = ""
    if result.stdout:
        print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
        combined_output += result.stdout
    if result.stderr:
        print(result.stderr, end="" if result.stderr.endswith("\n") else "\n")
        combined_output += result.stderr
    if log_path:
        log_path.write_text(combined_output, encoding="utf-8")

    return PblLoopResult(
        module=title,
        command=" ".join(command),
        exit_code=result.returncode,
        elapsed_seconds=round(elapsed, 2),
        passed=result.returncode == 0,
        log_path=str(log_path) if log_path else "",
    )


def run_backend_pbl_tests() -> PblLoopResult:
    """运行后端 PBL 引擎单测 + 闭环集成测试。"""
    ensure_test_dirs()
    timestamp = utc_timestamp_for_filename()
    return run_command(
        title="后端 PBL 引擎单测 + 闭环集成测试",
        command=[
            sys.executable,
            "-m",
            "pytest",
            *BACKEND_PBL_TARGETS,
            "-v",
            "--tb=short",
        ],
        cwd=BACKEND_DIR,
        env_overrides={
            "SECRET_KEY": "test-secret-key-for-automated-testing",
            "DEBUG": "true",
            "DATABASE_URL": f"sqlite:///{TEST_DATABASE_PATH.as_posix()}",
        },
        log_path=REPORT_DIR / f"pbl-loop-backend-tests_{timestamp}.log",
    )


def run_frontend_pbl_e2e() -> PblLoopResult:
    """启动前后端服务并运行 PBL 闭环 E2E。"""
    timestamp = utc_timestamp_for_filename()
    managed_services = [
        ManagedService(
            name="后端 API",
            url=BACKEND_HEALTH_URL,
            command=[
                sys.executable,
                "-m",
                "uvicorn",
                "main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "3200",
            ],
            cwd=BACKEND_DIR,
            timeout_seconds=BACKEND_START_TIMEOUT_SECONDS,
            log_path=REPORT_DIR / f"pbl-loop-backend_{timestamp}.log",
        ),
        ManagedService(
            name="前端 create 页面",
            url=FRONTEND_CREATE_URL,
            command=[
                "npm.cmd",
                "run",
                "dev",
                "--",
                "--host",
                "127.0.0.1",
                "--port",
                "5184",
            ],
            cwd=PROJECT_ROOT / "apps" / "frontend",
            timeout_seconds=FRONTEND_START_TIMEOUT_SECONDS,
            log_path=REPORT_DIR / f"pbl-loop-frontend_{timestamp}.log",
        ),
    ]

    # 服务预检
    try:
        for service in managed_services:
            ensure_service(service)
        check_http_service(BACKEND_HEALTH_URL, "后端 API")
        check_http_service(FRONTEND_CREATE_URL, "前端 create 页面")
    except RuntimeError as exc:
        return PblLoopResult(
            module="前端 PBL 闭环 E2E",
            command="preflight service check",
            exit_code=1,
            elapsed_seconds=0.0,
            passed=False,
            detail=str(exc),
        )

    # 运行 E2E
    try:
        return run_command(
            title="前端 PBL 闭环 E2E",
            command=[
                ".\\node_modules\\.bin\\playwright.cmd",
                "test",
                *FRONTEND_PBL_TARGETS,
                "--project=chromium",
                "--reporter=list",
            ],
            cwd=FRONTEND_E2E_DIR,
            env_overrides={
                "E2E_API_URL": "http://127.0.0.1:3200/api/v1",
                "E2E_BASE_URL": "http://127.0.0.1:5184",
            },
            log_path=REPORT_DIR / f"pbl-loop-frontend-tests_{timestamp}.log",
        )
    finally:
        for service in reversed(managed_services):
            cleanup_service(service)


def write_summary(results: list[PblLoopResult]) -> Path:
    """产出 summary JSON 文件。"""
    filename = REPORT_DIR / f"pbl-loop-summary_{utc_timestamp_for_filename()}.json"
    payload = {
        "created_at": utc_timestamp_for_report(),
        "project_root": str(PROJECT_ROOT),
        "overall_passed": all(item.passed for item in results),
        "results": [asdict(item) for item in results],
    }
    filename.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return filename


def main() -> int:
    """主入口：按顺序运行后端测试 → 前端 E2E → 产出 summary。"""
    print("\n  fineSTEM PBL 闭环自动化测试")
    print("  时间(UTC):", utc_timestamp_for_report())
    print("  项目:", PROJECT_ROOT)

    results: list[PblLoopResult] = []

    # 阶段 1：后端 PBL 测试
    backend_result = run_backend_pbl_tests()
    results.append(backend_result)

    # 后端测试失败则跳过前端 E2E（节省时间）
    if not backend_result.passed:
        print("\n  后端 PBL 测试失败，跳过前端 E2E")
        frontend_result = PblLoopResult(
            module="前端 PBL 闭环 E2E",
            command="(skipped due to backend failure)",
            exit_code=1,
            elapsed_seconds=0.0,
            passed=False,
            detail="后端测试失败，前端 E2E 未执行",
        )
        results.append(frontend_result)
    else:
        # 阶段 2：前端 E2E
        frontend_result = run_frontend_pbl_e2e()
        results.append(frontend_result)

    # 产出 summary
    summary_path = write_summary(results)

    print("\n" + "=" * 72)
    print("  PBL 闭环测试总结")
    print("=" * 72)
    for item in results:
        status = "通过" if item.passed else "失败"
        print(f"  - {item.module}: {status} ({item.elapsed_seconds}s)")
        if item.detail:
            print(f"    说明: {item.detail}")
    print("  - 汇总:", summary_path)

    return 0 if all(item.passed for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
