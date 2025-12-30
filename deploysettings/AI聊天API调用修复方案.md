# AI 聊天 API 调用修复方案

**创建时间**: 2025-12-30
**问题描述**: 本地开发环境（localhost）运行 Web AI Chat 时，连接服务器失败，浏览器报错 `net::ERR_NAME_NOT_RESOLVED`

---

## 问题分析

### 1. 错误现象
- 前端提示：抱歉，连接服务器失败。请检查后端服务是否启动，或者 API Key 是否配置正确。
- 浏览器错误：
  - `Failed to load resource: net::ERR_NAME_NOT_RESOLVED`
  - `TypeError: Failed to fetch`
  - `Failed to load resource: the server responded with a status of 404 (Not Found)`

### 2. 根本原因

#### 后端路由
```python
# apps/public-web/src/features/mvp/phase1/backend/routers/chat.py
@router.post("/chat/completions")
async def create_chat_completion(request: ChatRequest):
    ...
```
完整路径：`/chat/completions`

#### Vite 代理配置
```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '')  // 去掉 /api 前缀
  }
}
```
**代理规则**：前端请求 `/api/xxx` → 代理到 `http://localhost:8000/xxx`

#### 环境变量配置
```env
# .env.development
VITE_API_BASE_URL=      # 空字符串

# .env.production
VITE_API_BASE_URL=/finestem/api
```

#### 代码逻辑
```typescript
// vite.config.ts (第32-34行)
'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
  env.VITE_API_BASE_URL || '/'  // ← 问题所在
),
```

当 `VITE_API_BASE_URL` 为空时：
- 空字符串是 falsy 值
- `'' || '/'` 的结果是 `'/'`
- 因此 `import.meta.env.VITE_API_BASE_URL` 被设置为 `'/'`

#### 前端代码
```typescript
// AIChatPanel.tsx
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
// API_BASE = '/' || '/api' = '/'

const response = await fetch(`${API_BASE}/chat/completions`, ...);
// 实际请求：fetch(`/chat/completions`, ...)
// → http://localhost:5173/chat/completions
```

**问题**：请求路径 `/chat/completions` 没有 `/api` 前缀，Vite 代理无法匹配，直接发到前端服务器（5173），导致 404！

---

## 方案对比

### 方案 1：修改 vite.config.ts（推荐）⭐

#### 修改内容
```typescript
// vite.config.ts (第32-34行)

// 修改前
'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
  env.VITE_API_BASE_URL || '/'
),

// 修改后
'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
  env.VITE_API_BASE_URL || '/api'  // 开发环境默认使用 /api
),
```

#### 优点
- ✅ **最小改动**：只修改一行代码
- ✅ **自动适配**：开发环境默认使用 `/api`，生产环境保持不变
- ✅ **无需修改环境变量**：`.env.development` 继续为空
- ✅ **不影响部署**：生产环境构建时显式传递 `VITE_API_BASE_URL=/finestem/api`，fallback 不生效

#### 影响范围

| 环境 | `VITE_API_BASE_URL` | 最终 `API_BASE` | 请求路径 | 状态 |
|------|---------------------|----------------|---------|------|
| 开发（修改前） | `''` | `'/'` | `/chat/completions` | ❌ 404 |
| 开发（修改后） | `''` | `'/api'` | `/api/chat/completions` | ✅ 正常 |
| 生产（现有） | `'/finestem/api'` | `'/finestem/api'` | `/finestem/api/chat/completions` | ✅ 不变 |

#### 验证修复后的请求流程

**开发环境（localhost）：**
1. 前端请求：`http://localhost:5173/api/chat/completions`
2. Vite 代理匹配 `/api` 前缀 ✓
3. 重写路径：去掉 `/api` → `/chat/completions`
4. 转发到：`http://localhost:8000/chat/completions` ✓
5. 后端处理：路由 `/chat/completions` 匹配 ✓

**生产环境（服务器）：**
1. 前端请求：`/finestem/api/chat/completions`
2. Nginx 代理匹配 `/finestem/api/`
3. 转发到：后端服务的 `/chat/completions` ✓

#### 适用场景
- 本地开发环境（localhost）调试
- 使用 `npm run dev` 或 `start_system.bat` 启动
- 需要快速修复，不改变项目结构

---

### 方案 2：修改 .env.development

#### 修改内容
```env
# apps/public-web/src/features/mvp/phase1/web/.env.development

# 在文件末尾添加：
VITE_API_BASE_URL=/api
```

#### 优点
- ✅ **环境配置显式化**：开发环境的 API 基础路径一目了然
- ✅ **遵循最佳实践**：使用环境变量控制不同环境的配置
- ✅ **代码逻辑不变**：vite.config.ts 保持原样

#### 缺点
- ⚠️ 需要修改环境变量文件
- ⚠️ 如果有多个开发人员，需要同步更新
- ⚠️ `.env.development` 可能在 `.gitignore` 中，不会提交到仓库

#### 影响范围
- ✅ 开发环境：`VITE_API_BASE_URL=/api`，请求 `/api/chat/completions`
- ✅ 生产环境：不受影响，继续使用 `VITE_API_BASE_URL=/finestem/api`

