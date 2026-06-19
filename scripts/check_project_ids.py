import requests
resp = requests.post('http://localhost:3200/api/v1/auth/login', data={'username': '21749959@qq.com', 'password': 'test123'})
token = resp.json()['data']['access_token']
headers = {'Authorization': f'Bearer {token}'}
proj = requests.get('http://localhost:3200/api/v1/projects', headers=headers)
items = proj.json()['data']['items']
print(f'Total projects: {len(items)}')
for p in items[:5]:
    print(f"  id={p['id']}  name={p.get('name','?')[:30]}  stage={p.get('current_stage','?')}")
