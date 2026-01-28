# fineSTEM MVP 1.0 技术架构文档

**文档版本**: v1.0.0
**创建时间**: 2026-01-28
**状态**: Draft

## 1. 引言

### 1.1 文档目的
本文档旨在描述 fineSTEM MVP 1.0 项目的技术架构、技术栈选择、模块划分及数据流向，为开发团队提供统一的技术参考。

### 1.2 项目背景
fineSTEM 是一个 STEM 教育平台，MVP 1.0 阶段主要包含物理模拟 (Track A) 和 经济/创业模拟 (Track E) 两大核心功能模块，以及 AI 辅助教学功能。

## 2. 总体架构

fineSTEM MVP 1.0 采用典型的前后端分离架构：
- **前端 (Frontend)**: 基于 React 的单页应用 (SPA)，负责用户界面、交互逻辑及物理引擎渲染。
- **后端 (Backend)**: 基于 FastAPI 的 Python 服务，提供 RESTful API，处理业务逻辑、数据分析及 AI 交互。
- **部署 (Deployment)**: 容器化部署，前端静态资源由 Nginx 或 FastAPI 挂载托管。

```mermaid
graph TD
    Client[Web Browser] -->|HTTP/HTTPS| Nginx[Nginx / Static Server]
    Client -->|API Requests| API[FastAPI Backend]
    
    subgraph "Frontend Layer"
        Nginx
        ReactApp[React App (SPA)]
    end
    
    subgraph "Backend Layer"
        API
        RouterA[Track A Router]
        RouterE[Track E Router]
        RouterChat[Chat Router]
        RouterAnalytics[Analytics Router]
    end
    
    subgraph "Data & Services"
        FileSystem[Local File System / JSON Configs]
        AIService[AI Model Service]
    end
    
    API --> RouterA
    API --> RouterE
    API --> RouterChat
    API --> RouterAnalytics
    
    RouterA --> FileSystem
    RouterE --> FileSystem
    RouterChat --> AIService
```

## 3. 技术栈 (Technology Stack)

### 3.1 前端 (Frontend)
| 类别 | 技术/库 | 说明 |
|------|---------|------|
| **核心框架** | React 18 | 用于构建用户界面的 JavaScript 库 |
| **语言** | TypeScript | 提供静态类型检查，提高代码质量 |
| **构建工具** | Vite | 高性能的前端构建与开发工具 |
| **UI 框架** | Tailwind CSS | 实用优先的 CSS 框架，用于快速样式开发 |
| **路由管理** | React Router DOM | 处理 SPA 的路由跳转 |
| **物理引擎** | Matter.js | 用于 Track A 的 2D 物理模拟 |
| **数据可视化** | ECharts (echarts-for-react) | 用于 Track E 和 Analytics 的图表展示 |
| **图标库** | Lucide React | 轻量级、一致的图标库 |
| **工具库** | clsx, tailwind-merge | 用于动态类名合并 |

### 3.2 后端 (Backend)
| 类别 | 技术/库 | 说明 |
|------|---------|------|
| **核心框架** | FastAPI | 高性能 Python Web 框架，支持异步 |
| **语言** | Python 3.12+ | 后端开发语言 |
| **服务器** | Uvicorn / Gunicorn | ASGI 服务器，生产环境使用 Gunicorn 管理 Uvicorn workers |
| **数据处理** | Pandas, NumPy | 用于数据分析和科学计算 |
| **网络请求** | Requests, Httpx | 用于调用外部 API (如 AI 服务) |
| **HTML 解析** | BeautifulSoup4 | 用于潜在的网页数据抓取或解析 |
| **配置管理** | python-dotenv | 管理环境变量 |

### 3.3 基础设施与部署 (Infrastructure)
- **Docker**: 应用容器化，提供一致的运行环境。
- **Nginx**: 高性能 HTTP 服务器，用于托管前端静态文件及反向代理。
- **Environment**: 使用 `.env` 文件进行环境配置管理。

## 4. 核心模块设计

### 4.1 目录结构
项目主要代码位于 `apps/public-web/src/features/mvp/phase1` 目录下：

