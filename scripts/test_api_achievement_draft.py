"""通过 HTTP 测试 achievement-draft API"""
import requests
import json

BASE_URL = "http://localhost:3200/api/v1"

# 先登录获取 token
print("=== 登录 ===")
login_resp = requests.post(f"{BASE_URL}/auth/login", data={
    "username": "21749959@qq.com",
    "password": "test123"
})
print(f"登录状态: {login_resp.status_code}")
login_data = login_resp.json()
print(f"登录响应: {json.dumps(login_data, ensure_ascii=False)[:200]}")

token = login_data.get("data", {}).get("access_token", "")
print(f"Token: {token[:20]}...")

headers = {"Authorization": f"Bearer {token}"}

# 先获取项目列表
print("\n=== 获取项目列表 ===")
projects_resp = requests.get(f"{BASE_URL}/projects?page_size=50", headers=headers)
print(f"状态: {projects_resp.status_code}")
projects_data = projects_resp.json()
items = projects_data.get("data", {}).get("items", [])
for p in items:
    prefix = " >> " if "趣味" in (p.get("name", "") or "") else "    "
    print(f"{prefix}{p['id'][:12]}... | {p['name']} | {p.get('current_stage', '?')}")

# 找趣味小测验
target = None
for p in items:
    if "趣味" in (p.get("name", "") or ""):
        target = p
        break

if not target:
    print("\n没找到趣味小测验项目!")
    exit(1)

project_id = target["id"]
print(f"\n=== 测试 achievement-draft API ===")
print(f"项目: {target['name']} ({project_id})")

draft_resp = requests.get(f"{BASE_URL}/projects/{project_id}/achievement-draft", headers=headers)
print(f"状态: {draft_resp.status_code}")
print(f"原始响应: {draft_resp.text[:1000]}")
try:
    draft_data = draft_resp.json()
    print(f"响应JSON: {json.dumps(draft_data, ensure_ascii=False, indent=2)}")
except Exception as e:
    print(f"JSON解析失败: {e}")

# 检查 data 字段
data = draft_data.get("data")
if data:
    print(f"\n=== 草稿数据分析 ===")
    print(f"source: {data.get('source')}")
    print(f"title: {data.get('title')}")
    print(f"one_liner: {(data.get('one_liner') or '')[:60]}")
    print(f"problem_solved: {(data.get('problem_solved') or '')[:80]}")
    print(f"method_used: {(data.get('method_used') or '')[:80]}")
    print(f"reflection: {(data.get('reflection') or '')[:80]}")
else:
    print("\n警告: data 为空!")