#### 适用场景
- 希望环境配置显式化，便于团队协作
- 需要在代码中区分不同环境的行为
- 不介意修改环境变量文件

---

## 推荐选择

### 选择方案 1 的理由
1. **最小改动**：只修改一行代码，不涉及环境变量
2. **向后兼容**：不影响生产环境部署流程
3. **自动适配**：开发环境自动使用 `/api`，无需额外配置
4. **代码清晰**：vite.config.ts 中的 fallback 值体现了开发环境的默认行为

---

## 实施步骤（方案 1）

### 1. 修改 vite.config.ts
```typescript
// 文件路径：apps/public-web/src/features/mvp/phase1/web/vite.config.ts

// 第 32-34 行
'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
  env.VITE_API_BASE_URL || '/api'  // 将 '/' 改为 '/api'
),
```

### 2. 重启开发服务器
```bash
# 停止当前运行的开发服务器（Ctrl+C）
# 重新启动
npm run dev
# 或
start_system.bat
```

### 3. 验证修复
1. 打开浏览器访问 `http://localhost:5173`
2. 进入 AI Chat 功能
3. 发送消息，确认能够正常调用 DeepSeek API
4. 检查浏览器 Network 标签，确认请求地址为 `/api/chat/completions` 且状态为 200

---

## 技术说明

### 为什么修改不影响生产环境？

生产环境构建流程：
```yaml
# docker-compose.yml
build:
  context: ./apps/public-web/src/features/mvp/phase1/web
  args:
    - BASE_PATH: /finestem/
    - API_BASE_URL: /finestem/api  # ← 显式传递
```

```dockerfile
# Dockerfile
ENV VITE_API_BASE_URL=${API_BASE_URL}  # = /finestem/api
```

```typescript
// vite.config.ts (构建时)
const env = loadEnv(mode, process.cwd(), '')
// mode='build' 时，env.VITE_API_BASE_URL = '/finestem/api'

define: {
  'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
    env.VITE_API_BASE_URL || '/api'  // ← '/finestem/api' 有值，fallback 不生效
  ),
}
```

**关键点**：生产环境在构建时显式传递了 `API_BASE_URL=/finestem/api`，所以 `|| '/api'` 的 fallback 永远不会被触发。

### Vite 代理工作原理
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '')
  }
}
```

**匹配规则**：只有以 `/api` 开头的请求才会被代理

**示例**：
- `/api/chat/completions` → 代理到 `http://localhost:8000/chat/completions` ✓
- `/chat/completions` → 不匹配，直接发给前端服务器 ✗

---

## 相关文件

### 核心文件
- `apps/public-web/src/features/mvp/phase1/web/vite.config.ts` - Vite 配置（需要修改）
- `apps/public-web/src/features/mvp/phase1/web/.env.development` - 开发环境变量
- `apps/public-web/src/features/mvp/phase1/web/.env.production` - 生产环境变量
- `apps/public-web/src/features/mvp/phase1/web/src/components/Shared/AIChatPanel.tsx` - AI 聊天组件

### 后端文件
- `apps/public-web/src/features/mvp/phase1/backend/main.py` - FastAPI 主入口
- `apps/public-web/src/features/mvp/phase1/backend/routers/chat.py` - 聊天路由

### 部署文件
- `docker-compose.yml` - Docker Compose 配置
- `apps/public-web/src/features/mvp/phase1/web/Dockerfile` - 前端 Docker 配置
- `apps/public-web/src/features/mvp/phase1/web/nginx.conf` - Nginx 配置

---

## 附录：完整请求流程对比

### 修复前（开发环境）
```
用户发送消息
  ↓
前端发起请求：fetch('/chat/completions')
  ↓
浏览器发送：http://localhost:5173/chat/completions
  ↓
Vite 代理：不匹配 '/api' 前缀，不代理
  ↓
前端服务器处理：404 Not Found ❌
```

### 修复后（开发环境）
```
用户发送消息
  ↓
前端发起请求：fetch('/api/chat/completions')
  ↓
浏览器发送：http://localhost:5173/api/chat/completions
  ↓
Vite 代理：匹配 '/api' 前缀 ✓
  ↓
重写路径：/chat/completions
  ↓
转发到：http://localhost:8000/chat/completions
  ↓
后端处理：路由 /chat/completions 匹配 ✓
  ↓
调用 DeepSeek API：成功 ✓
  ↓
返回响应：200 OK
```

### 生产环境（无变化）
```
用户发送消息
  ↓
前端发起请求：fetch('/finestem/api/chat/completions')
  ↓
浏览器发送：https://yourdomain.com/finestem/api/chat/completions
  ↓
Nginx 代理：匹配 '/finestem/api/' 前缀 ✓
  ↓
转发到：后端服务的 /chat/completions
  ↓
后端处理：路由 /chat/completions 匹配 ✓
  ↓
调用 DeepSeek API：成功 ✓
  ↓
返回响应：200 OK
```

---

**文档版本**: v1.0.0
**最后更新**: 2025-12-30
**维护者**: AI Agent
