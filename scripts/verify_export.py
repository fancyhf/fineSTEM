"""验证导出 ZIP 的新结构。"""
import requests, io, zipfile

resp = requests.post(
    'http://localhost:3200/api/v1/auth/login',
    data={'username': '21749959@qq.com', 'password': 'test123'}
)
token = resp.json()['data']['access_token']
headers = {'Authorization': f'Bearer {token}'}

proj_resp = requests.get('http://localhost:3200/api/v1/projects', headers=headers)
items = proj_resp.json()['data']['items']
quiz = next((p for p in items if '趣味' in p.get('name', '')), None)
pid = quiz['id']
print(f'项目: {quiz["name"]} ({pid})')

resp = requests.get(
    f'http://localhost:3200/api/v1/projects/{pid}/export?format=zip',
    headers=headers
)
print(f'状态码: {resp.status_code}')

cd = resp.headers.get('content-disposition', '')
print(f'Content-Disposition: {cd}')
print()

with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
    names = sorted(z.namelist())
    print(f'ZIP 包含 {len(names)} 个文件:')
    for n in names:
        marker = ''
        if n == '.gitignore':
            marker = ' <-- 新增'
        elif n == 'README.md':
            marker = ' <-- 新增'
        elif n == 'index.html':
            marker = ' <-- 新增'
        elif n.startswith('src/'):
            marker = ' <-- 新增 (IDE源码目录)'
        elif n.startswith('data/'):
            marker = ' <-- 新增 (数据目录)'
        elif n.startswith('project_files/'):
            marker = ' <-- 改名'
        print(f'  {n}{marker}')
