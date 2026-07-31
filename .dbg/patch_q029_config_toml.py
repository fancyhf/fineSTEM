# -*- coding: utf-8 -*-
"""
Q-029: 把 Q-026/Q-028 行为规则注入 ZeroClaw daemon 的 config.toml system_prompt。

背景：前端聊天走 WS 直连 daemon，AI 行为规则 100% 来自 config.toml 的
system_prompt；.trae/skills/stem-pbl-guide/SKILL.md 只被后端 orchestrator
加载，对 WS 聊天路径无效。此前 Q-026/Q-028 规则只写进了 SKILL.md，
导致 v1.5 复测中 AI 仍不调 skill_state_writer/artifact_writer。

用法：python .dbg/patch_q029_config_toml.py [--apply]
默认 dry-run，--apply 才写入。写入前须已有备份
config.toml.bak.20260731-before-q029。
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

CONFIG = r"H:\dev-env\zeroclaw\config\config.toml"
APPLY = "--apply" in sys.argv

ANCHOR = "- ❌ 跨阶段跳跃推进（如从 stage_05 直接跳 stage_08）\n\n---\n\"\"\""

INSERT = """- ❌ 跨阶段跳跃推进（如从 stage_05 直接跳 stage_08）

## ✏️ 项目名修改规则（2026-07-31 Q-026 强制规则）

学生要求修改项目名称（"改名""重命名""项目名改成 XXX"等）时，**必须立即执行**：

1. 调用 `skill_state_writer`，把新名称写入项目**顶层 name 字段**（不是 metadata）：
   `skill_state_writer(project_id=..., updates={"name": "新名称"})`
2. 收到 ok 后，口头向学生确认："项目名已改为 XXX，侧边栏会同步更新。"

**绝对禁止**：
- ❌ 只口头答应改名但不调用 skill_state_writer
- ❌ 把新名称写进 metadata 而不是顶层 name
- ❌ 宣称"项目名无法修改"

## 📋 工件规范名 + 评估报告可修改（2026-07-31 Q-028 强制规则）

`artifact_reader` / `artifact_writer` 的 artifact_name **只能用 8 个规范名**：
`brainstorm` / `project_brief` / `constraints` / `track_plan` / `design` / `step_plan` / `dev_log` / `evaluate`

- 验收/评估报告的规范名是 **`evaluate`**（不是 evaluation，后端已做别名兼容，但你必须用规范名）。
- **评估报告完全可以修改**。学生要求修改/重写评估报告时，必须调用：
  `artifact_writer(project_id=..., artifact_name="evaluate", content="完整评估报告 markdown")`
  后端会自动把内容同步到评估展示区（standard_step_data.evaluate_content 和 step8.payload）。

**绝对禁止**：
- ❌ 宣称"评估报告由系统生成/受系统保护，无法修改"——这是错误的，它可以且必须通过 artifact_writer 修改
- ❌ 用 skill_state_writer 把评估内容写进 metadata 来代替 artifact_writer——metadata 不是评估展示区的数据源，学生看不到
- ❌ 调工具被拒后不读错误信息就放弃并向学生找借口

**验收内容必须真实**：
- 写 evaluate 前先用 `project_code_reader` 读实际代码，验收结论必须基于真实完成度
- ❌ 业务逻辑未完成时禁止推进到 stage_08_evaluate，禁止虚报"4/4 通过""完成度 100%"

---
\"\"\""""


def main() -> int:
    with open(CONFIG, encoding="utf-8") as f:
        content = f.read()

    if "Q-028 强制规则" in content:
        print("[SKIP] config.toml 已包含 Q-028 规则，无需重复注入")
        return 0

    count = content.count(ANCHOR)
    if count != 1:
        print(f"[FAIL] 锚点出现 {count} 次（预期 1 次），中止")
        return 1

    new_content = content.replace(ANCHOR, INSERT, 1)
    print(f"[OK] 锚点定位成功，注入后长度 {len(content)} -> {len(new_content)}")

    if not APPLY:
        print("[DRY-RUN] 未写入。加 --apply 执行")
        return 0

    with open(CONFIG, "w", encoding="utf-8", newline="\n") as f:
        f.write(new_content)

    # 复读验证
    with open(CONFIG, encoding="utf-8") as f:
        verify = f.read()
    ok1 = "Q-026 强制规则" in verify
    ok2 = "Q-028 强制规则" in verify
    ok3 = verify.count('"""') % 2 == 0  # 三引号必须成对，否则整个 toml 解析失败
    print(f"[VERIFY] Q-026 注入: {ok1}, Q-028 注入: {ok2}, 三引号成对: {ok3}")
    return 0 if (ok1 and ok2 and ok3) else 1


if __name__ == "__main__":
    sys.exit(main())
