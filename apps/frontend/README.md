# fineSTEM 前端应用

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **路由**: React Router
- **图标**: Lucide React

## 目录结构

```
frontend/
├── src/
│   ├── components/        # UI 组件
│   │   ├── ui/          # 基础 UI 组件
│   │   └── layout/       # 布局组件
│   ├── pages/            # 页面组件
│   ├── services/         # API 服务
│   ├── types/            # TypeScript 类型定义
│   ├── lib/              # 工具函数
│   ├── App.tsx           # 主应用组件
│   ├── main.tsx          # 应用入口
│   └── index.css         # 全局样式
├── public/                # 静态资源
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 设计规范

- **主色调**: 蓝绿色 (#14B8A6)
- **字体**: 中文使用系统默认，英文使用 Inter
- **响应式断点**: sm/md/lg/xl/2xl

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产
npm run build

# 预览构建
npm run preview

# 代码检查
npm run lint
```

---
version: 1.0.0
created_at: 2026-04-23
maintainer: AI Agent