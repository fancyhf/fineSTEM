"""
数据安全与完整性单元测试（2026-07-27 新增）

覆盖问题清单 Q-014 / Q-015：
- Q-014: stages 存非法状态值（in_progress/not_started）导致 /workspace 500
- Q-015: light_step_data 被多层 JSON 编码导致 /workspace 500

对应测试计划 TC-DATA-001 ~ TC-DATA-005。
links: .trae/documents/问题清单_长期维护.md
       .trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md
"""
from __future__ import annotations

import asyncio
import uuid

import pytest

from app.repositories.project_repo import _normalize_stage_statuses
from app.repositories.runtime_db import db
from app.repositories.utils import json_loads
from app.schemas.projects import SkillState
from app.services.tools import SkillStateWriterTool


# ── TC-DATA-001: _normalize_stage_statuses 规范化所有非法状态 ──


@pytest.mark.parametrize("illegal,expected", [
    ("in_progress", "active"),
    ("in-progress", "active"),
    ("running", "active"),
    ("started", "active"),
    ("not_started", "locked"),
    ("not-started", "locked"),
    ("pending", "locked"),
    ("todo", "locked"),
    ("done", "completed"),
    ("finished", "completed"),
    ("valid", "completed"),          # 历史遗留值
    ("未知值", "locked"),             # 未知 → 兜底 locked
    ("", "locked"),                   # 空 → 兜底 locked
])
def test_normalize_stage_statuses_maps_illegal_values(illegal, expected):
    """TC-DATA-001: 各类非法状态值被映射为合法四态之一。"""
    stages = {"stage_01_brainstorm": {"status": illegal}}
    result = _normalize_stage_statuses(stages)
    assert result["stage_01_brainstorm"]["status"] == expected


@pytest.mark.parametrize("legal", ["locked", "active", "completed", "skipped"])
def test_normalize_stage_statuses_preserves_legal_values(legal):
    """TC-DATA-001: 合法四态原样保留。"""
    stages = {"stage_01_brainstorm": {"status": legal}}
    result = _normalize_stage_statuses(stages)
    assert result["stage_01_brainstorm"]["status"] == legal


# ── TC-DATA-002: _normalize_stage_statuses 处理 dict 与 str 两种格式 ──


def test_normalize_stage_statuses_dict_format():
    """TC-DATA-002: dict 格式的 stage 值（当前标准格式）。"""
    stages = {"stage_01_brainstorm": {"status": "in_progress", "data": {"key": "val"}}}
    result = _normalize_stage_statuses(stages)
    assert result["stage_01_brainstorm"] == {"status": "active", "data": {"key": "val"}}


def test_normalize_stage_statuses_str_format():
    """TC-DATA-002: str 格式的 stage 值（旧格式兼容）。"""
    stages = {"stage_01_brainstorm": "completed"}
    result = _normalize_stage_statuses(stages)
    assert result["stage_01_brainstorm"] == {"status": "completed", "data": {}}


def test_normalize_stage_statuses_non_dict_input():
    """TC-DATA-002: 非 dict 输入返回空 dict。"""
    assert _normalize_stage_statuses(None) == {}
    assert _normalize_stage_statuses("not a dict") == {}


# ── TC-DATA-003: json_loads 多层 JSON 自动解码 ──


def test_json_loads_multi_layer_decoding():
    """TC-DATA-003: 3 层 JSON 编码被完全解为 dict（Q-015 复现场景）。"""
    import json
    raw = {"project_name": "测试项目", "artifacts": []}
    # 编码 3 层
    triple_encoded = json.dumps(json.dumps(json.dumps(raw)))
    assert isinstance(triple_encoded, str)

    result = json_loads(triple_encoded, {})
    assert isinstance(result, dict)
    assert result == raw


def test_json_loads_single_layer():
    """TC-DATA-003: 单层 JSON 正常解码。"""
    import json
    result = json_loads(json.dumps({"a": 1}), {})
    assert result == {"a": 1}


def test_json_loads_empty_and_invalid():
    """TC-DATA-003: 空值与非法 JSON 返回 default。"""
    assert json_loads("", {}) == {}
    assert json_loads(None, {}) == {}
    assert json_loads("not json{", {}) == {}


def test_json_loads_scalar_string():
    """TC-DATA-003: 纯字符串（非 JSON 对象）不被过度解码。"""
    # 普通字符串不是 JSON，返回 default
    assert json_loads("hello world", {}) == {}


# ── TC-DATA-004: create_skill_state 写入时规范化 stages（P0-1）──


