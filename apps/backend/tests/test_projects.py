"""
研学项目模块 API 集成测试

用途：项目 CRUD、轻项目步骤、标准项目、升级、推进、导出
维护者：AI Agent
links: .trae/documents/testing/
"""

from fastapi.testclient import TestClient
import pytest
import asyncio
import io
import json
import zipfile
from pathlib import Path
from app.core.config import settings
from app.schemas.agent import AgentChatRequest
from app.services.orchestrator import AgentOrchestratorService
from app.services.pbl_engine import ARTIFACT_TO_FILENAME


class TestProjectCreate:
    def test_create_light_project(self, client: TestClient, auth_headers: dict, seeded_demo_id: str):
        resp = client.post("/api/v1/projects", json={
            "name": "我的轻项目",
            "mode": "light",
            "from_demo_id": seeded_demo_id,
        }, headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["name"] == "我的轻项目"
        assert body["data"]["mode"] == "light"
        assert body["data"]["from_demo_id"] == seeded_demo_id

    def test_create_standard_project(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/projects", json={
            "name": "标准研学项目",
            "mode": "standard",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["mode"] == "standard"

    def test_create_project_unauthenticated(self, client: TestClient):
        resp = client.post("/api/v1/projects", json={
            "name": "未授权项目",
            "mode": "light",
        })
        assert resp.status_code == 401


class TestProjectList:
    def test_list_projects(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get("/api/v1/projects", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["total"] >= 1

    def test_list_projects_filter_mode(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get("/api/v1/projects?mode=light", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json()["data"]["items"]
        assert all(p["mode"] == "light" for p in items)

    def test_list_projects_pagination(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get("/api/v1/projects?page=1&page_size=5", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["page"] == 1
        assert body["data"]["page_size"] == 5

    def test_list_projects_empty_for_new_user(self, client: TestClient, second_auth_headers: dict):
        resp = client.get("/api/v1/projects", headers=second_auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["total"] == 0


class TestProjectDetail:
    def test_get_project(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == created_project["id"]

    def test_get_project_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/projects/nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    def test_get_project_forbidden(self, client: TestClient, second_auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}", headers=second_auth_headers)
        assert resp.status_code == 403


class TestProjectUpdate:
    def test_update_project_name(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.patch(f"/api/v1/projects/{created_project['id']}", json={
            "name": "更新后的项目名",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "更新后的项目名"

    def test_update_teaching_mode(self, client: TestClient, auth_headers: dict):
        create_resp = client.post("/api/v1/projects", json={
            "name": "教学模式项目",
            "mode": "standard",
        }, headers=auth_headers)
        project_id = create_resp.json()["data"]["id"]

        resp = client.post(
            f"/api/v1/projects/{project_id}/teaching-mode",
            json={"teaching_mode": "lecture"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["teaching_mode"] == "lecture"

        workspace_resp = client.get(f"/api/v1/projects/{project_id}/workspace", headers=auth_headers)
        assert workspace_resp.status_code == 200
        assert workspace_resp.json()["data"]["progress"]["teaching_mode"] == "lecture"


class TestProjectDelete:
    def test_delete_project(self, client: TestClient, auth_headers: dict, seeded_demo_id: str):
        resp = client.post("/api/v1/projects", json={
            "name": "待删除项目",
            "mode": "light",
        }, headers=auth_headers)
        project_id = resp.json()["data"]["id"]

        del_resp = client.delete(f"/api/v1/projects/{project_id}", headers=auth_headers)
        assert del_resp.status_code == 200

        get_resp = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    def test_delete_project_forbidden(self, client: TestClient, second_auth_headers: dict, created_project: dict):
        resp = client.delete(f"/api/v1/projects/{created_project['id']}", headers=second_auth_headers)
        assert resp.status_code == 403


class TestProjectProgress:
    def test_get_progress(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/progress", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "current_stage" in body["data"]
        assert "light_step_data" in body["data"]


class TestLightProjectSteps:
    def test_save_step1(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/projects/{created_project['id']}/progress/light/step1",
            json={"project_name": "测试项目", "one_liner": "一句话介绍", "core_features": ["功能1", "功能2"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert "current_stage" in resp.json()["data"]

    def test_save_step2(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/projects/{created_project['id']}/progress/light/step2",
            json={"code_url": "https://github.com/example/code", "key_screenshots": ["s1.png"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_save_step3(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(
            f"/api/v1/projects/{created_project['id']}/progress/light/step3",
            json={"brief_reflection": "学到了很多"},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_save_step_wrong_mode(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/projects", json={"name": "标准项目", "mode": "standard"}, headers=auth_headers)
        pid = resp.json()["data"]["id"]
        step_resp = client.post(
            f"/api/v1/projects/{pid}/progress/light/step1",
            json={"project_name": "测试", "one_liner": "描述", "core_features": []},
            headers=auth_headers,
        )
        assert step_resp.status_code == 400


class TestStandardProjectSteps:
    def test_save_standard_step(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/projects", json={"name": "标准项目", "mode": "standard"}, headers=auth_headers)
        pid = resp.json()["data"]["id"]

        step_resp = client.post(
            f"/api/v1/projects/{pid}/progress/standard/1",
            json={"payload": {"topic": "AI 诗词"}, "notes": "脑爆记录"},
            headers=auth_headers,
        )
        assert step_resp.status_code == 200

    def test_save_standard_step_wrong_mode(self, client: TestClient, auth_headers: dict, created_project: dict):
        step_resp = client.post(
            f"/api/v1/projects/{created_project['id']}/progress/standard/1",
            json={"payload": {}, "notes": "错误"},
            headers=auth_headers,
        )
        assert step_resp.status_code == 400


class TestProjectUpgrade:
    def test_upgrade_light_to_standard(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(f"/api/v1/projects/{created_project['id']}/upgrade", json={"confirm_upgrade": True}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["mode"] == "standard"

    def test_upgrade_standard_project_fails(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/v1/projects", json={"name": "已是标准", "mode": "standard"}, headers=auth_headers)
        pid = resp.json()["data"]["id"]
        upgrade_resp = client.post(f"/api/v1/projects/{pid}/upgrade", json={"confirm_upgrade": True}, headers=auth_headers)
        assert upgrade_resp.status_code == 400


class TestProjectAdvance:
    def test_advance_stage(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.post(f"/api/v1/projects/{created_project['id']}/advance", headers=auth_headers)
        assert resp.status_code == 200
        assert "current_stage" in resp.json()["data"]


class TestProjectExport:
    def test_export_md(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/export?format=md", headers=auth_headers)
        assert resp.status_code == 200

    def test_export_json(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/export?format=json", headers=auth_headers)
        assert resp.status_code == 200

    def test_export_zip(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/export?format=zip", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.headers.get("content-type") == "application/zip"

    def test_export_zip_contains_code_and_documents(self, client: TestClient, auth_headers: dict):
        create_resp = client.post(
            "/api/v1/projects",
            json={"name": "ZIP 完整资料包测试", "mode": "standard"},
            headers=auth_headers,
        )
        assert create_resp.status_code == 200
        project_id = create_resp.json()["data"]["id"]
        code_marker = "zip-package-code-marker"

        code_resp = client.post(
            f"/api/v1/projects/{project_id}/code",
            json={"code": f"<h1>{code_marker}</h1>", "language": "html", "filename": "src/index.html"},
            headers=auth_headers,
        )
        assert code_resp.status_code == 200

        chat_resp = client.post(
            f"/api/v1/projects/{project_id}/chat",
            json={"messages": [{"role": "assistant", "content": "报告在 `docs/reports/final.md`"}]},
            headers=auth_headers,
        )
        assert chat_resp.status_code == 200

        resp = client.get(f"/api/v1/projects/{project_id}/export?format=zip", headers=auth_headers)
        assert resp.status_code == 200

        # 验证文件名包含项目名
        cd = resp.headers.get("content-disposition", "")
        assert "ZIP 完整资料包测试" in cd or "filename*=UTF-8" in cd

        with zipfile.ZipFile(io.BytesIO(resp.content)) as package:
            names = set(package.namelist())
            assert "manifest.json" in names
            assert "README.md" in names
            assert "index.html" in names
            assert ".gitignore" in names
            assert "src/index.html" in names
            assert "docs/chat_messages.json" in names
            assert any(name.startswith("docs/final/") and name.endswith(".md") for name in names)
            assert any(name.startswith("docs/technical/") and name.endswith(".docx") for name in names)
            assert code_marker in package.read("src/index.html").decode("utf-8")

            # 验证 README.md 内容
            readme = package.read("README.md").decode("utf-8")
            assert "ZIP 完整资料包测试" in readme
            assert "fineSTEM" in readme
            assert "IDE" in readme

            # 验证 index.html 内容
            index_html = package.read("index.html").decode("utf-8")
            assert "ZIP 完整资料包测试" in index_html
            assert "fineSTEM" in index_html
            assert "资料包" in index_html
            assert "IDE 就绪" in index_html

            # 验证 .gitignore 内容
            gitignore = package.read(".gitignore").decode("utf-8")
            assert "node_modules" in gitignore
            assert "__pycache__" in gitignore

    def test_export_pdf(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/export?format=pdf", headers=auth_headers)
        assert resp.status_code == 200

    def test_export_docx(self, client: TestClient, auth_headers: dict, created_project: dict):
        resp = client.get(f"/api/v1/projects/{created_project['id']}/export?format=docx", headers=auth_headers)
        assert resp.status_code == 200


class TestTeachingModePrompt:
    @pytest.mark.parametrize(
        ("teaching_mode", "headline", "keyword"),
        [
            ("guided", "当前教学模式：guided（引导式）", "先做什么 → 学生自己补哪一块"),
            ("demo", "当前教学模式：demo（演示式）", "完整示例 → 模块拆解"),
            ("hands_on", "当前教学模式：hands_on（动手式）", "本轮任务 → 验证标准"),
            ("lecture", "当前教学模式：lecture（讲解式）", "先讲清原理、概念、结构和为什么这样设计"),
        ],
    )
    def test_build_system_prompt_contains_teaching_mode_instruction(
        self,
        client: TestClient,
        auth_headers: dict,
        teaching_mode: str,
        headline: str,
        keyword: str,
    ):
        create_resp = client.post("/api/v1/projects", json={
            "name": "讲解模式项目",
            "mode": "standard",
        }, headers=auth_headers)
        project_id = create_resp.json()["data"]["id"]
        client.post(
            f"/api/v1/projects/{project_id}/teaching-mode",
            json={"teaching_mode": teaching_mode},
            headers=auth_headers,
        )

        req = AgentChatRequest(
            message="请继续帮我完成这个项目",
            project_id=project_id,
            context={"current_stage": "stage_07_execute", "teaching_mode": teaching_mode},
        )
        orchestrator = AgentOrchestratorService()
        prompt = orchestrator._build_system_prompt(req, None, None)

        assert headline in prompt
        assert keyword in prompt


class TestTeachingModeBlackBoxBehavior:
    @pytest.mark.parametrize(
        ("teaching_mode", "expected_keyword", "forbidden_keyword"),
        [
            ("guided", "下一步你先补", "完整可运行示例"),
            ("demo", "完整可运行示例", "先自己尝试完成"),
            ("hands_on", "先自己尝试完成", "先讲清原理"),
            ("lecture", "先讲清原理", "下一步你先补"),
        ],
    )
    def test_chat_response_shape_changes_with_teaching_mode(
        self,
        monkeypatch: pytest.MonkeyPatch,
        teaching_mode: str,
        expected_keyword: str,
        forbidden_keyword: str,
    ):
        async def fake_call_llm_with_tools(self, messages, available_tools, owner_id):
            system_content = messages[0]["content"]
            if "当前教学模式：guided（引导式）" in system_content:
                return (
                    "第一步：先把页面标题和输入框搭起来。\n第二步：把按钮点击事件接上。\n下一步你先补提交按钮的处理函数。",
                    [],
                    "fake-model",
                )
            if "当前教学模式：demo（演示式）" in system_content:
                return (
                    "下面先给你一个完整可运行示例：\n```html\n<h1>学生成绩管理</h1>\n```\n然后我再拆给你看每一块怎么改。",
                    [],
                    "fake-model",
                )
            if "当前教学模式：hands_on（动手式）" in system_content:
                return (
                    "本轮小任务：请你先自己尝试完成成绩表格的表头。\n验证标准：页面里要出现姓名、语文、数学三列。\n如果你卡住，我再给你关键代码。",
                    [],
                    "fake-model",
                )
            if "当前教学模式：lecture（讲解式）" in system_content:
                return (
                    "先讲清原理：这个页面本质上是数据输入、状态存储和结果渲染三层结构。\n接着再看为什么先拆表单，再拆列表，最后才接事件。",
                    [],
                    "fake-model",
                )
            return ("默认响应", [], "fake-model")

        monkeypatch.setattr(
            AgentOrchestratorService,
            "_call_llm_with_tools",
            fake_call_llm_with_tools,
        )

        orchestrator = AgentOrchestratorService()
        req = AgentChatRequest(
            message="继续教我完成这个网页项目",
            context={
                "current_stage": "stage_07_execute",
                "teaching_mode": teaching_mode,
                "preferred_output_language": "html",
            },
        )

        response = asyncio.run(orchestrator.chat("test-owner", req))

        assert expected_keyword in response.content
        assert forbidden_keyword not in response.content
        assert response.model == "fake-model"


# =============================================================================
# PBL 闭环全链路 API 集成测试（确定性，不碰 LLM）
# =============================================================================

# 逐阶段工件样本（固定文本，用于确定性推进）
_PBL_STAGE_ARTIFACTS = [
    ("stage_01_brainstorm", "brainstorm", "# 脑爆选题\nAI 辅助古诗词创作"),
    ("stage_02_brief", "project_brief", "# 项目简介\n做一个 AI 诗词工具"),
    ("stage_03_constraints", "constraints", "# 约束条件\nPython + React，2 周"),
    ("stage_04_track", "track_plan", "# 轨道选择\nWeb 应用轨道"),
    ("stage_05_design", "design", "# 设计蓝图\n前端 React + 后端 FastAPI"),
    ("stage_06_step_plan", "step_plan", "# 分步计划\nStep1 脚手架 Step2 API"),
    ("stage_07_execute", "dev_log", "# 开发日志\nDay1 初始化 Day2 API"),
    ("stage_08_evaluate", "evaluate", "# 验收总结\n核心功能完成"),
]


class TestPBLFullLoop:
    """PBL 闭环全链路 API 集成测试——走完整 HTTP 层，验证工件落盘与 workspace 恢复。"""

    def test_complete_stage_endpoint_drives_full_loop(
        self, client: TestClient, auth_headers: dict
    ):
        """用 /pbl/complete-stage 端点逐阶段推完整条 PBL 链，并断言 docs 文件落盘。"""
        # 1. 创建标准项目
        create_resp = client.post(
            "/api/v1/projects",
            json={"name": "PBL 全链路集成测试", "mode": "standard"},
            headers=auth_headers,
        )
        assert create_resp.status_code == 200
        project = create_resp.json()["data"]
        project_id = project["id"]
        project_name = project["name"]

        # 2. 逐阶段推进
        for stage, artifact_name, content in _PBL_STAGE_ARTIFACTS:
            resp = client.post(
                f"/api/v1/projects/{project_id}/pbl/complete-stage",
                json={"stage": stage, "artifacts": {artifact_name: content}},
                headers=auth_headers,
            )
            assert resp.status_code == 200, f"阶段 {stage} 推进失败: {resp.text}"

        # 3. 断言终态
        progress = client.get(
            f"/api/v1/projects/{project_id}/progress", headers=auth_headers
        )
        assert progress.status_code == 200
        assert progress.json()["data"]["current_stage"] == "stage_08_evaluate"

        # 4. 断言每个 docs 文件落盘到 projects/{slug}/docs/
        slug = project_name.lower().replace(" ", "-")
        docs_dir = Path(settings.STORAGE_BASE_PATH) / "projects" / slug / "docs"
        for _stage, artifact_name, content in _PBL_STAGE_ARTIFACTS:
            filename = ARTIFACT_TO_FILENAME.get(artifact_name)
            assert filename is not None
            file_path = docs_dir / filename
            assert file_path.exists(), f"工件文件 {file_path} 未落盘"
            written = file_path.read_text(encoding="utf-8")
            assert content in written, f"工件 {artifact_name} 落盘内容不匹配"

    def test_workspace_restores_pbl_artifacts(
        self, client: TestClient, auth_headers: dict
    ):
        """推进到 stage_08 后，/workspace 恢复 standard_step_data 数据完整。"""
        # 1. 创建项目并推到 stage_08
        create_resp = client.post(
            "/api/v1/projects",
            json={"name": "Workspace 恢复测试", "mode": "standard"},
            headers=auth_headers,
        )
        project_id = create_resp.json()["data"]["id"]

        for stage, artifact_name, content in _PBL_STAGE_ARTIFACTS:
            client.post(
                f"/api/v1/projects/{project_id}/pbl/complete-stage",
                json={"stage": stage, "artifacts": {artifact_name: content}},
                headers=auth_headers,
            )

        # 2. 调 /workspace 恢复
        ws_resp = client.get(
            f"/api/v1/projects/{project_id}/workspace", headers=auth_headers
        )
        assert ws_resp.status_code == 200
        ws_data = ws_resp.json()["data"]

        # 3. 断言 progress.current_stage 正确
        assert ws_data["progress"]["current_stage"] == "stage_08_evaluate"

        # 4. 断言 standard_step_data 包含所有工件 blob
        sd = ws_data["progress"]["standard_step_data"]
        if isinstance(sd, str):
            sd = json.loads(sd)

        expected_blobs = [
            "brainstorm_content",
            "brief_content",
            "constraints_content",
            "track_plan_content",
            "design_content",
            "step_plan_content",
            "dev_log_content",
            "evaluate_content",
        ]
        for blob_key in expected_blobs:
            assert blob_key in sd, f"standard_step_data 缺少 {blob_key}"
            assert sd[blob_key], f"{blob_key} 内容为空"

    def test_advance_returns_422_with_missing_requirements(
        self, client: TestClient, auth_headers: dict
    ):
        """不写入工件直接 /advance 时返回 422 + missing_requirements 详情。"""
        create_resp = client.post(
            "/api/v1/projects",
            json={"name": "门禁 422 测试", "mode": "standard"},
            headers=auth_headers,
        )
        project_id = create_resp.json()["data"]["id"]

        resp = client.post(
            f"/api/v1/projects/{project_id}/advance", headers=auth_headers
        )
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert "missing_requirements" in detail
        assert isinstance(detail["missing_requirements"], list)
        assert len(detail["missing_requirements"]) > 0
