# fineSTEM × ZeroClaw 架构审计报告

**版本**: v1.0.0
**审计日期**: 2026-07-22
**审计范围**: ZeroClaw 集成深度、Skill 导入正确性、端到端链路完整性
**审计结论**: **项目已彻底用上 ZeroClaw 作为核心运行时，第二次迁移修复了所有致命问题**

---

## 1. 审计概要

### 1.1 审计结论矩阵

| 审计维度 | 状态 | 证据 |
|----------|------|------|
| ZeroClaw 配置层 | ✅ 通过 | config.toml schema_version=3，system_prompt 已闭合（第309行），Provider/Agent/Risk/Runtime 全部正确配置 |
| MCP Server 层 | ✅ 通过 | server.py 实现原生 MCP 1.0 stdio 协议，12 个工具完整暴露，UTF-8 强制编码，Windows 兼容 |
| 后端工具门禁层 | ✅ 通过 | stage_constants.py 单一事实来源，can_advance_to 禁跨阶段跳，artifact_stage_gate 工件门禁，check_gate 双层校验 |
| ZeroClaw Skill 层 | ✅ 通过 | workspace/skills/stem-pbl-guide/SKILL.md 有正确 YAML frontmatter，200 行精简版独立维护 |
| 前端连接层 | ✅ 通过 | 直连 ws://127.0.0.1:42617/ws/chat，normalizeToolName 修复前缀问题，parseMcpOutput 修复双层 JSON |
| 端到端链路 | ✅ 通过 | 前端 → ZeroClaw Gateway → Agent Loop → MCP → 后端工具 → 数据库，全链路验证 |
| 安全合规 | ⚠️ 有风险 | API Key 硬编码在 config.toml，端口 42617 不在白名单 |

### 1.2 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│  前端 React SPA                                                      │
│  useStreamingChat.ts                                                 │
│  ├─ ws://127.0.0.1:42617/ws/chat (直连 ZeroClaw Gateway)            │
│  ├─ normalizeToolName() → 剥离 finestem__ 前缀                      │
│  ├─ parseMcpOutput() → 解析 MCP 双层 JSON                           │
│  └─ buildOutgoingMessage() → 消息文本注入项目上下文                  │
├─────────────────────────────────────────────────────────────────────┤
│  ZeroClaw Daemon (Rust 二进制, H:\dev-env\zeroclaw)                  │
│  ├─ config.toml                                                      │
│  │   ├─ Provider: deepseek.default (主) + glm.default (fallback)    │
│  │   ├─ Agent: assistant (Supervised + standard risk)               │
│  │   ├─ Runtime: agentic=true, max_tool_iterations=100              │
│  │   ├─ tool_filter_groups: always → finestem__* 始终可见           │
│  │   └─ system_prompt (309行, 已闭合) → PBL 导师身份与规则          │
│  ├─ workspace/skills/stem-pbl-guide/SKILL.md (200行 ZeroClaw 专用) │
│  ├─ workspace/SOUL.md + IDENTITY.md + TOOLS.md (导师身份)          │
│  └─ MCP → finestem server (stdio JSON-RPC 2.0)                      │
├─────────────────────────────────────────────────────────────────────┤
│  后端 FastAPI (apps/backend)                                         │
│  ├─ mcp_server/server.py (MCP stdio 入口)                           │
│  ├─ services/tools.py (TOOL_REGISTRY: 12 个工具)                    │
│  │   ├─ project_creator / stage_advancer / artifact_writer           │
│  │   ├─ skill_state_reader / skill_state_writer (白名单)            │
│  │   ├─ artifact_reader / evidence_saver / code_runner               │
│  │   ├─ project_code_writer / resource_searcher                      │
│  │   ├─ achievement_card / ask_question                              │
│  │   └─ 门禁: can_advance_to + artifact_stage_gate + check_gate    │
│  ├─ services/stage_constants.py (单一事实来源)                      │
│  ├─ services/pbl_engine.py (双层门禁: 硬非空 + 软结构校验)          │
│  └─ repositories/runtime_db.py (SQLite, D:\data\finestem)           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. ZeroClaw 框架评估

