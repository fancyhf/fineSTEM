"""清理测试创建的成果卡。"""
import requests, json

# 登录
login_resp = requests.post(
    'http://localhost:3200/api/v1/auth/login',
    data={'username': '21749959@qq.com', 'password': 'test123'}
)
token = login_resp.json()['data']['access_token']
headers = {'Authorization': f'Bearer {token}'}

# 获取项目
proj_resp = requests.get('http://localhost:3200/api/v1/projects', headers=headers)
proj_data = proj_resp.json()
items = proj_data['data']['items']
quiz = next((p for p in items if '趣味' in p.get('name', '') or '小测验' in p.get('name', '')), None)
pid = quiz['id']

# 列出该项目的成果卡
cards_resp = requests.get(
    f'http://localhost:3200/api/v1/achievement-cards/projects/{pid}',
    headers=headers
)
card_data = cards_resp.json()
print(f'项目成果卡: {json.dumps(card_data, ensure_ascii=False, indent=2)[:1000]}')
