讲解文档沉淀与四入口展示（AI 代码讲解可回放）
核心设计
新增第 9 种工件 explanation（讲解文档），存 skill_states.standard_step_data.explanation_content，落盘 08_code_explanation.md，展示名「讲解文档」。
累加语义：每次沉淀以带时间戳章节追加：\n\n---\n\n## 📖 {topic} · {YYYY-MM-DD HH:mm}\n\n{content}；同内容重复提交跳过（子串包含判重）。
不入阶段门禁：不加进 ARTIFACT_FOR_STAGE（artifact_stage_gate 对未知工件自动放行），任何阶段可写、不影响阶段推进判定。
双通路：① 学生在 AI 讲解气泡上点「保存为讲解」；② AI 讲解后主动调 artifact_writer(artifact_name="explanation")（对 explanation 默认 append，防覆盖累加内容）。
Demo 端：种子 Demo 预写讲解文档（demos.explanation_doc 新列）作底座；登录用户若有从该 Demo fork 的项目（from_demo_id）且已有讲解文档，Demo 详情「讲解」页签额外显示「我的讲解回顾」。不把个人讲解写回共享 Demo 记录（Demo 全局共享，避免串数据）。
后端改动（apps/backend）
app/services/stage_constants.py
ARTIFACT_TO_BLOB_KEY 增 "explanation": "explanation_content"；ARTIFACT_TO_FILENAME 增 "explanation": "08_code_explanation.md"；ARTIFACT_NAME_ALIASES 增 "lecture"/"explain"/"code_explanation" -> "explanation"。不动 ARTIFACT_FOR_STAGE/STAGE_ORDER。
新文件 app/services/explanation_doc.py
append_explanation_section(project_id, content, topic=None, db=...) -> dict：读现有 explanation_content → 判重（新内容已在文档中则返回 {"status": "duplicate"}）→ 拼时间戳章节（topic 缺省取 content 首个 markdown 标题或首行截断 30 字）→ 调 pbl_engine.save_artifact(project_id, "explanation", 旧文+新章节, db) 整篇写回（复用落盘/last_updated_at 逻辑）。
app/services/tools.py — ArtifactWriterTool（L643 起）
schema 增可选 mode（replace/append）；artifact_name 描述加入 explanation 并说明「讲解沉淀用，默认追加」。
execute：artifact_name == "explanation" 时默认走 append_explanation_section（显式 mode="replace" 才整篇覆盖）；其余工件忽略 mode 维持整篇覆盖（不碰 Q-027/Q-037 的 evaluate 同步特例）。
app/api/projects.py
_ARTIFACT_META（L1152）追加 ("explanation", "讲解文档", "explanation_content", "08_code_explanation.md") —— 文档列表/单文档/ZIP 导出自动跟随，前端文件树自动出现该文档。
新端点 POST /{project_id}/explanation（owner 校验同 chat 接口），body {content: str, topic?: str} → append_explanation_section → 返回 {status, content_length}。
Demo 讲解列 + 种子
新迁移 app/db/migrations/versions/20260731_xxxxxx_add_explanation_doc_to_demos.py：仿 20260715_000005 幂等模式（PRAGMA table_info 判存在）ALTER TABLE demos ADD COLUMN explanation_doc TEXT NULL。
app/db/models.py DemoModel 增 explanation_doc: Mapped[str | None]；app/schemas/demos.py Demo 增 explanation_doc: Optional[str]。
app/repositories/demo_repo.py：3 个 SEED_DEMOS 各预写一份讲解文档（结构仿现有 AI 讲解：核心原理 → 设计思路 → 关键代码拆解 → 结果验证）；_to_schema 透传；_ensure_seed_demos 插入分支带上该字段，并加回填：已存在的 system 种子行若 explanation_doc IS NULL 则补写。
提示词（AI 自动沉淀通路）
zeroclaw_provider.py：STEM_SYSTEM_PROMPT 与「解释代码」场景提示词加规则——完成一次成体系讲解（原理/设计/代码拆解类）后调用 artifact_writer(artifact_name="explanation") 沉淀讲解要点（精炼版而非聊天原文）；闲聊问答不沉淀。走 Q-038 的 scene_instructions 消息注入链路，daemon 无需重启。
前端改动（apps/frontend）
services/api.ts + types/index.ts
projectsApi.appendExplanation(id, {content, topic}) -> POST /projects/{id}/explanation；Demo 类型增 explanation_doc?: string。
pages/Create.tsx
气泡「保存为讲解」：assistant 消息（内容 >200 字且 projectId 非 local-）尾部动作区加按钮，点击调 appendExplanation（topic 取消息首个标题），成功变「已保存 ✓」，duplicate 提示「已在讲解文档中」；成功后 bump docsRefreshSignal 传给 ProjectFilesPanel。
编辑器工具栏「AI 讲解」：页签工具栏（L4089 附近，「运行」旁）加按钮，把当前编辑器代码（截断至约 6000 字符）拼讲解提示词经 handleSend 发进聊天流（复用 code-error 反向通路模式）。
详情页跳转承接：工作区恢复完成后检查 sessionStorage.finestem_pending_action === 'explain'，命中则清 key 并自动对主代码文件发送讲解提示词。
components/ProjectFilesPanel.tsx
增可选 refreshSignal prop 触发 loadDocuments；stage === 'explanation' 的文档项用 BookOpen 图标区分（列表内容本身自动跟随 API）。
pages/ProjectDetail.tsx
新增「讲解回顾」Card：加载时 getDocument(id, 'explanation')；有内容显摘要 +「查看讲解文档」（弹窗展示，复用 ProjectFilesPanel 文档查看的渲染方式）；无内容显空态。
Card 内「AI 讲解代码」按钮：复用现有进入工作台的 finestem_restore_project sessionStorage 逻辑 + 写 finestem_pending_action='explain' → navigate('/create')。
pages/ExploreDemoDetail.tsx
页签由三个扩为四个：体验/拆解/讲解/代码；「讲解」页签渲染 demo.explanation_doc（无则空态提示）；URL ?tab=explanation 支持直达。
登录用户：从我的项目列表筛 from_demo_id === demo.id 的最新项目，getDocument(pid, 'explanation') 有内容则在页签内追加「我的讲解回顾」区块（展示 + 跳转该项目详情）。
验证与登记
后端验证脚本 .dbg/verify_explanation_api.py（TestClient，cd apps/backend 运行）：建项目 → POST explanation 两次不同内容 + 一次重复（断言 duplicate）→ documents 列表含讲解文档 → 单文档含两个时间戳章节 → artifact_writer 工具 append/replace 两模式 → GET demo 断言 explanation_doc 非空。
回归：python -m pytest tests/ -x -q（对照既有失败基线）；前端 npx tsc --noEmit + npm run build。
登记：问题清单加回归项 RT-39（讲解文档全链路：保存按钮/文件树/详情页/Demo 页签/累加判重）；测试计划升 v1.12 新增 TC-16。
假设
讲解文档为项目单文档累加（不做多文档/版本树）；「回放」以分章节时间戳文档形式满足，不做逐条消息回放器。
Demo「讲解」页签个人回顾只读自己 fork 的项目，不改共享 Demo 数据。
迁移在 dev 启动时按既有 alembic 流程自动应用。