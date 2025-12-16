# 变更确认
- 文档统一归档至 `.trae/documents/`，移除顶层 `docs/`；后续所有规范、流程、数据字典、审计与发布相关文档均在 `.trae/documents/` 维护。
- 保持技术方案中立：不绑定语言、框架或数据库；以 MCP 与 Agent 协作为主导的开发/运营流程。

## 顶层目录结构（更新后）
```text
fineSTEM/
├─ src/                          # 技术主线源代码（技术中立分层）
│  ├─ domain/                    # 领域模型与术语（与数据字典一致）
│  ├─ usecases/                  # 业务用例编排（场景驱动）
│  ├─ services/                  # 核心服务（无框架依赖）
│  ├─ adapters/                  # 适配层（web/cli/scheduler 等抽象）
│  ├─ interfaces/                # 外部接口契约与数据结构（规范占位）
│  └─ agents/                    # Agent 能力定义、协议与工具封装
│     ├─ mcp/                    # MCP 连接、资源清单、权限与工作流
│     └─ orchestrations/         # Agent 协同编排与任务路由
├─ apps/                         # 独立应用（技术中立）
│  ├─ public-web/                # 对外公众网站（学习者/访客）
│  │  ├─ src/
│  │  │  ├─ ui/                  # 视图与布局（技术中立）
│  │  │  ├─ features/            # 业务功能（PBL查看器/媒体播放器）
│  │  │  │  ├─ mvp/              # 早期 MVP 功能（迭代保留）
│  │  │  │  │  └─ phase1/        # 第一阶段 MVP 代码（Track A / React+FastAPI）
│  │  │  │  └─ pbl-viewer/       # 标准 PBL 查看器
│  │  │  ├─ flows/               # 用户场景编排（浏览/参与）
│  │  │  ├─ adapters/            # 外部接口适配（路由/API）
│  │  │  ├─ agents/              # 前端 Agent 接入点
│  │  │  ├─ mcp/                 # 资源映射与权限
│  │  │  ├─ assets/              # 静态资源
│  │  │  ├─ configs/             # 应用配置
│  │  │  ├─ tests/               # 集成/E2E 测试
│  │  │  ├─ docs/                # 局部文档索引（指向 .trae/documents）
│  │  │  ├─ checklists/          # 页面/流程放行清单
│  │  │  └─ logs/                # 运行日志占位
│  └─ ops-portal/                # 运营管理门户（内部/创作者）
│     ├─ src/
│     │  ├─ ui/                  # 运营界面与布局
│     │  ├─ features/            # 管理功能（PBL管理/媒体管线）
│     │  ├─ dashboards/          # 监测与指标视图
│     │  ├─ workbenches/         # 操作工作台（素材/审核）
│     │  ├─ catalogs/            # 资源目录索引
│     │  ├─ adapters/            # 系统适配层
│     │  ├─ agents/              # 运营 Agent 脚本
│     │  ├─ mcp/                 # 权限矩阵与工作流
│     │  ├─ configs/             # 门户配置
│     │  ├─ tests/               # 功能测试
│     │  ├─ docs/                # 局部文档索引
│     │  ├─ checklists/          # 发布/审核清单
│     │  └─ logs/                # 操作审计日志

├─ prototype/                    # 原型与实验（限定范围，不入主线）
│  ├─ ui/                        # UI/交互原型与快速验证
│  ├─ dbdesign/                  # 数据与术语原型（模型草案）
│  ├─ mcp/                       # MCP 集成原型（资源、权限、流程）
│  ├─ agents/                    # Agent 能力与协作原型
│  └─ experiments/               # 其他实验（标注范围与结论）
├─ pbl/                          # 预置 PBL 项目（课程化与工程化）
│  ├─ catalog/                   # PBL 项目索引与元数据
│  ├─ templates/                 # 课程/评价/交付物模板
│  └─ projects/                  # PBL 项目实例骨架
│     └─ {pblId}/
│        ├─ curriculum/          # 教学材料与任务分解
│        ├─ assets/              # 项目素材（与媒体库关联）
│        ├─ kits/                # 教具/工具包说明（技术中立）
│        ├─ assessments/         # 评价量表与里程碑
│        ├─ deliverables/        # 输出物（作品、报告）
│        ├─ workflows/           # 项目流程与角色分工
│        ├─ agents/              # PBL 专属 Agent 工作流与脚本
│        ├─ logs/                # 项目过程日志与审计
│        └─ docs/                # 项目局部文档占位（索引到 .trae/documents/pbl）
├─ media/                        # 媒体资源与工程
│  ├─ assets/                    # 原始素材（图片/音视频/字幕等）
│  ├─ projects/                  # 母版工程（版本化与可复用）
│  ├─ exports/                   # 导出成品（多端规格与渠道）
│  ├─ templates/                 # 媒体工程模板（结构与命名）
│  ├─ metadata/                  # 素材/成品元数据、标签与检索
│  ├─ rights/                    # 授权、版权与使用范围
│  ├─ pipeline/                  # 媒体加工流水线描述（中立）
│  └─ quality/                   # 质检标准与报告
├─ config/                       # 环境与工具配置（技术中立）
│  ├─ env/                       # 环境变量样例与说明（不含敏感）
│  ├─ policies/                  # 合规策略（盘位/权限/数据位置）
│  ├─ tooling/                   # 工具清单与安装登记（路径/版本/来源）
│  ├─ agents/                    # Agent 配置（权限、资源、速率限制）
│  └─ mcp/                       # MCP 工作区与资源映射
├─ scripts/                      # 运维与工具脚本（ops/ci 等技术中立）
│  ├─ ops/                       # 启停、备份、巡检、清理
│  ├─ ci/                        # 持续集成流程脚本（中立）
│  ├─ media/                     # 媒体流水线辅助脚本
│  ├─ pbl/                       # PBL 打包与交付辅助脚本
│  ├─ mcp/                       # MCP 初始化与校验脚本
│  └─ audit/                     # 合规扫描与报告生成
├─ tests/                        # 集成与端到端测试（技术中立）
│  ├─ integration/               # 子系统集成用例
│  ├─ e2e/                       # 端到端场景用例
│  ├─ agents/                    # Agent 协作与工作流验证
│  ├─ media/                     # 媒体管线可用性与质量验证
│  ├─ pbl/                       # 教学与交付物验收用例
│  └─ contracts/                 # 接口/文档契约一致性校验（中立）
├─ logs/                         # 项目级日志与审计
│  ├─ project/                   # 运行日志（按模块/日期归档）
│  ├─ audit/                     # 审计与合规事件日志
│  ├─ media/                     # 媒体处理/发布日志
│  └─ agents/                    # Agent 执行与协作日志
└─ .trae/
   ├─ rules/                     # 项目规则与约束（技术中立）
   ├─ templates/                 # 文档/目录/命名/清单模板
   ├─ validators/                # 校验脚本/规则说明（技术中立）
   ├─ documents/                 # 项目/运营/审计文档统一归档
   │  ├─ overview/               # 项目概览、愿景与范围
   │  ├─ process/                # 研发/运营流程、门禁与角色职责
   │  ├─ governance/             # 治理规则、变更管理与合规
   │  ├─ glossary/               # 术语表与数据字典（唯一来源）
   │  ├─ api-specs/              # 接口规范占位（技术中立）
   │  ├─ agents/                 # Agent 能力、协议与协作方式说明
   │  ├─ mcp/                    # MCP 资源、权限模型与集成指南
   │  ├─ media/                  # 媒体运营策略与内容标准
   │  ├─ pbl/                    # PBL 教学法与项目设计文档
   │  ├─ adr/                    # 架构/流程决策记录（技术中立）
   │  ├─ audit/                  # 审计报告、验证清单与证据
   │  ├─ checklists/             # 发布/合规/验收检查清单
   │  └─ reports/                # 周期性报告与快照
   └─ reports/                   # 审计/合规输出归档（可与 documents/reports 对齐）
```

