# FineSTEM 启动脚本说明

本文档说明了项目根目录下的启动脚本及其用途。

## 1. 脚本列表

| 脚本文件 | 用途 | 适用场景 | 依赖 |
| :--- | :--- | :--- | :--- |
| `start_system.bat` | 启动本地开发环境 | 开发、调试、编写代码 | Python, Node.js, NPM |
| `start_production.bat` | 启动本地生产环境 (Docker) | 部署验证、演示、全系统集成测试 | Docker Desktop |

## 2. 端口配置说明

为避免与本地其他服务冲突，项目端口已调整如下：

| 服务 | 类型 | 原端口 | **新端口** | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | 本地开发 | 8000 | **8001** | `start_system.bat` 启动的 uvicorn 服务 |
| **Frontend Web** | 本地开发 | 5173 | **5174** | `start_system.bat` 启动的 vite 服务 |
| **Backend API** | Docker 映射 | 8000 | **8001** | 宿主机 8001 -> 容器 8000 |
| **Frontend Web** | Docker 映射 | 8080 | **8081** | 宿主机 8081 -> 容器 80 |

## 3. 使用指南

### 3.1 启动本地开发环境 (`start_system.bat`)

双击运行或在命令行执行：
```cmd
start_system.bat
```

**执行流程：**
1. 启动后端服务 (Python Uvicorn) 在端口 **8001**。
2. 启动前端服务 (Vite Dev Server) 在端口 **5174**。
3. 等待 5 秒后自动打开浏览器访问 `http://localhost:5174`。

**注意：**
- 需确保已激活 Python 虚拟环境或已安装依赖。
- 需确保已在 `apps\public-web\src\features\mvp\phase1\web` 下执行过 `npm install`。

### 3.2 启动 Docker 环境 (`start_production.bat`)

双击运行或在命令行执行：
```cmd
start_production.bat
```

**执行流程：**
1. 检查 Docker Desktop 是否运行。
2. 停止并移除旧的 Docker 容器。
3. 重新构建镜像 (Build)。
4. 启动服务 (Up)。
5. 显示服务状态和访问地址。

**访问地址：**
- 前端页面: `http://localhost:8081/finestem`
- 后端 API: `http://localhost:8001/api`
- 健康检查: `http://localhost:8081/health`

## 4. 常见问题

**Q: 为什么修改了端口？**
A: 本地 8000, 8080, 5173 等常用端口容易被其他服务占用，修改为 8001, 8081, 5174 以减少冲突。

**Q: 如何修改回默认端口？**
A: 如需修改端口，需要同步更新以下文件：
- `start_system.bat`
- `vite.config.ts`
- `docker-compose.yml`
- `run_tests.py`
- `start_production.bat`

**Q: `start_system.bat` 启动后浏览器显示无法连接？**
A: 请检查命令行窗口是否有报错。可能是后端或前端服务启动失败（例如依赖未安装）。请尝试手动进入对应目录运行启动命令排查。
