# Lighthouse 多项目部署配置模板

**文档版本**: v1.1.0  
**创建时间**: 2025-12-27  
**更新时间**: 2025-12-28
**维护者**: AI Agent  
**状态**: 模板

---

## 必须遵守的原则

### 核心架构原则

1. **多项目服务器架构**：Lighthouse 支持多项目部署，fineSTEM 是其中一个项目
2. **项目独立性**：每个项目有独立的容器、端口、网络
3. **项目内部子路由**：track-a、track-e 是 fineSTEM 内部的 React Router 子路由，非服务器级独立项目
4. **路径分离**：
  - 服务器级：通过不同路径区分不同项目（`/finestem`、`/project1`、`/project2`）
  - 项目级：通过 React Router 区分子页签（`/track-a`、`/track-e`）
5. **环境变量驱动**：所有路径通过环境变量配置，禁止硬编码

### 🚫 严禁行为清单

- ❌ 将 track-a、track-e 作为服务器级别的独立项目部署
- ❌ 在主机 Nginx 中配置 track-a、track-e 的路由
- ❌ 为 fineSTEM 的子页签分配独立的容器或端口
- ❌ 使用硬编码的 URL 或端口（如 `:8000`、`http://localhost:8000`）
- ❌ 混淆服务器多项目与项目内部子页签

---

## 环境变量清单

### 服务器级别（主机 Nginx 配置）

| 变量名 | 默认值 | 说明  | 严禁  |
| --- | --- | --- | --- |
| 项目路径 | /finestem | fineSTEM 项目的访问路径 | 修改为其他值 |

### Docker Compose 构建参数（fineSTEM 项目）

| 变量名 | 默认值 | 说明  | 严禁  |
| --- | --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | finestem | 项目唯一标识（用于容器名、网络名、卷名） | 修改为其他项目名 |
| `FRONTEND_HOST_PORT` | 80  | 前端容器在主机上的暴露端口 | 修改后不同步更新主机 Nginx |
| `BACKEND_HOST_PORT` | 8000 | 后端容器在主机上的暴露端口 | 修改后不同步更新主机 Nginx |
| `BASE_PATH` | /finestem/ | 前端路径前缀（影响 fineSTEM 内部路由） | 修改为 `/` 或其他值 |
| `API_BASE_URL` | /finestem/api | API 基础路径 | 硬编码为 `/` |

### 前端运行时环境变量

| 变量名 | 默认值 | 说明  | 严禁  |
| --- | --- | --- | --- |
| `VITE_BASE_PATH` | /finestem/ | Vite base 配置，影响静态资源路径 | 硬编码为 `/` |
| `VITE_API_BASE_URL` | /finestem/api | API 基础路径 | 硬编码为 `/` |

---

## 关键配置文件清单

### 1. 主机 Nginx 配置（服务器级别）

**文件路径**：`/etc/nginx/conf.d/projects.conf`

**正确配置**：

```nginx
# fineSTEM 项目（服务器上的一个项目）
location /finestem {
    proxy_pass http://localhost:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# project2 项目（其他项目示例）
location /project2 {
    proxy_pass http://localhost:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**检查点**：

- ✅ 每个项目有独立的 location 配置
- ✅ location 路径与项目名一致（`/finestem`、`/project2`）
- ❌ 禁止：在主机 Nginx 中配置 track-a、track-e 路由
- ❌ 禁止：将 track-a/e 与 project1、project2 等同列

---

### 2. fineSTEM 前端路由配置（项目内部）

**文件路径**：`apps/public-web/src/features/mvp/phase1/web/src/App.tsx`

**正确配置**：

```typescript
<BrowserRouter basename="/finestem">
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/track-a" element={<TrackA />} />
    <Route path="/track-e" element={<TrackE />} />
    <Route path="*" element={<Home />} />
  </Routes>