- **backend/**: 后端服务代码
    - `main.py`: 应用入口，配置 CORS、静态文件挂载及路由包含。
    - `routers/`: 业务路由模块
        - `track_a.py`: 物理模拟相关接口
        - `track_e.py`: 经济模拟相关接口
        - `chat.py`: AI 对话接口
        - `analytics.py`: 数据分析接口
    - `models/`: Pydantic 数据模型定义
    - `data/`: 本地数据存储 (JSON 配置文件)
    - `tests/`: 自动化测试用例

- **web/**: 前端应用代码
    - `src/pages/`: 页面组件 (Home, TrackA, TrackE)
    - `src/components/`: 可复用组件
        - `Shared/AIChatPanel.tsx`: AI 助手面板
        - `TrackA/SimulationCanvas.tsx`: 物理仿真画布
    - `src/hooks/`: 自定义 Hooks (useAnalytics, useCanvasRecorder)

### 4.2 关键功能模块

#### 4.2.1 Track A (物理模拟)
- **前端**: 使用 `Matter.js` 在 Canvas 上进行物理世界的渲染和交互。支持录制功能 (`useCanvasRecorder`)。
- **后端**: `track_a` 路由处理与物理模拟相关的配置加载、状态保存等逻辑。

#### 4.2.2 Track E (经济/创业)
- **前端**: 基于 React 组件构建的交互界面，结合 ECharts 展示经济数据趋势。
- **后端**: `track_e` 路由处理经济模型计算、用户决策提交及结果反馈。

#### 4.2.3 AI Chat (智能助手)
- **前端**: 全局悬浮或嵌入式的聊天面板 (`AIChatPanel`)。
- **后端**: `chat` 路由负责接收用户消息，调用外部 LLM 服务，并返回流式或全量响应。

#### 4.2.4 Analytics (数据分析)
- **后端**: `analytics` 路由利用 Pandas 对用户行为数据或模拟数据进行分析，生成报表数据。
- **前端**: 通过 `useAnalytics` Hook 获取数据并展示。

## 5. 数据流与存储

### 5.1 数据流
1. 用户在 **Web 前端** 进行操作 (如调整物理参数、发送消息)。
2. 前端通过 `fetch` 或 `axios` 发起 HTTP 请求到 **FastAPI 后端**。
3. 后端路由接收请求，根据业务逻辑调用 **Pandas** 处理数据或 **External AI API**。
4. 处理结果以 JSON 格式返回给前端。
5. 前端更新 State，触发 UI 重绘。

### 5.2 数据存储
- **当前阶段 (MVP 1.0)**: 主要依赖文件系统 (`backend/data/` 目录下的 JSON 文件) 进行配置和简单数据的持久化。
- **未来规划**: 引入 SQLite 或 PostgreSQL 数据库以支持更复杂的用户数据和关系管理。

## 6. 部署方案

### 6.1 开发环境
- 前端: `npm run dev` (Vite Server, port 5173)
- 后端: `uvicorn main:app --reload` (port 8000)

### 6.2 生产环境 (Docker)
项目包含 Dockerfile，支持容器化部署。
- **方案 A (分离部署)**: 前端 Nginx 容器 + 后端 FastAPI 容器。
- **方案 B (融合部署)**: 前端构建为静态文件 (`dist/`)，由 FastAPI 通过 `StaticFiles` 挂载在 `/` 路径下提供服务，实现单容器部署。目前代码 (`main.py`) 已包含此逻辑的支持。

```python
# main.py 中的静态文件挂载逻辑
dist_path = os.path.join(os.path.dirname(__file__), "../web/dist")
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
```

## 7. 安全与规范
- **CORS**: 后端配置了 CORS 中间件，允许跨域访问 (生产环境需限制 `allow_origins`)。
- **环境隔离**: 敏感配置 (如 API Keys) 通过 `.env` 文件管理，不提交到代码仓库。
- **代码规范**: 前端遵循 ESLint + Prettier，后端遵循 PEP 8 (虽然未显式集成 Flake8/Black，但建议遵循)。