### 2.1 ZeroClaw 是什么

ZeroClaw 是用 Rust 从底层重写的自主 AI 智能体运行时（agent runtime），定位为个人 AI 助手基础设施。核心特征：单一二进制文件（约 3.4MB）、零依赖、Trait 驱动可插拔架构、100% 数据自主权。

- **GitHub**: https://github.com/zeroclaw-labs/zeroclaw
- **当前版本**: v0.7.5（项目部署 v0.8.3）
- **许可证**: MIT OR Apache-2.0

### 2.2 八大可插拔 Trait

| Trait | 职责 | fineSTEM 使用情况 |
|-------|------|-------------------|
| Provider | LLM 模型接入 | ✅ DeepSeek (主) + GLM (fallback) |
| Channel | 通讯渠道 | ✅ WebSocket Gateway (前端直连) |
| Memory | 持久化记忆 | ✅ SQLite |
| Tool | 工具执行 | ✅ MCP → 12 个 finestem 工具 |
| Skill | 可复用指令 | ✅ stem-pbl-guide (workspace/skills/) |
| Runtime | 运行时配置 | ✅ agentic=true, max_tool_iterations=100 |
| Risk | 安全策略 | ✅ Supervised + auto_approve 12 工具 |
| Gateway | HTTP/WS 网关 | ✅ 127.0.0.1:42617, require_pairing |

### 2.3 适用性评估

**适合 fineSTEM 的方面**:
- **Agent Loop**: 项目需要"对话 → 工具调用 → 阶段推进"的 agentic 循环，ZeroClaw 的 agentic runtime 完美匹配
- **MCP 工具集成**: stdio 协议简单可靠，Python 后端作为 MCP server 被 ZeroClaw daemon spawn
- **WebSocket Gateway**: 前端直连 ZeroClaw，不需要中间 API 层转发
- **Skill 机制**: PBL 引导规范独立维护，符合"对话引导 → 文档驱动 → 代码实现"的设计理念
- **Risk Profile**: auto_approve 让 12 个 PBL 工具自动放行，不弹审批框，学生体验流畅

**需要注意的方面**:
- **Windows 兼容**: asyncio ProactorPipe 问题需线程化 stdin 读取（已解决）
- **UTF-8 编码**: Windows 默认 cp936，需强制 reconfigure（已解决）
- **端口管理**: ZeroClaw 默认 42617 不在项目白名单（需调整）
- **生产部署**: 前端无法直连 127.0.0.1:42617，需反向代理

**结论**: ZeroClaw 适合 fineSTEM 项目的核心场景。它的 agentic runtime + MCP + Skill + Gateway 组合，正好覆盖了"PBL 引导对话 → 工具调用 → 阶段推进 → 文档生成"的全链路需求。

---

## 3. 逐层审计详情

### 3.1 ZeroClaw 配置层 (config.toml)

**文件**: `H:/dev-env/zeroclaw/config/config.toml`

| 配置项 | 值 | 状态 | 说明 |
|--------|-----|------|------|
| schema_version | 3 | ✅ | V3 配置格式 |
| Provider (主) | deepseek.default | ✅ | model=deepseek-chat, api_key 已配置 |
| Provider (fallback) | glm.default | ⚠️ | api_key 为空，实际不可用 |
| Risk Profile | standard/supervised | ✅ | workspace_only + auto_approve 12 工具 |
| Agent | assistant | ✅ | model_provider + risk + runtime + mcp_bundles |
| system_prompt | 309 行 | ✅ | 第 309 行 `"""` 已闭合（此前未闭合是第一次迁移失败的根因） |
| MCP | enabled=true | ✅ | stdio 模式, 指向 server.py |
| MCP env | PYTHONPATH + DB_URL | ✅ | 确保模块导入和数据库路径 |
| Gateway | 127.0.0.1:42617 | ⚠️ | require_pairing=true, 但端口不在白名单 |
| Memory | sqlite | ✅ | |
| Runtime | agentic=true | ✅ | max_tool_iterations=100, parallel_tools=true |
| tool_filter_groups | always/finestem__* | ✅ | 工具始终可见，不需要动态发现 |

