# Gunicorn 配置文件

# 工作进程数量
workers = 4

# 工作进程类型
worker_class = "uvicorn.workers.UvicornWorker"

# 绑定地址和端口
bind = "0.0.0.0:8000"

# 超时时间（秒）
timeout = 30

# 连接超时时间
keepalive = 2

# 最大请求数，超过后重启工作进程
max_requests = 1000
max_requests_jitter = 100

# 日志配置
accesslog = "-"  # 输出到标准输出
errorlog = "-"  # 输出到标准输出
loglevel = "info"

# 进程名称
proc_name = "finestem-backend"

# 允许的最大挂起连接数
backlog = 2048

# 环境变量
env = {"PYTHONUNBUFFERED": "1"}

# 预加载应用
preload_app = True
