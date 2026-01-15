import os
import subprocess
import sys
import time
import socket
import argparse
from datetime import datetime
import signal

def is_port_open(host, port):
    try:
        # Try both IPv4 and IPv6/localhost resolution
        for res in socket.getaddrinfo(host, port, socket.AF_UNSPEC, socket.SOCK_STREAM):
            af, socktype, proto, canonname, sa = res
            try:
                with socket.socket(af, socktype, proto) as s:
                    s.settimeout(1)
                    if s.connect_ex(sa) == 0:
                        return True
            except OSError:
                continue
    except socket.gaierror:
        pass
    return False

def wait_for_port(host, port, timeout=60, name="Service"):
    print(f"等待 {name} 启动 (端口 {port})...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        if is_port_open(host, port):
            print(f"✅ {name} 已在端口 {port} 上运行。")
            return True
        time.sleep(1)
    print(f"❌ {name} 启动超时。")
    return False

def run_tests():
    parser = argparse.ArgumentParser(description="运行 FineSTEM 自动化测试")
    parser.add_argument("--env", default="local", choices=["local", "prod"], help="测试环境 (local 或 prod)")
    args = parser.parse_args()

    # 配置路径
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(backend_dir, ".."))
    frontend_dir = os.path.join(project_root, "web")
    
    # 报告路径 (符合 Project Rule: .trae/documents/testing/)
    # 查找项目根目录（含有 .trae 的目录）
    current_search_dir = backend_dir
    project_root_dir = None
    while True:
        if os.path.exists(os.path.join(current_search_dir, ".trae")):
            project_root_dir = current_search_dir
            break
        parent = os.path.dirname(current_search_dir)
        if parent == current_search_dir:
            break
        current_search_dir = parent
        
    if project_root_dir:
        report_dir = os.path.join(project_root_dir, ".trae", "documents", "testing")
    else:
        # Fallback if not found
        print("警告: 未找到项目根目录(.trae)，使用默认报告目录。")
        report_dir = os.path.join(backend_dir, "reports")

    os.makedirs(report_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = os.path.join(report_dir, f"report_{args.env}_{timestamp}.html")

    # 环境变量设置
    # 使用新的 playwright 目录
    env_vars = os.environ.copy()
    env_vars["PLAYWRIGHT_BROWSERS_PATH"] = "D:\\dev-env\\playwright_browsers_new"
    
    processes = []
    
    try:
        if args.env == "local":
            print("正在启动本地测试环境...")
            
            # 1. 启动 Backend
            print("启动后端服务...")
            backend_cmd = [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001"]
            # 在 backend 目录下运行
            backend_proc = subprocess.Popen(backend_cmd, cwd=backend_dir, env=env_vars)
            processes.append(backend_proc)
            
            if not wait_for_port("127.0.0.1", 8001, name="Backend"):
                raise Exception("后端启动失败")

            # 2. 启动 Frontend
            print("启动前端服务...")
            # 确保 frontend_dir 存在
            if not os.path.exists(frontend_dir):
                raise Exception(f"前端目录不存在: {frontend_dir}")
                
            # Windows 下 npm 需要 shell=True 或者使用 npm.cmd
            npm_cmd = "npm.cmd" if os.name == 'nt' else "npm"
            frontend_cmd = [npm_cmd, "run", "dev", "--", "--port", "5174"]
            frontend_proc = subprocess.Popen(frontend_cmd, cwd=frontend_dir, env=env_vars)
            processes.append(frontend_proc)
            
            if not wait_for_port("localhost", 5174, name="Frontend"):
                raise Exception("前端启动失败")

        # 3. 运行测试
        print(f"开始运行测试... 报告: {report_file}")
        pytest_cmd = [
            sys.executable, "-m", "pytest",
            "tests/api", "tests/e2e",
            f"--html={report_file}",
            "--self-contained-html",
            f"--env={args.env}"
        ]
        
        # 运行 pytest
        result = subprocess.run(pytest_cmd, cwd=backend_dir, env=env_vars)
        
        if result.returncode == 0:
            print("\n✅ 所有测试通过！")
        else:
            print(f"\n❌ 测试失败，退出码: {result.returncode}")
            
        print(f"报告已生成: file:///{report_file.replace(os.sep, '/')}")

    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        # 清理进程
        if processes:
            print("正在停止后台服务...")
            for p in processes:
                try:
                    # Windows 下 terminate 可能不够，尝试 taskkill 如果需要
                    p.terminate()
                except Exception:
                    pass
            # 给一点时间让进程退出
            time.sleep(2)
            # 强制杀死
            for p in processes:
                try:
                    if p.poll() is None:
                        p.kill()
                except Exception:
                    pass

if __name__ == "__main__":
    run_tests()
