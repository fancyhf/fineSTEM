# PBL 闭环自动化测试——交接 Prompt v1.0.0

> **目标受众**：测试 AI Agent（代码执行能力+读写权限，独立执行本任务）。
> **上一环节**：诊断 Agent（我）已完成根因定位 + 方案设计 + 方案审批。
> **你的任务**：按本文档实现确定性推进引擎 + 写自动化测试 + 跑通 + 出报告。

---

## 1. 背景与问题

### 1.1 项目概况

fineSTEM 是一个面向 10–18 岁学生的 STEM 项目式学习 (PBL) 平台。其"创造"工作台（`/create` 页面）应当实现一条完整的 PBL 闭环：

```
初始化 → 脑爆选题 → 开题立项 → 范围裁剪 → 轨道选择 → 设计蓝图 → 分步计划 → 执行开发 → 验收展示
stage_00    01         02        03         04        05         06        07         08
```

完整规范见：`.trae/skills/stem-pbl-guide/SKILL.md`（9 阶段状态机，每阶段有 AskUserQuestion 多轮对话、必须产出工件、门禁通过才能推进）。

### 1.2 核心问题（已诊断）

闭环不成立的真正原因：**整个 9 阶段状态机的"推进"被 100% 甩给 LLM 自由发挥，没有确定性引擎**。具体：

| 断裂点 | 位置 | 现象 |
|--------|------|------|
| 无确定性推进 | `orchestrator.py:432-439` 只读 current_stage，从不主动推进 | stage 推进全靠 LLM 心情调 `stage_advancer` 工具 |
| 零门禁 | `project_repo.py:280-299` advance_skill_state 纯 `idx+1` 无检查 | 即使工件全空也能推到 stage_08 |
| 工件不落盘 | `tools.py:349-356` ARTIFACT_CONTAINER_MAP 缺 constraints/track_plan；从不写文件 | spec 里的 00_brainstorm.md 等从未生成 |
| 前端答题不推进 | `Create.tsx:863-881` handleQuestionAnswer 把答题变普通聊天 | LLM 收到后常复读年龄/想法/时长三问，永远卡在前期 |
| 历史恢复半残 | `Create.tsx:30` buildStreamHistory 只取最后 12 条；L589 pendingQuestion 丢失 | "继续上次" 不成立 |
| 数据模型缺字段 | 无 stage_passed / schema_valid / rubric_passed / 依赖链 / stale | spec 的门禁校验无法实现 |

### 1.3 已有的证据

- `scripts/run_create_smoke.py`（最新版，smoke 脚本），已有 5 个前端 E2E spec + 2 个后端测试文件，最后一次干净终端运行盖章通过（`overall_passed: true`）。见 `.trae/documents/testing/create-smoke-summary_20260616_135129.json`。
- 教学模式（guided/demo/hands_on/lecture）的前端切换+后端提示词注入 已工作。
- 项目创建、代码保存/恢复、聊天保存/恢复 基本链路存在。

---

## 2. 你的交付物

| # | 交付物 | 说明 |
|---|--------|------|
| D1 | `apps/backend/app/services/pbl_engine.py` | 新建：确定性推进引擎 + 门禁 + 工件落盘 |
| D2 | `tools.py` 改动 | artifact_writer 补映射+双写，stage_advancer 带门禁 |
| D3 | `projects.py` 改动 | /advance 端点带门禁 + 新增 /pbl/complete-stage 端点 |
| D4 | `Create.tsx` 改动 | handleQuestionAnswer 自动推进 + context 回传 + 历史恢复修复 |
| D5 | `useStreamingChat.ts` 改动 | question 事件透传 stage/is_stage_final |
| D6 | `orchestrator.py` 改动 | question 事件附带 stage 标记 |
| D7 | `tests/test_pbl_engine.py` | 新建：确定性单测（mock LLM，断言 engine 逻辑） |
| D8 | `tests/test_projects.py` 扩展 | 新增 TestPBLFullLoop（API 集成，完全不碰 LLM） |
| D9 | `tests/specs/create-pbl-full-loop.spec.ts` | 新建：前端 E2E（确定性 API 驱动后端，断言前端渲染） |
| D10 | `scripts/run_pbl_loop_test.py` | 新建：一键跑 D7+D8+D9，产出 summary JSON 三件套 |
| D11 | 测试通过报告 | `.trae/documents/reports/PBL闭环测试通过报告_*.md`——你的签名 |

