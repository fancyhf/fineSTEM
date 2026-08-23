# fineSTEM MVP2 Create 复制项目任务引导：开发 Agent Prompt

version: v1.2.0
created_at: 2026-08-13 00:00:00.000
updated_at: 2026-08-16 00:00:00.000
maintainer: 产品负责人
status: 可直接复制给开发 Agent（v1.1 已校正主链路落点）

change_log:
  - 2026-08-16 00:00:00.000 v1.2 修正 v1.1 的两处语义错误（导致 2026-08-16 线上“点击开始任务引导后无反应”）：①“触发 copy_project_guidance 场景”明确为“调用聊天发送（handleSend）发出首条场景消息”，仅切换场景状态变量不算触发；②测试清单原“点击按钮不自动发 AI 消息”改为“提醒出现时不发送；点击后必须发送”——旧措辞把禁止自动发送的时机错挂到点击上，开发照做即产生该线上问题。新增 AC 回签与真实链路走查要求（对齐 09 文档 §9.4）。
  - 2026-08-13 00:00:00.000 v1.1 与代码现状对齐：场景以 zeroclaw_provider 主链路为准、orchestrator 同步回退；教学模式内嵌进场景 prompt；HTML 完成验证改为确定性结构检查 + AI 复核；补 MCP 工具数与前端降级同步；验证命令改为 Git Bash。

---

## 使用说明

把下面 `===BEGIN===` 到 `===END===` 之间的内容，完整复制给一个新的开发 Agent 会话。不要手工省略边界标记。

---

===BEGIN===

你是 fineSTEM 的后端与前端开发 Agent。当前仓库位于 `G:\mediaProjects\fineSTEM`。请完成 MVP2 中“Create 复制项目任务引导”的 P0-03 至 P0-09 开发任务。

## 背景

fineSTEM 已有完整的用户登录、项目、Demo、Create 编辑器、AI 对话、Skill、PBL 门禁、代码读取、代码运行、证据和成果卡能力。

MVP2 不新建项目实验室页面，也不重做 Create 主界面。只对从 Demo 复制出来的项目增加一层任务引导：

- 学生从 Demo 保存项目后进入 Create。
- 第一次显示一次非阻塞提醒，不自动发 AI 消息。
- 学生主动点击“开始任务引导”。
- AI 先读取项目状态和真实代码，每次只给一项可修改、可运行、可验证的任务。
- 学生说“我改好了”后，系统真实读取代码、运行、验证。
- 通过后保存证据、解释知识点，再询问是否进入下一项。
- 学生自己创建的项目不出现这套流程。

## 当前仓库状态

- P0-01 已修复：Demo 复制项目会把来源 Demo 的模板代码写入 workspace。
- P0-02 已修复：复制 Demo 的 light 项目初始化为 `step_2`，`light_step=2`，并允许 `step_2/step_3` 写代码。
- 当前工作树已有相关未提交修改，不要回退。
- `.trae/documents/` 下存在用户未提交的文档修改，不要回退、不要重写。

### AI 主链路（决定场景与工具落点，必读）

代码审计确认当前有两条 AI 链路：

- **主链路（生产走这条）**：前端 `useStreamingChat` 直连 ZeroClaw WebSocket；前端从 `GET /api/v1/agent/scene-prompts` 拉 `zeroclaw_provider.SCENE_SYSTEM_PROMPTS`，拼进 WS 消息文本的 `<scene_instructions>` 块；daemon 读消息文本并通过 MCP 调用 `tools.py` 的 `TOOL_REGISTRY`。
- **回退链路（基本不走）**：`POST /agent/chat`、`/agent/ws` → `AgentOrchestratorService`（`orchestrator.py`，文件头已标注 DEPRECATED）。

