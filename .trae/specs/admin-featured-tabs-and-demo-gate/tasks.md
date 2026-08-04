# Tasks

- [x] Task 1: 后端 `list_for_admin` 增加 `author_name` 参数
  - [x] SubTask 1.1: 修改 [apps/backend/app/api/projects.py](file:///g:/mediaProjects/fineSTEM/apps/backend/app/api/projects.py) `list_for_admin` 端点，新增 `author_name: Optional[str] = None`，透传到 repo 层
  - [x] SubTask 1.2: 修改 project_repo 与 runtime_db / memory 实现，`list_projects_for_admin` 与 `count_projects_for_admin` 增加 `author_name` 参数，JOIN `users` 表并按 `users.name` ILIKE 匹配
  - [x] SubTask 1.3: `author_id` 与 `author_name` 同时传入时，按 `author_id` 精确匹配优先，忽略 `author_name`

- [x] Task 2: 后端 `update_featured` 增加 Demo 上线字段校验
  - [x] SubTask 2.1: 在 [apps/backend/app/api/projects.py](file:///g:/mediaProjects/fineSTEM/apps/backend/app/api/projects.py) `update_featured` 中，当请求 body 的 `is_featured_demo=true` 时执行校验函数
  - [x] SubTask 2.2: 校验项目 `name/description/mode`，以及关联 `achievement_cards.one_liner/screenshots/capability_tags` 非空
  - [x] SubTask 2.3: 缺字段时 raise `HTTPException(status_code=422, detail={code, message, details:{missing_fields:[...]}} )`

- [x] Task 3: 前端 API 类型与 AdminFeatured 提交语义
  - [x] SubTask 3.1: 在 [apps/frontend/src/services/api.ts](file:///g:/mediaProjects/fineSTEM/apps/frontend/src/services/api.ts) `projectsApi.listForAdmin` 参数类型新增 `author_name?: string`
  - [x] SubTask 3.2: 修改 [apps/frontend/src/pages/AdminFeatured.tsx](file:///g:/mediaProjects/fineSTEM/apps/frontend/src/pages/AdminFeatured.tsx) 中 `handleSubmitFilters` 将作者输入框提交为 `author_name`（保留 UI，不删除任何页签/按钮/handler）

- [x] Task 4: 前端"设为 Demo"字段校验拦截
  - [x] SubTask 4.1: 在 AdminFeatured.tsx 抽出 `validateDemoReady(project)` 函数返回 `missing_fields[]`
  - [x] SubTask 4.2: `handleSetFeaturedDemo` 在 `value=true` 分支先调用校验；缺字段时用 `window.confirm` 展示清单并跳转 `/projects/{id}`
  - [x] SubTask 4.3: 捕获后端 422 响应并 toast 展示 `details.missing_fields` 内容

- [x] Task 5: 测试与验收
  - [x] SubTask 5.1: 后端新增 `apps/backend/tests/test_projects_admin.py`：覆盖 `author_name` 模糊搜索与 Demo 字段校验 422（共 9 个用例）
  - [x] SubTask 5.2: 运行 `npx tsc --noEmit`（前端）零错误
  - [x] SubTask 5.3: 运行 `pytest apps/backend/tests/test_projects_admin.py` 全绿（9 passed）

# Task Dependencies
- Task 3 依赖 Task 1（前端类型需匹配后端参数）
- Task 4 依赖 Task 2（前端 422 处理需要后端返回结构）
- Task 5 依赖 Task 1、Task 2、Task 3、Task 4

# 验收结果
- 后端测试：`pytest tests/test_projects_admin.py` → **9 passed, 1 warning in 4.52s**
- 前端类型检查：`npx tsc --noEmit` → **exit code 0**
