# 范本：Agent 用 fineSTEM 在线制作《生态岛》项目

日期：2026-11-02｜状态：**对话式制作已完成（私有），待统筹复核**。
本目录是"Agent 以创作者身份用 Playwright 驱动 wostemstudio.top，与 AI 导师**从零对话式制作**生态岛 sample"的完整过程范本——即用户要求的"像人一样一步步做"。

## 0. 成果（对话式重做版，全部真实过程）

| 项 | 值 |
|---|---|
| 平台项目 | https://wostemstudio.top/research/projects/04f835ac-e922-4bde-ad11-8079b74ad3f4 |
| 项目名 | 生态岛：小岛为什么变了？（模型版本 eco-island-v1，教学设定待 A 确认） |
| 成果档案卡 | https://wostemstudio.top/research/projects/04f835ac-e922-4bde-ad11-8079b74ad3f4/achievement（卡 5107fb7b-…，私有，AI应用标签） |
| 制作账号 | eco-island@finestem.dev / EcoIsland2026 |
| 代码文件 | code/eco-island-ai-chat-v1.html（AI 三段拼装版）→ eco-island-ai-chat-v2.html（AI 方案+作者落地 4 处 UI 修复，现行版）；build-v2.cjs 为修复构建脚本 |
| 旧 API 注入项目 | 已按用户要求删除（9ff0b592…，见 dev-log 删除记录；其分享 token 残留清理待部署 Agent 执行第 8 步） |

## 0.5 过程一览（细节见 dev-log"对话式重做全过程"）

开题 → AI 静默 4 分钟（催问激活）→ AI 三次误报"已写入编辑器"（根因：`project_code_writer` 工具因 `CODE_ALLOWED_STAGES` 未定义失败——平台缺陷#2）→ 长代码流式截断 → **分段协议**（3 段×≤100 行）成功交付 → 作者拼装粘贴入编辑器 → 运行 → **手算对照 AI 的 stepModel 逐位正确** → 实测抓 4 个 UI 缺陷 → 对话迭代 → AI 修正版被**聊天管道损坏**（丢围栏+过滤 `<option>`——平台缺陷#3）→ 作者按 AI 方案落地修复（v2）→ **复测全部通过**（含档位精确 36.9、画面联动 0.298/11.07%、动物点确定性）→ 改名 → 成果卡。

## 1. P0 验收（v2 现行版实测，DOM 级与手算逐项对照）

## 1. 成果位置（历史记录——旧项目已于 2026-11-02 删除，链接均已失效）

> ⚠️ 下表是已删除的 API 注入旧项目的历史记录，仅存档用。**现行项目见 §0**（04f835ac…）。

| 项 | 值（已失效） |
|---|---|
| 平台项目 | ~~https://wostemstudio.top/research/projects/9ff0b592-00cc-4ce6-9eb7-a5116d4a96a6~~（已删除） |
| 成果档案卡 | 同项目（已删除） |
| 卡片 ID | 6c2d893e-eac4-4a3e-a3b0-5c3e301fa96a（已随项目删除） |
| 分享 token | 9OU5pGv4ROMjGm4tnkqh4w——**残留风险**：分享接口不校验删除状态，截至 2026-11-02 实测仍可匿名访问，清理步骤见 部署_AI导师修复/腾讯云Agent指令.md 第 8 步（待执行） |
| 制作账号 | eco-island@finestem.dev / EcoIsland2026（生产站注册，专用于本 sample，现行项目仍在用） |
| 运行方式 | 打开项目 → fineSTEM 工作台编辑器 → 点"运行"，iframe 沙箱内本地执行，无外部服务 |

## 2. 交付物

- `code/eco-island-reference.html` — 参考版完整代码（与平台项目工作区内容一致，14711 字符）
- `evidence/` — 运行截图与平台状态证据（B-E001、B-E002、G-E001）
- `dev-log.md` — 真实开发过程记录（含全部实际失败）
- `HANDOFF.md` — 交接文档（按公共约定 §7）

## 3. 模型口径（重要：待 A 确认）

modelVersion = `eco-island-v1`，全部参数为**教学设定**，严格采用 01 公共约定 §4 的建议接口，等待 A 包确认或替换：

