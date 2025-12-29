- version: v1.0.0
- created_at: 2025-12-07 00:00:00.000
- maintainer: AI Agent
- change_log:
  - 2025-12-07 00:00:00.000 初始创建：Track A 双摆模拟详细设计。

# Track A Architecture: Physics Counter-intuition (Double Pendulum)

## 1. 核心目标
构建一个基于 Web 的高精度双摆模拟器，具备实时参数调节和高帧率渲染能力，用于生成展示“混沌理论”的短视频素材。

## 2. 物理模型设计

### 2.1 双摆系统 (Double Pendulum)
双摆由两个端点相连的摆组成。即使初始条件只有微小差异，最终轨迹也会截然不同（蝴蝶效应）。

*   **实体定义**:
    *   **Pivot (支点)**: 固定在空间中的点 (Static Body)。
    *   **Arm 1 (摆臂1)**: 连接支点与中间点 (Dynamic Body)。
    *   **Arm 2 (摆臂2)**: 连接中间点与末端点 (Dynamic Body)。
    *   **Bob 1 & 2 (摆球)**: 具有质量的质点。

*   **约束 (Constraints)**:
    *   Constraint 1: Pivot <-> Bob 1 (Length L1)
    *   Constraint 2: Bob 1 <-> Bob 2 (Length L2)

### 2.2 引擎选型: Matter.js
虽然双摆可以通过拉格朗日方程纯数学计算，但使用物理引擎 (`Matter.js`) 能更容易扩展碰撞、摩擦力等复杂物理特性，且便于后续增加更多互动元素（如障碍物）。

## 3. 技术实现细节

### 3.1 前端组件架构 (React)

```typescript
// Component Structure
<PhysicsCanvas>
  <SimulationEngine />  // 负责 Matter.js 实例管理
  <Renderer />          // 负责 Canvas 绘制 (p5.js 或 原生 Canvas API)
  <ControlPanel />      // 参数调节 UI
  <TrailSystem />       // 轨迹绘制层
</PhysicsCanvas>
```

### 3.2 关键类与状态

*   **SimulationState**:
    *   `gravity`: number (0 ~ 1)
    *   `frictionAir`: number (0 ~ 0.1)
    *   `length1`: number
    *   `length2`: number
    *   `mass1`: number
    *   `mass2`: number
    *   `initialAngle1`: number
    *   `initialAngle2`: number

*   **TrailSystem (视觉增强)**:
    *   为了展示混沌轨迹，需要记录末端摆球 (Bob 2) 的历史位置。
    *   使用 `RingBuffer` (环形缓冲区) 存储最近 N 帧坐标 `[{x, y, alpha}, ...]`.
    *   渲染时使用 HSL 颜色渐变（时间维度颜色映射）增强视觉效果。

### 3.3 交互设计
*   **Start/Reset**: 重置模拟到初始角度。
*   **Chaos Mode**: 同时生成 5 个初始角度极其接近（例如相差 0.001 度）的双摆，用不同颜色渲染，直观展示随时间推移的轨迹发散。

## 4. 视频生产工作流
1.  **场景配置**: 在 Control Panel 调整出满意的参数。
2.  **模式选择**: 开启 "Neon Trail" (霓虹拖尾) 模式。
3.  **录制**:
    *   **Option A (简单)**: 使用 OBS 录制屏幕区域。
    *   **Option B (高质量)**: 使用 `canvas.captureStream()` 导出 WebM 格式视频。
4.  **后期**: 配上解说词 "你以为的一样，其实大相径庭"。

## 5. API 需求 (FastAPI)
*   MVP 阶段主要为纯前端计算。
*   **Optional**: `POST /api/v1/simulation/save` - 保存当前精彩的参数配置到后端（JSON文件），方便复用。

## 6. 开发任务清单
- [ ] 初始化 React 项目并安装 `matter-js`。
- [ ] 实现基础 `Matter.Engine` 和 `Matter.Render`。
- [ ] 构建双摆物理实体 (Bodies & Constraints)。
- [ ] 实现轨迹绘制逻辑 (Canvas overlay)。
- [ ] 开发控制面板 UI (TailwindCSS)。
- [ ] 调试 "Chaos Mode" (多摆并发)。
