"""
PBL 确定性推进引擎——单元测试 + 集成测试

用途：验证 pbl_engine.py 的门禁校验、带门禁推进、工件落盘逻辑。
完全不碰 LLM，纯确定性、可秒级复现。

维护者：AI Agent
links: .trae/documents/testing/
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.services.pbl_engine import (
    ARTIFACT_FOR_STAGE,
    ARTIFACT_TO_BLOB_KEY,
    ARTIFACT_TO_FILENAME,
    advance_with_gate,
    check_gate,
    save_artifact,
    save_artifact_to_disk,
)


# ── 阶段→工件 参数化数据 ─────────────────────────────────────────
# 排除 stage_00_bootstrap（无工件），用于 pass/fail 参数化
STAGES_WITH_ARTIFACTS = [
    ("stage_01_brainstorm", "brainstorm_content", "brainstorm"),
    ("stage_02_brief", "brief_content", "project_brief"),
    ("stage_03_constraints", "constraints_content", "constraints"),
    ("stage_04_track", "track_plan_content", "track_plan"),
    ("stage_05_design", "design_content", "design"),
    ("stage_06_step_plan", "step_plan_content", "step_plan"),
    ("stage_07_execute", "dev_log_content", "dev_log"),
    ("stage_08_evaluate", "evaluate_content", "evaluate"),
]


# =============================================================================
# TestPBLGates：门禁校验单元测试（纯函数，不碰 DB/LLM）
# =============================================================================

class TestPBLGates:
    """门禁校验单元测试——直接调用 check_gate，不经过 DB 或 HTTP。"""

    def test_bootstrap_always_passes_with_empty_data(self):
        """stage_00_bootstrap 始终通过，即使 standard_step_data 为空 dict。"""
        passed, missing = check_gate("stage_00_bootstrap", {})
        assert passed is True
        assert missing == []

    def test_bootstrap_always_passes_with_none(self):
        """stage_00_bootstrap 始终通过，即使 standard_step_data 为 None。"""
        passed, missing = check_gate("stage_00_bootstrap", None)
        assert passed is True
        assert missing == []

    def test_bootstrap_passes_even_with_data(self):
        """stage_00_bootstrap 有数据时也通过（初始化阶段无工件要求）。"""
        passed, missing = check_gate("stage_00_bootstrap", {"brainstorm_content": "xxx"})
        assert passed is True

    @pytest.mark.parametrize(
        ("stage", "blob_key", "artifact_name"),
        STAGES_WITH_ARTIFACTS,
        ids=[s[0] for s in STAGES_WITH_ARTIFACTS],
    )
    def test_gate_passes_with_content(self, stage: str, blob_key: str, artifact_name: str):
        """工件存在且非空时门禁通过。"""
        data = {blob_key: f"这是 {artifact_name} 的示例内容。"}
        passed, missing = check_gate(stage, data)
        assert passed is True
        assert missing == []

    @pytest.mark.parametrize(
        ("stage", "blob_key", "artifact_name"),
        STAGES_WITH_ARTIFACTS,
        ids=[s[0] for s in STAGES_WITH_ARTIFACTS],
    )
    def test_gate_fails_when_artifact_missing(self, stage: str, blob_key: str, artifact_name: str):
        """工件 key 不存在时门禁不通过。"""
        passed, missing = check_gate(stage, {})
        assert passed is False
        assert len(missing) == 1
        assert blob_key in missing[0] or artifact_name in missing[0]

    @pytest.mark.parametrize(
        ("stage", "blob_key"),
        [(s[0], s[1]) for s in STAGES_WITH_ARTIFACTS],
        ids=[s[0] for s in STAGES_WITH_ARTIFACTS],
    )
    def test_gate_fails_when_artifact_empty(self, stage: str, blob_key: str):
        """工件值为空字符串时门禁不通过。"""
        passed, missing = check_gate(stage, {blob_key: ""})
        assert passed is False
        assert len(missing) == 1

    @pytest.mark.parametrize(
        ("stage", "blob_key"),
        [(s[0], s[1]) for s in STAGES_WITH_ARTIFACTS],
        ids=[s[0] for s in STAGES_WITH_ARTIFACTS],
    )
    def test_gate_fails_when_artifact_whitespace(self, stage: str, blob_key: str):
        """工件值只有空白字符时门禁不通过。"""
        passed, missing = check_gate(stage, {blob_key: "   \n\t  "})
        assert passed is False

    def test_gate_accepts_json_string_input(self):
        """standard_step_data 为 JSON 字符串时也能正确解析。"""
        data_str = json.dumps({"brainstorm_content": "脑爆内容"})
        passed, missing = check_gate("stage_01_brainstorm", data_str)
        assert passed is True
        assert missing == []

    def test_gate_fails_on_invalid_json_string(self):
        """standard_step_data 为无效 JSON 字符串时按空 dict 处理，门禁不通过。"""
        passed, missing = check_gate("stage_01_brainstorm", "not-valid-json{")
        assert passed is False

    def test_unknown_stage_passes(self):
        """未知阶段标识默认通过（无工件要求映射）。"""
        passed, missing = check_gate("stage_99_unknown", {"some_key": "val"})
        assert passed is True
        assert missing == []


# =============================================================================
# TestSaveArtifact：工件写入单元测试
# =============================================================================

class TestSaveArtifact:
    """工件写入测试——验证 DB blob 写入 + 磁盘落盘。"""

    def test_save_artifact_writes_blob_and_disk(
        self, client: TestClient, auth_headers: dict
    ):
        """save_artifact 同时写入 standard_step_data blob 和磁盘文件。"""
        # 创建标准项目
        resp = client.post(
            "/api/v1/projects",
            json={"name": "工件写入测试", "mode": "standard"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        project_id = resp.json()["data"]["id"]

        # 直接调引擎写入工件
        from app.repositories.runtime_db import db as runtime_db

        result = save_artifact(project_id, "brainstorm", "脑爆内容：AI 诗词生成器", runtime_db)
        assert result["status"] == "valid"
        assert result["artifact_name"] == "brainstorm"

        # 验证 DB blob 已写入
        state = runtime_db.get_skill_state(project_id)
        assert state is not None
        sd = state.standard_step_data
        if isinstance(sd, str):
            sd = json.loads(sd)
        assert sd.get("brainstorm_content") == "脑爆内容：AI 诗词生成器"

        # 验证磁盘文件已落盘
        project = runtime_db.get_project(project_id)
        assert project is not None
        slug = project.name.lower().replace(" ", "-")
        docs_dir = Path(settings.STORAGE_BASE_PATH) / "projects" / slug / "docs"
        expected_file = docs_dir / ARTIFACT_TO_FILENAME["brainstorm"]
        assert expected_file.exists(), f"落盘文件 {expected_file} 不存在"
        assert "脑爆内容" in expected_file.read_text(encoding="utf-8")

    def test_save_artifact_unknown_returns_error(self):
        """未知工件名返回 error 状态。"""
        from app.repositories.runtime_db import db as runtime_db

        result = save_artifact("fake-project-id", "unknown_artifact", "内容", runtime_db)
        assert result["status"] == "error"


# =============================================================================
# TestAdvanceWithGate：带门禁推进集成测试（API 驱动，不碰 LLM）
# =============================================================================

class TestAdvanceWithGate:
    """带门禁推进集成测试——通过 HTTP API 驱动，完全不碰 LLM。"""

    def test_full_loop_stage_01_to_08(self, client: TestClient, auth_headers: dict):
        """
        金标准验证：逐阶段写入工件 + 推进，从 stage_01 到 stage_08。

        纯确定性、无 LLM、可秒级复现。
        """
        # 1. 创建标准项目（初始阶段为 stage_01_brainstorm）
        resp = client.post(
            "/api/v1/projects",
            json={"name": "PBL 闭环金标准", "mode": "standard"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        project_id = resp.json()["data"]["id"]

        # 确认初始阶段
        progress = client.get(
            f"/api/v1/projects/{project_id}/progress", headers=auth_headers
        )
        assert progress.json()["data"]["current_stage"] == "stage_01_brainstorm"

        # 2. 逐阶段推进：stage_01 → stage_08
        stage_artifacts = [
            ("stage_01_brainstorm", {"brainstorm": "# 脑爆\n主题：AI 诗词生成器\n关键词：NLP、韵律"}),
            ("stage_02_brief", {"project_brief": "# 项目简介\n做一个 AI 辅助古诗词创作工具。"}),
            ("stage_03_constraints", {"constraints": "# 约束\n技术栈：Python + React\n时长：2 周"}),
            ("stage_04_track", {"track_plan": "# 轨道选择\n选择：Web 应用轨道"}),
            ("stage_05_design", {"design": "# 设计蓝图\n前端：React 组件树\n后端：FastAPI"}),
            ("stage_06_step_plan", {"step_plan": "# 分步计划\nStep1: 搭建脚手架\nStep2: 实现 API"}),
            ("stage_07_execute", {"dev_log": "# 开发日志\nDay1: 完成项目初始化\nDay2: 实现 API 端点"}),
            ("stage_08_evaluate", {"evaluate": "# 验收总结\n成果：实现了核心功能\n反思：时间管理需改进"}),
        ]

        for stage, artifacts in stage_artifacts:
            resp = client.post(
                f"/api/v1/projects/{project_id}/pbl/complete-stage",
                json={"stage": stage, "artifacts": artifacts},
                headers=auth_headers,
            )
            assert resp.status_code == 200, f"阶段 {stage} 推进失败: {resp.text}"
            current = resp.json()["data"]["current_stage"]

            # stage_01~stage_07 推进后应到下一阶段
            if stage != "stage_08_evaluate":
                expected_next = STAGES_WITH_ARTIFACTS[
                    [s[0] for s in STAGES_WITH_ARTIFACTS].index(stage) + 1
                ][0]
                assert current == expected_next, (
                    f"阶段 {stage} 推进后期望 {expected_next}，实际 {current}"
                )

        # 3. 断言终态
        final_progress = client.get(
            f"/api/v1/projects/{project_id}/progress", headers=auth_headers
        )
        assert final_progress.json()["data"]["current_stage"] == "stage_08_evaluate"

    def test_advance_blocked_when_artifact_missing(
        self, client: TestClient, auth_headers: dict
    ):
        """工件未写入时推进应被门禁拦截，返回 422 + missing_requirements。"""
        # 创建标准项目（初始 stage_01_brainstorm）
        resp = client.post(
            "/api/v1/projects",
            json={"name": "门禁拦截测试", "mode": "standard"},
            headers=auth_headers,
        )
        project_id = resp.json()["data"]["id"]

        # 不写入任何工件直接推进 → 应被拦截
        advance_resp = client.post(
            f"/api/v1/projects/{project_id}/advance", headers=auth_headers
        )
        assert advance_resp.status_code == 422
        detail = advance_resp.json()["detail"]
        assert "missing_requirements" in detail
        assert len(detail["missing_requirements"]) > 0
        assert detail["current_stage"] == "stage_01_brainstorm"

    def test_complete_stage_without_artifact_does_not_advance(
        self, client: TestClient, auth_headers: dict
    ):
        """/pbl/complete-stage 不传工件时，阶段不变。"""
        resp = client.post(
            "/api/v1/projects",
            json={"name": "空工件测试", "mode": "standard"},
            headers=auth_headers,
        )
        project_id = resp.json()["data"]["id"]

        resp = client.post(
            f"/api/v1/projects/{project_id}/pbl/complete-stage",
            json={"stage": "stage_01_brainstorm", "artifacts": {}},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["current_stage"] == "stage_01_brainstorm"

    def test_advance_at_final_stage_stays(
        self, client: TestClient, auth_headers: dict
    ):
        """在 stage_08_evaluate 再次推进，仍停留在终态。"""
        # 先跑到 stage_08
        resp = client.post(
            "/api/v1/projects",
            json={"name": "终态测试", "mode": "standard"},
            headers=auth_headers,
        )
        project_id = resp.json()["data"]["id"]

        for stage, artifacts in [
            ("stage_01_brainstorm", {"brainstorm": "脑爆"}),
            ("stage_02_brief", {"project_brief": "简介"}),
            ("stage_03_constraints", {"constraints": "约束"}),
            ("stage_04_track", {"track_plan": "轨道"}),
            ("stage_05_design", {"design": "设计"}),
            ("stage_06_step_plan", {"step_plan": "计划"}),
            ("stage_07_execute", {"dev_log": "日志"}),
            ("stage_08_evaluate", {"evaluate": "总结"}),
        ]:
            client.post(
                f"/api/v1/projects/{project_id}/pbl/complete-stage",
                json={"stage": stage, "artifacts": artifacts},
                headers=auth_headers,
            )

        # 确认在 stage_08
        progress = client.get(
            f"/api/v1/projects/{project_id}/progress", headers=auth_headers
        )
        assert progress.json()["data"]["current_stage"] == "stage_08_evaluate"

        # 再次推进——advance_skill_state 在最后阶段是 no-op，但门禁通过
        resp = client.post(
            f"/api/v1/projects/{project_id}/advance", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["current_stage"] == "stage_08_evaluate"
