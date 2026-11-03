# HANDOFF：G 包（平台接入与验收）

日期：2026-11-03｜modelVersion: eco-island-v1（A 冻结）｜codeVersion: B reference v3（=线上 04f835ac 现行）｜contentVersion: 六包 2026-11-03 冻结稿 + G 暂存包 v1.0｜校验日期：2026-11-03｜交付状态：**两段全部完成（待复核）**｜适用运行入口：本地 B 包 HTML + 平台项目 04f835ac + Know 暂存包（draft，未发布）

## 1. 当前状态

**两段全部完成。**
- 第一段（能力验证）：platform-check.md + evidence/（8 张截图 + G-E-index.md）——已于本日早前交付，未变。
- 第二段（整合验收与 Know 暂存包）：integration-report.md、release-checklist.md、staging/（draft 暂存包 + check-draft.py 自检）、evidence/G-E002（stepModel 比对+用例复跑）、本 HANDOFF 更新——本段新交付。
- **关键口径：「暂存包就绪」≠「线上已发布」。** staging/ 不在生产 content/know 下（服务扫描不到），episode status=draft（loader 对缺省值按 published 处理，draft 必须显式写非 published 值，已按此写）。本段零线上操作、未改生产内容、未动 apps/ 与其他包文件（只读）。
- 六件套整体层级判定：**暂存包就绪**。不能声称"整套 sample 完成/可发布"（F 两支视频均非成片、D author-example 第二阶段未成稿，见 integration-report §1/§6）。

## 2. 已完成文件及用途（含第一段）

| 文件 | 用途 |
|---|---|
| platform-check.md | 【第一段】平台能力报告：推荐实现形式、9 步孩子手工路径、Agent 两法、限制、缺陷 5 项及规避、三态标注 |
| integration-report.md | 【第二段】六件套整合报告：逐件状态（成稿/测试片/占位）、版本一致性核对表（36 项逐项）、六包间矛盾与过期表述（4 项）、整链分段验证与缺口清单、待拍板 9 项汇总、风险与建议、本段实际执行清单 |
| release-checklist.md | 【第二段】可勾选发布清单：拍板前置 9 项 / 内容核对 10 项 / 链接核对 10 项 / 证据核对 6 项 / 发布动作 6 步 / 明确不做边界 |
| staging/README.md | 【第二段】暂存包说明：draft 结构、字段逐项来源映射（对照 know.py+know_content.py+现有样例）、拍板项占位方式、发布待办、自检方法 |
| staging/draft/series/eco-island/ | 【第二段】Know 暂存包：series.json + ep01/episode.json（status=draft，无占位链接）+ interactive/index.html（=B reference 逐字节副本）+ docs/（C 四章知识+复刻指南+E 博客，逐字节副本） |
| staging/check-draft.py | 【第二段】暂存包自检脚本（镜像生产 loader 解析规则：status 过滤/path 与 url 必填/文件存在性/slug 冲突）；2026-11-03 实跑 **16/16 PASS** |
| evidence/G-E002-stepmodel-verification.txt + 3 个 .cjs 脚本 | 【第二段】模型一致性证据：逐字比对输出 + 10 组用例独立复跑 10/10（可复跑） |
| evidence/（8 张 PNG + G-E-index.md） | 【第一段】截图证据与逐张索引；G-E-index 已补第二段 G-E002 登记 |
| HANDOFF.md | 本文件 |

## 3. 依赖的上游版本

- A：model-spec.md（eco-island-v1 冻结）/ test-cases.json（10 组双验证）/ science-notes.md（S1–S9）/ learning-outline.md，均 2026-11-03。**G 已独立复跑其 10 组用例对 B reference：全部通过（G-E002）。**
- B：六份 HTML + test-report/README/code-map/variants notes.md，2026-11-03。G 逐字比对 reference/checkpoints 与冻结源码一致；starter/variants 为文档化有意差异。
- C：walkthrough-report（34/34）/task-cards/change-challenges/replicate-guide/knowledge 四章/teen-video-script/assistant-guide，2026-11-03，纯文档未动模型。锚点与编号逐项核对一致。
- D：8 模板/报告/提纲/document-workflow/evidence-index（骨架版）；author-example=第二阶段占位未成稿。
- E：parent-blog（冻结 1608 字）/parent-video-script（425 字冻结）/media-brief/claims-and-sources（K1–K10↔A C/S、W1–W7↔B/G 证据，映射逐条核对一致）。
- F：少年测试片 3:18 + 家长排片样片 2:06（均非成片）+ 封面两版 + SRT + manifest/playback-check；素材引用编号实存核对一致。
- G 第一段产物（platform-check/evidence）；00 总策划与 01 公共约定（2026-11-02 版）；本地代码 apps/backend（know schema/loader）、apps/know（iframe 沙箱）、apps/frontend（路由）、content/know（7 系列样例）——全部只读。

## 4. 实际执行的检查及结果（第二段新增；第一段见 platform-check）

