#
fineSTEM 项目管理规范（v1.0.0）

> 统一、可执行、可审计的跨职能项目管理与实施标准，覆盖技术开发、媒体创作、项目结构、协作流程与质量管控。文档为团队唯一规范参考，所有成员必须遵循。

- version: v1.0.0
- created_at: 2025-12-07 00:00:00.000
- maintainer: AI Agent
- change_log:
  - 2025-12-07 00:00:00.000 初始创建：技术与媒体规范、CI/CD、目录结构、协作门控、质量验收、模板示例。

---

## 目录
1. 技术开发规范
2. 媒体创作规范
3. 项目结构管理
4. 跨职能协作流程
5. 质量管控体系
6. 模板与示例
7. 验证与审计清单

---

## 1. 技术开发规范

### 1.1 代码编写标准
- 命名规则：
  - API/JSON 字段使用 `camelCase`；数据库列使用 `snake_case`；常量使用 `UPPER_SNAKE_CASE`；类型与类名使用 `PascalCase`；变量与函数使用 `camelCase`。
  - REST 路由资源使用复数名词与版本：如 `GET /v1/projects`；破坏性变更采用路径版本或请求头 `X-Api-Version: 2`。
- 注释与文档（强制中文）：
  - 类与接口：必须包含类级文档块（Class-level Docstring/JSDoc），说明职责、依赖与核心行为；
  - 公共方法：必须说明参数（含义/约束）、返回值、可能抛出的异常与业务上下文；
  - 关键逻辑：复杂算法、状态流转或 Hack 写法必须添加行内注释说明“为什么这样做”；
  - 源文件头部：必须标注用途、维护者与对应 API 文档路径，例如：`links: .trae/documents/api/v1/api-spec.json#projects`。
- 代码结构：
  - 后端分层：`controller → service → repository → model → infra`；前端分层：`components → hooks → services → pages → styles`；禁止跨层隐式耦合与共享状态。
  - 单一职责：函数建议 ≤30 行；模块聚焦一类职责；避免重复实现（DRY）。
  - 文件组织：一个文件只包含一个类或主要组件；文件名应与导出的主要实体名称一致（PascalCase 或 camelCase 视语言规范而定）。
- 最佳实践（General）：
  - 变量命名：使用富有表现力的名称，避免 `data`, `info`, `temp` 等模糊词汇；布尔值使用 `is`, `has`, `can` 前缀。
  - 魔法值：禁止在代码中直接使用魔法数字或字符串，必须提取为具名常量（UPPER_SNAKE_CASE）。
  - 错误处理：禁止吞没异常（empty catch block）；必须记录错误上下文并向上抛出或优雅降级。
  - 依赖注入：优先使用依赖注入（DI）而非硬编码依赖，以提升可测试性。
  - 格式化：强制使用项目配置的 Prettier/Black/Ruff 规则，提交前自动格式化；禁止手动调整缩进或换行风格。
- TypeScript 严格模式：
  - 启用 `strict/noImplicitAny/strictNullChecks/noUnusedLocals/noUnusedParameters/noImplicitReturns`；异常使用 `unknown` 捕获并分类处理。
- 前端规范：
  - `props` 必须类型化；`useEffect` 明确依赖；列表 `key` 使用稳定标识；样式优先模块化；A11y 基线（图片 `alt`，表单 `label`，语义化，颜色对比度 WCAG 2.1 AA）。
- 错误响应与日志：
  - 统一错误结构：`code/message/details`；HTTP 状态码矩阵：`200/201/204/400/401/403/404/422/429/500`；日志级别 `ERROR/WARN/INFO/DEBUG`（生产禁用 `DEBUG`）。

