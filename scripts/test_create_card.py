"""测试创建成果卡 API"""
import requests
import json

BASE = "http://localhost:3200/api/v1"
EMAIL = "21749959@qq.com"
PASSWORD = "test123"

# 登录
resp = requests.post(f"{BASE}/auth/login", data={"username": EMAIL, "password": PASSWORD})
if resp.status_code != 200:
    print(f"登录失败: {resp.status_code}")
    exit(1)
token = resp.json().get("data", {}).get("access_token", "")
headers = {"Authorization": f"Bearer {token}"}

PID = "f2a11545-2b53-488d-8c38-7048f3adc801"

# 创建成果卡
payload = {
    "title": "科学百科小测验",
    "one_liner": "一个趣味科学问答Web应用",
    "problem_solved": "完成了6道科学题的Web测验",
    "method_used": "HTML + CSS + JavaScript",
    "screenshots": [],
    "reflection": "学到了很多",
    "capability_tags": ["HTML", "CSS", "JavaScript"],
    "project_mode": "standard",
}
print(f"创建 payload: {json.dumps(payload, ensure_ascii=False)}")
resp = requests.post(f"{BASE}/achievement-cards/projects/{PID}", json=payload, headers=headers)
print(f"状态码: {resp.status_code}")
print(f"响应: {resp.text[:500]}")
