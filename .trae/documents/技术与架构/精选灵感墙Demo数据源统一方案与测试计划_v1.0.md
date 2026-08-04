# 精选/灵感墙/Demo 数据源统一方案与测试计划

**文档版本**：v1.0  
**创建时间**：2026-08-02  
**维护者**：AI Agent  
**文档状态**：设计中，待评审  
**关联文档**：
- `.trae/documents/技术与架构/精选Demo灵感墙架构问题与重构方案_v1.0.md`
- `.trae/documents/产品与规划/精选和灵感墙功能问题说明_v1.0.md`

---

## 一、修改约束（强制遵守）

1. **不修改现有页面的 UI 与业务流程**：所有页面外观、按钮位置、跳转关系、用户操作流程保持不变
2. **仅修改数据源接线（读写走向哪个表）**：让页面读到正确的数据、写到正确的地方
3. **不启用新端口**：系统统一由 `start_system.bat` 启动，端口固定为 `3200 / 5184`，禁止改动
4. **保留原始业务需求**（精选管理页需支持）：
   - "全部项目"标签页：显示所有用户已发布到灵感墙的作品，每张卡片显示作者用户名，管理员可"取消灵感墙"
   - "我的项目"标签页：仅显示当前登录管理员自己创建的项目（因为 admin 也会做项目）

---

## 二、核心问题回顾

见 `.trae/documents/技术与架构/精选Demo灵感墙架构问题与重构方案_v1.0.md`。摘要：

- **首页读**：`demos` 表（精选Demo）、`achievement_cards`（精选作品/灵感墙）—— 数据源 A
- **ProjectDetail 写**：`projects.is_featured_demo/is_featured_work/visibility` —— 数据源 B
- **AdminFeatured 读写**：`achievement_cards.is_featured` —— 数据源 A（部分）
- **结论**：写入通道（B）与读取通道（A）不通，导致操作不生效、页面数据不一致

---

## 三、解决方案总纲

### 3.1 唯一真相源（Single Source of Truth）

| 领域概念 | 唯一数据源 | 唯一读接口 | 唯一写接口 |
|---------|-----------|-----------|-----------|
| 精选 Demo（首页 + Explore） | `demos` 表 `is_public=true` | `GET /api/v1/demos`（需加 is_public 过滤） | 管理员 Demo 管理接口（新增） |
| 精选作品（首页） | `achievement_cards.is_featured=true` | `GET /api/v1/achievement-cards/featured` | `POST /api/v1/achievement-cards/{id}/feature` |
| 灵感墙（首页 + 管理页） | `achievement_cards.is_public=true` | `GET /api/v1/achievement-cards/inspiration-wall` | 用户：`submit-public / withdraw-public`；管理员：`withdraw-public-admin`（新增） |

### 3.2 三个"入口重定向"（修改点极小）

在**不改动页面UI**的前提下，仅重连按钮的接口调用：

```
[ProjectDetail 页面按钮] "选入精选 Demo"
  当前：POST /projects/{id}/featured  { is_featured_demo: true }
  目标：删除按钮（Demo 是系统资源，用户项目详情不应操作）
        或：保留按钮但改为提示"需管理员在 Demo 管理页操作"
  推荐：直接删除（更干净）

[ProjectDetail 页面按钮] "选入精选作品"
  当前：POST /projects/{id}/featured  { is_featured_work: true }
  目标：POST /achievement-cards/{card_id}/feature  { featured: true, sort_order: 0 }
        前置条件：project 有对应的 achievement_card（无则禁用+提示"先生成成果卡"）
        前置条件：card.is_public=true（Backend 已有校验：仅可精选已发布卡）

[ProjectDetail 页面按钮] "发布到灵感墙"
  当前：PATCH /projects/{id}/visibility  { visibility: "public"/"private" }
  目标：POST /achievement-cards/{card_id}/submit-public
        或 POST /achievement-cards/{card_id}/withdraw-public
        前置条件：project 有对应的 achievement_card（无则禁用+提示"先生成成果卡"）
```

### 3.3 AdminFeatured 页面扩展（保留原UI，新增标签页）

原页面已实现"精选作品管理"，扩展为三个标签页，UI 布局保持一致：

