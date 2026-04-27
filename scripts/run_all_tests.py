"""
fineSTEM 全量自动化测试运行脚本

用途：一键执行后端 API 测试 + 前端 E2E 测试，生成报告
维护者：AI Agent
links: .trae/documents/testing/
"""

import os
import sys
import json
import subprocess
import time
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "apps" / "backend"
FRONTEND_DIR = PROJECT_ROOT / "apps" / "frontend"
E2E_DIR = FRONTEND_DIR / "tests"
REPORT_DIR = PROJECT_ROOT / ".trae" / "documents" / "testing"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

TIMESTAMP = datetime.utcnow().strftime("%Y%m%d_%H%M%S")


def ensure_test_db_dir():
    db_dir = Path("D:/data/finestem")
    db_dir.mkdir(parents=True, exist_ok=True)


def run_backend_tests() -> dict:
    print("\n" + "=" * 60)
    print("  [1/2] 运行后端 API 集成测试")
    print("=" * 60 + "\n")

    ensure_test_db_dir()

    env = os.environ.copy()
    env["SECRET_KEY"] = "test-secret-key-for-automated-testing"
    env["DEBUG"] = "true"
    env["DATABASE_URL"] = "sqlite:///D:/data/finestem/test_finestem.db"

    report_file = REPORT_DIR / f"backend_report_{TIMESTAMP}.html"

    cmd = [
        sys.executable, "-m", "pytest",
        str(BACKEND_DIR / "tests"),
        "-v",
        "--tb=short",
        f"--html={report_file}",
        "--self-contained-html",
        "-x",
    ]

    start = time.time()
    result = subprocess.run(cmd, cwd=str(BACKEND_DIR), env=env, capture_output=False)
    elapsed = time.time() - start

    return {
        "module": "后端 API 集成测试",
        "exit_code": result.returncode,
        "elapsed_seconds": round(elapsed, 2),
        "report_path": str(report_file),
        "passed": result.returncode == 0,
    }


def run_frontend_e2e_tests() -> dict:
    print("\n" + "=" * 60)
    print("  [2/2] 运行前端 E2E 测试")
    print("=" * 60 + "\n")

    if not (E2E_DIR / "node_modules").exists():
        print("  安装 Playwright 依赖...")
        subprocess.run(
            [sys.executable, "-m", "npm", "install"],
            cwd=str(E2E_DIR),
            capture_output=True,
        )
        subprocess.run(
            [sys.executable, "-m", "npx", "playwright", "install", "chromium"],
            cwd=str(E2E_DIR),
            capture_output=True,
        )

    cmd = [
        sys.executable, "-m", "npx", "playwright", "test",
        "--reporter=html",
    ]

    start = time.time()
    result = subprocess.run(cmd, cwd=str(E2E_DIR), capture_output=False)
    elapsed = time.time() - start

    return {
        "module": "前端 E2E 测试",
        "exit_code": result.returncode,
        "elapsed_seconds": round(elapsed, 2),
        "report_path": str(E2E_DIR / "test-results" / "e2e-report" / "index.html"),
        "passed": result.returncode == 0,
    }


def generate_summary(results: list[dict]):
    print("\n" + "=" * 60)
    print("  测试执行总结")
    print("=" * 60)

    all_passed = True
    for r in results:
        status = "通过" if r["passed"] else "失败"
        icon = "OK" if r["passed"] else "FAIL"
        print(f"  [{icon}] {r['module']}: {status} ({r['elapsed_seconds']}s)")
        if not r["passed"]:
            all_passed = False
        if r.get("report_path"):
            print(f"       报告: {r['report_path']}")

    summary = {
        "timestamp": TIMESTAMP,
        "utc_time": datetime.utcnow().isoformat(),
        "overall_passed": all_passed,
        "results": results,
    }

    summary_path = REPORT_DIR / f"test_summary_{TIMESTAMP}.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\n  总结报告: {summary_path}")

    if all_passed:
        print("\n  全部测试通过！")
    else:
        print("\n  存在测试失败，请检查报告。")

    return all_passed


def main():
    print(f"\n  fineSTEM 全量自动化测试")
    print(f"  时间: {datetime.utcnow().isoformat()}")
    print(f"  项目: {PROJECT_ROOT}")

    results = []

    backend_result = run_backend_tests()
    results.append(backend_result)

    frontend_result = run_frontend_e2e_tests()
    results.append(frontend_result)

    all_passed = generate_summary(results)
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
