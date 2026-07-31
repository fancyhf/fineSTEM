# -*- coding: utf-8 -*-
"""2026-07-30 截断/诊断治理：给 ZeroClaw config.toml 注册 project_code_reader 并更新 system_prompt。"""
import io

PATH = r"H:\dev-env\zeroclaw\config\config.toml"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    text = f.read()

crlf = "\r\n" in text

REPLACEMENTS = [
    # ① auto_approve 注册新工具（否则调用会等人工审批 → 120s 超时）
    (
        '  "finestem__project_code_writer",\n',
        '  "finestem__project_code_writer",\n  "finestem__project_code_reader",\n',
    ),
    # ② 工具数 12 → 13
    (
        "你已被赋予 12 个 finestem PBL 工具",
        "你已被赋予 13 个 finestem PBL 工具",
    ),
    # ③ 工具清单：writer 描述补充 + 新增 reader 条目
    (
        "  - project_code_writer  将完整代码写入学生编辑器工作区\n",
        "  - project_code_writer  将完整代码写入学生编辑器工作区（长代码用 mode=append 分块写）\n"
        "  - project_code_reader  读取学生工作区的现有代码（诊断 bug 前必读）\n",
    ),
    # ④ 新增两个规范段落（插在 ask_question 规则之后）
    (
        "**需要学生做选择时，调用 `ask_question` 工具**（不要用 markdown 编号列表或 XML）。\n",
        "**需要学生做选择时，调用 `ask_question` 工具**（不要用 markdown 编号列表或 XML）。\n"
        "\n"
        "## 🔍 代码问题诊断规范（重要）\n"
        "学生汇报“代码有问题 / 报错 / 按钮没反应 / 不工作”等 bug 时，**严禁**只给泛泛的排查清单。必须：\n"
        "1. 第一步先调用 `project_code_reader` 读取学生工作区的真实代码（可先 list_only=true 看文件清单）\n"
        "2. 基于真实代码定位具体问题，明确指出出错的函数/位置和原因\n"
        "3. 给出针对性修复：小改动直接告诉学生改哪里；大改动用 `project_code_writer` 写回修复后的完整代码\n"
        "4. 修复后提醒学生刷新预览验证，并用一两句话解释“为什么会出这个 bug”\n"
        "\n"
        "## 📦 长代码分块写入规范（防截断，重要）\n"
        "调用 `project_code_writer` 时，单次 code 参数**不要超过约 300 行**，否则会被输出 token 上限截断，导致 Invalid JSON 错误：\n"
        "- 短代码（≤300 行）：一次写完，mode=\"replace\"（默认，可不传）\n"
        "- 长代码（>300 行）：拆成多块依次写入——第一块 mode=\"replace\"，后续每块 mode=\"append\"（同一 filename，工具自动拼接到文件末尾）\n"
        "- 每块必须在完整语句/函数边界处断开，不要在字符串或标签中间断开\n"
        "- 全部块写完后再向学生汇报“代码已完成”\n",
    ),
]

for old, new in REPLACEMENTS:
    if crlf:
        old = old.replace("\n", "\r\n")
        new = new.replace("\n", "\r\n")
    count = text.count(old)
    if count == 0:
        raise SystemExit("NOT FOUND: %r" % old[:60])
    if count > 1:
        raise SystemExit("NOT UNIQUE (%d): %r" % (count, old[:60]))
    text = text.replace(old, new)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(text)

print("OK: config.toml patched (4 replacements applied)")
