# 生态岛：小岛为什么变了？——作品包（B 包交付）

日期：2026-11-03｜模型版本 eco-island-v1（教学设定，已经 A 包确认冻结，见 交付/A_科学模型/model-spec.md）｜codeVersion：reference = v3（对应线上项目 04f835ac-e922-4bde-ad11-8079b74ad3f4 现行版本）

一个确定性生态模拟网页：小岛上的草、食草动物（🐰）、水三个指数按固定规则逐步变化，孩子通过"改变一个条件"观察哪些状态跟着变。

## 怎么打开

**方式一（推荐先玩）**：直接双击任意 `eco-island.html`，用 Chrome/Edge 打开。零依赖、无需安装、可离线。

**方式二（导入 fineSTEM 平台）**：
1. 打开 https://wostemstudio.top/ 注册/登录
2. 进"创造"页，把整个 HTML 文件内容粘贴进右侧编辑器
3. 点【保存】→ 点【运行】，右侧出预览即可玩
4. 已知平台限制（详见 G 包 platform-check.md）：AI 导师直接生成长代码会被截断（分段索要可绕过）；聊天里复制的代码可能被清洗损坏，**代码一律走编辑器粘贴**

## 目录导览（按孩子使用顺序）

| 路径 | 是什么 | 什么时候用 |
|---|---|---|
| `checkpoints/01-static/` | 第 1 关：认识小岛（只看第 0 步） | 第一次接触 |
| `checkpoints/02-single-step/` | 第 2 关：走一步+手算对照 | 理解"一步"发生了什么 |
| `checkpoints/03-full-control/` | 第 3 关：全部解锁跑实验 | 完整玩 + 三个对照实验 |
| `starter/eco-island.html` | **起始版**：能跑但有 5 处被挖错（搜 `TODO(学生)`） | 开始学编程时 |
| `variants/standard/` | 标准改造版："干旱岛"（无雨档 low=0）+ notes.md 实测记录 | 做第一次规则改造 |
| `reference/eco-island.html` | 参考版（标准答案） | 对照与验收 |
| `code-map.md` | 代码地图：每个函数干什么、值得学的 5 处 | 看代码时 |
| `test-report.md` | 测试证据汇总 | 验收与引用 |
| `evidence/` | 运行截图等证据（B-E001~006） | 汇报引用 |
| `dev-log.md` | 真实开发日志（含全部失败） | 作者档案原料 |

## 推荐复刻路线

参考版试玩（3 关 checkpoints 顺序走）→ starter 挑战（修 5 个 TODO）→ 对照 reference 验收 → 选一个改造（先做 variants/standard 的"干旱岛"）→ 保存你的版本和实验记录。

## 模型口径

见 `code-map.md` §模型规范摘要；完整规范见 A 包 model-spec.md：交付/A_科学模型/model-spec.md（已冻结；G 包已做逐字比对验证一致）。参数为教学设定，不代表真实生态预测。
