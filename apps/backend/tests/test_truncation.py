#!/usr/bin/env python3
"""测试截断检测和自动续接机制"""

import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

from app.services.orchestrator import AgentOrchestratorService

# 测试 _is_output_truncated 方法
service = AgentOrchestratorService()

# 测试用例 1: 以 python 结尾的输出（应该检测为截断）
test_case_1 = """```python
print("hello")
python"""

# 测试用例 2: 正常结束的输出（不应该检测为截断）
test_case_2 = """```python
print("hello")
```

这是完整的代码。"""

# 测试用例 3: 以 javascript 结尾的输出（应该检测为截断）
test_case_3 = """好的，让我运行代码：

```javascript
console.log("test")
javascript"""

# 测试用例 4: 未闭合的代码块（应该检测为截断）
test_case_4 = """这是代码示例：

```html
<div>
  <p>hello</p>
  
"""

print("=" * 60)
print("Testing _is_output_truncated method")
print("=" * 60)

result_1 = service._is_output_truncated(test_case_1)
print(f"Test case 1 (ends with 'python'): {result_1}")
if result_1:
    print("✓ Correctly detected as truncated")
else:
    print("✗ Failed to detect truncation")

result_2 = service._is_output_truncated(test_case_2)
print(f"\nTest case 2 (normal ending): {result_2}")
if not result_2:
    print("✓ Correctly detected as NOT truncated")
else:
    print("✗ Incorrectly detected as truncated")

result_3 = service._is_output_truncated(test_case_3)
print(f"\nTest case 3 (ends with 'javascript'): {result_3}")
if result_3:
    print("✓ Correctly detected as truncated")
else:
    print("✗ Failed to detect truncation")

result_4 = service._is_output_truncated(test_case_4)
print(f"\nTest case 4 (unclosed code block): {result_4}")
if result_4:
    print("✓ Correctly detected as truncated")
else:
    print("✗ Failed to detect truncation")

print("\n" + "=" * 60)
print("Testing complete")
print("=" * 60)