由此：
1. 新场景 `copy_project_guidance` 必须加在 `apps/backend/app/services/providers/zeroclaw_provider.py` 的 `SCENE_SYSTEM_PROMPTS`（主链路，**以这里为准**），同时在 `orchestrator.py` 的 `_build_scene_instruction` 同步一个分支（回退）。
2. 主链路没有独立的教学模式注入机制；`orchestrator._build_teaching_mode_instruction` 只在 stage_07/08 生效，且不在主链路。因此教学模式指引要**内嵌进场景 prompt**，不要去改 `_build_teaching_mode_instruction`。
3. 新工具 `copy_guidance_verifier` 注册到 `tools.py` 的 `TOOL_REGISTRY` 后会经 MCP 自动暴露给 daemon；`tests/test_mcp_server.py` 对工具数（`== 16`）和名称集合有精确断言，必须同步更新为 17。注意：daemon 在启动时加载 MCP 工具列表，新增工具后需重启 ZeroClaw daemon 才真正生效；若你的运行环境无法重启 daemon，照常完成代码与单测，并在最终报告中注明“daemon 侧联调待重启后进行”。
4. `code_runner` 只支持 python/javascript；首个样板 `demo_poetry_card` 是 HTML，完成验证不能假装“真实运行”，改用确定性结构检查 + AI 语义复核。

## 参考文档

必须先阅读：

1. `.trae/documents/产品与规划/08_fineSTEM_MVP2_Create_AI导师增强产品说明书_V1.0.md`
2. `.trae/documents/产品与规划/09_fineSTEM_MVP2_Create任务引导_功能与开发说明书_V1.0.md`

以 `09` 文档为准执行。

## 明确不要做

- 不要新建独立 ProjectLab 页面或路由。
- 不要新建视频上传、转码、播放率、完播率或 B站账号联动。
- 不要新建家长工作台。
- 不要新做数字人、AI 朗读或语音输入。
- 不要给从零创建的项目强制注入复制项目引导。
- 不要关闭标准 PBL 门禁来适配复制项目。
- 不要提交 Git；只完成工作树修改并报告。
- 不要修改与本任务无关的文档、测试基线或已有行为。

## 必做任务

### 1. 引导状态返回

在现有 `SkillState.metadata` 中增加 `copy_guidance` 节点，并让 `GET /projects/{project_id}/workspace` 返回。

状态结构：

```json
{
  "copy_guidance": {
    "version": "1.0",
    "intro_status": "pending | dismissed | started",
    "session_status": "idle | active | waiting_verify | completed",
    "current_task": {
      "id": "replace_first_card",
      "title": "替换标题和第一张卡片",
      "acceptance_checks": ["code_changed", "run_success"]
    },
    "started_at": "2026-08-13T00:00:00Z",
    "updated_at": "2026-08-13T00:00:00Z"
  }
}
```

涉及文件：

- `apps/backend/app/schemas/projects.py`（`ProjectProgress` 加 `copy_guidance` 字段；新增 `CopyGuidanceUpdate` 请求体）。
- `apps/backend/app/api/projects.py`（`_build_workspace_payload` 读取节点；`create_project` 对 `from_demo_id` 项目初始化；新增 `POST /projects/{project_id}/copy-guidance` 端点）。
- `apps/backend/app/services/copy_guidance_state.py`（新增纯函数：`get/init/update_copy_guidance`）。

要求：

- **初始化**：`create_project` 在 `from_demo_id` 非空时写入 `copy_guidance`（`intro_status="pending"`、`session_status="idle"`）。自建项目不写，保持 `None`。
- **统一端点**：`POST /api/v1/projects/{project_id}/copy-guidance`（仿 `update_project_teaching_mode`），鉴权后写 `metadata.copy_guidance`，返回最新 `ProjectProgress`。
- **状态流转校验**：`intro_status` 只允许 `pending → dismissed | started`；非法流转返回 400。
- 旧项目没有 `copy_guidance` 时返回 `None`。
- 不新增数据库表。
- 保持现有 `ProjectProgress` 兼容性。

### 2. 首次提醒和再次进入

在 `apps/frontend/src/pages/Create.tsx` 中实现：

