# FineSTEM 系统级公共功能架构计划

根据您的反馈，我将把“互动课件”和“AI 问答”设计为**系统级公共组件**，使其可被任意 Track 复用，而非硬编码在具体业务中。

## 1. 核心架构设计 (System Architecture)

### 1.1 定义公共数据标准 (`types/system.ts`)
建立统一的数据结构，供所有 Track 遵循：
- **`CodeTourStep` (课件步骤)**: 定义每一步的标题、讲解内容、关联的代码行号范围、高亮关键词。
- **`PresetQuestion` (预设问题)**: 定义快捷提问的标签和实际 Prompt。

### 1.2 升级公共组件库 (`components/Shared/`)
- **`InteractiveCodeTour` (通用课件播放器)**: 
    - 接收 `steps` 和 `code` 作为参数。
    - 负责渲染“分步导航”、“代码高亮”和“讲解卡片”的通用逻辑。
    - **复用性**: 未来 Track B/C/D 只需传入 JSON 配置即可生成课件。
- **`AIChatPanel` (通用 AI 助手)**:
    - 接收 `presetQuestions` (数组) 作为参数。
    - 负责与后端 LLM 通信的通用逻辑。
    - 增加“快捷提问栏”的通用 UI 布局。

## 2. 后端通用服务升级 (`backend/routers/chat.py`)
- **LLM 适配层**: 保持接口通用性，通过环境变量配置 DeepSeek/Qwen，不与具体业务耦合。
- **Prompt 模板化**: 后端仅负责透传上下文，具体的 System Prompt 由前端根据当前 Track 的类型动态组装。

## 3. 实施步骤
1.  **定义标准**: 创建 `types/system.ts`。
2.  **开发组件**: 
    - 开发 `components/Shared/InteractiveCodeTour/`。
    - 重构 `components/Shared/AIChatPanel.tsx` 支持 props 注入预设问题。
3.  **配置实例**: 
    - 在 Track A 中配置“双摆物理”的课件步骤与题库。
    - 在 Track E 中配置“数据可视化”的课件步骤与题库。

这种设计确保了系统的高扩展性，新增赛道时无需重复开发代码，只需配置“课件脚本”即可。
