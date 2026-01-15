#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Windows 环境部署脚本
适用于 Windows Server，不使用 Docker
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def run_command(cmd, cwd=None):
    """执行命令并输出结果"""
    print(f"执行: {cmd}")
    result = subprocess.run(
        cmd,
        shell=True,
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='ignore'
    )
    if result.returncode != 0:
        print(f"错误: {result.stderr}")
        return False
    print(result.stdout)
    return True

def check_python_version():
    """检查 Python 版本"""
    result = subprocess.run(
        ["python", "--version"],
        capture_output=True,
        text=True
    )
    print(f"Python 版本: {result.stdout.strip()}")

def install_backend_dependencies():
    """安装后端依赖"""
    backend_dir = "backend"
    requirements_file = os.path.join(backend_dir, "requirements.txt")

    if not os.path.exists(requirements_file):
        print(f"错误: {requirements_file} 不存在")
        return False

    print("安装后端依赖...")
    return run_command(f"pip install -r {requirements_file}", cwd=backend_dir)

def start_backend():
    """启动后端服务"""
    backend_dir = "backend"
    env_file = os.path.join(backend_dir, ".env.production")

    if not os.path.exists(env_file):
        print(f"警告: {env_file} 不存在，使用默认配置")

    print("启动后端服务...")
    # 使用 uvicorn 启动服务
    cmd = f"python -m uvicorn main:app --host 0.0.0.0 --port 8000 --root-path /finestem/api"
    return run_command(cmd, cwd=backend_dir)

def main():
    """主函数"""
    print("=== fineSTEM Windows 部署脚本 ===")
    print()

    # 检查 Python 版本
    check_python_version()
    print()

    # 安装后端依赖
    if not install_backend_dependencies():
        print("依赖安装失败")
        sys.exit(1)
    print()

    # 启动后端服务
    print("后端服务将在端口 8000 启动")
    print("访问地址: http://localhost:8000/finestem/api")
    print()
    print("按 Ctrl+C 停止服务")
    print()

    start_backend()

if __name__ == "__main__":
    main()