- 恢复 workspace 后，如果 `project.from_demo_id` 非空且 `progress.copy_guidance.intro_status === 'pending'`，显示首次提醒。
- 提醒提供两个动作：`开始任务引导`、`先自己看看`。
- 提醒出现时（学生点击之前）不得自动调用聊天接口——禁止的是未经点击的自动发送。
- `开始任务引导` 更新 `intro_status=started`，**标记成功后必须调用现有聊天发送（`handleSend`，场景参数 `copy_project_guidance`）发出首条引导消息**，AI 应回复第一项任务和完成条件（09 文档 AC-06）。仅切换 `activeScene` 等本地状态、不发消息是错误实现。触发文案统一由 `apps/frontend/src/lib/copyGuidance.ts` 的 `buildCopyGuidanceTrigger()` 生成，不得在组件里散写。
- `先自己看看` 更新 `intro_status=dismissed`，不发任何消息。
- 状态接口失败时保持横幅不重复弹，但必须在聊天区给出可见失败反馈，不允许只打 console 日志。
- 提醒关闭后，Create 快捷区仍显示“任务引导”入口。
- 小屏快捷区收起时，使用固定小型图标按钮，并提供 tooltip。

前端落点细节（挂载函数、行号、复用组件、API 方法）按 09 文档第 7 节执行：`ProjectContext` 扩展 `fromDemoId`/`copyGuidance`、`applyWorkspaceRestore`（约行 1161）末尾判定、提醒 Banner 仿 `sendBlockedHint` 内联实现、快捷区按钮加在约行 3797 的快捷卡片、`projectsApi.updateCopyGuidance` 仿 `updateTeachingMode`、判定逻辑抽纯函数 `shouldShowCopyGuidanceIntro` 便于 vitest 覆盖。

### 3. 新增 copy_project_guidance 场景（主链路 + 回退，两处都加）

**主链路（以这里为准）**：在 `apps/backend/app/services/providers/zeroclaw_provider.py` 的 `SCENE_SYSTEM_PROMPTS`（约行 66）新增 `"copy_project_guidance"` 键，值是 `STEM_SYSTEM_PROMPT + 场景指令`（参考现有 `"问问题"`/`"解释代码"` 键的写法）。

**回退链路**：在 `apps/backend/app/services/orchestrator.py` 的 `_build_scene_instruction`（约行 245）新增 `elif scene == "copy_project_guidance"` 分支。

建议把场景指令文本抽成公共常量（如 `app/services/copy_guidance_scene.py` 的 `COPY_PROJECT_GUIDANCE_PROMPT`），两处引用同一份，避免分叉。

场景要求（写进场景指令）：

- AI 必须先调用 `skill_state_reader`（读 mode、current_stage、teaching_mode、metadata.copy_guidance）。
- 再调用 `project_code_reader` 读取真实文件。
- 再读取来源 Demo 的 fork-template 或任务配置（`copy_guidance_tasks`）。
- 根据 `metadata.copy_guidance.current_task` 判断当前任务；无则从首项开始。
- 一次只返回一项任务，并给出完成条件和一个下一步动作。
- 布置任务后用 `ask_question` 给选项卡。
- 学生说完成后调用 `copy_guidance_verifier` 验证，不凭一句话判定通过。
- 验证通过：解释知识点、`evidence_saver` 保存证据、询问是否下一项，不自动连续布置。
- 验证失败：只指出第一处关键问题 + 一层提示。
- 不允许一次给完整答案（学生明确索要或多次失败除外）。
- 不得擅自调用 `stage_advancer`。
- 不得绕过标准 PBL 门禁。

### 4. 复用教学模式（在场景 prompt 内嵌，不要改 _build_teaching_mode_instruction）

主链路没有独立的教学模式注入机制，`orchestrator._build_teaching_mode_instruction` 只在 stage_07/08 生效且不在主链路。所以把四种模式指引**直接内嵌进第 3 步的场景指令末尾**：

```text
## 教学模式（先读再套用）
- 先用 skill_state_reader 读取 metadata.teachingMode（缺省视为 guided）。
- 按读到的模式调整引导方式，不要新增第五种模式：
  - guided：给文件和位置、骨架或 TODO，让学生补关键内容。
  - demo：先演示一次完整改法，再让学生改成自己的内容。
  - hands_on：只给任务、完成条件和提示，默认不交付完整答案。
  - lecture：先解释概念、数据或算法，再让学生修改项目。
- 复制项目首次改造默认偏 hands_on，但仍以学生已持久化的 teachingMode 为准。
```

