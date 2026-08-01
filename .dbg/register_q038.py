# -*- coding: utf-8 -*-
# Q-038 登记：SearchReplace 保存失败/缓冲回滚后，用脚本直接写磁盘（幂等）
import io

PATH = r"g:\mediaProjects\fineSTEM\.trae\documents\问题清单_长期维护.md"

with io.open(PATH, "r", encoding="utf-8") as f:
    text = f.read()

if "Q-038" in text.replace("新增 Q-038", ""):
    print("already registered")
    raise SystemExit(0)

lines = text.split("\n")
out = []

Q038_ROW = "| Q-038 | 创建页四大疾病：①「问问题/解释代码/写报告」纯问答也被强制自动建项目并跳「2.脑暴选题」②发消息后 AI 无反馈、输入框永久锁死（ws.onclose 不 settle promise + isLoadingRef 异常路径不复位）③后端四场景 SCENE_SYSTEM_PROMPTS 从未接入 WS 主链路（daemon 只读 config.toml）④随意问模式 AI 把实际回答写在思考区，正文只剩引导语+选项卡，学生看不到答案 | 🟢已修 | 2026-07-31 | 2026-07-31 |"

RT38_ROW = "| RT-38 | 创建页场景门禁 + 不卡死 + 回答可见 | Q-038 | ① 点「问问题」发“什么是二进制？”② 断开 daemon 后发消息 ③ loading 中再次输入 ④ 随意问看回答位置 ⑤ 欢迎页点引导链接 | ① AI 直接回答，不建项目、不跳「2.脑暴选题」，侧边栏无新项目 ② 8s 内出友好错误文案（非永久转圈），输入框恢复可用 ③ 出现「AI 正在回复中」提示条（非静默丢弃），可点停止按钮中止 ④ 实际回答在正文气泡（非仅思考折叠区+选项卡）⑤ 引导链接按标注场景路由（解释代码类不建项）；接口冒烟：`.dbg/verify_scene_prompts_api.py` |"

