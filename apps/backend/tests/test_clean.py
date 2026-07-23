#!/usr/bin/env python3
"""测试 _clean_dsml_content 是否会影响截断检测"""

import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

from app.services.orchestrator import _clean_dsml_content, AgentOrchestratorService

service = AgentOrchestratorService()

# 模拟 AI 输出（包含 DSML 标签）
raw_output = """好的，让我先通过 code_runner 运行当前代码。

<|tool_calls|>
<|invoke name="code_runner"|>
<|parameter name="code" string="true">print("hello")<|/parameter|>
<|/invoke|>
<|/tool_calls|>

我看到所有HTML文件了！从列表来看，index.html 在多个位置都存在。让我仔细检查 4824fbf1 这个项目ID对应的文件。

```python
target_dir = '/mediaProjects/fineSTEM/app/static/projects/4824fbf1'
files = os.listdir(target_dir)
print(f"目录: {target_dir}")
print(f"包含文件: {files}")
python"""

print("=" * 60)
print("Testing _clean_dsml_content")
print("=" * 60)

cleaned = _clean_dsml_content(raw_output)
print(f"Cleaned output length: {len(cleaned)}")
print(f"Last 200 chars: {repr(cleaned[-200:])}")
print()

# 测试清理后的内容是否会被检测为截断
is_truncated = service._is_output_truncated(cleaned)
print(f"Is truncated after cleaning: {is_truncated}")

if is_truncated:
    print("✓ Correctly detected as truncated after cleaning")
else:
    print("✗ Failed to detect truncation after cleaning")
    print("\nThis might be the issue - _clean_dsml_content removes the ``` markers")
