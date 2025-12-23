#!/bin/bash

# CloudBase云函数部署脚本

echo "=========================================="
echo "   CloudBase云函数部署脚本"
echo "=========================================="
echo

# 配置
ENV_ID="cloud1-5g07azl0fdf36b21"
FUNCTION_NAME="finestem-backend"
FUNCTION_DIR="./cloud-functions/finestem-backend"

# 检查云函数目录
if [ ! -d "$FUNCTION_DIR" ]; then
    echo "错误: 云函数目录 $FUNCTION_DIR 不存在"
    exit 1
fi

echo "准备部署云函数..."
echo "环境ID: $ENV_ID"
echo "函数名称: $FUNCTION_NAME"
echo "函数目录: $FUNCTION_DIR"
echo

# 打包云函数
echo "打包云函数..."
cd "$FUNCTION_DIR"
zip -r ../function.zip .
cd - > /dev/null

# 显示部署说明
echo "=========================================="
echo "手动部署说明"
echo "=========================================="
echo "1. 登录腾讯云控制台"
echo "2. 进入CloudBase控制台"
echo "3. 选择环境: $ENV_ID"
echo "4. 进入云函数管理"
echo "5. 创建新函数或更新现有函数: $FUNCTION_NAME"
echo "6. 上传文件: $(pwd)/function.zip"
echo "7. 配置以下环境变量:"
echo "   - DEEPSEEK_API_KEY=sk-41c2d916808941a0bf1aa2613e910d80"
echo "   - DEEPSEEK_BASE_URL=https://api.deepseek.com"
echo "8. 设置内存: 256MB"
echo "9. 设置超时: 30秒"
echo "10. 部署完成后，测试访问:"
echo "    https://service-bihqgye1-1258344699.sh.run.tcloudbaseapp.com/finestem-backend/"
echo "=========================================="

# 创建README文件用于指导
echo "创建部署说明文档..."
cat > ../README_DEPLOYMENT.md << EOF
# CloudBase云函数部署指南

## 函数信息
- 函数名称: finestem-backend
- 运行环境: Node.js 16.13
- 内存: 256MB
- 超时: 30秒

## 部署步骤

### 1. 登录腾讯云控制台
访问: https://console.cloud.tencent.com/

### 2. 进入CloudBase控制台
- 搜索"CloudBase"
- 选择环境: $ENV_ID

### 3. 创建云函数
- 进入"云函数"服务
- 点击"新建"
- 输入函数名称: finestem-backend
- 选择运行环境: Node.js 16.13
- 上传函数代码包

### 4. 配置环境变量
在云函数配置中添加以下环境变量:
- DEEPSEEK_API_KEY=sk-41c2d916808941a0bf1aa2613e910d80
- DEEPSEEK_BASE_URL=https://api.deepseek.com
- ENVIRONMENT=production
- LOG_LEVEL=INFO

### 5. 测试函数
部署完成后，访问以下URL测试:
- 健康检查: https://service-bihqgye1-1258344699.sh.run.tcloudbaseapp.com/finestem-backend/health
- 聊天完成: https://service-bihqgye1-1258344699.sh.run.tcloudbaseapp.com/finestem-backend/chat/completions

### 6. 前端配置
前端应用已配置使用CloudBase API地址:
- 前端访问: https://cloud1-5g07azl0fdf36b21-1361381967.tcloudbaseapp.com/
- API地址: https://service-bihqgye1-1258344699.sh.run.tcloudbaseapp.com/finestem-backend-http
EOF

echo "部署说明文档已创建: $(pwd)/../README_DEPLOYMENT.md"