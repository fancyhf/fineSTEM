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

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.schemas.common import ApiResponse
from app.schemas.evidence import Evidence
from app.schemas.auth import UserResponse
from app.repositories.runtime_db import db
from app.api.auth import get_current_user
from app.services.storage_service import storage_service
from app.services.screenshot_service import screenshot_service
from app.core.config import settings
from app.core.time_utils import utc_now_iso


router = APIRouter(prefix="/code", tags=["代码执行"])


# Streamlit 进程管理（单实例）
_streamlit_process: Optional[subprocess.Popen] = None
_streamlit_port: int = 8765
_streamlit_last_code: str = ""
_streamlit_workspace_dir: Optional[Path] = None


def _cleanup_streamlit_workspace_dir() -> None:
    global _streamlit_workspace_dir
    if _streamlit_workspace_dir and _streamlit_workspace_dir.exists():
        shutil.rmtree(_streamlit_workspace_dir, ignore_errors=True)
    _streamlit_workspace_dir = None


def _resolve_safe_relative_path(name: str) -> Path | None:
    normalized = str(name or "").replace("\\", "/").strip().lstrip("/")
    if not normalized:
        return None

    path = Path(normalized)
    if path.is_absolute():
        return None

    safe_parts: list[str] = []
    for part in path.parts:
        if part in {"", "."}:
            continue
        if part == "..":
            return None
        safe_parts.append(part)

    if not safe_parts:
        return None
    return Path(*safe_parts)


class CodeExecuteRequest(BaseModel):
    code: str
    language: str = "python"
    timeout: int = 10
    files: Optional[list] = None  # 多文件支持：[{name, language, content, is_main}]


class CodeExecuteResponse(BaseModel):
    success: bool
    output: str
    error: Optional[str] = None
    exit_code: Optional[int] = None
    mode: Optional[str] = None  # 执行模式：script/streamlit/demo/visualization
    preview_url: Optional[str] = None  # 预览 URL（Streamlit/HTML 服务）


# ── 代码模板库 ───────────────────────────────────────────────────────