---

## 3. 实施指南（按顺序）

### 3.1 新建 `apps/backend/app/services/pbl_engine.py`（D1）

**目的**：集中管理 PBL 闭环的逻辑——门禁校验、带门禁的推进、工件落盘。此后 `tools.py`、`projects.py` 都通过它操作，不再直接调 `db.advance_skill_state`。

**接口设计**：

```python
# pbl_engine.py 对外导出

# 阶段→工件 映射（用于知道每个阶段该产出哪个工件）
ARTIFACT_FOR_STAGE: dict[str, str] = {
    "stage_00_bootstrap": None,        # 初始化阶段，无工件
    "stage_01_brainstorm": "brainstorm",
    "stage_02_brief": "project_brief",
    "stage_03_constraints": "constraints",
    "stage_04_track": "track_plan",
    "stage_05_design": "design",
    "stage_06_step_plan": "step_plan",
    "stage_07_execute": "dev_log",
    "stage_08_evaluate": "evaluate",
}

# 工件→storage key 映射（向 standard_step_data 写入用）
ARTIFACT_TO_BLOB_KEY: dict[str, str] = {
    "brainstorm": "brainstorm_content",
    "project_brief": "brief_content",
    "constraints": "constraints_content",
    "track_plan": "track_plan_content",
    "design": "design_content",
    "step_plan": "step_plan_content",
    "dev_log": "dev_log_content",
    "evaluate": "evaluate_content",
}

# 门禁：每个标准阶段的最小通过条件
# checker 签名：(standard_step_data: dict) -> (passed: bool, missing: list[str])
STAGE_GATES: dict[str, Callable] = { ... }

def check_gate(stage: str, standard_step_data: dict) -> tuple[bool, list[str]]:
    """检查阶段门禁。返回 (通过?, 缺失项列表)。"""

def advance_with_gate(project_id: str, db) -> AdvanceResult:
    """
    带门禁的阶段推进。
    - 读当前 stage + standard_step_data
    - 跑 check_gate
    - 通过则 db.advance_skill_state，返回 {success:True, new_stage, ...}
    - 不通过则返回 {success:False, current_stage, missing, stage_name}
    """

def save_artifact_to_disk(project_id: str, artifact_name: str, content: str, db) -> str | None:
    """
    将工件落盘到 projects/{slug}/docs/<name>.md (或 .json)。
    返回落盘路径；失败返回 None（不抛异常，因为落盘是辅助的，核心 blob 在 DB）。
    """

def save_artifact(project_id: str, artifact_name: str, content: str, db) -> dict:
    """
    统一工件写入：1) 写 standard_step_data.<blob_key>；2) 落盘到 docs/。
    """
```

**门禁规则**（从 SKILL.md 门禁表翻译，最小必要）：

| stage | 门禁条件 |
|-------|---------|
| stage_00_bootstrap | 始终通过（初始化阶段） |
| stage_01_brainstorm | brainstorm_content 非空（内容不限） |
| stage_02_brief | brief_content 非空（内容不限，LLM 生成什么就接受什么） |
| stage_03_constraints | constraints_content 非空 |
| stage_04_track | track_plan_content 非空 |
| stage_05_design | design_content 非空 |
| stage_06_step_plan | step_plan_content 非空 |
| stage_07_execute | dev_log_content 非空（至少有过一条开发记录） |
| stage_08_evaluate | evaluate_content 非空 |

> **设计原则**：门禁只要求工件 **存在且非空**——不做内容结构解析（如 json.loads 校验），因为 LLM 的输出格式不可控。严格 JSON schema 校验留到后续版本。当前目标：让闭环能确定性地**跑通**，而不是卡住。

**落盘路径**：

```
{STORAGE_BASE_PATH}/projects/{project_slug}/docs/
├── 00_brainstorm.md           # ← artifact_name="brainstorm"
├── 01_project_brief.md        # ← "project_brief"  (注：实际是 json，但落盘为 .md 因为 SKILL.md 模板是 md)
├── 02_constraints.md
├── 03_track_plan.md
├── 04_design.md
├── 05_step_plan.md
├── 06_dev_log.md
└── 07_evaluation.md
```

