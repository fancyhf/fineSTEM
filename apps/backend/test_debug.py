#!/usr/bin/env python3
import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

import app.services.orchestrator as o

# 测试 _extract_plaintext_question_options
result = o._extract_plaintext_question_options("test")
print(f"_extract_plaintext_question_options result: {result}")
print(f"Type: {type(result)}")

# 测试 _contains_question_block
result2 = o._contains_question_block("test")
print(f"_contains_question_block result: {result2}")

# 检查函数源码
import inspect
source = inspect.getsource(o._extract_plaintext_question_options)
print(f"\nFunction has return statement: {'return title, options' in source}")
print(f"Function lines: {len(source.splitlines())}")