### 1.2 版本控制流程（Git）
- 分支模型：`main`（稳定发布）、`develop`（集成开发）、`feature/*`（需求/任务）、`hotfix/*`（紧急修复）、`release/*`（发布准备）。
- 提交规范：遵循 Conventional Commits，例如：`feat(ui): add dark mode toggle`、`fix(api): handle 422 validation error`、`chore(deps): bump eslint@9.39.1`。
- 合并策略：优先 `squash & merge` 保持线性历史；禁止直接向 `main` 推送；PR 必须关联任务与影响面描述。
- 变更审计：PR 模板包含背景、影响范围、兼容策略、测试与文档更新；破坏性变更提供版本化、迁移与回滚方案。

### 1.3 测试规范
- 覆盖率目标：业务逻辑 ≥80%，关键路径与 API 端点 100%；测试失败不得合并。
- 测试分层：
  - 单元测试（与源文件同目录，`*.test.ts|*.spec.ts`）
  - 集成测试（`tests/integration/`）
  - 端到端测试（`tests/e2e/`）
  - 契约测试：与 OpenAPI 规范对齐，校验请求/响应结构与类型。
- 数据隔离：使用独立测试数据库与 `beforeEach/afterEach` 清理；禁止修改生产数据；影子数据需登记来源。
- 报告归档：覆盖率与用例报告归档至 `.trae/documents/testing/`，作为发布与验收依据。

### 1.4 部署与运维标准（CI/CD）
- 流水线阶段：`checkout → deps cache → lint → format → typecheck → unit & integration tests → coverage gates → security/SAST & license → OpenAPI contract check → build → package/artifact → deploy (blue-green/canary) → smoke tests → notify`。
- 门禁策略：lint 零警告、类型检查通过、测试全绿并覆盖率达标、依赖与镜像安全扫描通过、OpenAPI 契约校验成功。
- 发布环境：`dev → staging → canary → production`；支持灰度放量与自动回滚；构建产物签名与校验 `checksumSha256`。
- 可观测性：指标（延迟/错误率/吞吐）、日志集中化（分级与上下文）、分布式追踪；关键告警含缓解与回滚建议链接。

### 1.5 环境配置与合规（强制）
- 安装位置：所有第三方工具与依赖必须安装到 `D:` 或 `H:`；禁止安装到 `C:`（系统级白名单除外，如 `C:\\Windows`、`C:\\Windows\\System32`、`C:\\Python312`）。
- 推荐路径：主要工具 `H:\\dev-env\\{tool}`；项目依赖 `H:\\dev-env\\dependencies\\fineSTEM`；临时工具 `D:\\temp\\tools\\{tool}`；缓存 `D:\\cache\\{tool}`；数据库数据 `D:\\data\\{db}`；备份 `D:\\backup\\{db}`；日志 `D:\\logs\\{service}` 或项目 `logs/`。
- 环境变量：工作区 PATH 禁止新增第三方 `C:\\` 路径；示例变量 `NVM_HOME=H:\\dev-env\\nvm`、`PYENV=H:\\dev-env\\pyenv-win`、`JAVA_HOME=H:\\dev-env\\jdk`、`PGDATA=D:\\data\\postgres`、`CACHE_DIR=D:\\cache\\{tool}`。
- 密钥管理：生产密钥使用安全仓库注入；仓库仅提交 `.env.example`，`.env` 不入库。
- 审计与日志：安装与变更记录至 `H:\\projects\\deepDataAIs\\logs\\tooling\\{YYYYMMDD}.log`（MCP 时间）。

---

## 2. 媒体创作规范

### 2.1 创意开发流程
- 研究与洞察：竞品扫描、舆情与用户痛点、平台算法偏好。
- 选题与策略：建立选题池（主题簇/季节性/事件性），信息金字塔（核心信息→支撑点）。
- 概念与脚本：0–5 秒钩子、冲突→解决→证据→CTA、每 8–12 秒信息点。
- 预演与评审：桌面排练、缩略图与标题草案、风险与边界校验（误导/敏感/版权）。
- 制作与发布：拍摄/剪辑→封面/文案→多规格导出→多平台投放与时段优化。
- 复盘与迭代：基于首 24/72 小时数据优化标题/封面/首屏镜头；建立样片库与失败案例库。

