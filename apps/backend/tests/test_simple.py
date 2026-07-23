#!/usr/bin/env python3
"""简化测试"""

import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

from app.services.orchestrator import _extract_plaintext_question_options

# 测试文本
text = "test"

print("Testing...")
result = _extract_plaintext_question_options(text)
print(f"Type: {type(result)}")
print(f"Result: {result}")
print("Done")
