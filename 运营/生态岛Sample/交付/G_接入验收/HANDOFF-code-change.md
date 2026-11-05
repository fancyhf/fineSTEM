# 代码改造交付单：公开页过程文档 + 报告去骨架化

- version: v1.0.0
- created_at: 2026-11-05 07:40:08.696
- maintainer: AI Agent
- deployed_at: 2026-11-05 12:39:42.070
- status: 修正版已部署；公开主页常驻文档与 JSON 可读化生产验收通过；报告字数与作者页面待作者账号验收

## 0. 结论

已完成交接单四项代码改造：公开成果卡“文档”页签、作者项目页“过程文档”卡、三份报告真实工件拼装、匿名公开文档端点与 UTF-8 写入校验。未修改 `save_standard_step`，未修改九阶段推进门禁、账号体系、Know 子系统。已按用户明确指令部署到 `fancyhk01`，重启 `finestem-backend`，生产公开接口与公开页面验收通过。

本单关联后端测试 67 项、前端单测 134 项、公开页浏览器 E2E 2 项均通过，前端生产构建通过，匿名 curl 公开 200/私有 404 通过。完整后端套件和全仓前端 Lint 尚有非本单改造项，详见 §4，不能据此宣称全仓质量门禁全绿。

## 1. 改造内容与文件

### 改造 1：灵感墙公开卡片页增加过程文档

- `apps/backend/app/api/documents.py:21-38`
  - 新增匿名 `GET /documents/public/{card_id}`。
  - 仅 `is_public=True` 的成果卡可读取；卡不存在、未公开或关联项目不存在均返回相同 404。
- `apps/backend/app/schemas/documents.py:31-42`
  - 新增 `PublicProjectDocument`，响应仅含阶段、标题、文件名、摘要、正文、长度和有无正文，不含作者或项目对象。
- `apps/backend/app/services/document_service.py:42-73`
  - 从 `standard_step_data` 按统一工件映射读取 8 份阶段文档与讲解文档，摘要取前 100 字。
- `apps/frontend/src/types/index.ts:347-358`、`apps/frontend/src/services/api.ts:601-610`
  - 增加公开文档类型和 `documentsApi.listPublic(cardId)`。
- `apps/frontend/src/pages/AchievementDetail.tsx:15,38-83,287-293,408-420,459-465`
  - 新增第四个“文档”页签、独立加载状态、九份文档列表与全文弹窗。
  - 文档失败或为空只显示“该项目未沉淀过程文档”，不覆盖成果卡、Fork 和保存功能。
- `apps/frontend/src/components/ProcessDocumentList.tsx:1-105`、`apps/frontend/src/components/DocumentViewerModal.tsx:1-65`
  - 共用摘要列表与只读 Markdown 弹窗；公开页不传 `projectId`，不会跳到原作者项目编辑路径。

### 改造 2：作者项目主页直显过程文档卡

- `apps/frontend/src/components/ProjectFilesPanel.tsx:1-6,161-175,349-355,383-389`
  - 工作台原有文档区和弹窗改为复用共享组件，保留紧凑列表、作者接口与加载失败提示。
- `apps/frontend/src/pages/ProjectDetail.tsx:54-57,141-160,289-302,781-797,1086-1092`
  - 使用现有 `projectsApi.listDocuments/getDocument` 加载九份文档。
  - 在“导出与文档”后新增“过程文档”卡，显示标题、100 字摘要、字数和在线查看弹窗。
  - 保留原证据面板、讲解回顾、报告导出和在线报告弹窗。

### 改造 3：报告去骨架化

- `apps/backend/app/services/stage_constants.py:72-95`
  - 集中定义工件显示名称和九份过程文档顺序。
