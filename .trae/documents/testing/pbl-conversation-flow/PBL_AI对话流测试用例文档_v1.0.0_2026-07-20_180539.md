# PBL AI 对话流测试用例文档 v1.0.0

**文档版本**: v1.0.0  
**创建日期**: 2026-07-20  
**适用范围**: fineSTEM Create 页面 AI 对话流  
**测试目标**: 验证 AI 对话流完整性、选项识别、阶段推进、回复不被截断

---

## 1. 测试概述

### 1.1 测试目标

- 验证 AI 能正确与学生沟通，进行开题和阶段推进
- 验证 AI 对话正常、完整，回复不会被截断
- 验证选项能被正确识别和处理
- 验证 UI 支持多选项卡、单选、多选

### 1.2 测试范围

| 模块 | 测试内容 |
|------|----------|
| 后端 API | 对话接口、选项解析、阶段管理 |
| 前端 UI | QuestionCard 组件、消息流、选项交互 |
| 集成测试 | 端到端对话流程 |

### 1.3 测试环境

- **后端**: http://localhost:3200
- **前端**: http://localhost:5184
- **ZeroClaw Gateway**: ws://127.0.0.1:42617
- **浏览器**: Chromium/Chrome

---

## 2. 测试用例详情

### 2.1 后端单元测试

#### TC-BE-001: 选择消息格式解析

**前置条件**: 无

**测试步骤**:
1. 调用 `_parse_selection_format("[选择:time-2h] 2小时")`
2. 调用 `_parse_selection_format("[选择：web] Web应用")`
3. 调用 `_parse_selection_format("普通消息")`

**预期结果**:
- 步骤1返回 `("[选择]", "time-2h")`
- 步骤2返回 `("[选择]", "web")`
- 步骤3返回 `None`

**测试文件**: `apps/backend/tests/test_pbl_dialogue_flow.py::TestSelectionFormatParsing`

---

#### TC-BE-002: Bootstrap 三问流程 - 年级选择

**前置条件**: 项目处于 stage_00_bootstrap

**测试步骤**:
1. 用户发送 `[选择:junior] 初中`
2. 系统调用 `_build_bootstrap_followup`

**预期结果**:
- 返回跟进问题和选项
- 问题标题为 "你打算花多长时间完成这个项目？"
- 步骤显示为 2/3
- 选项包含 time-2h, time-6h, time-1d, time-3d

**测试文件**: `apps/backend/tests/test_pbl_dialogue_flow.py::TestBootstrapFollowup::test_build_bootstrap_followup_grade_selection`

---

#### TC-BE-003: Bootstrap 三问流程 - 时间选择

**前置条件**: 已完成年级选择

**测试步骤**:
1. 用户发送 `[选择:time-6h] 6小时`
2. 系统调用 `_build_bootstrap_followup`

**预期结果**:
- 返回跟进问题和选项
- 问题标题为 "你有初步想法了吗？"
- 步骤显示为 3/3
- 选项包含 brainstorm, direction, idea

**测试文件**: `apps/backend/tests/test_pbl_dialogue_flow.py::TestBootstrapFollowup::test_build_bootstrap_followup_time_selection`

---

#### TC-BE-004: 教学模式 - html_visual

**前置条件**: 项目处于 stage_07_execute

**测试步骤**:
1. 设置 teaching_mode 为 "html_visual"
2. 调用 `_build_teaching_mode_instruction`

**预期结果**:
- 返回的指令包含 "html_visual"
- 指令包含 "HTML可视化" 关键词
- 指令包含 "Mermaid" 关键词

**测试文件**: `apps/backend/tests/test_pbl_dialogue_flow.py::TestTeachingModes::test_build_teaching_mode_instruction_html_visual`

---

#### TC-BE-005: 阶段门禁 - 早期阶段阻止代码生成

**前置条件**: 项目处于 stage_00_bootstrap / stage_01_brainstorm / stage_02_brief

**测试步骤**:
1. 用户发送 "下一步做什么"（无代码意图）
2. 调用 `_should_force_code_generation`

**预期结果**:
- 返回 `False`
- 系统不触发代码生成

**测试文件**: `apps/backend/tests/test_pbl_dialogue_flow.py::TestStageGate::test_early_stages_block_code_generation`

---

#### TC-BE-006: 代码意图检测

**前置条件**: 无

**测试步骤**:
1. 调用 `_has_direct_code_intent("给我完整代码")`
2. 调用 `_has_direct_code_intent("现在什么阶段")`

**预期结果**:
- 步骤1返回 `True`
- 步骤2返回 `False`

