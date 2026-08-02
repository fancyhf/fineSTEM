# 精选 Demo / 精选作品 / 灵感墙架构问题与重构方案

**文档版本**：v1.0  
**创建时间**：2026-08-02  
**维护者**：AI Agent  
**文档状态**：已审阅，待实施  

---

## 一、问题背景

### 1.1 现象

- `AdminFeatured` 管理页中，精选 Demo、精选作品、灵感墙三个标签页各只显示 1 个项目
- 首页三个区域能正常显示多个项目
- 管理员在 `ProjectDetail` 页操作精选/灵感墙，结果不反映到首页

### 1.2 根本原因

系统中存在**三条完全独立的读写孤岛**，不同页面从不同数据源读写，互不连通。

---

## 二、数据源混乱矩阵（当前错误状态）

| 功能 | 首页读取 | ProjectDetail 写入 | AdminFeatured 读写 |
|------|---------|-------------------|-------------------|
| 精选 Demo | `demos` 表（`demosApi.list`） | `projects.is_featured_demo`（`projectsApi.updateFeatured`） | 无 |
| 精选作品 | `achievement_cards.is_featured`（`achievementCardsApi.listFeatured`） | `projects.is_featured_work`（`projectsApi.updateFeatured`） | `achievement_cards.is_featured`（正确） |
| 灵感墙 | `achievement_cards.is_public`（`achievementCardsApi.listPublic`） | `projects.visibility`（`projectsApi.updateVisibility`） | 无 |

**附加问题**：`api.ts` 中 `projectsApi.listFeaturedDemos/Works/listPublic` 三个方法有定义，但没有任何页面调用，属于死代码。

---

## 三、涉及文件清单

### 3.1 前端

| 文件 | 问题 |
|------|------|
| `apps/frontend/src/pages/Home.tsx` | 精选 Demo 读 `demos` 表，精选作品/灵感墙读 `achievement_cards`，三区数据源不统一于一套规则 |
| `apps/frontend/src/pages/ProjectDetail.tsx` | 精选作品、灵感墙操作写 `projects` 表，与首页读取来源不通 |
| `apps/frontend/src/pages/AdminFeatured.tsx` | 只管 `achievement_cards` 精选，缺失灵感墙管理和 Demo 管理 |
| `apps/frontend/src/services/api.ts` | 存在 `projectsApi.listFeaturedDemos/Works/listPublic` 死代码接口 |

### 3.2 后端

| 文件 | 问题 |
|------|------|
| `apps/backend/app/api/demos.py` | 只有 GET 接口，无管理员写接口（POST/PATCH/DELETE） |
| `apps/backend/app/api/projects.py` | `/featured/demos`、`/featured/works`、`/public/inspiration`、`/admin/featured` 接口存在但前端未消费 |
| `apps/backend/app/repositories/demo_repo.py` | `list_demos` 查询只过滤 `is_deleted`，不过滤 `is_public`，草稿 Demo 也会出现在展示墙 |

---

## 四、各表业务定位（正确理解）

### 4.1 `demos` 表

**性质**：系统制作的**教学模板资源**，由管理员维护，不是用户作品。

**专属字段**：
- `iframe_url` / `display_mode` — 可嵌入运行的在线 Demo
- `project_breakdown` — 项目拆解说明文档
- `explanation_doc` — AI 讲解文档
- `minimal_replica` / `fork_template_id` — 可 Fork 的代码骨架
- `code_url` / `download_url` — 代码下载
- `tech_stack` / `subjects` / `difficulty` / `grade_range` — 教学标签，支持筛选
- `is_public` — 上架/下架控制（当前未生效）

**当前状态**：数据通过 `SEED_DEMOS` 硬编码种子写入，无管理界面，`is_public` 字段未被消费。

### 4.2 `achievement_cards` 表

**性质**：用户完成项目后生成的**成果档案卡**，是项目已完成的标志。

**相关字段**：
- `is_public` — 用户主动公开到灵感墙
- `is_featured` — 管理员精选到首页精选作品区
- `featured_sort_order` — 精选排序权重

### 4.3 `projects` 表

**相关字段（待废弃）**：
- `is_featured_demo` — 无消费者，可废弃
- `is_featured_work` — 无消费者，可废弃
- `visibility` — 无消费者（首页不读此字段），可废弃

---

## 五、正确的数据架构（目标状态）