### 2.2 视觉设计标准
- 色彩系统：主/辅/警示色；对比度符合 WCAG 2.1 AA；暗/亮模式适配。
- 字体与层级：标题/正文字号与行距；跨端安全区；数字/单位与英文缩写规则一致。
- 缩略图与封面：高对比主体+简短行动语；人物视线与品牌识别；避免过度文字。
- 资产与图标：统一风格；禁用低分辨率与杂乱拼贴；水印与品牌露出规则。
- 可访问性：图片 `alt` 文本、字幕与旁白、色盲包容配色；交互元素可键盘访问。

### 2.3 视频制作流程
- 前期（Pre）：创意简报→脚本→分镜→镜头清单→许可与风险（场地/肖像/音乐）。
- 拍摄（Prod）：光线（主/辅/背）、声音（降噪/领夹/指向）、稳定（云台/三脚架）。
- 后期（Post）：节奏剪辑（首屏钩子）、声音混缩（人声优先）、调色（Rec.709）、字幕与动图层。
- 技术规格：分辨率 1080p/4K；帧率 24/25/30；色彩空间 Rec.709；音频 48kHz、-14～-16 LUFS；码率按平台建议。
- 多端裁切：横版 16:9、竖版 9:16、方版 1:1；关键元素适配安全区。
- 质检与交付：首屏留存曲线、字幕同步、拼写与事实核验；主文件+母版工程+素材清单。

### 2.4 AI 内容生成标准
- 适用场景：脚本初稿、分镜建议、素材扩增、配图/音效、字幕与翻译、风格转化（谨慎用于人物/事实）。
- 提示词结构：背景/受众→目标与约束→风格参考→结构与镜头→输出规格→审核披露；避免多目标冲突与含糊描述。
- 品牌与安全护栏：风格词库与禁用清单；敏感主题规避；标注“AI 辅助/生成”。
- 版权与来源：素材授权与来源记录；避免近似复制与商标侵权。
- 质量与事实核验：多模型交叉验证、人工审校、偏见检测、误导风险审查。
- 可追溯性：记录提示词/版本/模型参数与修订历史。

### 2.5 合规与版权
- 肖像权与许可：出演与路人授权；未成年人保护与监护人同意。
- 音乐与素材：来源曲库、授权类型（商业/社媒）、二次改编许可；素材清单与发票留档。
- 商标与品牌：禁用第三方商标突出展示；对比/评测合规声明。
- 平台政策：不实信息/医疗/金融合规；争议话题高标准审核与免责声明。
- 数据与隐私：避免泄露个人信息；遮挡与匿名；后台数据展示脱敏。
- 标识与披露：赞助/软广显著标识；AI 辅助/生成内容披露与水印。

---

## 3. 项目结构管理

### 3.1 目录架构设计（建议）
```
G:\\mediaProjects\\fineSTEM
├─ src/                      # 源代码（后端/前端分层）
├─ prototype/                # 原型与实验（限定范围）
│  ├─ ui/                    # UI 原型
│  └─ dbdesign/              # 数据设计原型
├─ media/                    # 媒体资源与工程
│  ├─ assets/                # 原始素材（图片/音视频）
│  ├─ projects/              # 母版工程（版本化）
│  └─ exports/               # 导出成品（多端规格）
├─ docs/                     # 项目与技术/创意文档
├─ config/                   # 环境与工具配置（.env.example 等）
├─ scripts/                  # 运维与工具脚本（ops/ci）
├─ tests/                    # 集成与端到端测试
├─ logs/                     # 项目级日志与审计
└─ .trae/                    # 规则、模板、验证与审计
```

### 3.2 环境配置标准
- 多环境：`dev/test/staging/prod` 配置分离；禁止跨环境默认回退；密钥通过安全注入，仓库仅提交样例配置。
- 路径与变量：统一使用 `D:`/`H:`；示例变量 `NVM_HOME/PYENV/JAVA_HOME/PGDATA/CACHE_DIR` 指向有效路径；PATH 不含第三方 `C:\\` 条目（系统白名单除外）。
- 数据与缓存：数据库数据在 `D:\\data\\{db}`；缓存在 `D:\\cache\\{tool}`；日志在 `D:\\logs\\{service}` 或项目 `logs/`；备份在 `D:\\backup\\{db}`。

