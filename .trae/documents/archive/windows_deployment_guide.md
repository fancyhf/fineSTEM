# fineSTEM Windows 服务器部署指南

## 服务器信息
- **IP地址**: 122.51.71.4
- **操作系统**: Windows (宝塔面板)
- **Python版本**: 3.8.6 (已安装)
- **Node.js**: 未安装

## 部署架构
- **前端**: 静态文件（已构建）
- **后端**: Python FastAPI + Uvicorn
- **Web服务器**: 使用宝塔面板配置 Nginx 或 IIS

## 部署步骤

### 1. 前端部署（静态文件）

**文件位置**: `apps/public-web/src/features/mvp/phase1/web/dist/`

**部署方式**:
- 在宝塔面板中创建网站
- 网站根目录指向 dist 文件夹
- 访问路径: `/finestem/`

### 2. 后端部署（Python FastAPI）

#### 2.1 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

**依赖列表**:
- fastapi==0.104.1
- uvicorn[standard]==0.24.0
- pandas==2.1.4
- numpy==1.24.3
- requests==2.31.0
- beautifulsoup4==4.12.2
- python-multipart==0.0.6
- python-dotenv==1.0.0
- httpx==0.25.2

#### 2.2 配置环境变量

确保 `.env.production` 文件存在并配置正确：

```env
PORT=8000
ROOT_PATH=/finestem/api
DEEPSEEK_API_KEY=your_api_key_here
```

#### 2.3 启动后端服务

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --root-path /finestem/api
```

#### 2.4 将后端服务注册为 Windows 服务（可选）

使用 `nssm` 或 `winsw` 将 Python 服务注册为 Windows 服务，实现开机自启动。

### 3. 配置反向代理（宝塔面板）

在宝塔面板中配置反向代理：

**前端代理**:
- 路径: `/finestem`
- 目标: `http://localhost:port`（如果使用独立Web服务器）

**后端API代理**:
- 路径: `/finestem/api/`
- 目标: `http://localhost:8000/`

### 4. 防火墙配置

已开放端口:
- 80 (HTTP) - 已开放
- 443 (HTTPS) - 已开放
- 8000 (后端API) - 已开放
- 8081 (前端备用) - 已开放

## 访问地址

- **完整地址**: http://122.51.71.4/finestem/
- **后端API**: http://122.51.71.4/finestem/api/

## 启动脚本示例

创建 `start_backend.bat`:

```batch
@echo off
cd /d %~dp0backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --root-path /finestem/api
pause
```

## 注意事项

1. **Python版本**: 确保使用 Python 3.8 或更高版本
2. **依赖安装**: 可能需要使用 `pip install --upgrade pip` 升级 pip
3. **端口冲突**: 确保 8000 端口未被占用
4. **CORS配置**: 如需要跨域访问，在 FastAPI 中配置 CORS
5. **日志管理**: 建议配置日志输出到文件，便于排查问题

## 故障排查

### 后端无法启动
- 检查 Python 版本: `python --version`
- 检查依赖是否安装: `pip list`
- 检查端口占用: `netstat -ano | findstr 8000`
- 查看错误日志

### 前端无法访问
- 检查 Nginx/IIS 配置
- 检查文件权限
- 查看访问日志

### API 调用失败
- 检查后端服务是否运行
- 检查反向代理配置
- 检查防火墙规则

## 下一步

1. 在服务器上创建部署目录
2. 上传前端和后端文件
3. 安装后端依赖
4. 启动后端服务
5. 配置宝塔面板反向代理
6. 测试访问
