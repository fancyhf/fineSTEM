#!/bin/bash

# 修复Windows换行符问题的脚本
echo "修复Windows换行符问题..."

# 修复Dockerfiles
find . -name "Dockerfile*" -type f -exec sed -i 's/\r$//' {} \;
echo "✓ Dockerfile换行符修复完成"

# 修复Shell脚本
find . -name "*.sh" -type f -exec sed -i 's/\r$//' {} \;
echo "✓ Shell脚本换行符修复完成"

# 修复配置文件
find . -name "*.conf" -type f -exec sed -i 's/\r$//' {} \;
echo "✓ 配置文件换行符修复完成"

# 修复Python文件
find . -name "*.py" -type f -exec sed -i 's/\r$//' {} \;
echo "✓ Python文件换行符修复完成"

echo "所有文件换行符修复完成！"