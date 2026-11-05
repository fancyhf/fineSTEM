"""
研学文档 API 与报告生成测试

用途：验证公开过程文档权限、真实工件报告拼装和 UTF-8 写入约束
维护者：AI Agent
links: .trae/documents/testing/
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.schemas.evidence import AutoEvidenceCollectRequest, Evidence, EvidenceCreate, EvidenceUpdate
from app.services.document_service import DocumentService, build_process_documents, format_document_content
from app.services.pbl_engine import save_artifact
from app.services.stage_constants import ARTIFACT_TO_BLOB_KEY, PROCESS_ARTIFACT_ORDER


def _create_card(client: TestClient, auth_headers: dict, project_id: str) -> str:
    response = client.post(
        f"/api/v1/achievement-cards/projects/{project_id}",
        json={
            "title": "公开文档测试",
            "one_liner": "一句话介绍",
            "problem_solved": "问题",
            "method_used": "方法",
            "reflection": "反思",
            "project_mode": "light",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]["id"]


def _write_process_documents(project_id: str) -> None:
    from app.api import documents as documents_module

    state = documents_module.db.get_skill_state(project_id)
    assert state is not None
    standard_data = dict(state.standard_step_data or {})
    for artifact_name in PROCESS_ARTIFACT_ORDER:
        standard_data[ARTIFACT_TO_BLOB_KEY[artifact_name]] = f"{artifact_name}：中文过程正文"
    documents_module.db.update_skill_state(
        project_id,
        {"standard_step_data": standard_data},
    )


def test_public_documents_anonymous_success(
    client: TestClient,
    auth_headers: dict,
    created_project: dict,
):
    card_id = _create_card(client, auth_headers, created_project["id"])
    _write_process_documents(created_project["id"])
    publish_response = client.post(
        f"/api/v1/achievement-cards/{card_id}/submit-public",
        json={"submit_public": True},
        headers=auth_headers,
    )
    assert publish_response.status_code == 200

    response = client.get(f"/api/v1/documents/public/{card_id}")

    assert response.status_code == 200, response.text
    documents = response.json()["data"]
    assert len(documents) == 9
    assert [document["name"] for document in documents] == [
        "头脑风暴",
        "开题立项",
        "范围裁剪",
        "轨道选择",
        "设计蓝图",
        "分步计划",
        "开发日志",
        "验收评估",
        "讲解文档",
    ]
    assert documents[0]["content"] == "brainstorm：中文过程正文"
    assert documents[0]["summary"] == documents[0]["content"]
    assert all(document["has_content"] for document in documents)
    assert "author_id" not in response.text
    assert "project_id" not in response.text


def test_public_documents_private_card_returns_404(
    client: TestClient,
    auth_headers: dict,
    created_project: dict,
):
    card_id = _create_card(client, auth_headers, created_project["id"])

    response = client.get(f"/api/v1/documents/public/{card_id}")

    assert response.status_code == 404


def test_public_documents_missing_card_returns_404(client: TestClient):
    response = client.get("/api/v1/documents/public/not-found")

    assert response.status_code == 404


def _report_snapshot() -> dict[str, Any]:
    standard_data = {
        ARTIFACT_TO_BLOB_KEY[name]: f"{name}正文标记\n" + ("完整过程内容" * 100)
        for name in PROCESS_ARTIFACT_ORDER
    }
    return {
        "project": {
            "id": "project-test",
            "name": "真实工件报告",
            "mode": "standard",
            "current_stage": "stage_08_evaluate",
            "description": "项目完整描述",
        },
        "progress": {
            "current_stage": "stage_08_evaluate",
            "stage_history": [],
            "standard_step_data": standard_data,
        },
        "evidence": [
            {
                "type": "text_log",
                "title": f"证据{index}",
                "content": f"证据{index}全文标记" + ("证" * 600),
            }
            for index in range(51)
        ],
        "achievement_card": {
            "title": "成果标题",
            "one_liner": "成果介绍",
            "reflection": "成果反思",
        },
        "generated_at": "2026-11-05 00:00:00.000",
    }


@pytest.mark.parametrize("document_type", ["proposal", "technical", "final"])
def test_reports_include_full_process_content_and_generation_note(document_type: str):
    report = DocumentService()._build_markdown(document_type, _report_snapshot())

    assert "证据50全文标记" + ("证" * 600) in report
    assert "## 生成说明" in report
    assert "本报告由平台实时拼装" in report
    assert "## 开题重点" not in report
    assert "## 技术重点" not in report
    assert "## 结题重点" not in report


def test_proposal_and_technical_reports_use_expected_artifacts():
    snapshot = _report_snapshot()

    proposal = DocumentService()._build_markdown("proposal", snapshot)
    technical = DocumentService()._build_markdown("technical", snapshot)

    assert "brainstorm正文标记" in proposal
    assert "project_brief正文标记" in proposal
    assert "design正文标记" not in proposal
    for artifact_name in ("constraints", "track_plan", "design", "step_plan", "dev_log"):
        assert f"{artifact_name}正文标记" in technical


def test_final_report_contains_evaluation_full_text_and_all_summaries():
    report = DocumentService()._build_markdown("final", _report_snapshot())

    assert "evaluate正文标记" + ("\n" + "完整过程内容" * 100) in report
    assert "## 过程文档摘要" in report
    for artifact_name in PROCESS_ARTIFACT_ORDER:
        assert f"{artifact_name}正文标记" in report


def test_json_document_preserves_all_fields_in_readable_markdown():
    raw_content = (
        '{"title":"生态岛","steps":[{"name":"第一步","run":"草生长",'
        '"check":"手算一致","rollback":"恢复参数"}],"custom_field":"未知字段也保留"}'
    )

    documents = build_process_documents({
        "standard_step_data": {"brief_content": raw_content},
    })
    content = documents[1].content

    assert not content.lstrip().startswith("{")
    assert "### 分步计划" in content
    for expected in ("项目标题", "生态岛", "草生长", "手算一致", "恢复参数", "custom field", "未知字段也保留"):
        assert expected in content
    assert "{" not in content


def test_incomplete_json_is_preserved_without_destructive_conversion():
    raw_content = '{"title":"不完整JSON'

    assert format_document_content(raw_content) == raw_content


def test_light_project_documents_use_real_fields_without_empty_placeholders():
    documents = build_process_documents({
        "standard_step_data": {},
        "light_step_data": {
            "topic": "观察生态变化",
            "goal": "理解变量关系",
            "core_features": ["单步模拟"],
            "steps": ["实现模型", "运行验证"],
            "result": "完成可运行作品",
            "reflection": "学会逐位核对",
        },
    })

    assert [document.name for document in documents] == ["想法与方向", "设计与实现", "成果与反思"]
    assert all(document.has_content and document.content_length > 0 for document in documents)
    assert "观察生态变化" in documents[0].content
    assert "运行验证" in documents[1].content
    assert "学会逐位核对" in documents[2].content


def test_author_document_routes_share_light_project_builder(
    client: TestClient,
    auth_headers: dict,
    created_project: dict,
):
    from app.api import projects as projects_module

    projects_module.db.update_skill_state(created_project["id"], {
        "standard_step_data": {},
        "light_step_data": {"topic": "轻量主题", "steps": ["真实实现步骤"]},
    })

    list_response = client.get(
        f"/api/v1/projects/{created_project['id']}/documents",
        headers=auth_headers,
    )
    detail_response = client.get(
        f"/api/v1/projects/{created_project['id']}/documents/light_step_02",
        headers=auth_headers,
    )

    assert list_response.status_code == 200, list_response.text
    documents = list_response.json()["data"]
    assert [document["name"] for document in documents] == ["想法与方向", "设计与实现"]
    assert detail_response.status_code == 200, detail_response.text
    assert "真实实现步骤" in detail_response.json()["data"]["content"]


def test_evidence_text_models_reject_invalid_unicode():
    with pytest.raises(ValidationError):
        EvidenceCreate(project_id="project", type="text_log", content="\ud800")
    with pytest.raises(ValidationError):
        EvidenceUpdate(title="\ud800")
    with pytest.raises(ValidationError):
        AutoEvidenceCollectRequest(type="auto_stage_change", content="\ud800")
    with pytest.raises(ValidationError):
        Evidence(
            project_id="project",
            author_id="author",
            type="screenshot",
            title="截图",
            content="\ud800",
        )


def test_artifact_writer_rejects_invalid_unicode_before_database_access():
    class UnexpectedDatabase:
        def __getattr__(self, name: str) -> Any:
            raise AssertionError(f"不应访问数据库属性: {name}")

    with pytest.raises(ValueError, match="UTF-8"):
        save_artifact("project", "brainstorm", "\ud800", UnexpectedDatabase())
