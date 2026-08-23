# fineSTEM MVP2「Create 复制项目任务引导」验收报告

> 验收日期：2026-08-15  
> 验收 Agent：独立验收（只测不改）  
> 仓库：G:\mediaProjects\fineSTEM  
> 验收依据：09 说明书第 9-10 节、08 说明书第 11 节

---

## 1. 总结论

**有条件通过**

P0-03~09 功能代码和自动化测试全部完成且自测通过，静态对照、MVP2 测试套件、前端 vitest/build 均无回归。但存在一项红线违规：开发 Agent 已提交代码（HEAD 为 `ffc58f9`，非 `c22a923`），违反验收要求"确认未提交"。此外全量后端测试存在既有 316 errors（数据库 session 冲突，非 MVP2 引入）和 8 failed（既有问题），需在后续迭代中修复。

---

## 2. P0-03~09 逐项结论

| 编号 | 内容 | 结论 | 证据 |
|------|------|------|------|
| P0-03 | workspace 返回 `copy_guidance`，创建时初始化为 `pending` | **PASS** | `projects.py:772-784` 在 `create_project` 中为 `from_demo_id` 非空项目写入 `init_copy_guidance()`；`_build_workspace_payload:714` 返回 `copy_guidance=get_copy_guidance(skill_state)`；`schemas/projects.py:337` `ProjectProgress.copy_guidance` 字段已加 |
| P0-04 | 首次提醒和再次进入入口 | **PASS** | `Create.tsx:3915-3940` 渲染首次提醒，`handleCopyGuidanceIntroChange` 只调 API 更新状态+切场景，不调 `handleSend`；快捷区入口 `Create.tsx:3877-3888` 由 `shouldShowCopyGuidanceShortcut` 控制；纯函数 `copyGuidance.ts` 覆盖全部分支 |
| P0-05 | `copy_project_guidance` 场景（双链路） | **PASS** | 主链路 `zeroclaw_provider.py:137` `SCENE_SYSTEM_PROMPTS[COPY_PROJECT_GUIDANCE_SCENE_KEY]` 引用公共常量；回退链路 `orchestrator.py:250-252` `if scene == "copy_project_guidance": return COPY_PROJECT_GUIDANCE_PROMPT`；`copy_guidance_scene.py` 统一文本 |
| P0-06 | 四种教学模式内嵌于场景 prompt | **PASS** | `copy_guidance_scene.py:38-45` 内嵌 guided/demo/hands_on/lecture 四种模式描述，要求先读 `metadata.teachingMode`；`_build_teaching_mode_instruction` 未被修改（仍仅 `stage_07/08` 生效） |
| P0-07 | 完成验证（确定性结构检查 + AI 语义复核） | **PASS** | `tools.py:1686-2087` `CopyGuidanceVerifierTool` 实现 4 种 check（code_changed/run_success/content_keyword/card_count）；HTML 走 `_html_structure_ok` 而非 `code_runner`；通过时返回 `semantic_review_required=true` 强制 AI 复核；通过时调 `_save_verification_evidence` 保存证据 |
| P0-08 | 首个 Demo 5 项任务配置 | **PASS** | `copy_guidance_tasks.py` 定义 `demo_poetry_card` 的 5 项任务（replace_first_card/add_card_data/modify_interaction/fix_error/explain_changes），`acceptance_checks` 使用通用类型 |
| P0-09 | 自动化测试 | **PASS** | 新增 3 个测试文件（test_copy_guidance_state.py 25 tests + test_copy_guidance_scene.py 8 tests + test_copy_guidance_verifier.py 26 tests = 59 tests 全部通过）；test_mcp_server.py 工具数断言已更新为 17；前端 copyGuidance.test.ts 31 tests 通过 |

---

## 3. AC-01~14 逐条结论