- `project_slug` 从 `db.get_project(project_id).name` 推导：小写 + 连字符替换空格/特殊字符。
- 落盘失败（如权限问题）不阻断流程——log warning 即可。

**实现提示**：
- `advance_with_gate` 读取 `standard_step_data`：`state.standard_step_data` 可能是 JSON 字符串或 dict，用 `json.loads` 做防呆。
- `db` 参数即 `apps/backend/app/repositories/runtime_db.py` 中的 `RepositoryBackedDB` 实例（已有 `get_skill_state`/`advance_skill_state`/`update_skill_state`/`get_project` 方法）。
- 文件操作前先 `Path(...).parent.mkdir(parents=True, exist_ok=True)`。
- 不引入新的第三方依赖。

### 3.2 改造 `apps/backend/app/services/tools.py`（D2）

**改动 1：`ArtifactWriterTool.ARTIFACT_CONTAINER_MAP`（L349）补全**

在现有 6 项映射后追加：
```python
"constraints": ("standard_step_data", "constraints_content"),
"track_plan": ("standard_step_data", "track_plan_content"),
```
（总共 8 个工件）

**改动 2：`ArtifactWriterTool.execute`（L358）改为调用 `pbl_engine.save_artifact`**

在 `if mapping:` 分支内，调用 `save_artifact(project_id, artifact_name, content, db)` 替代现在的纯 blob 写入。保留原有 `status`/`path` 返回格式不变。

**改动 3：`StageAdvancerTool.execute` 标准轨分支（L260-280）改为调用 `pbl_engine.advance_with_gate`**

替换现在的直接 `db.advance_skill_state(project_id)`。`advance_with_gate` 返回 `{success, current_stage, new_stage, missing}`——若 `success=False`，ToolResult 返回 `ToolResult(False, error="门禁未通过", data={"missing": missing})`。

### 3.3 改造 `apps/backend/app/api/projects.py`（D3）

**改动 1：`/advance` 端点（L733-776）**

将 `db.advance_skill_state(project_id)` 替换为 `pbl_engine.advance_with_gate(project_id, db)`：

```python
from app.services.pbl_engine import advance_with_gate

result = advance_with_gate(project_id, db)
if not result["success"]:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "message": "当前阶段未满足推进条件",
            "current_stage": result["current_stage"],
            "missing_requirements": result["missing"],
        },
    )
```

**改动 2：新增 `POST /{project_id}/pbl/complete-stage` 端点**（测试/驱动用）

```python
class CompleteStageRequest(BaseModel):
    stage: str  # 当前阶段标识，如 "stage_01_brainstorm"
    artifacts: dict[str, str]  # {artifact_name: content}，可一次提交多个

@router.post("/{project_id}/pbl/complete-stage", ...)
async def complete_stage(project_id, body: CompleteStageRequest, ...):
    """
    确定性推进：写入指定阶段的工件，并尝试带门禁推进到下一阶段。
    用于自动化测试——测试 agent 用固定工件样本逐阶段调用即可推完整条链。
    调用方需携带 X-PBL-Test: true 头（防止误用）。
    """
    # 1. 逐 artifact 写（调用 save_artifact）
    # 2. 尝试 advance_with_gate
    # 3. 返回 {current_stage, stage_changed, missing}
```

### 3.4 改造 `apps/frontend/src/pages/Create.tsx`（D4）

**改动 1：`handleQuestionAnswer`（L863-881）加自动推进**

答题后，若 `pendingQuestion.is_stage_final === true` 且有 `projectContext.projectId`，在发完聊天消息后延迟调用 `handleAdvanceStage`：

```typescript
const handleQuestionAnswer = useCallback((selectedIds: string[], customText?: string) => {
    // ... 现有逻辑 (L863-880) ...
    const sendText = `[选择] ${question.title}\n回答：${answerText}`;
    const shouldAutoAdvance = pendingQuestion?.is_stage_final === true
                           && projectContext.projectId != null
                           && !(projectContext.projectId.startsWith('local-'));
    setPendingQuestion(null);
    // ... 发送 ...
    if (shouldAutoAdvance) {
        setTimeout(() => handleAdvanceStage(), 500);  // 等 LLM 生成完后再推进
    }
}, [pendingQuestion, projectContext.projectId, ...]);
```

