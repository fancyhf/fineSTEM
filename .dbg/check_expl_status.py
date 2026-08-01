"""快速查询测试项目的讲解文档状态。"""
import requests

# OAuth2 表单格式
r = requests.post('http://localhost:3200/api/v1/auth/login',
                   data={'username': '2749959@qq.com', 'password': '750714hf'})
token = r.json()['data']['access_token']
h = {'Authorization': f'Bearer {token}'}

pid = '49d90991-643f-482a-82fe-43b67e829e1d'

# 文档列表
docs = requests.get(f'http://localhost:3200/api/v1/projects/{pid}/documents', headers=h)
print('=== Documents ===')
for d in docs.json()['data']:
    print(f"  stage={d['stage']}, name={d['name']}, filename={d['filename']}, has_content={d['has_content']}")

# 讲解文档
expl = requests.get(f'http://localhost:3200/api/v1/projects/{pid}/documents/explanation', headers=h)
ej = expl.json()['data']
print(f"\n=== Explanation Doc ===")
print(f"has_content: {ej['has_content']}")
print(f"content length: {len(ej['content'])}")
if ej['content']:
    print(f"preview (300 chars):\n{ej['content'][:300]}")
else:
    print("(empty)")

# 也查一下项目目录下是否有 08_code_explanation.md 文件
import os
proj_dir = f'g:\\mediaProjects\\fineSTEM\\apps\\backend\\projects\\{pid}'
if os.path.exists(proj_dir):
    print(f"\n=== Project dir files ===")
    for f in sorted(os.listdir(proj_dir)):
        fpath = os.path.join(proj_dir, f)
        size = os.path.getsize(fpath) if os.path.isfile(fpath) else 0
        print(f"  {f} ({size} bytes)")
else:
    print(f"\nProject dir not found: {proj_dir}")
