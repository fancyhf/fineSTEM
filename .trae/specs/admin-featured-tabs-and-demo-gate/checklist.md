# Checklist

## 后端能力
- [x] `GET /projects/admin/featured?author_name=测试` 返回作者姓名 ILIKE `%测试%` 的项目集合（test_author_name_ilike_match 通过）
- [x] `GET /projects/admin/featured?search=AI&author_name=测试` 同时按项目名与作者名过滤（test_author_name_and_search_combined 通过）
- [x] `PATCH /projects/{id}/featured` body `is_featured_demo=true` 且项目字段完整 → 200 OK（test_set_demo_success_when_all_fields_ready 通过）
- [x] `PATCH /projects/{id}/featured` body `is_featured_demo=true` 且缺 `screenshots` → 422，返回 `details.missing_fields` 含 `screenshots`（test_set_demo_fails_when_screenshots_missing 通过）
- [x] `PATCH /projects/{id}/featured` body `is_featured_demo=true` 且缺关联成果卡 → 422，返回 `details.missing_fields` 含 `achievement_card`（test_set_demo_fails_when_no_achievement_card 通过）
- [x] `PATCH /projects/{id}/featured` body `is_featured_demo=false` 不触发字段校验（可随时取消 Demo）（test_unset_demo_skips_validation 通过）
- [x] `author_id` 与 `author_name` 同时传入时按 `author_id` 优先（test_author_id_priority_over_author_name 通过）
- [x] 非 admin 用户访问 `/projects/admin/featured` → 403（test_non_admin_forbidden 通过）

## 前端能力
- [x] `projectsApi.listForAdmin` TS 类型包含可选 `author_name`（[api.ts](file:///g:/mediaProjects/fineSTEM/apps/frontend/src/services/api.ts)）
- [x] AdminFeatured "全部项目" 页签作者名输入框提交为 `author_name`（handleSubmitFilters + loadProjects 中 params.author_name）
- [x] AdminFeatured 五个页签（全部项目/我的项目/Demo 项目/精选作品/灵感墙）全部保留并可切换（[AdminFeatured.tsx](file:///g:/mediaProjects/fineSTEM/apps/frontend/src/pages/AdminFeatured.tsx#L36-L42) 常量 `TABS`）
- [x] AdminFeatured 中已有 handler（`handleSetFeaturedDemo`、`handleFeatureCard`、`handleAdminWithdraw`、`handleCardSortSave`、`handleDemoSortSave`）与对应按钮全部保留
- [x] 点击"设为 Demo"当字段缺失时弹出「缺失字段清单」并可跳转项目详情页（validateDemoReady + window.confirm + navigate）
- [x] 点击"设为 Demo"当字段完整时正常调用 API 并 toast 成功
- [x] 后端返回 422 时前端 toast 展示 `missing_fields` 列表（catch 分支匹配 `detail?.status === 422`）

## 未破坏项验证
- [x] ProjectDetail 页面"选入精选 Demo"按钮未受影响（本次未修改 ProjectDetail.tsx）
- [x] ExploreDemos / Home / DemoCard 未被修改
- [x] 全部项目页签的搜索/过滤 UI 未删除，其他四个页签不显示搜索栏（符合原始需求）

## 测试执行
- [x] `npx tsc --noEmit` 前端零错误（exit code 0）
- [x] `pytest tests/test_projects_admin.py` 全绿（9 passed, 1 warning in 4.52s）
