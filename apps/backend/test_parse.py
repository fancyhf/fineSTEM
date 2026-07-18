#!/usr/bin/env python3
import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

import app.services.orchestrator as o

# 测试 _parse_question_block
text = "test"
try:
    result = o._parse_question_block(text)
    print(f"_parse_question_block result: {result}")
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