```
标签 1：全部项目
  数据源：GET /achievement-cards/inspiration-wall (含作者信息)
  显示：所有已发布到灵感墙的成果卡（不限作者）
  卡片信息：封面、标题、简介、能力标签、作者用户名
  管理员操作：
    - "取消灵感墙"（下架任何人的卡片）→ 新接口 POST /achievement-cards/{id}/admin-withdraw
    - "设为精选" / "取消精选"（现有 /feature 接口）
    - 编辑精选排序（现有）

标签 2：我的项目
  数据源：GET /projects?author_id=me + 关联的 achievement_cards
  或：GET /achievement-cards/inspiration-wall?author_id=me
  显示：仅当前 admin 用户自己创建的项目对应的成果卡
  管理员操作：同上（作者=自己，权限本就允许）

标签 3：Demo 管理（后期扩展，本次可先占位）
  数据源：GET /admin/demos（新接口，列出所有 demos 含未上架）
  操作：新增/编辑/上下架
```

### 3.4 后端接口调整清单

| # | 接口 | 类型 | 说明 |
|---|------|------|------|
| B-01 | `GET /achievement-cards/inspiration-wall` | 修改 | 响应中每项增加 `author_username` 字段；增加可选查询参数 `author_id=me` 或 `mine=true` |
| B-02 | `POST /achievement-cards/{id}/admin-withdraw` | 新增 | 管理员强制下架（`is_public=false`），需 `require_admin` 权限 |
| B-03 | `GET /demos` | 修改 | 公开接口只返回 `is_public=true`（加过滤条件） |
| B-04 | `GET /admin/demos`（可选） | 新增 | 管理员看全部（含未上架） |
| B-05 | `POST /admin/demos`（可选） | 新增 | 新增 Demo（本次 scope 内可暂缓） |
| B-06 | `PATCH /admin/demos/{id}`（可选） | 新增 | 修改 Demo（本次 scope 内可暂缓） |

### 3.5 数据库字段处理

**不删除任何字段**（避免影响已有数据）。仅标记以下字段为**废弃（deprecated）**：
- `projects.is_featured_demo`
- `projects.is_featured_work`
- `projects.visibility`

处理方式：
- 在 `models.py` 对应字段添加注释：`# DEPRECATED 2026-08-02：改用 achievement_cards.is_featured / is_public`
- 保留 API `PATCH /projects/{id}/featured`、`PATCH /projects/{id}/visibility` 但前端不再调用
- 后续版本（v1.1+）在数据字典登记后统一迁移删除

### 3.6 前端调整清单

| # | 文件 | 修改 |
|---|------|------|
| F-01 | `apps/frontend/src/pages/ProjectDetail.tsx` | 删除"选入精选 Demo"按钮及 `handleToggleFeaturedDemo` |
| F-02 | `apps/frontend/src/pages/ProjectDetail.tsx` | `handleToggleFeaturedWork` 改为调用 `achievementCardsApi.setFeatured(achievement.id, ...)`；无 achievement 时禁用按钮 |
| F-03 | `apps/frontend/src/pages/ProjectDetail.tsx` | `handleToggleVisibility` 改为调用 `achievementCardsApi.submitPublic/withdrawPublic(achievement.id)`；无 achievement 时禁用 |
| F-04 | `apps/frontend/src/services/api.ts` | 补充 `achievementCardsApi.adminWithdraw(id)` 方法；补充可选 `mine` 参数到 `listPublic` |
| F-05 | `apps/frontend/src/pages/AdminFeatured.tsx` | 顶部增加"全部项目 / 我的项目"标签栏；卡片显示作者用户名；增加"取消灵感墙"按钮 |
| F-06 | `apps/frontend/src/types/index.ts` | `AchievementCard` schema 增加可选 `author_username?: string` |

### 3.7 后端调整清单

