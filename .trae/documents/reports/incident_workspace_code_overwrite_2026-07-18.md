# 事故分析：项目代码被覆盖丢失

- **事故时间**：2026-07-18（发现时间，实际覆盖发生于该日中午前后）
- **影响范围**：1 个项目代码字段被覆盖（`趣味小测验`，id=`f2a11545-2b53-488d-8c38-7048f3adc801`）
- **数据丢失情况**：`workspace.code` 被覆盖；`workspace.files` 被清空；**文档（skill_states）未受影响**
- **严重级别**：高（用户已完成项目的主代码不可逆丢失，无历史快照可恢复）
- **根因定位**：后端 `orchestrator.py` 的 `_extract_executable_code_block` 自动捞取 AI 回复中的代码块并覆盖 workspace

---

## 一、现象

用户反馈两个已完成的项目"打开后没有文档、也没有代码"：

| 项目 | 数据库实际状态 | 前端表现 |
|---|---|---|
| 趣味小测验 (`f2a11545...`) | ❌ `code` = 381 字节诊断脚本；`files` = `[]` | 代码区显示诊断脚本，无项目代码 |
| 奇幻选择之旅 (`b686df08...`) | ✅ `code` = 23KB 完整 HTML；`files` = 6 个文件 | 前端展示问题（懒加载未触发） |

**只有"趣味小测验"是真的数据被破坏**，"奇幻选择之旅"数据完好，是前端展示层的独立问题。

---

## 二、证据链

### 2.1 被破坏项目的 workspace 形态指纹

```
workspace.code      = "import os\nfor root, dirs, files in os.walk..." (381 字节)
workspace.language  = "python"        ← 原本是 "html"
workspace.filename  = "main.py"      ← 原本是 "index.html"
workspace.files     = []             ← 原本有项目文件
workspace.preview_html = "✓ 代码执行成功 (退出码: 0)"  ← 诊断脚本的执行输出
workspace.saved_at  = 2026-07-18T07:52:35 UTC (= 北京 15:52)
```

这套形态（python + main.py + 诊断脚本 + 空files）**只可能由一条代码路径产出**：`orchestrator.py` 的 `_extract_executable_code_block` → `db.save_project_workspace`。

### 2.2 时间窗口锁定（北京时间）

| 时刻 | 事件 | 证据 |
|---|---|---|
| 2026-07-17 18:20 | ✅ 项目代码完好 | 生成了一张 318KB 完整预览截图（蓝绿渐变卡片、科学测验功能列表） |
| **[21 小时黑箱窗口]** | ❌ 代码被覆盖 | `saved_at` 改写 |
| 2026-07-18 15:52 | workspace 被覆盖 | DB 中 `saved_at` 字段 |
| 2026-07-18 15:54 | 用户发现丢失，开始与 AI 交互追查 | 聊天记录 [59]–[68] |

聊天记录 [59]–[68] 中 AI 贴的 `os.walk` 诊断脚本是**用户发现丢失后**让 AI 帮忙查找的产物，**不是丢失原因**（这点在初版分析中曾被误判）。

### 2.3 用户操作确认

用户明确确认：
1. 代码运行 OK 后，执行过"生成成果档案卡"、"项目截图"功能
2. **其后**才发现代码不见了
3. 没有多标签打开同一项目

这把覆盖时机锁定在**"生成成果档案卡/截图"那次 AI 对话**期间。

---

## 三、根因

### 3.1 致命机制：自动捞取代码块并覆盖 workspace

**位置**：`apps/backend/app/services/orchestrator.py:1257-1324`

```python
# orchestrator.py（修复前）
if force_code_generation and not code_generated_sent:
    code_result = self._extract_executable_code_block(full_content)  # 扫 AI 回复
    if code_result and req.project_id:
        # === 直接覆盖 workspace ===
        db.save_project_workspace(req.project_id, {
            "code": payload["code"],      # ← 把捞到的代码块塞进去
            "language": payload["language"],
            "filename": payload["filename"],
            "files": payload["files"],
            "saved_at": saved_at,
        })
```

**配合**：`_extract_executable_code_block` (`orchestrator.py:297-320`)

```python
pattern = re.compile(r"```(\w+)?\n([\s\S]*?)```", re.MULTILINE)
for match in pattern.finditer(content):
    if language in executable_langs and len(code) > 30:
        candidates.append(...)  # ← >30 字符的代码块一律当候选
```

