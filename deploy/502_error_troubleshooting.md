# HTTP 502 错误诊断和解决方案

## 问题分析

### 当前状态
- ✅ 后端服务运行正常：`http://localhost:8000/finestem/api/health`
- ✅ 前端服务运行正常：`http://localhost:8081/`
- ✅ 云防火墙规则已添加（端口 8000, 8081）
- ❌ 公网访问失败：`http://122.51.71.4:8000` 和 `http://122.51.71.4:8081`
- ❌ HTTP 502 错误：访问 `http://122.51.71.4/finestem/`

### 502 错误原因
HTTP 502 Bad Gateway 表示：
1. 访问 `http://122.51.71.4/finestem/` (端口 80)
2. 端口 80 有某个反向代理配置（可能是宝塔默认配置）
3. 该配置尝试代理到后端，但后端不可达
4. 返回 502 错误

**问题**：端口 80 没有我们的服务在运行，但有默认的反向代理配置

---

## 解决方案

### 方案1：使用端口 8081 访问（推荐，快速）

**直接访问地址：**
- 前端：`http://122.51.71.4:8081/`
- 后端API：`http://122.51.71.4:8000/finestem/api/`

**优点**：
- 无需配置宝塔面板
- 立即可用
- 云防火墙规则已配置

**缺点**：
- URL 带端口号
- 非标准 HTTP 端口

### 方案2：配置宝塔面板（完整方案）

#### 步骤1：登录宝塔面板
- 地址：`http://122.51.71.4:8888`
- 使用您的宝塔用户名和密码登录

#### 步骤2：添加网站
1. 进入"网站"菜单
2. 点击"添加站点"
3. 配置如下：
   - **域名**：`122.51.71.4`
   - **根目录**：`C:\wwwroot\finestem\frontend`
   - **FTP**：不创建
   - **数据库**：不创建
   - **PHP版本**：纯静态
4. 点击"提交"

#### 步骤3：上传前端文件
1. 在宝塔面板中，进入"网站" → 找到刚创建的网站
2. 点击"文件"进入网站根目录
3. 删除默认的 `index.html`（如果有）
4. 点击"上传"按钮
5. 从本地上传以下文件：
   - 打开本地文件夹：`apps\public-web\src\features\mvp\phase1\web\dist`
   - 上传所有文件和文件夹
   - 确保 `index.html` 在根目录

#### 步骤4：配置反向代理
1. 在宝塔面板中，进入"网站" → 点击您的网站 → "设置"
2. 选择"反向代理"标签页
3. 点击"添加反向代理"
4. 配置如下：
   - **代理名称**：`finestem-api`
   - **目标URL**：`http://127.0.0.1:8000`
   - **发送域名**：`$host`
   - **代理目录**：`/finestem/api/`
   - **目标目录**：`/`
   - **高级设置**（展开）：
     - 开启"缓存"
     - 开启"WebSocket"
5. 点击"提交"

#### 步骤5：测试访问
- 前端：`http://122.51.71.4/finestem/`
- 后端：`http://122.51.71.4:8000/finestem/api/`

---

### 方案3：修复 Windows 防火墙

如果端口 8000 和 8081 公网无法访问：

#### 方法A：通过控制面板
1. 连接到服务器的远程桌面（RDP）
2. 打开"控制面板" → "Windows Defender 防火墙" → "高级设置"
3. 在"入站规则"中，点击"新建规则"
4. 选择"端口" → 下一步
5. 选择"TCP" → 特定本地端口：`8000,8081` → 下一步
6. 选择"允许连接" → 下一步
7. 全部勾选（域、专用、公用）→ 下一步
8. 输入规则名称：`fineSTEM Ports` → 完成

#### 方法B：通过命令行
```powershell
# 以管理员身份运行 PowerShell
netsh advfirewall firewall add rule name="fineSTM Backend" dir=in action=allow protocol=TCP localport=8000
netsh advfirewall firewall add rule name="fineSTM Frontend" dir=in action=allow protocol=TCP localport=8081
```

#### 方法C：禁用 Windows 防火墙（测试用）
```powershell
# 以管理员身份运行
netsh advfirewall set allprofiles state off
```

⚠️ **警告**：禁用防火墙会降低安全性，仅在测试时使用

---

### 方案4：检查腾讯云安全组

