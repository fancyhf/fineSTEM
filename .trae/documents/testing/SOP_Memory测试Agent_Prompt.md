# SOP & Memory 测试任务 R03

你是测试 agent。对 fineSTEM 的 SOP + Memory 功能变更执行全场景测试（第 3 轮）。

---

## 背景（必读）

R01 发现 2 项阻塞，R02 修了 auto_approve 和 test_mcp_server 回归，但 pbl-stage-flow SOP 仍未创建。**R03 前，开发 agent 已补齐所有遗留问题**：

| 遗留问题 | R02 状态 | R03 预期 |
|---------|---------|---------|
| `[sop]` 段不存在 | ❌ | ✅ 已加（sops_dir 绝对路径） |
| pbl-stage-flow SOP 未创建 | ❌ | ✅ 已创建（Steps: 9，validate 通过） |
| `[memory]` 段仅 backend=sqlite | ❌ | ✅ 已扩展（search_mode=bm25 等 6 字段） |
| auto_approve 缺新工具名 | ✅部分 | ✅ 已追加 3 finestem__ + 7 内置工具名 |
| system_prompt 无记忆规范 | ❌ | ✅ 已追加 5 条记忆使用规范 |
| 前端 M7 未实施 | ❌ | ✅ 已实施（buildOutgoingMessage + tool_result + StreamEvents） |
| TOOLS.md 未更新 | ❌ | ✅ 已更新（3 新工具 + 双重命名说明） |

---

## ⚠️ 最关键：先重启 daemon

**R02 失败的根因是 daemon 跑旧配置**。R03 的所有改动都在 config.toml，**daemon 不重启则全部配置验证失败**。

```bash
# 1. 停掉旧 daemon
tasklist | findstr zeroclaw
taskkill /F /IM zeroclaw.exe

# 2. 启动新 daemon（重定向日志确认加载了新配置）
H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon > .trae/documents/testing/logs/2026-07-22/daemon-startup.log 2>&1 &
# 或前台启动观察输出

# 3. 等待就绪
sleep 5
curl -s http://127.0.0.1:42617/health

# 4. 立即验证 daemon 加载了新配置
H:\dev-env\zeroclaw\bin\zeroclaw.exe sop list
# 预期：含 pbl-stage-flow（Steps: 9），不再只有 test-sop
```

---

## 红线

- **禁止改产品代码**（`apps/backend/app/`、`apps/frontend/src/` 非测试文件、`H:/dev-env/zeroclaw/config/`）
- **禁止 fix bug**，只记录 + 给修改建议
- 每个结果必须有日志/截图支撑
- WS 测试脚本必须设 `PYTHONIOENCODING=utf-8`（否则 GBK 控制台因 emoji 崩溃）

## 必读

1. `.trae/documents/testing/SOP_Memory专项测试计划_v1.0.0.md`（v1.1.0 版本，76 用例）
2. `.trae/documents/testing/测试工作指南_v1.0.0.md` — 测试规范

---

## 执行步骤

### 1. 配置验证（12 例，**R01/R02 有 7 项失败，R03 需全部通过**）

```bash
cd H:/dev-env/zeroclaw/bin

./zeroclaw.exe config migrate                          # TC-001 退出码 0
./zeroclaw.exe config get memory.backend               # TC-002 = sqlite
./zeroclaw.exe config get memory.search_mode           # TC-003 = bm25 ← R02 是 hybrid
./zeroclaw.exe config get memory.embedding_provider     # TC-004 = none
./zeroclaw.exe config get memory.keyword_weight        # TC-005 = 1.0（新增）
./zeroclaw.exe config get memory.auto_save             # TC-006 = true（新增）
./zeroclaw.exe config get sop.sops_dir                 # TC-007 = 绝对路径 ← R02 是 unset
./zeroclaw.exe sop list                                # TC-008 含 pbl-stage-flow, 9 steps ← R02 没有
./zeroclaw.exe sop validate pbl-stage-flow             # TC-009 ✅ 有效 ← R02 是 not found
./zeroclaw.exe sop show pbl-stage-flow                 # TC-010 9 阶段步骤详情
./zeroclaw.exe status                                  # 辅助确认
```

TC-011/012：读 `config.toml` 的 auto_approve，确认含：
- 3 个 finestem__ 工具：`finestem__project_memory_store`、`finestem__project_memory_recall`、`finestem__sop_state_sync`
- 7 个内置工具：`memory_store`、`memory_recall`、`memory_forget`、`sop_execute`、`sop_status`、`sop_approve`、`sop_advance`

存日志：`zeroclaw-status.txt`、`zeroclaw-sop-list.txt`、`zeroclaw-sop-show.txt`

### 2. 后端单元测试（28 例）

```bash
cd G:/mediaProjects/fineSTEM/apps/backend

# 核心回归（87 例应全通过）
.venv/Scripts/python.exe -m pytest tests/test_stage_constants.py tests/test_tools_gates.py tests/test_check_gate_structural.py tests/test_mcp_server.py -v --junitxml=../../.trae/documents/testing/logs/2026-07-22/junit-backend-r03.xml

# Memory 持久化（6 例）
.venv/Scripts/python.exe scripts/test_memory_persistence.py

# SOP 集成（4 例，pbl-stage-flow 这次应该存在了）
.venv/Scripts/python.exe scripts/test_sop_integration.py

# 工具注册验证
.venv/Scripts/python.exe -c "
import sys; sys.path.insert(0, '.')
from app.services.tools import TOOL_REGISTRY
print(f'Tool count: {len(TOOL_REGISTRY)}')  # 应为 15
new = ['project_memory_store', 'project_memory_recall', 'sop_state_sync']
for t in new:
    print(f'  {t}: {\"OK\" if t in TOOL_REGISTRY else \"MISSING\"}')
"
```

