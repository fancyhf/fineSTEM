## 实施计划：修复 4 个隐患

按风险从低到高分 4 批实施。每批改完都能独立验证、独立提交。

---

### 批次 1：前端恢复脆弱性（隐患 3）— 最快，最直接

**改 3 处，让"数据库有代码但前端显示空"不再发生。**

**文件 1：`apps/frontend/src/services/api.ts`**
- `request()` (71-123)：保留 silent 401 不跳转逻辑（autosave 需要），但给抛出的 error 加上 `status` 字段（已有，117 行）—— 让上层能区分错误类型。不改主链路。

**文件 2：`apps/frontend/src/pages/Create.tsx`**
- **侧边栏打开项目 catch 分支 (2898-2916)**：不再无条件 `setEditorCode(DEFAULT_CODE) + setMessages([])`。改为：网络/服务端错误（`error.status >= 500 || !error.status`）时**保留当前编辑器内容**，只切 projectContext + 显示重试提示；只在确实是无代码的新项目时才用 DEFAULT_CODE。
- **`applyWorkspaceRestore` JSON 污染分支 (1291-1305)**：
  - 收紧 `isJsonLike` 判定：必须 `JSON.parse` 成功 **且** 含已知污染键（evaluation/step_plan/brief_content 等）才判定为污染，不再仅凭首字符 `{`/`[`。
  - **删除反向 `saveCode(DEFAULT_CODE)` (1300-1305)**：只在内存重置 editorCode，绝不反向覆盖后端。万一后端真被污染，由后端 P1 的 code_history 兜底恢复，不由前端猜。

**文件 3：`apps/frontend/src/components/ProjectFilesPanel.tsx`**
- `expandedSections` 默认值 (47-52)：`docs: false` → `docs: true`（文档默认展开）。
- `loadDocuments` 触发条件 (146-150)：改为"有 projectId 就预取"，渲染仍受折叠控制（这样即便用户折叠过，再展开时数据已在）。
- 误导空态文案 (338-343)：折叠且未加载时不渲染"暂无阶段文档"，改为"点击展开查看"。

**验证**：刷新浏览器打开奇幻选择之旅 → 代码区显示完整 HTML + 文档列表自动出现。

---

### 批次 2：DB 备份（隐患 1）— 定时 + 手动 API

**新增 1 个文件 + 改 2 个文件。**

**新增 `apps/backend/app/services/backup_service.py`**：
- `backup_database(target_path=None) -> Path`：用 `sqlite3.backup()`（在线热备，避免 cp 到写一半的状态）把 `DATABASE_URL` 指向的 .db 备份到 `STORAGE_BASE_PATH/backups/finestem_YYYYMMDD_HHMMSS.db`。
- `cleanup_old_backups(keep_days=14)`：删除超过保留期的旧备份。
- `run_scheduled_backup()`：组合上面两步，供定时任务和手动 API 共用。

**改 `apps/backend/app/core/config.py`**：新增配置项（沿用 UPPER_SNAKE 风格，加在 :33 DATABASE_URL 附近）
```
BACKUP_ENABLED: bool = True
BACKUP_DIR: str = "backups"        # 相对 STORAGE_BASE_PATH
BACKUP_HOUR: int = 3               # 每日触发点（本地时区）
BACKUP_KEEP_DAYS: int = 14
```

**改 `apps/backend/app/db/database.py`** (22-24)：给 engine 加 WAL
```python
from sqlalchemy import event
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()
```
（仅对 sqlite 生效，靠 `DATABASE_URL.startswith("sqlite")` 判断）

**改 `apps/backend/app/main.py`**：
- 把 `app = FastAPI(...)` 改为带 `lifespan` 参数的 async context manager。
- lifespan 启动时：若 `BACKUP_ENABLED`，`asyncio.create_task(_daily_backup_loop())`。loop 内 `while True: await asyncio.sleep(直到下次 BACKUP_HOUR)`，调 `run_scheduled_backup()`。
- lifespan 关闭时：取消 task。
- 注意 `--reload` 模式下文件改动会重建 task，开发期可接受。

**新增 API（加到 `apps/backend/app/api/projects.py` 或新建 `system.py`）**：
- `POST /api/v1/system/backup`（需管理员/登录）：手动触发 `run_scheduled_backup()`，返回备份文件名。供运维/cron 外部调度用。

**验证**：启动后端 → 调 `POST /api/v1/system/backup` → 检查 `D:/data/finestem/backups/` 出现带时间戳的 .db → 用 sqlite3 打开备份确认数据完整。

---

### 批次 3：自动导出资料包（隐患 2）— 只导出解压目录

**抽函数 + 加钩子，改 2 个文件。**

**改 `apps/backend/app/api/projects.py`**：
- 把 `export_project` 的 zip 组装逻辑（1721-1836）抽成独立函数 `build_project_package(project_id) -> dict[str, bytes]`，返回 `{相对路径: 文件内容}` 的字典（zip 逻辑就变成遍历字典写 zipf）。
- 新增 `export_project_to_disk(project_id, target_dir: Path)`：调 `build_project_package`，把每个文件写到 `target_dir/{项目名}_资料包/`（覆盖式，纯文本，git diff 友好），**不生成 zip**。
- `export_project` HTTP 端点保持原行为（返回 zip 下载），但内部改为 `build_project_package` + 内存 zip。