**测试文件**: `apps/backend/tests/test_pbl_dialogue_flow.py::TestCodeIntentDetection`

---

#### TC-BE-007: ask_question 工具 - 基本调用

**前置条件**: 无

**测试步骤**:
1. 创建 AskQuestionTool 实例
2. 调用 execute 方法，参数包含 title 和 options

**预期结果**:
- 返回结果 success 为 True
- 返回数据包含 title 字段
- 返回数据包含 options 数组

**测试文件**: `apps/backend/tests/test_pbl_dialogue_flow.py::TestAskQuestionToolIntegration::test_ask_question_tool_returns_correct_format`

---

#### TC-BE-008: ask_question 工具 - 多选支持

**前置条件**: 无

**测试步骤**:
1. 调用 execute 方法，设置 multiple: true
2. 传入多个选项

**预期结果**:
- 返回结果 success 为 True
- 返回数据中 multiple 为 True

**测试文件**: `apps/backend/tests/test_pbl_dialogue_flow.py::TestAskQuestionToolIntegration::test_ask_question_tool_multiple_selection`

---

### 2.2 前端 E2E 测试

#### TC-FE-001: 单选选项卡显示和交互

**前置条件**: 用户已登录，处于 Create 页面

**测试步骤**:
1. 在聊天输入框输入 "我想做一个新项目"
2. 按 Enter 发送
3. 等待选项卡片出现
4. 点击第一个选项
5. 点击第二个选项

**预期结果**:
- 步骤3：选项卡片在 30 秒内可见
- 步骤4：第一个选项显示选中状态（高亮/边框）
- 步骤5：第二个选项被选中，第一个取消选中（单选模式）

**测试文件**: `apps/frontend/tests/specs/pbl-question-card-full-test.spec.ts::'应该支持单选选项卡'`

---

#### TC-FE-002: 多选选项卡显示和交互

**前置条件**: 用户已登录，处于 Create 页面

**测试步骤**:
1. 输入 "选择你的兴趣爱好（可多选）"
2. 按 Enter 发送
3. 等待选项卡片出现
4. 点击第一个选项
5. 点击第二个选项
6. 再次点击第一个选项

**预期结果**:
- 步骤3：选项卡片可见
- 步骤4：第一个选项被选中
- 步骤5：第一个和第二个选项都被选中（多选模式）
- 步骤6：第一个选项取消选中，第二个保持选中

**测试文件**: `apps/frontend/tests/specs/pbl-question-card-full-test.spec.ts::'应该支持多选选项卡'`

---

#### TC-FE-003: 多选项卡同时显示

**前置条件**: 用户已登录

**测试步骤**:
1. 输入 "请帮我规划项目，需要了解年级、时间和想法"
2. 按 Enter 发送
3. 等待响应

**预期结果**:
- 可能显示一张或多张选项卡片
- 每张卡片都有标题和选项
- 每张卡片都可以独立交互

**测试文件**: `apps/frontend/tests/specs/pbl-question-card-full-test.spec.ts::'应该支持多张选项卡同时显示'`

---

#### TC-FE-004: 选项 ID 和标签显示

**前置条件**: 选项卡片已显示

**测试步骤**:
1. 查看第一个选项
2. 检查 data-option-id 属性
3. 检查选项文本

**预期结果**:
- 选项有 data-option-id 属性（如 "junior", "web"）
- 选项显示标签文本（如 "初中", "Web应用"）

**测试文件**: `apps/frontend/tests/specs/pbl-question-card-full-test.spec.ts::'选项应该显示正确的ID和标签'`

---

#### TC-FE-005: 选择后发送正确格式消息

**前置条件**: 选项卡片已显示

**测试步骤**:
1. 点击第一个选项
2. 点击确定按钮
3. 查看用户消息列表

**预期结果**:
- 最后一条用户消息包含 `[选择:选项ID]` 格式
- 消息包含选项标签文本

**测试文件**: `apps/frontend/tests/specs/pbl-question-card-full-test.spec.ts::'选择后应该发送正确的 [选择:选项ID] 格式消息'`

---

#### TC-FE-006: 多选后发送包含所有选项的消息

**前置条件**: 多选选项卡片已显示

**测试步骤**:
1. 点击第一个选项
2. 点击第二个选项
3. 点击确定按钮
4. 查看用户消息

**预期结果**:
- 消息包含 `[选择:` 标记
- 消息包含第一个选项的标签
- 消息包含第二个选项的标签

**测试文件**: `apps/frontend/tests/specs/pbl-question-card-full-test.spec.ts::'多选后应该发送包含所有选中选项的消息'`

