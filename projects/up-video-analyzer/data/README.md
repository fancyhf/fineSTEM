# 数据目录 (data/)

本目录存放项目的运行时数据，包括任务数据和缓存文件。

## 目录结构

```
data/
└── tasks/                    # 任务数据目录
    ├── {task_id}/            # 每个任务一个目录
    │   ├── task.json         # 任务配置
    │   ├── audio/            # 音频文件
    │   │   └── audio.mp3
    │   ├── subtitles/        # 字幕文件
    │   │   └── subtitle.txt
    │   └── analysis/         # 分析结果
    │       ├── analysis_result.json
    │       └── word_frequency_chart.png
    └── ...
```

## 任务目录说明

每个任务目录包含：

| 文件/目录 | 说明 |
|----------|------|
| task.json | 任务配置和元数据 |
| audio/ | 提取的音频文件 |
| subtitles/ | 提取的字幕文件 |
| analysis/ | 分析结果和图表 |

## 注意事项

- 任务目录使用 UUID 命名，确保唯一性
- 数据文件可能较大，请定期清理不需要的任务
- 音频和字幕文件为临时文件，分析完成后可删除

---

[返回项目首页](../README.md)