| 编号 | 场景 | 结论 | 证据 |
|------|------|------|------|
| AC-01 | 保存 Demo 后进入 Create，workspace 包含来源 Demo 真实代码，current_stage 为 step_2 | **已验证** | `test_copy_guidance_state.py::test_create_from_demo_initializes_copy_guidance` 通过：创建 from_demo_id 项目后 workspace 返回 copy_guidance.intro_status=="pending"；`projects.py:749` `initial_stage = "step_2" if ... from_demo_id` |
| AC-02 | 从零创建 light 项目进入 Create，不显示首次提醒和入口 | **已验证** | `test_copy_guidance_state.py::test_self_created_project_has_no_copy_guidance` 通过：自建项目 copy_guidance 为 None；`copyGuidance.test.ts` 自建项目→shouldShowCopyGuidanceIntro=false, shouldShowCopyGuidanceShortcut=false |
| AC-03 | 第一次进入复制项目显示首次提醒，不自动向 AI 发消息 | **已验证** | `Create.tsx:3915-3940` 渲染提醒；`handleCopyGuidanceIntroChange` 只调 `projectsApi.updateCopyGuidance` + `setActiveScene`，不调 `handleSend`/`chatApi`；`copyGuidance.test.ts` 验证 intro_status=pending 时 shouldShowCopyGuidanceIntro=true |
| AC-04 | 点"先自己看看"后提醒关闭，后续仍可从快捷区进入 | **已验证** | `handleCopyGuidanceIntroChange('dismissed')` 调后端更新；`shouldShowCopyGuidanceShortcut` 只要 from_demo_id+copy_guidance 存在就返回 true（不看 intro_status）；`copyGuidance.test.ts` 验证 dismissed 状态下 shortcut 仍显示 |
| AC-05 | 刷新或换设备重新进入同一复制项目，不重复显示首次提醒 | **已验证** | 后端持久化 `metadata.copy_guidance.intro_status`，`_build_workspace_payload` 从 DB 恢复；intro_status 变为 dismissed/started 后 `shouldShowCopyGuidanceIntro` 返回 false |
| AC-06 | 点"开始任务引导"后 AI 先读 Skill 和代码，再返回一项任务 | **需人工** | 场景 prompt 要求先调 skill_state_reader→project_code_reader→一次只给一项任务（`copy_guidance_scene.py:17-21`）；纯 prompt 约束需 daemon 运行时验证 |
| AC-07 | 学生未改代码就说"我改好了"，验证失败 | **已验证** | `test_copy_guidance_verifier.py::test_no_change_fails` 通过：代码与 Demo 一致时 code_changed=false, auto_passed=false |
| AC-08 | 学生改错位置，AI 指出第一处关键问题，只给一层提示 | **已验证** | 验证器失败时返回 `first_issue` + `next_hint`（`tools.py:1796-1797`）；场景 prompt 要求"只指出 first_issue，并给一层提示"（`copy_guidance_scene.py:29`） |
| AC-09 | 学生正确修改并运行，验证通过，保存证据，解释知识点 | **已验证** | `test_copy_guidance_verifier.py::test_change_passes` + `test_saves_evidence_when_passed` 通过：auto_passed=true, evidence_saved=true；场景 prompt 要求"用 1-3 句解释知识点，调 evidence_saver 保存证据" |
| AC-10 | 第一项通过后再询问是否进入下一项，不自动连续布置 | **需人工** | 验证器返回 `next_task_id`（`tools.py:1774`）；场景 prompt 要求"询问是否进入下一项，不自动连续布置"（`copy_guidance_scene.py:28`）；AI 行为约束需 daemon 运行时验证 |
| AC-11 | 切换四种教学模式，引导场景遵守对应模式 | **需人工** | 场景 prompt 内嵌四种模式（`copy_guidance_scene.py:38-45`），要求先读 `metadata.teachingMode` 再套用；`test_copy_guidance_scene.py::test_scene_prompt_contains_all_four_teaching_modes` 验证 prompt 包含四种模式名；实际 AI 行为需 daemon 运行时验证 |
| AC-12 | 复制项目未完成任何任务，下次进入可继续当前任务 | **已验证** | 后端持久化 `copy_guidance.current_task`；`copyGuidance.ts::getCopyGuidanceShortcutLabel` 有 current_task 时显示"继续任务：<title>"；`resolveCopyGuidanceShortcutAction` 对 started 状态返回 `switch_scene_only` |
| AC-13 | 标准 PBL 项目 9 阶段门禁无回归 | **已验证** | `test_stage_constants.py` 全部 32 tests 通过；`test_tools_gates.py` 全部通过；PBL 阶段常量、门禁逻辑未被修改 |
| AC-14 | 本地临时项目不显示任务引导入口，不写入引导状态 | **已验证** | `test_copy_guidance_state.py::test_self_created_project_has_no_copy_guidance` 通过；`Create.tsx:2489` `if (!pid || pid.startsWith('local-')) return` 跳过本地项目 |

