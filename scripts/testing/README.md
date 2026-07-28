# scripts/testing/ — 自动化测试脚本

version: v1.0.0
created_at: 2026-07-23 17:30:00.000
maintainer: 测试 Agent / 开发 Agent
status: active
change_log:
  - 2026-07-23 17:30:00.000 初始创建：将原本散落在项目根目录的测试脚本统一归集到本目录，所有脚本改用项目根目录动态定位。

## 用途

本目录存放 fineSTEM 项目的自动化测试入口脚本，覆盖后端 pytest、前端 Playwright E2E、热重载测试、完整套件与数据库检查等场景。

所有脚本均基于**项目根目录动态定位**，因此：

- 可以从项目根目录执行：
  ```powershell
  powershell scripts/testing/run_backend_tests.ps1
  ```
- 也可以先 `cd scripts/testing` 再执行，脚本会自动找到项目根目录。

## 脚本清单

| 脚本 | 类型 | 用途 | 说明 |
|------|------|------|------|
| `smart_test_runner.ps1` | PowerShell | 智能测试运行器 | 支持 `-All`、`-BackendOnly`、`-FrontendOnly`，需先手动启动前后端服务 |
| `run_backend_tests.ps1` | PowerShell | 后端 API 测试 | 依次运行截断检测、短代码、长代码、超长代码续接测试 |
| `run_playwright_tests.cmd` | CMD | Playwright E2E 测试 | 检查服务后运行 `ai-auto-continue.spec.ts` |
| `run_playwright_with_hot_reload.cmd` | CMD | 热重载 Playwright 测试 | 利用后端热重载，不重启服务即可运行 E2E |
| `run_complete_test_suite.cmd` | CMD | 完整测试套件 | 自动启动前后端服务，运行全部后端 + 前端测试 |
| `run_all_tests.cmd` | CMD | 后端 API 测试（完整版） | 不启动服务，直接运行 4 个后端测试 |
| `run_all_tests.bat` | BAT | 完整自动化测试（旧版） | 启动服务、运行测试、生成日志、结束后清理进程 |
| `quick_test.py` | Python | 快速验证 | 截断检测逻辑 + 短代码生成快速验证 |
| `../check_db.py` | Python | 数据库检查 | 查看 SQLite 表、项目、聊天记录，位于 `scripts/check_db.py` |

## 前置条件

- 后端：`apps/backend` 已安装 Python 依赖（`pytest`、`pytest-asyncio`、`pytest-timeout` 等）
- 前端：`apps/frontend` 已安装 Node 依赖并执行 `npx playwright install`
- 端口：后端默认 `3200`，前端开发服务器默认 `5184`

## 常用命令

```powershell
# 智能运行全部测试（需先启动服务）
powershell scripts/testing/smart_test_runner.ps1 -All

# 只跑后端
powershell scripts/testing/run_backend_tests.ps1

# 只跑前端 E2E（需先启动服务）
scripts/testing/run_playwright_tests.cmd

# 完整套件（自动启动并停止服务）
scripts/testing/run_complete_test_suite.cmd

# 快速验证
python scripts/testing/quick_test.py

# 数据库检查
python scripts/check_db.py
```

## 关联文档

- 测试计划与报告：`.trae/documents/testing/`
- 自动续接测试指南：`.trae/documents/testing/guides/auto_continue_testing_guide.md`
- 热重载测试指南：`.trae/documents/testing/guides/hot_reload_testing_guide.md`

## Agent 同步规则

| 动作 | 负责 Agent | 更新位置 |
|------|------------|----------|
| 新增测试脚本 | 测试 Agent / 开发 Agent | 本 README 脚本清单 + `.trae/documents/testing/README.md` 测试脚本位置表 |
| 修改脚本端口/路径 | 开发 Agent | 对应脚本 + 本 README 前置条件 |
| 脚本废弃 | 测试 Agent | 本 README 状态标注 + 从 `.trae/documents/testing/README.md` 移除 |

## 禁止事项

- 禁止在脚本中硬编码 `G:\`、`D:\` 等绝对路径。
- 禁止将新的测试脚本直接放在项目根目录。
- 禁止脚本运行时修改生产数据库或生产配置文件。
