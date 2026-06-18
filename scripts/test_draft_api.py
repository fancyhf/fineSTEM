"""验证 achievement-draft 端点三级 fallback"""
import requests

# 登录
r = requests.post('http://localhost:3200/api/v1/auth/login',
    data={'username': 'testuser', 'password': 'Test123456'})
print('Login:', r.status_code)
if r.status_code == 200:
    token = r.json().get('data', {}).get('access_token', '')
elif r.status_code == 401:
    # Try another password
    print('Login failed:', r.json())
    token = ''
else:
    token = ''

if token:
    headers = {'Authorization': f'Bearer {token}'}
    project_id = 'f2a11545-2b53-488d-8c38-7048f3adc801'
    r2 = requests.get(f'http://localhost:3200/api/v1/projects/{project_id}/achievement-draft', headers=headers)
    print(f'Draft ({project_id}): status={r2.status_code}')
    data = r2.json().get('data')
    if data:
        print(f'  source={data.get("source")}')
        print(f'  title={data.get("title")}')
        print(f'  one_liner={data.get("one_liner", "")[:60]}')
        print(f'  problem_solved={data.get("problem_solved", "")[:60]}')
    else:
        print('  data is None')