**改 `apps/backend/app/services/pbl_engine.py`** (advance_with_gate, 156-163)：
- 推进成功后，若 `new_stage == "stage_08_evaluate"` 且配置开启，调 `export_project_to_disk(project_id, Path(settings.STORAGE_BASE_PATH).parent / "out")`。
- 包在 try/except 里，失败只 log warning（不阻断阶段推进——这是关键，导出失败不能影响主流程）。
- 加配置开关 `AUTO_EXPORT_ON_COMPLETE: bool = True`（加到 config.py）。
- **重要**：用异步执行（`asyncio.create_task` 或线程池）避免阻塞阶段推进响应；但因为 `advance_with_gate` 是同步函数，最稳的方式是在调用方（tools.py 的 StageAdvancerTool）推进成功后异步触发。我会在 advance_with_gate 返回的 dict 里加一个 `just_completed: bool` 标志，让调用方决定是否触发导出，避免在同步底层函数里塞异步逻辑。

**目标目录**：`out/{项目名}_资料包/`（与现有 `out/趣味小测验_资料包/` 风格一致，已在 git 追踪）。

**验证**：手动调 `export_project_to_disk` 对奇幻选择之旅 → `out/奇幻选择之旅_资料包/` 出现完整内容（src/index.html + docs/ + data/workspace.json）。

---

### 批次 4：code_runner 沙箱化（隐患 4）— 改动最大

**改 2 个文件，新增 1 个公共模块。**

**新增 `apps/backend/app/services/code_sandbox.py`**：
- 抽出公共执行函数 `run_python_sandboxed(code: str, timeout: int = 10, stdin: str = "") -> dict`：
  - `tempfile.mkdtemp(prefix='finestem_sandbox_')` 建临时目录
  - 写代码到 `{tmpdir}/main.py`
  - `subprocess.run(['python', '-X', 'utf8', main.py], cwd=tmpdir, timeout=timeout, env=_filtered_env(), capture_output=True)`
  - `finally: shutil.rmtree(tmpdir)`
- `_filtered_env()`：复制 os.environ 但剔除密钥变量（`ZEROCLAW_API_KEY`, `SECRET_KEY`, `glm_key`, `deepseek_key`, `*_TOKEN`, `DATABASE_URL`），保留 `PYTHONUTF8`/`PYTHONIOENCODING` 等。
- 同时提供 `run_javascript_sandboxed(code, timeout=10, stdin="")`（沿用 CodeRunnerTool 的 node 子进程逻辑，但去掉 `shell=True` 改用 `create_subprocess_exec` + stdin 传码，消除命令注入）。

**改 `apps/backend/app/api/code_execution.py`** (709-725)：
- `_run_subprocess` 加 `cwd: str | None = None` 和 `env: dict | None = None` 参数，透传给 `subprocess.run`。保持向后兼容（默认值不变）。

**改 `apps/backend/app/services/tools.py`** (CodeRunnerTool.execute, 448-521)：
- Python 分支（489-508）：删除进程内 `exec()`，改为 `await asyncio.get_event_loop().run_in_executor(None, run_python_sandboxed, code, 10, stdin_input)`。
- JS 分支（467-488）：改为调 `run_javascript_sandboxed`。
- **顺手修复超时死代码 bug**（原 500-502 的 `except TimeoutError` 是死代码，改子进程后 `subprocess.TimeoutExpired` 真生效）。
- 返回结构保持不变（`success/stdout/stderr/exit_code/execution_time_ms`），确保对 AI 工具调用协议零影响。

**关键风险与缓解**：
- AI 生成的诊断脚本（`os.walk('D:/data/finestem/')`）将无法再列出项目目录——这正是修复目标。绝对路径访问仍可能（如不叠加路径白名单），但"无意扫描"被挡住，且密钥不再泄露。
- AI 生成的项目代码落盘走 `ProjectCodeWriterTool`（写数据库），**不依赖** code_runner 的 cwd，所以业务流程不受影响。
- 现有 `tests/test_code_execution.py` 的 multifile/streamlit 测试不受影响（走的是 code_execution.py 自己的路径，不动）。

**验证**：
- 新建测试 `tests/test_code_sandbox.py`：执行 `import os; print(os.listdir('D:/data/finestem'))` → 应失败或只返回临时目录内容（而非项目列表）。
- 执行 `print(os.environ.get('ZEROCLAW_API_KEY'))` → 应返回 None。
- 执行正常 Python 代码 `print(sum(range(10)))` → 应返回 45。
- 执行死循环 → 应 10 秒超时返回 exit_code=-1（验证 bug 修复）。

---

### 文档与提交

- 每批改完更新 `.trae/documents/reports/incident_workspace_code_overwrite_2026-07-18.md` 的"隐患与建议"章节，把对应条目从"建议"改为"已实施"。
- 不动 git（除非你要求提交）。

### 实施顺序

批次 1（前端）→ 批次 2（DB备份）→ 批次 3（自动导出）→ 批次 4（沙箱）。每批独立验证后再做下一批，出问题易于定位回退。