---

#### TC-FE-007: 步骤进度显示

**前置条件**: Bootstrap 流程中

**测试步骤**:
1. 触发带步骤的 ask_question
2. 查看选项卡片

**预期结果**:
- 卡片显示步骤指示器
- 格式为 "当前步 / 总步数"（如 "1 / 3"）

**测试文件**: `apps/frontend/tests/specs/pbl-question-card-full-test.spec.ts::'选项卡应该显示步骤进度'`

---

#### TC-FE-008: AI 识别选择格式并继续流程

**前置条件**: 聊天历史中有选择记录

**测试步骤**:
1. 预设聊天历史包含 `[选择:time-6h] 6小时`
2. 发送 "继续"
3. 等待 AI 回复

**预期结果**:
- AI 回复不包含 "你没选"
- AI 回复不包含 "等你选择"
- AI 回复推进到下一步流程

**测试文件**: `apps/frontend/tests/specs/pbl-question-card-full-test.spec.ts::'AI 应该正确识别 [选择:选项ID] 格式并继续流程'`

---

#### TC-FE-009: 回复完整性 - 不被截断

**前置条件**: 用户已登录

**测试步骤**:
1. 输入 "请详细解释如何从零开始规划一个完整的 STEM 项目"
2. 按 Enter 发送
3. 等待 20 秒
4. 查看 AI 回复