Q038_DETAIL = """
---

### Q-038 创建页四大疾病：纯问答强建项、发消息卡死、场景提示词未接入、回答落入思考区

**状态**：🟢 已修（2026-07-31）

**现象**（用户报告，附 4 张截图）：
1. 点「问问题」或直接录入“我想问一个 STEM 相关的问题”→ 系统自动创建项目并跳到「2.脑暴选题」，纯提问被强拉进 PBL 九步流程。
2. 发消息后 AI 无任何反馈，卡死在对话框，重新写入也无反应（输入框 disabled + 守卫静默拦截）。
3. 随意问模式下 AI 在「深度思考」折叠区里写了对问题的完整回答，正文只展示一句引导语+选项卡，学生看不到答案。

**根因链**：
1. **强建项**：Q-024 修复时「登录用户无项目就无条件 API 建项」（Create.tsx）+ 流末关键词兜底建项，完全不看场景；后端虽有 SCENE_SYSTEM_PROMPTS 四场景差异化提示词，但只在 REST 编排链路生效——前端主聊天是 WS 直连 daemon，daemon 只读 config.toml 内嵌的 PBL 导向 system_prompt（Q-029 同源问题的场景变体）。
2. **卡死双根因**：① useStreamingChat 的 ws.onclose 只清计时器不 settle promise，握手失败/中途断开时 stream() 永久挂起 → isLoading 永久 true → 输入框永久 disabled；② Create.tsx 的 finally 只复位 isLoading state 不复位 isLoadingRef，异常路径下 ref 残留 true，handleSend 守卫永久静默拦截；另无任何中止手段，用户只能刷新。
3. **回答落思考区**：daemon 的 PBL 提示词驱使 AI 把“回答内容”当作内部推理写进 thinking 帧，正文只留引导+ask_question；提示词从未告知 AI“思考过程学生不可见”。

**修复方案**（后端 2 文件 + 前端 4 文件）：

| 层 | 文件 | 修复 |
|----|------|------|
| 提示词治本 | `zeroclaw_provider.py` | STEM_SYSTEM_PROMPT 加「输出可见性规则」（思考不展示给学生，答案必须写正文）；问问题/解释代码/写报告三场景加「不启动 PBL 九步、不调 project_creator」约束 |
| 提示词暴露 | `agent.py` | 新增 `GET /agent/scene-prompts`（无鉴权）暴露 SCENE_SYSTEM_PROMPTS，保证两条链路单一来源 |
| 前端拉取 | `lib/scenePrompts.ts`（新建）+ `services/api.ts` | 场景提示词拉取+内存/sessionStorage 30min 缓存+内置 FALLBACK 降级；导出 OUTPUT_VISIBILITY_RULE |
| WS 注入 | `useStreamingChat.ts` | buildOutgoingMessage 把 context.scene_instructions 包成 `<scene_instructions>` 块前置到消息文本 |
| 场景门禁 | `Create.tsx` | QA_SCENES=[问问题/解释代码/写报告]；shouldBootstrapProject=!isQaScene && (开始项目 或 项目意图正则 或 选项卡回答)；Q-024 首消息建项与流末关键词兜底建项都改用此门禁；每轮注入场景提示词+输出可见性规则 |
| 死锁解除 | `useStreamingChat.ts` | settled/deliberateSettle 双标志包装 resolve/reject；ws.onclose 兜底 settle（有内容 resolve stalled，无内容 reject 带 isDaemonDown/isTimeoutError 标志）；connected 发消息后立即 resetIdleTimer（首帧 90s 窗口）；新增 abortActiveStream()/isAbortError() 导出 |
| 死锁解除 | `Create.tsx` | finally 加 isLoadingRef.current=false；守卫拦截时显示 sendBlockedHint 提示条（不再静默丢弃）；loading 时发送按钮变停止按钮 + 三点动画旁加「停止」；handleStartNewProject 先 abortActiveStream()；catch 内 isAbortError 早退（不显示失败文案） |
| 思考区兜底 | `Create.tsx` | salvageAnswerFromThinking()：正文<40字且 thinking>120字时，过滤元叙述行后把思考内容提升为正文（提示词层治本+前端最后防线） |
| 文案优化 | `Create.tsx` | 零内容超时不再谎称“输出被截断”（改“⏳ AI 没有及时响应”）；无内容时不显示继续按钮；欢迎页引导链接带目标场景（CODEX_SUGGESTIONS 对象化） |

**验证**：
- 前端 `npx tsc --noEmit` 零错误；`npm run build` 成功。
- 后端 `.dbg/verify_scene_prompts_api.py`（TestClient）：`GET /api/v1/agent/scene-prompts` 200，7 场景齐全，问问题场景含“不要建项目”约束。
- 后端 pytest：382 passed；9 failed/5 errors 均为既有环境类失败（sqlite 并发/需活 daemon 的 WS 用例/ask_question 工具旧断言分歧），与本次改动无关（本次后端仅改提示词文本+新增只读端点）。

**回归测试**：RT-38。

**⚠️ 工具事故记录**：本次 SearchReplace 两次意外把 Create.tsx L191 正则里的 `\\n` 转义序列转成真实换行（编辑器缓冲区与磁盘不一致时保存会把坏内容带回），用 `.dbg/fix_create_regex_newline.py` 幂等修复。含转义序列的行改动后必须 `tsc --noEmit` 验证。

**⚠️ 部署提醒**：前端需重新构建；后端 uvicorn --reload 热加载即生效。daemon 的 config.toml 无需改动（场景提示词走消息文本注入，不依赖 daemon 重启）。
"""

inserted_row = inserted_detail = inserted_rt = False
i = 0
while i < len(lines):
    line = lines[i]
    out.append(line)
    if not inserted_row and line.startswith("| Q-037 |"):
        out.append(Q038_ROW)
        inserted_row = True
    if not inserted_rt and line.startswith("| RT-37 |"):
        out.append(RT38_ROW)
        inserted_rt = True
    if (not inserted_detail
            and line.startswith("**⚠️ 部署提醒**：改动仅后端 `stage08_sync.py`")):
        out.extend(Q038_DETAIL.strip("\n").split("\n"))
        inserted_detail = True
    i += 1

assert inserted_row, "Q-037 状态表行未找到"
assert inserted_detail, "Q-037 详情部署提醒未找到"
assert inserted_rt, "RT-37 行未找到"

with io.open(PATH, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(out))

print("OK: Q-038 row/detail/RT-38 inserted")