1. 登录腾讯云控制台：[https://console.cloud.tencent.com/lighthouse/instance/index](https://console.cloud.tencent.com/lighthouse/instance/index)
2. 找到实例 `fancywintest` (lhins-o62txw76)
3. 点击实例右侧的"更多" → "安全组"
4. 确认安全组规则包含：
   - 协议：TCP
   - 端口：80, 443, 8000, 8081
   - 来源：0.0.0.0/0
   - 策略：允许
5. 如果规则缺失，点击"修改规则"添加

---

## 快速临时解决方案

### 立即可用的访问地址

**使用端口号直接访问（无需额外配置）：**
- 前端：`http://122.51.71.4:8081/`
- 后端API文档：`http://122.51.71.4:8000/finestem/api/docs`
- 后端健康检查：`http://122.51.71.4:8000/finestem/api/health`

### 访问说明
1. 在浏览器中打开 `http://122.51.71.4:8081/`
2. 前端会自动调用 `/finestem/api` 接口
3. 前端配置的 API 地址会自动重定向到后端

**注意**：前端已经配置了 API 基础路径为 `/finestem/api`，所以即使通过 8081 端口访问前端，API 调用仍然会正确。

---

## 当前服务状态

### 后端服务
- **状态**：运行中
- **端口**：8000
- **根路径**：`/finestem/api`
- **健康检查**：正常 `{"status":"ok"}`

### 前端服务
- **状态**：运行中
- **端口**：8081
- **目录**：`C:\wwwroot\finestem\frontend`
- **本地访问**：正常

### 云防火墙
- **端口 8000**：已开放（fineSTEM backend API）
- **端口 8081**：已开放（fineSTEM frontend）
- **端口 80/443**：已开放
- **端口 8888**：已开放（宝塔面板）

---

## 故障排查步骤

### 1. 检查端口是否开放
**服务器上测试：**
```powershell
# 检查端口监听
netstat -ano | findstr 8000
netstat -ano | findstr 8081

# 测试本地访问
Invoke-WebRequest -Uri 'http://localhost:8000/finestem/api/health'
Invoke-WebRequest -Uri 'http://localhost:8081/'
```

**外部测试：**
- 从您的本地电脑
- 访问：`http://122.51.71.4:8081/`
- 如果无法访问，检查防火墙/安全组

### 2. 检查 Windows 防火墙
```powershell
# 查看防火墙状态
netsh advfirewall show allprofiles state

# 查看入站规则
netsh advfirewall firewall show rule name=all dir=in

# 查看 fineSTEM 相关规则
netsh advfirewall firewall show rule name="fineSTEM*"
```

### 3. 检查腾讯云安全组
1. 进入腾讯云控制台
2. 实例 → 安全组
3. 查看入站规则
4. 确认端口 8000, 8081 已允许

### 4. 测试网络连通性
```powershell
# 从您的本地电脑
# Ping 测试
ping 122.51.71.4

# Telnet 测试（需要开启 telnet 客户端）
telnet 122.51.71.4 8081

# 或使用 PowerShell Test-NetConnection
Test-NetConnection -ComputerName 122.51.71.4 -Port 8081
```

---

## 推荐操作顺序

### 立即可用（2分钟）
1. ✅ 直接访问：`http://122.51.71.4:8081/`
2. ✅ 测试前端功能是否正常
3. ✅ 测试后端 API 调用

### 完整配置（15分钟）
1. 登录宝塔面板：`http://122.51.71.4:8888`
2. 添加网站，配置根目录为 `C:\wwwroot\finestem\frontend`
3. 上传前端文件到网站根目录
4. 配置反向代理，将 `/finestem/api/` 代理到 `http://127.0.0.1:8000`
5. 测试访问 `http://122.51.71.4/finestem/`

### 安全加固（5分钟）
1. 配置 Windows 防火墙规则
2. 验证腾讯云安全组规则
3. 测试所有端口的公网访问

---

## 联系与支持

如果以上方案都无法解决问题：

1. **检查服务日志**
   - 后端：查看 Python 控制台输出
   - 宝塔：面板 → 网站日志

2. **腾讯云工单**
   - 提交工单描述问题
   - 提供实例 ID：lhins-o62txw76

3. **网络诊断**
   - 腾讯云控制台 → 实例 → 检查网络状态
   - 查看是否有网络限制或封禁

---

**最后更新**：2025-12-29
**问题**：HTTP 502 错误，公网访问失败
**建议**：先使用端口 8081 访问，然后配置宝塔面板
