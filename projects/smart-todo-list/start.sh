#!/bin/bash
# 智能待办清单启动脚本
# 端口: 4003

cd "$(dirname "$0")"
PORT=4003

echo "=== 启动智能待办清单 ==="
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
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 Node.js"
    exit 1
fi

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
fi

# 启动应用
echo "启动应用..."
npm run dev

echo "应用已停止"