| # | 文件 | 修改 |
|---|------|------|
| S-01 | `apps/backend/app/repositories/demo_repo.py` | `list_demos` 增加参数 `only_public: bool = True`；查询条件加 `DemoModel.is_public.is_(True)` |
| S-02 | `apps/backend/app/schemas/achievements.py` | `AchievementCard` schema 增加 `author_username: Optional[str]`；`inspiration-wall` 与 `featured` 响应填充该字段 |
| S-03 | `apps/backend/app/api/achievement_cards.py` | `get_inspiration_wall` 增加可选 `author_id: Optional[str]` 与 `mine: Optional[bool]`（`mine=true` 自动取 current_user.id，需登录） |
| S-04 | `apps/backend/app/api/achievement_cards.py` | 新增路由 `POST /{card_id}/admin-withdraw`（`require_admin`），设置 `is_public=false, is_featured=false` |
| S-05 | `apps/backend/app/repositories/*_repo.py` | `list_public_achievement_cards` 支持按 `author_id` 过滤；返回时 JOIN 用户表读取 `username` |

---

## 四、实施步骤（分批次，每批可独立验证）

### 批次 1：修复 ProjectDetail 读写路径（最紧急）
1. F-01：删除精选 Demo 按钮
2. F-02、F-03：改精选作品和灵感墙按钮为操作 `achievement_cards`
3. 前端手工验收：设置成果卡后能"发布/撤回灵感墙"，能"精选作品"

### 批次 2：修复 Demo 展示墙过滤
1. S-01：`list_demos` 增加 `is_public=true` 过滤

### 批次 3：AdminFeatured 分标签 + 显示作者 + 管理员强制下架
1. S-02、S-03、S-04、S-05：后端补齐
2. F-04、F-05、F-06：前端标签页 + 作者用户名 + 强制下架按钮

### 批次 4：（可选）Demo 管理后台
1. B-04 ~ B-06 后端接口
2. AdminFeatured 增加第三个标签页 UI

---

## 五、测试计划

### 5.1 测试环境
- 启动方式：`g:\mediaProjects\fineSTEM\start_system.bat`（不新增端口）
- 后端：`http://localhost:3200`
- 前端：`http://localhost:5184`
- 测试账号：至少准备 1 个 admin 用户 + 2 个 student 用户
- 测试数据：至少 3 个已完成项目（含成果卡），至少 2 个已发布到灵感墙的成果卡

### 5.2 测试分层

| 层级 | 覆盖范围 | 工具 |
|------|---------|------|
| 后端单元 | Repository 查询过滤逻辑 | pytest |
| 后端集成 | REST API 端到端行为 | pytest + FastAPI TestClient |
| 前端集成 | 页面按钮 → API 调用链路 | Playwright（浏览器自动化） |
| 手工验收 | 完整业务闭环 | 人工按脚本操作 |

### 5.3 覆盖矩阵

| 功能 | 数据一致性 | 权限校验 | 前置条件校验 | UI 状态同步 |
|------|-----------|---------|-------------|------------|
| ProjectDetail 精选作品 | ✓ | ✓ | ✓ | ✓ |
| ProjectDetail 发布灵感墙 | ✓ | ✓ | ✓ | ✓ |
| Home 精选 Demo 展示 | ✓ | — | — | — |
| Home 精选作品展示 | ✓ | — | — | — |
| Home 灵感墙展示 | ✓ | — | — | — |
| AdminFeatured 全部项目 | ✓ | ✓ | — | ✓ |
| AdminFeatured 我的项目 | ✓ | ✓ | — | ✓ |
| AdminFeatured 强制下架 | ✓ | ✓ | — | ✓ |
| Demo 展示过滤 | ✓ | — | ✓ | — |

---

## 六、测试用例

### TC-01：ProjectDetail 精选作品按钮 —— 无成果卡时不可点

**前置**：admin 登录，进入一个尚未生成成果卡的项目详情页
**步骤**：
1. 观察右侧边栏"选入精选作品"按钮
**预期**：按钮为禁用状态（灰色 / disabled），鼠标悬停显示提示"请先生成成果档案卡"
**验证**：不发起任何网络请求

---

### TC-02：ProjectDetail 精选作品按钮 —— 成果卡未公开时不可点

**前置**：admin 登录，项目已有成果卡，但 `is_public=false`
**步骤**：
1. 点击"选入精选作品"按钮
**预期**：Toast 报错"仅可精选已发布到灵感墙的档案卡"（Backend 已有该校验）
**验证**：`is_featured` 未变化

---

### TC-03：ProjectDetail 精选作品按钮 —— 成功精选 → 首页可见