- `apps/backend/app/services/document_service.py:28-39,76-93,117-170`
  - 开题报告纳入 `brainstorm/project_brief` 全文。
  - 技术报告纳入 `constraints/track_plan/design/step_plan/dev_log` 全文。
  - 结题报告纳入 `evaluate` 全文与全部九份过程文档摘要（每份最多 300 字）。
  - 证据不再限制 50 条、不再截断 120 字；保留快照原有的最多 1000 条读取边界。
  - 保留成果档案卡，删除“开题重点/技术重点/结题重点”固定占位段，末尾增加“生成说明”。
  - MD/JSON/PDF/DOCX 继续共用同一份 Markdown，未新增依赖。
- `apps/frontend/tests/specs/project-detail-final-report.spec.ts:61,108-115`
  - 回归断言改为真实工件结构与“生成说明”，并明确断言旧“结题重点”不存在。

真实生态岛报告字数对比尚未完成：本机 `D:/data/finestem/finestem.db` 以 SQLite `mode=ro` 查询，`project_found=False`、`evidence_count=0`，没有项目 `04f835ac-e922-4bde-ad11-8079b74ad3f4` 的真实快照。未使用模拟数据冒充该项验收；部署后仍未调用需要作者权限的报告生成接口。

| 报告 | 改造前基线（交接单） | 部署后真实数据结果 |
|---|---:|---:|
| 开题报告 | 4571 字符 | 待作者账号生成并复测 |
| 技术报告 | 4571 字符 | 待作者账号生成并复测 |
| 结题报告 | 4571 字符 | 待作者账号生成并复测 |

### 改造 4：UTF-8 写入规范

- `apps/backend/app/core/text_encoding.py:1-18`
  - 新增 `ensure_utf8_text`，严格校验文本可编码为 UTF-8，原样返回，不猜测或修复历史编码。
- `apps/backend/app/schemas/evidence.py:15-88`
  - 创建、更新、自动采集和持久化 `Evidence` 模型统一校验标题、正文、链接和关联步骤。
  - 持久化模型继承同一校验，覆盖截图、AI 工具及其他内部证据创建路径。
- `apps/backend/app/services/pbl_engine.py:21,349-400`
  - 统一 `save_artifact` 写入口在访问数据库前校验工件正文，普通工件和讲解追加均覆盖。
- 历史乱码未批量修改。本机无生态岛快照，无法复扫该项目历史数据；已知历史案例仍以交接单记录为准。

## 2. 测试与验证证据

### 新增或调整的测试

- `apps/backend/tests/test_documents.py:1-199`
  - 匿名公开 200、私有/不存在 404、九份文档顺序与最小响应。
  - 三类报告真实工件、51 条证据全文、旧占位段移除、生成说明。
  - 创建/更新/自动采集/内部证据模型和工件写入的非法 Unicode 拒绝。
- `apps/backend/tests/conftest.py:24,67-68,111-128`
  - 文档 API 与报告服务接入隔离测试数据库；释放应用引擎，避免 Windows SQLite 文件锁。
- `apps/frontend/src/components/ProcessDocumentList.test.tsx:1-88`
  - 摘要截断、稳定阶段点击、空态、Markdown 全文和 Escape 关闭。
- `apps/frontend/tests/specs/achievement-public-documents.spec.ts:54-99`
  - 匿名九份文档、全文查看、空态、Fork 与保存按钮保留。

### 实跑结果

| 验证 | 结果 |
|---|---|
| 后端关联回归：`test_documents.py test_achievement_cards.py test_evidence.py test_tools_gates.py` | 67 passed；3 条既有 `httpx` 弃用警告 |
| 前端完整 Vitest | 7 files、134 tests 全部通过；最终运行无新增 React 警告 |
| 匿名公开页 Playwright：`achievement-public-documents.spec.ts --project=chromium` | 2 passed |
| 前端生产构建：`npm run build:web` | TypeScript 与 Vite 构建通过；3077 modules |
| 本次前端文件 ESLint | 0 error、0 warning |
| 本次文件 IDE 静态诊断 | 0 error、0 warning |
| 行尾/空白检查：`git -c core.whitespace=cr-at-eol diff --check -- apps` | 通过；未修改 Git 配置 |
| 本地匿名 curl 公开卡 | HTTP 200；`documents=9`；首份标题“头脑风暴”；讲解正文标记存在 |
| 本地匿名 curl 私有卡 | HTTP 404；“档案卡不存在或未公开” |
| 生产匿名公开接口 | HTTP 200；九份文档均有正文；正文长度依次为 787、981、749、742、1158、1606、1959、150、2627；响应无作者或项目 ID |
| 生产匿名不存在卡 | HTTP 404 |
| 生产公开页真实浏览器验收 | 逐份打开九份文档全文均通过；无原作者项目编辑链接；Fork 与保存按钮可见；页面错误 0 |
| 生产服务健康检查 | `finestem-backend=active`；`GET /health` 返回 `healthy`；公开页标题正常 |