存日志：`backend-unit-r03.log`

### 3. 前端测试（10 单元 + 2 构建，**M7 是 R03 新实施，R02 未覆盖**）

```bash
cd G:/mediaProjects/fineSTEM/apps/frontend

# 单元测试（43 例应全通过）
npx vitest run --reporter=json > ../../.trae/documents/testing/logs/2026-07-22/vitest-results-r03.json

# TypeScript 编译
npx tsc --noEmit 2>&1 | tee ../../.trae/documents/testing/logs/2026-07-22/tsc-output-r03.txt
# useStreamingChat.ts 必须零错误（预存的 CodeEditor.tsx/test 文件错误不算回归）

# Vite 构建
npx vite build 2>&1 | tee ../../.trae/documents/testing/logs/2026-07-22/vite-build-r03.txt
```

**M7 验证点**（读源码确认）：
- `buildOutgoingMessage`：含 `PBL_STAGE_ORDER` 常量 + `mode`/`stage_progress`/`evidence_count`/`memory_hint` 注入逻辑
- tool_result 分支：含 5 种新工具处理（project_memory_store/recall/sop_state_sync/sop_execute/sop_status）
- StreamEvents 接口：含 `onSopStarted` 和 `onSopStatusUpdate` 两个新回调

### 4. E2E + Playwright UI（需 daemon + 前端）

```bash
# 启动前端 dev server
cd G:/mediaProjects/fineSTEM/apps/frontend && npm run dev &
sleep 3

# Playwright @ai（有头 + 截图 + 录屏）
cd G:/mediaProjects/fineSTEM/apps/frontend/tests
RUN_AI_E2E=1 npx playwright test --project=chromium --headed --video=retain-on-failure --screenshot=on
```

核心验证：
- 项目创建后 brain.db 有 `finestem:project:{id}:profile` 记忆（**R02 未验证**）
- 阶段推进后 brain.db 有 `finestem:project:{id}:stage_history` 记忆（**R02 未验证**）
- 跨会话记忆：新连接能召回之前存储的记忆
- 选项卡正常渲染、AI 回复不截断、刷新后状态恢复

### 5. WebSocket 真实对话

```bash
cd G:/mediaProjects/fineSTEM/apps/backend

# Windows GBK 控制台需要 UTF-8（否则 emoji 崩溃）
export PYTHONIOENCODING=utf-8   # Git Bash
# 或 $env:PYTHONIOENCODING="utf-8"  # PowerShell

.venv/Scripts/python.exe scripts/ws_frame_capture.py        # WS-001 握手
.venv/Scripts/python.exe scripts/ws_multi_turn_test.py       # WS-002 多轮对话
.venv/Scripts/python.exe scripts/ws_sop_test.py              # WS-003 SOP ← R02 失败，R03 重点
.venv/Scripts/python.exe scripts/ws_memory_test.py           # WS-004/005 记忆存储+跨会话
```

**WS-003 是 R02 的失败点**（pbl-stage-flow 不存在→AI 调 sop_list 非 sop_execute→120s 超时）。R03 daemon 重启后 SOP 已加载，应能通过。

### 6. Memory 数据取证

```bash
cd H:/dev-env/zeroclaw/bin

# 测试前快照
./zeroclaw.exe memory list --limit 50 > G:/mediaProjects/fineSTEM/.trae/documents/testing/logs/2026-07-22/memory-before-r03.txt
./zeroclaw.exe memory stats > G:/mediaProjects/fineSTEM/.trae/documents/testing/logs/2026-07-22/memory-stats-r03.txt

# E2E 测试后再查
./zeroclaw.exe memory list --limit 50 > G:/mediaProjects/fineSTEM/.trae/documents/testing/logs/2026-07-22/memory-after-r03.txt
```

### 7. R01/R02 回归验证（逐项确认历史问题已修复）

| 历史问题 | 验证命令 | R03 预期 |
|---------|---------|---------|
| [sop] 段不存在 | `zeroclaw config get sop.sops_dir` | 绝对路径 |
| pbl-stage-flow 不存在 | `zeroclaw sop list` | 含 pbl-stage-flow, 9 steps |
| memory.search_mode=hybrid | `zeroclaw config get memory.search_mode` | bm25 |
| auto_approve 缺新工具 | 读 config.toml | 含 3 finestem__ + 7 内置名 |
| test_mcp_server 回归 | `pytest tests/test_mcp_server.py` | 10/10 |
| 前端 M7 未实施 | 读 useStreamingChat.ts 源码 | 含 M7 全部改动 |

### 8. 回归测试

```bash
cd G:/mediaProjects/fineSTEM/apps/backend && .venv/Scripts/python.exe -m pytest -v
cd G:/mediaProjects/fineSTEM/apps/frontend && npx vitest run
```

后端 87/87、前端 43/43 应全通过，无新增失败。

---

## 产出

所有日志存到 `.trae/documents/testing/logs/2026-07-22/`（文件名带 `-r03` 后缀）。

测试报告写到 **`.trae/documents/testing/reports/SOP_Memory测试报告_2026-07-22_R03.md`**，格式见测试工作指南 8.2 节。报告必须含：

1. **执行摘要表**：R01 → R02 → R03 的通过率变化对比
2. **R01/R02 遗留问题修复状态**：逐项确认（第 7 步的结果）
3. **按组详细结果**：12 配置 + 28 后端 + 10 前端 + 2 构建 + 3 E2E + 8 AI + 6 UI + 6 WS + 5 回归
4. **问题清单**（如有）：编号/用例/严重度/现象/复现步骤/期望/日志路径/修改建议
5. **Memory 数据快照**：测试前后记忆数对比 + 新增的项目记忆条目

完成后通知开发 agent。
