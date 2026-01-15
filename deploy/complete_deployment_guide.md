# fineSTEM Windows 服务器完整部署指南

## 部署状态

### ✅ 已完成
1. **防火墙配置**
   - 端口 8000（后端API）：已开放
   - 端口 8081（前端）：已开放
   - 端口 80/443（HTTP/HTTPS）：已开放

2. **后端服务**
   - Python 3.8.6 环境
   - 依赖已安装（fastapi, uvicorn, pandas, 等）
   - 后端服务已启动
   - 健康检查：`http://localhost:8000/finestem/api/health` 返回正常

3. **文件部署**
   - 项目代码已下载到 `C:\wwwroot\finestem`
   - 后端代码：`C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend`
   - 前端临时页面：`C:\wwwroot\finestem\frontend\index.html`

### ⏸️ 待完成
1. **前端文件上传**（通过宝塔面板）
2. **宝塔面板网站配置**
3. **反向代理配置**
4. **公网访问测试**

---

## 宝塔面板配置步骤

### 1. 登录宝塔面板
- 地址：`http://122.51.71.4:8888`
- 用户名/密码：您的宝塔面板凭据

### 2. 创建网站
1. 进入"网站"菜单
2. 点击"添加站点"
3. 填写配置：
   - **域名**：`122.51.71.4` 或您的域名
   - **根目录**：`C:\wwwroot\finestem\frontend`
   - **PHP版本**：纯静态（选择"静态"）
   - **FTP**：不需要创建
   - **数据库**：不需要创建
4. 点击"提交"

### 3. 上传前端文件
**方法A：通过宝塔面板上传（推荐）**
1. 在宝塔面板中进入"网站" → 找到您的网站 → 点击"根目录"
2. 删除默认的 `index.html`
3. 点击"上传"按钮
4. 从本地上传以下文件：
   - 从本地 `apps\public-web\src\features\mvp\phase1\web\dist` 目录
   - 上传所有文件和文件夹到网站根目录
   - 确保 `index.html` 在根目录

**方法B：使用 FTP/SFTP**
- 使用 FileZilla 等工具连接服务器
- 上传 dist 文件夹内容到 `C:\wwwroot\finestem\frontend`

**方法C：使用本地上传脚本**
- 在本地创建一个 PowerShell 脚本打包前端文件
- 使用 TAT 执行命令解压到服务器

### 4. 配置反向代理
1. 在宝塔面板中进入"网站" → 点击您的网站 → "设置"
2. 选择"反向代理"标签页
3. 点击"添加反向代理"
4. 填写配置：
   - **代理名称**：`finestem-api`
   - **目标URL**：`http://127.0.0.1:8000`
   - **发送域名**：`$host`
   - **高级设置**：
     - **代理目录**：`/finestem/api/`
     - **目标目录**：`/`
5. 点击"提交"

### 5. 检查配置
1. 访问 `http://122.51.71.4/` 应该看到前端页面
2. 点击前端页面，测试 API 调用是否正常
3. 检查浏览器控制台是否有错误

---

## 后端服务管理

### 启动后端服务
```bash
cd C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --root-path /finestem/api
```

### 停止后端服务
```bash
# 方法1：通过任务管理器
# 找到 python.exe 进程并结束

# 方法2：通过 PowerShell
Stop-Process -Name python -Force
```

### 检查服务状态
```bash
# 检查端口占用
netstat -ano | findstr 8000

# 测试健康检查
curl http://localhost:8000/finestem/api/health

# 或使用 PowerShell
Invoke-WebRequest -Uri 'http://localhost:8000/finestem/api/health'
```

### 查看后端日志
如果后端使用日志文件：
```bash
Get-Content C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend\logs\app.log -Tail 50
```

---

## 环境变量配置

确保以下环境变量配置正确：

### 后端配置文件
位置：`C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend\.env.production`

```env
PORT=8000
ROOT_PATH=/finestem/api
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### 前端配置
前端构建时已配置：
- API基础路径：`/finestem/api`
- 静态资源路径：`/finestem/`

---

## 故障排查

### 1. 前端无法访问
**检查清单：**
- [ ] 宝塔面板中网站已创建
- [ ] 前端文件已上传到正确目录
- [ ] `index.html` 存在于网站根目录
- [ ] 网站端口 80 已开放
- [ ] 浏览器缓存已清除

**解决方案：**
1. 检查宝塔面板网站列表中的状态
2. 点击网站设置 → 查看访问日志
3. 确保 Nginx 或 IIS 服务正在运行

### 2. API 调用失败（404/500错误）
**检查清单：**
- [ ] 后端服务正在运行
- [ ] 反向代理配置正确
- [ ] 目标URL：`http://127.0.0.1:8000`
- [ ] 代理目录：`/finestem/api/`

**解决方案：**
1. 测试后端服务：`curl http://localhost:8000/finestem/api/health`
2. 检查宝塔面板反向代理配置
3. 查看反向代理日志
4. 确保后端端口 8000 未被防火墙阻止

### 3. 后端服务无法启动
**检查清单：**
- [ ] Python 3.8+ 已安装
- [ ] 所有依赖已安装
- [ ] 端口 8000 未被占用
- [ ] 环境变量配置正确

**解决方案：**
```bash
# 检查 Python 版本
python --version

# 检查依赖
pip list | findstr fastapi

# 检查端口占用
netstat -ano | findstr 8000

# 手动测试启动
cd C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend
python main.py
```

### 4. 公网无法访问
**检查清单：**
- [ ] 云防火墙规则已添加
- [ ] Windows 防火墙允许端口 8000 和 80
- [ ] 宝塔面板端口配置正确

**解决方案：**
1. 重新添加云防火墙规则（已添加）
2. 检查 Windows 防火墙：
   - 控制面板 → Windows 防火墙
   - 高级设置 → 入站规则
   - 添加规则允许端口 8000

---

## 访问地址

### 公网访问
- **前端完整地址**：`http://122.51.71.4/finestem/`
- **后端API**：`http://122.51.71.4:8000/finestem/api/`
- **健康检查**：`http://122.51.71.4:8000/finestem/api/health`

### 本地访问（服务器内）
- **后端**：`http://localhost:8000/finestem/api/`
- **健康检查**：`http://localhost:8000/finestem/api/health`

---

## 下一步优化建议

### 1. 配置 HTTPS（推荐）
- 在宝塔面板中申请 Let's Encrypt 免费证书
- 开启强制 HTTPS

### 2. 后端服务化
使用 NSSM 或 Windows Service 将后端注册为 Windows 服务：
- 实现开机自启动
- 自动重启

### 3. 配置日志监控
- 配置日志轮转
- 设置错误告警

### 4. 性能优化
- 启用 Nginx 缓存
- 配置 Gzip 压缩
- CDN 加速

---

## 联系与支持

如有问题，请检查：
1. 宝塔面板日志：网站 → 访问日志/错误日志
2. 后端日志：`backend\logs\` 目录
3. Windows 事件查看器：应用程序日志

---

**部署日期**：2025-12-29
**服务器IP**：122.51.71.4
**操作系统**：Windows（宝塔面板）
**Python版本**：3.8.6
