"""测试成果卡草稿完整链路"""
import requests
import json
import sys

BASE = "http://localhost:3200/api/v1"
EMAIL = "demo@finestem.dev"
PASSWORD = "demo123456"

# 1. 登录
print("=" * 60)
print("Step 1: 登录")
resp = requests.post(f"{BASE}/auth/login", data={"username": EMAIL, "password": PASSWORD})
if resp.status_code != 200:
    print(f"  登录失败: {resp.status_code} {resp.text[:300]}")
    sys.exit(1)
login_data = resp.json()
token = login_data.get("data", {}).get("access_token", "")
if not token:
    # 尝试直接从响应中获取
    token = login_data.get("access_token", "")
headers = {"Authorization": f"Bearer {token}"}
print(f"  登录成功, token={token[:40]}...")

# 2. 获取项目列表并打印原始响应
print("\n" + "=" * 60)
print("Step 2: 获取项目列表")
resp = requests.get(f"{BASE}/projects", headers=headers)
print(f"  状态码: {resp.status_code}")
proj_data = resp.json()
print(f"  响应结构: {list(proj_data.keys())}")
data = proj_data.get("data", {})
print(f"  data 类型: {type(data).__name__}, keys: {list(data.keys()) if isinstance(data, dict) else 'N/A'}")

# 提取项目列表
projects = []
if isinstance(data, list):
    projects = data
elif isinstance(data, dict):
    for v in data.values():
        if isinstance(v, list):
            projects = v
            break
    if not projects:
        projects = [data]  # 可能是单个项目对象

print(f"  项目数量: {len(projects)}")

# 3. 对每个项目尝试获取草稿
print("\n" + "=" * 60)
print("Step 3: 获取每个项目的 achievement-draft")
for p in projects:
    pid = p.get("id", "")
    name = p.get("name", "?")
    print(f"\n  项目: {name} (id={str(pid)[:30]})")
    resp = requests.get(f"{BASE}/projects/{pid}/achievement-draft", headers=headers)
    print(f"    状态码: {resp.status_code}")
    if resp.status_code == 200:
        draft_json = resp.json()
        draft_data = draft_json.get("data", {})
        if not draft_data:
            print(f"    data 为空! 完整响应: {json.dumps(draft_json, ensure_ascii=False)[:300]}")
            continue
        source = draft_data.get("source", "?")
        title = draft_data.get("title", "?")
        one_liner = str(draft_data.get("one_liner", ""))
        problem_solved = str(draft_data.get("problem_solved", ""))
        method_used = str(draft_data.get("method_used", ""))
        reflection = str(draft_data.get("reflection", ""))
        has_content = bool(one_liner or problem_solved or method_used or reflection)
        print(f"    source: {source}")
        print(f"    title: {title}")
        print(f"    one_liner: {one_liner[:100]}")
        print(f"    problem_solved: {problem_solved[:100]}")
        print(f"    method_used: {method_used[:100]}")
        print(f"    reflection: {reflection[:100]}")
        print(f"    has_content: {has_content}")
        if has_content:
            print(f"    >>> 草稿可用！")
        else:
            print(f"    >>> 草稿内容为空！")
    else:
        print(f"    响应: {resp.text[:300]}")
