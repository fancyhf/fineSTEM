# 源代码目录 (src/)

本目录存放项目的 Python 源代码。

## 文件说明

| 文件 | 说明 |
|------|------|
| app.py | Flask 应用主文件 |

## 代码结构

app.py 包含以下主要部分：

1. **路由定义**
   - `/` - 首页，显示诗词卡片列表
   - `/add` - 添加诗词页面
   - `/import` - 导入内容页面
   - `/stats` - 统计页面

2. **数据处理**
   - 读取/写入 poetry_data.json
   - 搜索和筛选功能
   - 收藏功能

3. **API 接口**
   - 添加诗词 API
   - 收藏切换 API
   - 搜索 API

## 运行方式

```bash
cd src
python app.py
```

应用将在 http://localhost:5000 启动。

---

[返回项目首页](../README.md)
