#!/usr/bin/env python3
"""检查函数源代码"""

import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

import app.services.orchestrator as o
import inspect

source = inspect.getsource(o._extract_plaintext_question_options)
lines = source.split('\n')

# 打印前 30 行和后 10 行
print("First 30 lines:")
for i, line in enumerate(lines[:30], 1):
    print(f"{i:3}: {line}")

print("\n...")
print(f"\nLast 10 lines (total {len(lines)} lines):")
for i, line in enumerate(lines[-10:], len(lines)-9):
    print(f"{i:3}: {line}")