**前置**：admin 登录，项目有成果卡且 `is_public=true`，`is_featured=false`
**步骤**：
1. 点击"选入精选作品"按钮
2. Toast 显示成功
3. 打开首页
**预期**：
- API 请求为 `POST /api/v1/achievement-cards/{card_id}/feature { featured: true, sort_order: 0 }`（**不是** `/projects/{id}/featured`）
- 数据库 `achievement_cards.is_featured=true`（**不影响** `projects.is_featured_work`）
- 首页"精选作品"区展示该卡

---

### TC-04：ProjectDetail 精选作品按钮 —— 取消精选 → 首页不再显示

**前置**：TC-03 后
**步骤**：点击"已选入精选作品"按钮取消
**预期**：
- API 请求为 `POST /achievement-cards/{card_id}/feature { featured: false }`
- 首页"精选作品"区不再展示该卡

---

### TC-05：ProjectDetail 发布灵感墙 —— 无成果卡时不可点

**前置**：admin 登录，项目无成果卡
**步骤**：观察"发布到灵感墙"按钮
**预期**：按钮禁用，提示"请先生成成果档案卡"

---

### TC-06：ProjectDetail 发布灵感墙 —— 成功发布 → 首页可见

**前置**：admin 登录，项目有成果卡，`is_public=false`
**步骤**：
1. 点击"发布到灵感墙"按钮
2. 打开首页 / 打开 AdminFeatured 全部项目页
**预期**：
- API 请求为 `POST /achievement-cards/{card_id}/submit-public`（**不是** `/projects/{id}/visibility`）
- 数据库 `achievement_cards.is_public=true`
- 首页"灵感墙"区展示；AdminFeatured 全部项目标签能看到

---

### TC-07：ProjectDetail 发布灵感墙 —— 用户自主撤回

**前置**：TC-06 后，且当前用户是作者
**步骤**：点击"从灵感墙撤回"按钮
**预期**：
- API 请求为 `POST /achievement-cards/{card_id}/withdraw-public`
- 数据库 `is_public=false`
- 首页和 AdminFeatured 不再显示

---

### TC-08：ProjectDetail —— 精选 Demo 按钮已删除

**前置**：admin 登录任意项目
**步骤**：观察右侧边栏
**预期**：没有"选入精选 Demo"按钮（该功能已迁移到 Demo 管理后台）

---

### TC-09：首页精选 Demo 只显示已上架

**前置**：`demos` 表存在 3 条数据，其中 1 条 `is_public=false`
**步骤**：打开首页
**预期**：
- API `GET /api/v1/demos` 只返回 2 条 `is_public=true` 的 Demo
- 首页精选 Demo 区只显示 2 条

---

### TC-10：AdminFeatured 全部项目 —— 显示所有作者的作品

**前置**：admin 登录；数据库有 3 个不同用户的公开成果卡
**步骤**：进入 `/admin/featured`，点击"全部项目"标签
**预期**：
- 展示 3 张卡
- 每张卡显示作者用户名（如 "@alice"、"@bob"、"@admin1"）
- API `GET /api/v1/achievement-cards/inspiration-wall?page=1&page_size=9` 返回结果中每项含 `author_username`

---

### TC-11：AdminFeatured 全部项目 —— 强制下架

**前置**：TC-10 后
**步骤**：
1. 在某张不是自己的卡片上点击"取消灵感墙"
2. 确认对话框
**预期**：
- API 请求为 `POST /achievement-cards/{id}/admin-withdraw`
- 该卡从列表消失
- 数据库 `is_public=false, is_featured=false`
- 首页灵感墙不再展示该卡
- 该卡的作者在自己的 ProjectDetail 上看到"发布到灵感墙"按钮变回"未发布"状态

---

### TC-12：AdminFeatured 我的项目 —— 只显示自己的

**前置**：admin `admin1` 登录；数据库有 admin1 自己的 1 张公开卡 + 其他用户 2 张
**步骤**：切换到"我的项目"标签
**预期**：
- 只显示 1 张（作者=admin1）
- API 请求含 `mine=true` 或 `author_id={admin1.id}` 参数

---

### TC-13：AdminFeatured —— 精选/取消精选（原功能保持）

