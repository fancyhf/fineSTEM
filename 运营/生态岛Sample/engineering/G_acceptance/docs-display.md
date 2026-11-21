# G-docs：主页过程文档研究、填充与验证记录（docs-display.md）

日期：2026-11-05｜执行：G 包 Agent（账号：生态岛Sample作者 eco-island@finestem.dev）｜对象：线上项目 04f835ac-e922-4bde-ad11-8079b74ad3f4（生态岛：小岛为什么变了？）｜平台代码：只读，未改 apps/ 一行。

## 0. 任务结论（TL;DR）

- 平台**不是**"只能生成下载"：主页已有三处文档显示面——「导出与文档」卡的在线查看（开题/技术/结题报告页面内阅读弹窗）、「讲解回顾」卡（explanation 工件全文）、证据采集面板（全过程记录流）。
- 真正的缺口：**8 份阶段过程文档（头脑风暴/开题/范围/技术轨道/设计/计划/开发日志/验收）在主页没有列表区块**（只有进工作台左侧 ProjectFilesPanel 才能看到），且**三份生成报告内容骨架化**（只拼 description + 证据前 120 字 + 成果卡三行，不读阶段文档内容）。
- 已做：用平台现有写入通道把 8 份过程文档真实填充进项目（内容全部取自 A/B/C 包与 dev-log 真实记录）、讲解文档追加"给家长和孩子的讲解"章节、证据补 3 条（知识来源/任务计划/AI 分工）+ 修复 1 条乱码标题；项目阶段由 stage_01 推进到 stage_08（与项目真实已完成状态一致）。主页验证通过，截图存证 G-E003~G-E006b。
- 改进需求 3 项已记入 HANDOFF.md 新增 §7。

## 1. 研究发现：文档系统怎么工作

### 1.1 主页文档区显示什么数据（frontend ProjectDetail.tsx）

| 主页区块 | 数据来源 | 代码位置 |
|---|---|---|
| 「导出与文档」卡：结题PDF/结题DOCX/开题DOCX/技术DOCX 4 个下载按钮 | `GET /api/v1/documents/projects/{id}/generate?document_type=X&format={pdf,docx}`，服务端实时生成 | ProjectDetail.tsx L661-746（卡）、L236-247（下载）、L266-273（PDF 预览） |
| 同卡「在线查看文档」：开题报告/技术报告/结题报告 3 个按钮，页面内弹窗阅读 Markdown | 同上端点 `format=md`，`documentsApi.view` 用 requestText 取文本 → renderMarkdown 弹窗渲染；可"新窗口预览 PDF" | ProjectDetail.tsx L50-57、L250-262、L1065-1097 |
| 「讲解回顾」卡：显示讲解文档摘要 + 查看讲解弹窗（全文） | `projectsApi.getDocument(id, 'explanation')` → `GET /api/v1/projects/{id}/documents/explanation`，`has_content && content` 才显示 | ProjectDetail.tsx L42-44、L127-135、L781-800、L1036-1063 |
| 证据采集面板（EvidencePanel）：类型筛选 + 全文显示 + 上传/添加 | `GET /api/v1/evidence/projects/{id}`，POST 同路径创建，`PATCH /evidence/{id}` 更新 | components/EvidencePanel.tsx（content 用 whitespace-pre-wrap 全文渲染，不截断） |
| 项目描述卡 | project.description | ProjectDetail.tsx L607-612 |

注意：**主页没有"阶段文档列表"区块**。9 份阶段文档的列表/阅读只存在于工作台左侧 ProjectFilesPanel（用 `projectsApi.listDocuments` = `GET /projects/{id}/documents`，api.ts L374-377 已封装，但 ProjectDetail 未接线——这就是"api.ts 有 listDocuments 痕迹"的出处）。

### 1.2 文档从哪里创建（有没有 POST /projects/{id}/documents？）

**没有面向页面的 `POST /projects/{id}/documents`。** 阶段文档（工件）的真实存储与写入路径：