**预期结果**:
- 回复长度大于 200 字符
- 回复不以未完成词结尾（如 "首先", "然后"）
- 代码块成对出现（``` 数量为偶数）

**测试文件**: `apps/frontend/tests/specs/pbl-question-card-full-test.spec.ts::'回复不应该被截断，应该有完整内容'`

---

#### TC-FE-010: 从 Bootstrap 推进到 Brainstorm

**前置条件**: 新建项目

**测试步骤**:
1. 发送 "开始新项目"
2. 选择年级选项
3. 选择时间选项
4. 选择想法选项
5. 等待 AI 回复

**预期结果**:
- AI 回复包含脑爆、选题、想法、方向等关键词
- 进入 Brainstorm 阶段

**测试文件**: `apps/frontend/tests/specs/pbl-stage-progression.spec.ts::'应该能从 bootstrap 推进到 brainstorm 阶段'`

---

#### TC-FE-011: 各阶段正确指导

**前置条件**: 项目处于不同阶段

**测试步骤**:
对每个阶段（stage_00 到 stage_08）:
1. 设置当前阶段
2. 发送 "请给我指导"
3. 查看 AI 回复

**预期结果**:
- 每个阶段的回复包含对应关键词
- 回复长度大于 50 字符

**测试文件**: `apps/frontend/tests/specs/pbl-stage-progression.spec.ts::'AI 应该能正确识别所有阶段并给出对应指导'`

---

#### TC-FE-012: 对话连贯性

**前置条件**: 有聊天历史

**测试步骤**:
1. 预设多轮对话历史
2. 发送 "继续"
3. 查看 AI 回复

**预期结果**:
- AI 不重复已回答的问题
- AI 继续推进流程

**测试文件**: `apps/frontend/tests/specs/pbl-stage-progression.spec.ts::'AI 对话应该连贯，不重复提问'`

---

#### TC-FE-013: 长对话上下文保持

**前置条件**: 用户已登录

**测试步骤**:
1. 进行多轮对话（4-5轮）
2. 最后询问 "我们刚才说要做什么项目？"
3. 查看 AI 回复

**预期结果**:
- AI 记得之前提到的项目类型（如 "记账工具"）

**测试文件**: `apps/frontend/tests/specs/pbl-stage-progression.spec.ts::'长对话不应该丢失上下文'`

---

#### TC-FE-014: 教学模式生效

**前置条件**: 项目处于可执行代码阶段

**测试步骤**:
对每个教学模式（guided, demo, hands_on, lecture）:
1. 切换到对应模式
2. 请求代码指导
3. 查看 AI 回复

**预期结果**:
- guided: 回复包含 TODO 或框架
- demo: 回复包含完整代码块
- hands_on: 回复包含挑战或任务
- lecture: 回复包含原理解释

**测试文件**: `apps/frontend/tests/specs/pbl-stage-progression.spec.ts::'教学模式应该在对话中生效'`

---

### 2.3 Bug 修复验证测试（2026-07-20 新增）

#### TC-BUG-001: 状态汇报信息不应被误识别为选项

**问题描述**:
AI 回复中包含"项目现状"、"讨论历史"等状态汇报信息时，这些内容被错误地解析为选项卡片，导致：
1. 显示错误的选项（如"项目现状"、"讨论历史"作为可点击选项）
2. 真正的选项（1、2、3 编号选项）可能被忽略或混淆

**前置条件**: 无

**测试步骤**:
1. 调用 `isStatusLine("项目现状")`
2. 调用 `isStatusLine("讨论历史")`
3. 调用 `isStatusLine("项目 ID：4e8f476a-b765-458d-a203-02c052f829e8")`
4. 调用 `extractQuestionsFromText()` 解析包含状态信息的完整 AI 回复
5. 验证解析结果中不包含状态相关选项

**预期结果**:
- 步骤 1-3 返回 `true`（识别为状态行）
- 步骤 4 解析出的选项不包含"项目现状"、"讨论历史"等状态标题
- 真正的选项（编号列表）能被正确识别

**修复方案**:
在 `questionParser.ts` 的 `isStatusLine()` 函数中新增：
- 状态汇报标题检测：`项目现状`、`讨论历史`、`项目信息`、`当前状态`、`历史记录`、`基本信息`
- UUID/GUID 行检测（匹配 UUID 格式的正则）
- 键值对中的状态字段名：`创建时间`、`修改时间`

**测试文件**: `apps/frontend/tests/specs/question-parsing-bugs.spec.ts::'BUG-1: 状态汇报信息误识别为选项'`

---

#### TC-BUG-002: 选择选项后系统应继续执行

**问题描述**:
用户点击 QuestionCard 的选项并确认后，系统没有继续执行（AI 没有响应）。

**根本原因**:
`handleQuestionAnswer` 函数中存在 React 状态更新竞态条件：
1. 调用 `setIsLoading(false)` 是异步操作
2. 50ms 后调用 `handleSend()`
3. `handleSend()` 开头检查 `if (!message || isLoading) return;`
4. 由于 React 异步更新，`isLoading` 可能仍为 `true`，导致函数直接返回

**前置条件**: 选项卡片已显示

**测试步骤**:
1. 触发显示选项卡片的对话
2. 点击第一个选项
3. 点击确定/下一步按钮
4. 等待系统响应（最多 30 秒）
5. 验证是否有新的 AI 消息或 loading 状态正常结束

**预期结果**:
- 步骤 4 后系统正常响应（loading 结束，出现新消息）
- 不应出现 loading 持续超过 30 秒的情况
- 用户消息以 `[选择:选项ID] 标签文本` 格式发送

**修复方案**:
引入 `isLoadingRef`（useRef）实现同步状态控制：
1. 在 `handleQuestionAnswer` 中先同步设置 `isLoadingRef.current = false`
2. 再调用异步的 `setIsLoading(false)`
3. 修改 `handleSend` 的检查逻辑，使用 `isLoadingRef` 进行同步判断
4. 将延迟从 50ms 增加到 100ms

**测试文件**: `apps/frontend/tests/specs/question-parsing-bugs.spec.ts::'BUG-2: 选择选项后系统继续执行'`

---

#### TC-BUG-003: "其他"选项输入后应能正常提交

**前置条件**: 选项卡片已显示且支持自定义输入

**测试步骤**:
1. 显示选项卡片
2. 点击"其他"选项
3. 在文本框输入自定义文字（如"从第一步开始"）
4. 点击确定按钮
5. 验证消息是否正确发送

**预期结果**:
- 用户消息包含输入的自定义文字
- 系统继续执行后续流程

**测试文件**: `apps/frontend/tests/specs/question-parsing-bugs.spec.ts::'在"其他"选项中输入文字后应该能正常提交'`

---

#### TC-BUG-004: 回归测试 - 选项解析功能完整性

**目标**: 确保上述修复不破坏现有的选项解析功能

**测试步骤**:
1. 测试正常的单选选项解析
2. 测试带描述的多选选项解析
3. 测试 XML 格式 question 解析

**预期结果**:
- 所有现有功能正常工作
- 选项数量和标签正确

**测试文件**: `apps/frontend/tests/specs/question-parsing-bugs.spec.ts::'回归测试：选项解析功能完整性'`

---

#### TC-BUG-005: AI 回复被截断/吞掉（内容过短）

**问题描述**:
AI 的回复只有一句话（如"先请回答上面的问题，我会根据你的年级来推荐合适的项目方向！🙌"），后续内容被吞掉。用户看不到完整的回复和选项。

**根本原因**:
1. AI 在调用 `ask_question` 工具前只输出了简短的引导语
2. 后端的 `_is_output_truncated` 函数没有检测到这种"引导语+emoji"结尾是截断
3. "强制续接"逻辑也没有覆盖这种情况（只检查代码块相关特征）

**前置条件**: AI 回复包含工具调用且回复内容少于 150 字符

**测试步骤**:
1. 发送触发 `ask_question` 工具的消息
2. 等待 AI 回复
3. 检查回复长度是否大于 150 字符
4. 检查后端日志是否有 `output_might_be_incomplete` 记录

**预期结果**:
- 如果回复太短且包含引导性关键词，后端应自动触发续接
- 续接后的完整回复应超过 200 字符
- 用户应能看到完整的回复内容

**修复方案**:
增强后端的"强制续接"逻辑，新增检测条件：
1. **引导性语句检测**：输出 < 150 字符且包含"先请回答"、"我会根据"等关键词 → 触发续接
2. **短 emoji 结尾检测**：输出 < 200 字符且以 emoji 结尾但没有标点符号 → 触发续接
3. **统一内容处理**：无论是否有工具调用，都正确处理 AI 输出的内容并发送给前端

**修复文件**: `apps/backend/app/services/orchestrator.py`

---

## 3. 测试执行指南

### 3.1 后端测试执行

```powershell
# 进入后端目录
cd apps/backend