**改动 2：`handleSend`（L1079）context 恒传 `current_stage`**

在 L1096-1103 的 `effectiveContext` 构建中，**始终**加入 `current_stage: projectContext.currentStage`（现在只在 `directCodingIntent` 分支传）。改成无条件：

```typescript
let effectiveContext: Record<string, unknown> = {
    page: 'create',
    scene: sceneOverride || activeScene,
    authenticated: !!user,
    project_id: effectiveProjectId,
    teaching_mode: projectContext.teachingMode,
    current_stage: projectContext.currentStage,   // ← 恒传
    ...(requestOverrides?.context || {}),
};
```

**改动 3：历史恢复修复**

- `buildStreamHistory`（L23-31）：`slice(-12)` → `slice(-30)`。
- `applyWorkspaceRestore`（L588）：`setPendingQuestion(null)` → 尝试从 `workspace.chat_messages` 末条 assistant 消息解析 `<question>` 恢复。
- `normalizeWorkspaceMessages`（L81-104）：不再调用 `cleanAssistantMessageContent` 剥离 `<question>`——只在渲染时由 `EnhancedMarkdownText`/`QuestionCard` 解析处理。若 `normalizeWorkspaceMessages` 已做剥离，保留不改变其逻辑，仅确保恢复后的消息文本保留原始 XML。

**改动 4：新增 `completeStage` API 调用**（可选，供前端 E2E 测试使用）

在 `handleAdvanceStage` 失败时，展示 `missing_requirements` 给用户（而不仅是 "阶段推进失败"）。

### 3.5 扩展 `useStreamingChat.ts`（D5）

在 `question` 事件解析（约 L129-141）中透传后端新增字段：

```typescript
case 'question':
    const q = parsedData.data || parsedData;
    onQuestion?.({
        ...q,
        stage: q.stage,             // 透传
        is_stage_final: q.is_stage_final === true,  // 透传
    });
```

### 3.6 改造 `orchestrator.py`（D6）

在生成 `<question>` 块的逻辑中，附带当前阶段标记：

**位置**：`stream_chat_with_events` 中 `yield ("question", ...)` 处（L513-516 和 fallback 生成处）。

将 `question_data` 扩展：
```python
question_data["stage"] = last_known_stage or current_stage
question_data["is_stage_final"] = _is_last_question_for_stage(current_stage, question_data)
```

其中 `_is_last_question_for_stage` 是一个轻量启发式函数：若该阶段在 SKILL.md 中定义的问题轮数 ≤ 本轮的 `step/total_steps` 暗示，返回 True。这是一个**辅助信号**而非硬约束——即使误判为 False，LLM 仍可通过 `stage_advancer` 工具推进。

### 3.7 新建 `apps/backend/tests/test_pbl_engine.py`（D7）

**确定性单测**：完全不碰 LLM。使用 `conftest.py` 已有的 `client` fixture（含 TestClient 和 DB）。

测试类：

```python
class TestPBLGates:
    """门禁校验单元测试"""
    def test_bootstrap_always_passes(self): ...
    def test_brainstorm_gate_passes_with_content(self): ...
    def test_brainstorm_gate_fails_without_content(self): ...
    # 每个 stage 一个 pass + 一个 fail，共 9×2=18 个用例

class TestAdvanceWithGate:
    """带门禁推进集成测试"""
    def test_full_loop_stage_00_to_08(self, client, auth_headers, seeded_demo_id):
        """逐阶段写入工件 + 推进，断言终态 stage_08_evaluate"""
        # 1. 创建标准项目
        # 2. for stage in ["stage_00", ..., "stage_08"]:
        #       向 standard_step_data 写入对应工件
        #       调 /advance
        #       断言 current_stage 递进
        # 3. 断言终态 stage_08_evaluate

    def test_advance_blocked_when_artifact_missing(self, ...):
        """工件未写入时推进应被门禁拦截"""
```

**关键**：`test_full_loop` 是整条链的 **金标准验证**——纯确定性、无 LLM、可秒级复现。

### 3.8 `test_projects.py` 扩展（D8）

在现有 `tests/test_projects.py` 末尾新增：

