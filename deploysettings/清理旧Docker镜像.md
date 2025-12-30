# 清理 fineSTEM 旧 Docker 镜像

## 适用场景
- 重建 Docker 镜像后
- 定期释放磁盘空间

## 执行步骤

```bash
# 1. 查看当前镜像
docker images | grep finestem

# 2. 清理旧镜像
docker image prune -a -f

# 3. 验证清理结果
docker images | grep finestem
```

## 服务器信息
- 实例ID: lhins-2yr8snuu
- 地域: ap-beijing