# 运行所有 PBL 对话流测试
python -m pytest tests/test_pbl_dialogue_flow.py -v

# 运行特定测试
python -m pytest tests/test_pbl_dialogue_flow.py::TestSelectionFormatParsing -v
python -m pytest tests/test_pbl_dialogue_flow.py::TestBootstrapFollowup -v

# 生成测试报告
python -m pytest tests/test_pbl_dialogue_flow.py -v --html=report.html
```

### 3.2 前端测试执行

```powershell
# 进入测试目录
cd apps/frontend/tests

# 安装依赖
npm install

# 运行所有 Playwright 测试
npx playwright test

# 运行特定测试文件
npx playwright test specs/pbl-question-card-full-test.spec.ts
npx playwright test specs/pbl-stage-progression.spec.ts

# 运行特定测试用例
npx playwright test -g "应该支持单选选项卡"

#  headed 模式（可见浏览器）
npx playwright test --headed

# 生成报告
npx playwright show-report
```

### 3.3 环境准备

**后端环境变量**:
```env
ZEROCLAW_GATEWAY_URL=http://127.0.0.1:42617
ZEROCLAW_API_KEY=your-api-key
DEEPSEEK_KEY=your-deepseek-key
```

**前端环境变量**:
```env
VITE_ZC_URL=http://127.0.0.1:42617
VITE_ZC_TOKEN=your-token
VITE_ZC_AGENT=assistant
```

---

## 4. 测试结果记录模板

### 4.1 测试执行记录

| 测试ID | 执行日期 | 执行人 | 结果 | 备注 |
|--------|----------|--------|------|------|
| TC-BE-001 | 2026-07-20 | AI | ✅ 通过 | - |
| TC-BE-002 | 2026-07-20 | AI | ✅ 通过 | - |
| ... | ... | ... | ... | ... |

### 4.2 问题记录

| 问题ID | 测试ID | 问题描述 | 严重程度 | 状态 | 修复日期 |
|--------|--------|----------|----------|------|----------|
| BUG-001 | TC-FE-009 | AI 回复偶尔被截断 | 高 | 已修复 | 2026-07-20 |
| ... | ... | ... | ... | ... | ... |

---

## 5. 附录

### 5.1 相关文档

- [fineSTEM_AI对话流设计规格_v1.0.0.md](../产品与规划/fineSTEM_AI对话流设计规格_v1.0.0.md)
- [ZeroClaw_技术知识库_v1.0.0.md](../技术与架构/ZeroClaw_技术知识库_v1.0.0.md)

### 5.2 相关代码文件

**后端**:
- `apps/backend/app/services/orchestrator.py` - 编排服务
- `apps/backend/app/services/tools.py` - 工具定义
- `apps/backend/app/services/providers/zeroclaw_provider.py` - ZeroClaw 适配器

**前端**:
- `apps/frontend/src/hooks/useStreamingChat.ts` - WebSocket 处理
- `apps/frontend/src/pages/Create.tsx` - Create 页面
- `apps/frontend/src/components/features/QuestionCard.tsx` - 选项卡片

**测试**:
- `apps/backend/tests/test_pbl_dialogue_flow.py` - 后端单元测试
- `apps/frontend/tests/specs/pbl-question-card-full-test.spec.ts` - 前端 E2E 测试
- `apps/frontend/tests/specs/pbl-stage-progression.spec.ts` - 阶段推进测试

---

**文档结束**
