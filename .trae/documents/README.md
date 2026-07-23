# fineSTEM 文档中心

version: v2.0.0
created_at: 2025-12-07 00:00:00.000
updated_at: 2026-07-23 00:00:00.000
maintainer: AI Agent
status: active
change_log:
  - 2025-12-07 00:00:00.000 初始创建：目录索引与维护说明。
  - 2026-07-23 00:00:00.000 新增：测试阶段状态同步机制、各子目录 README 导航、关键问题清单入口。

> 本文档目录统一归档项目的所有技术、产品、运营与规范文档。
> 当前项目处于**测试修复阶段**，bug 密集、反复修改，各 Agent 必须通过本目录下的 README 同步进展，避免信息分裂。

---

## 1. 当前阶段速览（测试修复期）

| 维度 | 状态 | 关键文档 |
|------|------|----------|
| AI 对话流 | 🟢 核心链路已修复 | [测试体系总览](testing/测试体系总览_v2.0.0.md)、[对话系统问题清单](../问题清单_长期维护.md) |
| ZeroClaw 集成 | 🟢 配置/Skill/MCP 已对齐 | [ZeroClaw 集成重构](技术与架构/ZeroClaw集成重构_v1.0.0.md)、[架构审计报告](audit/ZeroClaw架构审计报告_v1.0.0_2026-07-22.md) |
| 测试覆盖 | 🟡 单元测试通过，E2E @ai 需回归 | [测试工作指南](testing/测试工作指南_v1.0.0.md)、[SOP_Memory 测试报告](testing/reports/) |
| 创造主链路 | 🟡 工作台恢复完成，历史遗留问题待清 | [findings.md](reports/findings.md)、[progress.md](reports/progress.md) |

> 状态图例：🟢 正常 / 🟡 有风险或待验证 / 🔴 阻塞

---

## 2. 目录索引与状态

### 2.1 规范与标准

| 目录 | 用途 | 维护者 | 状态 | 必读 |
|------|------|--------|------|------|
| [api-specs/](api-specs/) | API 接口规范与契约 | 后端 Agent | 🟢 稳定 | [README](api-specs/README.md) |
| [术语与字典/](术语与字典/) | 统一术语表与数据字典 | 项目规范管家 | 🟢 稳定 | [README](术语与字典/README.md) |

### 2.2 设计与架构

| 目录 | 用途 | 维护者 | 状态 | 必读 |
|------|------|--------|------|------|
| [技术与架构/](技术与架构/) | 架构设计、部署运维、技术选型 | 技术顾问 / DevOps | 🟢 已实施 | [README](技术与架构/README.md) |
| [产品与规划/](产品与规划/) | PRD、产品方案、流程设计、路线图 | 产品经理 | 🟡 随需求迭代 | [README](产品与规划/README.md) |
| [pbl/](pbl/) | PBL 课程设计、教案、评价体系 | 媒体产品专家 | 🟢 稳定 | [README](pbl/README.md) |

### 2.3 开发资源

| 目录 | 用途 | 维护者 | 状态 | 必读 |
|------|------|--------|------|------|
| [starter_kits/](starter_kits/) | 各 Track 启动套件与示例 | 课程设计 Agent | 🟢 稳定 | [README](starter_kits/README.md) |
| [testing/](testing/) | 测试计划、报告、日志、QA 交接 | 测试 Agent | 🟡 高频更新 | [README](testing/README.md) |

### 2.4 管理与审计

| 目录 | 用途 | 维护者 | 状态 | 必读 |
|------|------|--------|------|------|
| [管理与计划/](管理与计划/) | 项目计划、交接文档、Skill 规范 | 项目经理 | 🟡 高频更新 | [README](管理与计划/README.md) |
| [audit/](audit/) | 架构审计、代码审计、合规审计 | 技术顾问 | 🟢 已归档 | [README](audit/README.md) |
| [reports/](reports/) | 进度报告、问题清单、计划、事故报告 | 项目经理 | 🟡 高频更新 | [README](reports/README.md) |

### 2.5 核心规范导航

| 文档 | 说明 |
|------|------|
| [项目结构和文档规范.md](项目结构和文档规范.md) | 详细定义的项目目录结构与文档管理规则 |
| [创建全面的项目管理规范文档.md](创建全面的项目管理规范文档（.trae_rules_project_rules.md）.md) | 项目管理规范草案 |
| [本地开发环境和工具目录.md](本地开发环境和工具目录.md) | 环境配置与工具安装路径规范 |
| [问题清单_长期维护.md](../问题清单_长期维护.md) | 对话系统反复出现的问题清单，回归必检 |

---

## 3. Agent 同步规则（强制）

### 3.1 谁更新哪个 README

| Agent 类型 | 负责目录 / README | 更新时机 |
|------------|-------------------|----------|
| 测试 Agent | `testing/README.md`、本表测试相关状态 | 每轮测试报告产出后 |
| 开发 Agent | `技术与架构/README.md`、`api-specs/README.md` | 架构变更、接口变更、部署变更后 |
| 产品经理 | `产品与规划/README.md`、`pbl/README.md`、`starter_kits/README.md` | 需求变更、方案迭代后 |
| 项目经理 | `管理与计划/README.md`、`reports/README.md`、本速览表 | 每轮迭代、事故、复盘后 |
| 技术顾问 | `audit/README.md` | 审计完成后 |

### 3.2 更新内容要求

每次更新 README 时必须包含：

1. **状态变化**：哪个目录/文档从什么状态变为什么状态。
2. **关键结论**：不超过 3 句话的要点。
3. **关联文档**：新增或修改的具体文件链接。
4. **待跟进项**：下一步需要哪个 Agent 做什么。
5. **时间戳**：使用 MCP 格式 `YYYY-MM-DD HH:MM:SS.fff`。

### 3.3 禁止事项

- 禁止在 README 中只写“已更新”而不说明具体内容。
- 禁止把临时讨论、未验证假设写进 README。
- 禁止删除历史状态记录，应追加在 `change_log` 中。

---

## 4. 当前关键待办（测试修复期）

| 编号 | 事项 | 负责 Agent | 阻塞状态 | 关联文档 |
|------|------|------------|----------|----------|
| T-01 | 完成 WebSocket 端到端验证（ws_sop_test.py / ws_memory_test.py） | 测试 Agent | 🟡 需前端人工确认 | [SOP_Memory 测试报告](testing/reports/SOP_Memory测试报告_2026-07-22_R02.md) |
| T-02 | 清理后端 `tests/` 目录 ~18 个调试脚本 | 开发 Agent | 🔴 待分配 | [测试体系总览](testing/测试体系总览_v2.0.0.md) |
| T-03 | 补全 Playwright 可交互元素 `data-testid` | 开发 Agent | 🟡 逐步进行 | [测试工作指南](testing/测试工作指南_v1.0.0.md) |
| T-04 | 硬编码 `DATABASE_URL` 与 `G:\` 路径清理 | 开发 Agent | 🔴 待分配 | [findings.md](reports/findings.md) |

---

## 5. 维护说明

- 所有新增文档必须归类到上述子目录，并在对应 README 中登记。
- 每个文档必须包含统一元信息头：`version/created_at/maintainer/status/change_log`。
- 目录变更需同步更新本 README 的目录索引表与 `change_log`。
- 状态图例统一：🟢 正常、🟡 有风险或待验证、🔴 阻塞。