### 3.2 设计错误

该机制的本意是"AI 该交付项目代码时，自动从回复里抓代码块落库"。但它有两个致命假设错了：

| 错误假设 | 现实 |
|---|---|
| ~~"AI 回复里的代码块 = 项目代码"~~ | AI 回复里的代码块有 **4 种用途**：①项目代码 ②诊断/扫描脚本 ③示例代码 ④反例。系统无法区分 |
| ~~"force_code_generation 阶段 AI 一定在交付代码"~~ | 验收/档案卡阶段，AI 为回答问题会贴**辅助脚本**，不是在交付代码 |

### 3.3 事故复现链路

```
用户点"生成成果档案卡"或"项目截图"
   ↓
触发 agent_stream（force_code_generation 可能开启）
   ↓
AI 为了汇总项目信息，在回复里贴了一段 python 脚本
（os.walk 扫描 projects/ 目录、读取文件清单）
   ↓
_extract_executable_code_block 扫到这个 ```python 块（>30 字符）
   ↓ （不问用途，直接当项目代码）
db.save_project_workspace 覆盖 workspace
   ↓
workspace.code:      完整 index.html → 381 字节诊断脚本  💥
workspace.language:  html            → python
workspace.filename:  index.html      → main.py
workspace.files:     [原文件]         → []
```

**原代码被永久覆盖**——因为 `save_project_workspace` 是合并式覆盖（`workspace.update(...)`），且**没有历史快照、没有版本号、没有回滚机制**。

### 3.4 为什么"长时间没动"还会触发

用户描述"长时间没动"是从**项目完成**到**发现丢失**的整个期间。实际覆盖发生在**最近一次"生成成果档案卡"操作**那一刻——用户点完该按钮后直接去看档案卡/截图，**没有立刻回头看代码区**，所以覆盖发生了但未及时察觉。

---

## 四、修复方案

### P0 —— 核心修复：移除自动捞取代码块覆盖路径

**原则**：代码写入 workspace 这个动作，**只能**通过 AI 显式调用 `project_code_writer` 工具完成。文本里的代码块含义模糊，不应当作"项目代码"自动落库。

**改动**：`orchestrator.py:1257-1324` 整段重写——不再调用 `_extract_executable_code_block` 写库；只检测 AI 是否调用了 `project_code_writer` 工具，没调则发 `code_generation_failed` 事件提示 AI。

**效果**：本次事故场景被彻底根治——AI 在回复里贴诊断脚本不会再覆盖 workspace。

### P1 —— 兜底保护：写入前历史快照 + 可疑覆盖检测

**原则**：即使将来出现新的覆盖路径，也要保证：①旧代码有历史快照可恢复；②可疑覆盖（代码长度突降 + 语言变化）被记录告警。

**改动**：`project_repo.py:save_project_workspace` 在合并写入前：
1. 始终把旧 `code` 存进 `code_history`（保留最近 5 版）
2. 可疑覆盖检测：新 code 长度 < 旧 code 长度 × 10% 且 language 变化 → 记 warning 日志

**效果**：任何覆盖都能从 `code_history` 恢复；可疑操作留痕便于排查。

### P2 —— 前端独立隐患（本次未改，记录待办）

`Create.tsx:1289-1301` 的"JSON 污染重置"分支会 `saveCode(DEFAULT_CODE)` **反向写库**，可能毁掉后端可能还完好的数据。建议改为只重置本地 state、不反向写库。

---

## 五、验证要点

- [x] P0 改动后，`_extract_executable_code_block` 不再被用于写库（仅保留函数定义供其他可能的引用检查）
- [x] P1 改动后，`save_project_workspace` 写入前会备份旧 code 到 `code_history`
- [ ] 模拟场景：AI 回复含 ```python 诊断脚本块时，workspace.code 不被覆盖
- [ ] 模拟场景：正常 AI 调用 `project_code_writer` 工具时，workspace 正确更新且旧 code 进入 history

---

## 六、附录：关键文件位置

