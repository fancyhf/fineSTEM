# 项目名同步回归测试任务（Q-022 新增）

你是测试 agent。对 fineSTEM AI 对话系统执行回归测试，重点验证 Q-022 修复：AI 对话中确定项目名后，系统项目区显示正确名字。

## 本次变更（2026-07-28）

**Q-022**：学生在 AI 对话中确定项目名（如"英语单词学习助手"），但左侧系统项目区仍显示创建时的默认长名字（首条消息截断，如"我想做一个英语单词学习..."）。

**根因**：两套名字数据未同步——
- `projects.name`（侧边栏列表读的）= 创建时首条消息截断（`Create.tsx:1414` `name.slice(0,20)+'...'`）
- `skill_state.standard_step_data.brief_content.project_name`（AI 确认的名）= AI 在脑爆/简报阶段写入
- **从未有任何代码调 `PATCH /projects/{id}` 把 AI 确认名同步到 projects 表**

**修复方案**（后端数据自愈 + 前端流末刷新，双层）：
- **后端**（`projects.py` `_build_workspace_payload`）：新增 `_extract_confirmed_project_name`（从 PBL 数据多处提取 AI 确认名）+ `_sync_project_name_from_skill_state`（若与 projects.name 不一致自动调 `db.update_project` 同步）。任何打开 workspace 的操作都触发自愈。
- **前端**（`Create.tsx` `handleSend` 流末）：每轮 AI 回复结束后异步拉一次 workspace → ① 触发后端自愈 ② 更新 context 名字 ③ 刷新侧边栏列表。

## ⚠️ 强制要求（红线）

1. **必须有头测试**：Playwright 用 `--headed`（截图/录屏留证据）
2. **必须真实走到脑爆/简报阶段确定项目名**：不能 mock/跳过，必须 AI 真的在对话里给出项目名
3. **必须重启 daemon + 前端**：不重启跑的是旧代码，测试无效
4. **必须对照问题清单**：报告含 Q-022 对照表（✅/❌ + 证据截图）
5. **禁止改产品代码**：`apps/` 非测试文件只读；发现 bug 只记录 + 给建议
6. **必须覆盖回归**：手动改名（`saveEditProject`）仍正常；项目其他功能不退化

## 必读（按顺序）

1. `.trae/documents/问题清单_长期维护.md`（Q-022 是本次新增项；RT-22 是回归项）
2. `.trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md`（§2.1 TC-DLG-030、§2.4 TC-DATA-013~015）
3. `.trae/documents/testing/reports/Create页三bug修复回归测试_Q-018_Q-019_Q-020_2026-07-28.md`（开发 agent 已做的代码层验证，含 Q-018~020）

## 执行

### 步骤 0：重启 daemon + 启动前后端

```bash
# 停掉旧 daemon（不重启 = 无效测试）
Stop-Process -Name zeroclaw -Force -ErrorAction SilentlyContinue
H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon
# 等 6 秒
curl http://localhost:3200/api/health   # 确认后端起来了

# 前端
cd apps/frontend && npm run dev
# 等 3 秒，确认 http://localhost:5184 可访问
```

### 步骤 1：单元测试（必须全过）

```bash
cd apps/frontend
npx tsc --noEmit                                              # 预期：0 error
npx vitest run                                                # 预期：90 passed

cd ../backend
python -m pytest tests/test_project_name_sync.py -v           # 预期：15 passed（Q-022 核心）
python -m pytest tests/test_question_verifier.py -v           # 预期：35 passed（Q-020 回归）
```

**重点验证 Q-022 单测**（`test_project_name_sync.py`，共 15 用例）：
- `_extract_confirmed_project_name`（9 用例）：
  - ✅ 正例：brief_content JSON 字符串 / dict / 顶层 project_name / light_step_data / title 回退
  - ✅ 反例：无名字 / 纯空白 / 非法 JSON / null state → 返回 None
- `_sync_project_name_from_skill_state`（6 用例）：
  - ✅ 名字不同 → 调 `db.update_project` 同步
  - ✅ 名字已一致 / 前缀关系 / 无确认名 → 跳过
  - ✅ update 抛异常 → 不崩返回原名；project=None → 返回空串

---

### 步骤 2：核心 E2E 测试 —— 对话确定项目名后项目区显示正确名字（TC-DLG-030 / RT-22）

**这是最关键的实测项**，必须真实走到 AI 在对话里确定项目名。

**测试流程**：

1. **新建项目**：进入 Create 页，发"我想做一个英语单词学习助手"（或类似较长的话）
   - ⚠️ 此时项目自动创建，`projects.name` = 首条消息截断（如"我想做一个英语单词学习..."）
   - **记录**：侧边栏项目列表此时显示的长名字（截图，作为"修复前"对照）

