"""
Skill 沙箱子进程入口

用途：在隔离子进程中执行 Skill 逻辑并输出 JSON 结果
维护者：AI Agent
"""

from __future__ import annotations

import argparse
import json
import socket
import sys
from typing import Any, Dict, List, Tuple


def disable_network() -> None:
    def blocked(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("沙箱策略禁止网络访问")

    socket.create_connection = blocked  # type: ignore[assignment]
    original_socket = socket.socket

    class BlockedSocket(original_socket):
        def connect(self, *args: Any, **kwargs: Any) -> Any:
            raise RuntimeError("沙箱策略禁止网络访问")

    socket.socket = BlockedSocket  # type: ignore[assignment]


def run_stempbl_guide(payload: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    project = payload.get("project") or {}
    stage = project.get("current_stage")
    if not stage:
        return "请先指定项目，再开始 PBL 引导。", {"next_action": "select_project"}
    hints = {
        "stage_01_brainstorm": "先列出 5 个可执行的选题，再选 1 个做问题定义。",
        "stage_02_brief": "补齐问题陈述、成功标准和风险清单。",
        "stage_03_constraints": "把需求分成 must-have 与 nice-to-have。",
        "stage_04_track": "确认技术轨道和资源可达性。",
        "stage_05_design": "先出验收标准，再细化组件结构。",
        "stage_06_step_plan": "每步都要包含 run/check/rollback。",
        "stage_07_execute": "按里程碑推进并记录开发日志。",
        "stage_08_evaluate": "根据验收标准逐条评估并形成成果卡。",
    }
    suggestion = hints.get(stage, "继续推进当前阶段并补充关键证据。")
    return f"项目当前阶段为 {stage}，建议：{suggestion}", {"current_stage": stage, "suggestion": suggestion}


def run_project_inspector(payload: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    project = payload.get("project") or {}
    if not project:
        return "项目不存在，无法分析。", {"completion": 0}
    evidence_count = int(payload.get("evidence_count", 0))
    has_card = bool(payload.get("has_achievement_card", False))
    current_stage = project.get("current_stage", "")
    stages = [
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
    completion = int((stages.index(current_stage) + 1) / len(stages) * 100) if current_stage in stages else 0
    summary = f"项目完成度约 {completion}%，证据 {evidence_count} 条，成果卡{'已' if has_card else '未'}生成。"
    return summary, {
        "completion": completion,
        "evidence_count": evidence_count,
        "has_achievement_card": has_card,
        "current_stage": current_stage,
    }


def run_demo_explorer(payload: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    demo_names: List[str] = payload.get("demo_names") or []
    if not demo_names:
        return "未检索到匹配 Demo，建议换个关键词。", {"matches": []}
    return f"已找到 {len(demo_names)} 个相关 Demo，推荐：{', '.join(demo_names[:3])}。", {"matches": demo_names[:3]}


def run_knowledge_rag(payload: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    query = str(payload.get("query", ""))
    return "知识检索模式已启用。当前实现会基于上下文返回结构化摘要。", {"query": query, "source": "local-context"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skill", required=True)
    parser.add_argument("--allow-network", action="store_true")
    args = parser.parse_args()

    if not args.allow_network:
        disable_network()

    raw = sys.stdin.read() or "{}"
    payload = json.loads(raw)

    handlers = {
        "stempbl-guide": run_stempbl_guide,
        "project-inspector": run_project_inspector,
        "demo-explorer": run_demo_explorer,
        "knowledge-rag": run_knowledge_rag,
    }
    handler = handlers.get(args.skill)
    if not handler:
        raise RuntimeError(f"不支持的 skill: {args.skill}")

    summary, detail = handler(payload)
    sys.stdout.write(json.dumps({"summary": summary, "payload": detail}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
