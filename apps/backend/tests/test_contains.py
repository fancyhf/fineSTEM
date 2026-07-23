#!/usr/bin/env python3
import sys
sys.path.insert(0, 'G:\\mediaProjects\\fineSTEM\\apps\\backend')

import app.services.orchestrator as o

text = "test"
try:
    result = o._contains_question_block(text)
    print('Result:', result)
except Exception as e:
    print('Error:', type(e).__name__, e)
    import traceback
    traceback.print_exc()