不要新增第五种教学模式，也不要为复制项目改 `_build_teaching_mode_instruction`（那会影响 standard 项目）。

### 5. 完成验证（确定性结构检查 + AI 语义复核）

实现复制项目任务的完成验证。新增工具 `copy_guidance_verifier`，注册到 `tools.py` 的 `TOOL_REGISTRY`。

**注意：`code_runner` 只支持 python/javascript，HTML 样板不能“真实运行”。** 因此分两层：

- **第一层（工具，确定性）** `copy_guidance_verifier`：
  - 读当前 workspace 代码；读来源 Demo 的 `minimal_replica` 做对比（`db.get_project` → `from_demo_id` → `db.get_demo`）。
  - 按 `acceptance_checks` 做确定性检查，check 用通用类型，验证器按类型分发：
    - `code_changed`：当前代码归一化 hash ≠ Demo 原始 hash（去空白比较）。
    - `run_success`：python/javascript 调 `code_runner` 看 exit_code==0；**HTML 做结构完整性检查**（`<html>`/`</html>` 配对、JS 括号配对、无未闭合标签），不调 code_runner。
    - `content_keyword`：从 `claimed_changes` 提取关键词在代码中命中。
    - `card_count`：正则统计卡片数据/节点数，要求比初始多。
  - 全部确定性 check 通过 → `passed=true`，调 `evidence_saver` 保存证据；任一失败 → `passed=false` + `first_issue`（第一处）+ `next_hint`（一层提示）。
  - 返回 `{auto_passed, passed, evidence_saved, knowledge_point, next_task_id, checks_detail}` 或失败结构。
- **第二层（AI，语义复核）**：`copy_project_guidance` 场景指令要求 AI 收到 verifier 结果后，结合 `claimed_changes` 做最终语义判断；`passed=true` 但语义不吻合时追问或判未完成。

输入：`{project_id, task_id, claimed_changes}`。要求：

- 学生说“我改好了”后，必须先重新读代码。
- HTML 走结构检查，不要假装用 code_runner 运行。
- 失败时只指出第一处关键问题，并给一层提示。
- 通过时保存证据，并解释一个知识点。
- 通过后询问是否进入下一项，不自动连续布置。

### 6. 首个 Demo 任务配置（通用 check 类型）

为古诗/知识卡样板（`demo_poetry_card`，已存在于 `demo_repo.py`）配置 5 项任务：

1. 替换标题和第一条内容。
2. 增加一条卡片数据。
3. 修改一个交互或样式参数。
4. 制造并修复一次小错误。
5. 说明自己的改动。

配置放在：

```text
apps/backend/app/services/copy_guidance_tasks.py
```

提供 `get_tasks_for_demo(demo_id)` / `get_task(task_id)` / `get_next_task(current_task_id)`。每项任务的 `acceptance_checks` 必须用第 5 步定义的通用类型（`code_changed`/`run_success`/`content_keyword`/`card_count`），这样验证器不用为每个 Demo 写专门逻辑——第二个 Demo 只加任务配置即可。不要写死在前端 UI。

### 7. 自动化测试

至少覆盖：

- 复制项目 workspace 包含来源代码。
- 自建项目不返回 `copy_guidance` 或返回 `None`。
- 复制项目创建后 `copy_guidance.intro_status == "pending"`。
- 首次提醒只出现一次；自建项目不渲染提醒；**提醒渲染时不发消息，点击"开始任务引导"后必须发出一条 `copy_project_guidance` 场景消息**（v1.1 此处写成"点击按钮不自动发 AI 消息"，语义颠倒，勿回退）。
- 触发内容用 `copyGuidance.test.ts` 锁定 `buildCopyGuidanceTrigger()`；`Create.tsx` 事件接线用 `src/pages/Create.copyGuidanceWiring.test.ts` 源码级守卫锁定（巨型组件暂无组件测试基建）；端到端用 `tests/specs/copy-guidance-intro.spec.ts`（Playwright，断言点击后用户气泡出现，不依赖 daemon）。
- `copy_project_guidance` 场景：主链路 `SCENE_SYSTEM_PROMPTS` 含新键且回退 `_build_scene_instruction` 含分支，两处文本一致。
- 完成验证通过/失败路径；HTML 的 `run_success` 走结构检查（不调 code_runner）；`code_changed` 用 hash 对比来源 Demo。
- 证据保存。
- `step_2/step_3` 代码权限和标准 PBL 门禁无冲突（沿用 `test_stage_constants.py` 现有断言，不改数量）。
- **必需维护**：`tests/test_mcp_server.py` 新增 `copy_guidance_verifier` 后，把 `test_loads_all_16_tools` / `test_tools_list_returns_all_specs` 的 `16` 改为 `17`，并把 `test_expected_tool_names_present` 的 `expected` 集合补上 `"copy_guidance_verifier"`。
- **前端降级**：`apps/frontend/src/lib/scenePrompts.ts` 的 `FALLBACK_PROMPTS` 补 `copy_project_guidance` 精简版，并用 vitest 覆盖判定纯函数。

