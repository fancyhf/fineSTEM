# 部署配置目录 (deploysettings/)

本目录存放项目的部署配置，包括端口分配和启动脚本。

## 文件说明

| 文件 | 说明 |
|------|------|
| PORT_REGISTRY.json | 端口分配登记表 |

## 端口分配规则

### Apps 端口范围: 8000-8999

用于生产/演示应用的端口分配。

| 端口 | 服务 | 说明 | 路径 | 健康检查 |
|-------|------|------|------|----------|
| 8001 | public-web-backend | 后端 API | apps/public-web/src/features/mvp/phase1/backend | http://localhost:8001/api/health |
| 8081 | public-web-frontend | 前端 Web | apps/public-web/src/features/mvp/phase1/web | http://localhost:8081/health |

### Projects 端口范围: 4000-4999

用于开发/测试项目的端口分配。

| 端口 | 服务 | 说明 | 路径 | 健康检查 |
|-------|------|------|------|----------|
| 4001 | my-first-ai-project | 文学知识卡 (Flask) | projects/my-first-ai-project/src | http://localhost:4001 |
| 4002 | up-video-analyzer | UP主视频分析器 (Streamlit) | projects/up-video-analyzer | http://localhost:4002 |
| 4003 | smart-todo-list | 智能待办清单 (Next.js) | projects/smart-todo-list | http://localhost:4003 |

## 使用指南

### 查询端口分配

```bash
# 查看端口登记表
cat deploysettings/PORT_REGISTRY.json
```

### 分配新端口

1. 检查目标端口范围 (apps: 8000-8999, projects: 4000-4999)
2. 在 `available` 列表中选择可用端口
3. 更新 `PORT_REGISTRY.json`，添加到 `reserved` 部分
4. 从 `available` 中移除已分配的端口

### 检查端口占用

```bash
# Windows
netstat -ano | findstr :<端口号>

# 检查多个端口
netstat -ano | findstr ":4000 :4001 :4002 :4003"
```

## 启动服务

每个项目都有独立的启动脚本，详见各项目目录下的 `start.sh` 或 `start.ps1`。

### Apps 启动

```bash
# 启动 public-web 后端
cd apps/public-web/src/features/mvp/phase1/backend
./start.sh

# 启动 public-web 前端
cd apps/public-web/src/features/mvp/phase1/web
./start.sh
```

### Projects 启动

```bash
# 启动文学知识卡
cd projects/my-first-ai-project
./start.sh

# 启动视频分析器
cd projects/up-video-analyzer
./start.sh

# 启动智能待办清单
cd projects/smart-todo-list
./start.sh
```

## 注意事项

- 分配端口前务必检查端口是否被占用
- 更新端口分配后请同步更新 PORT_REGISTRY.json
- 健康检查地址可用于验证服务是否正常运行
- 开发和生产环境使用不同端口范围，避免冲突

---

[返回根目录](../README.md)
