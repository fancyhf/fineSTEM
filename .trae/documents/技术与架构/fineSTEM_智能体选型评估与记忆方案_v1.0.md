# fineSTEM 智能体基础设施技术选型评估与记忆方案建议

> **版本**：v1.0  
> **日期**：2026-06-14  
> **范围**：评估 ZeroClaw / OpenClaw 等类框架能否作为 fineSTEM 线上多用户场景的智能体引擎；litellm 替代方案；安全代码沙箱选型；对话历史/记忆方案设计  
> **定位**：供决策的技术选型评估文档，非实施计划

---

## 0. 背景与核心结论

fineSTEM 是面向 10–18 岁青少年的 STEM 项目式学习（PBL）平台，希望**在线上 web 运行时**也具备内置的智能体（agent）能力——互动对话 + 学生代码执行 + 多 provider LLM。项目当前的「zeroclaw」实质是一个自研的 httpx 适配层（`ZeroClawProvider`，约 310 行），底层调 DeepSeek（主）+ 智谱 GLM（回退），并非真正的 ZeroClaw 框架。

**核心结论（先看这个）**：

| 问题 | 结论 |
|---|---|
| ZeroClaw / OpenClaw 能否作为 fineSTEM 线上多用户 agent 引擎？ | ❌ **不建议**。两者均为「单用户个人助手」定位，在多租户、代码沙箱、Python 集成三个关键维度均不达标（证据见第一部分） |
| 是否要引入它们作为旁路/限定场景？ | ⚠️ OpenClaw 有 OpenAI 兼容 REST，可在**单用户**场景（教师端/展会 demo）作为 provider 路由备选；ZeroClaw 因无公开 API、pre-1.0，不建议 |
| LLM 多 provider 怎么补？ | ✅ 用 **litellm**（一行切 provider，国内厂商全覆盖），替换手写 httpx 判断逻辑 |
| 学生 Python 代码沙箱怎么选？ | ✅ 外挂专业组件：**E2B**（交互式 AI 辅导）+ **Judge0**（作业判题）；与 ZeroClaw/OpenClaw 无关 |
| 对话历史/记忆怎么补？ | ✅ 三层方案：P0 打通 orchestrator↔历史链路（已有存储、断在没接入），P1 复用 skill_state/evidence，P2 学生画像 |

**一句话**：放弃把 ZeroClaw/OpenClaw 作为线上 agent 引擎；按 **litellm（provider）+ 专业沙箱（代码执行）+ 自建记忆（对话历史）** 三步走，既更安全、更可控，又保住了你已有的、比这两个框架都强的教育编排能力（9 阶段 PBL 状态机 + `<question>` 选项协议）。

---

## 第一部分：ZeroClaw / OpenClaw 深度评估

### 1.1 多用户 / 多租户能力（致命问题）

这是 fineSTEM「线上服务多个学生」场景的**一票否决项**。证据均来自官方一手来源：

