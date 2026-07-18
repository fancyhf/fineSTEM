"""
运行预览截图服务

用途：用无头浏览器对项目运行预览（Streamlit / HTML 等）自动截图，作为成果卡封面来源。

实现说明：
    Playwright 的 sync API 不能在 asyncio event loop 所在线程里使用（会抛
    NotImplementedError）。FastAPI 端点运行在 asyncio loop 中，即使通过
    run_in_executor 把任务丢到线程池，子线程依然会检测到主 loop 存在而报错。
    最可靠的解法是把截图逻辑放到独立子进程中执行，彻底隔离 event loop。
    本模块对外保持同步接口（capture_url / capture_html），内部 fork 一个
    Python 子进程跑 Playwright，通过 stdout 读取 PNG 的 base64。
"""

from __future__ import annotations

import base64
import json
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# 无头浏览器截图默认 viewport，与前端预览区比例接近 16:9
_DEFAULT_VIEWPORT = {"width": 1280, "height": 720}
_DEFAULT_TIMEOUT_MS = 15000

# 已知的浏览器二进制安装位置（按优先级回退）
_KNOWN_BROWSER_PATHS = [
    r"D:\dev-env\playwright_browsers_new",
    r"D:\dev-env\playwright_browsers",
    r"H:\dev-env\playwright",
]


def _ensure_browsers_path_env() -> Optional[str]:
    """
    确保 PLAYWRIGHT_BROWSERS_PATH 环境变量可用。

    - 若已设置则沿用。
    - 否则在已知默认位置中找到第一个存在且含 chromium 的目录写入环境变量。
    - 找不到则返回 None（调用方再按默认行为报错）。
    """
    existing = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if existing and Path(existing).exists():
        return existing

    for candidate in _KNOWN_BROWSER_PATHS:
        if not Path(candidate).exists():
            continue
        # 简单校验该目录下是否包含 chrome 可执行文件
        has_chrome = any(Path(candidate).rglob("chrome*.exe"))
        if has_chrome:
            os.environ["PLAYWRIGHT_BROWSERS_PATH"] = candidate
            logger.info("screenshot: 设置 PLAYWRIGHT_BROWSERS_PATH=%s", candidate)
            return candidate
    return None


# 子进程中执行的截图脚本。通过 stdin 接收 JSON 指令，stdout 输出 JSON 结果。
# 单独写成字符串以便子进程用 python -c 执行，避免模块导入路径问题。
_WORKER_SCRIPT = r'''
import base64, json, os, sys
from pathlib import Path

_KNOWN = [
    r"D:\dev-env\playwright_browsers_new",
    r"D:\dev-env\playwright_browsers",
    r"H:\dev-env\playwright",
]

def ensure_browser_path():
    existing = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if existing and Path(existing).exists():
        return existing
    for c in _KNOWN:
        if not Path(c).exists():
            continue
        if any(Path(c).rglob("chrome*.exe")):
            os.environ["PLAYWRIGHT_BROWSERS_PATH"] = c
            return c
    return None

def main():
    req = json.loads(sys.stdin.read())
    mode = req.get("mode")  # "url" or "html"
    target = req.get("target", "")
    full_page = bool(req.get("full_page", False))
    timeout = int(req.get("timeout", 15000))

    ensure_browser_path()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        print(json.dumps({"ok": False, "error": "未安装 playwright Python 包：" + str(e)}))
        return

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            try:
                page = browser.new_page(viewport={"width": 1280, "height": 720})
                if mode == "url":
                    page.goto(target, wait_until="networkidle", timeout=timeout)
                    page.wait_for_timeout(800)
                else:
                    page.set_content(target, wait_until="networkidle", timeout=timeout)
                    page.wait_for_timeout(400)
                png = page.screenshot(full_page=full_page, type="png")
                page.close()
                print(json.dumps({"ok": True, "png_b64": base64.b64encode(png).decode("ascii")}))
            finally:
                browser.close()
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}))

main()
'''


def _run_worker(mode: str, target: str, full_page: bool, timeout_ms: int) -> bytes:
    """
    在独立子进程中运行 Playwright 截图，返回 PNG 字节。

    子进程通过 stdin 接收指令，stdout 返回 JSON（含 png_b64 或 error）。
    """
    _ensure_browsers_path_env()
    req = json.dumps({
        "mode": mode,
        "target": target,
        "full_page": full_page,
        "timeout": timeout_ms,
    })
    # 用当前 Python 解释器执行 worker 脚本，继承环境变量（含 PLAYWRIGHT_BROWSERS_PATH）
    try:
        proc = subprocess.run(
            [sys.executable, "-c", _WORKER_SCRIPT],
            input=req,
            capture_output=True,
            text=True,
            timeout=90,
            encoding="utf-8",
        )
    except subprocess.TimeoutExpired as e:
        raise RuntimeError("截图子进程超时（>90s）") from e

    if proc.returncode != 0:
        stderr_tail = (proc.stderr or "")[-500:]
        raise RuntimeError(f"截图子进程退出码 {proc.returncode}，stderr: {stderr_tail}")

    stdout = (proc.stdout or "").strip()
    if not stdout:
        raise RuntimeError(f"截图子进程无输出，stderr: {(proc.stderr or '')[-500:]}")
    try:
        result = json.loads(stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"截图子进程输出非 JSON：{stdout[:300]}")

    if not result.get("ok"):
        raise RuntimeError(f"截图失败：{result.get('error', '未知错误')}")
    png_b64 = result.get("png_b64")
    if not png_b64:
        raise RuntimeError("截图子进程未返回 png_b64")
    return base64.b64decode(png_b64)


def capture_url(url: str, full_page: bool = False) -> bytes:
    """
    对指定 URL 截图，返回 PNG 字节。

    Args:
        url: 目标 URL（通常是 http://localhost:port 的 Streamlit 预览）。
        full_page: 是否截整页（默认只截首屏 1280x720）。

    Returns:
        PNG 字节流。
    """
    return _run_worker("url", url, full_page, _DEFAULT_TIMEOUT_MS)


def capture_html(html: str, full_page: bool = False) -> bytes:
    """
    对一段 HTML 内容截图（用于 HTML/JS/CSS 预览），返回 PNG 字节。
    """
    return _run_worker("html", html, full_page, _DEFAULT_TIMEOUT_MS)


screenshot_service = type(
    "ScreenshotService",
    (),
    {
        "capture_url": staticmethod(capture_url),
        "capture_html": staticmethod(capture_html),
    },
)()
