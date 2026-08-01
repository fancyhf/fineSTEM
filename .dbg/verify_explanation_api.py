"""讲解文档沉淀（explanation 工件）全链路验证（2026-07-31）。

链路：建项目 → POST /explanation 两次不同内容 + 一次重复（断言 duplicate）
      → documents 列表含讲解文档 → 单文档含两个时间戳章节
      → artifact_writer 工具 append / replace 两模式
      → GET demo 断言种子 explanation_doc 非空。
运行：cd apps/backend && python ../../.dbg/verify_explanation_api.py
"""
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, r"g:\mediaProjects\fineSTEM\apps\backend")

import asyncio  # noqa: E402
import uuid  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)

email = f"expl_{uuid.uuid4().hex[:8]}@test.com"
reg = client.post("/api/v1/auth/register", json={
    "email": email, "password": "Test1234!", "name": "expl",
})
print("register:", reg.status_code)
token = reg.json()["data"]["access_token"]
headers = {"Authorization": f"Bearer {token}"}

resp = client.post("/api/v1/projects", json={
    "name": "讲解文档验证项目", "mode": "standard", "description": "explanation 验证",
}, headers=headers)
assert resp.status_code == 200, resp.text
pid = resp.json()["data"]["id"]
print("project:", pid)

CONTENT_A = (
    "# 冒泡排序原理\n\n"
    "冒泡排序通过相邻元素两两比较交换，每一轮把最大值\"冒泡\"到末尾。\n"
    "时间复杂度 O(n^2)，适合小数据量教学演示。"
)
CONTENT_B = (
    "# 事件循环机制\n\n"
    "JavaScript 单线程通过事件循环调度宏任务与微任务，\n"
    "setTimeout 回调进宏任务队列，Promise.then 进微任务队列优先执行。"
)

# ---- ① POST 两次不同内容：均 appended ----
r1 = client.post(f"/api/v1/projects/{pid}/explanation",
                 json={"content": CONTENT_A}, headers=headers)
assert r1.status_code == 200, r1.text
d1 = r1.json()["data"]
print("append A:", d1["status"], "topic =", d1.get("topic"))
assert d1["status"] == "appended", d1

r2 = client.post(f"/api/v1/projects/{pid}/explanation",
                 json={"content": CONTENT_B, "topic": "事件循环"}, headers=headers)
assert r2.status_code == 200, r2.text
d2 = r2.json()["data"]
print("append B:", d2["status"], "topic =", d2.get("topic"))
assert d2["status"] == "appended", d2
assert d2.get("topic") == "事件循环", "显式 topic 未生效"

# ---- ② 同内容重复提交：duplicate ----
r3 = client.post(f"/api/v1/projects/{pid}/explanation",
                 json={"content": CONTENT_A}, headers=headers)
assert r3.status_code == 200, r3.text
d3 = r3.json()["data"]
print("repeat A:", d3["status"])
assert d3["status"] == "duplicate", "重复内容未被判重跳过"

# ---- ③ documents 列表含讲解文档 ----
docs = client.get(f"/api/v1/projects/{pid}/documents", headers=headers)
assert docs.status_code == 200, docs.text
doc_list = docs.json()["data"]
expl_items = [d for d in doc_list if d.get("stage") == "explanation"]
assert expl_items, f"documents 列表缺讲解文档: {[d.get('stage') for d in doc_list]}"
print("documents: 讲解文档 in list, name =", expl_items[0].get("name"),
      "filename =", expl_items[0].get("filename"))
assert expl_items[0].get("filename") == "08_code_explanation.md"

# ---- ④ 单文档含两个时间戳章节 ----
doc = client.get(f"/api/v1/projects/{pid}/documents/explanation", headers=headers)
assert doc.status_code == 200, doc.text
detail = doc.json()["data"]
assert detail.get("has_content"), "讲解文档 has_content 应为 True"
content = detail["content"]
sections = content.count("## 📖")
print("document sections:", sections)
assert sections == 2, f"应有 2 个时间戳章节，实际 {sections}\n{content[:400]}"
assert "冒泡排序" in content and "事件循环" in content

# ---- ⑤ artifact_writer 工具 append（默认）----
from app.services.tools import ArtifactWriterTool  # noqa: E402

tool = ArtifactWriterTool()
res_append = asyncio.run(tool.execute({
    "project_id": pid,
    "artifact_name": "explanation",
    "content": "# 递归与栈\n\n递归调用依赖调用栈保存现场，深度过大会栈溢出。",
    "topic": "递归与栈",
}))
print("tool append:", res_append.success, res_append.data.get("status"))
assert res_append.success and res_append.data.get("status") == "appended"

doc = client.get(f"/api/v1/projects/{pid}/documents/explanation", headers=headers)
content = doc.json()["data"]["content"]
assert content.count("## 📖") == 3, "工具 append 后应为 3 个章节"
assert "递归与栈" in content

# 工具重复提交同内容 → duplicate（success 仍为 True）
res_dup = asyncio.run(tool.execute({
    "project_id": pid,
    "artifact_name": "explanation",
    "content": "# 递归与栈\n\n递归调用依赖调用栈保存现场，深度过大会栈溢出。",
}))
print("tool repeat:", res_dup.success, res_dup.data.get("status"))
assert res_dup.success and res_dup.data.get("status") == "duplicate"

# ---- ⑥ artifact_writer mode=replace 整篇覆盖 ----
res_replace = asyncio.run(tool.execute({
    "project_id": pid,
    "artifact_name": "explanation",
    "content": "# 全新讲解文档\n\n整篇覆盖后旧章节应消失。",
    "mode": "replace",
}))
print("tool replace:", res_replace.success, res_replace.data.get("status"))
assert res_replace.success, res_replace.error

doc = client.get(f"/api/v1/projects/{pid}/documents/explanation", headers=headers)
content = doc.json()["data"]["content"]
assert "全新讲解文档" in content
assert "## 📖" not in content and "冒泡排序" not in content, "replace 未整篇覆盖"
print("replace: 旧章节已清空, len =", len(content))

# ---- ⑦ 种子 Demo explanation_doc 非空 ----
demos = client.get("/api/v1/demos")
assert demos.status_code == 200, demos.text
demo_items = demos.json()["data"]["items"]
assert demo_items, "demo 列表为空"
demo_detail = client.get(f"/api/v1/demos/{demo_items[0]['id']}")
assert demo_detail.status_code == 200, demo_detail.text
demo_data = demo_detail.json()["data"]
expl_doc = demo_data.get("explanation_doc")
print("demo:", demo_data["id"], "explanation_doc len =", len(expl_doc or ""))
assert expl_doc, "种子 Demo 的 explanation_doc 应非空"

# 清理
client.delete(f"/api/v1/projects/{pid}", headers=headers)
print("OK: 讲解文档沉淀全链路验证通过")
