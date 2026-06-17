# Create 主链路 Smoke 盖章报告 v1.0.0

> 接续：`创造主链路交接文档_v1.0.0_2026-06-16_173116000.md` 第 8 节「第一优先级」。
> 本报告只记录最新版 smoke 在干净终端的正式盖章结果，不改写交接原文档。

## 1. 执行结论

| 项 | 值 |
|---|---|
| 执行脚本 | `python scripts/run_create_smoke.py` |
| 执行环境 | 干净终端（非先前异常会话），仓库根目录 |
| Python | CPython 3.12.1 (`C:\Python312\python.exe`) |
| 启动时间(UTC) | 2026-06-16 13:49:42 |
| 脚本退出码 | **0** |
| `overall_passed` | **true ✅** |
| summary 文件 | `create-smoke-summary_20260616_135129.json` |

## 2. 三件套产物（本仓库 `.trae/documents/testing/`）

| 产物 | 文件名 | 结果 |
|---|---|---|
| 汇总 JSON | `create-smoke-summary_20260616_135129.json` | `overall_passed: true` |
| 后端回归日志 | `create-smoke-backend-tests_20260616_134942.log` | 41 passed |
| 前端 E2E 日志 | `create-smoke-frontend-tests_20260616_134959.log` | 5 passed |
| 后端服务日志 | `create-smoke-backend_20260616_134959.log` | uvicorn 自起·自停正常 |
| 前端服务日志 | `create-smoke-frontend_20260616_134959.log` | vite 自起·自停正常 |

## 3. 分模块明细

### 3.1 后端 /create 关键回归
- 命令：`python -m pytest tests/test_agent.py tests/test_projects.py -q`
- 耗时：**17.85s**
- 退出码：0
- 结果：**41 passed, 327 warnings**
- 覆盖范围：项目 CRUD / 轻项目步骤 / 标准项目步骤 / 升级 / 推进 / 导出（md/json/zip/pdf/docx）/
  **教学模式提示词注入（guided/demo/hands_on/lecture 四模式系统提示词断言）** /
  **教学模式黑盒行为（四模式 LLM 输出形态断言）** /
  **WebSocket 教学模式 token 流式返回（guided 分支）**。

### 3.2 前端 /create 关键 E2E
- 命令：`playwright test` 五个 spec（`--project=chromium --reporter=list`）
- 耗时：**72.37s**
- 退出码：0
- 结果：**5 passed (1.0m)**，逐条：

| # | spec | 用例 | 耗时 |
|---|---|---|---|
| 1 | `create-development-preview.spec.ts` | 恢复到编辑器后的 HTML 项目可以运行并显示预览内容 | 6.7s |
| 2 | `create-guided-pbl-mainline.spec.ts` | 回答基础三问后进入方向与技术建议，不再重复问年级和时间 | 22.7s |
| 3 | `create-history-restore.spec.ts` | 切换历史项目时恢复聊天和代码，且不会立刻回写覆盖 | 13.3s |
| 4 | `create-teaching-mode.spec.ts` | 在执行阶段可以切换四种教学模式并持久化 | 6.2s |
| 5 | `project-detail-final-report.spec.ts` | 可以导出结题 DOCX，并生成包含结题重点的 final markdown | 6.2s |

## 4. 工程化收口确认（脚本能力）

最新版 `scripts/run_create_smoke.py` 已在本机验证具备以下自动能力，单条命令即可「起服务 → 跑回归 → 关服务 → 落三件套」：
- 启动前删除 `D:/data/finestem/test_finestem.db`，避免脏 schema 污染。
- 自动拉起后端（`uvicorn` @ 3200）与前端（`vite` @ 5284），带健康检查。
- 回归结束后自动清理**自身拉起的**服务进程。
- 一并产出 summary JSON + 后端/前端测试日志 + 服务日志。

## 5. 与历史 summary 的关系（避免误读）

历史 summary 中：
- `075254` / `075353`：失败原因是前端 dev server 尚未就绪时的过渡产物，**不代表当前代码结论**。
- `075550`：曾通过，但当时未形成最终盖章记录。
- `080107`：后端过渡失败的一次 flake，独立复跑通过，**不被采信为最终结论**。

**本报告所依据的 `135129` 是首次在干净终端、由最新版脚本一次性产出的可信盖章结果，采信度最高。**

## 6. 结论

Create 主链路一次性重构的交付集合已完成并正式盖章通过：

1. **Create 主链本体**（引导式 PBL 主路径、设计开发与运行预览）。
2. **历史项目恢复**（切换历史项目恢复聊天与代码、不立刻回写覆盖）。
3. **教学模式**（guided/demo/hands_on/lecture 四模式前端切换 + 持久化 + 后端提示词注入 + 黑盒输出形态 + WS token 流式返回）。
4. **项目详情页结题报告**（DOCX 导出 + final markdown）。
5. **工程化收口**（`run_create_smoke.py` 自动起停 + 三件套）。

第二优先级项（如 `datetime.utcnow()` / Pydantic V1 class-config / httpx `app=` 快捷方式等弃用警告的大规模清理）**按交接约定默认不做**，待需要时另行确认。

---

*生成时间：2026-06-16 13:51 (UTC)*
*依据：`create-smoke-summary_20260616_135129.json`*