| 文件 | 行号 | 内容 |
|---|---|---|
| `apps/backend/app/services/orchestrator.py` | 297-320 | `_extract_executable_code_block`（保留，不再用于写库） |
| `apps/backend/app/services/orchestrator.py` | 1257-1324 | **P0 修改点**：自动捞代码块覆盖路径 |
| `apps/backend/app/repositories/project_repo.py` | 220-264 | **P1 修改点**：`save_project_workspace` |
| `apps/backend/app/services/tools.py` | 524-619 | `ProjectCodeWriterTool`（P0 后成为唯一写代码入口） |
| `apps/frontend/src/pages/Create.tsx` | 1289-1301 | **P2 待办**：JSON 污染重置反向写库 |

---

## 七、复盘要点

1. **"自动从自然语言里提取结构化数据并写库"是高危设计**——自然语言的语义是模糊的，任何自动提取都应当只读不写，或写入前要求显式确认（工具调用就是显式确认的一种形式）。
2. **覆盖式写入必须有历史快照**——用户数据是不可再生资源，任何 `update`/`overwrite` 操作都应当先备份旧值。本次事故如果有快照，直接一条 SQL 就能恢复。
3. **聊天记录的时间戳缺失**导致初期误判（以为诊断脚本是丢失原因）——消息应记录时间戳，便于事故复盘。

---

## 八、恢复结果

### 趣味小测验 (`f2a11545-2b53-488d-8c38-7048f3adc801`)

**已成功恢复**。恢复来源优先级：

| 来源 | 可靠性 | 实际使用 |
|---|---|---|
| **资料包 `out/趣味小测验_资料包/src/main.html`** | ⭐ 最高（6月18日导出，独立于数据库） | ✅ 最终采用 |
| 聊天记录 [36] 代码块 | 高（AI 首次生成时刻） | 备选（内容一致） |
| `data/workspace.json` | 高（6月17日快照） | 参考 |

最终状态：
```
workspace.code      = 9372 字节完整 HTML（资料包权威版）
workspace.language  = html
workspace.filename  = index.html
workspace.files     = [index.html (is_main=True)]
workspace.code_history = [381字节诊断脚本（事故现场，完整保留）]
```

P1 保护全程生效：两次恢复写入均自动备份旧 code 到 `code_history`。

### 奇幻选择之旅 (`b686df08-6655-4edb-a3a5-955f3244abe1`)

**无需恢复**——数据库 workspace 本就完整（23KB index.html + 6 个文件）。前端看不到代码是展示层问题（详见第九节）。

### 备份

原数据库已备份到 `D:/data/finestem/finestem.db.bak_before_restore_20260718`。

---

## 九、磁盘 src/ 目录消失的调查结论

### 现象

恢复过程中发现：7月18日生成的诊断脚本输出（preview_html）显示，当时 `D:/data/finestem/projects/` 下有 **54 个按 UUID 命名的目录**，大多含 `src/index.html` 等代码文件。但现在这些 UUID 目录**全部消失**，只剩按中文 slug 命名的目录（且无 src/）。

### 调查结论：**与当前系统无关，不影响任何真实项目**

| 检查项 | 结果 |
|---|---|
| 当前后端代码是否有创建 `projects/{uuid}/src/` 的逻辑 | ❌ 完全没有（grep + git 历史都查过） |
| `delete_project` 是否清理磁盘 | ❌ 只软删除（`is_deleted=True`），不碰磁盘 |
| 全代码库是否有清理 projects/ 目录的逻辑 | ❌ 只有临时执行目录的 rmtree（`code_execution.py` 的 streamlit/tmp 清理） |
| 资料包导出 `src/` 来源 | ✅ **从数据库 workspace 读**（`projects.py:1764-1786`），不读磁盘 |
| 5 个测试 UUID 是否在当前数据库 | ❌ **完全不存在**（连删除记录都没有） |

**这些 UUID 目录是某个"幽灵"来源创建的**——最可能是更早的后端版本（已被覆盖、不在 git 历史里）或外部脚本。它们与当前数据库的 482 个项目无关。

### 当前后端的真实存储模型（重要）

```
项目代码  → 只存数据库 projects.initial_data.workspace.code/files （JSON）
项目文档  → 数据库 skill_states.standard_step_data + 磁盘 projects/{slug}/docs/*.md （双重）
资料包 src/ → 导出时从数据库 workspace 临时生成，写入 zip，不落盘
磁盘 src/ → 当前后端从不创建、不读取、不依赖
```

