# 历史测试清理指令（给测试 Agent）

> **使用说明（给项目负责人）**：把下面 `===BEGIN===` 到 `===END===` 之间的全部内容复制给测试 agent。测试 agent 负责**只改 tests/ 目录**，不动产品代码。

===BEGIN===

你是 fineSTEM 项目的测试 agent。你的任务是清理 `apps/backend/tests/` 目录里的历史垃圾文件，让测试目录干净、可维护。

## 背景

`apps/backend/tests/` 目前有 58 个 .py 文件，其中 18 个是一次性调试脚本（非真正测试），混在测试目录里污染 pytest 收集。本次重构已经新建了 4 个规范的测试文件（test_stage_constants / test_tools_gates / test_check_gate_structural / test_mcp_server），这些是新的测试基线。历史文件需要分类处理。

## 你只能改 tests/ 目录

- ✅ 可以：删除/移动 tests/ 下的文件、修改 conftest.py、新建归档目录
- ❌ 禁止：改 apps/backend/app/ 任何文件、改前端代码、改 config.toml

## 第一步：归类（先读再动手）

逐个检查每个文件，归入三类之一：

### A 类：删除（纯调试脚本，无断言结构）

这些文件是临时调试用的，没有 `def test_xxx` / `class TestXxx` 断言结构，硬编码 `G:\` 或 `D:\` 路径，靠模块级副作用跑。**直接删除**：

```
check_db.py              ← 数据库检查工具，不是测试
check_mvp_content.py     ← MVP 内容检查，不是测试
check_workspace.py       ← workspace 检查，不是测试
fix_mvp_workspace.py     ← 修复脚本，不是测试
fix_workspace_files.py   ← 修复脚本，不是测试
test_clean.py            ← 调试 DSML 清洗，无断言
test_debug.py            ← 调试脚本
test_parse.py            ← 调试解析，无断言
test_regex.py            ← 调试正则
test_simple.py           ← "简单测试"实际是一次性探针
test_source.py           ← 调试来源
test_source2.py          ← 调试来源
test_strip.py            ← 调试剥离逻辑
test_truncation.py       ← 调试截断（非正式测试，正式的在 test_stream_truncation）
test_mvp_bug.py          ← MVP bug 调试
test_mvp_db_block.py     ← MVP DB 阻塞调试
```

**操作前**：逐个打开确认确实没有 `def test_` 或 `assert`。如果意外发现某个有正式断言结构，归入 B 类而不是删除。

### B 类：保留（有价值的正式测试）

这些是正式测试文件，**保留不动**：

```
conftest.py                        ← pytest fixture 定义，保留
test_stage_constants.py            ← 新建（本次重构），27 例
test_tools_gates.py                ← 新建（本次重构），17 例
test_check_gate_structural.py      ← 新建（本次重构），23 例
test_mcp_server.py                 ← 新建（本次重构），10 例
test_pbl_engine.py                 ← PBL 引擎测试，44 例
test_api.py                        ← API 测试
test_auth.py                       ← 鉴权测试
test_achievement_cards.py          ← 成果卡测试
test_evidence.py                   ← 证据测试
test_demos.py                      ← Demo 测试
test_projects.py                   ← 项目 CRUD 测试（840 行，最大）
test_code_sandbox.py               ← 代码沙箱测试
test_code_execution.py             ← 代码执行测试
test_skills_courses.py             ← 技能/课程测试
test_auxiliary.py                  ← 辅助功能测试
```

### C 类：归档（可能有价值但当前不可用/重复）

这些文件可能有价值，但当前要么 import 失败、要么和新建测试重复、要么是 MVP 阶段的临时验证。**移动到 `tests/_archive/` 目录**（而不是删除，保留备查）：

```
test_pbl_dialogue_flow.py     ← 已 skip（依赖废弃 orchestrator 符号），场景已被新测试覆盖
test_stream_truncation.py     ← 已 skip（依赖 AgentOrchestrator 旧类名），场景已迁至前端
test_agent.py                 ← agent 测试（可能依赖 orchestrator）
test_agent_question_templates.py ← 可能重复
test_ask_question_tool.py     ← ask_question 工具测试（test_tools_gates 部分覆盖）
test_auto_continue.py         ← 自动续接（逻辑已迁至前端）
test_auto_continue_api.py     ← 自动续接 API
test_direct.py                ← 直接调用测试
test_final_continue.py        ← 续接测试
test_full_journey.py          ← 完整旅程测试（可能依赖 orchestrator）
test_multi_question.py        ← 多问题测试
test_multifile_fix.py         ← 多文件修复
test_mvp.py                   ← MVP 阶段验证
test_mvp_final.py             ← MVP 最终验证
test_mvp_ws.py                ← MVP WebSocket 测试
test_p0_p1_fix.py             ← P0/P1 修复验证
test_project.py               ← 项目测试（和 test_projects.py 可能重复）
test_question_debug.py        ← 问题调试
test_question_flow.py         ← 问题流程
test_real_scenario.py         ← 真实场景
test_simple_continue.py       ← 简单续接
test_stream.py                ← 流式测试
test_ws.py                    ← WebSocket 测试
test_ws_events.py             ← WS 事件测试
test_ws_proxy.py              ← WS 代理测试
test_contains.py              ← 包含检查（0 tests collected，空壳）
```

## 第二步：执行

1. 创建 `tests/_archive/` 目录
2. 删除 A 类文件（16 个）
3. 移动 C 类文件到 `tests/_archive/`（28 个）
4. B 类保留不动
5. 在 `tests/_archive/` 放一个 `README.md` 说明："这些测试已归档。部分依赖已废弃的 orchestrator 符号，部分被新测试覆盖。如需恢复，逐个检查 import 是否可用。"

## 第三步：修改 conftest.py

`conftest.py` 里硬编码了 `DATABASE_URL=sqlite:///D:/data/finestem/test_finestem.db`（Windows D 盘绑死）。改为：
```python
import os
os.environ.setdefault("DATABASE_URL", f"sqlite:///{os.path.dirname(__file__)}/test_finestem.db")
```
这样测试数据库跟着 tests/ 目录走，不绑死 D 盘。

## 第四步：验证

清理后跑：
```bash
cd apps/backend
python -m pytest --collect-only 2>&1 | tail -5
```

预期：
- collected 数量 = B 类文件的测试总数（约 150-200 例）
- 无 collection error
- `_archive/` 里的文件不被收集

再跑：
```bash
python -m pytest tests/test_stage_constants.py tests/test_tools_gates.py tests/test_check_gate_structural.py tests/test_mcp_server.py tests/test_pbl_engine.py -v
```
预期全通过。

## 第五步：产出报告

在 `.trae/documents/testing/reports/测试清理报告_<date>.md` 写：
- 删除了哪些文件（A 类，附行数）
- 归档了哪些文件（C 类）
- 保留了哪些文件（B 类）
- 清理前后 collected 测试数对比
- conftest.py 改动

## 红线
- ❌ 不改 app/ 目录
- ❌ 不改前端代码
- ❌ 不删 conftest.py
- ❌ 不删 B 类文件
- ✅ 只动 tests/ 目录

===END===