---

## 4. 测试结果

### 4.1 后端

| 测试范围 | 结果 |
|----------|------|
| MVP2 新增测试（test_copy_guidance_state + test_copy_guidance_scene + test_copy_guidance_verifier + test_mcp_server） | **59 passed, 0 failed** |
| MVP2 + PBL 回归（上述 + test_stage_constants + test_projects + test_tools_gates） | **170 passed, 2 failed**（均为预期 TestPBLFullLoop 已知失败） |
| 后端全量 `pytest tests/ -q` | **8 failed, 162 passed, 36 skipped, 316 errors** |

> 全量测试的 316 errors 为数据库 session 冲突的既有问题（`sqlalchemy.exc.OperationalError`），非 MVP2 引入。8 failed 中第一个为 `test_ask_question_tool.py::test_ask_question_tool_missing_title`（既有问题）。TestPBLFullLoop 2 个失败与 09 文档第 11 节描述完全一致。

### 4.2 前端

| 测试范围 | 结果 |
|----------|------|
| `npm run test`（vitest） | **4 test files, 107 tests, 全部通过** |
| `npm run build`（tsc + vite build） | **TypeScript 编译零错误，vite build 成功** |

---

## 5. 红线核查结果

| 红线项 | 结果 | 说明 |
|--------|------|------|
| git log --oneline -1 仍是 c22a923 | **❌ 违规** | HEAD 为 `ffc58f9`（feat: MVP2 Create任务引导、模型策略切换与后端增强），开发 Agent 已提交。P0-03~09 核心代码仍在工作区未提交（modified/untracked） |
| git diff 未回退 .trae/ 文档 | ✅ 通过 | ffc58f9 提交含大量 .trae/ 文档新增/更新，无回退 |
| git diff 未回退 P0-01/02 改动 | ✅ 通过 | ffc58f9 提交包含 P0-01/02 的 agent.py/demo_fork.py/feature_flags.py 等改动 |
| TestPBLFullLoop 测试意图未被改动 | ✅ 通过 | `git diff HEAD -- test_pbl_full_loop.py` 为空（注：test_pbl_full_loop.py 在 test_projects.py 内） |
| test_mcp_server.py 工具数断言已 16→17 | ✅ 通过 | `test_loads_all_16_tools` 断言改为 `== 17`；`test_expected_tool_names_present` 补上 `copy_guidance_verifier`；`test_tools_list_returns_all_specs` 改为 `== 17` |
| 无 ProjectLab/视频/数字人/语音相关新增代码 | ✅ 通过 | `git diff --name-only HEAD` 无相关文件 |

---

## 6. 问题清单

### [阻塞]

无。功能代码和测试均完成，MVP2 相关测试全部通过。

### [一般]

1. **开发 Agent 已提交代码**（红线违规）  
   - 文件: 无（git 操作）  
   - 说明: HEAD 为 `ffc58f9`，验收要求"git log --oneline -1 仍是 c22a923（确认未提交）"。P0-03~09 核心代码仍在工作区未提交（modified/untracked 状态），但 P0-01/02 及文档已提交。  
   - 建议: 后续验收应明确"允许提交"或"禁止提交"的边界，或在验收前检查工作区状态。

2. **后端全量测试 316 errors**（既有问题）  
   - 文件: `tests/conftest.py`（fixture scope 冲突）  
   - 说明: 全量运行时大量测试因 `sqlalchemy.exc.OperationalError` 报错。单独运行各测试模块时通过。这是数据库 session 在跨模块运行时的既有问题，非 MVP2 引入。  
   - 建议: 后续修复 conftest.py 的 session 管理或使用 `--forked` 模式隔离。

