"""测试前端保存草稿时的问题——模拟前端 payload 发送到后端。"""
import requests, json

# 登录
login_resp = requests.post(
    'http://localhost:3200/api/v1/auth/login',
    data={'username': '21749959@qq.com', 'password': 'test123'}
)
token = login_resp.json()['data']['access_token']
headers = {'Authorization': f'Bearer {token}'}

# 获取项目列表，找到"趣味小测验"
proj_resp = requests.get('http://localhost:3200/api/v1/projects', headers=headers)
proj_data = proj_resp.json()
print(f'登录状态码: {login_resp.status_code}')
print(f'项目列表状态码: {proj_resp.status_code}')
print(f'项目列表响应类型: {type(proj_data)}')
data_field = proj_data.get('data', proj_data)
if isinstance(data_field, dict) and 'items' in data_field:
    projects = data_field['items']
elif isinstance(data_field, list):
    projects = data_field
else:
    projects = []
print(f'项目数量: {len(projects)}')
quiz = next((p for p in projects if isinstance(p, dict) and ('趣味' in p.get('name', '') or '小测验' in p.get('name', ''))), None)
if not quiz:
    print('未找到趣味小测验项目')
    exit(1)

pid = quiz['id']
print(f'项目ID: {pid}')
print(f'项目mode: {quiz.get("mode")}')

# 获取草稿数据
draft_resp = requests.get(
    f'http://localhost:3200/api/v1/projects/{pid}/achievement-draft',
    headers=headers
)
draft = draft_resp.json().get('data', {})
print('草稿数据:')
for k, v in draft.items():
    val = str(v)[:300] if v else '(空/None)'
    print(f'  {k}: {val}')

# 模拟前端 payload（完全按照 ProjectAchievement.tsx handleSaveDraft 逻辑）
draftTitle = draft.get('title') or quiz['name']
draftOneLiner = draft.get('one_liner') or quiz.get('description', '')
draftProblemSolved = draft.get('problem_solved', '')
draftMethodUsed = draft.get('method_used', '')
draftReflection = draft.get('reflection', '')
draftTags = draft.get('capability_tags', [])

payload = {
    'title': draftTitle,
    'one_liner': draftOneLiner,
    'problem_solved': draftProblemSolved,
    'method_used': draftMethodUsed,
    'screenshots': [],
    'reflection': draftReflection,
    'capability_tags': draftTags,
    'project_mode': quiz.get('mode', 'light'),
}

print(f'\n=== 发送 payload (前端模拟) ===')
print(json.dumps(payload, ensure_ascii=False, indent=2))

# 检查 reflection 是否为空（已知后端 schema 要求 min_length=1）
print(f'\n=== 字段长度检查 ===')
print(f'title: len={len(str(payload["title"]))}, empty={not payload["title"]}')
print(f'one_liner: len={len(str(payload["one_liner"]))}, empty={not payload["one_liner"]}')
print(f'problem_solved: len={len(str(payload["problem_solved"]))}, empty={not payload["problem_solved"]}')
print(f'method_used: len={len(str(payload["method_used"]))}, empty={not payload["method_used"]}')
print(f'reflection: len={len(str(payload["reflection"]))}, empty={not payload["reflection"]}')
print(f'capability_tags: {payload["capability_tags"]}')
print(f'project_mode: {payload["project_mode"]}')

# 发送创建请求
create_resp = requests.post(
    f'http://localhost:3200/api/v1/achievement-cards/projects/{pid}',
    json=payload,
    headers=headers
)
print(f'\n=== 创建结果 ===')
print(f'状态码: {create_resp.status_code}')
print(f'响应: {create_resp.text[:1000]}')
