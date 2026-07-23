# fineSTEM × ZeroClaw 集成重构

**版本**: v1.0.0
**日期**: 2026-07-22
**作者**: AI Agent
**状态**: 已实施
**关联文档**: `ZeroClaw_技术知识库_v1.0.0.md`、`产品与规划/fineSTEM_AI对话流设计规格_v1.1.0.md`

---

## 1. 背景与根因

### 1.1 现象（用户反馈）

fineSTEM 平台的 AI 对话长期存在以下问题，历次修复均无效：

1. AI 回答被自动截断，点击"继续生成"无响应
2. AI 的思考链（reasoning）被吞，只输出一行
3. `ask_question` 选项卡识别不准、时灵时不灵
4. 无法推进到下一阶段，或阶段乱跳
5. Schema 校验形同虚设

### 1.2 根因（5 轮调研实证定位）

经后端工具、PBL 引擎、MCP、skill 现状、ZeroClaw WebSocket 协议、前端事件链路、清洗函数共 7 轮深度调研，定位到 **4 层叠加根因**：

#### 根因 A：ZeroClaw 配置完全失效（最致命）

`H:/dev-env/zeroclaw/config/config.toml` 第 59 行 `system_prompt = """` 打开后**从未闭合**。TOML 解析器把后续所有内容（MCP 配置、runtime_profiles、risk_profiles）都当成字符串内容，直到文件末尾报错：