**所以磁盘 src/ 消失对当前系统零影响**——前端展示、代码运行、资料包导出都不依赖它。

---

## 十、真正的隐患与建议（基于本次完整调查）

> **更新（2026-07-18）**：以下 4 个隐患已全部修复实施，详见第十一节"修复实施记录"。

### 隐患 1：数据库是代码的唯一存储（无冗余）

代码只在 `projects.initial_data.workspace`（SQLite JSON 列），没有第二种副本。
- **风险**：SQLite 文件损坏 / 误删 / 磁盘故障 → 所有项目代码永久丢失
- **建议**：启用 SQLite WAL + 每日自动备份 `.db` 文件到异地（或对象存储）
- **状态**：✅ 已实施（批次2）

### 隐患 2：资料包是唯一的手动备份手段，但需主动触发

`out/趣味小测验_资料包/` 救了这次事故。但资料包导出是用户手动点按钮，多数项目没导出过。
- **建议**：项目完成（stage_08_evaluate）时自动导出一份资料包到 `out/`，并纳入 git
- **状态**：✅ 已实施（批次3）

### 隐患 3：前端 applyWorkspaceRestore 的脆弱性（奇幻选择之旅看不到代码的根因）

前端在以下情况会让"数据库有代码、前端显示空"：
1. `getWorkspace` 静默失败（token 过期）→ catch 分支 `setEditorCode(DEFAULT_CODE)`
2. JSON 污染重置分支误触发 → 反向 `saveCode(DEFAULT_CODE)` 覆盖后端
3. 文档列表懒加载（折叠状态默认不加载）

- **建议**：`saveCode` 的 401 不要用 silent 模式；JSON 污染重置不要反向写库；文档列表首次加载就拉取
- **状态**：✅ 已实施（批次1）

### 隐患 4：诊断脚本可能写进数据库（本次事故的同源风险）

`code_runner` 工具（`tools.py:433`）执行 AI 提供的脚本时，如果脚本操作了 `D:/data/finestem/`，可能产生副作用。虽然 P0 已防止脚本被当作项目代码写入 workspace.code，但脚本本身仍能读写磁盘/数据库。
- **建议**：`code_runner` 应在隔离的沙箱/临时目录执行，限制可访问的路径
- **状态**：✅ 已实施（批次4）。**额外发现**：原 CodeRunnerTool 用进程内 `exec()`（非子进程），脚本和后端共享进程/内存/密钥/数据库句柄，AI 死循环能卡死整个后端——比预想严重得多。

---

## 十一、修复实施记录（2026-07-18）

4 个隐患分 4 批实施，每批独立验证通过。

### 批次 1：前端恢复脆弱性（隐患 3）

**改动文件**：
- `apps/frontend/src/pages/Create.tsx`
  - `applyWorkspaceRestore` (1287-1305)：收紧 `isJsonLike` 判定（必须 JSON.parse 成功 + 含已知污染键），**删除反向 `saveCode(DEFAULT_CODE)`**（绝不反向覆盖后端）。
  - 侧边栏打开项目 catch (2898-2920)：按错误类型区分——401 让 request() 处理；5xx/网络错误保留编辑器内容只切 projectContext；仅 4xx 才回落 DEFAULT_CODE。
- `apps/frontend/src/components/ProjectFilesPanel.tsx`
  - `expandedSections` 默认 `docs: true`（文档默认展开）。
  - `loadDocuments` 改为有 projectId 就预取（不再依赖展开状态）。
  - 空态文案：折叠时不渲染"暂无阶段文档"，加 loading 态。

**验证**：`tsc --noEmit` 零错误。

### 批次 2：DB 备份服务（隐患 1）

**改动/新增文件**：
- 新增 `apps/backend/app/services/backup_service.py`：`sqlite3.backup()` 在线热备 + 旧备份清理 + 定时计算。
- 新增 `apps/backend/app/api/system.py`：`POST /api/v1/system/backup` 手动触发接口。
- 改 `apps/backend/app/db/database.py`：engine 加 `@event.listens_for("connect")` 设 `PRAGMA journal_mode=WAL / synchronous=NORMAL / foreign_keys=ON`。
- 改 `apps/backend/app/main.py`：加 `lifespan` async context manager，启动时 `asyncio.create_task(_daily_backup_loop())` 每日 BACKUP_HOUR 触发。
- 改 `apps/backend/app/core/config.py`：新增 `BACKUP_ENABLED/BACKUP_DIR/BACKUP_HOUR/BACKUP_KEEP_DAYS` 配置。