</BrowserRouter>
```

**关键点**：

- ✅ `<BrowserRouter>` 必须设置 `basename="/finestem"`（项目路径）
- ❌ 禁止：`<BrowserRouter>` (无 basename)

**验证方法**：

```bash
# 检查文件内容
grep "basename=" apps/public-web/src/features/mvp/phase1/web/src/App.tsx
```

---

### 3. fineSTEM API 请求配置（项目内部）

#### TrackE (index.tsx)

**文件路径**：`apps/public-web/src/features/mvp/phase1/web/src/pages/TrackE/index.tsx`

**正确配置**：

```typescript
// ✅ 正确：使用 /api 前缀 (前端构建时会自动替换为 API_BASE_URL)
const response = await fetch('/api/track-e/dataset/mock');

// ❌ 错误：不使用 /api 前缀
const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/track-e/dataset/mock`);

// ❌ 错误：硬编码端口
const response = await fetch('http://localhost:8000/track-e/dataset/mock');
```

#### TrackA (index.tsx)

**文件路径**：`apps/public-web/src/features/mvp/phase1/web/src/pages/TrackA/index.tsx`

**正确配置**：

```typescript
// ✅ 正确：使用 /api 前缀
const response = await fetch('/api/track-a/config/export');
```

#### AIChatPanel (AIChatPanel.tsx)

**文件路径**：`apps/public-web/src/features/mvp/phase1/web/src/components/Shared/AIChatPanel.tsx`

**正确配置**：

```typescript
// ✅ 正确：使用 /api 前缀
const response = await fetch('/api/chat/completions');
```

**检查点**：

- ✅ 所有 fetch 请求必须使用 `/api` 前缀
- ❌ 禁止：使用 `${import.meta.env.VITE_API_BASE_URL}`
- ❌ 禁止：硬编码端口或完整 URL

**验证方法**：

```bash
# 检查所有 API 请求
grep -r "fetch(" apps/public-web/src/features/mvp/phase1/web/src/ --include="*.tsx" --include="*.ts"
```

---

### 4. fineSTEM Nginx 配置（项目内部）

**文件路径**：`apps/public-web/src/features/mvp/phase1/web/nginx.conf`