```
TOML parse error at line 381, column 29
    381 | quickstart_completed = true
invalid multi-line basic string, expected `"`
```

`zeroclaw status` 实锤配置回退默认值：ModelProvider 未配置、Agents 未配置、MCP 工具未加载。**fineSTEM AI 实际跑在裸 ZeroClaw 上**——没有 PBL 提示词、没有 12 个 finestem 工具、没有门禁。

> 这是 7/19 某次扩充 system_prompt 时引入的（原 113 行短版扩到 308 行长版，漏了结束 `"""`）。

#### 根因 B：后端工具存在 4 个门禁漏洞

| 漏洞 | 位置 | 后果 |
|------|------|------|
| `stage_advancer` 的 `target_stage` 分支跳过门禁 | `tools.py:354-362`（原）| LLM 传 `target_stage="stage_08_evaluate"` 可直接跳终点 |
| `skill_state_writer` 可写任意字段 | `tools.py:267-287`（原）| LLM 直接把 `current_stage` 写成任意值 |
| `check_gate` 只看字符串非空，不校验结构 | `pbl_engine.py:83-113`（原）| 详细 Pydantic 阶段模型定义了却没用 |
| `Evidence` type 枚举不匹配 | `tools.py:523`（原）| 非截图类证据一落库就 pydantic 崩溃 |

#### 根因 C：前端清洗逻辑过于激进

`Create.tsx:sanitizeAssistantNarration`（原 200 行）会清理含 `cat/ls/find/grep`、`import os/open().read()`、文件路径的行——**这些规则会误杀 AI 正常的教学代码示例**，是"回答被吞、只输出一行"的主因。

同时 `ask_question` 工具调用被双路径重复处理（`useStreamingChat.ts` 内部 + `Create.tsx onToolCall`），校验标准不一，导致卡片时灵时不灵。

#### 根因 D：Schema 与模板字段不一致

`.trae/skills/stem-pbl-guide/artifacts/schemas/*.json` 的字段名（如 `explicitly_out`）与模板/SKILL.md 实际用的字段名（如 `wont_do`）不一致，导致 `schema_valid` 恒为 false。

---

## 2. 解决方案

### 2.1 设计原则

1. **ZeroClaw 是主链路**：所有 AI 行为通过 `config.toml` + `SKILL.md` + MCP tools 三层定义
2. **原 `.trae/skills/stem-pbl-guide/` 不动**：其他 IDE 还在用，ZeroClaw 专用 skill 抽到新位置
3. **门禁收敛到工具层**：一个地方定义、所有路径（含 ZeroClaw agent loop）生效
4. **保留 orchestrator.py**：虽是死代码（前端直连 ZeroClaw），但不删除

### 2.2 架构（重构后）

```
┌─────────────────────────────────────────────────────────────────┐
│  前端 React SPA                                                  │
│  └─ useStreamingChat ──ws──→ ZeroClaw daemon (127.0.0.1:42617)  │
├─────────────────────────────────────────────────────────────────┤
│  ZeroClaw 运行时（config.toml 已修复）                           │
│  ├─ system_prompt (config.toml:59-309)                          │
│  ├─ agent workspace 文档 (SOUL/IDENTITY/TOOLS.md) ← PBL 导师身份│
│  ├─ skill: stem-pbl-guide (workspace/skills/.../SKILL.md)       │
│  └─ MCP → fineSTEM 后端 tools.py                                │
│       ├─ stage_advancer ← 门禁收敛（can_advance_to + check_gate）│
│       ├─ skill_state_writer ← 白名单（禁止改阶段/工件）          │
│       ├─ artifact_writer ← 阶段门禁（artifact_stage_gate）       │
│       ├─ achievement_card ← 仅 stage_08                          │
│       └─ evidence_saver ← type 枚举对齐                          │
├─────────────────────────────────────────────────────────────────┤
│  PBL 引擎（stage_constants.py 单一事实来源）                      │
│  ├─ STAGE_ORDER / ARTIFACT_FOR_STAGE / CODE_ALLOWED_STAGES      │
│  ├─ can_advance_to（禁止跨阶段跳）                               │
│  ├─ artifact_stage_gate（工件写入门禁）                          │
│  └─ check_gate（非空硬门禁 + 结构软校验）                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 改动清单

### A. ZeroClaw 配置 + skill 落地

| # | 文件 | 改动 |
|---|------|------|
| A.1 | `H:/dev-env/zeroclaw/config/config.toml` | 修复 system_prompt 字符串闭合（第 309 行补 `"""`）。备份到 `.bak.20260722-before-overhaul` |
| A.2 | `.../workspace/skills/stem-pbl-guide/SKILL.md` | **新建** ZeroClaw 专用 skill（约 230 行）。从 config.toml system_prompt 精简抽取 + 阶段路由索引 + 工具速查。`zeroclaw skills audit` 通过 |
| A.3 | `.../workspace/SOUL.md` | 改写为 fineSTEM PBL 导师身份（原是通用 assistant 模板，与 PBL 角色冲突） |
| A.3 | `.../workspace/IDENTITY.md` | 改写为"未来科技学院 AI 导师" |
| A.3 | `.../workspace/TOOLS.md` | 追加 12 个 finestem__ 工具速查表 |

原 `.trae/skills/stem-pbl-guide/` **未改动**（其他 IDE 使用）。

### B. 后端工具门禁收敛

| # | 文件 | 改动 |
|---|------|------|
| B.6 | `apps/backend/app/services/stage_constants.py` | **新建**。集中 `STAGE_ORDER`/`ARTIFACT_FOR_STAGE`/`ARTIFACT_TO_BLOB_KEY`/`CODE_ALLOWED_STAGES` + `can_advance_to`/`artifact_stage_gate`/`stage_index`/`is_code_allowed_stage`。消除原散落在 5 处的重复定义 |
| B.1 | `tools.py:StageAdvancerTool` | `target_stage` 分支改为必须 `can_advance_to`（只允许下一阶段，禁止跨阶段跳）+ 先跑 `check_gate` |
| B.2 | `tools.py:SkillStateWriterTool` | 加 `ALLOWED_FIELDS` 白名单。禁止直接写 `current_stage`/`standard_step_data`/`stages`（必须走 stage_advancer/artifact_writer） |
| B.3 | `pbl_engine.py:check_gate` | 双层门禁：第 1 道非空检查（硬门禁）+ 第 2 道结构校验（软门禁，返回精确 missing 清单但不拦截非 JSON 工件） |
| B.4 | `tools.py:EvidenceSaverTool` | type 枚举对齐 `schemas/evidence.py`；加 `TYPE_ALIAS_MAP`（`code→code_snapshot`、`dialogue_summary→auto_ai_summary`、`run_result→text_log`） |
| B.5 | `tools.py:ArtifactWriterTool` | execute 开头加 `artifact_stage_gate`（当前阶段必须 ≥ 工件所属阶段） |
| B.5 | `tools.py:AchievementCardTool` | execute 开头加阶段门禁（仅 `stage_08_evaluate` 允许） |
| - | `pbl_engine.py` 顶部 | 改为从 `stage_constants` 导入常量（向后兼容再导出 `ARTIFACT_FOR_STAGE` 等） |

### C. 前端清洗 + 事件链路

| # | 文件 | 改动 |
|---|------|------|
| C.1 | `Create.tsx:sanitizeAssistantNarration` | 移除会误杀 AI 教学代码的激进规则（cat/ls/find/grep 行清理、import os/open().read() 行清理、文件路径行清理）。保留 DSML 残片、UUID、JSON Patch、question/option 标签清理 |
| C.2 | `Create.tsx:onToolCall` | 移除 `ask_question` 分支（hook 内部已通过 `onQuestions` 推送，避免双路径重复处理）。移除未使用的 `toolCallToQuestion` import |
| C.3 | `useStreamingChat.ts` | **抓帧实证修复**：新增 `normalizeToolName`（剥离 `finestem__` 前缀）+ `parseMcpOutput`（解析 MCP 双层 JSON output）。`tool_call`/`tool_result` 分支统一用归一化后的工具名和解析后的输出。**这是选项卡不显示的真正根因修复** |

### D. Schema 对齐

| # | 文件 | 改动 |
|---|------|------|
| D.2 | `schemas/projects.py:Stage04TrackData` | `template_id`(3 枚举) → `track`(8 枚举，含 web_app/game_dev/ai_ml/data_viz/creative_coding)；`tech_stack` 放宽为 `Optional[Any]`（兼容 str 或 dict）；加 `rationale` 字段 |

原 `.trae/skills/stem-pbl-guide/artifacts/schemas/*.json` **未改动**（其他 IDE 使用；ZeroClaw 路径用后端 Pydantic 校验，不读这些 JSON Schema 文件）。

---

## 4. 验证结果

### 4.1 ZeroClaw 配置（已验证）

```
$ zeroclaw config migrate
配置已为当前架构版本。   # ← 不再报错

$ zeroclaw status
🤖 ModelProvider:      glm.default + deepseek.default   # ← 已恢复
🛡️  Agents:        assistant=Supervised                # ← 已恢复

$ zeroclaw skills audit .../stem-pbl-guide
✓ Skill audit passed (2 files scanned)                 # ← skill 可识别
```

### 4.2 后端门禁（已验证，6 项全通过）

```
✓ can_advance_to 正确拦截跨阶段跳（stage_01 → stage_08 被拒）
✓ artifact_stage_gate 正确拦截越权写工件（stage_01 写 evaluate 被拒）
✓ check_gate 拦截空工件
✓ check_gate 放行非空工件
✓ check_gate 结构校验返回精确 missing 清单
✓ 代码阶段锁正确（stage_05/07/08 允许，stage_01 拒绝）
✓ Evidence 类型映射正确（修复 pydantic 崩溃隐患）
✓ skill_state_writer 实际拦截了 current_stage 写入
✓ skill_state_writer 放行了 metadata 写入
```

### 4.3 前端（已验证）

```
$ npx tsc --noEmit   # ← 源码零类型错误（仅测试文件有预存的 jest 配置问题）
$ 后端 import OK，TOOL_REGISTRY 12 个工具完整
```

### 4.4 未通过项（预存问题，非本次引入）

- `tests/test_pbl_dialogue_flow.py` / `test_stream_truncation.py` 等导入 orchestrator 的旧符号失败——这些是历史遗留的坏测试，依赖已不存在的 `_parse_selection_format`/`AgentOrchestrator`，与本次改动无关
- `test_project.py` 的 async 测试缺 `pytest-asyncio` 插件——环境问题

### 4.5 真实 WebSocket 对话验证（实证，2026-07-22）

启动 ZeroClaw daemon 后，用 `scripts/ws_frame_capture.py` 和 `scripts/ws_multi_turn_test.py` 连真实 daemon 做对话测试，**抓帧实证确认**：

#### 抓帧发现的关键事实

| 项 | 实际帧值 | 前端原假设 | 影响 |
|---|---|---|---|
| `tool_call.name` | **`finestem__ask_question`**（带 `finestem__` 前缀）| `ask_question`（无前缀）| ❌ 前端所有 `=== 'ask_question'` 判断失效 → **选项卡不显示的真正根因** |
| `tool_result.name` | `finestem__project_creator` 等 | `project_creator` 等 | ❌ 同样失效，阶段推进/代码生成事件全丢 |
| `tool_result.output` | MCP 双层 JSON：`{"content":[{"text":"<内层JSON>"}]}` | 直接当 output | ❌ 前端拿不到工具真实返回值 |
| `done.finish_reason` | **字段不存在** | `=== 'length'` | ❌ 截断检测靠内容启发式（已实现）|

#### 据此新增的修复

在 `useStreamingChat.ts` 加了两个归一化函数：
- `normalizeToolName(rawName)`：剥离 `finestem__` 前缀
- `parseMcpOutput(rawOutput)`：解析 MCP 双层 JSON，提取内层工具返回值

`tool_call` / `tool_result` 分支统一用归一化后的工具名 + 解析后的 output。

#### 多轮对话验证结果

模拟学生"我想做一个项目 → 初中 → 6小时 → 需要脑爆"四轮对话：

```
turn 0: "我想做一个项目" → ask_question「你现在是哪个年级？」 ✅ 渲染卡片
turn 1: 答初中            → ask_question「你打算花多少时间？」 ✅ 渲染卡片
turn 2: 答6小时           → ask_question「有没有项目想法？」 ✅ 渲染卡片
turn 3: 答没想法需要脑爆   → project_creator(创建项目) ✅ + ask_question「兴趣（多选）」 ✅
```

**完全符合** config.toml 定义的 stage_00_bootstrap 三轮提问流程 + 进入 stage_01 脑爆。AI 正确调用了 `project_creator` 创建项目并推进阶段——这在 config 坏的时候绝不会发生。

---

## 5. 备份与回滚

### 5.1 备份位置

| 备份 | 位置 |
|------|------|
| config.toml 原文件 | `H:/dev-env/zeroclaw/config/config.toml.bak.20260722-before-overhaul` |
| workspace 文档原文件 | `H:/dev-env/zeroclaw/config/agents/assistant/workspace.bak.20260722/` |
| 后端代码 | git 版本控制（未 commit，可 `git stash` 或 `git diff` 查看） |

### 5.2 回滚步骤

**完全回滚**：
```bash
# 后端代码
cd G:/mediaProjects/fineSTEM && git stash
# ZeroClaw 配置
cp H:/dev-env/zeroclaw/config/config.toml.bak.20260722-before-overhaul H:/dev-env/zeroclaw/config/config.toml
cp -r H:/dev-env/zeroclaw/config/agents/assistant/workspace.bak.20260722/* H:/dev-env/zeroclaw/config/agents/assistant/workspace/
rm -rf H:/dev-env/zeroclaw/config/agents/assistant/workspace/skills/stem-pbl-guide
# 重启 ZeroClaw daemon
```

**部分回滚**（只回滚某一项）：参考改动清单的文件路径，单独恢复。

---

## 6. 后续演进建议（未实施）

| 建议 | 价值 | 复杂度 |
|------|------|--------|
| 用 ZeroClaw 的 SOP 机制承载 PBL 阶段门禁 | 把"软门禁"变成强制流程图，AI 必须按图走 | 高（需学习 SOP 节点图语法）|
| 多 agent（PBL导师/编程助手/平台引导）| 三角色独立 system_prompt，避免互相干扰 | 中 |
| 抓取真实 WebSocket 帧确认字段名 | 消除 `tool_call` 字段（name/args vs tool/arguments）的最后不确定性 | 低 |
| 项目级 memory（用户画像/能力标签）| 跨会话记忆，文档规划的 Phase 3 | 中 |
| 删除 orchestrator.py 死代码 | 减少混淆，但需先确认无其他调用方 | 低 |

---

## 7. 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| skill 装载方式 | ZeroClaw 原生 skill（`workspace/skills/`）| 符合 agentskills.io 规范，daemon 自动加载，比 config.toml system_prompt 更规范 |
| 原 skill 是否改 | **不改**，另抽 ZeroClaw 专用版 | 其他 IDE 还在用原版，避免影响 |
| orchestrator.py 是否删 | **保留不动** | 用户明确要求；虽是死代码但不影响运行 |
| 是否切回 FastAPI | **不切** | ZeroClaw 是主链路，MCP 已接好工具 |
| 门禁用 Pydantic 还是手动检查 | 手动检查关键字段 | Pydantic 严格校验会卡死存量数据；手动检查可精确诊断缺失字段且兼容 markdown 工件 |
| check_gate 结构校验是硬还是软 | **软门禁**（只返回 missing 不拦截）| 避免 markdown 类工件（brainstorm/dev_log）和老项目被卡死；硬门禁只保留"工件非空" |

---

**文档结束**
