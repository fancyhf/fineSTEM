# DeepSeek API 本地修复方案

**方案版本**: v1.0.0  
**创建时间**: 2025-12-28 17:50:00.000  
**维护者**: AI Agent  
**关联文档**: `deepseek-api-server-fix-summary.md`

---

## 问题回顾

### 服务器端发现的问题

1. **DEEPSEEK_API_KEY 环境变量未正确传递**
   - docker-compose.yml 使用 `${DEEPSEEK_API_KEY}` 引用系统环境变量
   - 但系统环境中没有设置这个变量，导致容器内环境变量为空

2. **API 路由路径不匹配**
   - 后端路由：`/chat/completions`
   - FastAPI root_path：`/finestem/api`
   - 实际注册路径：`/finestem/api/chat/completions`
   - nginx 转发后：`/chat/completions` (404 Not Found)

3. **ROOT_PATH 配置与 nginx 代理冲突**
   - docker-compose.yml 设置 `ROOT_PATH=/finestem/api`
   - nginx 已将 `/finestem/api/` 转发到 `http://backend:8000/`
   - 导致双重路径前缀问题

---

## 本地修复方案

### 修复 1：后端环境变量配置

**目标**: 确保 DEEPSEEK_API_KEY 正确配置在 `.env` 文件中

**修改文件**: `apps/public-web/src/features/mvp/phase1/backend/.env`

**当前状态** (需要验证):
```bash
# DeepSeek API Configuration
# Get your key at https://platform.deepseek.com/
# ⚠️ 重要：生产环境必须配置真实的 API Key，不要使用占位符
DEEPSEEK_API_KEY=sk-41c2d916808941a0bf1aa2613e910d80
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

**修改要求**:
- ✅ 确保 DEEPSEEK_API_KEY 包含有效的 API Key
- ✅ 确保 DEEPSEEK_BASE_URL 设置为 `https://api.deepseek.com`
- ⚠️ **不要**使用 `sk-placeholder` 作为占位符

**验证方法**:
```bash
# 在后端目录测试
cd apps/public-web/src/features/mvp/phase1/backend
python3 -c "from dotenv import load_dotenv; load_dotenv(); import os; print('DEEPSEEK_API_KEY:', os.getenv('DEEPSEEK_API_KEY'))"
```

---

### 修复 2：docker-compose.yml 环境变量配置

**目标**: 确保后端容器正确加载 DEEPSEEK_API_KEY

**修改文件**: `docker-compose.yml`

**当前状态** (需要验证):
```yaml
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
    # 优先使用 environment 覆盖 .env 文件中的配置
    environment:
      - PYTHONUNBUFFERED=1
      - PORT=8000
      - ROOT_PATH=/finestem/api
      # 确保从系统环境变量或 .env 文件中传递 Key
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
    env_file:
      - ./apps/public-web/src/features/mvp/phase1/backend/.env
    ...
```

**问题分析**:
- 当前配置使用 `DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}`
- 这会从**系统环境变量**读取，而不是从 `.env` 文件
- 如果系统环境中没有设置 `DEEPSEEK_API_KEY`，容器内该变量为空

**修复方案** (二选一):

#### 方案 A：依赖 .env 文件（推荐）

```yaml
services:
  backend:
    ...
    environment:
      - PYTHONUNBUFFERED=1
      - PORT=8000
      - ROOT_PATH=/finestem/api
      # 移除 DEEPSEEK_API_KEY 配置，直接使用 .env 文件
    env_file:
      - ./apps/public-web/src/features/mvp/phase1/backend/.env
    ...
```

**优点**:
- ✅ 配置集中管理在 `.env` 文件中
- ✅ 支持不同环境使用不同的 `.env` 文件
- ✅ 不需要在系统环境变量中设置

**缺点**:
- ⚠️ `.env` 文件包含敏感信息，不能提交到 Git

---

#### 方案 B：使用系统环境变量（不推荐）

```bash
# 在启动前设置系统环境变量
export DEEPSEEK_API_KEY=sk-41c2d916808941a0bf1aa2613e910d80

# 然后启动服务
docker-compose up -d
```

**优点**:
- ✅ 不修改代码配置

**缺点**:
- ❌ 每次启动都需要手动设置环境变量
- ❌ 不适合自动化部署
- ❌ 容易遗漏配置

---

**推荐方案**: 使用 **方案 A**（依赖 .env 文件）

