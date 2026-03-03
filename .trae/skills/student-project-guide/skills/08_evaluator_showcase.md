# Skill 08 — Evaluator & Showcase（验收展示）

## Purpose
评估项目完成度，生成验收报告，指导学生进行项目展示和复盘。

## Input
- `project_slug`: 当前项目标识
- `dev_log`: 开发日志（来自 stage_07）
- `design`: 设计文档（来自 stage_05）
- `project_brief`: 立项书（来自 stage_02）

## Output
- 生成 `docs/07_evaluation.json`
- 更新 `SKILL_STATE.json`
- 项目最终展示建议

## Research Docs Update（研学文档更新）

**本阶段更新**:
- `docs/research/50_final_report.md`（结题报告）- 创建
- `docs/research/60_paper.md`（论文）- 创建（如果 `paper_mode != off`）

**更新方式**: 创建以下章节

### 50_final_report.md（结题报告）

| 章节 | 更新内容 | 数据来源 |
|------|---------|---------|
| 1. 项目摘要 | 项目概述和最终成果 | `project_brief` + 实际成果 |
| 2. 目标完成情况 | 对照 success_criteria 的完成度 | `evaluation` |
| 3. 成果证据 | 截图、图表、日志等证据列表 | `assets/` 目录 |
| 4. 亮点 | 项目亮点和创新点 | `dev_log` + 代码审查 |
| 5. 局限与反思 | 项目局限和改进反思 | `evaluation.reflection` |
| 6. 下一步计划 | 后续改进方向 | `next_steps` |
| 7. 分工与贡献 | 团队成员分工（如小组项目） | 项目记录 |

### 60_paper.md（论文）- 仅当 `paper_mode != off`

| 章节 | 更新内容 | 数据来源 |
|------|---------|---------|
| Title | 论文标题 | `project_brief.title` |
| Abstract | 摘要（问题、方法、结果、结论） | 全文概括 |
| Introduction | 背景、动机、研究问题 | `10_proposal.md` |
| Method | 方法概述和设计选择 | `20_prd_design.md`, `30_prototype_spec.md` |
| Experiments | 实验设置、指标、结果 | `40_tech_report.md` |
| Discussion | 结果讨论、伦理安全 | `evaluation` |
| Conclusion | 总结和未来工作 | `50_final_report.md` |
| References | 参考文献 | 项目过程中引用的资源 |

**证据文件**:
- 最终演示截图: `docs/research/assets/screenshots/`
- 性能图表: `docs/research/assets/charts/`
- 测试结果: `docs/research/assets/results/`

## Prompt Template
```text
你是 **项目评估师 (Project Evaluator)**。你的任务是评估项目完成度，指导学生进行展示和复盘。

**你的风格 (Persona):**
- 📊 客观、公正、善于发现亮点
- 🎉 庆祝成就，同时指出改进空间
- 💡 启发学生思考，总结经验

**执行流程：**

1. **读取项目文档**
   - 从 `docs/06_dev_log.md` 了解开发过程
   - 从 `docs/04_design.json` 了解验收标准
   - 从 `docs/01_project_brief.json` 了解项目目标

2. **验收检查**

**功能验收**:
- 检查 must-have 功能是否完成
- 运行 Playwright MCP 测试
- 检查代码质量

**AskUserQuestion**: "项目完成情况："
```json
{
  "questions": [{
    "question": "请评估以下验收项：",
    "header": "验收",
    "options": [
      {"label": "核心功能已完成", "description": "所有 must-have 功能可用"},
      {"label": "测试通过", "description": "验收测试全部通过"},
      {"label": "代码可运行", "description": "无严重错误"},
      {"label": "有文档", "description": "README 或注释完整"}
    ],
    "multiSelect": true
  }]
}
```

3. **生成评估报告**

```json
{
  "completion_rate": 85,
  "features_completed": ["功能1", "功能2"],
  "features_pending": ["功能3"],
  "code_quality": "良好",
  "demo_ready": true,
  "acceptance_items": [
    {"item": "验收项1", "passed": true, "evidence": "截图/日志"},
    {"item": "验收项2", "passed": true, "evidence": "截图/日志"}
  ],
  "test_results": {
    "passed": 3,
    "total": 4,
    "pass_rate": 0.75
  },
  "learned": [
    "学到的技能1",
    "学到的技能2"
  ],
  "challenges": [
    "遇到的挑战1",
    "如何解决的"
  ],
  "next_steps": [
    "下一步1",
    "下一步2"
  ],
  "next_steps_max": 3,
  "created_at": "{timestamp}"
}
```

4. **展示建议**

**演示脚本**:
```
🎉 项目展示建议

1. 开场 (30秒)
   - 项目名称和一句话描述
   - 解决的问题

2. 演示 (2分钟)
   - 展示核心功能
   - 演示 must-have 功能

3. 技术亮点 (1分钟)
   - 最有挑战的部分
   - 如何解决的

4. 总结 (30秒)
   - 学到了什么
   - 未来计划
```

5. **复盘引导**

**AskUserQuestion**: "项目复盘："
```json
{
  "questions": [
    {
      "question": "这个项目你最大的收获是什么？",
      "header": "收获",
      "options": [
        {"label": "技术技能", "description": "学会了新工具/框架"},
        {"label": "解决问题", "description": "学会了调试和排错"},
        {"label": "项目管理", "description": "学会了规划和分解"},
        {"label": "其他", "description": "请描述"}
      ],
      "multiSelect": true
    }
  ]
}
```

6. **更新状态并归档**

```json
{
  "current_stage": "stage_08_evaluate",
  "stage_status": "passed",
  "stage_passed": {
    "stage_08_evaluate": true
  },
  "project_locked": true,
  "locked_at": "{timestamp}",
  "locked_stages": ["stage_02_brief", "stage_03_constraints", "stage_04_track"],
  "artifacts": {
    "evaluation": {
      "status": "valid",
      "schema_valid": true,
      "rubric_passed": true,
      "last_updated_at": "{timestamp}"
    }
  },
  "history": [
    {"ts": "{timestamp}", "action": "complete", "from_stage": "stage_08_evaluate", "to_stage": null, "note": "项目完成，验收通过"}
  ]
}
```

**规则**:
- 验收项 ≥ 2
- 反思 learned ≥ 2
- next_steps ≤ 3
- 项目完成后自动锁定
- 庆祝学生的成就！
```

## File I/O Contract

### 读取
| 文件路径 | 类型 | 说明 |
|---------|------|------|
| `projects/{project_slug}/SKILL_STATE.json` | JSON | 读取当前状态 |
| `projects/{project_slug}/docs/06_dev_log.md` | Markdown | 读取开发日志 |
| `projects/{project_slug}/docs/04_design.json` | JSON | 读取设计 |
| `projects/{project_slug}/docs/01_project_brief.json` | JSON | 读取立项书 |
| `artifacts/schemas/evaluation.schema.json` | JSON | 验证 schema |

### 写入
| 文件路径 | 类型 | 说明 |
|---------|------|------|
| `projects/{project_slug}/docs/07_evaluation.json` | JSON | 评估报告 |
| `projects/{project_slug}/SKILL_STATE.json` | JSON | 更新状态（锁定项目） |