**正确配置**：

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # 根路径重定向到 /finestem
    location = / {
        return 301 /finestem;
    }

    # fineSTEM 应用（包括所有子路由）
    location /finestem {
        alias /usr/share/nginx/html/;
        try_files $uri $uri/ /finestem/index.html;
    }

    # API 路径代理到后端 (关键修复：剥离前缀)
    location /finestem/api/ {
        proxy_pass http://backend:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端健康检查
    location /health {
        proxy_pass http://backend:8000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 安全头
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # 压缩配置
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

**检查点**：

- ✅ 根路径 `/` 返回 301 重定向到 `/finestem`
- ✅ `/finestem` 使用 `try_files $uri $uri/ /finestem/index.html;`
- ✅ `/finestem/api/` 代理到 `http://backend:8000/`
- ❌ 禁止：根路径返回项目选择页面（这是主机 Nginx 的职责）
- ❌ 禁止：在 fineSTEM 内配置 track-a、track-e 的独立路由
- ❌ 禁止：多项目路由配置（如 `/project1`、`/project2`）

**验证方法**：

```bash
# 检查根路径重定向
grep "return 301 /finestem" apps/public-web/src/features/mvp/phase1/web/nginx.conf

# 检查 /api 配置
grep "location /finestem/api/" apps/public-web/src/features/mvp/phase1/web/nginx.conf

# 检查 /finestem 配置
grep "location /finestem" apps/public-web/src/features/mvp/phase1/web/nginx.conf
```

---

### 5. Vite 配置

**文件路径**：`apps/public-web/src/features/mvp/phase1/web/vite.config.ts`

**正确配置**：

```typescript
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/finestem/',
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        env.VITE_API_BASE_URL || '/finestem/api'
      ),
      'import.meta.env.VITE_APP_NAME': JSON.stringify(
        env.VITE_APP_NAME || 'FineSTEM'
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
```

**检查点**：

- ✅ `base: env.VITE_BASE_PATH` 使用环境变量
- ✅ `VITE_BASE_PATH` 默认值为 `/finestem/`
- ✅ `VITE_API_BASE_URL` 默认值为 `/finestem/api`
- ❌ 禁止：`base: '/'` 硬编码

**验证方法**：

```bash
# 检查 base 配置
grep "base:" apps/public-web/src/features/mvp/phase1/web/vite.config.ts
```

---

### 6. Docker Compose 配置（fineSTEM 项目）

**文件路径**：`docker-compose.yml`

**正确配置**：

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./apps/public-web/src/features/mvp/phase1/backend
      dockerfile: Dockerfile
      args:
        - DEBIAN_FRONTEND=noninteractive
    container_name: finestem-backend
    restart: always
    ports:
      - "8000:8000"
    env_file:
      - ./apps/public-web/src/features/mvp/phase1/backend/.env
    environment:
      - PYTHONUNBUFFERED=1
      - PORT=8000
      - ROOT_PATH=/finestem/api
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
    networks:
      - finestem-network
    volumes:
      - finestem-data:/app/data
      - finestem-logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  frontend:
    build:
      context: ./apps/public-web/src/features/mvp/phase1/web
      dockerfile: Dockerfile
      args:
        BASE_PATH: /finestem/
        API_BASE_URL: /finestem/api
    container_name: finestem-frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - finestem-network
    volumes:
      - finestem-logs:/var/log/nginx
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/finestem/"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  finestem-network:
    driver: bridge
    name: finestem-network

volumes:
  finestem-data:
    driver: local
  finestem-logs:
    driver: local
```

**检查点**：

- ✅ `BASE_PATH: /finestem/` 前端构建参数
- ✅ `API_BASE_URL: /finestem/api` 前端构建参数
- ✅ `ROOT_PATH: /finestem/api` 后端环境变量
- ✅ `DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}` 显式注入
- ✅ 端口映射：前端 `80:80`，后端 `8000:8000`
- ✅ 只有 finestem 相关的两个服务（backend、frontend）
- ✅ 网络名：`finestem-network`（项目独立）
- ❌ 禁止：为子页签定义独立服务（如 `track-a`、`track-e`）
- ❌ 禁止：修改端口映射后不更新主机 Nginx
- ❌ 禁止：多项目配置（如 `project2`、`project3`）

**验证方法**：

```bash
# 检查 BASE_PATH
grep "BASE_PATH:" docker-compose.yml

# 检查端口映射
grep "ports:" docker-compose.yml

# 检查服务数量
grep "^\s*[a-z]*:" docker-compose.yml | grep -v "^  "
```

---

### 7. Dockerfile (fineSTEM frontend)

**文件路径**：`apps/public-web/src/features/mvp/phase1/web/Dockerfile`

**正确配置**：

```dockerfile
# 构建阶段
FROM node:18-alpine AS build

# 设置工作目录
WORKDIR /app

# 使用淘宝镜像源
RUN npm config set registry https://registry.npmmirror.com/

# 复制依赖文件和环境变量文件
COPY package*.json ./
COPY .env* ./

# 清除npm缓存并安装依赖
RUN npm cache clean --force && npm install --no-audit --no-fund

# 复制应用代码
COPY . .

# 构建生产版本（传入BASE_PATH环境变量）
ARG BASE_PATH
ARG API_BASE_URL
ENV VITE_BASE_PATH=${BASE_PATH}
ENV VITE_API_BASE_URL=${API_BASE_URL}
ENV NODE_ENV=production
RUN npm run build -- --mode production

# 运行阶段
FROM nginx:alpine

# 复制构建产物到 Nginx 静态目录
COPY --from=build /app/dist /usr/share/nginx/html

# 复制自定义 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
```

**检查点**：

- ✅ `ARG BASE_PATH` 和 `ARG API_BASE_URL` 定义构建参数
- ✅ `ENV VITE_BASE_PATH=${BASE_PATH}` 传递给 Vite
- ✅ `ENV VITE_API_BASE_URL=${API_BASE_URL}` 传递给 Vite
- ✅ `EXPOSE 80` 暴露前端端口
- ❌ 禁止：硬编码 `ENV VITE_BASE_PATH=/`

**验证方法**：

```bash
# 检查 ARG 定义
grep "^ARG" apps/public-web/src/features/mvp/phase1/web/Dockerfile

# 检查 ENV 设置
grep "VITE_BASE_PATH" apps/public-web/src/features/mvp/phase1/web/Dockerfile
```

---

## 部署前检查清单

在部署到 Lighthouse 之前，请逐项检查以下内容：

### 服务器级别检查

- [ ] 主机 Nginx 配置正确（`/etc/nginx/conf.d/projects.conf`）
- [ ] 每个项目有独立的 location 配置
- [ ] fineSTEM 的 location 路径为 `/finestem`
- [ ] 主机 Nginx 未配置 track-a、track-e 路由

### fineSTEM 项目配置检查

- [ ] **App.tsx**：`<BrowserRouter>` 设置了 `basename="/finestem"`
- [ ] **TrackE/index.tsx**：所有 API 请求使用 `/api` 前缀
- [ ] **TrackA/index.tsx**：所有 API 请求使用 `/api` 前缀
- [ ] **AIChatPanel.tsx**：所有 API 请求使用 `/api` 前缀
- [ ] **nginx.conf**：根路径重定向到 `/finestem`
- [ ] **nginx.conf**：移除了项目选择页面
- [ ] **nginx.conf**：`/finestem/api/` 代理到后端
- [ ] **nginx.conf**：`/finestem` 使用 `try_files`
- [ ] **vite.config.ts**：`base` 使用 `VITE_BASE_PATH`
- [ ] **docker-compose.yml**：`BASE_PATH: /finestem/`
- [ ] **docker-compose.yml**：`API_BASE_URL: /finestem/api`
- [ ] **docker-compose.yml**：`ROOT_PATH: /finestem/api`
- [ ] **docker-compose.yml**：只有 backend 和 frontend 两个服务
- [ ] **docker-compose.yml**：网络名为 `finestem-network`
- [ ] **Dockerfile**：正确使用 ARG 和 ENV 传递环境变量

### 硬编码检查

- [ ] 前端代码中无硬编码端口（如 `:8000`）
- [ ] 前端代码中无硬编码 URL（如 `http://localhost`）
- [ ] 前端代码中无直接使用 `import.meta.env.VITE_API_BASE_URL`
- [ ] fineSTEM 的 nginx.conf 中无多项目路由
- [ ] Docker Compose 中无子页签独立服务

### 构建验证

- [ ] 前端构建时使用了正确的 `VITE_BASE_PATH=/finestem/`
- [ ] 构建产物 `dist/index.html` 的资源路径包含 `/finestem`
- [ ] 构建产物 `dist/assets/` 目录存在
- [ ] 无构建错误或警告

### 本地测试

- [ ] 本地 `docker-compose up` 启动成功
- [ ] 本地访问 `http://localhost/` 自动跳转到 `/finestem`
- [ ] 本地访问 `http://localhost/finestem` 正常显示
- [ ] 本地访问 `http://localhost/finestem/track-a` 正常显示
- [ ] 本地访问 `http://localhost/finestem/track-e` 正常显示
- [ ] 本地 API 请求正常（检查浏览器 Network 面板）
- [ ] 容器日志无错误

---

## 常见错误及修复

### 错误 1：混淆服务器多项目与项目内部子页签

**症状**：

- 主机 Nginx 中配置了 `/track-a`、`/track-e` 路由
- 尝试为子页签分配独立容器或端口

**原因**：混淆了服务器多项目与 fineSTEM 内部子页签的概念

**修复**：

1. 删除主机 Nginx 中的 track-a、track-e 路由配置
2. 确保只有 `/finestem` 路由
3. track-a、track-e 在 fineSTEM 内部通过 React Router 管理

---

### 错误 2：fineSTEM 子页签 404

**症状**：

- 访问 `http://43.140.204.127/finestem/track-a` 返回 404
- 浏览器控制台显示资源加载失败

**原因**：BrowserRouter 未设置 basename

**修复**：

```typescript
// App.tsx
<BrowserRouter basename="/finestem">
```

**验证**：

```bash
grep "basename=" apps/public-web/src/features/mvp/phase1/web/src/App.tsx
```

---

### 错误 3：API 请求 404

**症状**：

- 浏览器 Network 面板显示 API 请求失败（404）
- 前端功能无法正常使用

**原因**：API 请求路径缺少 `/api` 前缀或使用了硬编码端口

**修复**：

```typescript
// ❌ 错误
fetch(`${import.meta.env.VITE_API_BASE_URL}/track-e/dataset/mock`)
fetch('http://localhost:8000/track-e/dataset/mock')

// ✅ 正确
fetch('/api/track-e/dataset/mock')
```

**验证**：

```bash
# 检查所有 API 请求
grep -r "fetch(" apps/public-web/src/features/mvp/phase1/web/src/ --include="*.tsx" --include="*.ts"
```

---

### 错误 4：静态资源加载失败

**症状**：

- 浏览器控制台显示 JS/CSS 文件 404
- 页面空白或样式丢失

**原因**：Vite base 配置未生效，构建产物路径错误

**修复**：

1. 检查构建时的环境变量：
  
  ```bash
  # 在 Dockerfile 中
  ARG BASE_PATH
  ENV VITE_BASE_PATH=${BASE_PATH}
  ```
  
2. 检查 docker-compose.yml 传参：
  
  ```yaml
  build:
    args:
      BASE_PATH: /finestem/
  ```
  
3. 重新构建（清除缓存）：
  
  ```bash
  docker-compose build --no-cache frontend
  ```
  
4. 验证构建产物：
  
  ```bash
  # 进入容器
  docker exec -it finestem-frontend sh
  
  # 检查 index.html
  cat /usr/share/nginx/html/index.html
  
  # 确认资源路径包含 /finestem
  # 如：<script src="/finestem/assets/index-abc123.js"></script>
  ```
  

---

### 错误 5：主机 Nginx 路由不生效

**症状**：

- 访问 `/finestem` 返回 404
- 无法访问项目

**原因**：主机 Nginx 配置错误或未重载

**修复**：

```bash
# 1. 检查配置文件语法
nginx -t

# 2. 重新加载配置
nginx -s reload

# 3. 完全重启 Nginx
systemctl restart nginx

# 4. 检查主机 Nginx 日志
journalctl -u nginx -n 50
```

---

## 配置验证脚本

### 自动化验证脚本

使用以下脚本自动验证 fineSTEM 项目配置：

```bash
#!/bin/bash

# deploysettings/validate-config.sh

echo "=== fineSTEM 配置验证 ==="

# 检查 App.tsx
echo "检查 App.tsx..."
if grep -q "basename=\"/finestem\"" apps/public-web/src/features/mvp/phase1/web/src/App.tsx; then
    echo "✅ BrowserRouter basename 正确"
else
    echo "❌ BrowserRouter 缺少 basename 或设置错误"
    exit 1
fi

# 检查 fineSTEM nginx.conf
echo "检查 fineSTEM nginx.conf..."
if grep -q "return 301 /finestem" apps/public-web/src/features/mvp/phase1/web/nginx.conf; then
    echo "✅ 根路径重定向正确"
else
    echo "❌ 根路径未重定向到 /finestem"
    exit 1
fi

if grep -q "location /finestem/api/" apps/public-web/src/features/mvp/phase1/web/nginx.conf; then
    echo "✅ API 路径配置正确"
else
    echo "❌ 缺少 /finestem/api/ location 配置"
    exit 1
fi

if grep -q "location /finestem" apps/public-web/src/features/mvp/phase1/web/nginx.conf; then
    echo "✅ /finestem location 配置正确"
else
    echo "❌ 缺少 /finestem location 配置"
    exit 1
fi

# 检查 API 请求路径
echo "检查 TrackE API 路径..."
if grep -q "fetch('/api/" apps/public-web/src/features/mvp/phase1/web/src/pages/TrackE/index.tsx; then
    echo "✅ TrackE API 路径正确"
else
    echo "❌ TrackE API 路径错误，未使用 /api 前缀"
    exit 1
fi

echo "检查 TrackA API 路径..."
if grep -q "fetch('/api/" apps/public-web/src/features/mvp/phase1/web/src/pages/TrackA/index.tsx; then
    echo "✅ TrackA API 路径正确"
else
    echo "❌ TrackA API 路径错误，未使用 /api 前缀"
    exit 1
fi

# 检查 docker-compose.yml
echo "检查 docker-compose.yml..."
if grep -q "BASE_PATH: /finestem/" docker-compose.yml; then
    echo "✅ BASE_PATH 正确"
else
    echo "❌ BASE_PATH 错误或未设置"
    exit 1
fi

if grep -q "API_BASE_URL: /finestem/api" docker-compose.yml; then
    echo "✅ API_BASE_URL 正确"
else
    echo "❌ API_BASE_URL 错误或未设置"
    exit 1
fi

# 检查网络名
if grep -q "name: finestem-network" docker-compose.yml; then
    echo "✅ 网络名正确"
else
    echo "❌ 网络名错误"
    exit 1
fi

# 检查硬编码
echo "检查硬编码..."
if grep -r ":8000" apps/public-web/src/features/mvp/phase1/web/src/ --include="*.tsx" --include="*.ts" | grep -v "PORT=8000"; then
    echo "❌ 发现硬编码端口"
    exit 1
else
    echo "✅ 无硬编码端口"
fi

if grep -r "http://localhost" apps/public-web/src/features/mvp/phase1/web/src/ --include="*.tsx" --include="*.ts"; then
    echo "❌ 发现硬编码 URL"
    exit 1
else
    echo "✅ 无硬编码 URL"
fi

echo "=== 所有检查通过 ==="
exit 0
```

**使用方法**：

```bash
chmod +x deploysettings/validate-config.sh
bash deploysettings/validate-config.sh
```

---

## 部署后验证脚本

```bash
#!/bin/bash

# deploysettings/verify-deployment.sh

SERVER="root@43.140.204.127"

echo "=== 部署验证 ==="

# 测试根路径重定向
echo "测试根路径重定向..."
REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" http://43.140.204.127/)
if [ "$REDIRECT" = "301" ]; then
    echo "✅ 根路径 301 重定向"
else
    echo "❌ 根路径重定向失败: $REDIRECT"
    exit 1
fi

# 测试 /finestem 访问
echo "测试 /finestem 访问..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://43.140.204.127/finestem)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ /finestem 访问正常"
else
    echo "❌ /finestem 访问失败: $HTTP_CODE"
    exit 1
fi

# 测试子页签
echo "测试子页签..."
TRACK_A=$(curl -s -o /dev/null -w "%{http_code}" http://43.140.204.127/finestem/track-a)
TRACK_E=$(curl -s -o /dev/null -w "%{http_code}" http://43.140.204.127/finestem/track-e)

if [ "$TRACK_A" = "200" ] && [ "$TRACK_E" = "200" ]; then
    echo "✅ 子页签访问正常"
else
    echo "❌ 子页签访问失败: TrackA=$TRACK_A, TrackE=$TRACK_E"
    exit 1
fi

# 测试 API
echo "测试 API..."
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://43.140.204.127/finestem/api/health)
if [ "$API_HEALTH" = "200" ]; then
    echo "✅ API 访问正常"
else
    echo "❌ API 访问失败: $API_HEALTH"
    exit 1
fi

echo "=== 所有验证通过 ==="
exit 0
```

**使用方法**：

```bash
chmod +x deploysettings/verify-deployment.sh
bash deploysettings/verify-deployment.sh
```

---

## 附录

### A. 相关文档

- 部署架构诊断报告：`deploysettings/DIAGNOSIS_REPORT_20251227.md`
- 多项目部署指南：`deploysettings/MULTI_PROJECT_DEPLOYMENT.md`

### B. 参考资源

- React Router 官方文档：https://reactrouter.com/
- Vite 配置文档：https://vitejs.dev/config/
- Nginx 配置指南：https://nginx.org/en/docs/
- Docker Compose 文档：https://docs.docker.com/compose/

### C. 联系方式

如有问题，请参考诊断报告或联系项目维护者。

---

**模板结束**

请严格按照此模板进行配置和部署，避免架构错误。
