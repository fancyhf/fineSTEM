"""
核心用户流程端到端集成测试

用途：验证 Demo→Fork→轻项目→成果卡→分享 完整闭环
维护者：AI Agent
links: .trae/documents/testing/
"""

from fastapi.testclient import TestClient


class TestFullUserJourney:
    """
    验证 V3.3 核心闭环：
    Demo 墙 -> Demo 详情 -> "我也做一个" Fork -> 轻项目 3 步 -> 成果档案卡 -> 分享链接
    """

    def test_complete_light_project_journey(self, client: TestClient, seeded_demo_with_breakdown_id: str):
        # Step 1: 注册用户
        register_resp = client.post("/api/v1/auth/register", json={
            "name": "完整流程测试学生",
            "email": "journey_test@finestem.test",
            "password": "JourneyPass123!",
        })
        assert register_resp.status_code == 200
        token = register_resp.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Step 2: 浏览 Demo 墙
        demos_resp = client.get("/api/v1/demos")
        assert demos_resp.status_code == 200
        demos = demos_resp.json()["data"]["items"]
        assert len(demos) >= 1

        # Step 3: 查看 Demo 详情
        demo_id = seeded_demo_with_breakdown_id
        detail_resp = client.get(f"/api/v1/demos/{demo_id}")
        assert detail_resp.status_code == 200
        assert detail_resp.json()["data"]["name"]

        # Step 4: 查看 Demo 拆解
        breakdown_resp = client.get(f"/api/v1/demos/{demo_id}/breakdown")
        assert breakdown_resp.status_code == 200

        # Step 5: 获取 Fork 模板
        fork_resp = client.get(f"/api/v1/demos/{demo_id}/fork-template")
        assert fork_resp.status_code == 200
        fork_data = fork_resp.json()["data"]
        assert "suggestions" in fork_data
        assert len(fork_data["suggestions"]) == 3

        # Step 6: "我也做一个" - 创建项目
        project_resp = client.post("/api/v1/projects", json={
            "name": "我的第一个 AI 项目",
            "mode": "light",
            "from_demo_id": demo_id,
        }, headers=headers)
        assert project_resp.status_code == 200
        project = project_resp.json()["data"]
        project_id = project["id"]
        assert project["mode"] == "light"

        # Step 7: 轻项目 Step 1 - 想法与方向
        step1_resp = client.post(
            f"/api/v1/projects/{project_id}/progress/light/step1",
            json={
                "project_name": "我的诗词助手",
                "one_liner": "一个帮助写诗的 AI 工具",
                "core_features": ["生成诗词", "选择风格", "保存作品"],
            },
            headers=headers,
        )
        assert step1_resp.status_code == 200

        # Step 8: 轻项目 Step 2 - 设计与实现
        step2_resp = client.post(
            f"/api/v1/projects/{project_id}/progress/light/step2",
            json={
                "code_url": "https://github.com/example/poetry",
                "key_screenshots": ["screenshot_step2.png"],
            },
            headers=headers,
        )
        assert step2_resp.status_code == 200

        # Step 9: 轻项目 Step 3 - 展示与反思
        step3_resp = client.post(
            f"/api/v1/projects/{project_id}/progress/light/step3",
            json={
                "brief_reflection": "学会了如何使用 AI 生成诗词，理解了 prompt 设计的重要性",
            },
            headers=headers,
        )
        assert step3_resp.status_code == 200

        # Step 10: 添加证据
        evidence_resp = client.post(
            f"/api/v1/evidence/projects/{project_id}",
            json={
                "project_id": project_id,
                "type": "text_log",
                "title": "核心代码截图",
                "content": "generatePoem 函数实现截图",
                "related_step": "light_step_2",
            },
            headers=headers,
        )
        assert evidence_resp.status_code == 200

        # Step 11: 自动采集证据
        auto_evidence_resp = client.post(
            f"/api/v1/evidence/projects/{project_id}/auto-collect",
            json={
                "type": "auto_stage_change",
                "source": "system",
                "content": "轻项目 3 步全部完成",
                "related_step": "light_step_3",
            },
            headers=headers,
        )
        assert auto_evidence_resp.status_code == 200

        # Step 12: 创建成果档案卡
        card_resp = client.post(
            f"/api/v1/achievement-cards/projects/{project_id}",
            json={
                "title": "我的诗词助手",
                "one_liner": "一个帮助写诗的 AI 工具",
                "problem_solved": "不知道怎么写诗的问题",
                "method_used": "使用 AI 对话和 prompt 工程",
                "screenshots": ["final_screenshot.png"],
                "reflection": "学会了 prompt 设计和 AI 应用开发",
                "capability_tags": ["AI应用", "编程"],
                "project_mode": "light",
            },
            headers=headers,
        )
        assert card_resp.status_code == 200
        card_id = card_resp.json()["data"]["id"]

        # Step 13: 生成分享链接
        share_resp = client.post(f"/api/v1/achievement-cards/{card_id}/share", headers=headers)
        assert share_resp.status_code == 200
        share_token = share_resp.json()["data"]["share_token"]

        # Step 14: 匿名访问分享链接
        public_resp = client.get(f"/api/v1/achievement-cards/share/{share_token}")
        assert public_resp.status_code == 200
        assert public_resp.json()["data"]["title"] == "我的诗词助手"

        # Step 15: 发布到灵感墙
        submit_resp = client.post(
            f"/api/v1/achievement-cards/{card_id}/submit-public",
            json={"submit_public": True},
            headers=headers,
        )
        assert submit_resp.status_code == 200
        assert submit_resp.json()["data"]["is_public"] is True

        # Step 16: 灵感墙可见
        wall_resp = client.get("/api/v1/achievement-cards/inspiration-wall")
        assert wall_resp.status_code == 200
        assert wall_resp.json()["data"]["total"] >= 1

        # Step 17: 获取下一步推荐
        rec_resp = client.get(f"/api/v1/achievement-cards/{card_id}/recommendations", headers=headers)
        assert rec_resp.status_code == 200
        assert isinstance(rec_resp.json()["data"], list)

        # Step 18: 导出项目
        export_resp = client.get(f"/api/v1/projects/{project_id}/export?format=zip", headers=headers)
        assert export_resp.status_code == 200

        # Step 19: 查看项目进度
        progress_resp = client.get(f"/api/v1/projects/{project_id}/progress", headers=headers)
        assert progress_resp.status_code == 200

        # Step 20: 验证证据列表
        evidence_list_resp = client.get(
            f"/api/v1/evidence/projects/{project_id}",
            headers=headers,
        )
        assert evidence_list_resp.status_code == 200
        assert evidence_list_resp.json()["data"]["total"] >= 2

    def test_light_to_standard_upgrade_journey(self, client: TestClient, seeded_demo_id: str):
        # 注册
        register_resp = client.post("/api/v1/auth/register", json={
            "name": "升级流程学生",
            "email": "upgrade_test@finestem.test",
            "password": "UpgradePass123!",
        })
        token = register_resp.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 创建轻项目
        project_resp = client.post("/api/v1/projects", json={
            "name": "待升级项目",
            "mode": "light",
            "from_demo_id": seeded_demo_id,
        }, headers=headers)
        project_id = project_resp.json()["data"]["id"]

        # 完成轻项目步骤
        client.post(f"/api/v1/projects/{project_id}/progress/light/step1",
                     json={"project_name": "项目", "one_liner": "描述", "core_features": ["功能1"]},
                     headers=headers)
        client.post(f"/api/v1/projects/{project_id}/progress/light/step2",
                     json={"code_url": "https://example.com", "key_screenshots": []},
                     headers=headers)
        client.post(f"/api/v1/projects/{project_id}/progress/light/step3",
                     json={"brief_reflection": "反思"},
                     headers=headers)

        # 升级为标准项目
        upgrade_resp = client.post(f"/api/v1/projects/{project_id}/upgrade", json={"confirm_upgrade": True}, headers=headers)
        assert upgrade_resp.status_code == 200
        assert upgrade_resp.json()["data"]["mode"] == "standard"

        # 保存标准项目步骤
        step_resp = client.post(
            f"/api/v1/projects/{project_id}/progress/standard/1",
            json={"payload": {"topic": "深化研究"}, "notes": "标准项目脑爆"},
            headers=headers,
        )
        assert step_resp.status_code == 200

        # 推进阶段
        advance_resp = client.post(f"/api/v1/projects/{project_id}/advance", headers=headers)
        assert advance_resp.status_code == 200

    def test_cross_user_isolation(self, client: TestClient, seeded_demo_id: str):
        # 用户 A 注册
        resp_a = client.post("/api/v1/auth/register", json={
            "name": "用户A",
            "email": "user_a@finestem.test",
            "password": "PassA123!",
        })
        headers_a = {"Authorization": f"Bearer {resp_a.json()['data']['access_token']}"}

        # 用户 B 注册
        resp_b = client.post("/api/v1/auth/register", json={
            "name": "用户B",
            "email": "user_b@finestem.test",
            "password": "PassB123!",
        })
        headers_b = {"Authorization": f"Bearer {resp_b.json()['data']['access_token']}"}

        # 用户 A 创建项目
        proj_resp = client.post("/api/v1/projects", json={
            "name": "A 的项目",
            "mode": "light",
        }, headers=headers_a)
        project_id = proj_resp.json()["data"]["id"]

        # 用户 B 无法访问用户 A 的项目
        get_resp = client.get(f"/api/v1/projects/{project_id}", headers=headers_b)
        assert get_resp.status_code == 403

        # 用户 A 的项目列表只有自己的项目
        list_a = client.get("/api/v1/projects", headers=headers_a)
        assert list_a.json()["data"]["total"] >= 1

        # 用户 B 的项目列表为空
        list_b = client.get("/api/v1/projects", headers=headers_b)
        assert list_b.json()["data"]["total"] == 0
