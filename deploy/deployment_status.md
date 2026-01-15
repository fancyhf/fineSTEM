# fineSTEM Windows 服务器部署状态

## 服务器信息
- **IP地址**: 122.51.71.4
- **地域**: ap-shanghai（上海）
- **实例ID**: lhins-o62txw76
- **操作系统**: Windows（宝塔面板）
- **Python版本**: 3.8.6
- **Node.js**: 未安装

## 部署进度

### ✅ 已完成
1. **防火墙配置**
   - 端口 8000（后端API）：已开放
   - 端口 8081（前端）：已开放
   - 端口 80/443（HTTP/HTTPS）：已开放

2. **文件部署**
   - 从GitHub下载并解压项目文件到 `C:\wwwroot\finestem`
   - 后端代码位置：`C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend`

3. **Python环境**
   - pip已升级到 25.0.1
   - 创建了Python 3.8兼容的requirements文件（requirements_py38.txt）
   - 依赖安装正在进行中

### ⏳ 进行中
- **后端依赖安装**：pip install -r requirements_py38.txt（超时但可能在后台运行）

### ⏸️ 待完成
1. **前端部署**
   - 由于服务器没有Node.js，需要在本地构建前端
   - 将构建好的dist文件夹上传到服务器
   - 使用宝塔面板配置静态网站

2. **后端服务启动**
   - 确认依赖安装完成
   - 使用启动脚本启动后端服务
   - 配置为Windows服务（可选）

3. **反向代理配置**
   - 在宝塔面板中配置反向代理
   - 前端：`/finestem` → 前端静态文件
   - 后端：`/finestem/api/` → `http://localhost:8000/`

## 快速启动命令

### 1. 安装依赖（如果未完成）
```bash
cd C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend
pip install -r requirements_py38.txt
```

### 2. 启动后端服务
```bash
cd C:\wwwroot\finestem\apps\public-web\src\features\mvp\phase1\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --root-path /finestem/api
```

### 3. 测试后端
```bash
curl http://localhost:8000/finestem/api/health
```

## 宝塔面板配置

### 配置反向代理
1. 登录宝塔面板（端口8888）
2. 创建网站或编辑现有网站
3. 添加反向代理规则：
   - **代理名称**: finestem-api
   - **目标URL**: http://127.0.0.1:8000
   - **发送域名**: $host
   - **代理目录**: /finestem/api/

### 前端静态文件
1. 将前端dist文件上传到宝塔网站根目录
2. 创建虚拟目录 `/finestem` 指向前端文件
3. 或直接将文件放在网站的 `/finestem/` 目录下

## 注意事项

1. **Python版本限制**: Python 3.8不支持pandas 2.x，已降级到1.5.3
2. **Node.js未安装**: 需要手动构建前端或使用预构建文件
3. **防火墙**: 确保端口8000和8081已正确开放
4. **环境变量**: 确保`.env.production`文件存在并配置正确的API密钥

## 故障排查

### 依赖安装失败
```bash
# 升级pip
python -m pip install --upgrade pip

# 手动安装失败的单个包
pip install fastapi uvicorn pandas==1.5.3
```

### 后端无法启动
```bash
# 检查端口占用
netstat -ano | findstr 8000

# 检查依赖
pip list | findstr fastapi
pip list | findstr uvicorn
```

### API调用失败
- 检查后端服务是否运行
- 检查防火墙规则
- 检查反向代理配置
- 查看后端日志

## 下一步操作

1. 等待依赖安装完成
2. 测试后端服务启动
3. 本地构建前端（npm run build）
4. 上传前端dist文件
5. 配置宝塔面板反向代理
6. 测试完整访问

## 访问地址
- **前端**: http://122.51.71.4/finestem/
- **后端API**: http://122.51.71.4/finestem/api/