- 存储：`skill_state.standard_step_data.<blob_key>`（blob 键：brainstorm_content / brief_content / constraints_content / track_plan_content / design_content / step_plan_content / dev_log_content / evaluate_content / explanation_content，见 services/stage_constants.py ARTIFACT_TO_BLOB_KEY）。
- 读取端点（只读）：`GET /projects/{id}/documents`（列表：has_content + 前 200 字摘要，projects.py L1354）与 `GET /projects/{id}/documents/{stage}`（全文，L1400）。
- 写入通道只有两条：
  1. **工作台 AI 工具** `artifact_writer`（services/tools.py L675+）→ pbl_engine.save_artifact：写 blob + 落盘 `{STORAGE}/projects/{slug}/docs/<文件名>`，带阶段门禁 artifact_stage_gate；
  2. **确定性端点** `POST /projects/{id}/pbl/complete-stage`（projects.py L2197-2260）：请求体 `{stage, artifacts: {工件名: 内容, ...}}`，特殊键 teachingMode / teachingModeConfirmed 写入 metadata；逐工件 save_artifact 后 `advance_with_gate` 尝试推进一阶段（注释明说"用于自动化测试"）。
- 讲解文档另有追加端点 `POST /projects/{id}/explanation`（L1308-1334，explanation_doc.append_explanation_section：按时间戳章节累加，同内容去重）。
- 门禁硬规则（pbl_engine.py check_gate/_hard_gate_check）：每阶段工件非空才能推进；stage_04 的 track_plan 必须是含 `track`+`tech_stack` 的 JSON；stage_07 要求 metadata.teachingMode 已确认；stage_02/03/05/06/08 有软结构检查（title/success_criteria/risks、must_have/wont_do、acceptance_criteria、steps、acceptance_results/reflections）。

### 1.3 "在线查看"按钮读什么（报告骨架化根因）

`documentsApi.view` → `GET /documents/projects/{id}/generate?document_type=X&format=md` → document_service.generate（services/document_service.py）：

- `_snapshot`（L28-41）：project + skill_state + 证据(≤1000 条) + 成果卡，一次性取全。
- `_build_markdown`（L43-122）：只拼 ①项目概况（ID/模式/阶段/时间）②description ③进度摘要（阶段+历史节点数）④证据清单（**每条截前 120 字，最多 50 条**）⑤成果卡（标题/一句话/反思三行）⑥按文档类型加一段**固定占位文案**（"## 开题重点：- 研究问题与目标…"）。
- **skill_state 里 9 份工件的正文完全不进报告**——这就是"生成的报告内容骨架化"的根因。快照数据倒是全量进了 `format=json` 导出和 ZIP（ZIP 另含 `docs/stage_artifacts/*.md`，projects.py L2349-2358 遍历 `*_content` blob）。
- 推论（本次执行验证）：**丰富 description / 证据 / 成果卡会直接改善三份报告与主页可读性；填充阶段工件会点亮 documents 列表/工作台面板/ZIP 的 stage_artifacts，但不改变报告正文**（报告正文改善只能靠改 document_service，见 §5 改进需求 2）。

## 2. 线上操作清单（作者账号身份；只动 04f835ac）

| # | 操作 | 端点 | 结果 |
|---|---|---|---|
| 1 | 顺序写入 8 份阶段工件（brainstorm→project_brief→constraints→track_plan→design→step_plan→dev_log+teachingMode=guided→evaluate） | POST /projects/{id}/pbl/complete-stage ×8 | 全部 200「推进成功」；current_stage: stage_01_brainstorm → stage_08_evaluate（逐阶段门禁推进，stage_history 追加 7 节点，时间戳为本次操作时间——如实声明） |
| 2 | 追加讲解章节「stepModel 四步更新规则（给家长和孩子的讲解）」 | POST /projects/{id}/explanation | 200「讲解已保存」，explanation_content 1899→2627 字符（共 3 段） |
| 3 | 新增证据 ×3：知识来源与三类口径 / 任务计划：三个任务与产出 / AI 帮助与分工 | POST /evidence/projects/{id} | 200；ID 8b006060 / 4dad6581 / 188cb720；证据 10→13 条 |
| 4 | 修复既有截图证据乱码标题 `ÏîÄ¿ËµÃ÷¿¨`（GBK 字节误读为 Latin-1 的双重编码）→「项目说明卡」 | PATCH /evidence/1a60d06b-… | 200 更新成功（该乱码为 2026-11-04 既有数据问题，非本次产生） |
| 5 | 结题/开题/技术三份报告 md 版本生成留存 | GET /documents/projects/{id}/generate?format=md | 200；存 交付/G_接入验收/staging/docs-project/{proposal,technical,final}.md |

