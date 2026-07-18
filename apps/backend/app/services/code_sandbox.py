"""
代码执行沙箱（供 AI 的 code_runner 工具使用）

用途：把 AI 提供的脚本隔离在临时目录里执行，剔除敏感环境变量。
背景：2026-07-18 事故中，CodeRunnerTool 用进程内 exec() 执行 AI 脚本，
     导致诊断脚本能扫描 D:/data/finestem/ 全目录、读取 ZEROCLAW_API_KEY 等密钥。
     本模块用子进程 + 临时目录 + env 过滤，挡住"无意扫描"和密钥泄露。

注意：这是"软沙箱"，不是 OS 级隔离——绝对路径访问仍可能。
     要更强隔离需叠加路径白名单或 OS 级沙箱（cgroup/seccomp/容器）。
维护者：AI Agent
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from typing import Any

logger = logging.getLogger(__name__)

# 默认执行超时（秒）。AI 的 code_runner 原硬编码 10 秒，沿用。
DEFAULT_TIMEOUT = 10

# 敏感环境变量黑名单——这些绝不能透传给 AI 脚本。
# 匹配规则：键名转小写后做子串匹配（Windows 环境变量大小写不敏感，会被规范化为大写）。
_SENSITIVE_ENV_PATTERNS_LOWER = (
    "api_key", "secret_key", "secret", "token", "password", "passwd",
    "glm_key", "deepseek_key", "database_url", "jwt_secret",
    "zeroclaw", "openai", "anthropic",
)


def _build_sandbox_env() -> dict[str, str]:
    """复制 os.environ 但剔除敏感变量，保留 Python 运行必需的编码变量。

    Windows 环境变量大小写不敏感，os.environ.items() 可能返回 GLM_KEY 而非 glm_key，
    所以匹配时统一转小写。
    """
    sandbox_env: dict[str, str] = {}
    for key, value in os.environ.items():
        key_lower = key.lower()
        if any(pattern in key_lower for pattern in _SENSITIVE_ENV_PATTERNS_LOWER):
            continue
        sandbox_env[key] = value
    # 强制保留 Python 编码相关变量（即便原环境没有）
    sandbox_env["PYTHONUTF8"] = "1"
    sandbox_env["PYTHONIOENCODING"] = "utf-8"
    if os.name == "nt":
        sandbox_env["PYTHONLEGACYWINDOWSSTDIO"] = "utf-8"
    return sandbox_env


def run_python_sandboxed(
    code: str,
    timeout: int = DEFAULT_TIMEOUT,
    stdin: str = "",
) -> dict[str, Any]:
    """
    在隔离的临时目录里执行 Python 代码。

    - 临时目录：tempfile.mkdtemp，执行后 shutil.rmtree 清理。
    - 工作目录：脚本 cwd = 临时目录，避免扫描后端/数据目录。
    - env：剔除密钥（_build_sandbox_env）。
    - 超时：subprocess.run timeout 真生效（修复了原 exec() 的超时死代码 bug）。

    返回:
        { success, stdout, stderr, exit_code }
    """
    tmp_dir = tempfile.mkdtemp(prefix="finestem_sandbox_")
    script_path = os.path.join(tmp_dir, "main.py")
    try:
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(code)

        try:
            result = subprocess.run(
                ["python", "-X", "utf8", script_path],
                input=stdin.encode("utf-8") if stdin else None,
                capture_output=True,
                timeout=timeout,
                cwd=tmp_dir,
                env=_build_sandbox_env(),
            )
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout.decode("utf-8", errors="replace"),
                "stderr": result.stderr.decode("utf-8", errors="replace"),
                "exit_code": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "stdout": "",
                "stderr": f"执行超时（{timeout}秒限制）",
                "exit_code": -1,
            }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def run_javascript_sandboxed(
    code: str,
    timeout: int = DEFAULT_TIMEOUT,
    stdin: str = "",
) -> dict[str, Any]:
    """
    在隔离的临时目录里执行 JavaScript（node）代码。

    相比原 CodeRunnerTool 的实现，本函数：
    - 用 -e 从 stdin 传码（避免 shell=True 拼字符串导致的命令注入）
    - 临时目录作 cwd
    - env 剔除密钥
    - 超时真生效

    返回:
        { success, stdout, stderr, exit_code }
    """
    tmp_dir = tempfile.mkdtemp(prefix="finestem_sandbox_js_")
    try:
        # 预处理：把 stdin 作为 _stdin 变量注入
        js_code = code
        if stdin:
            # 用 JSON 字面量安全注入，避免字符串拼接注入
            import json as _json
            js_code = f"const _stdin = {_json.dumps(stdin)};\n{js_code}"

        # 用 stdin 传码给 node（-e 从 stdin 读：实际用 --input-type=module -e 配合）
        # 更稳妥：把代码写到临时文件，node 执行文件（避免 -e 的 shell 转义问题）
        script_path = os.path.join(tmp_dir, "main.mjs")
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(js_code)

        try:
            result = subprocess.run(
                ["node", script_path],
                input=stdin.encode("utf-8") if stdin else None,
                capture_output=True,
                timeout=timeout,
                cwd=tmp_dir,
                env=_build_sandbox_env(),
            )
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout.decode("utf-8", errors="replace"),
                "stderr": result.stderr.decode("utf-8", errors="replace"),
                "exit_code": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "stdout": "",
                "stderr": f"执行超时（{timeout}秒限制）",
                "exit_code": -1,
            }
        except FileNotFoundError:
            return {
                "success": False,
                "stdout": "",
                "stderr": "未找到 node 可执行文件，无法执行 JavaScript",
                "exit_code": -1,
            }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