### 3.3 文档体系规范
- 技术文档：API/OpenAPI、架构设计、数据字典、Release Notes；运行时契约校验与文档生成（Swagger UI 或 ReDoc）。
- 创意文档：Brief、Treatment、Storyboard、拍摄计划、Vendor SLAs、发布与监测；版本化与可追踪。
- 模板目录（建议后续建立）：`.trae/templates/`（创意简报、分镜脚本、拍摄清单、AI 提示词、Git 提交模板、PR 模板、QA 检查清单）。

### 3.4 目录与文档归档规范（强制）
- MUST：所有新增或变更的文件与文档，必须严格按照 `g:\mediaProjects\fineSTEM\.trae\documents\project-structure-and-docs-standard-tech-neutral.md` 中定义的目录结构标准，放置到对应的正确目录。
- FORBIDDEN：顶层 `docs/` 目录；所有项目文档统一归档至 `.trae/documents/`，并按领域分层维护（overview/process/governance/glossary/api-specs/agents/mcp/media/pbl/adr/audit/checklists/reports）。
- MUST：源代码文件头部 `links` 字段统一使用 `.trae/documents/*` 路径指向对应规范或接口占位，例如：`links: .trae/documents/api-specs/v1/spec.json#projects`。
- MUST：PR 模板需列出本次新增/变更文件的目标目录清单与对应规范链接（上述标准文档路径），不合规位置视为门禁不通过。
- MUST：门禁检查对目录/文档归档不合规的变更拒绝合并；整改项与证据登记至 `.trae/documents/audit/` 并在 `.trae/documents/reports/` 生成快照。
- SHOULD：为新增目录放置最小 `README`，使用 `.trae/templates/README.template.md` 并包含统一元信息头（版本/创建时间/维护者/状态/变更记录）。

---

## 4. 跨职能协作流程

### 4.1 门控流程（Gate-0 → Gate-7）
- Gate-0 Intake（立项与需求澄清）：`Brief Clarified`、目标/KPI、范围与边界、初步风险清单。
- Gate-1 Feasibility（研究与可行性）：`Feasibility Report`（评分+风险图谱）、`Go/No-Go` 决议与前提条件。
- Gate-2 Concept & Solution（概念与方案）：`Concept Pack`、`Solution Design`（架构/接口/数据字典）、`WBS+Budget v1`、里程碑计划。
- Gate-3 Preprod & Vendor（筹备与采购）：`拍摄计划`、`Vendor SLAs`、`合规清单`、`风险预案`。
- Gate-4 Build & Shoot（制作与开发）：`Dailies & Cut v1/v2`、`Dev Sprint 产出`、`集成演示`。
- Gate-5 Integration & QA（集成与测试）：`Integration Build`、`QA Report`（功能/性能/安全/A11y）、`修复清单`。
- Gate-6 Sign-off & Launch（评审与交付）：`Master Assets`、`Tech Release Notes`、`渠道投放清单`、`监测仪表盘`。
- Gate-7 Retro & KM（复盘与资产化）：`Postmortem`、`改进项路线图`、`模板更新`、`供应商绩效评估`。

