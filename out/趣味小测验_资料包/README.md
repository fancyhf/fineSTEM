# 趣味小测验 — 项目资料包

> 由 fineSTEM AI 导师辅助完成  
> 导出时间：2026-06-18 00:39 UTC  
> 项目模式：标准 PBL 研学流程

## 项目简介

（请在项目详情页补充项目描述）

## 目录结构（IDE 友好）

| 目录/文件 | 说明 |
|-----------|------|
| `src/` | **项目源代码** — IDE 可直接识别为源码目录 |
| `docs/` | 项目文档：开题报告、技术报告、结题报告、AI 对话记录 |
| `evidence/` | 项目证据：代码快照、文档、资源文件 |
| `data/` | 项目状态数据：工作区快照、技能状态、步骤数据、成果档案卡 |
| `project_files/` | 原始项目文件备份（storage + repository） |
| `index.html` | 资料包导航页，双击在浏览器中浏览所有内容 |
| `project.json` | 项目完整元数据 |
| `manifest.json` | 资料包内容清单 |
| `.gitignore` | Git 忽略规则，适合直接导入 IDE 管理 |

## 快速开始

1. **导入 IDE**：解压后直接用 VS Code / Trae / Cursor 打开此目录即可
2. **查看代码**：`src/` 目录包含项目源代码文件
3. **浏览资料**：双击 `index.html` 在浏览器中查看完整资料包导航
4. **查阅报告**：`docs/` 中可找到 AI 生成的结题报告（PDF/DOCX/MD）
5. **分享成果**：`data/achievement_card.json` 包含成果档案卡数据

## 文档目录详情

```
├── src/                        # 项目源代码（IDE 自动识别）
│   └── main.{html|js|py|...}  # 主代码文件
├── docs/                       # 文档中心
│   ├── proposal/               # 开题报告（MD/JSON/DOCX/PDF）
│   ├── technical/              # 技术报告（MD/JSON/DOCX/PDF）
│   ├── final/                  # 结题报告（MD/JSON/DOCX/PDF）
│   ├── stage_artifacts/        # 各阶段产物文档
│   ├── evidence/               # 证据中的文档/文本
│   └── chat_messages.json      # AI 对话记录
├── evidence/                   # 项目证据
│   ├── code/                   # 证据代码片段
│   ├── assets/                 # 图片等资源引用
│   └── *.json                  # 其他类型证据
├── data/                       # 项目数据
│   ├── workspace.json          # 工作区完整快照
│   ├── skill_state.json        # 研学技能状态
│   ├── steps/                  # 各阶段步骤数据
│   └── achievement_card.json   # 成果档案卡
└── project_files/              # 原始项目文件备份
    ├── storage/                # 磁盘存储备份
    └── repository/             # 仓库文件备份
```

---

*本资料包由 fineSTEM 平台自动生成，记录了你完整的研学项目旅程。*
