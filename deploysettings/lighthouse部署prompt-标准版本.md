# 部署 fineSTEM 项目到 lighthouse 服务器

## 要求
1. 使用 deploy_project_preparation 上传本地文件到服务器
2. 只执行 docker-compose restart（不需要 build/down/up）
3. 如果只改了 .env.production，只重启 backend
4. 如果改了前端代码，也重启 frontend
5. ❌ 严禁重建镜像、删除容器、修改 docker-compose.yml
6. 验证服务健康状态：curl http://localhost:8000/finestem/api/health

## 服务器信息
- 实例ID: lhins-2yr8snuu
- 地域: ap-beijing
