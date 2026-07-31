# -*- coding: utf-8 -*-
"""临时验证 screenshot_service 封面截图修复（Q-030）。

模拟坏环境变量 PLAYWRIGHT_BROWSERS_PATH=H:\\dev-env\\playwright（空壳，无 chrome），
确认代码能回退到含真实 chrome 的候选目录并成功截图。
用法：python .dbg/test_screenshot_fix.py
"""
import io
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps" / "backend"))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# 复现故障现场：把环境变量设成空壳目录
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = r"H:\dev-env\playwright"

from app.services.screenshot_service import capture_html, _ensure_browsers_path_env

resolved = _ensure_browsers_path_env()
print("resolved browsers path:", resolved)

html = "<html><body style='background:#0a9'><h1>fineSTEM cover test</h1></body></html>"
png = capture_html(html)
print("PNG bytes:", len(png))
print("valid PNG header:", png[:8].hex() == "89504e470d0a1a0a")
