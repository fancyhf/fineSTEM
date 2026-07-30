# 代码截断 WS 诊断 + E2E 验证（Q-023-A 二次深度修复）

你是测试 agent。本次修复用 **Python 直连 daemon WS 抓帧**的方式实证验证，不再依赖 Playwright 的间接测试（之前测试用例太约束，测不到真实截断）。

## 本次变更（2026-07-29 二次深度修复）

用 `scripts/diag_truncation.py` 直连 daemon WS 诊断发现：daemon done 帧不带 finish_reason，且代码作为 project_code_writer 工具参数被 max_tokens 截断。3 层修复：
1. `config.toml` max_tokens 16384→65536（核心）
2. 前端截断检测改用 output_tokens（不依赖 finish_reason）
3. SKILL.md 引导分块写代码

## ⚠️ 强制要求
1. **必须重启 daemon**（config.toml 改了 max_tokens）+ 前端
2. **必须先用 WS 诊断脚本验证**（这是最可靠的验证方式）
3. 禁止改产品代码

## 必读
- `.trae/documents/问题清单_长期维护.md`（Q-023 二次深度根因修正段）

## 执行

### 步骤 0：重启 daemon（config 改了！）
```bash
Stop-Process -Name zeroclaw -Force -ErrorAction SilentlyContinue
H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon
# 等 6 秒
H:/dev-env/zeroclaw/bin/zeroclaw.exe config get providers.models.deepseek.default.max_tokens
# 预期：65536（确认配置生效）
```

### 步骤 1：WS 诊断脚本验证（最核心，最可靠）

```bash
cd apps/frontend && npm run dev &  # 启前端（WS 诊断不需要前端，但 E2E 需要）
cd G:/mediaProjects/fineSTEM
python scripts/diag_truncation.py
```

**脚本会直连 daemon WS，发一个带 project_id 的长代码生成请求，抓取完整帧序列。**

**看输出里的关键指标**：
- `output_tokens`：应远低于 65536（如 30000-50000），**不应接近 65536**
- `project_code_writer code 长度`：应为完整代码（如 15000-40000 字符），**不应在中间截断**
- `代码块 ``` 数`：chunk 文本里的代码块应闭合（偶数）
- 结尾应有 `</html>` 或类似闭合标签

**判定**：
- ✅ output_tokens < 60000 且代码完整闭合 → 修复成功
- ❌ output_tokens ≥ 60000 或代码未闭合 → 仍截断，记录 output_tokens 值

### 步骤 2：E2E 有头验证（真实前端场景）

```bash
set RUN_AI_E2E=1
cd apps/frontend
npx playwright test q023-streaming-idle-reconnect --project=chromium --headed
```

**关键验证点**：
1. 推进到 stage_07 讲解式 → 让 AI 生成完整代码
2. 编辑器里的代码**完整**（有 `</html>` 闭合，不在 CSS/JS 中段截断）
3. 控制台日志：`output_tokens` 应显示一个远低于 65536 的值
4. 如果仍截断：点"继续生成" → AI 从断点接着写

### 步骤 3：单测 + 类型
```bash
cd apps/frontend && npx tsc --noEmit   # 0 error
cd apps/frontend && npx vitest run     # 90 passed
```

---

## 报告

写到 `.trae/documents/testing/reports/代码截断WS诊断测试_Q-023A3_<日期>.md`：

| 验证项 | 方法 | 结果 | 关键数据 |
|--------|------|------|---------|
| max_tokens 生效 | `config get` | ✅/❌ | 值=65536? |
| WS 诊断 output_tokens | diag_truncation.py | ✅/❌ | output_tokens=? (<60000?) |
| WS 代码完整 | diag_truncation.py | ✅/❌ | code 长度=? 闭合? |
| E2E 编辑器代码完整 | Playwright | ✅/❌ | 截图 |
| 单测 | tsc/vitest | ✅/❌ | 0错/90过 |

**判定**：WS 诊断 output_tokens ≥ 60000 或代码未闭合 → 核心未修复，状态改🔴。记录 output_tokens 精确值和代码截断点。

**重要**：WS 诊断脚本是本次最可靠的验证方式——它直接抓 daemon 返回的帧，不经过前端任何逻辑，能 100% 确认 max_tokens 是否解决了截断。如果 WS 诊断通过但 E2E 仍截断，说明问题在前端代码处理（而非 daemon 输出）。
