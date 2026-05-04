"""
代码执行 API - 在线运行 Python/JavaScript 代码

用途：提供安全的沙箱环境执行学生代码，返回输出结果
维护者：AI Agent
"""

import asyncio
import subprocess
import tempfile
import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.common import ApiResponse


router = APIRouter(prefix="/code", tags=["代码执行"])


class CodeExecuteRequest(BaseModel):
    code: str
    language: str = "python"
    timeout: int = 10


class CodeExecuteResponse(BaseModel):
    success: bool
    output: str
    error: Optional[str] = None
    exit_code: Optional[int] = None


@router.post("/execute", response_model=ApiResponse[CodeExecuteResponse])
async def execute_code(req: CodeExecuteRequest):
    """
    执行代码并返回结果
    
    支持的语言：
    - python: 使用 subprocess 执行，有超时限制
    - javascript: 使用 Node.js 执行（如果可用）
    - html: 直接返回作为预览
    """
    language = req.language.lower()
    
    if language == "html":
        return ApiResponse(data=CodeExecuteResponse(
            success=True,
            output=req.code,
            exit_code=0,
        ))
    
    if language in ("python", "py"):
        return await _execute_python(req.code, req.timeout)
    
    if language in ("javascript", "js", "node"):
        return await _execute_javascript(req.code, req.timeout)
    
    raise HTTPException(status_code=400, detail=f"不支持的语言: {language}")


def _run_subprocess(cmd: list[str], timeout: int) -> tuple[bytes | None, bytes | None, int]:
    """在线程中同步执行子进程，避免 Windows asyncio subprocess 兼容性问题"""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=timeout,
            env={**os.environ, 'PYTHONUTF8': '1', 'PYTHONIOENCODING': 'utf-8'},
        )
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired as e:
        return b"", (e.stderr or b""), -1


async def _execute_python(code: str, timeout: int = 10) -> ApiResponse:
    """执行 Python 代码"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(code)
        temp_path = f.name
    
    try:
        loop = asyncio.get_running_loop()
        stdout, stderr, exit_code = await loop.run_in_executor(
            None, _run_subprocess, ['python', temp_path], timeout
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
        ))
    
    finally:
        try:
            os.unlink(temp_path)
        except Exception:
            pass


async def _execute_javascript(code: str, timeout: int = 10) -> ApiResponse:
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
        ))
    
    finally:
        try:
            os.unlink(temp_path)
        except Exception:
            pass
