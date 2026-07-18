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
