# 源代码目录 (src/)

本目录存放项目的 Python 源代码。

## 文件说明

| 文件 | 说明 |
|------|------|
| main.py | Streamlit 应用主文件 |
| config.py | 配置文件 |
| task_manager.py | 任务管理器 |
| bilibili_browser.py | B站浏览器模块 |
| bilibili_subtitle.py | B站字幕提取 (版本1) |
| bilibili_subtitle_api.py | B站字幕 API |
| bilibili_subtitle_simple.py | B站字幕提取 (简化版) |
| bilibili_subtitle_v3.py | B站字幕提取 (版本3) |
| video_subtitle_extractor.py | 视频字幕提取器 |
| video_to_subtitle.py | 视频转字幕 |
| stopwords.txt | 停用词列表 |

## 主要模块

### main.py

Streamlit 应用主文件，包含：
- 页面布局
- 用户交互
- 结果展示

### task_manager.py

任务管理器，负责：
- 创建/删除任务
- 管理任务状态
- 存储任务数据

### bilibili_*.py

B站相关模块，实现：
- 视频信息获取
- 字幕提取
- API 调用

### video_*.py

视频处理模块，实现：
- 视频下载
- 音频提取
- 字幕识别

## 运行方式

```bash
streamlit run src/main.py
```

应用将在 http://localhost:8501 启动。

---

[返回项目首页](../README.md)