---

### 修复 3：路由路径统一管理

**目标**: 解决路由前缀冲突问题

**问题分析**:
1. **当前架构**:
   - FastAPI root_path: `/finestem/api`
   - Chat router prefix: `/chat/`
   - 实际路径: `/finestem/api/chat/completions`

2. **Nginx 代理**:
   - 请求: `/finestem/api/chat/completions`
   - 转发到: `http://backend:8000/chat/completions`
   - 后端期望: `/chat/completions`
   - 实际注册: `/finestem/api/chat/completions` (冲突)

3. **ROOT_PATH 的作用**:
   - FastAPI 使用 ROOT_PATH 作为应用的基础路径
   - 所有路由会自动添加这个前缀
   - 这是为了支持反向代理和子路径部署

**根本原因**:
- nginx 已经处理了 `/finestem/api/` 前缀
- FastAPI 不应该再次添加这个前缀
- 导致路径不匹配

---

#### 修复方案 A：移除 ROOT_PATH（不推荐）

**修改文件**: `docker-compose.yml`

```yaml
services:
  backend:
    ...
    environment:
      - PYTHONUNBUFFERED=1
      - PORT=8000
      # ROOT_PATH=/finestem/api  # 删除此行
    ...
```

**效果**:
- FastAPI 不再添加 `/finestem/api` 前缀
- 路由直接为: `/chat/completions`, `/track-a/config/export` 等
- nginx 代理可以正常工作

**问题**:
- ❌ 失去了多项目部署的支持
- ❌ 如果将来需要在不同路径部署应用，需要手动修改
- ❌ 与原设计目标（支持多项目部署）冲突

---

#### 修复方案 B：调整 Nginx 代理（不推荐）

**修改文件**: `apps/public-web/src/features/mvp/phase1/web/nginx.conf`

```nginx
location /finestem/api/ {
    proxy_pass http://backend:8000/finestem/api;  # 修改这里
    ...
}
```

**效果**:
- nginx 将 `/finestem/api/chat/completions` 转发到 `http://backend:8000/finestem/api/chat/completions`
- 后端路由为 `/finestem/api/chat/completions`，可以匹配

**问题**:
- ❌ 路径冗余：`/finestem/api/finestem/api/...`
- ❌ 不符合 RESTful 路径设计
- ❌ 可能导致其他问题（如静态文件、OpenAPI 文档等）

---

#### 修复方案 C：统一使用环境变量管理路径（推荐）⭐

**目标**: 使用 URL 环境变量统一管理 API 基础路径

**修改文件 1**: `apps/public-web/src/features/mvp/phase1/backend/.env`

```bash
# API 基础路径配置
API_BASE_PATH=/finestem/api
DEEPSEEK_API_KEY=sk-41c2d916808941a0bf1aa2613e910d80
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

**修改文件 2**: `apps/public-web/src/features/mvp/phase1/backend/main.py`

```python
# Get root_path from environment variable for reverse proxy support
root_path = os.getenv("ROOT_PATH", os.getenv("API_BASE_PATH", ""))

app = FastAPI(
    title="FineSTEM API", 
    version="0.1.0", 
    root_path=root_path
)
```

**修改文件 3**: `apps/public-web/src/features/mvp/phase1/web/.env.production`

```bash
# 生产环境配置
VITE_API_BASE_URL=/finestem/api
...
```

**修改文件 4**: `docker-compose.yml`

```yaml
services:
  backend:
    ...
    environment:
      - PYTHONUNBUFFERED=1
      - PORT=8000
      - ROOT_PATH=/finestem/api  # 保留此配置
      # DEEPSEEK_API_KEY 从 .env 文件读取，不在此处设置
    env_file:
      - ./apps/public-web/src/features/mvp/phase1/backend/.env
    ...
```

**优点**:
- ✅ 保留了 ROOT_PATH 配置，支持多项目部署
- ✅ 所有路径通过环境变量统一管理
- ✅ 前后端路径配置一致
- ✅ 灵活支持不同环境的路径配置

**路径映射**:
```
前端请求: /finestem/api/chat/completions
  ↓
Nginx 代理: http://backend:8000/chat/completions
  ↓
FastAPI (ROOT_PATH=/finestem/api): /finestem/api/chat/completions
  ↓
Chat Router (prefix=/chat/): /chat/completions
  ↓