```python
class TestPBLFullLoop:
    """PBL 闭环全链路 API 集成测试（确定性，不碰 LLM）"""
    def test_complete_stage_endpoint_drives_full_loop(self, client, auth_headers):
        """用 /pbl/complete-stage 端点逐阶段推完整条链"""
        # 对比 test_pbl_engine.py 的 test_full_loop，这条走完整 HTTP 层
        # 额外断言：每个 docs 文件落盘到 projects/{slug}/docs/

    def test_workspace_restores_pbl_artifacts(self, client, auth_headers):
        """推进到 stage_08 后，/workspace 恢复数据完整"""
```

### 3.9 新建 `apps/frontend/tests/specs/create-pbl-full-loop.spec.ts`（D9）

**确定性 E2E**：用 API 直推后端到 stage_07，然后在前端断言渲染正确。

```typescript
test('确定性推进到 stage_07 后前端完整渲染', async ({ authenticatedPage, testUser }) => {
    // 1. 建项目（调 API）
    // 2. 连续调 /pbl/complete-stage 逐阶段推进到 stage_07
    // 3. 调 /code 写入示例代码
    // 4. 调 /chat 写入聊天历史
    // 5. 导航到 /create
    // 6. 断言：StageProgressBar 显示 stage_07
    // 7. 断言：教学模式切换器可见（teachingModeSelector）
    // 8. 断言：编辑器有代码（editorCode 区域不空）
    // 9. 断言：聊天历史已恢复（消息列表至少 2 条）
});
```

> 不需要启动 LLM——所有状态通过 API 直推。这是纯前端渲染验证。

### 3.10 新建 `scripts/run_pbl_loop_test.py`（D10）

类似于 `scripts/run_create_smoke.py` 的模式，但是跑 PBL 闭环测试：

```
python scripts/run_pbl_loop_test.py
```

**流程**：
1. `ensure_test_dirs()` — 清理 test DB
2. `run_backend_pbl_tests()` — pytest 跑 `test_pbl_engine.py + test_projects.py::TestPBLFullLoop`，产 backend log
3. `start_backend_server()` — 起 uvicorn @ 3200
4. `run_frontend_pbl_e2e()` — playwright 跑 `create-pbl-full-loop.spec.ts`
5. `stop_services()` — 关服务
6. 产出 `pbl-loop-summary_*.json` + 对应的 log 文件（落到 `.trae/documents/testing/`）

### 3.11 跑通验证 + 产出报告（D11）

按以下顺序验证：

| 步骤 | 命令 | 判据 |
|------|------|------|
| S1 | `cd apps/backend && python -m pytest tests/test_pbl_engine.py -v` | 全绿，18+ 用例 |
| S2 | `cd apps/backend && python -m pytest tests/test_projects.py::TestPBLFullLoop -v` | 全绿 |
| S3 | 启动后端+前端，进 `/create`，用 API 直推到 stage_07，断言前端正确渲染 | 通过 |
| S4 | `python scripts/run_create_smoke.py`（原有 smoke） | 仍通过，不回归 |
| S5 | `python scripts/run_pbl_loop_test.py` | exit 0，summary overall_passed=true |

全部通过后，撰写 `PBL闭环测试通过报告_*.md`，内容：
- 每步的 pass/fail 状态 + 耗时
- 最终结论
- 附 S4 的 smoke summary（证明不回归）

---

## 4. 验收标准（测试 agent 按此判断任务完成）

| # | 标准 | 方法 |
|---|------|------|
| C1 | `pbl_engine.py` 存在且导出接口完整 | 读文件 |
| C2 | `advance_with_gate` 可确定性地推进 stage_00→stage_08（有工件时） | 跑 S1/S2 |
| C3 | `advance_with_gate` 在工件缺失时拒绝推进（返回 missing） | 跑 S1/S2 的 fail 用例 |
| C4 | 工件落盘到 `projects/{slug}/docs/` 目录 | 检查文件系统 |
| C5 | `/pbl/complete-stage` 端点可用 | 跑 S2 |
| C6 | 前端在 stage_07 正确渲染阶段条+教学模式+编辑区 | 跑 S3 |
| C7 | 原始 smoke 不回归 | 跑 S4 |
| C8 | `run_pbl_loop_test.py` 一键全通过 | 跑 S5 |

---

## 5. 注意事项