覆盖对照（任务书全过程 → 落点）：开题=brainstorm+brief 工件+证据「开题记录」；知识来源=证据「知识来源与三类口径」+讲解末段；任务计划=step_plan 工件+证据「任务计划」；设计算法=design+track_plan 工件+证据「算法设计」；开发调试=dev_log 工件；配置测试=证据「测试记录/多结局对照」；变更=证据「变更记录」+brief 风险栏；总结=evaluate 工件+证据「经验与反思」；AI 帮助=证据「AI 帮助与分工」+evaluate 分工节。

## 3. 写入的文档清单（ID / 访问路径）

阶段工件（无独立 ID，按 stage 键存取；API 均需作者登录）：

| stage 键 | 显示名 | 内容 | 大小 | GET 路径（/api/v1 前缀） |
|---|---|---|---|---|
| stage_01_brainstorm | 头脑风暴 | 选题记录：想知道的问题/玩法/确定性原则/成功标准 | 787 字符 | /projects/{id}/documents/stage_01_brainstorm |
| stage_02_opening | 开题立项 | JSON：title/one_liner/研究问题/success_criteria×4/risks×4（风险全部来自 dev-log 真实事件） | 981 | /projects/{id}/documents/stage_02_opening |
| stage_03_scope | 范围裁剪 | JSON：must_have×7 / wont_do×4 / 裁剪理由与教学设定声明 | 749 | /projects/{id}/documents/stage_03_scope |
| stage_04_track | 技术轨道 | JSON：track=web / tech_stack×4 / 选型理由 / 三版界面演变 / 模型规范指针 | 742 | /projects/{id}/documents/stage_04_track |
| stage_05_design | 设计蓝图 | JSON：acceptance_criteria×6 / 状态与配置设计 / 四步更新规则 / 模块拆分 | 1158 | /projects/{id}/documents/stage_05_design |
| stage_06_plan | 分步计划 | JSON：6 步（每步 run/check/rollback）+ 三关 checkpoints 对应 | 1606 | /projects/{id}/documents/stage_06_plan |
| stage_07_execute | 开发日志 | 时间线全过程含 6 个真实问题与解决（AI 静默/假成功/贴码截断/4 UI 缺陷/聊天管道洗码/v3 pondLabel bug） | 1959 | /projects/{id}/documents/stage_07_execute |
| stage_08_review | 验收评估 | 对照开题标准的验收表 / 多结局对照实验 / 最短板发现 / 学到什么 / AI-作者分工 / 迭代建议 | 1669 | /projects/{id}/documents/stage_08_review |
| explanation | 讲解文档 | 原有 2 段工作台讲解 + 新增「stepModel 四步更新规则（给家长和孩子的讲解）」 | 2627 | /projects/{id}/documents/explanation |

新增证据（ID 前 8 位）：8b006060 知识来源与三类口径｜4dad6581 任务计划：三个任务与产出｜188cb720 AI 帮助与分工（诚实记录）。
主页可见位置：阶段工件=工作台「阶段文档」面板 + ZIP `docs/stage_artifacts/`；讲解=主页「讲解回顾」卡；证据=主页「证据采集」面板全文。

内容来源（不虚构声明）：B_作品代码/dev-log.md（对话式重做全过程、真实失败、v3 方向修正）、范本_fineSTEM制作/dev-log.md（同源原始记录）、A_科学模型/{model-spec,test-cases.json,science-notes}.md（模型规范、10 组锚点、S1–S9 来源与三类口径）、C_学习引导/{task-cards,change-challenges}.md、B_作品代码/{test-report,checkpoints}、既有线上证据与成果卡。所有数字锚点（46/20/47、20.8/4/100、第 9 步归零等）与 A/G 包验证记录一致。

