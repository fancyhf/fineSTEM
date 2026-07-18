#!/usr/bin/env python3
"""测试 API 调用"""

import requests
import json

BASE_URL = "http://localhost:3200"
PROJECT_ID = "b686df08-6655-4edb-a3a5-955f3244abe1"

def test_chat():
    """测试聊天 API"""
    url = f"{BASE_URL}/api/v1/projects/{PROJECT_ID}/chat"
    
    payload = {
        "message": "重新生成index.html代码兵写入编辑器，且要符合项目立项的需求，要能用起来",
        "session_id": "test-session-001",
        "context": {
            "current_stage": "stage_08_evaluate",
            "skill_id": "stem-pbl-guide"
        },
        "enable_tools": True
    }
    
    print(f"Testing chat API: {url}")
    print(f"Payload: {json.dumps(payload, ensure_ascii=False, indent=2)}")
    print("-" * 60)
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nSuccess! Response keys: {list(data.keys())}")
            return True
        else:
            print(f"\nFailed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"\nError: {type(e).__name__}: {e}")
        return False

if __name__ == "__main__":
    success = test_chat()
    exit(0 if success else 1)