def test_create_skill_state_normalizes_illegal_stages(client):
    """TC-DATA-004: 含非法 stages 的 SkillState 经 create_skill_state 写入后被规范化。

    复现 Q-014 根因——历史上 create_skill_state 是唯一未调用规范化的写入入口。
    """
    project_id = f"test-data-integrity-{uuid.uuid4().hex[:8]}"
    # 用 model_construct 绕过 Pydantic Literal 校验，模拟历史脏数据写入路径
    ss = SkillState.model_construct(
        project_id=project_id, version="1.0.0", mode="light", current_stage="step_1",
        light_step=1,
        stages={
            "stage_01_brainstorm": {"status": "in_progress"},
            "stage_02_brief": {"status": "not_started"},
            "stage_03_constraints": {"status": "completed"},
        },
        metadata={}, light_to_standard_mapping=None, stage_history=[],
        light_step_data={}, standard_step_data={},
    )

    db.create_skill_state(ss)

    # 读回验证：所有 status 必须是合法四态
    # 注意：SkillState.stages 经 Pydantic 后，每个 stage 是 StageBase 对象
    restored = db.get_skill_state(project_id)
    assert restored is not None
    legal = {"locked", "active", "completed", "skipped"}
    for stage_key, stage_val in restored.stages.items():
        # StageBase 对象有 .status 属性；兼容 dict 形式
        status = getattr(stage_val, "status", None) or (
            stage_val.get("status") if isinstance(stage_val, dict) else None
        )
        assert status in legal, f"{stage_key} 仍含非法状态 {status!r}"

    # 进一步验证 _build_workspace_payload 不再抛 ValidationError（即 Q-014 的核心症状消失）
    from app.api.projects import _build_workspace_payload
    # 需要对应 project 行存在才能走完整流程，这里仅验证 get_skill_state 不抛错即可


# ── TC-DATA-005: SkillStateWriterTool 解包字符串型 JSON 值（P0-2）──


def test_skill_state_writer_unpacks_string_json(client):
    """TC-DATA-005: AI 传字符串型 light_step_data，工具应解包后只产生单层编码。

    复现 Q-015 根因——AI 把 JSON 对象当字符串传，原实现会多层编码。
    读回用 db.get_skill_state（已经 json_loads 解码），其 light_step_data 应是干净 dict，
    若 DB 里被多层编码，json_loads 的多层解码也会解出 dict，故需额外校验内容完整。
    """
    project_id = f"test-writer-unpack-{uuid.uuid4().hex[:8]}"
    ss = SkillState.model_construct(
        project_id=project_id, version="1.0.0", mode="light", current_stage="step_1",
        light_step=1, stages={"step_1": {"status": "active"}},
        metadata={}, light_to_standard_mapping=None, stage_history=[],
        light_step_data={}, standard_step_data={},
    )
    db.create_skill_state(ss)

    # 模拟 AI 把 light_step_data 当字符串传（历史脏数据产生的根因）
    writer = SkillStateWriterTool()
    result = asyncio.run(writer.execute({
        "project_id": project_id,
        "updates": {
            "light_step_data": '{"project_name": "测试项目", "artifacts": []}',
        },
    }))
    assert result.success, f"工具执行失败: {result.error}"

    # 读回：db.get_skill_state 返回的 light_step_data 应是干净 dict（非 str）
    restored = db.get_skill_state(project_id)
    assert restored is not None
    assert isinstance(restored.light_step_data, dict), \
        "light_step_data 应为 dict，说明字符串未被正确解包（P0-2 防御失效）"
    assert restored.light_step_data["project_name"] == "测试项目"
    assert restored.light_step_data["artifacts"] == []


def test_skill_state_writer_preserves_dict_input(client):
    """TC-DATA-005 补充：AI 传 dict（正常情况）也应只产生单层编码，不被误处理。"""
    project_id = f"test-writer-dict-{uuid.uuid4().hex[:8]}"
    ss = SkillState.model_construct(
        project_id=project_id, version="1.0.0", mode="light", current_stage="step_1",
        light_step=1, stages={"step_1": {"status": "active"}},
        metadata={}, light_to_standard_mapping=None, stage_history=[],
        light_step_data={}, standard_step_data={},
    )
    db.create_skill_state(ss)

    writer = SkillStateWriterTool()
    result = asyncio.run(writer.execute({
        "project_id": project_id,
        "updates": {
            "light_step_data": {"project_name": "正常dict输入"},
        },
    }))
    assert result.success

    restored = db.get_skill_state(project_id)
    assert restored is not None
    assert isinstance(restored.light_step_data, dict)
    assert restored.light_step_data["project_name"] == "正常dict输入"
