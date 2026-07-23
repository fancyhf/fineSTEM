# SOP & Memory 实施交接文档

> 目标读者：接手 fineSTEM × ZeroClaw 集成工作的开发 AI Agent。
> 本文档是该任务的**唯一信息入口**——读完即可开始实施，不需要翻聊天记录。

---

## 1. 背景

fineSTEM 是一个面向 12-18 岁青少年的 STEM 编程 PBL（项目式学习）教学平台。后端使用 FastAPI + MCP Server（`apps/backend/app/mcp_server/server.py`），前端使用 React + Vite（`apps/frontend/`）。AI 运行时由 **ZeroClaw**（Rust 编译的 Agent daemon，v0.8.3）承载。

用户的目标："希望 ZeroClaw 用得上，流程跑得通，项目健壮。不希望各种半路成品。"

**当前进度**：SKILL.md（PBL 导师规范）和 SOUL.md（导师身份）已写好并存放到正确位置。接下来要完成 **SOP（标准操作程序）** 和 **Memory（项目级持久记忆）** 两项。

---

## 2. 已完成的工作（不要重复做）

| 产物 | 路径 | 状态 |
|------|------|------|
| ZeroClaw 专用 SKILL.md | `H:/dev-env/zeroclaw/config/agents/assistant/workspace/skills/stem-pbl-guide/SKILL.md` | ✅ 已写（~200 行，含 PBL 9 阶段状态机 + 提问规范 + 代码锁 + 工具速查） |
| SOUL.md（导师身份） | `H:/dev-env/zeroclaw/config/agents/assistant/workspace/SOUL.md` | ✅ 已改写（PBL 导师身份，不再是通用 assistant） |
| Config.toml 修复 | `H:/dev-env/zeroclaw/config/config.toml` | ✅ system_prompt 闭合引号修复、R1 API key 加密、R3 GLM 禁用 |
| 后端门禁体系 | `apps/backend/app/services/stage_constants.py`、`pbl_engine.py`、`tools.py` | ✅ 9 阶段 can_advance_to / check_gate / artifact_stage_gate 硬门禁 |
| 前端清洗 | `apps/frontend/src/hooks/useStreamingChat.ts`、`Create.tsx` | ✅ finestem__ 前缀归一化、MCP 双层 JSON 解析、思考展示、截断恢复 |
| 测试体系 | 87 后端 + 43 前端 + 5 E2E | ✅ 已重构 |
| Test SOP（格式验证） | `H:/dev-env/zeroclaw/config/data/sops/test-sop/` | ✅ SOP.md 格式已验证通过（Steps: 2） |
| 原 skill | `G:/mediaProjects/fineSTEM/.trae/skills/stem-pbl-guide/` | ⚠️ **不要改**（供其他 IDE 使用） |

---

## 3. 调研结论（关键发现）

### 3.1 SOP 调研

**SOP 格式已验证通过**：

SOP.md 正确格式：
```markdown
# sop-name

描述文字。

## Steps

1. **步骤标题** — 步骤描述
   - tools: ["tool_name_1", "tool_name_2"]
   - requires_confirmation: false

2. **步骤标题** — 步骤描述
   - tools: ["tool_name_3"]
   - requires_confirmation: true
```

SOP.toml 格式：
```toml
[sop]
name = "sop-name"
description = "描述"
# 可选：[[sop.nodes]] / [[sop.edges]] 用于复杂 DAG
```

**关键命令**（在 `H:/dev-env/zeroclaw/bin/` 执行）：
- `./zeroclaw.exe sop list` — 列出所有 SOP
- `./zeroclaw.exe sop validate <name>` — 校验 SOP
- `./zeroclaw.exe sop show <name>` — 查看详情

**当前 config.toml 没有 `[sop]` 段**——这是 test-sop 之前被识别但显示 "Steps: 0" 的根因（SopEngine 未被运行时启用）。需要添加：
```toml
[sop]
sops_dir = "sops"
```

**SOP 限制**：
- CLI 只有 `list/validate/show/run`，没有 `create/delete`——SOP 需要手动创建文件
- SOP 是**确定性步骤执行**（Step 1 → Step 2 → Step 3），每步有固定的 tools 列表
- Manual 触发通过 ZeroClaw 内置的 `sop_execute` 工具
- 没有发现 `sop_execute` 的显式 CLI 命令，可能是 Agent runtime 内部工具

