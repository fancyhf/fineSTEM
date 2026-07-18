import requests
import json

# 测试项目进度 API
url = 'http://127.0.0.1:3200/api/v1/projects/b686df08-6655-4edb-a3a5-955f3244abe1/progress'
headers = {'Authorization': 'Bearer test-token'}

try:
    r = requests.get(url, headers=headers, timeout=5)
    print(f'Status: {r.status_code}')
    if r.status_code == 200:
        data = r.json()
        print(f'Response: {json.dumps(data, indent=2, ensure_ascii=False)}')
        if data.get('data'):
            print(f"\ncurrent_stage: {data['data'].get('current_stage')}")
    else:
        print(f'Error: {r.text}')
except Exception as e:
    print(f'Error: {e}')