**验证**：备份成功生成（4.28MB，482 项目完整）；WAL 生效（`journal_mode=wal`）；路由 `/api/v1/system/backup` 注册；lifespan task 创建。

### 批次 3：项目完成自动导出资料包（隐患 2）

**改动文件**：
- `apps/backend/app/api/projects.py`：抽出 `build_project_package(project_id) -> (项目名, {路径: bytes})` 和 `export_project_to_disk(project_id, target_dir)`。`export_project` HTTP 端点复用前者生成 zip。落盘只写解压目录（纯文本，git diff 友好），不写 zip。
- `apps/backend/app/services/pbl_engine.py`：`advance_with_gate` 返回值加 `just_completed: bool`（`new_stage == "stage_08_evaluate"`）。
- `apps/backend/app/services/tools.py`：`StageAdvancerTool` 推进成功后若 `just_completed`，异步触发 `_trigger_auto_export`（线程池执行，失败只 log，不阻断主流程）。
- 改 `apps/backend/app/core/config.py`：新增 `AUTO_EXPORT_ON_COMPLETE/AUTO_EXPORT_DIR` 配置。

**验证**：奇幻选择之旅导出 182 个文件到 `out/奇幻选择之旅_资料包/`（含 src/6 个代码文件 + 8 阶段文档 + 3 种格式报告）；`just_completed` 标志正确返回；异步调用链工作。

### 批次 4：code_runner 沙箱化（隐患 4）

**改动/新增文件**：
- 新增 `apps/backend/app/services/code_sandbox.py`：`run_python_sandboxed` / `run_javascript_sandboxed`——临时目录 + 过滤 env + 子进程 + 超时。
- 改 `apps/backend/app/services/tools.py` 的 `CodeRunnerTool.execute`：删除进程内 `exec()`，改调沙箱。**顺手修复超时死代码 bug**（原 `except TimeoutError` 永不触发，AI 死循环会卡死后端）。
- 改 `apps/backend/app/api/code_execution.py` 的 `_run_subprocess`：加 `cwd/env` 参数（向后兼容）。
- 新增 `apps/backend/tests/test_code_sandbox.py`：7 个场景验证。

**验证**（全部通过）：
- ✅ 正常 Python 代码执行正常（`sum(range(10))` → 45）
- ✅ 密钥屏蔽（ZEROCLAW_API_KEY/glm_key/SECRET_KEY 返回 none）——**修复了 Windows 大小写不敏感导致的 GLM_KEY 泄露**
- ✅ 目录隔离（cwd 是临时目录，`listdir('.')` 只有 main.py）
- ✅ 死循环超时真生效（3 秒终止，原 exec() 会卡死后端）
- ✅ CodeRunnerTool 端到端集成正常
- ⚠️ 已知限制：绝对路径访问仍可能（软沙箱非 OS 级隔离，要彻底限制需叠加路径白名单）

### 涉及文件汇总

| 文件 | 批次 | 性质 |
|---|---|---|
| `apps/frontend/src/pages/Create.tsx` | 1 | 改 |
| `apps/frontend/src/components/ProjectFilesPanel.tsx` | 1 | 改 |
| `apps/backend/app/services/backup_service.py` | 2 | 新增 |
| `apps/backend/app/api/system.py` | 2 | 新增 |
| `apps/backend/app/db/database.py` | 2 | 改（WAL） |
| `apps/backend/app/main.py` | 2 | 改（lifespan） |
| `apps/backend/app/api/projects.py` | 3 | 改（抽函数 + 落盘） |
| `apps/backend/app/services/pbl_engine.py` | 3 | 改（just_completed） |
| `apps/backend/app/services/tools.py` | 3+4 | 改（钩子 + 沙箱） |
| `apps/backend/app/services/code_sandbox.py` | 4 | 新增 |
| `apps/backend/app/api/code_execution.py` | 4 | 改（_run_subprocess 签名） |
| `apps/backend/app/core/config.py` | 2+3 | 改（新配置） |
| `apps/backend/tests/test_code_sandbox.py` | 4 | 新增（验证测试） |