**架构判断（重要）**：
- SOP **不适合**作为 PBL 全部 9 阶段的主流程载体——PBL 是对话驱动的创意探索，不是确定性步骤序列
- SOP **适合** PBL 中少数确定性序列：验收阶段（stage_08）的 10+ 工具调用链、项目初始化检查清单
- 建议：创建 1-2 个实用的 SOP，不做 9 阶段全覆盖。主流程门禁继续由代码层保障

### 3.2 Memory 调研

**Memory CLI 实际能力**（`./zeroclaw.exe memory`）：
- `list` — 列出条目（支持 `--category`、`--limit`）
- `get <KEY>` — 按键获取
- `stats` — 后端统计（sqlite + FTS + embedding）
- `clear` — 清除（支持 `--category`、`--yes`）
- `reindex` — 重建索引

**没有 store/recall/forget 命令**——Memory 是 Agent Runtime 内部自动管理的（对话中自动 store，需要时 recall），不是手动 CLI 操作。

**当前状态**：
- 后端：sqlite
- 15 条记忆，全部 `conversation` 类别
- 内容为测试对话的 webhook 消息，没有项目级记忆
- `config.toml` 已有 `[memory]` 段（`backend = "sqlite"`）✅

### 3.3 Skill 加载机制

- `skills bundle list` 显示"未配置技能包"
- `skills list` 显示"未安装技能"
- 但 `config/agents/assistant/workspace/skills/stem-pbl-guide/SKILL.md` **已存在**且内容完整
- 说明 daemon 自动加载 workspace/skills/ 下的 skill，不需要通过 CLI 显式安装
- Skill 格式：`agentskills.io` 规范，YAML frontmatter（name/description 必填）

---

## 4. 待实施任务

### 4.1 SOP（优先级：中）

**实施计划**：

1. **启用 SopEngine**：在 config.toml 添加 `[sop]` 段
   ```toml
   [sop]
   sops_dir = "sops"
   step_scope_enforce = false   # PBL 对话灵活，暂不强约束
   ```

2. **创建 `pbl-evaluate` SOP**（验收阶段确定性序列）：
   - 目录：`H:/dev-env/zeroclaw/config/data/sops/pbl-evaluate/`
   - 步骤序列：
     1. `skill_state_reader` → 确认当前项目状态
     2. `artifact_reader` × N → 读取所有阶段工件
     3. `artifact_writer(evaluate)` → 写入验收工件
     4. `stage_advancer` → 推进到 stage_08
     5. `achievement_card` → 生成成果档案卡
   - 其中步骤 2 的 "× N" 是可变的（取决于项目类型），SOP 需要处理变量步数

3. **可选：创建 `pbl-init` SOP**（项目初始化检查）：
   - 新项目创建后：检查 DB、workspace、模板加载

4. **在 SKILL.md 中引用 SOP**：告知 AI 验收阶段可使用 `sop_execute` 触发标准化流程

**SOP 的边界**：
- 不做 9 阶段全覆盖（理由见 3.1 架构判断）
- 不替代代码层门禁（门禁继续由 stage_constants 管理）
- 定位：**可选增强**，不是主流程依赖

**如果决定跳过 SOP**：可以。分析结论是 SOP 与 PBL 对话驱动模式的适配成本高于收益。在交接文档里写清楚这个判断即可。

### 4.2 Memory（优先级：高）

**实施计划（两层）**：

**Layer 1：skill_state 持久化**（已实现 ✅）
- 通过 MCP 工具 `skill_state_writer`/`skill_state_reader` 读写项目状态
- 存储内容：current_stage、stage_history、light_step_data、metadata
- 这是 PBL 流程的核心持久化机制，已工作正常

**Layer 2：ZeroClaw Memory 集成**（待实施）

Memory 由 Agent Runtime 内部自动管理。实施方向：
1. 在 SOUL.md 或 SKILL.md 中指导 AI 在关键里程碑使用内置 memory 机制保存项目记忆
2. 可选：通过 MCP 工具 `finestem__project_memory_writer`（后端新增）在关键事件时显式触发 memory 写入
3. Memory category 建议：
   - `pbl_project` — 项目级记忆（里程碑、技术决策）
   - `pbl_student` — 学生级记忆（学习风格、常见错误）

