#!/bin/bash
# 文学知识卡启动脚本
# 端口: 4001

cd "$(dirname "$0")"
PORT=4001

echo "=== 启动文学知识卡应用 ==="
echo "端口: $PORT"
echo "路径: $(pwd)"
echo ""

# 检查端口是否被占用
if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
    echo "错误: 端口 $PORT 已被占用"
    echo "请检查是否有其他服务正在运行"
    exit 1
fi

# 检查依赖
if ! command -v python &> /dev/null; then
    echo "错误: 未找到 Python"
    exit 1
fi

# 安装依赖
echo "检查依赖..."
pip install Flask

# 启动应用
echo "启动应用..."
cd src
export FLASK_APP=app.py
export FLASK_PORT=$PORT
python -c "from app import app; app.run(host='localhost', port=$PORT)"

echo "应用已停止"
