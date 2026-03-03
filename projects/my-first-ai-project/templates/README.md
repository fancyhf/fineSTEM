# 模板目录 (templates/)

本目录存放 Flask 应用的 HTML 模板文件。

## 文件说明

| 文件 | 说明 |
|------|------|
| base.html | 基础模板，包含公共头部和尾部 |
| index.html | 首页，显示诗词卡片列表 |
| add.html | 添加诗词页面 |
| import.html | 导入内容页面 |
| stats.html | 统计页面 |

## 模板继承关系

```
base.html (基础模板)
├── index.html (首页)
├── add.html (添加页面)
├── import.html (导入页面)
└── stats.html (统计页面)
```

## 模板说明

### base.html

基础模板，包含：
- HTML 文档结构
- CSS 引用
- 导航栏
- 页脚
- Jinja2 block 定义

### index.html

首页模板，显示：
- 搜索框
- 分类筛选按钮
- 诗词卡片网格
- 收藏按钮

### add.html

添加诗词页面，包含：
- 诗词信息表单
- 表单验证
- 提交按钮

### import.html

导入内容页面，包含：
- URL 输入框
- 导入按钮
- 导入说明

### stats.html

统计页面，显示：
- 诗词总数
- 分类统计
- 收藏统计

---

[返回项目首页](../README.md)