**但需要注意**：ZeroClaw memory 没有提供外部 write API（没有 store 命令）。写入只能在 Agent conversation 上下文中由 runtime 自动完成。这意味着：
- 后端无法直接写 memory
- 只能通过在 SKILL.md 中指导 AI "当达成里程碑时，在回复中总结要点"来被动积累记忆
- 或者探索 ZeroClaw 的 MCP 工具中是否有 memory 写入能力

**下一步行动**：
1. 查 ZeroClaw daemon 的 MCP 工具列表（是否暴露 memory 写入工具）
2. 如无暴露，则在 SKILL.md 中添加"里程碑记忆规则"（触发 AI 在对话中总结并自动存入 memory）
3. 验证：做一次完整测试对话，观察 memory 是否自动积累项目相关信息

### 4.3 Skill Bundle 配置（优先级：低）

当前 `skills bundle list` 显示"未配置技能包"。如需通过 CLI 管理 skill：
```bash
./zeroclaw.exe skills bundle add default --directory shared/skills/default
```
但 daemon 直接读 `workspace/skills/` 已经工作，所以这个不是阻塞项。

---

## 5. 相关文件路径速查

| 文件 | 路径 |
|------|------|
| ZeroClaw 根目录 | `H:/dev-env/zeroclaw/` |
| ZeroClaw 二进制 | `H:/dev-env/zeroclaw/bin/zeroclaw.exe` |
| 配置文件 | `H:/dev-env/zeroclaw/config/config.toml` |
| Agent workspace | `H:/dev-env/zeroclaw/config/agents/assistant/workspace/` |
| PBL Skill | `H:/dev-env/zeroclaw/config/agents/assistant/workspace/skills/stem-pbl-guide/SKILL.md` |
| SOP 目录 | `H:/dev-env/zeroclaw/config/data/sops/` |
| Memory 数据 | `H:/dev-env/zeroclaw/config/data/memory/` |
| Session 数据 | `H:/dev-env/zeroclaw/config/data/sessions/` |
| 原 skill（不改） | `G:/mediaProjects/fineSTEM/.trae/skills/stem-pbl-guide/` |
| 后端入口 | `G:/mediaProjects/fineSTEM/apps/backend/` |
| 前端入口 | `G:/mediaProjects/fineSTEM/apps/frontend/` |
| MCP Server | `G:/mediaProjects/fineSTEM/apps/backend/app/mcp_server/server.py` |
| 阶段常量 | `G:/mediaProjects/fineSTEM/apps/backend/app/services/stage_constants.py` |
| PBL 引擎 | `G:/mediaProjects/fineSTEM/apps/backend/app/services/pbl_engine.py` |

---

## 6. 测试方法

### 验证 SOP
```bash
cd H:/dev-env/zeroclaw/bin
./zeroclaw.exe sop list          # 应列出新创建的 SOP
./zeroclaw.exe sop validate pbl-evaluate  # 应无警告
```

### 验证 Memory
```bash
cd H:/dev-env/zeroclaw/bin
./zeroclaw.exe memory stats      # 查看后端状态
./zeroclaw.exe memory list       # 查看现有条目
```

### 验证端到端 PBL 流程
1. 启动 ZeroClaw daemon
2. 打开 fineSTEM 前端 → 创建新项目
3. 在聊天中走一遍完整 PBL 流程（stage_00 → stage_08）
4. 观察 memory 是否积累项目记忆

### 注意
- **不要要求用户做任何技术操作**——所有测试由 AI Agent 自行完成
- ZeroClaw daemon 启动脚本参考：`H:/dev-env/zeroclaw/zeroclaw-daemon.cmd`

---

## 7. 上一个 Agent 的未完成操作

在交接前正在执行：
1. 已将 test-sop 的 SOP.md 更新为正确格式（从 `# test-sop\n测试 SOP。` → 含 `## Steps` 编号列表），验证通过（Steps: 2）
2. 正准备：
   - 在 config.toml 添加 `[sop]` 段
   - 创建 pbl-evaluate SOP（SOP.md + SOP.toml）
   - 调研 ZeroClaw daemon 是否暴露 memory 写入 MCP 工具

---

*最后更新：2026-07-22 · 交给下一个开发 AI Agent*