## 文档管理规范（统一在 `.trae/documents/`）
- 分类与位置：所有项目文档按领域分层存放于 `.trae/documents/`；各子目录含 `README`（目的、范围、维护者、变更记录）。
- 命名与版本：文件名采用清晰中文或英文；可选后缀标注版本与日期，如 `content-strategy.v1.md`。
- 元信息头：统一 `version/created_at/maintainer/change_log/status`，状态流转为 `draft → review → approved → archived`。
- 变更管理：任何规范/流程变更需登记到 `adr/` 并更新对应检查清单与影响分析；审计证据归档到 `audit/` 与 `reports/`。
- 接口与数据：`glossary/` 为唯一数据字典来源；`api-specs/` 为接口规范占位（技术中立），与 `src/interfaces/` 保持一致。
- 代码引用：源文件头可标注对应文档路径与版本，例如：`links: .trae/documents/api-specs/v1/spec.json#projects`。

## MCP/Agent 主导开发（技术中立）
- 以 MCP/Agent 为核心的任务编排与资源访问；所有工作流、权限与资源清单记录于 `.trae/documents/mcp` 与 `.trae/documents/agents`。
- `src/agents/orchestrations` 保存协作编排定义；`tests/agents` 验证协作流程与门禁。

## 智能体协作机制
- 媒体工程管家：技术架构审核与工程规范实施；维护 `.trae/rules`、`validators`、发布检查清单与 `.trae/documents/process`。
- 媒体产品专家：内容运营体系搭建与用户体验优化；维护 `media/templates`、`media/pipeline`、`media/quality` 与 `.trae/documents/media`。
- 项目规范管家：文档标准化与跨团队协作流程；维护 `.trae/templates`、`.trae/documents/governance` 与 `.trae/documents/overview`。
- 门禁流程：需求登记 → ADR 草拟 → 规则/模板更新 → 目录/文档生成 → Agent 执行与校验 → 审计归档（联合评审记录至 `.trae/documents/audit`）。

