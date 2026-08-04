# 精选管理五页签与 Demo 上线校验 Spec

## Why
- 精选管理页面此前经历过一次「误删业务功能」，用户回撤后再次强调：管理员在此页面必须能一站式管理**全部项目**、**自己的项目**、**Demo 项目**、**精选作品**、**灵感墙**，并支持按用户/项目名/模式等条件搜索。
- 当前 [AdminFeatured.tsx](file:///g:/mediaProjects/fineSTEM/apps/frontend/src/pages/AdminFeatured.tsx) 已恢复五个页签与"全部项目"搜索过滤（项目名/作者名输入/模式），但仍有两处未闭环：
  1. **作者名过滤后端未支持模糊匹配**：目前只有 `author_id`，前端"作者名筛选"输入框无法真正生效。
  2. **Demo 上线无字段校验**：`is_featured_demo=true` 可以被随意设置，未强制要求项目具备 Demo 展示所需字段（名称/简介/展示模式/截图/技术栈/学科/项目拆解等），可能导致前台 Demo 卡片显示空白。
- 严格约束：**不得删除任何现有 UI 与业务流程**（用户已多次强调），仅补齐上述两处并保持所有既有 handler、按钮、页签、排序输入、取消灵感墙、取消 Demo、取消精选、跳转项目详情等能力。

## What Changes
- 后端新增 `author_name` 查询参数：`GET /projects/admin/featured` 接受 `author_name`，对 `users.name` 做 ILIKE 模糊匹配（不与 `author_id` 互斥，同时提供时以 `author_id` 优先）。
- 前端 `projectsApi.listForAdmin` 参数类型新增可选 `author_name?: string`。
- 前端 [AdminFeatured.tsx](file:///g:/mediaProjects/fineSTEM/apps/frontend/src/pages/AdminFeatured.tsx) 的"全部项目"搜索栏，将"作者名筛选"输入框实际提交为 `author_name`（保留输入框 UI，仅修正提交语义）。
- 前端"设为 Demo"操作前置字段校验：点击时执行客户端字段完整性检查；若缺字段则弹出对话框列出**待补齐项**并跳转项目详情页，不直接调用 `updateFeatured`。
- 后端 `PATCH /projects/{id}/featured` 在设置 `is_featured_demo=true` 时执行同一份字段校验；缺字段返回 `422` + `details.missing_fields[]`，前端 toast 提示"以下字段未完善"。
- 校验字段清单（Demo 必备）：
  - `name`（非空）
  - `description`（非空）
  - `mode`（`light` / `standard`）
  - `tech_stack`（数组非空）
  - `capability_tags`（数组非空）
  - `screenshots`（数组非空，至少 1 张封面/截图，若项目模型无该字段则用关联的成果卡 `screenshots`）
  - 关联成果卡：`achievement_cards` 中至少一条 `is_public=true` 或存在 project_breakdown（保证有拆解可看）
- **不涉及任何页面 UI 删除**；不改动 ProjectDetail、ExploreDemos、Home、DemoCard 等既有页面。

## Impact
- Affected specs: 精选灵感墙 Demo 数据源统一（`.trae/documents/技术与架构/精选灵感墙Demo数据源统一方案与测试计划_v1.0.md`）
- Affected code:
  - 后端：[apps/backend/app/api/projects.py](file:///g:/mediaProjects/fineSTEM/apps/backend/app/api/projects.py)（`list_for_admin`、`update_featured`）
  - 后端仓库：[apps/backend/app/repositories/project_repo.py](file:///g:/mediaProjects/fineSTEM/apps/backend/app/repositories/project_repo.py) 或对应 runtime_db/memory 实现
  - 前端 API：[apps/frontend/src/services/api.ts](file:///g:/mediaProjects/fineSTEM/apps/frontend/src/services/api.ts)
  - 前端页面：[apps/frontend/src/pages/AdminFeatured.tsx](file:///g:/mediaProjects/fineSTEM/apps/frontend/src/pages/AdminFeatured.tsx)
  - 后端测试：`apps/backend/tests/test_projects_admin.py`（新增或扩展）

## ADDED Requirements

### Requirement: 全部项目按作者名模糊搜索
系统 SHALL 允许 admin 在"全部项目"页签通过作者名模糊过滤项目列表。

#### Scenario: 按作者名搜索命中
- **WHEN** admin 在"作者名筛选"输入框填入部分用户名（如 "zhang"），点击"搜索"
- **THEN** 后端返回作者姓名 ILIKE `%zhang%` 的项目集合
- **AND** 前端展示的每张项目卡片作者字段包含该子串

#### Scenario: 作者名与项目名同时搜索
- **WHEN** admin 同时在项目名搜索框填入 "AI"、作者名筛选填入 "li"
- **THEN** 后端返回项目名 ILIKE `%AI%` 且作者名 ILIKE `%li%` 的项目集合

### Requirement: Demo 上线字段校验（前端 + 后端双重）
系统 SHALL 在 admin 将项目设为 Demo 前校验项目的 Demo 展示字段是否完整；缺字段时禁止上线并提示补齐项。

#### Scenario: 字段完整时允许设为 Demo
- **WHEN** admin 在"全部项目"或"我的项目"页签点击某项目的"设为 Demo"
- **AND** 该项目 `name`、`description`、`mode`、`tech_stack`、`capability_tags`、`screenshots`、`achievement_cards` 均满足要求
- **THEN** 前端调用 `projectsApi.updateFeatured` 传 `is_featured_demo=true`
- **AND** 后端 `PATCH /projects/{id}/featured` 返回 200，项目变为 Demo 项目

#### Scenario: 字段缺失时拦截并列出待补项
- **WHEN** admin 点击"设为 Demo"，项目缺少 `tech_stack` 或 `screenshots`
- **THEN** 前端弹出对话框列出「缺失字段清单」，并提供"去项目详情完善"按钮跳转 `/projects/{id}`
- **AND** 若前端被绕过，后端 `PATCH /projects/{id}/featured` 返回 `422 { code, message, details: { missing_fields: [...] } }`

## MODIFIED Requirements

### Requirement: 精选管理页面五页签结构
系统 SHALL 在 `/admin/featured` 提供单层五页签：全部项目、我的项目、Demo 项目、精选作品、灵感墙；搜索/过滤仅出现在"全部项目"页签。（当前实现已符合，本 spec 保留并强化，不做删减）

#### Scenario: 页签切换重置分页
- **WHEN** admin 在任一页签点击其他页签
- **THEN** 对应数据源分页归位到第 1 页
- **AND** 已有 handler（设为/取消 Demo、设为/取消精选、取消灵感墙、排序、查看项目/详情）在对应页签下继续可用

## REMOVED Requirements
（无删除项。严禁移除任何既有 UI、handler、按钮、页签。）
