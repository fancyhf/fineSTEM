"""通过 API 创建测试项目并推进到已完成阶段"""
import requests
import json
import time

BASE_URL = "http://localhost:3200/api/v1"

# 登录 (OAuth2 表单格式)
login_resp = requests.post(f"{BASE_URL}/auth/login", data={
    "username": "testuser@finestem.dev",
    "password": "testpass123"
})
login_data = login_resp.json()
token = login_data.get("data", {}).get("access_token")
if not token:
    print("登录失败:", login_data)
    exit(1)

headers = {"Authorization": f"Bearer {token}"}
print("登录成功")

# 创建项目
create_resp = requests.post(f"{BASE_URL}/projects", json={
    "name": "测试已完成无成果卡项目",
    "description": "这是一个已完成但没有成果档案卡的测试项目",
    "mode": "standard"
}, headers=headers)
project_data = create_resp.json()
project_id = project_data.get("data", {}).get("id")
print(f"创建项目成功: {project_id}")

# 获取当前进度
progress_resp = requests.get(f"{BASE_URL}/projects/{project_id}/progress", headers=headers)
progress = progress_resp.json().get("data", {})
print(f"当前阶段: {progress.get('current_stage')}")

# 推进到最后一个阶段
stages = [
    "stage_00_bootstrap", "stage_01_brainstorm", "stage_02_brief",
    "stage_03_constraints", "stage_04_track", "stage_05_design",
    "stage_06_step_plan", "stage_07_execute", "stage_08_evaluate"
]

for stage in stages:
    # 保存阶段数据
    save_resp = requests.post(f"{BASE_URL}/projects/{project_id}/stages/{stage}", json={
        "data": {"test": True}
    }, headers=headers)
    print(f"  保存 {stage}: {save_resp.status_code}")

    # 推进到下一阶段
    advance_resp = requests.post(f"{BASE_URL}/projects/{project_id}/advance", headers=headers)
    advance_data = advance_resp.json()
    print(f"  推进: {advance_resp.status_code} -> {advance_data.get('data', {}).get('current_stage')}")

# 检查最终阶段
progress_resp = requests.get(f"{BASE_URL}/projects/{project_id}/progress", headers=headers)
final_stage = progress_resp.json().get("data", {}).get("current_stage")
print(f"\n最终阶段: {final_stage}")

# 检查是否有 achievement
ach_resp = requests.get(f"{BASE_URL}/achievement-cards/projects/{project_id}", headers=headers)
ach_data = ach_resp.json()
print(f"成果卡: {ach_data}")

print(f"\n项目ID: {project_id}")