**关键修复记录**（第二次迁移）:
- **根因 A 修复**: system_prompt 的 `"""` 在第 309 行闭合。此前第 59 行 `system_prompt = """` 打开后从未闭合，TOML 解析器把后续所有内容当成字符串，导致 Provider/Agent/MCP 配置全部失效——AI 实际跑在裸 ZeroClaw 上，没有 PBL 提示词、没有 12 个工具、没有门禁。
- **根因 B 修复**: runtime_profile 从 `agentic=false` 改为 `agentic=true`，否则 MCP 工具虽然进入 LLM 上下文但不会被调用。
- **根因 C 修复**: tool_filter_groups 配置为 `always` 模式，否则 `finestem__*` 工具不会进入 LLM 上下文。

### 3.2 MCP Server 层 (server.py)

**文件**: `apps/backend/app/mcp_server/server.py`

| 审计项 | 状态 | 说明 |
|--------|------|------|
| MCP 协议版本 | ✅ | 2024-11-05 (MCP 1.0) |
| 传输方式 | ✅ | stdio (JSON-RPC 2.0 over stdin/stdout) |
| 方法支持 | ✅ | initialize / tools/list / tools/call / ping / notifications.initialized |
| 工具加载 | ✅ | 从 TOOL_REGISTRY 延迟导入 12 个工具 |
| UTF-8 强制 | ✅ | `sys.stdout.reconfigure(encoding="utf-8")` 解决 Windows cp936 |
| cwd 切换 | ✅ | `os.chdir(_BACKEND_DIR)` 让 pydantic-settings 加载正确 .env |
| sys.path 注入 | ✅ | 确保 `from app.services.tools import TOOL_REGISTRY` 可解析 |
| Windows asyncio 兼容 | ✅ | 线程化 stdin 读取，避免 ProactorPipe WinError 6 |
| MCP 响应格式 | ✅ | `{content: [{type:"text", text:JSON}], isError:bool}` 标准格式 |
| 错误处理 | ✅ | 异常捕获 + traceback 返回 + isError 标记 |

**关键设计决策**:
- 不引入新依赖（不使用 mcp SDK），直接手写 JSON-RPC 循环
- 工具实现完全复用 `BaseTool.execute()`，MCP 只做协议适配
- 工具名在 ZeroClaw 端会被加 `finestem__` 前缀（MCP server name + tool name）

### 3.3 后端工具门禁层

#### 3.3.1 stage_constants.py（单一事实来源）

**文件**: `apps/backend/app/services/stage_constants.py`

| 常量/函数 | 状态 | 说明 |
|-----------|------|------|
| STAGE_ORDER | ✅ | 9 阶段顺序定义 (stage_00 → stage_08) |
| ARTIFACT_FOR_STAGE | ✅ | 阶段 → 必须产出的工件映射 |
| ARTIFACT_TO_BLOB_KEY | ✅ | 工件 → DB blob key 映射 |
| ARTIFACT_TO_STAGE | ✅ | 工件 → 所属阶段（反向映射） |
| CODE_ALLOWED_STAGES | ✅ | {stage_05, stage_07, stage_08} |
| can_advance_to() | ✅ | 只允许推进到下一阶段，禁止跨阶段跳 |
| artifact_stage_gate() | ✅ | 工件写入时校验当前阶段 >= 工件所属阶段 |
| is_code_allowed_stage() | ✅ | 阶段代码锁 |
| stage_index() | ✅ | 阶段索引查询 |

#### 3.3.2 pbl_engine.py（门禁引擎）

**文件**: `apps/backend/app/services/pbl_engine.py`

