# UP 主视频内容分析器

## 📹 项目简介
上传视频字幕，AI 自动生成词云、统计分析和内容总结

## 🎯 核心功能
- ☁️ **词云可视化** - 直观展示高频词汇
- 📊 **数据统计面板** - 量化分析内容特征
- 🤖 **AI 智能总结** - 自动提炼核心观点
- 📥 **导出报告** - 保存和分享分析结果

## 🛠️ 技术栈
- **语言**: Python 3.8+
- **框架**: Streamlit
- **核心库**: jieba, wordcloud, matplotlib, pandas

## 📦 安装

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

## 📝 使用指南

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

## 📁 项目结构
```
up-video-analyzer/
├── docs/                    # 项目文档
│   ├── 00_brainstorm.md     # 脑爆记录
│   ├── 01_project_brief.json
│   ├── 02_constraints.json
│   ├── 03_track_plan.json
│   └── 04_design.json
├── src/                     # 源代码
│   ├── main.py             # 主程序
│   └── config.py           # 配置文件
├── requirements.txt         # 依赖清单
└── SKILL_STATE.json        # 项目状态
```

## 🎓 学习目标
- 掌握 Streamlit 快速开发数据应用
- 理解中文分词和词频统计
- 学会数据可视化 (词云)
- 实践完整的数据分析流程

## 📚 扩展方向
- [ ] 接入真实 AI API 进行智能总结
- [ ] 支持多视频对比分析
- [ ] 添加情感分析功能
- [ ] 实现时间轴关键词分布
- [ ] 支持批量上传和分析

## ⚠️ 注意事项
- 首次运行需要安装中文字体 (simhei.ttf)
- 大文件分析可能需要较长时间
- 建议字幕文件大小不超过 1MB

## 📄 许可证
MIT License

## 👨‍🎓 作者
AI Student Project Guide - 未来科技学院
