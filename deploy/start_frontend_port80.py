#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
使用 Python HTTP Server 托管前端文件 - 端口80
"""

import http.server
import socketserver
import os
from pathlib import Path

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """自定义HTTP请求处理器"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="C:\\wwwroot\\finestem\\frontend", **kwargs)

    def end_headers(self):
        """添加CORS头"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        # 对于所有请求，返回index.html
        if self.path == '/finestem/' or self.path == '/finestem' or self.path == '/':
            self.path = '/index.html'
        elif self.path.startswith('/finestem/'):
            self.path = self.path[9:]
        return super().do_GET()

def start_server():
    """启动HTTP服务器"""
    PORT = 80
    DIRECTORY = "C:\\wwwroot\\finestem\\frontend"

    # 检查前端目录
    if not os.path.exists(DIRECTORY):
        print(f"错误: 前端目录不存在: {DIRECTORY}")
        os.makedirs(DIRECTORY, exist_ok=True)
        
        # 创建默认的index.html
        index_html = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>fineSTEM 系统</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .container { background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); padding: 40px; max-width: 800px; width: 100%; }
        .header { text-align: center; margin-bottom: 40px; }
        .logo { font-size: 48px; font-weight: bold; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 10px; }
        .status { display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 30px; padding: 15px; background: #f0f9ff; border-radius: 8px; }
        .status-icon { font-size: 24px; }
        .status-text { font-size: 16px; color: #0369a1; font-weight: 600; }
        .links { display: grid; gap: 15px; margin-bottom: 30px; }
        .link-item { display: flex; align-items: center; gap: 15px; padding: 20px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; text-decoration: none; color: inherit; transition: all 0.3s ease; }
        .link-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-color: #667eea; }
        .link-icon { font-size: 28px; }
        .link-info { flex: 1; }
        .link-title { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
        .link-url { font-size: 14px; color: #64748b; word-break: break-all; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="logo">fineSTEM</h1>
            <p style="color: #64748b; font-size: 18px;">STEM 教育学习系统</p>
        </div>
        <div class="status">
            <span class="status-icon">✓</span>
            <span class="status-text">系统正在运行中</span>
        </div>
        <div class="links">
            <a href="http://122.51.71.4:8000/finestem/api/" class="link-item" target="_blank">
                <span class="link-icon">🚀</span>
                <div class="link-info">
                    <div class="link-title">后端 API</div>
                    <div class="link-url">http://122.51.71.4:8000/finestem/api/</div>
                </div>
            </a>
            <a href="http://122.51.71.4:8000/finestem/api/docs" class="link-item" target="_blank">
                <span class="link-icon">📚</span>
                <div class="link-info">
                    <div class="link-title">API 文档</div>
                    <div class="link-url">http://122.51.71.4:8000/finestem/api/docs</div>
                </div>
            </a>
        </div>
    </div>
    <script>
        async function checkBackendStatus() {
            try {
                const response = await fetch("http://122.51.71.4:8000/finestem/api/");
                if (response.ok) {
                    document.querySelector(".status").innerHTML = "<span class=\"status-icon\">✓</span><span class=\"status-text\">后端API状态：正常</span>";
                } else {
                    throw new Error("Backend not responding");
                }
            } catch (error) {
                document.querySelector(".status").innerHTML = "<span class=\"status-icon\">✗</span><span class=\"status-text\">后端API状态：异常</span>";
                document.querySelector(".status").style.background = "#fef2f2";
                document.querySelector(".status-text").style.color = "#dc2626";
            }
        }
        window.addEventListener("load", checkBackendStatus);
    </script>
</body>
</html>'''
        with open(os.path.join(DIRECTORY, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(index_html)
        print(f"已创建默认index.html")

    # 切换到项目目录
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print(f"========================================")
    print(f"fineSTEM 前端 HTTP 服务器 (端口 80)")
    print(f"========================================")
    print(f"")
    print(f"前端目录: {DIRECTORY}")
    print(f"监听端口: {PORT}")
    print(f"访问地址: http://localhost:{PORT}")
    print(f"公网地址: http://122.51.71.4:{PORT}")
    print(f"项目路径: http://122.51.71.4:{PORT}/finestem/")
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
