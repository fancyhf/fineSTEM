# CloudBase云函数部署指南

## 问题修复说明

原错误：`配置格式错误：triggers字段校验失败`

### 解决方案

1. **修复了云函数配置文件**
   - 创建了正确的`cloudbaserc.json`配置文件（放在云函数目录内）
   - 使用CloudBase标准格式：`{"triggers": []}`
   - 修复了云函数入口文件的导出方式

2. **正确的云函数结构**
   ```
   cloud-functions/
   └── finestem-backend/
       ├── index.js         # 云函数入口文件
       ├── fastapi-handler.js # FastAPI兼容处理程序
       ├── package.json      # 依赖配置
       └── cloudbaserc.json  # CloudBase配置文件（标准格式）
   ```

## 手动部署步骤

### 1. 准备文件

确保以下文件已正确创建：
- `cloudbaserc.json` - CloudBase配置文件
- `cloud-functions/finestem-backend/index.js` - 云函数入口
- `cloud-functions/finestem-backend/fastapi-handler.js` - 请求处理程序
- `cloud-functions/finestem-backend/package.json` - 依赖配置

### 2. 登录CloudBase

```bash
# 安装CloudBase CLI
npm install -g @cloudbase/cli

# 登录CloudBase
tcb login
```

### 3. 部署云函数

```bash
# 方法1：使用配置文件部署
tcb functions deploy

# 方法2：使用控制台部署
# 访问：https://tcb.cloud.tencent.com/dev?envId=cloud1-5g07azl0fdf36b21#/scf
# 1. 创建新函数或更新现有函数
# 2. 函数名称：finestem-backend
# 3. 运行环境：Node.js 16.13
# 4. 上传方式：文件夹上传
# 5. 选择 cloud-functions/finestem-backend 目录
# 6. 入口文件：index.main
# 7. 执行方法：index.main
```

### 4. 确认文件结构

确保上传的文件夹包含以下文件：
- `index.js` - 云函数入口文件
- `package.json` - 依赖配置
- `cloudbaserc.json` - CloudBase配置文件（标准格式）
- `fastapi-handler.js` - FastAPI兼容处理程序（可选）

### 4. 配置环境变量

在云函数配置中添加以下环境变量：
```
DEEPSEEK_API_KEY=sk-41c2d916808941a0bf1aa2613e910d80
DEEPSEEK_BASE_URL=https://api.deepseek.com
PORT=8000
ENVIRONMENT=production
ALLOWED_ORIGINS=https://cloud1-5g07azl0fdf36b21-1361381967.tcloudbaseapp.com
LOG_LEVEL=INFO
```

## 验证部署

1. **前端访问地址**：https://cloud1-5g07azl0fdf36b21-1361381967.tcloudbaseapp.com/
2. **测试AI聊天功能**：点击聊天功能，确认可以正常使用DeepSeek API

## 常见问题

### 1. triggers字段错误
确保`package.json`中不包含triggers字段，如有需要，请在CloudBase控制台手动配置。

### 2. 函数入口错误
确保云函数的入口文件正确设置为`index.main`，而不是其他路径。

### 3. 环境变量问题
确保所有必要的环境变量都已正确配置，特别是`DEEPSEEK_API_KEY`。

## 前端配置

前端已配置使用环境变量`VITE_API_BASE_URL`，确保构建时该变量指向正确的云函数地址。

当前配置：
```env
VITE_API_BASE_URL=https://service-bihqgye1-1258344699.sh.run.tcloudbaseapp.com/finestem-backend
```

## 完成后效果

部署完成后，CloudBase上的应用将与本地版本功能完全一致，包括：
- AI聊天功能正常工作
- Track A和Track E页面数据正常加载
- 所有API调用正常响应