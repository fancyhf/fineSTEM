#!/usr/bin/env python3
"""检查函数源代码 - 只检查行数"""

import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

import app.services.orchestrator as o
import inspect

source = inspect.getsource(o._extract_plaintext_question_options)
lines = source.split('\n')

print(f"Total lines: {len(lines)}")
print(f"Last line: {repr(lines[-1])}")
print(f"Second last line: {repr(lines[-2])}")
print(f"Third last line: {repr(lines[-3])}")