**前置**：TC-10 状态
**步骤**：在某卡片上点击"设为精选"→ 修改排序权重
**预期**：
- API `POST /achievement-cards/{id}/feature { featured: true, sort_order: N }`
- 首页精选作品区按排序显示该卡

---

### TC-14：权限 —— 非 admin 用户访问 AdminFeatured

**前置**：普通 student 登录
**步骤**：直接访问 `/admin/featured`
**预期**：路由守卫拦截，跳转 403 或首页

---

### TC-15：权限 —— 非 admin 调用 admin-withdraw

**前置**：student 登录，获得 token
**步骤**：直接 curl 调用 `POST /achievement-cards/{id}/admin-withdraw`
**预期**：返回 403 Forbidden

---

### TC-16：数据一致性 —— 完整闭环回归

**前置**：全新数据环境，admin + student1
**步骤**：
1. student1 完成项目 A → 生成成果卡 → 点击"发布到灵感墙"
2. admin 打开首页，看到项目 A 出现在灵感墙区
3. admin 进入 `/admin/featured` 全部项目页，看到项目 A（显示作者 student1）
4. admin 点击"设为精选"
5. admin 打开首页，看到项目 A 出现在精选作品区
6. admin 回到 `/admin/featured` 全部项目页，点击项目 A "取消灵感墙"
7. admin 打开首页
**预期**：
- 步骤 2、3、5 数据一致出现
- 步骤 7 首页灵感墙、精选作品区均不再显示项目 A
- 数据库 `achievement_cards.is_public=false, is_featured=false`
- student1 打开自己的项目 A 详情页，看到按钮回到"发布到灵感墙"状态

---

### TC-17：Demo 展示回归

**前置**：`demos` 表有历史 3 条数据（全部 `is_public=true`）
**步骤**：打开首页与 `/explore/demos`
**预期**：
- 首页精选 Demo 区显示这 3 条
- Explore 页显示这 3 条
- 用户点击"从模板做我的项目"→ 正常 Fork（Demo 完整业务未受影响）

---

### TC-18：向后兼容 —— 老接口不再影响 UI

**步骤**：
1. 手工调用 `PATCH /projects/{id}/featured { is_featured_demo: true }`
2. 打开首页
**预期**：
- 接口本身仍返回 200（保留兼容性）
- 但首页无变化（首页不再读 projects 表的这些字段）
- 说明这些字段实际已"游离"，仅作历史保留

---

## 七、验收标准

以下全部达成才可标记 Goal 完成：

- [ ] TC-01 ~ TC-18 全部通过
- [ ] 首页三个区（精选Demo/精选作品/灵感墙）与 AdminFeatured 显示的数据数量完全一致
- [ ] ProjectDetail 上的操作能在首页与 AdminFeatured 立即体现（无缓存滞后）
- [ ] AdminFeatured 三个标签页正确切换、正确过滤
- [ ] 数据库中 `projects.is_featured_demo/is_featured_work/visibility` 三个字段在新流程下**不再被前端读写**
- [ ] 后端 lint / type check / 现有测试全部通过
- [ ] 前端 lint / type check 全部通过
- [ ] 端口保持 3200/5184，未新增

---

## 八、风险与回滚

| 风险 | 缓解措施 |
|------|---------|
| 修改 `list_demos` 加过滤后，历史 Demo 消失 | 迁移脚本：所有历史 Demo `is_public` 默认设为 `true`；仅新增 Demo 默认 `false` |
| ProjectDetail 用户已依赖旧按钮，突然禁用体验差 | 保留按钮但改为"生成成果卡后可用"提示；禁用状态样式明确 |
| AdminFeatured 老页面被扩展后布局问题 | 新标签栏放在页面顶部，不改动卡片区域样式 |
| `require_admin` 校验失败导致 admin 用户被误拒 | 上线前测试 admin 用户能正常调用所有新接口 |

**回滚方案**：
- 前端：git revert 三个 commit（ProjectDetail、api.ts、AdminFeatured）
- 后端：git revert `demo_repo.py`、`achievement_cards.py`、`schemas/achievements.py`
- 数据库：无破坏性变更，无需回滚

---

## 九、时间戳

- 2026-08-02 方案初稿，含解决方案总纲、实施步骤、测试计划与 18 个测试用例

---

**文档结束**
