# CloudBase云函数手动部署指南

## 问题说明
CloudBase控制台只允许上传JSON配置文件，不能直接上传整个文件夹。因此需要手动创建云函数并复制代码。

## 解决方案

### 1. 登录CloudBase控制台
访问：https://tcb.cloud.tencent.com/dev?envId=cloud1-5g07azl0fdf36b21#/scf

### 2. 创建云函数

1. 点击"新建函数"
2. 函数名称：`finestem-backend`
3. 运行环境：`Node.js 16.13`
4. 函数方法：`index.main`
5. 内存：256MB
6. 超时：30秒
7. 点击"下一步"

### 3. 配置函数代码

在"函数代码"部分，执行以下操作：

1. 删除默认的`index.js`内容
2. 复制以下文件内容到对应文件：

#### a. 替换index.js内容
复制`g:\mediaProjects\fineSTEM\cloud-functions\finestem-backend\index.js`的完整内容到在线编辑器

#### b. 创建package.json文件
点击"新建文件"，命名为`package.json`，然后复制以下内容：
```json
{
  "name": "finestem-backend",
  "version": "1.0.0",
  "description": "FineSTEM Backend Cloud Function",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "@cloudbase/node-sdk": "^2.0.3",
    "axios": "^0.24.0"
  },
  "author": "",
  "license": "ISC"
}
```

### 4. 配置环境变量

在"环境配置"部分，添加以下环境变量：

```
DEEPSEEK_API_KEY=sk-41c2d916808941a0bf1aa2613e910d80
DEEPSEEK_BASE_URL=https://api.deepseek.com
PORT=8000
ENVIRONMENT=production
ALLOWED_ORIGINS=https://cloud1-5g07azl0fdf36b21-1361381967.tcloudbaseapp.com
LOG_LEVEL=INFO
```

### 5. 部署并测试

1. 点击"完成"创建函数
2. 等待部署完成
3. 测试函数访问：
   - 健康检查：https://service-bihqgye1-1258344699.sh.run.tcloudbaseapp.com/finestem-backend/health
   - 聊天完成：使用前端应用测试AI聊天功能

### 6. 验证前端连接

1. 访问前端应用：https://cloud1-5g07azl0fdf36b21-1361381967.tcloudbaseapp.com/
2. 点击Track A或Track E页面
3. 尝试使用AI聊天功能
4. 确认没有"连接服务器失败"错误

## 可能遇到的问题

### 1. 模块安装失败
如果依赖安装失败，尝试在终端中安装：
```bash
npm install @cloudbase/node-sdk@^2.0.3 axios@^0.24.0
```

### 2. 函数执行超时
如果函数执行超时，可以尝试：
1. 增加超时时间到60秒
2. 增加内存到512MB

### 3. CORS错误
如果出现CORS错误，检查代码中的CORS配置是否正确。

## 完成标志

当以下测试通过时，表示部署成功：
1. 健康检查返回正常响应
2. AI聊天功能可以正常使用
3. Track A和Track E页面数据加载正常