## 媒体内容运营与 PBL 规范（技术中立）
- 媒体：素材入库（`media/assets/metadata`）、授权（`rights/`）、母版工程模板与成品质检标准；策略文档归档至 `.trae/documents/media/`。
- PBL：`pbl/catalog/` 索引、`pbl/templates/` 模板、`pbl/projects/{pblId}` 骨架与过程日志；方法与评价体系文档归档至 `.trae/documents/pbl/`。

## 合规与验证
- 目录结构校验说明置于 `.trae/validators/`；执行记录与结论归档至 `.trae/documents/audit/` 与 `.trae/documents/reports/`。
- 环境与工具合规策略（盘位/权限/数据位置）放置于 `config/policies/` 并在 `.trae/documents/governance` 记录制度化说明。

## 推进计划（获批后执行）
1. 在 `.trae/documents/` 初始化子目录：`overview/process/governance/glossary/api-specs/agents/mcp/media/pbl/adr/audit/checklists/reports`，生成最小 `README` 与统一元信息头模板。
2. 在 `.trae/templates/` 增加标准模板：`README`、`文档元信息头部`、`审计检查清单`、`目录结构校验规则说明`。
3. 在 `pbl/` 建立 `catalog/templates` 与 1–2 个 `projects/{pblId}` 示例骨架（不含具体实现），并在 `.trae/documents/pbl/` 创建方法与评分量表样例。
4. 在 `media/` 建立 `templates/quality/metadata/rights/pipeline` 基线与说明，文档归档至 `.trae/documents/media/`。
5. 在 `src/agents/orchestrations` 与 `.trae/documents/agents/mcp` 放置协作流程/权限/资源清单占位；`tests/agents` 添加工作流验证占位用例。
6. 在 `scripts/audit` 与 `.trae/validators` 提供手动合规检查说明与执行步骤（技术中立），首次运行后生成审计草案至 `.trae/documents/audit/` 与 `.trae/documents/reports/`。
7. 全局替换与校验：移除对顶层 `docs/` 的引用，统一改为 `.trae/documents/`；在源文件/模板示例中更新 `links` 指向。

## 交付验收
- `.trae/documents/` 结构与 README 完整生成、元信息规范化。
- 模板与校验说明就绪，门禁流程可执行，审计草案归档。
- PBL 与媒体模板与样例骨架通过结构校验，Agent 协作占位与测试骨架就绪。

—— 请确认本合并版规范与推进计划；获批后我将创建目录与模板、更新引用并完成首轮合规验证。