2. **走脑爆/简报阶段**：回答 AI 的年级/兴趣/方向等问题，推进到 AI 确定项目名的阶段
   - AI 会在脑爆（stage_01）或简报（stage_02）阶段确定一个简洁的项目名（如"英语单词学习助手"）
   - AI 可能通过 `skill_state_writer` 或 `artifact_writer` 把确认名写入 PBL 数据

3. **检查点 A（侧边栏列表更新）**：AI 回复结束后（流末触发刷新），看左侧项目列表
   - ❌ 修复前：仍显示"我想做一个英语单词学习..."（首条消息截断）
   - ✅ 修复后：显示 AI 确认的短名字（如"英语单词学习助手"）
   - **证据**：侧边栏截图

4. **检查点 B（顶栏项目名）**：页面顶部的项目名标识
   - ✅ 修复后：也显示 AI 确认名（与侧边栏一致）

5. **检查点 C（刷新后持久化）**：**刷新页面**（F5）→ 重新打开同一项目
   - ✅ 修复后：项目名仍是 AI 确认名（后端 `_sync_project_name_from_skill_state` 已把 projects.name 自愈持久化）
   - ❌ 修复前：刷新后变回默认长名字
   - **证据**：刷新前后对比截图

6. **诊断验证（可选，用接口直接查）**：
   ```bash
   # 用项目 id 查 projects 表的实际 name（确认后端自愈生效）
   # 替换 <TOKEN> 和 <PROJECT_ID>
   curl -H "Authorization: Bearer <TOKEN>" http://localhost:3200/api/projects/<PROJECT_ID>
   # 预期：返回的 data.name = AI 确认名（不再是首条消息截断）

   # 查 workspace，确认 project.name 已同步
   curl -H "Authorization: Bearer <TOKEN>" http://localhost:3200/api/projects/<PROJECT_ID>/workspace
   # 预期：data.project.name = AI 确认名
   ```

---

### 步骤 3：回归测试（不能退化）

| 回归项 | 验证方法 | 通过标准 |
|--------|---------|---------|
| **手动改名仍正常** | 在侧边栏点项目名的编辑按钮 → 改名 → 回车 | 新名字保存成功，刷新后仍在（`saveEditProject` 路径不受影响） |
| **AI 对话正常** | 整个流程中 AI 对话、选项卡、代码生成正常 | 无功能退化 |
| **Q-017 不退化** | 刷新后 AI 不失忆（RT-17） | 学生画像仍恢复 |
| **Q-019 不退化** | 代码仍能落编辑器（RT-19） | 编辑器有代码 |

---

## 边界情况（加分项，若时间允许）

1. **AI 没确定项目名**：如果整轮对话 AI 都没给出明确项目名（只停留在 stage_00 选题），项目名应保持创建时的默认值，不报错
2. **名字含特殊字符**：AI 确认名含 emoji/标点/英文（如"🎮 趣味Quiz"）→ 同步正常不乱码
3. **轻项目（light 模式）**：若走 light 流程，`light_step_data.project_name` 也能被提取同步

---

## 报告

写到 `.trae/documents/testing/reports/项目名同步回归测试报告_Q-022_<日期>.md`，**必须含以下对照表**：

| 编号 | 问题 | 验证方法 | 结果 | 证据 |
|------|------|---------|------|------|
| Q-022-A | 侧边栏列表显示正确名字 | TC-DLG-030 检查点 A | ✅/❌ | 截图（默认长名→确认短名） |
| Q-022-B | 顶栏项目名更新 | TC-DLG-030 检查点 B | ✅/❌ | 截图 |
| Q-022-C | 刷新后名字持久化 | TC-DLG-030 检查点 C | ✅/❌ | 刷新前后对比截图 |
| Q-022-D | 后端 projects.name 自愈 | 接口查询 | ✅/❌ | curl 返回 |
| 回归 | 手动改名正常 | 点编辑按钮改名 | ✅/❌ | 截图 |
| 回归 | AI 对话/代码生成正常 | 全流程观察 | ✅/❌ | — |

**判定标准**：
- Q-022-A/B/C 任一 ❌ → 整体不通过，状态改回 🔴，报告写清复现步骤 + 控制台日志
- 手动改名回归 ❌ → Q-022 修复判定为"引入退化"，需回炉

特别关注：
- **必须真实走到 AI 确定项目名的阶段**（不能在 stage_00 就停），否则测不到核心逻辑
- 如果 AI 一直不主动确定名字，可发"我们就叫它'英语单词学习助手'吧"引导 AI 写入 PBL 数据
- 刷新后名字是否持久化是**关键验证点**——后端自愈必须把 projects.name 真正写库
