- version: v1.0.0
- created_at: 2025-12-07 00:00:00.000
- maintainer: AI Agent
- change_log:
  - 2025-12-07 00:00:00.000 初始创建：Track A & E MVP 接口定义。

# Phase 1 MVP 接口定义 (API Specs)

> **说明**: 虽然 MVP 阶段主要运行在客户端（浏览器），但为了保证数据结构的一致性与可扩展性，我们定义以下 Schema 作为前后端交互（或文件存储）的契约。

## 1. Track A: Physics Chaos

### 1.1 导出配置 (Export Configuration)
*   **用途**: 将当前物理参数保存为 JSON 文件，用于复用或分享。
*   **格式**: JSON
*   **Schema**:

```typescript
interface SimulationConfigExport {
  meta: {
    version: string;      // e.g., "1.0.0"
    exportedAt: string;   // ISO 8601 UTC
    author?: string;
  };
  config: {
    gravity: number;      // 0.0 ~ 2.0
    frictionAir: number;  // 0.0 ~ 0.1
    pendulum: {
      arm1: { length: number; mass: number; initialAngle: number };
      arm2: { length: number; mass: number; initialAngle: number };
    };
    visual: {
      trailLength: number;
      colorMode: 'neon' | 'classic';
    };
  };
}
```

### 1.2 录制数据流 (Recording Stream - Internal)
*   **用途**: 前端 WebWorker 向主线程或后端发送的实时渲染数据（用于高精度录制）。
*   **Schema**: `Array<PendulumState>` (见数据字典 1.2)

---

## 2. Track E: Data Visualization

### 2.1 可视化数据集 (Visualization Dataset)
*   **用途**: 后端 ETL 脚本生成的标准 JSON 数据，供前端 ECharts 读取渲染。
*   **文件路径**: `/assets/data/track-e-dataset.json`
*   **Schema**:

```typescript
interface VisualizationDataset {
  meta: {
    title: string;
    subTitle?: string;
    source: string;
    updateTime: string; // ISO 8601
  };
  // 时间轴数据：按时间顺序排列
  timeline: string[]; // ["2000", "2001", ...]
  
  // 类别列表：所有出现过的类别
  categories: string[]; // ["Python", "Java", "C++"]
  
  // 核心数据：Key 为时间标签，Value 为该时间点的数据列表
  series: {
    [timeLabel: string]: Array<{
      name: string;   // 对应 categories 中的项
      value: number;
      rank?: number;  // 可选，后端预计算排名
    }>;
  };
}
```

### 2.2 示例数据 (Example)

```json
{
  "meta": {
    "title": "Programming Language Popularity",
    "source": "GitHub Archive",
    "updateTime": "2025-12-07T12:00:00Z"
  },
  "timeline": ["2018", "2019"],
  "categories": ["Python", "JavaScript"],
  "series": {
    "2018": [
      { "name": "Python", "value": 100 },
      { "name": "JavaScript", "value": 150 }
    ],
    "2019": [
      { "name": "Python", "value": 200 },
      { "name": "JavaScript", "value": 160 }
    ]
  }
}
```