_CODE_TEMPLATES = [
    {
        "id": "python_guess_number",
        "title": "猜数字游戏",
        "description": "电脑随机生成一个数字，你来猜，提示大了还是小了",
        "language": "python",
        "icon": "dice",
        "difficulty": "初级",
        "code": '''import random

# 猜数字游戏
print("欢迎来到猜数字游戏！")
print("我已经想好了一个 1-100 之间的数字")

answer = random.randint(1, 100)
attempts = 0

while True:
    guess = input("请输入你猜的数字（1-100）：")
    try:
        guess_num = int(guess)
    except ValueError:
        print("请输入一个有效的数字！")
        continue

    attempts += 1

    if guess_num < answer:
        print("太小了，再大一点！")
    elif guess_num > answer:
        print("太大了，再小一点！")
    else:
        print(f"恭喜你猜对了！答案是 {answer}，你用了 {attempts} 次")
        break
''',
    },
    {
        "id": "python_chart",
        "title": "数据小图表",
        "description": "用 matplotlib 画一个简单的柱状图",
        "language": "python",
        "icon": "chart",
        "difficulty": "初级",
        "code": '''import matplotlib.pyplot as plt

# 你的成绩数据
subjects = ['语文', '数学', '英语', '科学', '体育']
scores = [85, 92, 78, 88, 95]

# 画柱状图
plt.figure(figsize=(8, 5))
bars = plt.bar(subjects, scores, color=['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'])

# 在柱子上方显示数值
for bar, score in zip(bars, scores):
    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
             str(score), ha='center', va='bottom', fontsize=12)

plt.title('我的成绩柱状图', fontsize=16)
plt.ylabel('分数', fontsize=12)
plt.ylim(0, 100)
plt.grid(axis='y', alpha=0.3)
plt.tight_layout()
plt.savefig('my_chart.png', dpi=150)
print("图表已保存为 my_chart.png")
plt.show()
''',
    },
    {
        "id": "html_first_page",
        "title": "我的第一个网页",
        "description": "用 HTML+CSS 做一个个人介绍页面",
        "language": "html",
        "icon": "globe",
        "difficulty": "初级",
        "code": '''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>我的个人介绍</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 40px;
            min-height: 100vh;
        }
        .card {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            margin: 0 auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { color: #333; text-align: center; }
        .emoji { font-size: 60px; text-align: center; }
        p { color: #666; line-height: 1.8; }
        .tag {
            display: inline-block;
            background: #f0f0f0;
            padding: 4px 12px;
            border-radius: 20px;
            margin: 4px;
            font-size: 14px;
            color: #555;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="emoji">👋</div>
        <h1>你好，我是小明</h1>
        <p>我是一名初中生，喜欢编程和科学实验。</p>
        <p>我的爱好：</p>
        <span class="tag">编程</span>
        <span class="tag">篮球</span>
        <span class="tag">看书</span>
        <span class="tag">画画</span>
    </div>
</body>
</html>
''',
    },
    {
        "id": "python_streamlit_app",
        "title": "Streamlit 小应用",
        "description": "用 Streamlit 做一个交互式 BMI 计算器",
        "language": "python",
        "icon": "rocket",
        "difficulty": "中级",
        "code": '''import streamlit as st

st.title("BMI 健康计算器")
st.write("输入你的身高和体重，计算 BMI 指数")

# 输入身高体重
height = st.slider("身高（厘米）", 100, 250, 170)
weight = st.slider("体重（公斤）", 30, 200, 65)

# 计算 BMI
bmi = weight / ((height / 100) ** 2)

# 显示结果
st.metric("BMI 指数", f"{bmi:.1f}")

# 判断等级
if bmi < 18.5:
    st.warning("偏瘦 - 注意营养均衡")
elif bmi < 24:
    st.success("正常 - 保持得好！")
elif bmi < 28:
    st.warning("偏胖 - 建议多运动")
else:
    st.error("肥胖 - 建议咨询医生")

st.write("---")
st.write("BMI 参考：正常范围 18.5-24")
''',
    },
    {
        "id": "python_calculator",
        "title": "简易计算器",
        "description": "支持加减乘除的命令行计算器",
        "language": "python",
        "icon": "calculator",
        "difficulty": "初级",
        "code": '''# 简易计算器
print("=== 简易计算器 ===")
print("支持运算：+  -  *  /")

while True:
    try:
        num1 = float(input("\\n请输入第一个数字："))
        op = input("请输入运算符（+ - * /）：").strip()
        num2 = float(input("请输入第二个数字："))

        if op == '+':
            result = num1 + num2
        elif op == '-':
            result = num1 - num2
        elif op == '*':
            result = num1 * num2
        elif op == '/':
            if num2 == 0:
                print("错误：除数不能为 0")
                continue
            result = num1 / num2
        else:
            print("不支持的运算符")
            continue

        print(f"结果：{num1} {op} {num2} = {result}")

    except ValueError:
        print("请输入有效的数字")

    again = input("\\n继续计算？(y/n)：")
    if again.lower() != 'y':
        print("再见！")
        break
''',
    },
    {
        "id": "python_todo",
        "title": "待办清单",
        "description": "管理你的每日任务，支持添加、完成、查看",
        "language": "python",
        "icon": "check",
        "difficulty": "中级",
        "code": '''# 待办清单管理器
todos = []

def add_todo(task):
    todos.append({"task": task, "done": False})
    print(f"已添加：{task}")

def complete_todo(index):
    if 0 <= index < len(todos):
        todos[index]["done"] = True
        print(f"已完成：{todos[index]['task']}")
    else:
        print("无效的序号")

def show_todos():
    if not todos:
        print("暂无待办事项")
        return
    print("\\n=== 我的待办清单 ===")
    for i, todo in enumerate(todos):
        status = "✓" if todo["done"] else "○"
        print(f"{i}. [{status}] {todo['task']}")
    print("==================\\n")

# 添加一些任务
add_todo("完成数学作业")
add_todo("阅读 30 分钟")
add_todo("练习编程 1 小时")

# 完成第一个任务
complete_todo(0)

# 显示所有任务
show_todos()
''',
    },
]


