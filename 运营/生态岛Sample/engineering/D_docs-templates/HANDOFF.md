# HANDOFF：D 包（文档与汇报）

日期：2026-11-03
版本口径（按 01 公共约定 §5）：modelVersion = eco-island-v1（A 包 2026-11-03 冻结）；codeVersion = B 包交付版（reference v1.1 及 checkpoints/variants，2026-11-03）；contentVersion = D 包模板骨架 v0.1；校验日期 = 2026-11-03；适用运行入口 = 平台项目 04f835ac-e922-4bde-ad11-8079b74ad3f4（线上，私有）＋交付/B_作品代码/ 本地 HTML。

## 1. 当前状态

**待复核（本阶段只做了模板与骨架）。**
author-example/ 目录下的作者示范档案与示范报告是**第二阶段**工作，本阶段未开始：它依赖 A/B/C 冻结后的真实记录收敛，原料已锁定并登记（见 §5 第 1 条）。author-example/README.md 目前只是占位说明。

## 2. 已完成文件及用途

| 文件 | 用途 |
|---|---|
| templates/01-开题.md | 孩子开题：想做什么/为什么有趣/成功标准/大概几步 |
| templates/02-知识来源.md | 查了什么/哪里查的/哪些是猜的 |
| templates/03-任务计划.md | 目标＋三个任务＋每步产出 |
| templates/04-设计与算法.md | 状态与配置/规则顺序/手推一次更新/模型省略 |
| templates/05-开发与调试.md | 做了什么/遇到什么问题/怎么解决（边做边记） |
| templates/06-配置与测试.md | 配置比较：预期 vs 实际＋可信判据自查 |
| templates/07-变更记录.md | 改了什么/为什么/影响（用前后对比说话） |
| templates/08-总结与AI帮助.md | 学到什么/AI 帮了什么/哪些是自己判断 |
| report-template.md | 结题报告六问模板（≤2 页当量，内容从 01–08 搬） |
| presentation-outline.md | ≤5 页口头汇报提纲（每页标题＋3 要点＋配图建议） |
| document-workflow.md | 文档三来源（平台生成/孩子手填/助教整理）标注规则＋哪一步填哪份 |
| evidence-index.md | 已存在证据登记表（8 张截图/文字证据/交接件）＋未产生证据占位＋引用规则 |
| author-example/README.md | 第二阶段占位：计划内容、原料、启动条件、红线 |

设计约束执行情况：每份孩子模板头部两行说明"什么时候填、大约几分钟"；全部带【示例】占位符（示例取自 sample 作者真实记录，已明确标注不是孩子的）；孩子填写总负担按头部标注合计约 88 分钟（templates ≈70 ＋报告 ≈12 ＋提纲 ≈6），满足 ≤90 分钟约束（为估算值，未经真实孩子验证）。

## 3. 依赖的上游版本

- A 包（已交付 2026-11-03，状态待复核）：模板示例中的数值（第 1 步草46/动物20/水47；60 步终局 20.8/4/100；动物约第 9–10 步归零）取自 test-cases.json 与 B 包实测；术语口径（教学指数、模拟步）遵循 model-spec 与公共约定 §3。
- B 包（已交付 2026-11-03，待复核）：dev-log.md、test-report.md、evidence/ 是示例与证据引用来源。
- G 包（第一段已交付 2026-11-03）：document-workflow.md 与 evidence-index.md 引用 platform-check.md §2.1/§2.3/§4 的结论与三态证据定义。
- 范本目录（范本_fineSTEM制作/）：author-example 第二阶段的原料，本阶段只登记、未整理。
- C/E 包未交付：本阶段无依赖；C 冻结是 author-example 启动条件之一。

## 4. 实际执行的检查及结果