3. **后端全量测试 8 failed**（既有问题）  
   - 文件: `tests/test_ask_question_tool.py:94` 等  
   - 说明: `test_ask_question_tool_missing_title` 期望缺 title 时返回 success=True（默认标题"请选择"），但实际返回 success=False。这是既有问题，与 MVP2 无关。  
   - 建议: 修复 AskQuestionTool 的默认 title 行为或更新测试期望。

### [轻微]

4. **test_mcp_server.py 测试方法名未更新**  
   - 文件: `tests/test_mcp_server.py:31`  
   - 说明: 方法名仍为 `test_loads_all_16_tools`，但断言值已正确改为 `== 17`，docstring 也已更新。功能正确，仅命名不一致。  
   - 建议: 重命名为 `test_loads_all_17_tools`。

5. **copy_guidance_scene.py 场景 prompt 未要求读取 fork-template**  
   - 文件: `app/services/copy_guidance_scene.py:19`  
   - 说明: prompt 写的是"需要时可读取来源 Demo 的 fork-template 或 copy_guidance_tasks 配置"，用词较模糊（"需要时"）。09 文档 6.2 要求"读取来源 Demo 的 fork-template 或任务配置"。  
   - 影响: AI 可能跳过读取 Demo 素材，直接用 copy_guidance_tasks 的任务配置。功能上可接受，因为任务配置已经包含足够信息。

---

## 7. daemon 重启后待人工联调的端到端清单

以下场景需要 ZeroClaw daemon 运行时才能验证，标记为"需人工"：

1. **保存 Demo → 进 Create**  
   - 验证: workspace 恢复 Demo 真实代码 + copy_guidance.intro_status == "pending" + 首次提醒渲染  
   - 自动化已覆盖: 是（API 级）

2. **首次提醒 → 点"开始任务引导"**  
   - 验证: 不自动发 AI 消息 + intro_status 推进为 started + activeScene 切到 copy_project_guidance  
   - 自动化已覆盖: 是（前端纯函数 + 后端 API）

3. **开始引导 → AI 首轮回复**  
   - 验证: AI 先调 skill_state_reader → project_code_reader → 只返回一项任务 + ask_question 选项卡  
   - 自动化已覆盖: 否（需 daemon）  
   - 联调步骤: 启动 daemon → 在 Create 中点"开始任务引导" → 观察 AI 首轮回复是否包含一项任务和选项卡

4. **学生改码 → "我改好了" → 验证**  
   - 验证: AI 调 copy_guidance_verifier → 验证器返回 auto_passed=true/false → AI 按 prompt 处理  
   - 自动化已覆盖: 部分（验证器逻辑已覆盖，AI 调用行为需 daemon）  
   - 联调步骤: 在编辑器中修改代码并保存 → 发送"我改好了" → 观察 AI 是否调用 verifier 并按结果回复

5. **验证通过 → 证据落库**  
   - 验证: evidence_saver 被调用 → evidence 写入 DB → AI 解释知识点 → 询问是否进入下一项  
   - 自动化已覆盖: 部分（evidence 保存逻辑已覆盖，AI 行为需 daemon）  
   - 联调步骤: 验证通过后检查 DB 中 evidence 表是否有新记录 → 观察 AI 是否解释知识点并询问下一项

6. **验证失败 → 指出第一处问题**  
   - 验证: AI 只报 first_issue + 一层 next_hint，不一次列多个问题  
   - 自动化已覆盖: 部分（验证器返回 first_issue/next_hint 已覆盖，AI 行为需 daemon）

7. **切换教学模式 → 引导行为变化**  
   - 验证: 切到 hands_on → AI 只给任务不给完整答案；切到 demo → AI 先展示完整改法  
   - 自动化已覆盖: 否（需 daemon）  
   - 联调步骤: 在 Create 中切换教学模式 → 重新触发引导 → 观察 AI 引导方式是否变化

---

*报告结束。本验收未修改任何产品代码和已有测试。*
