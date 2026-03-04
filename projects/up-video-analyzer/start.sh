#!/bin/bash
# UP主视频内容分析器启动脚本
# 端口: 4002

cd "$(dirname "$0")"
PORT=4002

echo "=== 启动 UP主视频内容分析器 ==="
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
if ! command -v streamlit &> /dev/null; then
    echo "错误: 未找到 Streamlit"
    echo "正在安装依赖..."
    pip install -r requirements.txt
fi

# 启动应用
echo "启动应用..."
streamlit run src/main.py --server.port=$PORT --server.headless=true

echo "应用已停止"