本地 curl 使用 `127.0.0.1:3201` 和 `G:/tempcache/finestem-doc-http/` 隔离数据库，服务已关闭。生产验收仅执行匿名只读请求，未写入项目数据。

### 手动页面验收路径

1. 公开页：匿名打开 `/explore/inspiration/5107fb7b-745b-4087-a3f1-9e4d9976caee`，点“文档”，逐份打开 8 份阶段文档和讲解文档。
2. 作者页：打开生态岛项目主页，在“导出与文档”后查看“过程文档”卡，逐份在线查看；再回归证据面板、讲解回顾、三个在线报告和导出按钮。
3. 报告：作者账号分别生成开题/技术/结题 MD，记录字符数，检查“四步更新规则”等真实工件正文、证据全文和“生成说明”。

## 3. 部署与回滚记录

- 部署时间：2026-11-05 12:39:42.070（UTC）。
- 目标实例：`fancyhk01` / `lhins-e56rf36v` / 中国香港 / `43.128.8.131`。
- 发布方式：按用户明确指令直接上传本地已构建产物和七个后端模块，未提交 Git commit。
- 前端：本地 `apps/frontend/dist/` 上传后切换到 `/opt/finestem/frontend/dist/`。
- 后端：本单 §1 七个模块发布到 `/opt/finestem/app/app/` 对应位置；无新增依赖、无数据库迁移。
- 服务：执行 `systemctl restart finestem-backend`；未重启或修改 Nginx、WebSocket、Redis、PostgreSQL、Know。
- 发布前备份：`/opt/finestem/backups/docs-20261105-204000/`，包含完整旧前端 `dist` 和六个既有后端模块；新增 `text_encoding.py` 无旧文件需备份。
- 前端额外保留切换前目录：`/opt/finestem/frontend/dist.pre-docs-20261105/`。
- 发布结果：后端 active，健康检查为 healthy；生产接口和真实浏览器验收证据见 §2。

回滚方式：将备份目录中的 `backend/app/` 文件复制回 `/opt/finestem/app/`，用备份中的 `frontend/dist` 恢复 `/opt/finestem/frontend/dist/`，删除本次新增的 `app/core/text_encoding.py`，再执行 `systemctl restart finestem-backend`。本单无数据库迁移、无生产数据写入，不需要数据库回滚。

## 4. 未尽事项与风险

1. 真实生态岛三份报告字数尚未使用作者账号复测，生产公开页面已验收通过；三份报告仍需确认均大于 12000 字符。
2. 完整后端套件实跑为 510 passed、36 skipped、12 failed、5 errors、32 warnings，未全绿。多个 WebSocket 用例因未启动依赖服务而连接失败；两项 PBL 全流程测试单独复跑仍停在 `stage_07_execute`，本单未修改推进逻辑，也未将其记为通过。其余失败项未在本单范围展开修复。
3. 全仓前端 ESLint 既有结果为 12 errors、96 warnings；本次涉及文件已单独达到零错误零警告，未扩大范围清理历史问题。
4. Vite 构建仍有既有 Browserslist 数据过期和大 chunk 警告，构建成功但性能告警未处理。
5. UTF-8 严格校验可防止无效 Unicode 新写入，但不能识别或自动修复已成为合法 Unicode 的 GBK 双重编码乱码；历史数据需另行审计，不应自动反向转码。
6. 作者项目页完成了组件单测、类型检查与构建，但未使用真实作者账号做浏览器验收；仍需按 §2 路径复核作者页、讲解回顾、证据和报告导出。