最终端点: /completions
```

**等等，还是有问题！**

---

#### 修复方案 D：修复 Router 前缀定义（推荐）⭐⭐

**根本问题**:
- `routers/chat.py` 中定义：`router = APIRouter(prefix="/chat/", tags=["Chat"])`
- 注意：前缀是 `/chat/`（有尾随斜杠）
- 端点定义：`@router.post("/completions")`
- 完整路径：`/chat//completions`（双斜杠）
- FastAPI 会将双斜杠合并为单斜杠：`/chat/completions`

**当前 nginx 配置**:
```nginx
location /finestem/api/ {
    proxy_pass http://backend:8000/;
    ...
}
```

**当前 docker-compose.yml 配置**:
```yaml
environment:
  - ROOT_PATH=/finestem/api
```

**路径映射**:
```
前端请求: /finestem/api/chat/completions
  ↓
Nginx: 去掉 /finestem/api/，添加到 http://backend:8000/
  ↓
转发到: http://backend:8000/chat/completions
  ↓
FastAPI (ROOT_PATH=/finestem/api): 添加前缀
  ↓
实际路由: /finestem/api/chat/completions
  ↓
Chat Router: /chat/completions (无匹配)
  ↓
结果: 404 Not Found
```

**问题根源**:
- FastAPI 的 `root_path` 作用域是 **整个应用**
- 所有路由都会添加 `root_path` 前缀
- nginx 已经转发了 `/chat/completions`，但 FastAPI 期望 `/finestem/api/chat/completions`

---

#### 修复方案 E：统一 Router 前缀与 ROOT_PATH（最终方案）⭐⭐⭐

**核心思路**:
1. 保留 ROOT_PATH 用于多项目部署
2. 统一所有 Router 的前缀与实际路径匹配
3. nginx 代理配置保持不变

**修改文件 1**: `apps/public-web/src/features/mvp/phase1/backend/routers/chat.py`

```python
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
import os
import httpx
from typing import List, Optional

# 修改前缀，去掉尾随斜杠
router = APIRouter(prefix="/chat", tags=["Chat"])

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    context: Optional[str] = None
    provider: Optional[str] = "deepseek"

# Mock configuration - in production use env vars
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "sk-placeholder") 
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

@router.post("/completions")
async def chat_completions(request: ChatRequest):
    """Handle chat completions using DeepSeek or other compatible APIs."""
    ...
```

**关键修改**:
```python
# 修改前
router = APIRouter(prefix="/chat/", tags=["Chat"])

# 修改后
router = APIRouter(prefix="/chat", tags=["Chat"])
```

**同时修改其他 Router**:

`apps/public-web/src/features/mvp/phase1/backend/routers/track_a.py`:
```python
# 修改前
router = APIRouter(prefix="/track-a/", tags=["TrackA"])

# 修改后
router = APIRouter(prefix="/track-a", tags=["TrackA"])
```

`apps/public-web/src/features/mvp/phase1/backend/routers/track_e.py`:
```python
# 修改前
router = APIRouter(prefix="/track-e/", tags=["TrackE"])

# 修改后
router = APIRouter(prefix="/track-e", tags=["TrackE"])
```

`apps/public-web/src/features/mvp/phase1/backend/routers/analytics.py`:
```python
# 修改前
router = APIRouter(prefix="/analytics/", tags=["Analytics"])

# 修改后
router = APIRouter(prefix="/analytics", tags=["Analytics"])
```

---

**路径映射** (修复后):
```
前端请求: /finestem/api/chat/completions
  ↓
Nginx: 去掉 /finestem/api/，添加到 http://backend:8000/
  ↓
转发到: http://backend:8000/chat/completions
  ↓
FastAPI (ROOT_PATH=/finestem/api): 添加前缀
  ↓
实际路由: /finestem/api/chat/completions
  ↓
Chat Router (prefix="/chat", 端点="/completions"): /finestem/api/chat/completions
  ↓
匹配成功! ✅
```

---

### 修复 4：环境变量配置完整性检查

**目标**: 确保所有必需的环境变量都已配置

**检查清单**:

#### 后端环境变量 (`backend/.env`)

```bash
# DeepSeek API Configuration ✅
DEEPSEEK_API_KEY=sk-41c2d916808941a0bf1aa2613e910d80
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Server Configuration ✅
PORT=8000
DEBUG=False
ENVIRONMENT=production

# CORS Configuration ✅
ALLOWED_ORIGINS=*

# Logging Configuration ✅
LOG_LEVEL=INFO
LOG_FILE=./logs/finestem.log
```

