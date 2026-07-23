"""
PBL 阶段常量集中定义（单一事实来源）

用途：消除阶段常量之前散落在 tools.py / pbl_engine.py / orchestrator.py /
project_repo.py / memory.py 五处的重复定义。所有阶段顺序、工件映射、代码门禁
统一从这里导入。

维护者：AI Agent
links: apps/backend/app/services/pbl_engine.py, apps/backend/app/services/tools.py
"""

from __future__ import annotations

# ── 标准研学 9 阶段顺序（索引即阶段序号）──────────────────────────
# stage_00 是初始化，stage_08 是验收终点。推进只能向前，不能回退。
STAGE_ORDER: list[str] = [
    "stage_00_bootstrap",
    "stage_01_brainstorm",
    "stage_02_brief",
    "stage_03_constraints",
    "stage_04_track",
    "stage_05_design",
    "stage_06_step_plan",
    "stage_07_execute",
    "stage_08_evaluate",
]

# 轻项目 3 步顺序
LIGHT_STAGE_ORDER: list[str] = ["step_1", "step_2", "step_3"]

# ── 阶段 → 该阶段必须产出的工件名（None 表示无工件要求）─────────
ARTIFACT_FOR_STAGE: dict[str, str | None] = {
    "stage_00_bootstrap": None,
    "stage_01_brainstorm": "brainstorm",
    "stage_02_brief": "project_brief",
    "stage_03_constraints": "constraints",
    "stage_04_track": "track_plan",
    "stage_05_design": "design",
    "stage_06_step_plan": "step_plan",
    "stage_07_execute": "dev_log",
    "stage_08_evaluate": "evaluate",
}

# ── 工件名 → standard_step_data 的 blob key ────────────────────────
ARTIFACT_TO_BLOB_KEY: dict[str, str] = {
    "brainstorm": "brainstorm_content",
    "project_brief": "brief_content",
    "constraints": "constraints_content",
    "track_plan": "track_plan_content",
    "design": "design_content",
    "step_plan": "step_plan_content",
    "dev_log": "dev_log_content",
    "evaluate": "evaluate_content",
}

# ── 工件名 → 落盘文件名 ───────────────────────────────────────────
ARTIFACT_TO_FILENAME: dict[str, str] = {
    "brainstorm": "00_brainstorm.md",
    "project_brief": "01_project_brief.md",
    "constraints": "02_constraints.md",
    "track_plan": "03_track_plan.md",
    "design": "04_design.md",
    "step_plan": "05_step_plan.md",
    "dev_log": "06_dev_log.md",
    "evaluate": "07_evaluation.md",
}

# 反向映射：工件名 → 所属阶段（从 ARTIFACT_FOR_STAGE 派生）
ARTIFACT_TO_STAGE: dict[str, str] = {
    artifact: stage
    for stage, artifact in ARTIFACT_FOR_STAGE.items()
    if artifact is not None
}

# ── 允许生成可执行代码的阶段 ──────────────────────────────────────
# stage_05 生成代码框架；stage_07 正式开发；stage_08 修订验收。
# 其他阶段禁止输出可执行代码块（PBL 阶段代码锁）。
CODE_ALLOWED_STAGES: set[str] = {
    "stage_05_design",
    "stage_07_execute",
    "stage_08_evaluate",
}

# project_code_writer 工具最早可用的阶段
CODE_WRITER_ALLOWED_FROM: str = "stage_05_design"

# ── 阶段显示名称（中文）──────────────────────────────────────────
STAGE_DISPLAY_NAMES: dict[str, str] = {
    "stage_00_bootstrap": "项目初始化",
    "stage_01_brainstorm": "脑爆选题",
    "stage_02_brief": "开题立项",
    "stage_03_constraints": "范围裁剪",
    "stage_04_track": "技术轨道",
    "stage_05_design": "设计蓝图",
    "stage_06_step_plan": "分步计划",
    "stage_07_execute": "编码实现",
    "stage_08_evaluate": "验收展示",
}


def stage_index(stage: str) -> int:
    """返回阶段在 STAGE_ORDER 中的索引；未知阶段返回 -1。"""
    try:
        return STAGE_ORDER.index(stage)
    except ValueError:
        return -1


def is_code_allowed_stage(stage: str) -> bool:
    """当前阶段是否允许生成可执行代码。"""
    return stage in CODE_ALLOWED_STAGES


def can_advance_to(current_stage: str, target_stage: str) -> bool:
    """判断是否可以从 current_stage 推进到 target_stage。

    规则（关闭原来"指定 target_stage 可跳任意后续阶段"的门禁漏洞）：
    - 只能前进，不能回退或停留
    - target 必须是 current 的**下一**阶段（不允许跨阶段跳）
    """
    cur_idx = stage_index(current_stage)
    tgt_idx = stage_index(target_stage)
    if cur_idx < 0 or tgt_idx < 0:
        return False
    return tgt_idx == cur_idx + 1


def artifact_stage_gate(artifact_name: str, current_stage: str) -> tuple[bool, str]:
    """工件写入门禁：写入某工件时，当前阶段必须 >= 该工件所属阶段。

    返回:
        (allowed, reason): allowed=是否允许，reason=拒绝原因（允许时为空串）
    """
    required_stage = ARTIFACT_TO_STAGE.get(artifact_name)
    if not required_stage:
        # 未知工件不在门禁范围（由 artifact_writer 自身校验）
        return True, ""
    cur_idx = stage_index(current_stage)
    req_idx = stage_index(required_stage)
    if cur_idx < 0 or req_idx < 0:
        # 未知阶段放行（如轻项目模式），由其他逻辑兜底
        return True, ""
    if cur_idx < req_idx:
        return False, (
            f"工件 {artifact_name} 属于 {required_stage}（第 {req_idx + 1} 阶段），"
            f"当前阶段 {current_stage}（第 {cur_idx + 1} 阶段）不允许写入。"
            f"请先按顺序推进到 {required_stage}。"
        )
    return True, ""
