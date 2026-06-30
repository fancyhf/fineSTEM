"""
fineSTEM /create 主链路 smoke 测试脚本

用途：一键运行 /create 相关的后端关键回归与前端关键 E2E，用于快速验证主链路不退化
维护者：AI Agent
links: .trae/documents/testing/
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
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
FRONTEND_CREATE_URL = "http://127.0.0.1:5284/create"
BACKEND_START_TIMEOUT_SECONDS = 30
FRONTEND_START_TIMEOUT_SECONDS = 45

BACKEND_SMOKE_TARGETS = [
    "tests/test_agent.py",
    "tests/test_projects.py",
]

FRONTEND_SMOKE_TARGETS = [
    "specs/create-history-restore.spec.ts",
    "specs/create-multifile-restore.spec.ts",
    "specs/create-question-options-restore.spec.ts",
    "specs/create-guided-pbl-mainline.spec.ts",
    "specs/create-development-preview.spec.ts",
    "specs/project-detail-final-report.spec.ts",
    "specs/project-detail-achievement-draft.spec.ts",
    "specs/project-detail-generate-achievement.spec.ts",
    "specs/project-detail-stage08-hydration.spec.ts",
    "specs/create-teaching-mode.spec.ts",
]


@dataclass
class SmokeResult:
    module: str
    command: str
    exit_code: int
    elapsed_seconds: float
    passed: bool
    detail: str = ""
    log_path: str = ""


@dataclass
class ManagedService:
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
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def utc_timestamp_for_report() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def ensure_test_dirs() -> None:
    TEST_DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if TEST_DATABASE_PATH.exists():
        TEST_DATABASE_PATH.unlink()


def check_http_service(url: str, service_name: str) -> None:
    try:
        with request.urlopen(url, timeout=5) as response:
            if response.status >= 400:
                raise RuntimeError(f"{service_name} 返回异常状态码 {response.status}")
    except (error.URLError, TimeoutError, RuntimeError) as exc:
        raise RuntimeError(
            f"{service_name} 未就绪，请先启动对应服务后再运行 smoke。检查地址：{url}"
        ) from exc


def is_http_service_ready(url: str) -> bool:
    try:
        with request.urlopen(url, timeout=3) as response:
            return response.status < 400
    except (error.URLError, TimeoutError):
        return False


def read_log_tail(log_path: Path, max_lines: int = 20) -> str:
    if not log_path.exists():
        return ""
    lines = log_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    tail = lines[-max_lines:]
    return "\n".join(tail)


def ensure_service(service: ManagedService) -> None:
    if is_http_service_ready(service.url):
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
) -> SmokeResult:
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

    return SmokeResult(
        module=title,
        command=" ".join(command),
        exit_code=result.returncode,
        elapsed_seconds=round(elapsed, 2),
        passed=result.returncode == 0,
        log_path=str(log_path) if log_path else "",
    )


def run_backend_smoke() -> SmokeResult:
    ensure_test_dirs()
    timestamp = utc_timestamp_for_filename()
    return run_command(
        title="后端 /create 关键回归",
        command=[
            sys.executable,
            "-m",
            "pytest",
            *BACKEND_SMOKE_TARGETS,
            "-q",
        ],
        cwd=BACKEND_DIR,
        env_overrides={
            "SECRET_KEY": "test-secret-key-for-automated-testing",
            "DEBUG": "true",
            "DATABASE_URL": f"sqlite:///{TEST_DATABASE_PATH.as_posix()}",
        },
        log_path=REPORT_DIR / f"create-smoke-backend-tests_{timestamp}.log",
    )


def run_frontend_smoke() -> SmokeResult:
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
            log_path=REPORT_DIR / f"create-smoke-backend_{timestamp}.log",
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
                "5284",
            ],
            cwd=PROJECT_ROOT / "apps" / "frontend",
            timeout_seconds=FRONTEND_START_TIMEOUT_SECONDS,
            log_path=REPORT_DIR / f"create-smoke-frontend_{timestamp}.log",
        ),
    ]

    try:
        for service in managed_services:
            ensure_service(service)
        check_http_service(BACKEND_HEALTH_URL, "后端 API")
        check_http_service(FRONTEND_CREATE_URL, "前端 create 页面")
    except RuntimeError as exc:
        return SmokeResult(
            module="前端 /create 关键 E2E",
            command="preflight service check",
            exit_code=1,
            elapsed_seconds=0.0,
            passed=False,
            detail=str(exc),
        )
    try:
        return run_command(
            title="前端 /create 关键 E2E",
            command=[
                ".\\node_modules\\.bin\\playwright.cmd",
                "test",
                *FRONTEND_SMOKE_TARGETS,
                "--project=chromium",
                "--reporter=list",
            ],
            cwd=FRONTEND_E2E_DIR,
            env_overrides={
                "E2E_API_URL": "http://127.0.0.1:3200/api/v1",
                "E2E_BASE_URL": "http://127.0.0.1:5284",
            },
            log_path=REPORT_DIR / f"create-smoke-frontend-tests_{timestamp}.log",
        )
    finally:
        for service in reversed(managed_services):
            cleanup_service(service)


def write_summary(results: list[SmokeResult]) -> Path:
    filename = REPORT_DIR / f"create-smoke-summary_{utc_timestamp_for_filename()}.json"
    payload = {
        "created_at": utc_timestamp_for_report(),
        "project_root": str(PROJECT_ROOT),
        "overall_passed": all(item.passed for item in results),
        "results": [asdict(item) for item in results],
    }
    filename.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return filename


def main() -> int:
    print("\n  fineSTEM /create 主链路 smoke")
    print("  时间(UTC):", utc_timestamp_for_report())
    print("  项目:", PROJECT_ROOT)

    results = [
        run_backend_smoke(),
        run_frontend_smoke(),
    ]

    summary_path = write_summary(results)

    print("\n" + "=" * 72)
    print("  smoke 总结")
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