## 4. 主页显示验证（2026-11-05，浏览器实测 wostemstudio.top）

环境：ZCode 内置浏览器，作者账号登录态。截图证据（本 evidence/ 目录）：

| 证据 | 内容 | 判定 |
|---|---|---|
| G-E004a-主页顶部-阶段条.png | 项目标题/描述卡 + 9 阶段进度条：第 1–8 阶段全部绿勾，当前第 9 阶段评估展示 | ✅ |
| G-E005-导出与文档区.png | 「导出与文档」卡：4 下载按钮 + 「在线查看文档」3 按钮；旁边成长时间线显示 8 个阶段节点（2026/11/5 09:27 起） | ✅ |
| G-E003-结题报告在线查看.png | 点「结题报告」→ 页面内弹窗渲染完整报告：项目概况（stage_08_evaluate）/项目描述/进度摘要（8 历史节点）/证据清单（13 条实质内容）/成果档案卡/结题重点 | ✅ 在线查看可用且内容已丰满 |
| G-E006 / G-E006b-讲解回顾弹窗.png | 「讲解回顾：已沉淀 3 段讲解」→ 弹窗全文含新增段「stepModel 四步更新规则（给家长和孩子的讲解）· 2026-11-05」 | ✅ |
| （DOM 快照） | 证据面板 13 条全部全文可见：AI 分工/任务计划/知识来源 3 条新增置顶（2026/11/5 01:29），原 10 条含改名后的「项目说明卡」截图条目 | ✅ |

API 侧核对：`GET /projects/{id}/documents` 返回 9/9 has_content=true（各 742–2627 字符）；三份报告 md 生成 200 且证据清单行数 10→13；`GET /evidence/projects/{id}` total=13。

## 5. 平台功能缺口 → 改进需求（已同步 HANDOFF §7）

1. **主页应直接展示过程文档**：ProjectDetail 增加「过程文档」卡，复用现成接口 `projectsApi.listDocuments` + `getDocument`（api.ts 已封装、后端已就绪），列表 9 份文档（has_content/摘要）+ 点击弹窗阅读——把工作台 ProjectFilesPanel 的文档区组件化搬进主页即可，无需新后端。
2. **报告去骨架化**：document_service._build_markdown 应纳入 standard_step_data 的 `*_content` 工件（如"## 开发日志（节选）""## 设计与算法"），替换三段固定占位文案；数据已在 _snapshot 里，属纯模板改动。
3. **缺正式的文档写入端点**：目前只有 AI 工具链与测试用 complete-stage 两条路；如需支持"作者/家长在页面上补写过程文档"，应增加带门禁的 `PUT /projects/{id}/documents/{stage}`（内部复用 save_artifact），并把 complete-stage 标注为测试专用。

另记数据小缺陷：证据截图条目标题曾为 GBK→Latin-1 双重编码乱码（本次已修复该条）；建议 evidence 上传链路排查编码处理。

## 6. 如实声明

- stage_history 中 2026-11-05 09:27 的 7 个阶段节点时间戳为本次补录操作产生，不代表各阶段内容实际发生时间（内容真实时间以文档内文与 dev-log 2026-11-02 记录为准）；这是平台"补录"路径的固有行为。
- evaluate_content 原为 216 字符系统骨架（"项目已完成全部阶段，建议回顾…"），本次以实质验收内容覆盖写入——覆盖属预期行为（save_artifact 语义即整文写入），原骨架无独有信息。
- 报告 md 留存于 staging/docs-project/ 生成于 2026-11-05（含当时证据内容）；线上"在线查看"为实时生成，之后证据再变会反映到在线版。
- 本次全部操作仅涉及项目 04f835ac 的数据（skill_state/evidence/explanation/进度），未触碰其他项目、未改 apps/ 代码、未动生产 content/know。
