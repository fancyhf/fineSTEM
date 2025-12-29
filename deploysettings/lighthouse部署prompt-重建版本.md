# 重建并部署 fineSTEM 项目到 lighthouse 服务器

## 要求
1. 使用 deploy_project_preparation 上传本地文件
2. 执行 docker-compose down 停止所有容器
3. 强制删除容器：docker rm -f finestem-backend finestem-frontend
4. 重新构建镜像：docker-compose build --no-cache backend frontend
5. 启动容器：docker-compose up -d
6. 验证服务健康状态：curl http://localhost:8000/finestem/api/health

## 服务器信息
- 实例ID: lhins-2yr8snuu
- 地域: ap-beijing
