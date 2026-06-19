"""
代码执行 API - 在线运行 Python/JavaScript 代码

用途：提供安全的沙箱环境执行学生代码，返回输出结果
维护者：AI Agent
"""

import asyncio
import re
import subprocess
import tempfile
import os
import time
import signal
import socket
import shutil
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.common import ApiResponse


router = APIRouter(prefix="/code", tags=["代码执行"])


# Streamlit 进程管理（单实例）
_streamlit_process: Optional[subprocess.Popen] = None
_streamlit_port: int = 8765
_streamlit_last_code: str = ""


class CodeExecuteRequest(BaseModel):
    code: str
    language: str = "python"
    timeout: int = 10


class CodeExecuteResponse(BaseModel):
    success: bool
    output: str
    error: Optional[str] = None
    exit_code: Optional[int] = None
    mode: Optional[str] = None  # 执行模式：script/streamlit/demo/visualization
    preview_url: Optional[str] = None  # 预览 URL（Streamlit/HTML 服务）


@router.post("/execute", response_model=ApiResponse[CodeExecuteResponse])
async def execute_code(req: CodeExecuteRequest):
    """
    执行代码并返回结果

    支持的语言：
    - python: 智能识别脚本/Streamlit/Flask/数据可视化等模式
    - javascript: 使用 Node.js 执行（如果可用）
    - html: 直接返回作为预览
    """
    language = req.language.lower()

    if language == "html":
        return ApiResponse(data=CodeExecuteResponse(
            success=True,
            output=req.code,
            exit_code=0,
            mode="html",
        ))

    if language in ("python", "py"):
        return await _execute_python_smart(req.code, req.timeout)

    if language in ("javascript", "js", "node"):
        return await _execute_javascript(req.code, req.timeout)

    raise HTTPException(status_code=400, detail=f"不支持的语言: {language}")


