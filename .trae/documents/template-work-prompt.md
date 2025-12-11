# 模板工作说明文档 Prompt（v1.0.0）

- version: v1.0.0
- created_at: 2025-12-07 00:00:00.000
- maintainer: AI Agent
- change_log:
  - 2025-12-07 00:00:00.000 初始创建：统一模板生成的触发说明、输入结构、生成规则、输出清单与示例。

---

## 使用场景与触发时机
- 当项目需要创建或更新规范模板（PR 模板、Gate 检查清单、API 契约检查、发布审核、复盘报告、创意与拍摄模板）但无人及时启动时，将本文件拖入工作区并按“输入规范”填写需求。
- 目标：自动、一次性生成所需模板至 `.trae/templates/`，与规范文档一致并满足红线与门禁要求。

## 任务输入规范（填写以下 JSON 区块）
```json
{
  "templates": [
    {
      "type": "governance|engineering|media|release|retro",
      "name": "GATE0_INTAKE_CHECKLIST | API_CONTRACT_CHECKLIST | BRIEF_TEMPLATE | PUBLISH_AUDIT_CHECKLIST | POSTMORTEM_TEMPLATE",
      "scope": "project-wide | subproject | campaign",
      "output_lang": "zh | en",
      "brand_tone": "professional | friendly | educational",
      "constraints": {
        "env_compliance": true,
        "a11y_required": true,
        "openapi_contract": true,
        "coverage_gate": 80
      },
      "include_sections": ["meta", "checklist", "examples"],
      "version": "v1.0.0"
    }
  ]
}
```

### 字段说明
- `type/name`：模板类别与具体名称（见“输出清单映射”）。
- `scope`：适用范围（项目级/子项目/活动）。
- `output_lang`：输出语言（默认 `zh`）。
- `brand_tone`：文风（专业/友好/教育）。
- `constraints`：强制约束（环境合规、可访问性、OpenAPI 契约、覆盖率门槛等）。
- `include_sections`：是否包含元信息、检查清单与示例段落。
- `version`：模板版本号。

## 生成规则（Agent 必须遵循）
- 命名与路径：仅在 `.trae/templates/` 下生成；文件名使用英文与 ASCII；目录使用英文与 ASCII。
- 元信息：每个模板文件头部必须包含 `version/created_at/maintainer/change_log`（MCP 时间戳 `YYYY-MM-DD HH:MM:SS.fff` UTC）。
- 红线合规：
  - 环境：第三方工具与依赖安装到 `D:`/`H:`；工作区 PATH 禁止新增第三方 `C:\`（系统白名单除外如 `C:\Windows`、`C:\Windows\System32`、`C:\Python312`）。
  - 契约：先设计并评审 OpenAPI，再实现；运行时按 Schema 校验请求与响应；模板需提供校验项。
  - 测试：业务 ≥80%，关键路径与 API 100%；模板需包含覆盖率门槛与阻断策略。
  - A11y：图片 `alt`、表单 `label`、语义化、对比度达标；媒体模板需含相应检查清单。
- 一致性：API/JSON `camelCase` ↔ DB `snake_case` 映射登记在模板对应章节；禁止不一致。
- 输出格式：Markdown，结构清晰的层级标题与检查清单（复选框），示例片段与使用说明。
- 行为约束：仅生成模板文件；不修改业务代码、不安装工具、不改动环境配置。

## 输出清单映射（type/name → 路径）
- governance：
  - `GATE0_INTAKE_CHECKLIST` → `.trae/templates/governance/gate0-intake-checklist.md`
  - `GATE1_FEASIBILITY_REPORT` → `.trae/templates/governance/gate1-feasibility-report.md`
  - `GATE2_SOLUTION_PACK` → `.trae/templates/governance/gate2-solution-pack.md`
  - `RELEASE_NOTES` → `.trae/templates/governance/release-notes.md`
  - `POSTMORTEM_TEMPLATE` → `.trae/templates/governance/postmortem-template.md`
- engineering：
  - `PR_TEMPLATE` → `.trae/templates/engineering/pr-template.md`
  - `CONVENTIONAL_COMMITS` → `.trae/templates/engineering/conventional-commits.md`
  - `API_CONTRACT_CHECKLIST` → `.trae/templates/engineering/api-contract-checklist.md`
  - `QA_CHECKLIST` → `.trae/templates/engineering/qa-checklist.md`
  - `ENV_COMPLIANCE_CHECKLIST` → `.trae/templates/engineering/env-compliance-checklist.md`
- media：
  - `BRIEF_TEMPLATE` → `.trae/templates/media/brief-template.md`
  - `TREATMENT_TEMPLATE` → `.trae/templates/media/treatment-template.md`
  - `STORYBOARD_TEMPLATE` → `.trae/templates/media/storyboard-template.md`
  - `SHOOT_PLAN_TEMPLATE` → `.trae/templates/media/shoot-plan-template.md`
  - `VISUAL_GUIDE_CARD` → `.trae/templates/media/visual-guide-card.md`
  - `AI_PROMPT_GUIDE` → `.trae/templates/media/ai-prompt-guide.md`
  - `PUBLISH_AUDIT_CHECKLIST` → `.trae/templates/media/publish-audit-checklist.md`

## 模板骨架（生成时统一包含）
```
# <模板标题>（<version>）
- version: <version>
- created_at: <MCP 时间>
- maintainer: AI Agent
- change_log:
  - <MCP 时间> 初始创建/更新说明