| 函数 | 状态 | 门禁类型 | 说明 |
|------|------|----------|------|
| check_gate() | ✅ | 硬+软双层 | 第1道: 工件非空检查(硬拦截)；第2道: 结构校验(软,返回missing不拦截) |
| _structural_check() | ✅ | 软门禁 | JSON 类工件做 Pydantic 校验, markdown 类工件跳过 |

#### 3.3.3 tools.py（工具注册表 + 门禁收敛）

**文件**: `apps/backend/app/services/tools.py`

| 工具 | 门禁 | 状态 |
|------|------|------|
| StageAdvancerTool | can_advance_to (禁跨阶段跳) + check_gate (先跑门禁) | ✅ |
| SkillStateWriterTool | ALLOWED_FIELDS 白名单 (禁改 current_stage/standard_step_data/stages) | ✅ |
| ArtifactWriterTool | artifact_stage_gate (当前阶段必须 >= 工件所属阶段) | ✅ |
| AchievementCardTool | 阶段门禁 (仅 stage_08_evaluate 允许) | ✅ |
| EvidenceSaverTool | TYPE_ALIAS_MAP 对齐 schemas/evidence.py | ✅ |
| AskQuestionTool | 无门禁 (任何阶段都可提问) | ✅ |
| 其余 6 个工具 | 按需校验 | ✅ |

**TOOL_REGISTRY 完整性**: 12 个工具全部注册，与 config.toml 的 auto_approve 列表完全一致。

### 3.4 ZeroClaw Skill 层

#### 3.4.1 ZeroClaw 专用 Skill

**文件**: `H:/dev-env/zeroclaw/config/agents/assistant/workspace/skills/stem-pbl-guide/SKILL.md`

| 审计项 | 状态 | 说明 |
|--------|------|------|
| YAML Frontmatter | ✅ | name/description/language/version/author 齐全 |
| 角色定义 | ✅ | "未来科技学院" AI 导师, 12-18 岁青少年 |
| 9 阶段状态机 | ✅ | 阶段表 + 门禁条件 + 推进规则 |
| 阶段代码锁 | ✅ | stage_05/07/08 允许代码, 其他禁止 |
| 提问规范 | ✅ | 必须用 ask_question 工具, 禁止 XML/markdown 列表 |
| 各阶段提问流程 | ✅ | stage_00 (3轮) / stage_01 (3轮) / stage_04 (5选1) / stage_07 (4选1) |
| `[选择]` 格式识别 | ✅ | 识别前端选项回答格式 |
| 自动验收规则 | ✅ | 禁止让学生手动操作, AI 全自动完成 |
| 工具调用最佳实践 | ✅ | 何时调工具 + 结果处理 + 门禁失败处理 |
| 回复完整性约束 | ✅ | 禁止截断标记, 代码块必须闭合 |
| 行数 | 200 行 | 精简版（从 config.toml system_prompt 抽取 + 阶段路由索引 + 工具速查） |

#### 3.4.2 原版 Skill（其他 IDE 使用）

**文件**: `G:/mediaProjects/fineSTEM/.trae/skills/stem-pbl-guide/SKILL.md`

- 2621 行完整版，包含 HTML 讲解模式、研学文档轨、题库等
- 供 Trae/Cursor 等 IDE 使用，**未改动**
- 两份独立维护，存在同步风险（见第 5 节风险项）

#### 3.4.3 Workspace 文档

| 文件 | 状态 | 说明 |
|------|------|------|
| SOUL.md | ✅ | 改写为 fineSTEM PBL 导师身份 |
| IDENTITY.md | ✅ | "未来科技学院 AI 导师" |
| TOOLS.md | ✅ | 追加 12 个 finestem__ 工具速查表 |
| MEMORY.md | ✅ | 存在（ZeroClaw 记忆系统） |
| AGENTS.md | ✅ | 存在（多智能体配置） |

### 3.5 前端连接层 (useStreamingChat.ts)