```
精选 Demo（首页 + Explore Demo 墙）
  唯一数据源：demos 表，is_public = true
  读：demosApi.list() → GET /api/v1/demos（需加 is_public 过滤）
  写：管理员在 Demo 管理后台操作

精选作品（首页精选作品区）
  唯一数据源：achievement_cards 表，is_featured = true
  读：achievementCardsApi.listFeatured() → GET /api/v1/achievement-cards/featured（已正确）
  写：管理员在 AdminFeatured 精选作品标签页操作（已正确）

灵感墙（首页灵感墙区）
  唯一数据源：achievement_cards 表，is_public = true
  读：achievementCardsApi.listPublic() → GET /api/v1/achievement-cards/inspiration-wall（已正确）
  写：用户在 ProjectDetail 页操作成果卡（需修复，目前写的是 projects.visibility）
       管理员可在后台强制下架任何人的内容（缺失）
```

---

## 六、Demo 完整生命周期设计

Demo 不是凭空创建的，应该是从一个完整项目"升格"而来：

```
1. 管理员完成一个研学项目（走正常项目流程）
2. 项目完成 → 生成成果卡（achievement_card）
3. 补充 Demo 专属内容：
   - 录制/填写 iframe_url（可运行版本）
   - 编写 project_breakdown（项目拆解）
   - 调用 AI 讲解功能生成 explanation_doc
   - 填写 minimal_replica（Fork 代码骨架）
4. 设置 is_public = true → 上架到 Demo 墙
```

---

## 七、需修复/新建清单

### 7.1 修复类（堵漏，影响线上数据一致性）

| 序号 | 文件 | 修改内容 |
|------|------|---------|
| F-01 | `ProjectDetail.tsx` | "选入精选作品"按钮改为操作 `achievementCardsApi.setFeatured(achievement.id, ...)`；若无成果卡则禁用并提示 |
| F-02 | `ProjectDetail.tsx` | "发布到灵感墙"按钮改为操作 `achievementCardsApi` publish/unpublish；若无成果卡则禁用并提示 |
| F-03 | `ProjectDetail.tsx` | 删除"选入精选 Demo"按钮（Demo 是系统资源，不走用户项目入口） |
| F-04 | `demo_repo.py` | `list_demos` 公开查询加 `is_public = true` 过滤条件 |

### 7.2 新建类（补能力）

| 序号 | 文件 | 新增内容 |
|------|------|---------|
| N-01 | `apps/backend/app/api/demos.py` | 补充管理员写接口：POST 新建、PATCH 编辑字段、PATCH 上下架（`is_public`） |
| N-02 | `apps/frontend/src/services/api.ts` | `demosApi` 补充管理端方法：`create`、`update`、`setPublic` |
| N-03 | `AdminFeatured.tsx` | 扩展为三标签管理中心：精选作品 + 灵感墙管理 + Demo 管理 |
| N-04 | `App.tsx` | 无需新增路由，在现有 `/admin/featured` 下增加标签页即可 |

### 7.3 清理类（减少混乱）

| 序号 | 文件 | 处理内容 |
|------|------|---------|
| C-01 | `api.ts` | 删除或标记废弃 `projectsApi.listFeaturedDemos/Works/listPublic` 死代码 |
| C-02 | `projects` 表 | 标记 `is_featured_demo`、`is_featured_work`、`visibility` 字段为废弃，后续迁移删除 |

---

## 八、AdminFeatured 重构目标

将 `/admin/featured` 扩展为**内容管理中心**，包含三个标签页：

| 标签 | 数据源 | 功能 |
|------|--------|------|
| 精选作品 | `achievement_cards.is_featured` | 精选/取消精选、调整排序（现有功能保留） |
| 灵感墙 | `achievement_cards.is_public` | 管理员强制下架任何人的成果卡 |
| Demo 管理 | `demos` 表 | 新增/编辑 Demo、上架/下架（`is_public`）、填写讲解文档 |

---

## 九、实施优先级建议

1. **优先**：F-01 ~ F-04（修复 ProjectDetail 读写路径 + demo_repo 过滤），直接消除线上数据不一致
2. **其次**：N-01 ~ N-04（补 Demo 管理后台），新增能力
3. **最后**：C-01 ~ C-02（清理废弃字段），等新架构稳定后再执行

---

**文档结束**