## 5. 声明

- 已按用户明确指令部署并重启 `finestem-backend`，未修改 Nginx 或其他生产服务配置。
- 未直接读取或写入生产数据库，未修改生态岛项目 `04f835ac-e922-4bde-ad11-8079b74ad3f4` 或其他生产项目数据；生产验收仅调用匿名只读接口和打开公开页面。
- 本机既有数据库仅做 SQLite 只读存在性查询；所有写入型测试均使用 `G:/tempcache/` 下的隔离测试数据库。
- 未修改 `save_standard_step`，未修改九阶段推进逻辑、门禁、账号体系、Know 子系统。
- 未提交 Git commit，未覆盖工作区原有的运营文档和媒体文件改动。

## 6. 用户反馈后的修正（最终生产状态）

- 修正时间：2026-11-05 13:11:57.450（UTC）。本节是对初版实现的纠偏；若与前文“第四页签”等初版描述冲突，以本节为准。
- 问题原因：初版把公开文档放在第四页签，未满足主页直接可见；JSON 工件按原文展示，视觉上像乱码；固定九项映射包含空文档，轻量项目回退键也不正确。
- `apps/frontend/src/pages/AchievementDetail.tsx`：过程文档移出页签，在公开项目主页主体常驻显示；移除“文档”页签；无能力标签时收起空白区域。
- `apps/frontend/src/pages/SharedAchievement.tsx`：公开分享页同样常驻显示过程文档和全文弹窗；私有分享仍不调用公开文档接口。
- `apps/frontend/src/pages/ProjectDetail.tsx`：作者项目主页的过程文档卡移到“导出与文档”之前。
- `apps/frontend/src/components/ProcessDocumentList.tsx`：只渲染 `has_content=true` 的真实文档，不再显示“待生成”空占位。
- `apps/frontend/src/components/AchievementCardView.tsx`：成果卡文字字段为空时不渲染空标题和空白段落。
- `apps/backend/app/services/document_service.py`：完整 JSON 工件递归转换为可读 Markdown，保留未知字段与全部列表项；无效或不完整 JSON 保留原文，不做破坏性转换；摘要移除 Markdown 符号。
- `apps/backend/app/services/document_service.py`、`apps/backend/app/api/projects.py`：公开与作者接口共用 `build_process_documents`；标准项目读取九阶段工件，标准工件为空时按轻量项目真实 `topic/goal/steps/result/reflection` 构造三类文档。
- 生产公开数据只读审计：9 张公开卡五个主要文字字段均非空；3 张卡无能力标签，现已移除空标签区。未编造文本填充档案卡，未批量修改历史数据。
- 修正版验证：后端关联 71 passed；前端 135 个单测通过；公开页 Playwright 2 passed；生产构建通过；涉及前端文件 ESLint 零错误零警告。
- 二次部署：上传新前端 `dist`、后端 `projects.py` 与 `document_service.py`，重启 `finestem-backend`；发布前备份位于 `/opt/finestem/backups/docs-readable-20261105-211100/`。
- 最终生产实测：无需点击即可看到文档；生态岛九份文档显示正常，开题立项与分步计划不再显示原始 JSON；另一公开项目只显示七份真实文档；空文档、空能力标签占位为 0；浏览器页面错误为 0。
- 布局调整：按用户要求将 `AchievementDetail` 的过程文档卡移至右边栏、位于“档案信息”上方；新增右边栏定位回归断言。前端已重新构建并部署，备份位于 `/opt/finestem/backups/docs-sidebar-20261105-212000/`；生产右边栏、九份文档和可读性复核通过。
