# 需求与设计文档（20_prd_design）

> 用途：把“要做什么 + 怎么做”写清楚，供开发/实验阶段执行与验收。

- 项目：{project_title}
- 轨道/技术栈：{track_selected} / {template_id}
- 版本：v1
- 日期：{date}

## 1. 用户与使用场景（≤150字）
- 用户是谁？什么时候会用？为什么需要？

## 2. 需求范围（Scope）
### 2.1 Must-have（≤3）
1)
2)
3)

### 2.2 Nice-to-have（≤3）
1)
2)
3)

### 2.3 Won’t-do（≥2）
1)
2)

## 3. 用户故事（3–5条）
- 作为{用户}，我想要{能力}，以便{收益}。

## 4. 验收标准（3–5条，Given/When/Then）
- Given … When … Then …
- Given … When … Then …

## 5. 设计概览（按轨道填写）
### A) Web（Next.js）
- 页面（≤{pages_max}）：{pages}
- 组件/模块（≤{components_max}）：{components}
- 数据流（mock→可选API）：{data_flow_one_liner}
- 状态清单（最小）：{state_list}

## 5.1 关键流程说明（必填）
- 业务流程：用户操作 → 路由处理 → 数据读写/接口调用 → 页面更新
- 系统流程：输入 → 处理 → 输出（按你的技术轨道写清楚）

## 5.2 数据模型（ER 图/数据字典，必填）
- ER 图（可用 Mermaid 或文本图）：
```text
实体A (1) ─── (N) 实体B
实体B (1) ─── (N) 实体C
```
- 核心实体字段（至少1个实体，≥5个字段）：
  - 实体名：
  - 字段1（类型/说明）：
  - 字段2（类型/说明）：

### B) Kaggle/建模
- 数据集：{dataset_source}
- 预测目标：{target}
- Baseline：{baseline_model}
- 指标：{metric}
- 验证策略：{validation_strategy}
- 计划改进（≤3）：
  1)
  2)

### C) 硬件（Pico + MicroPython）
- 外设清单（≤{hw_peripherals_max}）：{hardware_list}
- 引脚表（Pin Plan）：{pin_plan}
- 状态机概览：{state_machine_one_liner}
- 安全注意事项：{safety_notes}

### D) 课程融合
- 学习目标（≤3）：{learning_objectives}
- 课堂流程：导入→讲解→练习→总结
- 活动（≤2）：{activities}
- 作业（1个）：{assignment}
- Rubric 维度：{rubric_dims}

## 6. 风险与替代方案（≥2）
- 风险1：… → 替代：…
- 风险2：… → 替代：…

## 7. 决策记录（Decision Log）
- {date}：选择了{decision}，原因：{reason}

## 8. UI 截图证据（必填，至少3张）
- 首页截图：`docs/research/assets/screenshots/{YYYY-MM-DD}_homepage_ui.png`
- 关键功能页截图：`docs/research/assets/screenshots/{YYYY-MM-DD}_feature_ui.png`
- 结果页截图：`docs/research/assets/screenshots/{YYYY-MM-DD}_result_ui.png`