#### 前端环境变量 (`web/.env.production`)

```bash
# API 地址配置 ✅
VITE_API_BASE_URL=/finestem/api

# 应用配置 ✅
VITE_APP_NAME=FineSTEM
VITE_ENV=production
VITE_DEBUG=false
VITE_APP_VERSION=1.0.0
```

#### Docker Compose 环境变量 (`docker-compose.yml`)

```yaml
services:
  backend:
    environment:
      - PYTHONUNBUFFERED=1        ✅
      - PORT=8000                  ✅
      - ROOT_PATH=/finestem/api    ✅ (多项目部署必需)
      # DEEPSEEK_API_KEY 从 .env 文件读取 ✅
    env_file:
      - ./apps/public-web/src/features/mvp/phase1/backend/.env  ✅
    ...
```

---

## 修复步骤总结

### 步骤 1: 修改 Router 前缀

**文件列表**:
- `apps/public-web/src/features/mvp/phase1/backend/routers/chat.py`
- `apps/public-web/src/features/mvp/phase1/backend/routers/track_a.py`
- `apps/public-web/src/features/mvp/phase1/backend/routers/track_e.py`
- `apps/public-web/src/features/mvp/phase1/backend/routers/analytics.py`

**修改内容**: 将所有 Router 的 `prefix="/xxx/"` 改为 `prefix="/xxx"` (去掉尾随斜杠)

```python
# 示例
router = APIRouter(prefix="/chat", tags=["Chat"])  # 无尾随斜杠
```

---

### 步骤 2: 验证环境变量配置

**文件**: `apps/public-web/src/features/mvp/phase1/backend/.env`

**确保**:
```bash
DEEPSEEK_API_KEY=sk-41c2d916808941a0bf1aa2613e910d80
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

**不要使用**:
```bash
DEEPSEEK_API_KEY=sk-placeholder  # ❌ 占位符
```

---

### 步骤 3: 验证 docker-compose.yml 配置

**文件**: `docker-compose.yml`

**确保**:
```yaml
services:
  backend:
    environment:
      - PYTHONUNBUFFERED=1
      - PORT=8000
      - ROOT_PATH=/finestem/api  # ✅ 保留
      # 不在 environment 中设置 DEEPSEEK_API_KEY，让它从 .env 文件读取
    env_file:
      - ./apps/public-web/src/features/mvp/phase1/backend/.env  # ✅ 正确
```

---

### 步骤 4: 验证前端环境变量

**文件**: `apps/public-web/src/features/mvp/phase1/web/.env.production`

**确保**:
```bash
VITE_API_BASE_URL=/finestem/api  # ✅ 与后端 ROOT_PATH 一致
```

---

### 步骤 5: 本地测试

```bash
# 构建并启动服务
docker-compose up -d --build

# 等待服务启动
sleep 10

# 测试后端健康检查
curl http://localhost:8000/health
# 预期: {"status": "ok"}

# 测试 Chat API
curl -X POST http://localhost:8000/finestem/api/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
# 预期: 返回 DeepSeek AI 的真实回复（不是模拟回复）
```

---

### 步骤 6: 验证路由注册

```bash
# 检查后端路由
docker exec finestem-backend python -c \
  'import sys; sys.path.append("/app"); from main import app; import json; \
   print(json.dumps([route.path for route in app.routes], indent=2))'

# 预期路径:
[
  "/openapi.json",
  "/docs",
  "/docs/oauth2-redirect",
  "/redoc",
  "/finestem/api/track-a/config/export",
  "/finestem/api/track-a/config/latest",
  "/finestem/api/track-e/dataset/mock",
  "/finestem/api/chat/completions",  # ✅ 正确的路径
  "/finestem/api/analytics/events",
  "/finestem/api/analytics/summary",
  "/health",
  "/"
]
```

---

### 步骤 7: 部署到服务器

```bash
# 1. 推送代码到 Git 仓库
git add .
git commit -m "fix: 修复 DeepSeek API 路由配置和环境变量问题"
git push

# 2. 在服务器上拉取最新代码（或使用自动化部署工具）
cd /root
git pull