@router.get("/templates", response_model=ApiResponse[list])
async def get_code_templates():
    """
    获取代码模板列表（适合少儿的入门模板）
    """
    templates = [
        {
            "id": t["id"],
            "title": t["title"],
            "description": t["description"],
            "language": t["language"],
            "icon": t["icon"],
            "difficulty": t["difficulty"],
        }
        for t in _CODE_TEMPLATES
    ]
    return ApiResponse(data=templates, message="获取成功")


@router.get("/templates/{template_id}", response_model=ApiResponse[dict])
async def get_code_template(template_id: str):
    """
    获取指定模板的完整代码
    """
    for t in _CODE_TEMPLATES:
        if t["id"] == template_id:
            return ApiResponse(data=t, message="获取成功")
    raise HTTPException(status_code=404, detail="模板不存在")


@router.post("/execute", response_model=ApiResponse[CodeExecuteResponse])
async def execute_code(req: CodeExecuteRequest):
    """
    执行代码并返回结果

    支持的语言：
    - python: 智能识别脚本/Streamlit/Flask/数据可视化等模式
    - javascript: 使用 Node.js 执行（如果可用）
    - html: 直接返回作为预览

    多文件支持：如果 files 字段非空，将所有文件写入临时目录后执行主文件
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
        # 多文件模式：写入临时目录后执行
        if req.files:
            return await _execute_python_multifile(req.code, req.files, req.timeout)
        return await _execute_python_smart(req.code, req.timeout)

    if language in ("javascript", "js", "node"):
        return await _execute_javascript(req.code, req.timeout)

    raise HTTPException(status_code=400, detail=f"不支持的语言: {language}")


async def _execute_python_multifile(main_code: str, files: list, timeout: int = 10):
    """
    多文件 Python 执行：将所有文件写入临时目录，执行标记为 is_main 的文件
    """
    import json as _json
    tmp_dir = Path(tempfile.mkdtemp(prefix='finestem_multi_'))
    keep_tmp_dir = False

    try:
        # 写入所有文件到临时目录
        main_file_path = None
        for f in files:
            if not isinstance(f, dict):
                continue
            name = f.get('name', '')
            content = f.get('content', '')
            if not name or not content:
                continue

            # 安全检查：防止路径穿越
            safe_relative_path = _resolve_safe_relative_path(str(name))
            if not safe_relative_path:
                continue
            file_path = tmp_dir / safe_relative_path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content, encoding='utf-8')

            if f.get('is_main') or file_path.name.endswith('.py'):
                if main_file_path is None or f.get('is_main'):
                    main_file_path = file_path

        # 如果没有找到主文件，使用传入的 code 作为主文件
        if not main_file_path:
            main_file_path = tmp_dir / 'main.py'
            main_file_path.write_text(main_code, encoding='utf-8')

        # 检测运行模式
        main_content = main_file_path.read_text(encoding='utf-8')
        mode = _detect_python_mode(main_content)

        # Streamlit 模式：启动服务
        if mode == 'streamlit':
            result = await _start_streamlit_server_with_path(str(main_file_path), workspace_dir=tmp_dir)
            keep_tmp_dir = result.success
            return ApiResponse(data=result)

        # 普通脚本：注入辅助代码后执行
        main_content = _inject_utf8_stdio(main_content)
        main_content = _inject_matplotlib_cjk_config(main_content)
        main_content = _build_demo_injection(main_content)
        main_file_path.write_text(main_content, encoding='utf-8')

        loop = asyncio.get_running_loop()
        stdout, stderr, exit_code = await loop.run_in_executor(
            None, _run_subprocess,
            ['python', '-X', 'utf8', str(main_file_path)],
            timeout
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
        # 清理临时目录
        if not keep_tmp_dir:
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass


async def _start_streamlit_server_with_path(app_path: str, workspace_dir: Path | None = None) -> CodeExecuteResponse:
    """
    从指定路径启动 Streamlit 服务
    """
    global _streamlit_process, _streamlit_workspace_dir

    streamlit_exe = shutil.which('streamlit')
    if streamlit_exe:
        cmd = [streamlit_exe, 'run', app_path, '--server.port', str(_streamlit_port),
               '--server.headless', 'true', '--server.address', '127.0.0.1',
               '--browser.gatherUsageStats', 'false', '--server.fileWatcherType', 'none']
    else:
        cmd = ['python', '-m', 'streamlit', 'run', app_path, '--server.port', str(_streamlit_port),
               '--server.headless', 'true', '--server.address', '127.0.0.1',
               '--browser.gatherUsageStats', 'false', '--server.fileWatcherType', 'none']

    # 停止之前的 Streamlit
    if _streamlit_process and _streamlit_process.poll() is None:
        try:
            _streamlit_process.terminate()
            _streamlit_process.wait(timeout=2)
        except Exception:
            try:
                _streamlit_process.kill()
            except Exception:
                pass
    _cleanup_streamlit_workspace_dir()

    port = _streamlit_port
    while _is_port_listening(port):
        port += 1
        if port > 8800:
            return CodeExecuteResponse(
                success=False, output="", error="无可用端口启动 Streamlit",
                exit_code=-1, mode='streamlit',
            )

    # 更新命令中的端口
    cmd[cmd.index(str(_streamlit_port))] = str(port)

    try:
        _streamlit_process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env={**os.environ, 'PYTHONUTF8': '1'},
        )
    except Exception as e:
        return CodeExecuteResponse(
            success=False, output="", error=f"启动失败: {str(e)}",
            exit_code=-1, mode='streamlit',
        )

    # 等待就绪
    ready = False
    for _ in range(30):
        if _is_port_listening(port):
            ready = True
            break
        await asyncio.sleep(0.5)

    if not ready:
        try:
            _streamlit_process.terminate()
            _streamlit_process.wait(timeout=2)
        except Exception:
            try:
                _streamlit_process.kill()
            except Exception:
                pass
        _streamlit_process = None
        return CodeExecuteResponse(
            success=False, output="", error="Streamlit 启动超时（15秒）",
            exit_code=-1, mode='streamlit', preview_url=f'http://localhost:{port}',
        )

    _streamlit_workspace_dir = workspace_dir

    return CodeExecuteResponse(
        success=True, output=f"Streamlit 服务已启动在端口 {port}",
        exit_code=0, mode='streamlit', preview_url=f'http://localhost:{port}',
    )


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
        _cleanup_streamlit_workspace_dir()
        return ApiResponse(data={'stopped': True})
    _cleanup_streamlit_workspace_dir()
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


# ─────────────────────────────────────────────────────────────────────────────
# 运行预览自动截图（用于成果卡封面来源）
# ─────────────────────────────────────────────────────────────────────────────


class CapturePreviewRequest(BaseModel):
    project_id: str
    # 可选：当前预览 URL（如 Streamlit preview_url），不传则尝试当前运行中的 streamlit
    preview_url: Optional[str] = None
    # 可选：HTML 预览内容（同源 srcDoc/Blob 预览），不传则尝试项目工作区保存的 preview_html
    html: Optional[str] = None
    related_step: Optional[str] = None
    full_page: bool = False


def _resolve_preview_source(payload: CapturePreviewRequest) -> tuple[Optional[str], Optional[str]]:
    """返回 (preview_url, html)，无法确定来源时均为 None。"""
    url, html = payload.preview_url, payload.html
    if url or html:
        return url, html

    # 1) 当前正在运行的 Streamlit 服务
    if (
        _streamlit_process
        and _streamlit_process.poll() is None
        and _is_port_listening(_streamlit_port)
    ):
        return f"http://localhost:{_streamlit_port}", None

    try:
        workspace = db.get_project_workspace(payload.project_id) or {}
    except Exception:
        workspace = {}

    # 2) 项目工作区保存的 preview_html（运行代码后持久化的预览页）
    saved_html = str(workspace.get("preview_html") or "")
    if saved_html.strip():
        return None, saved_html

    # 3) 回退：工作区代码本身就是 HTML/JS（旧项目未保存 preview_html 时）
    code = str(workspace.get("code") or "")
    language = str(workspace.get("language") or "").lower()
    if code.strip() and (language in ("html", "htm") or code.lstrip().lower().startswith("<!doctype html") or "<html" in code.lower()[:500]):
        return None, code

    # 4) 回退：多文件工作区里找 HTML 主文件
    files = workspace.get("files") or []
    if isinstance(files, list):
        for f in files:
            if not isinstance(f, dict):
                continue
            fname = str(f.get("name") or "").lower()
            content = str(f.get("content") or "")
            if (fname.endswith((".html", ".htm")) or content.lstrip().lower().startswith("<!doctype html")) and content.strip():
                return None, content

    return None, None


@router.post("/capture-preview", response_model=ApiResponse[dict])
async def capture_preview(
    payload: CapturePreviewRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    对当前项目运行预览自动截图，并登记为项目 screenshot 证据（供成果卡封面选择）。

    截图来源优先级：payload.preview_url / payload.html > 当前运行中的 Streamlit > 项目工作区保存的 preview_html。
    """
    import logging as _logging
    _log = _logging.getLogger("app.api.code_execution.capture_preview")
    _log.info("capture_preview called project_id=%s user=%s preview_url=%s html_len=%d",
              payload.project_id, current_user.id, payload.preview_url, len(payload.html or ""))
    project = db.get_project(payload.project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if project.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作此项目")

    preview_url, html = _resolve_preview_source(payload)
    if not preview_url and not html:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="当前没有可截图的运行预览，请先在创建页运行项目代码后再采集",
        )

    loop = asyncio.get_running_loop()
    try:
        if preview_url:
            png = await loop.run_in_executor(
                None, screenshot_service.capture_url, preview_url, payload.full_page
            )
        else:
            png = await loop.run_in_executor(
                None, screenshot_service.capture_html, html, payload.full_page
            )
    except RuntimeError as e:
        # playwright 的 Error 也是 RuntimeError 子类，把类型名带上避免 detail 为空
        detail = str(e) or e.__class__.__name__
        _log.exception("capture_preview 截图失败(RuntimeError) project_id=%s", payload.project_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)
    except Exception as e:
        _log.exception("capture_preview 截图失败 project_id=%s", payload.project_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"截图失败：{e}",
        )

    if not png:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="截图为空",
        )

    meta = storage_service.save_screenshot_bytes(
        owner_id=current_user.id,
        project_id=payload.project_id,
        content=png,
    )
    uploads_base = Path(settings.STORAGE_BASE_PATH) / settings.STORAGE_UPLOAD_DIR
    try:
        rel_path = Path(meta["stored_path"]).relative_to(uploads_base)
    except ValueError:
        rel_path = Path(meta["stored_path"]).name
    public_url = f"/uploads/{rel_path.as_posix()}"

    evidence = Evidence(
        project_id=payload.project_id,
        author_id=current_user.id,
        type="screenshot",
        title=payload.related_step or "项目运行截图",
        content=f"运行截图自动采集 @ {utc_now_iso()}",
        content_url=public_url,
        related_step=payload.related_step,
        created_by=current_user.id,
    )
    created = db.create_evidence(evidence)
    return ApiResponse(
        data={"id": created.id, "title": created.title, "url": created.content_url},
        message="运行截图已自动采集",
    )
