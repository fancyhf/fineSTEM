# -*- coding: utf-8 -*-
"""Q-034 端到端验证：POST /projects 带 description → GET /projects 返回 description。"""
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, r"g:\mediaProjects\fineSTEM\apps\backend")

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)

# 注册 + 登录临时用户
import uuid  # noqa: E402
email = f"q033_{uuid.uuid4().hex[:8]}@test.com"
reg = client.post("/api/v1/auth/register", json={
    "email": email, "password": "Test1234!", "name": "q033",
})
print("register:", reg.status_code)
token = reg.json()["data"]["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 1. 创建带描述的项目
resp = client.post("/api/v1/projects", json={
    "name": "Q033验证项目", "mode": "light", "description": "这是自动生成的项目描述",
}, headers=headers)
data = resp.json()["data"]
print("create:", resp.status_code, "description =", repr(data.get("description")))
assert data.get("description") == "这是自动生成的项目描述", "创建响应缺 description"

# 2. 列表返回描述
lst = client.get("/api/v1/projects", headers=headers)
items = lst.json()["data"]["items"]
target = next(i for i in items if i["id"] == data["id"])
print("list  :", lst.status_code, "description =", repr(target.get("description")))
assert target.get("description") == "这是自动生成的项目描述", "列表响应缺 description"

# 3. PATCH 手动改描述 + 防覆盖标志
patch = client.patch(f"/api/v1/projects/{data['id']}", json={
    "description": "手动改的描述",
}, headers=headers)
pdata = patch.json()["data"]
print("patch :", patch.status_code, "description =", repr(pdata.get("description")),
      "overridden =", pdata.get("initial_data", {}).get("description_manually_overridden"))
assert pdata.get("description") == "手动改的描述"
assert pdata.get("initial_data", {}).get("description_manually_overridden") is True

# 清理
client.delete(f"/api/v1/projects/{data['id']}", headers=headers)
print("OK: Q-034 全链路验证通过")
