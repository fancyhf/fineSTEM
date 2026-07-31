"""Q-037 端到端验证：占位 step8.payload 被真实 evaluate_content 水合替换。

场景一：payload 是成果卡草稿占位模板 + evaluate_content 是带 ### 子标题的
        真实验收文档 → GET progress 后 payload 应换成解析内容，
        evaluate_content 原文不被回滚。
场景二：payload 与 evaluate_content 均为占位（无真实来源）→ 行为稳定，
        payload 保留占位兜底，不退化为空白。
"""
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, r"g:\mediaProjects\fineSTEM\apps\backend")

import uuid  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from app.repositories.runtime_db import db  # noqa: E402

client = TestClient(app)

email = f"q037_{uuid.uuid4().hex[:8]}@test.com"
reg = client.post("/api/v1/auth/register", json={
    "email": email, "password": "Test1234!", "name": "q037",
})
print("register:", reg.status_code)
token = reg.json()["data"]["access_token"]
headers = {"Authorization": f"Bearer {token}"}

PLACEHOLDER_SUMMARY = "一句话介绍：在 AI 导师引导下完成的 我想做一个项目 项目"
PLACEHOLDER_REFLECTION = "通过这个项目学习了完整的项目开发方法论，包括阶段化推进、AI 辅助编程和迭代验证。"
PLACEHOLDER_NEXT = "项目已完成全部阶段。建议回顾各阶段的学习记录，规划下一个更有挑战的项目。"

REAL_EVALUATE_CONTENT = """# 项目验收文档

## 验收总结

### 项目概览
运动小管家是一个基于 Streamlit 的运动记录应用。

### 完成功能清单
- 运动打卡记录
- 数据统计图表

## 学习反思
学会了用 Streamlit 快速搭建数据应用，理解了状态管理。

## 下一轮迭代
接入运动手环数据，增加自动同步。
"""


def make_project(name: str, evaluate_content: str) -> str:
    resp = client.post("/api/v1/projects", json={
        "name": name, "mode": "standard", "description": "Q-037 验证",
    }, headers=headers)
    assert resp.status_code == 200, resp.text
    pid = resp.json()["data"]["id"]
    state = db.get_skill_state(pid)
    db.update_skill_state(pid, {
        "current_stage": "stage_08_evaluate",
        "standard_step_data": {
            "step8": {
                "schema_version": "2.0.0",
                "payload": {
                    "acceptance_summary": PLACEHOLDER_SUMMARY,
                    "reflection": PLACEHOLDER_REFLECTION,
                    "next_iteration": PLACEHOLDER_NEXT,
                },
            },
            "evaluate_content": evaluate_content,
        },
        "stage_history": state.stage_history + [
            {"stage": "stage_08_evaluate", "started_at": "2026-07-31T00:00:00Z"},
        ],
    })
    return pid


# ---- 场景一：占位 payload + 真实 evaluate_content（含 ### 子标题）----
pid1 = make_project("Q037运动小管家复现", REAL_EVALUATE_CONTENT)
resp = client.get(f"/api/v1/projects/{pid1}/progress", headers=headers)
assert resp.status_code == 200, resp.text
data = resp.json()["data"]["standard_step_data"]
payload = data["step8"]["payload"]
print("场景一 acceptance_summary =", repr(payload["acceptance_summary"][:40]))
print("场景一 reflection         =", repr(payload["reflection"][:40]))
print("场景一 next_iteration     =", repr(payload["next_iteration"][:40]))

assert "我想做一个项目" not in payload["acceptance_summary"], "占位模板未被替换"
assert "运动小管家" in payload["acceptance_summary"], "验收总结未取自 evaluate_content"
assert "### 项目概览" in payload["acceptance_summary"], "子标题应保留为章节内容（解析器层级化）"
assert "Streamlit" in payload["reflection"], "学习反思未取自 evaluate_content"
assert "运动手环" in payload["next_iteration"], "下一轮迭代未取自 evaluate_content"
assert data["evaluate_content"] == REAL_EVALUATE_CONTENT, "evaluate_content 被回滚（违反 Q-027）"

# 落库自愈确认：直接读 DB
state1 = db.get_skill_state(pid1)
db_payload = (state1.standard_step_data or {}).get("step8", {}).get("payload", {})
assert "运动小管家" in db_payload.get("acceptance_summary", ""), "水合结果未落库"
print("场景一 落库自愈: OK")

# ---- 场景二：payload 与 evaluate_content 均为占位（无真实来源）----
placeholder_doc = (
    f"## 验收总结\n{PLACEHOLDER_SUMMARY}\n\n"
    f"## 学习反思\n{PLACEHOLDER_REFLECTION}\n\n"
    f"## 下一轮迭代\n{PLACEHOLDER_NEXT}"
)
pid2 = make_project("Q037纯占位项目", placeholder_doc)
resp2 = client.get(f"/api/v1/projects/{pid2}/progress", headers=headers)
assert resp2.status_code == 200, resp2.text
payload2 = resp2.json()["data"]["standard_step_data"]["step8"]["payload"]
print("场景二 acceptance_summary =", repr(payload2["acceptance_summary"][:40]))
assert payload2["acceptance_summary"], "纯占位项目退化为空白表单"
assert payload2["reflection"] and payload2["next_iteration"], "纯占位项目字段被清空"
print("场景二 占位兜底: OK")

# 清理
client.delete(f"/api/v1/projects/{pid1}", headers=headers)
client.delete(f"/api/v1/projects/{pid2}", headers=headers)
print("OK: Q-037 全链路验证通过")