全部为本地核对/源码审读/暂存包构建，**无线上操作**（2026-11-03，node v22.22.0 + python stdlib）：
1. stepModel 逐字机器比对：A 冻结源码 ↔ B 六份 HTML（reference+3 checkpoints IDENTICAL；starter=5 TODO+`?? 3`；variants=low:0+`?? 3`）；B reference ↔ 范本 kids-v3 相同 → G-E002。
2. A 10 组用例对 B reference 独立复跑：**10/10 通过**（含 TC01=46/20/47、TC09 终局 20.8/4/100 及 9 个 key steps、TC10 maxSteps 探针）→ G-E002。
3. 锚点核对 12 项 × 6 包（46/20/47、0/11/37.7、0.4/0/41.9、20.8/4/100、干旱岛 16.4/0/0 与中间锚点、三档雨、系数预演、圣马太岛等）逐文件读原文：一致（详见 integration-report §2.2）。
4. 编号核对：E K1–K10/W1–W7 ↔ A science-notes C1–C12/S1–S9 与 B/G 证据编号，逐条映射正确；C 章节 C#/S#/TC# 相符；F 引用编号实存。
5. 整链分段验证：本地可运行（B+C+G 三方证据）、平台入口（2026-11-02 实测沿用）、复刻路径（C walkthrough）三段 ✓；Know 内容页/试玩挂接/起始代码挂接三段 ✗=缺少整链条件（草稿已备，未建生产挂接）。
6. Know schema 审读（源码可见）：know.py 响应模型、know_content.py 磁盘解析（status 缺省=published、interactive/docs 用 path 由服务拼 URL、projects 必须有 url、videos 需 embed_url）、ResourceStage.tsx iframe 沙箱（allow-scripts）、App.tsx 路由、content/know 现有样例字段惯例；slug 冲突实查（eco-island 无冲突）。
7. 暂存包构建与自检：staging/draft 全部字段按真实磁盘 schema；interactive=B reference 逐字节副本（自包含核查：无外链/无 localStorage，沙箱兼容）；docs=C/E 冻结稿逐字节副本；check-draft.py 实跑 **16/16 PASS，0 FAIL**；两个 JSON stdlib 严格解析通过。
8. 平台项目 URL 核实：范本 README §0 原文（04f835ac 项目页与成果卡地址）——staging projects[].url 按此填写并标注私有现状。

**未执行（如实声明）**：线上任何操作（Know 预览实访、平台路径复测）；F 视频的 ffprobe/抽帧复检（采信 playback-check）；E 字数复算（采信 E 脚本记录）；真实孩子/家长试用；任何发布动作。

## 5. 未解决问题、缺失素材和限制

1. **六包间矛盾 4 项**（详见 integration-report §3）：B code-map 2 处与 A 冻结规范矛盾（maxSteps 停机归属、grass 上限）——建议发布前 B 修订约 2 行；B README 2 处过期表述；D evidence-index §4 过期（C/E/F 交付前所写）；旧 reference.html 同标签问题处置待统筹裁。均不阻塞暂存包。
2. **待拍板 9 项**（integration-report §5）：灭绝叙事三选、年龄段、发布入口公开方式、家长配音音色、少年旁白音色、镜 6 补录、家长真人出镜、封面文案、残留清理执行。全部指向统筹/用户。
3. **整链缺口 3 项**：缺 Know 内容页、缺试玩入口挂接、缺起始代码页挂接——草稿与素材已就绪，挂接属发布动作（本包不执行）。
4. F 两支视频为测试片/排片样片非成片；D author-example 未成稿——"整套 sample 完成"的声明在这两项关闭前不成立。
5. 沿用第一段遗留：分享 token 残留待部署执行清理；平台缺陷②③④⑤未修复；移动端未验证。

## 6. 给下一 Agent 的操作说明（全部指向统筹/用户）

- **统筹/用户（拍板与发布）**：①拍 integration-report §5 的 9 项（其中灭绝叙事与年龄段影响面最大，先拍）；②按 release-checklist 顺序执行发布（测试环境→匿名走查→生产）；③B code-map/README 修订、D evidence-index 更新、F 补录、D 第二阶段 author-example 分别安排到对应包。
- **G（如被再次调用）**：发布时复跑 staging/check-draft.py 与 evidence/G-E002 三脚本做回归；发布走查可登记为 G-E003；分享 token 清理执行后按 platform-check §6 复测回填。
- **B**：code-map §模型规范摘要 两处（maxSteps 归属界面层、grass 无上限截断）+ README 两处回填；改完在 HANDOFF 追加变更记录（01 §8），无需重跑测试（模型未动，G-E002 可一键复核）。
- **D**：第二阶段 author-example 启动时顺手把 evidence-index §4 的 C/E/F/G2 条目补登记。
- **F**：补录两件事（镜 6、家长真人）按本包引用的执行卡；音色拍板前不要全量配音。
- **E/C**：灭绝叙事与年龄段拍板后按各自 HANDOFF 已列的联动清单回改（E 声称②可当日完成；C 的全局联动清单在 C HANDOFF §5.1）。

## 7. 对范围或接口的变更建议（给统筹）

1. **发布前最小修正包**：B code-map 2 处 + README 2 处 + D evidence-index §4 刷新——三处都是文档层，半天内可清，建议与拍板同批处理。
2. **旧 reference.html 同标签（eco-island-v1）处置**：建议统筹裁定（改名/加废止标注/删除），消除 A model-spec §6.3 警示的版本卫生隐患；裁定前凡引用模型以 kids-v3/B reference 为准。
3. **"单步可越过 60 步"是否拦截**：A HANDOFF 变更建议 #2 悬置中；不拦截则建议在 Know 说明与 code-map 写明"60 步后仍可手动单步，数值仍确定性"。
4. **发布走查标准化**：建议把 release-checklist §4.2 的"匿名视角全链走查"固化为每次 Know 发布的必检步骤（本 sample 之后复用）。
5. （沿用第一段建议，仍有效）分享 token 清理交部署 Agent；分段协议维持写进 C 助教卡；缺陷②③修复后再录对话式复刻视频。
