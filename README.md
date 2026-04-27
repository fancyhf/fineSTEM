# fineSTEM - 青少年 STEM 研学助手

## 项目简介

fineSTEM 是一个面向青少年的 STEM 学习平台，提供：

- 🎓 探索中心 - 发现有趣的 STEM 项目
- ✨ AI 创作 - 快速启动轻量级项目
- 🔬 研究模式 - 完整的科研流程
- 📜 成果展示 - 成就卡片与灵感墙

## 技术架构

- **后端**: FastAPI (Python)
- **前端**: React + TypeScript + Vite + Tailwind CSS
- **AI 底座**: ZeroClaw (嵌入式)
- **UI 风格**: 蓝绿色主题 (#14B8A6)

## 项目规范

本项目严格遵循 `.trae/rules/project_rules.md` 中的规范：

### 代码规范

- ✅ 命名规范：API/JSON 用 camelCase，类名用 PascalCase
- ✅ 文档规范：所有公共方法有中文文档
- ✅ 日志规范：日志和异常使用中文
- ✅ 文件头部：有标准注释（用途、维护者、links）

### Git 规范

- ✅ 分支策略：main / develop / feature/* / hotfix/*
- ✅ 提交规范：Conventional Commits
- ✅ 变更审计：PR 包含背景、影响范围、兼容策略

### 开发流程

- ✅ 研究 → 计划 → 实现 → 测试
- ✅ 覆盖目标：业务逻辑 ≥80%，关键路径 100%

## 快速开始

### 前置条件

- Python 3.12+
- Node.js 18+
- npm 或 yarn

### 启动项目

1. **后端启动**
```bash
cd apps/backend
pip install -r requirements.txt
python main.py
```

2. **前端启动**
```bash
cd apps/frontend
npm install
npm run dev
```

3. **访问应用**
- 前端: http://localhost:5173
- API 文档: http://localhost:8000/docs

## 目录结构

```
fineSTEM/
├── apps/                    # 应用目录
│   ├── frontend/           # 前端应用
│   └── backend/            # 后端 API
├── .trae/                  # 项目规范与文档
│   ├── rules/             # 项目规则
│   └── documents/         # 产品文档
└── README.md               # 项目说明
```

## 开发阶段

- ✅ **阶段 1**: 项目搭建与规范确立
- 🔄 **阶段 2**: MVP 功能开发（进行中）
- 📝 **阶段 3**: 测试与优化

---
version: 1.0.0
created_at: 2026-04-23
maintainer: AI Agent