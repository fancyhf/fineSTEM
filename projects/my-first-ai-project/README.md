# 文学知识卡 - 二次元漫画版

## 项目状态

| 属性 | 值 |
|------|-----|
| 当前阶段 | stage_08_evaluate (验收展示) |
| 阶段状态 | completed |
| 年龄组 | 13-15岁 |
| 时间预算 | 12h+ |
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

---

## 项目介绍

我是文学天团!这是一个用Flask开发的古诗词和文学知识卡片学习应用,采用卡哇伊二次元风格,适合中小学生学习和复习古诗词。

## 功能特性

- 卡片式学习: 点击卡片翻转查看详细信息
- 搜索功能: 快速搜索诗词、作者或内容
- 分类筛选: 按唐诗、宋词、元曲等分类查看
- 收藏功能: 收藏喜欢的诗词卡片
- 添加诗词: 手动添加新的诗词和文学知识
- 导入功能: 从网页链接导入诗词内容
- 自动搜集: 自动从互联网搜集古诗词

## 技术栈

- 后端: Python Flask
- 前端: HTML5 + CSS3 + JavaScript
- 样式: 卡哇伊二次元风格
- 数据存储: JSON文件

## 快速开始

### 方式一：使用启动脚本（推荐）

**Windows:**
```bash
start.bat
```

**Linux/macOS:**
```bash
./start.sh
```

### 方式二：手动运行

```bash
# 安装依赖
pip install Flask

# 运行应用
cd src
python app.py
```

### 访问应用

在浏览器中打开: http://localhost:4001

## 项目结构

```
my-first-ai-project/
├── src/
│   └── app.py              # Flask应用主文件
├── templates/
│   ├── base.html           # 基础模板
│   ├── index.html          # 首页(卡片列表)
│   ├── add.html            # 添加诗词页面
│   └── import.html         # 导入内容页面
├── static/
│   ├── css/
│   │   └── style.css       # 样式文件(卡哇伊风格)
│   └── js/
│       └── main.js         # JavaScript交互
├── data/
│   └── poetry_data.json    # 数据存储文件
├── docs/                   # 项目文档
│   └── research/           # 研学文档
├── start.bat               # Windows启动脚本
├── start.sh                # Linux/macOS启动脚本
├── SKILL_STATE.json        # 项目状态管理
└── README.md               # 本文件
```

## 使用说明

### 查看诗词卡片

1. 首页显示所有诗词卡片
2. 点击卡片可以翻转查看详细信息
3. 点击收藏按钮收藏喜欢的卡片

### 搜索诗词

1. 在搜索框输入关键词
2. 点击搜索按钮或按Enter键
3. 查看匹配的诗词卡片

### 分类筛选

1. 点击顶部的分类按钮
2. 查看对应分类的诗词卡片

### 添加诗词

1. 点击导航栏的"添加诗词"
2. 填写诗词信息
3. 点击"保存诗词"按钮

---

## 文档入口

详细文档请查看 [docs/README.md](./docs/README.md)

---

*创建时间: 2026-03-03*
*最后更新: 2026-03-06*
