# 技术轨道库 (Track Library)

> 为不同项目类型推荐最适合的技术栈和学习路径

---

## 轨道概览

| 轨道 | 适合项目 | 核心技能 | 难度 |
|------|----------|----------|------|
| Web应用 | 网站、工具、展示 | HTML/CSS/JS | ⭐⭐ |
| 游戏开发 | 互动游戏、模拟 | Canvas/游戏逻辑 | ⭐⭐⭐ |
| AI/ML | 智能应用、数据分析 | Python/AI API | ⭐⭐⭐ |
| 数据可视化 | 图表、仪表板、报告 | 可视化库/D3 | ⭐⭐ |
| 创意编程 | 艺术、音乐、生成 | p5.js/Processing | ⭐⭐ |

---

## 1. Web应用轨道 (Web App Track)

### 适用场景
- 信息展示类网站
- 实用工具和小应用
- 个人作品集
- 交互式表单和问卷

### 技术栈

#### 基础版 (10-12岁)
```
前端: HTML5 + CSS3 + 原生JavaScript
存储: LocalStorage / SessionStorage
部署: GitHub Pages / Netlify (免费)
```

#### 进阶版 (13-15岁)
```
前端: HTML5 + CSS3 + JavaScript (ES6+)
框架: 可选 Vue.js 或 React (简单用法)
样式: Tailwind CSS 或 Bootstrap
存储: IndexedDB / 简单后端 (JSON Server)
部署: Vercel / Netlify
```

#### 高级版 (16-18岁)
```
前端: React / Vue.js + TypeScript
后端: Node.js + Express 或 Python + Flask
数据库: MongoDB / PostgreSQL
部署: 完整CI/CD流程
```

### 推荐工具
- **编辑器**: VS Code + Live Server插件
- **调试**: Chrome DevTools
- **版本控制**: Git + GitHub
- **AI辅助**: GitHub Copilot, Trae IDE

### 学习资源
- [MDN Web Docs](https://developer.mozilla.org)
- [freeCodeCamp](https://www.freecodecamp.org)
- [JavaScript.info](https://javascript.info)

---

## 2. 游戏开发轨道 (Game Dev Track)

### 适用场景
- 2D小游戏
- 互动故事
- 物理模拟
- 教育游戏

### 技术栈

#### 基础版 (10-12岁)
```
引擎: 原生Canvas API
物理: 简单自定义物理
音效: Web Audio API
```

#### 进阶版 (13-15岁)
```
引擎: Phaser.js 或 PixiJS
物理: Matter.js 或 Planck.js
音效: Howler.js
```

#### 高级版 (16-18岁)
```
引擎: Phaser 3 或 自建引擎
物理: 完整物理引擎集成
多人: WebSocket 实时同步
```

### 推荐工具
- **游戏编辑器**: Tiled (地图编辑器)
- **素材制作**: Piskel (像素画), BeepBox (音乐)
- **调试**: Chrome DevTools + 游戏状态检查器

### 学习资源
- [Phaser官方教程](https://phaser.io/tutorials)
- [游戏编程模式](https://gameprogrammingpatterns.com)

---

## 3. AI/ML 轨道 (AI/ML Track)

### 适用场景
- 智能聊天机器人
- 图像识别应用
- 数据分析工具
- 预测模型

### 技术栈

#### 基础版 (10-12岁)
```
语言: Python (基础)
库: 调用AI API (OpenAI, 文心等)
数据处理: 简单JSON操作
```

#### 进阶版 (13-15岁)
```
语言: Python
库: pandas (数据处理), matplotlib (可视化)
AI: scikit-learn (简单ML) 或 AI API
环境: Jupyter Notebook / Google Colab
```

#### 高级版 (16-18岁)
```
语言: Python
框架: PyTorch 或 TensorFlow (基础)
数据处理: pandas, numpy
部署: Flask/FastAPI + 云部署
```

### 推荐工具
- **开发环境**: Jupyter Notebook, Google Colab
- **数据标注**: Label Studio (可选)
- **模型管理**: Weights & Biases (可选)

### 学习资源
- [Fast.ai课程](https://www.fast.ai)
- [Kaggle Learn](https://www.kaggle.com/learn)
- [Scikit-learn文档](https://scikit-learn.org)

---

## 4. 数据可视化轨道 (Data Viz Track)

### 适用场景
- 数据仪表板
- 信息图表
- 交互式报告
- 实时数据展示

### 技术栈

#### 基础版 (10-12岁)
```
图表库: Chart.js
地图: Leaflet (简单用法)
样式: CSS
```

#### 进阶版 (13-15岁)
```
图表库: D3.js (基础) 或 ECharts
地图: Leaflet / Mapbox
数据处理: JavaScript 或 Python
```

#### 高级版 (16-18岁)
```
图表: D3.js (高级) + 自定义组件
地图: Mapbox GL JS / Deck.gl
数据: Python数据处理 + 前端展示
实时: WebSocket数据更新
```

### 推荐工具
- **数据清理**: OpenRefine
- **配色工具**: Coolors, ColorBrewer
- **原型设计**: Figma

### 学习资源
- [D3.js官方文档](https://d3js.org)
- [数据可视化目录](https://datavizcatalogue.com)

---

## 5. 创意编程轨道 (Creative Coding Track)

### 适用场景
- 生成艺术
- 音乐可视化
- 交互装置
- 数字艺术

### 技术栈

#### 基础版 (10-12岁)
```
框架: p5.js (Processing的JavaScript版)
图形: Canvas 2D
交互: 鼠标/键盘事件
```

#### 进阶版 (13-15岁)
```
框架: p5.js 或 Three.js (3D)
图形: WebGL基础
音频: p5.sound 或 Tone.js
```

#### 高级版 (16-18岁)
```
框架: Three.js / React Three Fiber
着色器: GLSL 自定义效果
音频: Web Audio API 深度使用
物理: 粒子系统、流体模拟
```

### 推荐工具
- **代码编辑器**: VS Code + p5.js插件
- **音效**: Bfxr (音效生成), Audacity (音频编辑)
- **灵感**: OpenProcessing, CodePen

### 学习资源
- [p5.js官方教程](https://p5js.org/learn)
- [The Coding Train (YouTube)](https://www.youtube.com/c/TheCodingTrain)
- [Generative Design](http://www.generative-design.com)

---

## 轨道选择指南

### 选择流程

```
1. 明确项目目标
   ↓
2. 评估技术需求
   ↓
3. 考虑学习时间
   ↓
4. 选择合适轨道
   ↓
5. 确定具体技术栈
```

### 选择建议

| 如果你... | 推荐轨道 |
|-----------|----------|
| 想做一个网站或工具 | Web应用 |
| 想做游戏或互动体验 | 游戏开发 |
| 想用AI解决问题 | AI/ML |
| 想展示数据或做报告 | 数据可视化 |
| 想做艺术或音乐项目 | 创意编程 |

### 跨轨道组合

复杂项目可以组合多个轨道:
- **数据新闻**: 数据可视化 + Web应用
- **AI游戏**: 游戏开发 + AI/ML
- **互动艺术**: 创意编程 + Web应用

---

## 技术选型检查清单

选择技术前，确认以下问题:

- [ ] 这个技术能支持我的项目需求吗?
- [ ] 我有足够的时间学习这个技术吗?
- [ ] 能找到足够的学习资源吗?
- [ ] 部署和分享项目方便吗?
- [ ] 如果卡住，能找到人求助吗?

---

*题库版本: v1.0.0 | 最后更新: 2025-10-29*
