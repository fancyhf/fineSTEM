# 手动改名被自愈覆盖回归测试（Q-022 回归修正）

你是测试 agent。验证用户手动改项目名后，名字不会再被 AI 自愈逻辑反向覆盖。

## 本次变更（2026-07-29）

用户反馈"对话流里无法改名"——手动改名后名字自动变回原样。根因：Q-022 的自愈逻辑（`_sync_project_name_from_skill_state`）没区分"AI 确认名"和"用户手动改名"，把用户改的名字反向覆盖回 AI 早期确认值。3 层修复：

| 层 | 修复 |
|----|------|
| 后端自愈 | `_sync_project_name_from_skill_state` 检查 `initial_data.name_manually_overridden` 标志，手动改过则跳过 |
| 后端 PATCH | `update_project` 改名时自动设 `name_manually_overridden=true` |
| 前端流末 | 用户 5 秒内手动改名则跳过覆盖 context（第二层防护）；API 失败不再静默 |

## ⚠️ 强制要求
1. 必须有头测试 + 重启 daemon + 前端
2. 必须真实走"先有 AI 确认名 → 再手动改名 → 再对话"的完整流程
3. 禁止改产品代码；如需登录用测试用户

## 必读
- `.trae/documents/问题清单_长期维护.md`（Q-022 回归修正段 + RT-22）

## 执行

### 步骤 0：重启 daemon + 前端
```bash
Stop-Process -Name zeroclaw -Force -ErrorAction SilentlyContinue
H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon   # 等 6 秒
cd apps/frontend && npm run dev   # 等 3 秒
```

### 步骤 1：单测（必须全过）
```bash
cd apps/backend && python -m pytest tests/test_project_name_sync.py -v   # 17 passed（含 name_manually_overridden 2 个新测试）
cd apps/frontend && npx tsc --noEmit   # 0 error
```

### 步骤 2：核心 E2E —— 手动改名不被覆盖（RT-22 回归）

**这是最关键的测试**，必须走完整流程：

1. 用测试用户登录，新建项目（发"我想做一个英语单词学习助手"）
2. 走脑爆阶段，让 AI 确定一个项目名（如 AI 说"我们就叫它英语单词学习助手吧"）
3. **确认 AI 确认的名字已生效**（侧边栏显示"英语单词学习助手"）
4. **手动改名**：在侧边栏点铅笔图标 → 输入"我的专属助手" → 按 Enter
5. **检查点 A**：侧边栏立即显示"我的专属助手"（改名即时生效）
6. **继续对话**（关键！触发流末刷新）：发"继续"或随便聊一轮
7. **检查点 B（核心）**：对话流结束后，侧边栏**仍显示"我的专属助手"**（不被覆盖回"英语单词学习助手"）
8. **检查点 C**：刷新页面 → 项目名**仍是"我的专属助手"**（持久化成功）
9. **接口验证**：`GET /api/projects/{id}` → `data.name` = "我的专属助手"；`data.initial_data.name_manually_overridden` = true

**修复前表现**：步骤 7 名字自动变回"英语单词学习助手"（被自愈覆盖）

### 步骤 3：回归 —— AI 确认名自愈仍正常（Q-022 原功能不退化）

1. 新建另一个项目（默认长名字）
2. 走脑爆让 AI 确认名（**不手动改名**）
3. 继续对话触发流末刷新
4. **检查点 D**：侧边栏显示 AI 确认的短名字（自愈仍工作，`name_manually_overridden` 不影响未手动改名的项目）

---

## 报告

写到 `.trae/documents/testing/reports/手动改名回归测试_Q-022R2_<日期>.md`：

| 编号 | 问题 | 结果 | 证据 |
|------|------|------|------|
| 检查点 A | 手动改名即时生效 | ✅/❌ | 截图 |
| 检查点 B | 对话后名字不被覆盖（核心） | ✅/❌ | 截图 |
| 检查点 C | 刷新后名字持久化 | ✅/❌ | 截图 |
| 接口 | name_manually_overridden=true | ✅/❌ | curl 输出 |
| 检查点 D | AI 确认名自愈仍正常（不退化） | ✅/❌ | 截图 |

**判定**：检查点 B ❌（对话后名字变回去）→ 核心未修复，状态改🔴。
