# UP主视频内容分析器

## 项目状态

| 属性 | 值 |
|------|-----|
| 当前阶段 | stage_08_evaluate (验收展示) |
| 阶段状态 | passed (已通过) |
| 年龄组 | 高中 |
| 时间预算 | 6h |
| 项目锁定 | 是 |

### 阶段进度

| 阶段 | 状态 |
|------|------|
| stage_00_bootstrap 初始化 | 已通过 |
| stage_01_brainstorm 脑爆 | 已通过 |
| stage_02_brief 开题卡 | 已通过 |
| stage_03_constraints 范围裁剪 | 已通过 |
| stage_04_track 轨道选择 | 已通过 |
| stage_05_design 设计蓝图 | 已通过 |
| stage_06_step_plan 分步计划 | 已通过 |
| stage_07_execute 执行开发 | 已通过 |
| stage_08_evaluate 验收展示 | 已通过 |

### 测试结果

| 指标 | 值 |
|------|-----|
| 最后测试时间 | 2026-03-01 21:45:00 |
| 通过用例 | 6/6 |
| 通过率 | 100% |
| 测试方法 | playwright_python |

---

## 项目简介

上传视频字幕，AI 自动生成词云、统计分析和内容总结。

## 核心功能

- 词云可视化 - 直观展示高频词汇
- 数据统计面板 - 量化分析内容特征
- AI 智能总结 - 自动提炼核心观点
- 导出报告 - 保存和分享分析结果

## 技术栈

- 语言: Python 3.8+
- 框架: Streamlit
- 核心库: jieba, wordcloud, matplotlib, pandas

## 安装

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行项目

```bash
streamlit run src/main.py
```

### 3. 打开浏览器

访问 http://localhost:8501

## 使用指南

1. **上传字幕文件**
   - 支持 SRT 字幕格式
   - 支持 TXT 纯文本格式

2. **点击分析**
   - 自动解析文本
   - 中文分词
   - 词频统计

3. **查看结果**
   - 词云可视化
   - 数据统计
   - AI 总结

4. **导出报告**
   - PNG 词云图
   - CSV 词频数据

## 项目结构

```
up-video-analyzer/
├── docs/                    # 项目文档 (详见 docs/README.md)
│   ├── research/            # 研学文档
│   └── 原型/                # 原型截图
├── libs/                    # 依赖库
├── SKILL_STATE.json         # 项目状态
├── FULL_GUIDE.md            # 完整使用指南
├── README_BILIBILI.md       # B站视频分析指南
└── README.md                # 本文件
```

## 学习目标

- 掌握 Streamlit 快速开发数据应用
- 理解中文分词和词频统计
- 学会数据可视化 (词云)
- 实践完整的数据分析流程

## 扩展方向

- 接入真实 AI API 进行智能总结
- 支持多视频对比分析
- 添加情感分析功能
- 实现时间轴关键词分布
- 支持批量上传和分析

## 注意事项

- 首次运行需要安装中文字体 (simhei.ttf)
- 大文件分析可能需要较长时间
- 建议字幕文件大小不超过 1MB

---

## 文档入口

详细文档请查看 [docs/README.md](./docs/README.md)

---

*创建时间: 2026-02-28*
*最后更新: 2026-03-03*
