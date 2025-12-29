## 📋 环境变量配置分析方案

### 一、docker-compose.yml 配置总览

#### 1️⃣ **后端服务**（第5-34行）

**构建参数：**

**yaml**

复制

插入

新建文件

保存

应用

```yaml
args:
  - DEBIAN_FRONTEND=noninteractive
```

**环境变量（直接定义）：**

**yaml**

复制

插入

新建文件

保存

应用

```yaml
environment:
  - PYTHONUNBUFFERED=1          # Python 输出不缓冲
  - PORT=8000                    # 服务端口
  - ROOT_PATH=/finestem/api      # API 根路径 ⭐
  - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}  # 从系统环境变量读取
```

**env_file：**

**yaml**

复制

插入

新建文件

保存

应用

```yaml
- ./apps/public-web/src/features/mvp/phase1/backend/.env.development
```

---

#### 2️⃣ **前端服务**（第37-58行）

**构建参数：**

**yaml**

复制

插入

新建文件

保存

应用

```yaml
args:
  - BASE_PATH: /finestem/        # 前端基础路径 ⭐
  - API_BASE_URL: /finestem/api  # API 基础地址 ⭐
```

**环境变量：**

- 无直接定义的 `environment` 块
- 无 `env_file` 定义（Dockerfile 内部会读取 .env 文件）

---

### 二、后端环境变量详解

#### 🟢 **开发环境**（`.env.development`）

| 变量名                 | 值                                     | 说明              |
| ------------------- | ------------------------------------- | --------------- |
| `DEEPSEEK_API_KEY`  | `sk-41c2d916808941a0bf1aa2613e910d80` | DeepSeek API 密钥 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com`            | API 基础地址        |

#### 🔴 **生产环境**（`.env.production`）

| 变量名                 | 值                                     | 说明              |
| ------------------- | ------------------------------------- | --------------- |
| `DEEPSEEK_API_KEY`  | `sk-41c2d916808941a0bf1aa2613e910d80` | DeepSeek API 密钥 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com`            | API 基础地址        |
| `PORT`              | `8000`                                | 服务端口            |
| `DEBUG`             | `False`                               | 调试模式关闭          |
| `ENVIRONMENT`       | `production`                          | 环境标识            |
| `ALLOWED_ORIGINS`   | `*`                                   | CORS 允许所有域名     |
| `LOG_LEVEL`         | `INFO`                                | 日志级别            |
| `LOG_FILE`          | `./logs/finestem.log`                 | 日志文件路径          |

#### ⚙️ **docker-compose.yml 后端最终生效变量：**

1. **直接定义的 `environment` 优先级最高**（会覆盖 env_file）
   
   - `PYTHONUNBUFFERED=1`
   - `PORT=8000`
   - `ROOT_PATH=/finestem/api` ⭐
   - `DEEPSEEK_API_KEY` 从系统环境变量读取

2. **从 env_file 补充的变量**：
   
   - `DEEPSEEK_BASE_URL=https://api.deepseek.com`
   - （生产环境还需补充：DEBUG, ENVIRONMENT, ALLOWED_ORIGINS, LOG_LEVEL, LOG_FILE）

---

### 三、前端环境变量详解

#### 🟢 **开发环境**（`.env.development`）

| 变量名                 | 值             | 说明           |
| ------------------- | ------------- | ------------ |
| `VITE_API_BASE_URL` | (空字符串)        | 使用 Vite 开发代理 |
| `VITE_APP_NAME`     | `FineSTEM`    | 应用名称         |
| `VITE_ENV`          | `development` | 环境标识         |
| `VITE_DEBUG`        | `true`        | 调试模式开启       |
| `VITE_APP_VERSION`  | `1.0.0`       | 应用版本         |

#### 🔴 **生产环境**（`.env.production`）

| 变量名                 | 值               | 说明       |
| ------------------- | --------------- | -------- |
| `VITE_API_BASE_URL` | `/finestem/api` | API 地址 ⭐ |
| `VITE_APP_NAME`     | `FineSTEM`      | 应用名称     |
| `VITE_ENV`          | `production`    | 环境标识     |
| `VITE_DEBUG`        | `false`         | 调试模式关闭   |
| `VITE_APP_VERSION`  | `1.0.0`         | 应用版本     |

#### ⚙️ **docker-compose.yml 前端构建参数：**

- `BASE_PATH: /finestem/` ⭐ （通过构建时参数传递）
- `API_BASE_URL: /finestem/api` ⭐ （通过构建时参数传递）

**注意**：前端构建参数与 .env 文件的关系

- `BASE_PATH` 和 `API_BASE_URL` 是构建时参数，会在 Dockerfile 构建阶段注入
- `.env.production` 中的 `VITE_API_BASE_URL=/finestem/api` 应该与构建参数一致
- 两者都应该指向 `/finestem/api` 以确保 nginx 代理正确工作

---

### 四、关键路径配置总结

| 配置项              | 值               | 使用位置                                                 |
| ---------------- | --------------- | ---------------------------------------------------- |
| **ROOT_PATH**    | `/finestem/api` | 后端服务根路径（docker-compose.yml）                          |
| **BASE_PATH**    | `/finestem/`    | 前端基础路径（docker-compose.yml 构建参数）                      |
| **API_BASE_URL** | `/finestem/api` | 前端 API 地址（docker-compose.yml 构建参数 + .env.production） |

**配置一致性确认** ✅：

- `docker-compose.yml` 中的 `BASE_PATH=/finestem/` ✅
- `docker-compose.yml` 中的 `API_BASE_URL=/finestem/api` ✅
- `docker-compose.yml` 中的 `ROOT_PATH=/finestem/api` ✅
- `.env.production` 中的 `VITE_API_BASE_URL=/finestem/api` ✅

所有路径配置均正确且一致！