- 核对上游文件存在性与关键内容：A 包 HANDOFF、test-cases.json（TC01–TC10 共 10 组，match 全部 true，A-E001 实测记录）；B 包 HANDOFF、evidence/（8 张截图＋evidence-index.md）；G 包 HANDOFF、platform-check.md（§2.1 孩子手工路径、§2.3 文档与导出）、evidence/（8 张副本＋G-E-index.md）；范本 dev-log.md 与 evidence/evidence-index.md。本包引用的证据编号、文件名、数值均逐一对照原文，未杜撰。
- 文件全部落在 交付/D_文档汇报/ 内，Markdown 格式；未改动任何其他包文件；无临时文件散落。
- **未执行**：真实孩子试用模板（时间预算为估算，未验证）；author-example 整理（第二阶段）；任何代码运行或平台操作（D 本阶段不涉及）。

## 5. 未解决问题、缺失素材和限制

1. **author-example/ 与正式作者档案未做**——第二阶段。依赖：A/B/C 冻结后的真实记录收敛。原料：范本_fineSTEM制作/dev-log.md（6 项以上真实失败与修复）＋平台项目 04f835ac-e922-4bde-ad11-8079b74ad3f4 的聊天与证据记录（截图见 交付/G_接入验收/evidence/ 与 交付/B_作品代码/evidence/）。红线：不补造失败、测试、理解与反思；标"作者制作示例"不冒充学生经历；参考作者/孩子/AI 助教贡献分开标明；技术成果、模拟发现、生态知识分开表述。
2. **全部模板未经真实孩子试用，标"未验证"**：各份头部的时间预算是按 12–15 岁零基础的估算；试用后须回填实际用时与卡点（document-workflow.md §4）。
3. 年龄段口径冲突未拍板（统筹口头"三年级" vs 00 总策划"12–15 岁"，A/B 包 HANDOFF 均已提出）：D 模板措辞保持两端兼容，未使用年龄限定语；拍板后如需调整由 D 复核。
4. 模板 06 示例行引用"动物约第 9–10 步归零"叙事，该叙事在 A 包 HANDOFF §5 标注待统筹拍板；若拍板为"调参避免灭绝"，该示例需同步更换。
5. C/E/G 证据占位未产生（evidence-index.md §4）；platform-check 缺陷②③未修复前，涉及"从聊天取代码"的孩子指引以 platform-check.md §4 规避话术为准。

## 6. 给下一 Agent 的操作说明

- **第二阶段（author-example）**：等统筹确认 A/B/C 冻结后开工。先通读范本 dev-log.md 全文＋README §0/§0.5/§4＋evidence/evidence-index.md，再产出 author-example/ 内的作者档案与示范报告；每个结论挂证据编号（本包 evidence-index.md 可直接复用）；未完成部分标"待补"；不得把 Agent 操作改写成孩子经历。
- **真实孩子试用**：建议先发 templates/01–03（合计约 20 分钟内可完成，能快速看到孩子是否愿意写），记录每份实际用时与放弃点，回填 document-workflow.md §4 与各模板头部时间标注。
- **C/E/F 引用证据**：一律先查本包 evidence-index.md 定位再回原始文件核对；引用旧项目相关截图（B-E001/B-E002/G-E001）遵守 §5 引用规则第 1 条。
- **模板修订**：只改 templates/ 与 report-template.md、presentation-outline.md；每次修订在本 HANDOFF 追加一节"变更记录"（改了什么/为什么/影响哪些下游）。

## 7. 对范围或接口的变更建议

1. 建议统筹尽快拍板年龄段（三年级 vs 12–15）并回改 00 总策划——D 模板语气与示例、C/E 文案都受影响，越晚拍板返工越多。
2. 建议把"模板真实试用回填"列为第二阶段验收条件之一，否则时间预算（≤90 分钟约束）永远是估算。
3. 建议 author-example 的启动判据明确为：A/B/C 三包 HANDOFF 状态由"待复核"转"已验收"即视为冻结，不必等 G 第二段（Know 暂存包）完成。