- 状态 `state = { step, grass, herbivores, water }`，指数 0–100
- 配置 `config = { modelVersion, initialState, environment, maxSteps }`
- 核心函数 `stepModel(previousState, config)`：纯函数、不改旧状态、无随机数
- 每步固定顺序：①草生长（water>0：grass<80 时 +2，否则 +0.5；干旱不长）②动物吃草（herbivores×0.8）③动物增减（草>50 +2；草<20 −3；限 0–100）④水分（+档位 −herbivores×0.3；档位 低=1/中=3/高=6，默认中）
- 默认初始：grass=60, herbivores=20, water=50, maxSteps=60
- 配置行为固定为：**初始条件只在重置后生效；环境档位暂停时可改并记录；运行速度不影响结果**

## 4. 已验证的 P0 清单（DOM 级实测，与手算逐项对照）

| 检查 | 实测 | 手算预期 | 结果 |
|---|---|---|---|
| 第 0 步静态状态 | 草60/动物20/水50 | 同 | ✅ |
| 单步 1 | 草46/动物20/水47 | 62−16, 20, 50+3−6 | ✅ |
| 单步 2 | 草32/动物20/水44 | 48−16, 20, 47+3−6 | ✅ |
| 开始→暂停（第3步） | 草18/动物17/水41 | 34−16, 20−3, 44+3−6 | ✅ |
| 暂停时改档位为低后单步 | 草6.4/动物14/水36.9 | 20−13.6, 17−3, 41+1−5.1 | ✅ |
| 重置 | 草60/动物20/水50 | 回到初始 | ✅ |
| 重置后单步复现 | 46/20/47 → 32/20/44 | 与首次完全一致（确定性） | ✅ |
| 运行中改滑杆 | 提示"重置后生效" | 按规格 | ✅ |
| 运行中改档位 | 回退+记录"请先暂停" | 按规格 | ✅ |
| 重置后新初始值生效 | 草30/动物20/水50 | 滑杆新值仅在重置生效 | ✅ |

过程记录、干旱提示、最大步数自动暂停均已实现并观察正常。画面与状态一致（画布草地/动物点/水条随状态变化）。

## 5. 复刻路径（给孩子/后续 Agent 照做，5 步）

1. 注册/登录 https://wostemstudio.top/（无验证码，任意格式邮箱即可）
2. 进入"创造"，在输入框写项目开题（开题全文见 `dev-log.md` §消息记录，可直接照抄）
3. AI 导师生成代码后"写入编辑器"（**当前生产 AI 导师链路有缺项，见 §6**；修复前可先本地准备 HTML，粘贴/导入编辑器）
4. 点"运行"预览，按 §4 清单自查
5. 项目主页生成"成果档案卡"，可分享或申请上灵感墙

## 6. 平台缺项（给 G 包的核心输入）

**AI 导师（ZeroClaw WS 链路）生产不可用**，所有远程用户均受影响。报错原文：
"请求失败：未配置 ZeroClaw Bearer Token，请设置 VITE_ZC_TOKEN 或在 localStorage 存储 zeroclaw_bearer_token"

根因（基于仓库代码与线上 bundle 实测）：
- 线上主 bundle `assets/index-B2cL8uvE.js` 既无 `VITE_ZC_TOKEN` 也无 `VITE_ZC_URL`（构建未加载 `apps/frontend/.env.production`）
- 缺省 WS 地址回退到 `wss://127.0.0.1:42617`（访问者本机），远程必败
- 且 `.env.production` 中 `VITE_ZC_URL=wostemstudio.site` 仍是旧域名，域名迁移（wostemstudio.top）后未更新

修复建议：重建前端时加载 `.env.production` 并将 `VITE_ZC_URL` 改为 `wostemstudio.top` 的反代路径；确认服务器 ZeroClaw daemon 的配对 token 有效。证据见 `evidence/G-E001_AI导师生产缺项证据.png` 与 dev-log。

## 7. 范围说明

- 本范本只交付参考版（reference）。B 任务书要求的 starter/三个 checkpoints/variants/standard 由 B 包按任务书补齐；本包已给出改造任务建议：**新增"低=0（无补充）"档位**，diff 最小、对照清晰
- 主站业务代码零改动；平台操作全部走既有用户功能（编辑器/保存/运行/成果卡），未触碰 Know 内容、未发布公开内容