### 4.2 RACI（示例映射）
- Brief 确认 — R: 项目经理（PM）/制片人；A: 客户；C: 创意总监/技术负责人；I: 财务/法务。
- Feasibility Report — R: PM；A: 制片人；C: 技术顾问/创意总监/法务/财务；I: 客户。
- Concept Pack — R: 创意总监；A: 制片人；C: 导演/设计负责人/PM；I: 客户。
- Solution Design — R: 技术负责人；A: PM；C: 后端/前端/数据/AI/安全；I: 创意总监。
- WBS+Budget v1 — R: 制片人；A: 财务；C: PM/技术负责人；I: 客户。
- 采购与 SLAs — R: 采购；A: 制片人；C: 法务/财务/PM；I: 技术负责人。
- 拍摄计划 — R: 第一副导演/制片人；A: 导演；C: 摄影/美术/录音/PM；I: 技术负责人。
- Dev Sprint 计划 — R: 技术负责人；A: PM；C: BE/FE/数据/AI/QA；I: 客户。
- Integration Build — R: BE/FE；A: 技术负责人；C: Data/AI/DevOps/A11y；I: QA/PM。
- QA Report — R: QA 负责人；A: PM；C: 安全/A11y/技术负责人；I: 客户。
- Master Assets — R: 后期主管；A: 制片人；C: 导演/声音/调色；I: 媒介投放。
- Release & 上线 — R: DevOps；A: 技术负责人；C: QA/PM；I: 客户/媒介投放。
- 投放与监测仪表盘 — R: 媒介投放；A: PM；C: 技术负责人/数据/AI；I: 客户。
- Postmortem — R: PM；A: 制片人；C: 技术负责人/创意总监/QA；I: 客户。

### 4.3 多角色协作（子智能体协同）
- `${媒体工程管家}`：建立标准化媒体制作流程与门控；对接拍摄与后期管线，维护模板与资产库。
- `${媒体产品管家}`：梳理媒体产品需求与用户流程，输出可执行的创意规格与指标。
- `${技术顾问}`：提供技术选型与架构建议，评审接口与性能/安全方案。
- `${环境配置专家}`：规划与验证环境合规与变量路径；CI Runner 与工具落地到 `D:`/`H:`。
- `${项目规范管家}`：建立目录结构与命名、文档模板与规则，持续审计与整改。
- `${架构设计专家}`：设计分阶段多平台架构，保障扩展性与可维护性。

---

## 5. 质量管控体系

### 5.1 媒体内容审核标准
- 版权与授权：素材来源、许可类型与凭证链接完备；商标与人物呈现合规。
- 技术规格：分辨率/帧率/码率/音频响度/字幕时码准确；多端版本与安全区检查。
- 文案与一致性：标题/描述/标签与封面一致；避免误导与夸大。
- A11y 检查：字幕、`alt` 文本、色盲安全配色、可键盘访问。
- 放行记录：评审与异常整改记录，上线时间窗与回滚预案。

### 5.2 技术代码审查流程
- 评审清单：命名一致、结构清晰、职责单一、错误处理完备、边界与异常覆盖、性能与安全考虑、测试充足与可读。
- PR 门禁：`lint/typecheck/tests/coverage/security/openapi` 全部通过；破坏性变更需版本化与迁移指引；不达标 PR 拒绝。

### 5.3 项目里程碑验收标准
- 完整性与一致性：交付物齐全、版本清晰、变更与影响可追溯；创意目标 ↔ 技术方案 ↔ 预算/时程无冲突。
- 质量门槛：媒体（画面/音频/版权）与技术（功能/性能/安全/A11y）达标，严重缺陷为零。
- 合规与风险：法律与隐私通过审查；高风险项有预案与资源落地。
- 运营与 ROI：KPI 可量化与监测方案就绪；上线回滚与灰度准备完成。

---

## 6. 模板与示例（可复制）

### 6.1 Git 提交模板（Conventional Commits）
```
type(scope): subject

body: 变更原因、影响范围与细节

BREAKING CHANGE: 破坏性变更描述与迁移指导

footer: 关联任务/工单/文档链接
```

### 6.2 PR 模板
```
## 背景

## 变更与影响

## 兼容策略（版本化/灰度/回滚）

## 测试与文档更新

## 验收与里程碑
```

### 6.3 短视频脚本模板
```
标题与钩子（0–5 秒）
冲突与痛点
解决方案与步骤（3–5 个动作）
证据与演示（对比/数据/见证）
CTA 与结尾（系列化承接）
```

