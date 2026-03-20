# 技术报告（40_tech_report）

> 用途：记录实现/实验/测试全过程。每次做事都追加一条日志（不要事后补）。

- 项目：文学知识卡 - 二次元漫画版
- 轨道/模板：web_flask / flask_basic
- 版本：v1
- 日期：2026-03-03

## 1. 技术架构概览（≤150字）
- 模块：Flask 路由层、模板渲染层、数据存储层（JSON）、外部能力层（网页抓取与 AI 图像生成）。
- 数据/信号流：用户操作 → Flask 路由 → 读写 `poetry_data.json` 或调用外部接口 → 返回 HTML/JSON → 前端更新展示。

## 2. 里程碑与步骤（来自 step_plan）
- 里程碑：
  - M1：基础框架搭建（环境配置、应用启动、基础功能联调）
  - M2：核心功能实现（新增、收藏、搜索优化）
  - M3：高级功能实现（网页导入、自动搜集、AI 二次元插画）

## 3. 测试/评测计划（≥3）
- 测试1：首页加载与卡片展示 → 通过条件：可在首页看到诗词列表与分类筛选。
- 测试2：搜索与分类联动 → 通过条件：关键词搜索与分类筛选结果准确。
- 测试3：新增与收藏持久化 → 通过条件：新增内容和收藏状态在刷新后保持。
- 测试4：导入与自动搜集 → 通过条件：接口返回成功时，数据文件条目数增加。
- 测试5：AI 插画接口调用 → 通过条件：成功返回图片 URL 或明确失败信息且不影响主流程。

## 4. 开发/实验日志（每次追加一条）
### Log 2026-03-03 00:35
- 对应 step_id：step_1 ~ step_3
- 做了什么：完成 Flask 项目骨架、首页渲染、基础搜索与分类逻辑，生成阶段文档并推进到 stage_07_execute。
- 结果（成功/失败）：成功推进，主流程已具备。
- 证据（截图/日志/文件路径，放 assets/）：`src/app.py`、`docs/05_step_plan.json`、`SKILL_STATE.json`
- 遇到的问题：功能清单较多，后续迭代容易偏离 must-have 主线。
- 修复/下一步：保持“核心优先”策略，先稳定学习闭环，再加 AI 增强。

### Log 2026-03-03 01:10
- 对应 step_id：step_7 ~ step_9（设计对应）
- 做了什么：实现网页导入、自动搜集接口与二次元插画生成接口，完善统计页面路由。
- 结果（成功/失败）：代码已落地，待持续联调与稳定性验证。
- 证据（截图/日志/文件路径，放 assets/）：`src/app.py` 路由与函数定义、`src/data/poetry_data.json`
- 遇到的问题：外部页面结构差异与 AI API 可用性影响成功率。
- 修复/下一步：增强错误提示与回退机制，补充执行阶段测试日志。

### Log 2026-03-18 14:04
- 对应 step_id：step_9（阶段证据补齐）
- 做了什么：启动本地 Flask 服务并自动采集关键页面截图，补齐 `assets/screenshots`、`assets/charts`、`assets/logs`、`assets/results` 证据。
- 结果（成功/失败）：成功，证据目录从空目录变为可追溯目录。
- 证据（截图/日志/文件路径，放 assets/）：
  - `assets/screenshots/2026-03-18_homepage_ui.png`
  - `assets/screenshots/2026-03-18_add_page_ui.png`
  - `assets/screenshots/2026-03-18_import_page_ui.png`
  - `assets/screenshots/2026-03-18_favorites_page_ui.png`
  - `assets/screenshots/2026-03-18_stats_page_ui.png`
  - `assets/charts/2026-03-18_poetry_stats_chart.png`
  - `assets/results/2026-03-18_demo_result_homepage.png`
  - `assets/logs/2026-03-18_evidence_collection_log.txt`
- 遇到的问题：Office COM 导出偶发文件锁，导致重复导出不稳定。
- 修复/下一步：保留已生成正式报告产物；后续补充“重试与文件占用检测”逻辑。

## 5. 问题与修复清单（≥2）
- 问题1：网页导入不稳定。现象：部分链接无法提取到有效诗词正文。原因：目标站点 DOM 结构不统一。修复：增加多种标签提取策略并保留失败提示。证据：`/import` 路由与 `extract_poetry_from_web`。
- 问题2：AI 插画生成存在失败场景。现象：接口可能超时或返回格式不一致。原因：外部模型服务稳定性与响应差异。修复：捕获异常、记录错误并允许主流程继续。证据：`generate_anime_image` 与 `/api/generate_image/<id>`。
- 问题3：存在敏感配置风险。现象：代码中出现默认 API Key。原因：开发期便捷配置未彻底隔离。修复：强制使用环境变量并清理默认密钥。证据：`src/app.py` 配置段（待整改）。

## 6. 关键决策与取舍
- 不做（wont-do）：用户注册登录系统；多人协作功能。
- 选择该实现的原因：在 12h+ 预算下优先保证学习主流程，减少基础设施开发负担。
- 取舍说明：AI 插画和自动搜集作为增强模块，失败不影响核心“录入-搜索-收藏-复习”主链路。

## 7. 产物索引
- 关键文件：`src/app.py`、`src/data/poetry_data.json`、`docs/05_step_plan.json`、`SKILL_STATE.json`
- 证据目录：`docs/research/assets/`
- 关键截图：`assets/screenshots/2026-03-18_homepage_ui.png`、`assets/screenshots/2026-03-18_stats_page_ui.png`
