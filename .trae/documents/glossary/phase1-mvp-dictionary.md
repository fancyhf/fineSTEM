- version: v1.0.0
- created_at: 2025-12-07 00:00:00.000
- maintainer: AI Agent
- change_log:
  - 2025-12-07 00:00:00.000 初始创建：Track A & E MVP 数据字典。

# Phase 1 MVP 数据字典

> **说明**: 本文档定义了 Phase 1 MVP 阶段（Track A 双摆模拟 & Track E 数据可视化）的核心数据模型与字段定义。所有代码实现（前端 Props、后端 Model、数据库 Schema）必须严格遵循此定义。

## 1. Track A: Physics Chaos (Double Pendulum)

### 1.1 实体: SimulationConfig (模拟配置)
描述双摆系统的物理参数配置。

| 字段名 (Field) | 类型 (Type) | 约束 (Constraints) | 默认值 (Default) | 单位 (Unit) | 描述 (Description) | 来源 (Source) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `configId` | string | UUID, Unique | (Generated) | - | 配置唯一标识符 | System |
| `gravity` | float | 0.0 ~ 2.0 | 1.0 | G (9.8m/s²) | 重力加速度倍率 | User |
| `frictionAir` | float | 0.0 ~ 0.1 | 0.005 | - | 空气阻力系数 | User |
| `length1` | integer | 50 ~ 400 | 150 | px | 第一节摆臂长度 | User |
| `length2` | integer | 50 ~ 400 | 100 | px | 第二节摆臂长度 | User |
| `mass1` | integer | 1 ~ 50 | 20 | kg | 第一节摆球质量 | User |
| `mass2` | integer | 1 ~ 50 | 15 | kg | 第二节摆球质量 | User |
| `initialAngle1`| float | 0 ~ 2π | π/2 | rad | 第一节摆臂初始角度 | User |
| `initialAngle2`| float | 0 ~ 2π | π/2 | rad | 第二节摆臂初始角度 | User |
| `trailLength` | integer | 0 ~ 1000 | 200 | frames | 轨迹保留帧数 | User |
| `colorMode` | enum | 'neon', 'classic' | 'neon' | - | 视觉渲染模式 | User |

### 1.2 实体: PendulumState (摆动状态)
描述某一帧的物理状态，用于渲染或录制。

| 字段名 (Field) | 类型 (Type) | 约束 (Constraints) | 描述 (Description) |
| :--- | :--- | :--- | :--- |
| `timestamp` | integer | > 0 | 模拟时间戳 (ms) |
| `angle1` | float | - | 第一节摆臂当前角度 (rad) |
| `angle2` | float | - | 第二节摆臂当前角度 (rad) |
| `bob1X` | float | - | 第一节摆球 X 坐标 |
| `bob1Y` | float | - | 第一节摆球 Y 坐标 |
| `bob2X` | float | - | 第二节摆球 X 坐标 |
| `bob2Y` | float | - | 第二节摆球 Y 坐标 |

---

## 2. Track E: Data Visualization (Code Never Sleeps)

### 2.1 实体: TimeSeriesPoint (时间序列数据点)
描述单个数据点在特定时间的值。

| 字段名 (Field) | 类型 (Type) | 约束 (Constraints) | 描述 (Description) | 示例 (Example) |
| :--- | :--- | :--- | :--- | :--- |
| `timeLabel` | string | YYYY or YYYY-MM | 时间标签 | "2024" |
| `category` | string | Non-empty | 数据类别 (如编程语言) | "Python" |
| `value` | float | >= 0 | 数值 (如 Commit 数) | 15000 |
| `rank` | integer | >= 1 | 当前时间点的排名 | 1 |
| `meta` | object | Optional | 额外元数据 (图标 URL 等) | `{"icon": "python.png"}` |

### 2.2 实体: VisualizationMeta (可视化元数据)
描述整个可视化项目的配置。

| 字段名 (Field) | 类型 (Type) | 约束 (Constraints) | 默认值 | 描述 (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `title` | string | Max 100 chars | - | 图表标题 |
| `subTitle` | string | Max 200 chars | - | 副标题 |
| `dataSource` | string | - | - | 数据来源说明 |
| `duration` | integer | 10 ~ 300 | 60 | 动画总时长 (秒) |
| `colorPalette` | array | Hex Codes | [...] | 配色方案 |

