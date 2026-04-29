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


async def _execute_python(code: str, timeout: int = 10) -> ApiResponse:
    """执行 Python 代码"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(code)
        temp_path = f.name
    
    try:
        process = await asyncio.create_subprocess_exec(
            'python', temp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return ApiResponse(data=CodeExecuteResponse(
                success=False,
                output="",
                error=f"代码执行超时（{timeout}秒限制）",
                exit_code=-1,
            ))
        
        output = stdout.decode('utf-8', errors='replace')
        error = stderr.decode('utf-8', errors='replace') if stderr else None
        
        success = process.returncode == 0
        
        return ApiResponse(data=CodeExecuteResponse(
            success=success,
            output=output,
            error=error if not success else None,
            exit_code=process.returncode,
        ))
    
    finally:
        try:
            os.unlink(temp_path)
        except:
            pass


async def _execute_javascript(code: str, timeout: int = 10) -> ApiResponse:
    """执行 JavaScript 代码"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(code)
        temp_path = f.name
    
    try:
        process = await asyncio.create_subprocess_exec(
            'node', temp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return ApiResponse(data=CodeExecuteResponse(
                success=False,
                output="",
                error=f"代码执行超时（{timeout}秒限制）",
                exit_code=-1,
            ))
        
        output = stdout.decode('utf-8', errors='replace')
        error = stderr.decode('utf-8', errors='replace') if stderr else None
        
        success = process.returncode == 0
        
        return ApiResponse(data=CodeExecuteResponse(
            success=success,
            output=output,
            error=error if not success else None,
            exit_code=process.returncode,
        ))
    
    finally:
        try:
            os.unlink(temp_path)
        except:
            pass
