# fineSTEM 应用目录

## 目录结构

- **frontend/** - 前端应用（Vite + React + TypeScript + Tailwind CSS）
- **backend/** - 后端 API（FastAPI + Python）

## 开发规范

本项目遵循 `.trae/rules/project_rules.md` 中的规范：

- ✅ API/JSON 字段使用 camelCase
- ✅ 类名使用 PascalCase
- ✅ 所有公共方法有中文文档
- ✅ 日志和异常使用中文
- ✅ 文件头部有规范注释

## 快速开始

### 后端开发
```bash
cd apps/backend
pip install -r requirements.txt
python main.py
```

### 前端开发
```bash
cd apps/frontend
npm install
npm run dev
```

---
version: 1.0.0
created_at: 2026-04-23
maintainer: AI Agent