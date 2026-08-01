# -*- coding: utf-8 -*-
# 测试计划 v1.11 登记：SearchReplace 对中文路径文档保存失败，脚本直写磁盘（幂等）
import io

PATH = r"g:\mediaProjects\fineSTEM\.trae\documents\testing\测试计划_创造功能增强_2026-07-30.md"

with io.open(PATH, "r", encoding="utf-8") as f:
    text = f.read()

if "v1.11" in text:
    print("already registered")
    raise SystemExit(0)

OLD_HEADER = "- 版本：v1.10（2026-07-31，Q-037 评估展示残留占位模板修复：step8.payload 与真实 evaluate_content 联动、解析器按标题层级处理、占位优先级降级，新增 TC-14；上一版 v1.9 见下方）"
NEW_HEADER = "- 版本：v1.11（2026-07-31，Q-038 创建页四大疾病修复：纯问答场景不建项、发消息不卡死（onclose settle+停止按钮）、后端四场景提示词接入 WS 链路、回答不落思考区，新增 TC-15；上一版 v1.10 见下方）"
assert OLD_HEADER in text, "旧版本行未找到"
text = text.replace(OLD_HEADER, NEW_HEADER, 1)

OLD_REPORT = "- 报告输出：`.trae/documents/testing/reports/创造功能增强_实测报告_v1.10_2026-07-31.md`"
NEW_REPORT = "- 报告输出：`.trae/documents/testing/reports/创造功能增强_实测报告_v1.11_2026-07-31.md`"
assert OLD_REPORT in text, "报告输出行未找到"
text = text.replace(OLD_REPORT, NEW_REPORT, 1)

TC14_HEADER = "## 【v1.10 新增】TC-14：评估展示 payload 与真实 evaluate_content 联动（Q-037 / RT-37）"
assert TC14_HEADER in text, "TC-14 标题未找到"

TC15 = """## 【v1.11 新增】TC-15：创建页场景门禁 + 不卡死 + 回答可见（Q-038 / RT-38）

**背景**：①「问问题/解释代码/写报告」纯问答也被强制自动建项目并跳「2.脑暴选题」；②发消息后 AI 无反馈、输入框永久锁死；③后端 SCENE_SYSTEM_PROMPTS 从未接入 WS 主链路；④随意问模式 AI 把回答写在思考区。已修（后端 `zeroclaw_provider.py`+`agent.py`，前端 `Create.tsx`+`useStreamingChat.ts`+`lib/scenePrompts.ts` 新建+`services/api.ts`），详见问题清单 Q-038。

**前置**：前端需重新构建（dev 模式 Vite 热更新即可）；后端 uvicorn --reload 热加载；daemon 无需重启。

| 步骤 | 操作 | 断言 |
|---|---|---|
| 1 | 登录态打开 /create → 点「问问题」→ 发“什么是二进制？” | AI 直接回答（正文气泡有实质内容）；不创建项目、不跳「2.脑暴选题」；侧边栏项目区无新项目 |
| 2 | 同一会话继续发“我想问一个 STEM 相关的问题” | AI 追问具体问题而非建项；控制台无 project bootstrap 请求 |
| 3 | 「开始项目」场景发“我想做一个贪吃蛇游戏” | 正常建项并进入 PBL 引导（门禁不误伤） |
| 4 | DevTools 看 WS 帧：任意场景发消息 | 消息文本含 `<scene_instructions>` 块（非开始项目场景含后端场景提示词；所有场景含输出可见性规则） |
| 5 | 停掉 ZeroClaw daemon → 发消息 | ≈8s 内气泡显示友好离线文案（非永久转圈）；输入框恢复可用，可重新发送 |
| 6 | 恢复 daemon → 发消息 → loading 中再次敲回车输入 | 出现「AI 正在回复中，请等待完成或点“停止”后再发送」提示条（`[data-testid="send-blocked-hint"]`，3s 自隐） |
| 7 | loading 中点发送位停止按钮（`[data-testid="stop-button"]`）或三点动画旁「停止」 | 流立即中止；已收内容保留（空气泡显「⏹️ 已停止本次回复」）；无“请求失败”文案；输入框立刻可用 |
| 8 | 随意问模式问一个知识问题 → 展开「深度思考」比对 | 实际回答在正文气泡；若 AI 仍把答案写思考区，salvage 兜底把实质内容提升为正文（console 有 `Q-038 salvage` 日志） |
| 9 | 欢迎页点三条引导链接 | 按标注场景路由：“把这段代码讲清楚…”走解释代码（不建项），其余两条走开始项目 |

**快速回归**：`cd apps/backend; python ../../.dbg/verify_scene_prompts_api.py`（本轮已过：200，7 场景，问答约束在）；前端 `npx tsc --noEmit`（本轮零错误）。

**注意**：场景提示词有 30 分钟 sessionStorage 缓存；后端改提示词后需清 sessionStorage（key `scene_prompts_cache_v1`）或新开标签页验证。

---

"""

text = text.replace(TC14_HEADER, TC15 + TC14_HEADER, 1)

with io.open(PATH, "w", encoding="utf-8", newline="\n") as f:
    f.write(text)

print("OK: test plan bumped to v1.11 with TC-15")