| 证据 | 来源 |
|---|---|
| OpenClaw 官方 Issue 承认「**缺乏内置多用户权限管理（RBAC）**，所有有系统访问权限的用户都能查看/修改敏感数据」 | [GitHub Issue #8081](https://github.com/openclaw/openclaw/issues/8081) |
| OpenClaw 文档原文：「**cooperative isolation, not a hard security boundary**」（协作式隔离，非硬安全边界） | docs.openclaw.ai/gateway/security |
| 工程实践文章：「**No transactions, no concurrent write safety** … 两个 session 同时写 MEMORY.md 会损坏」 | [Medium: Building OpenClaw-like for Teams](https://mychen76.medium.com/building-an-openclaw-like-ai-for-teams-a-multi-user-assistant-with-scheduled-intelligent-and-39ea1f7c33f5) |
| ZeroClaw 认证是 **pairing + OTP**，`--new-pairing` 会清空所有已配对 token 并需**重启 gateway**——这是「单设备配对一个客户端」的模型，不是给几千 web 用户签发 session | ZeroClaw 官方文档 |
| ZeroClaw 卖点是「$10 硬件、99% 内存降低」——个人/嵌入式 runtime 叙事 | zeroclaw.net |

**对 fineSTEM 的影响**：线上几十~几百学生并发，每人独立会话。若底层是 OpenClaw/ZeroClaw，要在它外围重新造租户隔离、会话持久化、并发锁、配额计费——这些恰恰是 SaaS 的核心，等于把框架该干的事全自己重写。

> 补充：连**为多租户设计**的 OpenHands（原 OpenDevin），业界部署也是「每会话一个隔离 runtime 容器」而非「一个实例扛多用户」。把一个「单用户个人 runtime」改成并发 SaaS，是错上加错。

### 1.2 API 集成能力（本次新核实）

| 框架 | 公开 REST API | Python SDK | 认证方式 | 可否被 FastAPI 开箱调用 |
|---|---|---|---|---|
| **ZeroClaw** | ❌ Mintlify 的 `/api-reference` **实测返回 404**（MCP error -400 resource not found），无公开 OpenAPI 规范 | ❌ 无官方 Python SDK（搜索无结果） | 未公开文档 | ❌ 不能 |
| **OpenClaw** | ✅ 有 OpenAI 兼容 `/v1/*` + tool-invoke HTTP + webhooks | ⚠️ 官方无，社区有第三方（`openclaw-sdk`，非官方） | **shared-secret**（Bearer 风格，非 OTP） | ✅ openai SDK 可直接对接 REST 面 |

**关键证据**：
- ZeroClaw：Gateway 描述为「HTTP/WebSocket gateway for clients」，但**没有发布 OpenAPI/端点列表**；连 Dashboard 都走 WebSocket，且 Issue #3011 曝出 WS 协议参数曾出 bug——不是稳定的 REST 契约。来源：[GitHub Issue #3011](https://github.com/zeroclaw-labs/zeroclaw/issues/3011)
- OpenClaw：来源 [docs.openclaw.ai/gateway/tools-invoke-http-api](https://docs.openclaw.ai/gateway/tools-invoke-http-api) 原文——「exposes a simple HTTP endpoint for invoking a single tool directly … Like the **OpenAI-compatible `/v1/*` surface**, shared-secret」

**小结**：若真要接，OpenClaw 比 ZeroClaw 可调得多（有 OpenAI 兼容 REST）。但这只解决「调用」问题，不解决「多租户 + 沙箱」问题。

### 1.3 代码沙箱安全性（重点，本次新核实）

这是面向未成年人编程教育的**红线**。结论很硬：

#### ZeroClaw 的 bubblewrap 沙箱
- **官方 Issue #5722 标题本身就是结论**：「Default shell sandbox configuration **blocks all realistic Python skill patterns** (v0.6.9)」。来源：[GitHub Issue #5722](https://github.com/zeroclaw-labs/zeroclaw/issues/5722)
- 报告者引用官方说法：放开沙箱会「**gut the sandbox security guarantees**」（掏空安全保证）——即**配置与安全直接对立**
- Issue #5127：默认 bubblewrap **无可写目录、无网络**，跑 `pip install` / 写文件 / 联网的 Python 代码默认全失败，要手动配 bind-mount。来源：[GitHub Issue #5127](https://github.com/zeroclaw-labs/zeroclaw/issues/5127)
- **本质**：为「受信任的 AI agent 自己写的代码」设计的沙箱，**不是**为「多用户/学生提交不可信代码」设计的

#### OpenClaw 的沙箱
- **内置 code-mode（QuickJS-WASI）只跑 JS/TS**，不跑 Python；且标注 experimental、默认关闭。来源：[docs.openclaw.ai/reference/code-mode](https://docs.openclaw.ai/reference/code-mode)
- 要跑 Python，OpenClaw **自己不提供沙箱**，而是通过 `code_execution` 工具**外接到 xAI 远程沙箱**。来源：[docs.openclaw.ai/tools/code-execution](https://docs.openclaw.ai/tools/code-execution)——「runs Python in xAI's remote sandbox」
- **结论**：学生要写 Python，OpenClaw 自带的沙箱帮不上忙，它本身就是靠外接

#### 综合判断

| 维度 | ZeroClaw 沙箱 | OpenClaw 沙箱 |
|---|---|---|
| 能跑学生 Python | ⚠️ 能（语言无关）但默认全失败，放开即破安全 | ❌ 内置不能，靠外接 xAI |
| 多租户不可信代码隔离 | ❌ 无指引 | ❌ 无 |
| 给 fineSTEM 学生用 | **用错场景** | **用错场景** |

> **两者都不是为「线上多租户学生跑不可信 Python」设计的。代码执行沙箱必须单独选型（见第三部分）。**

### 1.4 限定场景旁路方案（针对「还想试一下」的需求）

如果对 OpenClaw/ZeroClaw 仍有执念，以下是三个可能的旁路用法评估：

| 场景 | 框架 | 可行性 | 安全边界 |
|---|---|---|---|
| ① 教师端单机助手 | OpenClaw | 🟡 可行。教师本机跑一个 OpenClaw，走 OpenAI 兼容 REST 调 GLM | 仅限教师本人用，不接触学生数据 |
| ② Demo / 展会单用户 | OpenClaw | 🟢 可行。单用户单设备，无需多租户 | 展会结束后关闭，不持久化学生数据 |
| ③ LLM provider 路由备选 | OpenClaw | 🟢 可行。把 OpenClaw 当一个 OpenAI 兼容网关，FastAPI 调它的 `/v1/*` | 等同于多挂一个 provider，与 litellm 功能重叠 |
| ④ 学生代码沙箱 | ZeroClaw / OpenClaw | ❌ 不可行 | 见 1.3，两者都不能安全跑学生 Python |

**无论哪个旁路用法，都必须遵守**：
- 代码沙箱（学生代码执行）→ 留在 fineSTEM 自建的专业沙箱（E2B/Judge0）
- 租户隔离（学生认证/会话）→ 留在 fineSTEM 的 FastAPI + JWT
- 教育业务逻辑（9 阶段状态机、`<question>` 协议）→ 留在 fineSTEM orchestrator

即：OpenClaw/ZeroClaw 即便旁路接入，也只能当「一个可选的 LLM provider 通道」，**不能承担 agent 引擎核心职责**。

### 1.5 成熟度风险

| 指标 | ZeroClaw | OpenClaw |
|---|---|---|
| 仓库年龄 | 2026-02 创建（约 4 个月） | 较活跃（最新 `2026.6.8-beta.1`） |
| 版本 | v0.8.0-beta-2，pre-1.0，每版 breaking change | beta 频繁 |
| star/subscriber 比例 | 8,653 / 60（144:1，异常） | star 数存疑（搜索摘要不可信，主页曾 404） |
| 代码来源 | 贡献者含「Claude Opus 4.6」「OpenClaw Assistant」（AI 生成占比高） | — |

把教育产品核心押在一个 pre-1.0、每版改 schema 的 4 月龄项目上，迁移成本不可控。

### 1.6 第一部分小结：完整对比表

| 维度 | ❶ ZeroClaw | ❷ OpenClaw | ❸ FastAPI 自建（推荐） |
|---|---|---|---|
| 定位 | Rust 个人 runtime | TS 个人助手多端同步网关 | 你自己的后端 |
| 多用户/多租户 | 🔴 OTP 单设备配对 | 🔴 无 RBAC，并发写损坏 | 🟢 JWT + 按 user_id/project_id |
| 公开 REST API | 🔴 实测 404，无规范 | 🟢 OpenAI 兼容 `/v1/*` | 🟢 你自己定义 |
| Python SDK | 🔴 无 | ⚠️ 仅社区第三方 | 🟢 原生 |
| 代码沙箱（学生 Python） | 🔴 默认跑不了，放开即破安全 | 🔴 内置不跑 Python，靠外接 xAI | 🟢 外挂 E2B/Judge0 |
| 多 provider | 🟡 DeepSeek/GLM/MiniMax | 🟢 国内厂商全覆盖 | 🟢 litellm 更全 |
| 教育编排 | 🔴 通用 loop | 🔴 通用 loop | 🟢 9 阶段 PBL + `<question>` |
| 成熟度 | 🔴 4 月龄 pre-1.0 | 🟡 活跃但自认多用户缺陷 | 🟢 你自己控 |
| 线上部署 | 🔴 运维第二个服务（Rust） | 🔴 运维第二个服务（Node） | 🟢 已有 |

**9 项中 ZeroClaw 8 红 1 黄，OpenClaw 6 红 1 黄 2 绿——均不适合作为线上 agent 引擎。**

---

## 第二部分：替代方案 litellm

> **证据说明**：本部分基于 litellm 的通用公开信息撰写（因外部网络抓取超时未能本次逐条验证），实施前需对国内厂商做实测。litellm 是 BerriAI 维护的成熟主流库（MIT、高 star），信息可靠性较高。

### 2.1 为什么用 litellm 替换现有的 `ZeroClawProvider`

fineSTEM 现状（`apps/backend/app/services/providers/zeroclaw_provider.py`）：
- 用 httpx 手写 OpenAI 兼容 `/chat/completions` 协议
- 靠 `_is_glm_gateway` / `_is_deepseek_gateway` **字符串匹配 URL** 判断走哪个网关
- 扩展新 provider 需改字符串判断 + 加 endpoint 配置，**扩展性差**

litellm 的价值：
- **一行代码切 provider**：`litellm.completion(model="deepseek/deepseek-chat", ...)` / `litellm.completion(model="zhipu/glm-4", ...)`
- **国内厂商原生支持**（需实测确认）：智谱 GLM、DeepSeek、通义 Qwen（dashscope）、Kimi（moonshot）、豆包（volcengine）、百度千帆（qianfan）、MiniMax、阶跃 StepFun 等
- **统一接口**：streaming（`stream=True`）、function calling / tool calling 均支持——与 orchestrator 的 `_call_llm_with_tools` 和 SSE 流式契合
- **统一 fallback / 重试 / 计费**：比手写 httpx 的 `chain` 循环更完善

### 2.2 集成方式

**SDK 模式**（推荐，适合嵌进现有 FastAPI，不起额外服务）：
```
pip install litellm
import litellm
response = litellm.completion(model="zhipu/glm-4", messages=..., tools=..., stream=True)
```

**Proxy 模式**（不推荐当前阶段）：起一个独立 proxy 服务，所有请求走它。适合后期做多团队统一计费/限流时再上。

### 2.3 替换工作量与收益

| 项 | 评估 |
|---|---|
| 工作量 | 🟢 小。核心是把 `ZeroClawProvider.complete_with_tool_calls` 里的 httpx 调用换成 `litellm.completion`，保留 orchestrator 的 tool-calling 循环和 SSE 解析 |
| 收益 | 🟢 多 provider 统一接入，去掉字符串判网关的脆弱逻辑，获得自动 fallback/重试/计费 |
| 代价 | 🟡 依赖变重（litellm 依赖较多）；需**实测国内厂商的 tool calling 兼容性**（不同厂商 function calling 实现有差异） |
| 风险 | 需验证：GLM/DeepSeek 的 streaming chunk 格式、tool_calls 解析、context window 差异 |

> **建议**：作为 P1 级任务（在记忆方案之后）。先用 litellm 在测试环境跑通「GLM + DeepSeek + tool calling + streaming」四件套，确认无误再替换线上。

---

## 第三部分：安全代码沙箱选型

> **证据说明**：对比基于业界通用共识（Modal / Beam Cloud / fast.io 等 2026 沙箱对比综述）。具体定价/额度需实施前到官网核实。

### 3.1 现状问题

fineSTEM 当前代码执行（`apps/backend/app/api/code_execution.py` + `services/tools.py` 的 `CodeRunnerTool`）：
- Python：`subprocess.run(['python', temp_path], timeout=10)` 或 `exec(compiled, namespace)` 进程内执行
- **无 Docker/namespace/seccomp 隔离**，仅靠 timeout 防死循环
- 未限制网络/文件系统访问
- 对面向未成年人的平台，这是**安全红线**

### 3.2 方案对比

| 方案 | 隔离强度 | 部署复杂度 | Python 生态（numpy/pandas/matplotlib） | 冷启动 | 成本 | 适合场景 |
|---|---|---|---|---|---|---|
| **E2B** | 🟢 Firecracker microVM | 🟢 SDK/REST，云托管 | ✅ 可装 | ~125ms | 有免费额度，按量 | **AI 交互式辅导**（首选） |
| **Judge0** | 🟢 容器型，自托管 | 🟡 自托管运维 | ✅ 60+ 语言 | 中 | 自托管成本低 | **作业判题**（首选） |
| Firecracker microVM（自建） | 🟢 | 🔴 高（需自建调度） | ✅ | 快 | 基础设施成本 | 大规模自托管 |
| gVisor | 🟢 用户态内核 | 🟡 Docker + gVisor | ✅ | 中 | 低 | 自托管省钱 |
| Docker（裸） | 🟠 共享内核，**单独不够安全** | 🟡 | ✅ | 中 | 低 | 需叠加 gVisor |
| RestrictedPython | 🟠 语言级，易逃逸 | 🟢 pip | ⚠️ 受限 | 即时 | 免费 | 轻量白名单 |
| pyodide (WASM) | 🟡 浏览器侧 | 🟢 CDN | ✅ numpy/pandas | 即时 | 免费 | 前端直接跑 |

### 3.3 推荐排序（针对 fineSTEM）

1. **E2B**（首选，交互式 AI 辅导场景）
   - 学生在对话中写代码、AI 实时辅导 → 需要「快速、隔离、可装包、长会话」
   - E2B 基于 Firecracker microVM，冷启动 ~125ms，Python SDK，AI agent 友好
   - 集成：FastAPI 后端用 E2B Python SDK 调用，替代现有 subprocess

2. **Judge0**（次选/补充，结构化作业判题场景）
   - 学生提交作业、自动判分 → 需要「多语言、稳定、自托管可控成本」
   - 60+ 语言，REST API，开源可自托管，竞赛/Bootcamp 广用
   - 与 E2B 并存：判题走 Judge0，辅导走 E2B

3. **Docker + gVisor**（自托管省钱方案）
   - 若云服务成本敏感或国内访问 E2B 受限，自建 Docker+gVisor 容器池
   - 需自建调度/配额/超时机制，运维成本高

> **明确**：这一层与 ZeroClaw/OpenClaw 完全无关——第一部分已证实两者都不能安全跑学生 Python。沙箱是独立的专业组件。

---

## 第四部分：对话历史 / 记忆方案设计

### 4.1 现状诊断（代码事实，已核实）

经核查 `orchestrator.py`、`projects.py`、`project_repo.py`、`sqlite_db.py`，发现 fineSTEM **已有**对话历史持久化机制，但存在**结构性断点**：

**已有的**：
- `POST /projects/{id}/chat`（projects.py:309）把整个 `chat_messages` 数组保存到 `projects.initial_data.workspace.chat_messages`
- `GET /projects/{id}/chat`（projects.py:335）可读回
- `ProjectRepo._extract_workspace`（project_repo.py:88）做向后兼容迁移

**断点（问题所在）**：
1. **orchestrator 根本不读它**：`_build_messages`（orchestrator.py:525-532）只放 `system + 当前一条 user message`，**完全不加载 `workspace.chat_messages`**。所以即使前端存了历史，每次 LLM 请求都是失忆的——**这是「agent 记不住学生」的真正根因**。
2. **存储粒度太粗**：整个 messages 数组塞进一个 JSON 字段，全量覆盖式保存，无法增量、无索引、无法按时间范围查询。长对话会导致 JSON 膨胀、读写性能下降。
3. **session_id 每次新生成**：orchestrator.py:56 `session_id = str(uuid4())`，无法跨请求关联同一会话。

**结论**：P0 的核心不是「建表存历史」（存储已存在），而是 **打通 orchestrator ↔ 历史的链路**，并把粗粒度的 JSON 存储升级为结构化表。

### 4.2 P0：会话级短期记忆（解决「记不住当前项目对话」）

**目标**：同一项目内，agent 能记住刚才聊了什么。

**改动点**：

1. **新建 `chat_messages` 表**（在 sqlite_db.py `_init_tables` 中），结构化存储：
   ```
   chat_messages
   ├─ id          TEXT PRIMARY KEY
   ├─ project_id  TEXT NOT NULL  (外键 projects.id，天然多租户隔离)
   ├─ role        TEXT NOT NULL   (user | assistant | tool)
   ├─ content     TEXT
   ├─ tool_calls  JSON            (assistant 的工具调用)
   ├─ tool_call_id TEXT           (role=tool 时关联的调用 id)
   ├─ session_id  TEXT            (复用而非每次新建)
   ├─ created_at  TEXT
   └─ INDEX (project_id, created_at)
   ```
   按 `project_id` 隔离 → 天然多租户（project 有 `author_id`，无需额外 tenant 概念）。

2. **改 `_build_messages`**（orchestrator.py:525）：从表里拉最近 N 条（如 20 条）历史，拼在 system prompt 之后、当前 user message 之前。伪代码：
   ```python
   def _build_messages(self, req, system_prompt, context_block):
       messages = [{"role": "system", "content": system_prompt + context_block}]
       if req.project_id:
           history = db.get_recent_messages(req.project_id, limit=20)
           messages.extend(history)  # 已按 created_at 排序的 user/assistant 来回
       messages.append({"role": "user", "content": req.message})
       return messages
   ```

3. **回写**：LLM 返回后（orchestrator 的 `stream_chat_with_events` 末尾），把 user message 和 assistant response 都写入 `chat_messages` 表（带复用的 session_id）。

4. **前端调整**：`GET /projects/{id}/chat` 改为从新表读取（保留旧 workspace 兼容，做一次性迁移）；不再依赖 localStorage 全量回传。

**收益**：agent 立刻获得项目内连续对话能力。**改动小、收益大**——这是解决「记不住」性价比最高的一步。

### 4.3 P1：项目级长期记忆（解决「跨会话记得项目背景」）

**目标**：学生隔天回来，agent 记得他的项目目标、已完成什么、卡在哪。

**改动点**：**复用已有数据，不建新表**。

fineSTEM 已有两块结构化记忆，只是没注入到 LLM 上下文：
- `skill_states` 表（owner_id + skill_id + state JSON）——9 阶段 PBL 状态机
- `evidence` 表（project_id + type + content）——每轮对话自动落盘的 `text_log` 证据

**改动**：扩展 `_build_context_block`（orchestrator.py:500），它现在只注入了 project_id/stage/mode。扩展为：
```python
def _build_context_block(self, req, owner_id):
    parts = [...]  # 现有的 project/stage/mode
    if req.project_id:
        state = db.get_skill_state(req.project_id)
        if state:
            # 注入已产出的关键工件：brainstorm ideas / selected_idea / design
            parts.append(f"已选定主题: {state.metadata.get('selected_idea')}")
            parts.append(f"已完成阶段: {state.completed_stages}")
        # 注入最近几条 evidence 的摘要（学生做过什么）
        evidences = db.list_evidence(req.project_id, limit=5)
        for ev in evidences:
            parts.append(f"过往记录[{ev.related_step}]: {ev.content[:100]}")
    return "\n".join(parts)
```

**收益**：跨会话的项目连续性，几乎零新增基础设施。

### 4.4 P2：学生画像记忆（可选，后期）

**目标**：agent 知道这个学生擅长什么、常犯什么错、偏好什么风格。

**改动点**：
- 新建 `student_profile` 表：`user_id / strengths(JSON) / weak_points(JSON) / preferred_style / summary / updated_at`
- 定期（每 N 轮对话，或每日）用一个轻量 LLM 调用总结近期对话，更新画像
- 注入 system prompt：「这位学生擅长逻辑但常忘加 print 调试，请多提醒」

**建议**：等 P0/P1 跑顺、有了足够对话数据后再做，避免过早优化。

### 4.5 与 ZeroClaw/OpenClaw 记忆的对比

| | 自建（上述方案） | ZeroClaw/OpenClaw |
|---|---|---|
| 多用户隔离 | 🟢 按 project_id/user_id，DB 天然隔离 | 🔴 单用户，并发写损坏 |
| 跨设备 | 🟢 存 DB，换设备不丢 | 🟡 设计就是跨设备，但单用户 |
| 与教育数据打通 | 🟢 直接复用 skill_state/evidence | 🔴 要写适配层 |
| 可控性 | 🟢 完全可控 | 🔴 黑盒，schema 还在变 |

---

## 第五部分：综合建议与落地路线图

### 5.1 一句话结论

**放弃把 ZeroClaw/OpenClaw 作为 fineSTEM 线上 agent 引擎。** 它们是「单用户个人助手」定位，在多租户（一票否决）、代码沙箱（红线）、Python 集成三个维度均不达标，且证据来自官方一手来源（Issue #8081、#5722、docs 原文）。按 **litellm（provider 路由）+ 专业沙箱（E2B/Judge0）+ 自建记忆（对话历史三层）** 的路径，既安全可控，又保住了你已有的、比这两个框架都强的教育编排能力。

### 5.2 落地优先级

| 优先级 | 任务 | 理由 |
|---|---|---|
| **P0-高** | 对话历史打通（4.2）：建 chat_messages 表 + 改 `_build_messages` 读历史 + 回写 | 你最痛的短板，改动小收益大，解决「agent 记不住学生」根因 |
| **P0-高** | 安全代码沙箱（第三部分）：接 E2B 或 Judge0 | 面向未成年人的红线，现有 subprocess 无隔离不可上线 |
| **P1-中** | litellm 替换 `ZeroClawProvider`（第二部分） | 多 provider 统一接入，需先实测国内厂商 tool calling 兼容性 |
| **P1-中** | 项目级长期记忆（4.3）：扩展 `_build_context_block` 注入 skill_state/evidence | 复用已有数据，零新增基础设施 |
| **P2-低** | 学生画像记忆（4.4） | 数据积累后做，避免过早优化 |
| **可选** | OpenClaw 旁路（教师端/Demo） | 仅限单用户场景，作为 provider 备选通道，不碰核心 |

### 5.3 风险提示

- **litellm 国内厂商兼容性**：GLM/DeepSeek 的 tool calling / streaming 实现各有差异，替换前必须在测试环境跑通「GLM + DeepSeek + tool calling + streaming」四件套
- **E2B/Judge0 国内访问**：云服务可能有访问延迟/合规问题，需评估是否自托管（Docker+gVisor）或国内替代
- **ZeroClaw 仍在频繁 breaking change**（pre-1.0），即便旁路也要锁版本
- **对话历史上下文长度**：P0 拉 N 条历史后，注意 token 膨胀，必要时加截断/摘要策略（类似 MyAgent 的 AutoCompactor 思路）

---

## 附录 A：证据来源清单

### 本次抓取验证（一手证据）

**ZeroClaw**：
- [GitHub zeroclaw-labs/zeroclaw](https://github.com/zeroclaw-labs/zeroclaw) — Gateway 架构定义
- [ZeroClaw Mintlify 主页](https://zeroclaw-labs-zeroclaw-41.mintlify.app/) — 可访问；`/api-reference` 实测 404
- [Issue #5722 — Default shell sandbox blocks all realistic Python](https://github.com/zeroclaw-labs/zeroclaw/issues/5722) — 沙箱 vs Python 核心证据
- [Issue #5127 — bubblewrap configurable writable paths/network](https://github.com/zeroclaw-labs/zeroclaw/issues/5127)
- [Issue #3011 — Dashboard WebSocket protocols bug](https://github.com/zeroclaw-labs/zeroclaw/issues/3011)
- [Issue #1855 — TOTP enrollment](https://github.com/zeroclaw-labs/zeroclaw/issues/1855)

**OpenClaw**：
- [Gateway WS Protocol](https://docs.openclaw.ai/gateway/protocol)
- [Gateway Security（cooperative isolation）](https://docs.openclaw.ai/gateway/security)
- [Code mode (QuickJS，只 JS/TS)](https://docs.openclaw.ai/reference/code-mode)
- [Code execution (Python 经 xAI 远程沙箱)](https://docs.openclaw.ai/tools/code-execution)
- [Tools Invoke HTTP API（OpenAI 兼容 /v1/*）](https://docs.openclaw.ai/gateway/tools-invoke-http-api)
- [Webhooks plugin](https://docs.openclaw.ai/plugins/webhooks)
- [REST Endpoints (Mintlify 镜像)](https://openclaw-openclaw.mintlify.app/api/rest-endpoints)
- [Model Providers（国内厂商支持）](https://docs.openclaw.ai/concepts/model-providers)
- [Issue #8081 — 无 RBAC](https://github.com/openclaw/openclaw/issues/8081)
- [Z.AI 官方 OpenClaw 集成页](https://docs.z.ai/devpack/tool/openclaw)

**多租户架构共识**：
- [OpenHands SDK 论文 arXiv 2511.03690](https://arxiv.org/html/2511.03690v2) — multi-tenant 设计
- [HuggingFace: 重建多租户 coding agent](https://huggingface.co/blog/charles-azam/rebuilt-openhands)
- [Medium: Building OpenClaw-like for Teams（并发写损坏）](https://mychen76.medium.com/building-an-openclaw-like-ai-for-teams-a-multi-user-assistant-with-scheduled-intelligent-and-39ea1f7c33f5)
- [UNU: 单用户转多用户（不改代码）](https://c3.unu.edu/blog/from-laptop-to-organization-deploying-openclaw-at-scale-without-forking-it)

### 基于通用知识（待实施前实测验证）

- **litellm**：[docs.litellm.ai](https://docs.litellm.ai/docs/providers) / [GitHub BerriAI/litellm](https://github.com/BerriAI/litellm) — 国内厂商支持、tool calling、streaming（本次外部抓取超时，需实测）
- **沙箱对比**：基于 Modal / Beam Cloud / fast.io 等 2026 沙箱综述的业界共识；E2B/Judge0 定价需到官网核实

## 附录 B：诚实声明

1. **已验证**：ZeroClaw/OpenClaw 的多租户缺陷、API 形态、沙箱实现——均有官方一手来源（GitHub Issue / 官方文档原文）支撑，证据较硬。
2. **待验证**：litellm 的国内厂商具体 provider ID / 兼容性、E2B/Judge0 的最新定价与国内可用性——本次外部网络抓取多次超时，基于通用知识撰写，**实施前必须实测**。
3. **查不到的**：ZeroClaw 的认证方式（Bearer/OTP）公开文档未明确；ZeroClaw 是否存在 `crates/zeroclaw-gateway/openapi.json` 未能确认；「龙虾系统」在本项目代码库中无任何对应实体（全目录 grep 无匹配）。