def _is_port_listening(port: int) -> bool:
    """检测端口是否已被监听"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(('127.0.0.1', port)) == 0
    except Exception:
        return False


async def _start_streamlit_server(code: str) -> CodeExecuteResponse:
    """
    启动 Streamlit 服务（后台进程）并返回预览 URL
    """
    global _streamlit_process, _streamlit_last_code

    # 检测 streamlit 是否已安装
    streamlit_path = shutil.which('streamlit')
    if not streamlit_path:
        try:
            import streamlit  # noqa
        except ImportError:
            return CodeExecuteResponse(
                success=False,
                output="",
                error="未安装 streamlit 库。请运行: pip install streamlit",
                exit_code=-1,
                mode='streamlit',
            )

    # 写入临时文件
    tmp_dir = Path(tempfile.gettempdir()) / 'finestem_streamlit'
    tmp_dir.mkdir(exist_ok=True)
    app_path = tmp_dir / 'user_app.py'
    app_path.write_text(code, encoding='utf-8')

    # 如果之前的 Streamlit 还在运行，先关掉
    if _streamlit_process and _streamlit_process.poll() is None:
        try:
            _streamlit_process.terminate()
            _streamlit_process.wait(timeout=2)
        except Exception:
            try:
                _streamlit_process.kill()
            except Exception:
                pass

    # 寻找空闲端口
    port = _streamlit_port
    while _is_port_listening(port):
        port += 1
        if port > 8800:
            return CodeExecuteResponse(
                success=False,
                output="",
                error="无可用端口启动 Streamlit",
                exit_code=-1,
                mode='streamlit',
            )

    # 启动 streamlit（使用 python -m 避免 PATH 找不到问题）
    try:
        # 优先尝试 streamlit 命令，回退到 python -m
        streamlit_exe = shutil.which('streamlit')
        if streamlit_exe:
            cmd = [streamlit_exe, 'run', str(app_path), '--server.port', str(port), '--server.headless', 'true', '--server.address', '127.0.0.1', '--browser.gatherUsageStats', 'false', '--server.fileWatcherType', 'none']
        else:
            cmd = ['python', '-m', 'streamlit', 'run', str(app_path), '--server.port', str(port), '--server.headless', 'true', '--server.address', '127.0.0.1', '--browser.gatherUsageStats', 'false', '--server.fileWatcherType', 'none']
        _streamlit_process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={**os.environ, 'PYTHONUTF8': '1'},
        )
        _streamlit_last_code = code
    except FileNotFoundError:
        return CodeExecuteResponse(
            success=False,
            output="",
            error="未找到 streamlit 命令。请运行: pip install streamlit",
            exit_code=-1,
            mode='streamlit',
        )
    except Exception as e:
        return CodeExecuteResponse(
            success=False,
            output="",
            error=f"启动失败: {str(e)}",
            exit_code=-1,
            mode='streamlit',
        )

    # 等待服务就绪（最多 15 秒）
    ready = False
    for _ in range(30):
        if _is_port_listening(port):
            ready = True
            break
        await asyncio.sleep(0.5)

    if not ready:
        return CodeExecuteResponse(
            success=False,
            output="",
            error=f"Streamlit 启动超时（15秒）。请检查代码是否有语法错误。",
            exit_code=-1,
            mode='streamlit',
            preview_url=f'http://localhost:{port}',
        )

    return CodeExecuteResponse(
        success=True,
        output=f"🚀 Streamlit 服务已启动在端口 {port}",
        exit_code=0,
        mode='streamlit',
        preview_url=f'http://localhost:{port}',
    )


@router.post("/stop-streamlit", response_model=ApiResponse[dict])
async def stop_streamlit():
    """停止 Streamlit 服务"""
    global _streamlit_process
    if _streamlit_process and _streamlit_process.poll() is None:
        try:
            _streamlit_process.terminate()
            _streamlit_process.wait(timeout=3)
        except Exception:
            try:
                _streamlit_process.kill()
            except Exception:
                pass
        _streamlit_process = None
        return ApiResponse(data={'stopped': True})
    return ApiResponse(data={'stopped': False, 'message': '没有运行中的 Streamlit'})


def _run_subprocess(cmd: list[str], timeout: int) -> tuple[bytes | None, bytes | None, int]:
    """在线程中同步执行子进程，避免 Windows asyncio subprocess 兼容性问题"""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=timeout,
            env={
                **os.environ,
                'PYTHONUTF8': '1',
                'PYTHONIOENCODING': 'utf-8',
                'PYTHONLEGACYWINDOWSSTDIO': 'utf-8',
            },
        )
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired as e:
        return b"", (e.stderr or b""), -1


def _inject_utf8_stdio(code: str) -> str:
    """注入 UTF-8 标准输出/错误重定向，解决 Windows GBK 编码问题"""
    preamble = '''import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
del sys, io
'''
    return preamble + '\n' + code


def _inject_matplotlib_cjk_config(code: str) -> str:
    """检测代码是否使用 matplotlib，若是则注入中文字体配置"""
    mpl_indicators = ['matplotlib', 'plt.', 'pyplot', 'from pylab', 'import pylab']
    if not any(ind in code for ind in mpl_indicators):
        return code

    cjk_preamble = '''import matplotlib
import matplotlib.font_manager as fm
_cjk_fonts = ['Microsoft YaHei', 'SimHei', 'PingFang SC', 'Noto Sans CJK SC', 'WenQuanYi Micro Hei', 'Source Han Sans CN']
_font = None
for _f in _cjk_fonts:
    _candidates = fm.findSystemFonts(fontpaths=None, fontext='ttf')
    for _c in _candidates:
        if _f.lower() in _c.lower():
            _font = _f
            break
    if _font:
        matplotlib.rcParams['font.sans-serif'] = [_font] + matplotlib.rcParams['font.sans-serif']
    else:
        matplotlib.rcParams['font.sans-serif'] = ['DejaVu Sans']
    matplotlib.rcParams['axes.unicode_minus'] = False
del matplotlib, fm, _cjk_fonts, _font, _f, _candidates, _c
'''
    return cjk_preamble + '\n' + code


def _detect_python_mode(code: str) -> str:
    """
    智能检测 Python 代码运行模式
    返回: script / streamlit / flask / fastapi / django
    """
    if re.search(r'^\s*import\s+streamlit|^\s*from\s+streamlit|\bst\.', code, re.MULTILINE):
        return 'streamlit'
    if re.search(r'^\s*import\s+flask|^\s*from\s+flask', code, re.MULTILINE):
        return 'flask'
    if re.search(r'^\s*import\s+fastapi|^\s*from\s+fastapi', code, re.MULTILINE):
        return 'fastapi'
    if re.search(r'^\s*import\s+django|^\s*from\s+django', code, re.MULTILINE):
        return 'django'
    return 'script'


def _build_demo_injection(code: str) -> str:
    """
    为无 print 的脚本注入演示代码，自动输出所有顶层变量
    """
    if 'print(' in code or 'sys.exit' in code or 'raise ' in code:
        return code
    if not re.search(r'^[a-zA-Z_]\w*\s*=\s*[^=]', code, re.MULTILINE):
        return code

    injected = code + '''

# ===== 自动演示输出 =====
import json as _json
print("━" * 50)
print("📊 变量自动演示")
print("━" * 50)
_printable_vars = {}
for _name in dir():
    if _name.startswith('_'):
        continue
    _v = locals().get(_name) or globals().get(_name)
    if _v is None or callable(_v):
        continue
    try:
        _json.dumps(_v, ensure_ascii=False, default=str)
        _printable_vars[_name] = _v
    except Exception:
        _printable_vars[_name] = f"<{type(_v).__name__}>"
if _printable_vars:
    for _k, _v in _printable_vars.items():
        _repr = repr(_v)
        if len(_repr) > 200:
            _repr = _repr[:200] + "..."
        print(f"  • {_k} = {_repr}")
else:
    print("  (无可显示的变量)")
print("━" * 50)
'''
    return injected


async def _execute_python_smart(code: str, timeout: int = 10):
    """
    智能执行 Python 代码：自动识别 Streamlit/Flask/FastAPI 等框架
    """
    mode = _detect_python_mode(code)

    # Streamlit：真的启动服务，返回预览 URL
    if mode == 'streamlit':
        result = await _start_streamlit_server(code)
        return ApiResponse(data=result)

    if mode in ('flask', 'fastapi', 'django'):
        return ApiResponse(data=CodeExecuteResponse(
            success=False,
            output="",
            error=f"检测到 {mode.upper()} Web 框架。当前后端沙箱仅支持 Streamlit。\n建议：1) 用终端手动启动；2) 或将代码改写为 Streamlit 版本。",
            exit_code=-1,
            mode=mode,
        ))

    # 普通脚本：注入 UTF-8 + matplotlib CJK + 可选 demo
    code = _inject_utf8_stdio(code)
    code = _inject_matplotlib_cjk_config(code)
    code = _build_demo_injection(code)

    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(code)
        temp_path = f.name

    try:
        loop = asyncio.get_running_loop()
        stdout, stderr, exit_code = await loop.run_in_executor(
            None, _run_subprocess, ['python', '-X', 'utf8', temp_path], timeout
        )

        output = stdout.decode('utf-8', errors='replace') if stdout else ""
        error = stderr.decode('utf-8', errors='replace') if stderr else None

        success = exit_code == 0

        if exit_code == -1:
            error = error or f"代码执行超时（{timeout}秒限制）"

        return ApiResponse(data=CodeExecuteResponse(
            success=success,
            output=output,
            error=error if not success else None,
            exit_code=exit_code,
            mode='script',
        ))

    finally:
        try:
            os.unlink(temp_path)
        except Exception:
            pass


# 保留旧函数名以兼容历史调用
async def _execute_python(code: str, timeout: int = 10):
    return await _execute_python_smart(code, timeout)


async def _execute_javascript(code: str, timeout: int = 10):
    """执行 JavaScript 代码"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(code)
        temp_path = f.name

    try:
        loop = asyncio.get_running_loop()
        stdout, stderr, exit_code = await loop.run_in_executor(
            None, _run_subprocess, ['node', temp_path], timeout
        )

        output = stdout.decode('utf-8', errors='replace') if stdout else ""
        error = stderr.decode('utf-8', errors='replace') if stderr else None

        success = exit_code == 0

        if exit_code == -1:
            error = error or f"代码执行超时（{timeout}秒限制）"

        return ApiResponse(data=CodeExecuteResponse(
            success=success,
            output=output,
            error=error if not success else None,
            exit_code=exit_code,
            mode='script',
        ))

    finally:
        try:
            os.unlink(temp_path)
        except Exception:
            pass
