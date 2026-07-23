#!/usr/bin/env python3
"""测试流式 API - 不需要认证"""

import requests
import json

BASE_URL = "http://localhost:3200"
PROJECT_ID = "b686df08-6655-4edb-a3a5-955f3244abe1"

def test_stream():
    """测试流式聊天 API"""
    url = f"{BASE_URL}/api/v1/projects/{PROJECT_ID}/chat/stream"
    
    payload = {
        "message": "重新生成index.html代码兵写入编辑器，且要符合项目立项的需求，要能用起来",
        "session_id": "test-session-001",
        "context": {
            "current_stage": "stage_08_evaluate",
            "skill_id": "stem-pbl-guide"
        },
        "enable_tools": True
    }
    
    print(f"Testing stream API: {url}")
    print("-" * 60)
    
    try:
        response = requests.post(url, json=payload, stream=True, timeout=60)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Failed: {response.text[:500]}")
            return False
        
        print("\nStreaming response:")
        print("-" * 60)
        
        error_found = False
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    event = data.get('event')
                    payload_data = data.get('data', {})
                    
                    if event == 'error':
                        print(f"[ERROR] {payload_data}")
                        error_found = True
                    elif event == 'token':
                        token = payload_data.get('token', '')
                        print(token, end='', flush=True)
                    elif event == 'final':
                        print(f"\n\n[FINAL] {payload_data}")
                        break
                    elif event == 'stage_changed':
                        print(f"\n[STAGE CHANGED]")
                    elif event == 'skill_activated':
                        print(f"\n[SKILL] {payload_data.get('skill_name')} / {payload_data.get('sub_skill_name')}")
                except Exception as e:
                    print(f"\n[Parse Error] {e}: {line[:100]}")
        
        print("\n" + "-" * 60)
        return not error_found
        
    except Exception as e:
        print(f"\nError: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_stream()
    exit(0 if success else 1)
