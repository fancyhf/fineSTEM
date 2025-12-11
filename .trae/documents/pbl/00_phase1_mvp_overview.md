- version: v1.0.0
- created_at: 2025-12-07 00:00:00.000
- maintainer: AI Agent
- change_log:
  - 2025-12-07 00:00:00.000 初始创建：定义第一阶段 MVP 目标、技术架构选型与执行路线图。

# Phase 1: MVP 爆破期架构规划 (Month 1)

> **目标**: 跑通 “一个视频 + 一个Demo” 的最小闭环，验证流量。  
> **核心策略**: 利用“物理反直觉”（Track A）和“数据可视化”（Track E）作为两大流量抓手。

---

## 1. 核心架构概览

为了兼顾 Track A (物理交互) 和 Track E (数据处理) 的需求，同时满足未来扩展到 AI 和复杂系统的可能性，采用 **"Python 后端 + React 前端 + 显性化引擎"** 的组合。

### 1.1 技术栈选型 (Tech Stack)

| 层次 | 技术选型 | 理由 |
| :--- | :--- | :--- |
| **前端框架** | **React + TypeScript + Vite** | 生态最丰富，开发速度快，类型安全，适合快速迭代 UI。 |
| **UI 库** | **TailwindCSS** | Utility-first CSS，极速构建现代化、响应式界面。 |
| **物理引擎 (Track A)** | **Matter.js** (2D) | 2D 物理模拟成熟，API 友好，适合 MVP 快速验证“混沌”效果。后续可视需求升级至 Three.js/Cannon.js。 |
| **可视化引擎 (Track E)** | **ECharts** | 图表丰富，美观度高，自带动画效果，适合“大屏感”视频制作。 |
| **后端/API** | **FastAPI (Python)** | 高性能异步框架，天然契合 AI/LLM 生态，未来对接数据处理和爬虫最方便。 |
| **数据处理** | **Pandas, NumPy** | Python 数据科学标准库，处理 CSV/JSON 效率极高。 |
| **爬虫 (Track E)** | **Requests + BeautifulSoup** | MVP 阶段轻量级抓取方案，验证数据源可行性。 |
| **数据库** | **SQLite** (文件级) | MVP 阶段无需部署重型 DB，单文件数据库易于迁移和备份，符合轻量化原则。 |
| **基础设施** | **Monorepo (pnpm)** | 统一管理前后端代码，共享类型定义。 |

### 1.2 系统架构图

```mermaid
graph TD
    subgraph "Frontend (React)"
        UI[UI Controller] -->|Config| PE[Physics Engine (Matter.js)]
        UI -->|Config| VE[Viz Engine (ECharts)]
        PE -->|Render Loop| Canvas
        VE -->|Render| Canvas
        Recorder[Video Recorder] -->|Capture| Canvas
    end

    subgraph "Backend (FastAPI)"
        API[API Gateway]
        ETL[ETL Processor] -->|Clean Data| DB[(SQLite)]
        Crawler[Simple Crawler] -->|Raw Data| ETL
        API -->|Serve Data| UI
    end
```

---

## 2. 业务架构方案 (Track Specifics)

### 2.1 Track A: 物理反直觉 (Physics Counter-intuition)
*   **核心概念**: "Chaos & Control" (混沌与控制)
*   **MVP 选题**: **双摆 (Double Pendulum)**
    *   **核心价值**: 视觉上极度舒适，结果不可预测（反直觉），完美契合短视频完播率逻辑。
*   **关键功能**:
    *   参数调节：重力、摩擦力、初始角度。
    *   实时模拟：Matter.js 渲染。
    *   高光录制：捕捉混沌瞬间。

### 2.2 Track E: 数据可视化 (Data Visualization)
*   **核心概念**: "Making the Invisible Visible" (看见不可见)
*   **MVP 选题**: **互联网实时心跳** (Github Commits / Twitter Stream 模拟)
*   **关键功能**:
    *   数据摄取：Python 脚本清洗 Kaggle/API 数据。
    *   动态渲染：时间轴驱动的 ECharts 动画。
    *   叙事增强：关键数据点的自动标注与放大。

---

## 3. 四周执行路线图 (Execution Roadmap)

### Week 1: 基础建设与原型设计 (Research & Setup)
*   [ ] **架构搭建**: 初始化 Monorepo (前端/后端)，配置 ESLint/Prettier/Husky。
*   [ ] **环境合规**: 确保 Python/Node 环境安装在 `D:/` 或 `H:/` 盘，更新 PATH。
*   [ ] **设计冻结**:
    *   Track A: 确定双摆物理公式与参数范围。
    *   Track E: 确定数据源 (Kaggle Dataset) 与 JSON 结构。

### Week 2: 核心引擎开发 (Core Implementation)
*   [ ] **Track A**: 实现 Matter.js 核心 Loop，跑通双摆物理模拟。
*   [ ] **Track E**: 编写 Python ETL 脚本，清洗数据，跑通 ECharts 基础渲染。
*   [ ] **API**: 定义并实现基础数据接口 (FastAPI)。

### Week 3: 交互与视觉优化 (Visual Polish)
*   [ ] **UI 开发**: 增加控制面板 (参数调节)，优化配色与布局 (TailwindCSS)。
*   [ ] **视觉增强**:
    *   Track A: 增加轨迹拖尾 (Trail)、霓虹发光效果。
    *   Track E: 调整动画曲线，增加背景氛围感。
*   [ ] **联调**: 前后端接口对接。

### Week 4: 内容生产与发布 (Content & Launch)
*   [ ] **部署**: 前端 Vercel (可选)，后端本地运行。
*   [ ] **视频制作**: 使用录屏工具生成 4K 素材，剪辑配音。
*   [ ] **复盘**: 收集反馈，规划 Phase 2。

---

## 4. 风险与应对

| 风险点 | 应对策略 |
| :--- | :--- |
| **性能瓶颈** | 物理模拟若掉帧，使用 WebWorker 将计算移出主线程；可视化限制数据点数量。 |
| **视觉平庸** | 引入 Shader (如有必要) 或后期特效；参考顶级数据可视化博主配色。 |
| **工期延误** | **Strict Timeboxing**。3D 搞不定立刻降级 2D；实时抓取搞不定立刻用静态 CSV。 |
