#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
使用 Python HTTP Server 托管前端文件
"""

import http.server
import socketserver
import os
from pathlib import Path

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """自定义HTTP请求处理器"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="frontend", **kwargs)

    def end_headers(self):
        """添加CORS头"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def start_server():
    """启动HTTP服务器"""
    PORT = 8081
    DIRECTORY = "frontend"

    # 检查前端目录
    if not os.path.exists(DIRECTORY):
        print(f"错误: 前端目录不存在: {DIRECTORY}")
        print(f"请确保前端文件已上传到 {DIRECTORY}")
        return

    # 切换到项目目录
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print(f"========================================")
    print(f"fineSTEM 前端 HTTP 服务器")
    print(f"========================================")
    print(f"")
    print(f"前端目录: {os.path.abspath(DIRECTORY)}")
    print(f"监听端口: {PORT}")
    print(f"访问地址: http://localhost:{PORT}")
    print(f"公网地址: http://122.51.71.4:{PORT}")
    print(f"")
    print(f"按 Ctrl+C 停止服务器")
    print(f"========================================")
    print(f"")

    # 创建并启动服务器
    try:
        with socketserver.TCPServer(("0.0.0.0", PORT), MyHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n服务器已停止")
    except OSError as e:
        print(f"错误: {e}")
        print(f"端口 {PORT} 可能已被占用")

if __name__ == "__main__":
    start_server()