## 使用说明
- 适用范围：
- 触发时机：
- 责任与放行：

## 检查清单（红线门禁）
- [ ] 环境合规：工具/依赖安装到 D/H；PATH 无第三方 C:\
- [ ] OpenAPI 契约：设计评审通过；请求/响应校验通过
- [ ] 测试覆盖率：业务 ≥80%，关键路径与 API 100%
- [ ] A11y：字幕/alt/语义化/对比度达标
- [ ] 版权与隐私：素材授权、未成年人保护、数据脱敏

## 示例与指引
- 示例片段与执行要点...
```

## 失败与例外处理
- 缺少模板或检查清单：视为“门禁不通过”，暂停合并/发布，立即补齐。
- 例外申请：需提交原因、影响、替代措施与回滚策略，限定时效并设整改截止日期。
- 复盘记账：在 `Postmortem` 中记录漏启原因与防漏改进项，纳入季度评审。

## 示例输入（可直接替换使用）
```json
{
  "templates": [
    {
      "type": "engineering",
      "name": "API_CONTRACT_CHECKLIST",
      "scope": "project-wide",
      "output_lang": "zh",
      "brand_tone": "professional",
      "constraints": {
        "env_compliance": true,
        "a11y_required": true,
        "openapi_contract": true,
        "coverage_gate": 100
      },
      "include_sections": ["meta", "checklist", "examples"],
      "version": "v1.0.0"
    },
    {
      "type": "media",
      "name": "PUBLISH_AUDIT_CHECKLIST",
      "scope": "campaign",
      "output_lang": "zh",
      "brand_tone": "educational",
      "constraints": {
        "env_compliance": true,
        "a11y_required": true,
        "openapi_contract": false,
        "coverage_gate": 0
      },
      "include_sections": ["meta", "checklist", "examples"],
      "version": "v1.0.0"
    }
  ]
}
```

## 示例输出结构（说明）
- 生成以下文件（示例）：
  - `.trae/templates/engineering/api-contract-checklist.md`
  - `.trae/templates/media/publish-audit-checklist.md`
- 每个文件包含：元信息、红线检查清单、执行要点与示例片段；与项目规范一致。

---

> 使用提示：未来需要模板时，直接拖入本文件，将“示例输入”替换为你的实际需求。我会按“生成规则”生成对应模板文件到 `.trae/templates/`，并遵循红线与门禁要求。只生成模板，不改动业务代码与环境配置。
