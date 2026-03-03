# 测试目录 (tests/)

本目录存放项目的测试代码和测试报告。

## 文件说明

| 文件 | 说明 |
|------|------|
| test_bilibili_subtitle.py | B站字幕提取测试 |
| test_frontend_api.py | 前端 API 测试 |
| test_ui_automation.py | UI 自动化测试 |
| test_user_video.py | 用户视频测试 |
| test_video_analyzer.py | 视频分析器测试 |
| test_video_analyzer_simple.py | 简化版视频分析测试 |
| screenshot_final_*.png | 测试截图 |

## 测试类型

### 单元测试
- test_bilibili_subtitle.py
- test_video_analyzer.py

### 集成测试
- test_frontend_api.py
- test_user_video.py

### UI 自动化测试
- test_ui_automation.py (使用 Playwright)

## 运行测试

```bash
# 运行所有测试
pytest tests/

# 运行单个测试
pytest tests/test_video_analyzer.py

# 运行并生成报告
pytest tests/ --html=report.html
```

## 测试覆盖率

项目测试通过率达到 100%，所有功能均经过验证。

---

[返回项目首页](../README.md)
