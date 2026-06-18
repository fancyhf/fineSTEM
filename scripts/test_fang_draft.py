"""测试 fang 用户 趣味小测验 achievement-draft API"""
import requests
import json

BASE = "http://localhost:3200/api/v1"
EMAIL = "21749959@qq.com"
PASSWORD = "test123"

# 登录
resp = requests.post(f"{BASE}/auth/login", data={"username": EMAIL, "password": PASSWORD})
print(f"登录: {resp.status_code}")
if resp.status_code != 200:
    print(resp.text[:300])
    exit(1)

token = resp.json().get("data", {}).get("access_token", "")
headers = {"Authorization": f"Bearer {token}"}

# 测试 achievement-draft
PID = "f2a11545-2b53-488d-8c38-7048f3adc801"
resp = requests.get(f"{BASE}/projects/{PID}/achievement-draft", headers=headers)
print(f"\nachievement-draft: {resp.status_code}")
if resp.status_code == 200:
    j = resp.json()
    data = j.get("data", {})
    source = data.get("source", "?")
    print(f"  source: {source}")
    print(f"  title: {data.get('title', '?')}")
    print(f"  one_liner: {str(data.get('one_liner', ''))[:100]}")
    print(f"  problem_solved: {str(data.get('problem_solved', ''))[:100]}")
    print(f"  method_used: {str(data.get('method_used', ''))[:100]}")
    print(f"  reflection: {str(data.get('reflection', ''))[:100]}")
    # 打印完整 data
    print(f"\n完整 data keys: {list(data.keys())}")
    print(f"完整 data:")
    print(json.dumps(data, ensure_ascii=False, indent=2)[:1500])
else:
    print(f"错误: {resp.text[:300]}")