## 实现顺序

按以下顺序完成，不要跳步：

1. 先读参考文档和现有代码。
2. 实现后端 `copy_guidance` 状态和 workspace 返回。
3. 实现 `copy_project_guidance` 场景。
4. 实现完成验证和首个任务配置。
5. 实现前端首次提醒和再次进入入口。
6. 补自动化测试。
7. 运行编译和测试，修复本任务引入的问题。

## 验证命令

本机是 Git Bash on win32，用 bash 语法（不是 PowerShell）。在 `apps/backend` 目录下运行：

```bash
../../.venv/Scripts/python.exe -m py_compile \
  app/services/copy_guidance_tasks.py \
  app/services/copy_guidance_state.py \
  app/services/copy_guidance_scene.py \
  app/services/providers/zeroclaw_provider.py \
  app/services/orchestrator.py \
  app/api/projects.py \
  app/schemas/projects.py \
  app/services/tools.py
```

然后运行相关测试：

```bash
export DATABASE_URL='sqlite:///G:/mediaProjects/fineSTEM/apps/backend/tmp_test/test_finestem.db'
export STORAGE_BASE_PATH='G:/mediaProjects/fineSTEM/apps/backend/tmp_test/uploads'
../../.venv/Scripts/python.exe -m pytest \
  tests/test_stage_constants.py \
  tests/test_projects.py::TestProjectCreate \
  tests/test_tools_gates.py \
  tests/test_mcp_server.py \
  tests/test_copy_guidance_state.py \
  tests/test_copy_guidance_scene.py \
  tests/test_copy_guidance_verifier.py \
  -q
```

前端（另一个终端）：

```bash
cd apps/frontend && npm run test
```

E2E（需要前端 5184 与后端 3200 都在运行；不依赖 ZeroClaw daemon）：

```bash
cd apps/frontend/tests && npx playwright test specs/copy-guidance-intro.spec.ts
```

注意：

- 如果没有 `tmp_test` 目录，测试会创建；不要提交测试临时文件。
- `TestPBLFullLoop` 已有两个已知失败，与本任务无关，不要修改其测试意图。
- `test_mcp_server.py` 的工具数断言必须随 `copy_guidance_verifier` 同步更新为 17。
- 不要运行或修改 `apps/backend/tmp_test/` 下的文件到版本控制。

## 最终输出

完成后，请给出：

- 已实现功能清单，按 P0-03 至 P0-09 对应说明。
- 修改或新增的文件列表。
- 后端 API / 状态结构变化。
- 前端新增交互说明。
- 测试结果摘要。
- **AC 回签表（v1.2 起必需）**：对照 09 文档 §9.1 的 AC-01 至 AC-14，逐条给出“AC-XX → 自动化测试名 / 手测记录”。写不出验证方式的 AC 视为未完成，不得声称任务完成；单测全绿不等于验收通过。
- **真实链路走查记录（v1.2 起必需）**：至少走通 AC-06（注册新号 → 复制 Demo → 点击 → AI 返回一项任务）一遍，注明日期、环境（daemon 是否重启）。无法执行时只能列为风险项，不得标记完成。
- 未完成项或风险。
- 没有提交 Git。

===END===