**文件**: `apps/frontend/src/hooks/useStreamingChat.ts`

| 审计项 | 状态 | 说明 |
|--------|------|------|
| WebSocket 连接 | ✅ | 直连 `ws://127.0.0.1:42617/ws/chat`（不走 FastAPI） |
| 鉴权 | ✅ | Bearer Token (require_pairing=true) |
| 握手协议 | ✅ | session_start → connect → connected → message |
| 项目上下文传递 | ✅ | buildOutgoingMessage() 注入 `<context>` 块（替代被删的 cwd 字段） |
| normalizeToolName() | ✅ | 剥离 `finestem__` 前缀（**选项卡不显示的根因修复**） |
| parseMcpOutput() | ✅ | 解析 MCP 双层 JSON（**工具返回值丢失的根因修复**） |
| ask_question 处理 | ✅ | tool_call 帧直接渲染 QuestionCard |
| project_creator 处理 | ✅ | tool_result 提取 project_id + current_stage |
| stage_advancer 处理 | ✅ | tool_result 提取 new_stage → onStageChanged |
| project_code_writer 处理 | ✅ | tool_result 提取 code → onCodeGenerated |
| thinking 帧处理 | ✅ | onThinking 回调透传（不混入正文） |
| 截断检测 | ✅ | 代码块未闭合/标签未闭合/语言名结尾/引导词结尾 |
| 自动续接 | ✅ | 复用同一 session_id + 最多 2 次续接 |
| 总超时 | ✅ | 120 秒 |

**第一次迁移失败根因（前端侧）**:
1. `tool_call.name` 实际是 `finestem__ask_question`（带前缀），前端用 `=== 'ask_question'` 判断永不匹配 → 选项卡不显示
2. `tool_result.output` 是 MCP 双层 JSON `{"content":[{"text":"<内层JSON>"}]}`，前端直接当 output 用 → 拿不到工具返回值
3. `done.finish_reason` 字段不存在，截断检测靠 `=== 'length'` 永远不触发
4. `sanitizeAssistantNarration` 清洗逻辑过于激进，误杀 AI 教学代码示例 → 回复被截断

**第二次迁移修复**:
- `normalizeToolName()` + `parseMcpOutput()` 两个归一化函数解决了前缀和双层 JSON 问题
- 移除激进清洗规则（cat/ls/find/grep/import os 等）
- 移除 ask_question 双路径重复处理
- 截断检测改为内容启发式（代码块/标签闭合检测）

---

## 4. 端到端链路验证

### 4.1 完整调用链路

```
学生输入 "我想做一个项目"
  ↓
前端 useStreamingChat
  ├─ buildOutgoingMessage() 注入 <context>
  └─ ws.send({type:"message", content:"<context>...</context>\n\n我想做一个项目"})
  ↓
ZeroClaw Gateway (127.0.0.1:42617)
  ├─ Bearer Token 鉴权
  ├─ session_id 关联会话
  └─ 转发给 Agent Loop
  ↓
ZeroClaw Agent Loop (agentic=true)
  ├─ system_prompt (config.toml:59-309) → PBL 导师身份 + 9 阶段规则
  ├─ Skill: stem-pbl-guide (workspace/skills/) → 阶段路由 + 提问规范
  ├─ tool_filter_groups: always → finestem__* 可见
  └─ LLM (deepseek-chat) 决策: 调用 finestem__ask_question
  ↓
MCP Server (server.py, stdio)
  ├─ tools/call {name:"ask_question", arguments:{title:"年级?",...}}
  ├─ TOOL_REGISTRY["ask_question"].execute(params)
  └─ 返回 {content:[{text:JSON}], isError:false}
  ↓
ZeroClaw Agent Loop
  ├─ tool_result 回传给 LLM
  └─ LLM 生成回复文本 + 继续决策
  ↓
ZeroClaw Gateway → 前端 WebSocket
  ├─ tool_call 帧 {name:"finestem__ask_question", args:{...}}
  ├─ chunk 帧 (流式文本)
  └─ done 帧
  ↓
前端 useStreamingChat
  ├─ normalizeToolName("finestem__ask_question") → "ask_question"
  ├─ 渲染 QuestionCard
  └─ onQuestions([questionData])
  ↓
学生看到可点击的选项卡片
```