# 3. 使用 CodeBuddy + Lighthouse 部署
# 选择最新的项目目录进行部署
```

---

## 验证清单

### 部署后验证

- [ ] **环境变量验证**
  - [ ] 后端容器内 DEEPSEEK_API_KEY 不为空
  - [ ] DEEPSEEK_BASE_URL 设置正确
  - [ ] ROOT_PATH 设置为 `/finestem/api`

- [ ] **路由验证**
  - [ ] Chat API 路径为 `/finestem/api/chat/completions`
  - [ ] Track A API 路径为 `/finestem/api/track-a/config/export`
  - [ ] Track E API 路径为 `/finestem/api/track-e/dataset/mock`

- [ ] **功能验证**
  - [ ] 通过前端界面访问 AI Chat 功能
  - [ ] AI Chat 返回真实的 DeepSeek 回复（不是模拟回复）
  - [ ] Track A 和 Track E 页面正常加载数据

- [ ] **多项目部署验证**
  - [ ] ROOT_PATH 配置保留
  - [ ] 支持在不同路径部署多个实例

---

## 关键点总结

### ✅ 正确的做法

1. **Router 前缀去掉尾随斜杠**
   - ❌ `prefix="/chat/"`
   - ✅ `prefix="/chat"`

2. **环境变量从 .env 文件读取**
   - ❌ `DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}` (依赖系统环境变量)
   - ✅ 从 `env_file:` 指定的 .env 文件读取

3. **保留 ROOT_PATH 配置**
   - ✅ 用于多项目部署支持
   - ✅ 统一管理应用基础路径

4. **前后端路径配置一致**
   - ✅ `VITE_API_BASE_URL=/finestem/api`
   - ✅ `ROOT_PATH=/finestem/api`

---

### ❌ 错误的做法

1. **硬编码 API Key**
   - ❌ 在 docker-compose.yml 中直接写入 API Key
   - ✅ 在 .env 文件中配置，通过 env_file 引用

2. **删除 ROOT_PATH**
   - ❌ 删除 ROOT_PATH 配置
   - ✅ 保留 ROOT_PATH，统一使用环境变量管理

3. **为每个 API 添加专用代理规则**
   - ❌ 在 nginx.conf 中为每个 API 添加专用规则
   - ✅ 使用通用的 `/finestem/api/` 代理规则

4. **在服务器端临时修改**
   - ❌ 在服务器上直接修改配置文件
   - ✅ 在本地代码中修复，然后部署

---

## 相关文件清单

### 需要修改的本地文件

| 文件路径 | 修改类型 | 修改内容 |
|---------|---------|---------|
| `apps/public-web/src/features/mvp/phase1/backend/routers/chat.py` | Router 前缀 | `prefix="/chat/` → `prefix="/chat"` |
| `apps/public-web/src/features/mvp/phase1/backend/routers/track_a.py` | Router 前缀 | `prefix="/track-a/"` → `prefix="/track-a"` |
| `apps/public-web/src/features/mvp/phase1/backend/routers/track_e.py` | Router 前缀 | `prefix="/track-e/"` → `prefix="/track-e"` |
| `apps/public-web/src/features/mvp/phase1/backend/routers/analytics.py` | Router 前缀 | `prefix="/analytics/"` → `prefix="/analytics"` |
| `apps/public-web/src/features/mvp/phase1/backend/.env` | 环境变量 | 确保 DEEPSEEK_API_KEY 有效 |
| `docker-compose.yml` | 环境变量 | 确保 env_file 正确引用 .env 文件 |

### 不需要修改的文件

| 文件路径 | 说明 |
|---------|------|
| `apps/public-web/src/features/mvp/phase1/web/nginx.conf` | nginx 配置保持不变 |
| `apps/public-web/src/features/mvp/phase1/backend/main.py` | main.py 配置保持不变 |

---

## 参考资料

### FastAPI Router 前缀文档
- 官方文档：https://fastapi.tiangolo.com/tutorial/bigger-applications/
- Router 前缀建议：使用无尾随斜杠的前缀

### Nginx 代理配置最佳实践
- 使用通用的代理规则，避免为每个端点添加专用规则
- 代理路径与后端路由路径一致

### 环境变量管理
- 使用 .env 文件管理环境变量
- 通过 docker-compose.yml 的 env_file 引用
- 不硬编码敏感信息到配置文件

---

**文档版本**: v1.0.0  
**创建时间**: 2025-12-28 17:50:00.000  
**维护者**: AI Agent