1. **不要回滚教学模式逻辑**（guided/demo/hands_on/lecture）——教学模式的提示词注入和前端切换是已有的正确功能，保持不动。
2. **不要改坏 `stem-pbl-guide` skill 的引导式 PBL 主路径**——只增强推进路径，不改变对话引导逻辑。
3. **不要硬编码只支持 Python**——`save_artifact` 的落盘文件名由工件名决定，不假设语言。
4. **数据模型零迁移**：所有门禁信息从已有字段派生，不新增 DB 列。
5. **真 LLM 端到端"自然对话跑通"仍可能偶发波动**——那是 LLM 自身的不确定性，不在本次范围。本次目标是**确定性引擎 + 测试**覆盖主路径。
6. **cleanAssistantMessageContent 剥离 `<question>` 逻辑**：这是前端现有的做法（Clean.tsx:57），如果移除可能导致渲染异常。建议改为：剥离逻辑保留，但在 `normalizeWorkspaceMessages` 里对历史消息不做剥离（仅对发送给 LLM 的 `buildStreamHistory` 做剥离）。这是一个谨慎的权衡——测试 agent 根据实际渲染效果决定是否调整。

---

## 6. 参考文件索引

| 文件（绝对路径） | 用途 |
|---|---|
| `G:\mediaProjects\fineSTEM\.trae\skills\stem-pbl-guide\SKILL.md` | PBL 9 阶段门禁规范 |
| `G:\mediaProjects\fineSTEM\.trae\skills\stem-pbl-guide\README.md` | PBL 使用指南 |
| `G:\mediaProjects\fineSTEM\apps\backend\app\services\orchestrator.py` | 聊天流 + 系统提示构建 |
| `G:\mediaProjects\fineSTEM\apps\backend\app\services\tools.py` | 9 个 LLM 工具（StageAdvancer/ArtifactWriter 等） |
| `G:\mediaProjects\fineSTEM\apps\backend\app\api\projects.py` | /advance、/workspace、/code、/chat 等端点 |
| `G:\mediaProjects\fineSTEM\apps\backend\app\repositories\project_repo.py` | STAGES 常量、advance_skill_state、update_skill_state |
| `G:\mediaProjects\fineSTEM\apps\backend\app\repositories\runtime_db.py` | RepositoryBackedDB 接口 |
| `G:\mediaProjects\fineSTEM\apps\backend\app\core\config.py` | STORAGE_BASE_PATH 等配置 |
| `G:\mediaProjects\fineSTEM\apps\frontend\src\pages\Create.tsx` | 创造页主文件（handleQuestionAnswer/handleSend/handleAdvanceStage/applyWorkspaceRestore） |
| `G:\mediaProjects\fineSTEM\apps\frontend\src\hooks\useStreamingChat.ts` | WS 事件解析 |
| `G:\mediaProjects\fineSTEM\apps\frontend\src\services\api.ts` | 前端 API 封装 |
| `G:\mediaProjects\fineSTEM\apps\frontend\tests\specs\create-guided-pbl-mainline.spec.ts` | 现有 PBL 主链路 E2E |
| `G:\mediaProjects\fineSTEM\apps\frontend\tests\fixtures.ts` | E2E 共享 fixture |
| `G:\mediaProjects\fineSTEM\apps\backend\tests\conftest.py` | 后端测试 fixture |
| `G:\mediaProjects\fineSTEM\apps\backend\tests\test_projects.py` | 现有后端测试（含 TeachingMode 测试，可参考 mock 模式） |
| `G:\mediaProjects\fineSTEM\scripts\run_create_smoke.py` | 现有 smoke 脚本（参考结构） |
| `G:\mediaProjects\fineSTEM\.trae\documents\testing\create-smoke-summary_20260616_135129.json` | 最新 smoke 通过凭证 |

---

## 7. 任务结束条件

完成 D1–D10 全部交付物，且 S1–S5 全部通过，产出 D11 测试通过报告，即可标记本任务完成。

**遇到阻塞时**：先检查日志（pytest 输出 / playwright 截图），对照第 6 节的参考文件排查。如果的确遇到本 Prompt 未覆盖的情况（如某个现有 API 的行为与本文档假设不一致），**以实际行为为准调整实现**，并在报告里记录差异。

---

*创建时间：2026-06-16*
*创建者：诊断 Agent（根因分析 + 方案设计）*
*目标受众：测试 AI Agent（执行实现 + 测试 + 出报告）*