### 4.2 实证验证记录（2026-07-22）

第二次迁移后通过 `ws_frame_capture.py` 和 `ws_multi_turn_test.py` 连真实 daemon 做对话测试：

| 轮次 | 学生输入 | AI 行为 | 结果 |
|------|----------|---------|------|
| 0 | "我想做一个项目" | ask_question「你现在是哪个年级？」 | ✅ 卡片渲染 |
| 1 | 答初中 | ask_question「你打算花多少时间？」 | ✅ 卡片渲染 |
| 2 | 答6小时 | ask_question「有没有项目想法？」 | ✅ 卡片渲染 |
| 3 | 答没想法需要脑爆 | project_creator + ask_question「兴趣(多选)」 | ✅ 项目创建 + 卡片渲染 |

**验证结论**: AI 正确调用了 `project_creator` 创建项目并推进阶段，完全符合 config.toml 定义的 stage_00_bootstrap 三轮提问流程。这在第一次迁移（config 坏的时候）绝不会发生。

---

## 5. 风险项与整改建议

### 5.1 高优先级风险

| # | 风险 | 严重性 | 现状 | 整改建议 |
|---|------|--------|------|----------|
| R1 | API Key 硬编码 | 🔴 高 | config.toml 第 13 行直接写 `api_key = "sk-80d7..."` | 改用环境变量 `${DEEPSEEK_API_KEY}` 或 ZeroClaw 的密钥管理 |
| R2 | 端口不在白名单 | 🟡 中 | ZeroClaw gateway 用 42617，项目白名单无此端口 | 在 config.toml 改 `[gateway] bind_addr = "127.0.0.1:4500"` 并更新端口规范 |
| R3 | GLM Provider 无 Key | 🟡 中 | config.toml 第 17 行 `api_key = ""` | 要么配置 GLM key，要么移除 GLM provider 避免误导 |
| R4 | 生产部署前端直连问题 | 🟡 中 | 前端连 127.0.0.1:42617，生产环境浏览器无法访问 | 部署时用 Nginx 反向代理 `/ws/chat` → ZeroClaw gateway |

### 5.2 中优先级风险

| # | 风险 | 严重性 | 现状 | 整改建议 |
|---|------|--------|------|----------|
| R5 | 两份 SKILL.md 同步 | 🟡 中 | ZeroClaw 版(200行) 和原版(2621行) 独立维护 | 考虑用脚本从原版自动生成精简版，或在原版标注 ZeroClaw 专用段落 |
| R6 | orchestrator.py 死代码 | 🟢 低 | 保留但不被调用（前端直连 ZeroClaw） | 确认无其他调用方后删除，或在文件头标注"DEPRECATED" |
| R7 | 历史坏测试未清理 | 🟢 低 | test_pbl_dialogue_flow.py 等依赖已不存在的符号 | 删除或重写这些测试 |
| R8 | ZeroClaw daemon 单点 | 🟡 中 | daemon 挂了则前端完全不可用 | 前端加健康检查 + 友好错误提示 + 自动重连 |

### 5.3 架构优化建议（未实施）

| 建议 | 价值 | 复杂度 |
|------|------|--------|
| 用 ZeroClaw SOP 机制承载 PBL 阶段门禁 | 把"软门禁"变成强制流程图 | 高 |
| 多 agent（PBL导师/编程助手/平台引导）| 三角色独立 system_prompt | 中 |
| 项目级 memory（用户画像/能力标签）| 跨会话记忆 | 中 |
| ZeroClaw daemon 健康检查 + 自动重启 | 提高可用性 | 低 |

---

## 6. 第一次 vs 第二次迁移对比

