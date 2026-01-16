#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
fineSTEM HTTP Server - Port 80
支持 /finestem/ 路径映射
"""

import http.server
import socketserver
import os
import sys

class FineSTEMHandler(http.server.SimpleHTTPRequestHandler):
    """自定义HTTP处理器，支持/finestem/路径映射"""
    
    def __init__(self, *args, **kwargs):
        # 设置根目录为frontend
        super().__init__(*args, directory="C:\\wwwroot\\finestem\\frontend", **kwargs)
    
    def do_GET(self):
        """处理GET请求，支持/finestem/路径"""
        print(f"Request: {self.path}")
        
        # 路径映射
        if self.path == "/finestem/" or self.path == "/finestem":
            print("  -> Redirecting to /index.html")
            self.path = "/index.html"
        elif self.path.startswith("/finestem/"):
            new_path = self.path[9:]  # 移除 /finestem/
            print(f"  -> Redirecting to {new_path}")
            self.path = new_path
        
        return super().do_GET()
    
    def end_headers(self):
        """添加CORS头"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def start_server():
    """启动HTTP服务器"""
    PORT = 80
    DIRECTORY = "C:\\wwwroot\\finestem\\frontend"
    
    # 检查目录
    if not os.path.exists(DIRECTORY):
        print(f"错误: 目录不存在 {DIRECTORY}")
        os.makedirs(DIRECTORY, exist_ok=True)
    
    # 检查index.html
    index_path = os.path.join(DIRECTORY, "index.html")
    if not os.path.exists(index_path):
        print(f"警告: {index_path} 不存在")
    
    print("=" * 50)
    print("fineSTEM HTTP Server")
    print("=" * 50)
    print(f"端口: {PORT}")
    print(f"目录: {DIRECTORY}")
    print(f"访问:")
    print(f"  - http://localhost:{PORT}/")
    print(f"  - http://localhost:{PORT}/finestem/")
    print(f"  - http://122.51.71.4:{PORT}/")
    print(f"  - http://122.51.71.4:{PORT}/finestem/")
    print("=" * 50)
    print("按 Ctrl+C 停止服务器")
    print("=" * 50)
    
    try:
        with socketserver.TCPServer(("0.0.0.0", PORT), FineSTEMHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
    except OSError as e:
        print(f"错误: {e}")
        print(f"端口 {PORT} 可能已被占用")
        sys.exit(1)

if __name__ == "__main__":
    start_server()
