# MVP Phase 1 Backend

fineSTEM MVP 第一阶段的后端服务，基于 FastAPI 构建。

## 技术栈

- **框架**: FastAPI
- **语言**: Python 3.12+
- **服务器**: Uvicorn (开发), Gunicorn (生产)
- **数据处理**: Pandas, NumPy

## 目录结构

```
backend/
├── data/           # 本地 JSON 数据存储
├── models/         # Pydantic 数据模型定义
├── routers/        # API 路由处理
│   ├── analytics.py # 数据分析接口
│   ├── chat.py      # AI 对话接口
│   ├── track_a.py   # Track A 物理模拟接口
│   └── track_e.py   # Track E 数据可视化接口
├── tests/          # 测试用例
├── main.py         # 应用入口
└── requirements.txt # 依赖列表
```

## 快速开始

### 1. 环境准备

确保已安装 Python 3.12+。建议使用虚拟环境。

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填入必要配置（如 API Key）。

```bash
cp .env.example .env
```

### 4. 启动服务

```bash
# 开发模式 (热重载)
uvicorn main:app --reload --port 8000
```

API 文档地址: `http://localhost:8000/docs`
