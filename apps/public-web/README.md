# Public Web Application

fineSTEM 的核心 Web 应用，包含 MVP 1.0 的功能实现。

## 功能模块 (MVP Phase 1)

代码位于 `src/features/mvp/phase1/` 目录下：

- **Track A (物理模拟)**: 基于 Matter.js 的物理沙盒。
- **Track E (经济/数据)**: 基于 ECharts 的数据分析与图表展示。
- **AI Chat**: 集成 LLM 的智能助手面板。

## 目录结构

```
public-web/
└── src/
    └── features/
        └── mvp/
            └── phase1/
                ├── backend/    # Python FastAPI 后端
                │   ├── routers/    # API 路由 (track_a, track_e, chat)
                │   ├── models/     # Pydantic 模型
                │   └── data/       # 本地 JSON 数据存储
                └── web/        # React + Vite 前端
                    ├── src/
                    │   ├── pages/      # 页面组件
                    │   ├── components/ # 通用组件
                    │   └── hooks/      # 自定义 Hooks
                    └── dist/       # 构建产物
```

## 启动指南

请参考根目录的 [README.md](../../../README.md) 获取快速启动命令。

### 前后端联调
- 前端默认代理 `/api` 请求到 `http://localhost:8000`。
- 后端通过 CORS 允许前端跨域访问（开发环境）。
- 生产环境下，FastAPI 可直接挂载前端构建后的静态文件 (`dist/`)，实现单容器部署。
