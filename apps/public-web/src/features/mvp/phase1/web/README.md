# MVP Phase 1 Frontend

fineSTEM MVP 第一阶段的前端应用，基于 React 和 Vite 构建。

## 技术栈

- **框架**: React 18
- **构建工具**: Vite
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **核心库**:
  - Matter.js (物理模拟)
  - ECharts (数据图表)

## 目录结构

```
web/
├── src/
│   ├── components/     # UI 组件
│   │   ├── Shared/     # 通用组件
│   │   ├── TrackA/     # Track A 专用组件
│   │   └── TrackE/     # Track E 专用组件
│   ├── hooks/          # 自定义 React Hooks
│   ├── pages/          # 页面路由组件
│   ├── types/          # TypeScript 类型定义
│   ├── App.tsx         # 根组件
│   └── main.tsx        # 入口文件
└── vite.config.ts      # Vite 配置
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

默认访问地址: `http://localhost:5173`

### 3. 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

## 配置

- **环境变量**: 参考 `.env.production.example`
- **代理**: 开发环境下 API 请求会被代理到 `http://localhost:8000` (见 `vite.config.ts`)
