# fineSTEM 部署总结

## 部署信息
- **服务器IP**: 122.51.71.4
- **实例ID**: lhins-o62txw76
- **地域**: ap-shanghai（上海）
- **操作系统**: Windows（宝塔面板）
- **Python版本**: 3.8.6
- **Node.js**: 未安装

---

## 已完成的部署步骤 ✅

### 1. 云服务器配置
- ✅ 腾讯云防火墙规则已添加
  - 端口 80（HTTP）
  - 端口 443（HTTPS）
  - 端口 8000（后端API）
  - 端口 8081（前端）
  - 端口 8888（宝塔面板）

### 2. 项目文件部署
- ✅ 从GitHub下载项目代码
- ✅ 解压到 `C:\wwwroot\finestem`
- ✅ 后端代码位置：`C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend`
- ✅ 前端目录准备：`C:\wwwroot\finestem\frontend`

### 3. Python环境配置
- ✅ Python 3.8.6 已安装
- ✅ pip 升级到 25.0.1
- ✅ 安装后端依赖：
  - fastapi==0.124.4
  - uvicorn[standard]==0.24.0
  - pandas==1.5.3（适配Python 3.8）
  - numpy==1.24.3
  - requests==2.31.0
  - beautifulsoup4==4.12.2
  - python-multipart==0.0.6
  - python-dotenv==1.0.0
  - httpx==0.28.1

### 4. 后端服务
- ✅ 后端服务已启动
- ✅ 运行在端口 8000
- ✅ 根路径配置：`/finestem/api`
- ✅ 健康检查正常：`http://localhost:8000/finestem/api/health`
- ✅ 创建了管理脚本 `deploy/manage_backend.bat`

### 5. 文档和配置
- ✅ 创建了完整的部署指南
- ✅ 创建了后端管理脚本
- ✅ 创建了Windows兼容的requirements文件
- ✅ 创建了部署状态文档

---

## 待完成的部署步骤 ⏸️

### 1. 前端文件上传（通过宝塔面板）
**优先级：高**

需要上传的前端文件位置：
- 本地：`apps\public-web\src\features\mvp\phase1\web\dist\`
- 服务器：`C:\wwwroot\finestem\frontend\`

**上传方法：**
1. 登录宝塔面板：`http://122.51.71.4:8888`
2. 进入"网站" → 创建站点或编辑现有站点
3. 使用文件管理器上传前端dist文件夹内容
4. 确保index.html在根目录

### 2. 宝塔面板网站配置
**优先级：高**

**网站配置：**
- 域名：`122.51.71.4` 或您的域名
- 根目录：`C:\wwwroot\finestem\frontend`
- 类型：纯静态网站

**反向代理配置：**
- 代理名称：`finestem-api`
- 目标URL：`http://127.0.0.1:8000`
- 代理目录：`/finestem/api/`
- 目标目录：`/`

### 3. 公网访问测试
**优先级：中**

测试项目：
1. 前端访问：`http://122.51.71.4/finestem/`
2. 后端API：`http://122.51.71.4:8000/finestem/api/`
3. 健康检查：`http://122.51.71.4:8000/finestem/api/health`

### 4. Windows防火墙配置（可选）
**优先级：低**

如果公网无法访问，需要添加Windows防火墙规则：
- 允许入站连接到端口 8000
- 允许入站连接到端口 80

---

## 部署后的访问地址

### 内网访问（服务器上）
- 前端：通过宝塔面板配置的网站根目录
- 后端API：`http://localhost:8000/finestem/api/`
- 健康检查：`http://localhost:8000/finestem/api/health`

### 公网访问（配置宝塔后）
- 前端完整地址：`http://122.51.71.4/finestem/`
- 后端API：`http://122.51.71.4:8000/finestem/api/`
- 健康检查：`http://122.51.71.4:8000/finestem/api/health`

---

## 管理脚本

### 后端服务管理
位置：`deploy/manage_backend.bat`

使用方法：
```bash
# 启动服务
manage_backend.bat start

# 停止服务
manage_backend.bat stop

# 重启服务
manage_backend.bat restart

# 查看状态
manage_backend.bat status

# 测试连接
manage_backend.bat test
```

---

## 重要文件位置

### 服务器路径
- 项目根目录：`C:\wwwroot\finestem`
- 后端代码：`C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend`
- 前端文件：`C:\wwwroot\finestem\frontend`
- 后端配置：`C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend\.env.production`

### 本地路径
- 项目根目录：`g:\mediaProjects\fineSTEM`
- 后端代码：`apps\public-web\src\features\mvp\phase1\backend`
- 前端代码：`apps\public-web\src\features\mvp\phase1\web`
- 前端构建：`apps\public-web\src\features\mvp\phase1\web\dist`
- 部署文档：`deploy\`

---

## 快速命令参考

### 服务器上启动后端
```bash
cd C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --root-path /finestem/api
```

### 检查后端状态
```bash
# 检查端口
netstat -ano | findstr 8000

# 健康检查
curl http://localhost:8000/finestem/api/health

# 或使用 PowerShell
Invoke-WebRequest -Uri 'http://localhost:8000/finestem/api/health'
```

### 查看宝塔面板
- 地址：`http://122.51.71.4:8888`
- 需要您的宝塔面板用户名和密码

---

## 故障排查

### 后端无法启动
1. 检查Python版本：`python --version`
2. 检查依赖：`pip list`
3. 检查端口占用：`netstat -ano | findstr 8000`
4. 查看后端日志（如果有）

### API调用失败
1. 确认后端服务运行
2. 测试本地访问：`http://localhost:8000/finestem/api/health`
3. 检查防火墙规则
4. 检查宝塔反向代理配置

### 前端无法访问
1. 确认前端文件已上传
2. 检查宝塔网站配置
3. 查看宝塔访问日志
4. 检查浏览器控制台错误

---

## 下一步优化建议

1. **配置HTTPS**
   - 在宝塔面板申请Let's Encrypt免费证书
   - 开启强制HTTPS

2. **后端服务化**
   - 使用NSSM或Windows Service注册
   - 实现开机自启动

3. **日志监控**
   - 配置日志轮转
   - 设置错误告警

4. **性能优化**
   - 启用Nginx缓存
   - 配置Gzip压缩

---

## 联系与支持

- 腾讯云控制台：[腾讯云控制台](https://console.cloud.tencent.com/)
- 宝塔面板文档：[宝塔官方文档](https://www.bt.cn/bbs/)
- FastAPI文档：[FastAPI官方文档](https://fastapi.tiangolo.com/)

---

**部署日期**: 2025-12-29
**部署人员**: AI Agent
**状态**: 后端服务运行正常，等待前端配置