### 6.4 拍摄清单模板
```
场景与镜头：地点/时段/分镜编号/脚本段落
设备与参数：机位/镜头/灯光/收音；分辨率/帧率/曲线
人员与许可：角色与分工；场地/肖像/音乐授权
风险与备用：天气/噪音/电力；替代方案
物料与道具：清单与责任人；入/出库记录
安全与合规：未成年人/敏感区域/隐私遮挡
```

### 6.5 视觉规范卡模板
```
色彩：主/辅/强调色；HEX/RGB；对比度要求
字体：标题/正文/数字；字号与行距；字重与语言
Logo 与安全区：最小尺寸、留白、禁用示例
构图与网格：版心、三分法、焦点与视线
封面与缩略图：主体、文字长度、背景与边框
A11y：字幕、alt 文本、色盲安全配色
```

### 6.6 AI 提示词模板
```
背景与目标：受众/平台/预期情绪与行动
风格与参考：品牌调性/参考作品/摄影风格
结构与镜头：段落/节奏/镜头类型与时长
约束与禁用：合规边界/敏感与侵权禁止项
输出规格：分辨率/比例/色彩空间/文案长度
审核与披露：事实校验与 AI 辅助/生成标注
```

### 6.7 发布审核清单
```
版权与授权：素材来源/许可类型/凭证链接
技术规格：分辨率/帧率/码率/音频 LUFS/字幕
文案与标签：标题/描述/话题/关键词/封面一致性
多端版本：16:9/9:16/1:1 导出与安全区检查
质检与放行：评审记录/异常与整改/上线时间窗
```

### 6.8 CI/CD 阶段清单
```
lint/format/typecheck/tests/coverage/security/openapi → build → artifact → deploy（blue-green/canary）→ smoke → notify
```

### 6.9 模板生成与触发规则（强制）
- 触发场景：当进入 Gate-0/1/2、构建与集成、上线发布或复盘环节，且对应模板或检查清单缺失/过期，需要立即创建或更新模板。
- 指引文档：参考 `g:\mediaProjects\fineSTEM\.trae\documents\template-work-prompt.md` 按“任务输入规范（JSON）”填写需求；我将仅生成模板到 `.trae/templates/`，不改动业务代码与环境配置。
- 门禁绑定：缺少模板或检查清单视为“门禁不通过”，暂停合并/发布，补齐后方可继续；例外需提交原因、影响、替代措施与回滚策略，限定时效并设整改截止日期。
- 合规要求：生成的模板必须体现环境合规（工具与依赖安装到 `D:`/`H:`，PATH 禁第三方 `C:\` 白名单除外）、OpenAPI 契约校验与覆盖率门槛、A11y 检查项，以及 API/JSON `camelCase` ↔ DB `snake_case` 映射记录。

---

## 7. 验证与审计清单
- 流程一致性：数据字典 → API → 后端 → 前端 顺序完整，资料齐全且版本一致。
- 字段一致性：API `camelCase` ↔ DB `snake_case` 映射一致并登记于数据字典；长度与单位后缀合规。
- 覆盖率：后端 UT/IT 关键路径与 API 100% 覆盖；前端集成与端到端通过；冒烟测试通过。
- 兼容性：生产 API 保持向后兼容或采用版本化；提供迁移、灰度与回滚方案。
- 环境合规：安装盘、PATH、变量、数据/缓存/日志位置符合规范；合规扫描无未整改项；不得将新工具安装到 `C:`。
- 文档与审计：工具清单、启动指南、测试与审计报告齐备并链接到代码与脚本；时间戳采用 MCP 格式 `YYYY-MM-DD HH:MM:SS.fff`（UTC）。
- 目录与文档归档：所有新增/变更文件路径与文档位置符合 `g:\mediaProjects\fineSTEM\.trae\documents\project-structure-and-docs-standard-tech-neutral.md` 的目录标准；不合规项已整改或登记审计并设定截止日期。

---

> 注：本规范与 `.trae/rules/project_rules.md` 为强制执行文档。实施中发现冲突或改进项，应建立变更申请（含原因、影响范围、兼容策略、负责人与截止日期），评审通过后更新文档与流程，并保留审计记录。