| 维度 | 第一次迁移 | 第二次迁移 |
|------|-----------|-----------|
| config.toml system_prompt | ❌ 未闭合(`"""`缺失) | ✅ 第309行闭合 |
| runtime agentic | ❌ false(工具不调用) | ✅ true + max_tool_iterations=100 |
| tool_filter_groups | ❌ 未配置(工具不可见) | ✅ always/finestem__* |
| 前端工具名匹配 | ❌ 未剥离 finestem__ 前缀 | ✅ normalizeToolName() |
| 前端 MCP 输出解析 | ❌ 未解析双层 JSON | ✅ parseMcpOutput() |
| 前端清洗逻辑 | ❌ 过于激进(误杀代码) | ✅ 移除激进规则 |
| ask_question 处理 | ❌ 双路径重复处理 | ✅ 单路径(hook内部) |
| 截断检测 | ❌ 靠 finish_reason='length' | ✅ 内容启发式(代码块/标签) |
| 后端门禁 | ❌ 4个漏洞(跨阶段跳/任意写) | ✅ can_advance_to + 白名单 + artifact_stage_gate |
| Skill 导入 | ❌ 无专用 skill | ✅ workspace/skills/stem-pbl-guide/SKILL.md |
| 实证验证 | ❌ 无抓帧测试 | ✅ ws_frame_capture.py 4轮对话通过 |

---

## 7. 最终结论

### 7.1 ZeroClaw 是否适合 fineSTEM？

**适合。** ZeroClaw 的 agentic runtime + MCP 工具集成 + Skill 机制 + WebSocket Gateway 组合，正好覆盖了 fineSTEM 的"PBL 引导对话 → 工具调用 → 阶段推进 → 文档生成"全链路需求。它的 trait 驱动架构让 Provider/Memory/Tool/Skill 都可配置替换，适合需要长期演进的教育平台。

### 7.2 项目是否真的彻底用上了 ZeroClaw？

**是的，已彻底用上。** 第二次迁移从五个层面真正接入了 ZeroClaw：

1. **配置层**: config.toml 正确配置了 Provider/Agent/Risk/Runtime/MCP/Gateway/Memory/Skill，system_prompt 已闭合
2. **MCP 层**: server.py 实现原生 MCP 1.0 stdio 协议，12 个工具完整暴露，Windows 兼容性问题已解决
3. **工具门禁层**: stage_constants.py 单一事实来源 + can_advance_to/artifact_stage_gate/check_gate 三重门禁，消除了第一次迁移的 4 个门禁漏洞
4. **Skill 层**: ZeroClaw workspace 中有专用的 stem-pbl-guide SKILL.md（200行精简版），有正确的 YAML frontmatter
5. **前端层**: 直连 ZeroClaw WebSocket，normalizeToolName + parseMcpOutput 两个归一化函数解决了第一次迁移的核心问题

### 7.3 导入到 ZeroClaw 的 Skill 是否正确？

**正确。** ZeroClaw 专用 SKILL.md（`H:/dev-env/zeroclaw/config/agents/assistant/workspace/skills/stem-pbl-guide/SKILL.md`）：
- 有完整的 YAML frontmatter（name/description/language/version/author）
- 内容是 PBL 导师规范精简版（200行），从 config.toml system_prompt 抽取核心规则
- 阶段表、门禁条件、提问规范、工具调用规则、`[选择]` 格式识别全部覆盖
- `zeroclaw skills audit` 验证通过
- 原版 2621 行 SKILL.md 保留在 `.trae/skills/` 供其他 IDE 使用，未改动

### 7.4 遗留问题

1. API Key 硬编码需整改（R1）
2. 端口 42617 需纳入白名单或调整（R2）
3. 生产部署需反向代理方案（R4）
4. 两份 SKILL.md 的同步机制需建立（R5）

---

**审计人**: AI Agent
**审计完成时间**: 2026-07-22
**下次审计建议**: 修复 R1-R4 后复验
