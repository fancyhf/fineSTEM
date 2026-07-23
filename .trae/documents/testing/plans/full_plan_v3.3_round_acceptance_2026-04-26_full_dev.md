# fineSTEM V3.3 全量开发验收记录

created_at: 2026-04-26 10:09:47.937
owner: AI Agent
scope: Phase C~G 一次性交付

## 本轮完成项
- 文档链路：新增 `documents` API 与 `document_service`，支持 `proposal/technical/final` 文档生成，输出 `MD/JSON/PDF/DOCX`。
- 导出链路：增强 `projects/export`，支持 `MD/JSON/ZIP/PDF/DOCX`，ZIP 打包项目结题 MD/JSON。
- 证据闭环：新增 `evidence auto-collect` 接口；项目阶段推进自动写入 `auto_stage_change`；AI 对话自动沉淀 `auto_ai_summary`。
- 课程库：新增 `course-library` API，支持课程列表与新增。
- 能力标签：新增 `capability-tags` API，支持推荐、应用、查询。
- 前端入口：项目详情新增文档生成/导出/标签推荐按钮；新增课程库页面、在线代码编辑页；导航新增入口。
- 对话流式：前端对话页接入 WebSocket token 流渲染并保留回退逻辑。

## 关键文件
- `apps/backend/app/api/documents.py`
- `apps/backend/app/services/document_service.py`
- `apps/backend/app/api/projects.py`
- `apps/backend/app/api/evidence.py`
- `apps/backend/app/api/assistant_dialogues.py`
- `apps/backend/app/api/course_library.py`
- `apps/frontend/src/pages/ProjectDetail.tsx`
- `apps/frontend/src/pages/AIAssistantDialogues.tsx`
- `apps/frontend/src/pages/CourseLibrary.tsx`
- `apps/frontend/src/pages/OnlineCodeStudio.tsx`

## 验收命令
- 后端语法检查：`python -m compileall app main.py`（通过）
- 前端构建：`npm run build`（通过）
- IDE 诊断：`GetDiagnostics`（无新增错误）

## 备注
- PDF/DOCX 导出已改为内置生成实现，无需新增第三方依赖。
- 在线代码编辑器已交付可用版（编辑+预览），满足当前全链路要求。
