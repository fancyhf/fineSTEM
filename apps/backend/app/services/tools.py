"""
AI 工具调用层：核心工具定义与注册表

用途：定义 ZeroClaw Agent Loop 可调用的所有工具
维护者：AI Agent
links: .trae/documents/产品与规划/fineSTEM_AI对话流设计规格_v1.0.0.md
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.repositories.runtime_db import db
from app.services.pbl_engine import advance_with_gate, save_artifact


class ToolResult:
    def __init__(self, success: bool, data: Any = None, error: Optional[str] = None):
        self.success = success
        self.data = data or {}
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {"success": self.success}
        if self.data:
            result["data"] = self.data
        if self.error:
            result["error"] = self.error
        return result

    def to_string(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)


class BaseTool:
    name: str = ""
    description: str = ""
    parameters_schema: Dict[str, Any] = {}

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        raise NotImplementedError


class SkillStateReaderTool(BaseTool):
    """读取项目 SKILL_STATE"""

    name = "skill_state_reader"
    description = "读取项目的 SKILL_STATE 状态机数据，包括当前阶段、阶段状态、工件状态、教学模式等"
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "include": {
                "type": "array",
                "items": {"type": "string", "enum": ["stage", "artifacts", "modes", "history", "light_step_data", "standard_step_data"]},
                "description": "要包含的信息类别，默认全部"
            },
        },
        "required": ["project_id"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        if not project_id:
            return ToolResult(False, error="缺少必填参数 project_id")

        include = params.get("include") or ["stage", "artifacts", "modes", "history"]
        state = db.get_skill_state(project_id)
        if not state:
            return ToolResult(False, error=f"未找到项目 {project_id} 的 SKILL_STATE")

        state_dict = state.model_dump(mode="json") if hasattr(state, "model_dump") else state.__dict__
        result: Dict[str, Any] = {"project_id": project_id}

        if "stage" in include:
            result["current_stage"] = getattr(state, "current_stage", "unknown")
            result["mode"] = getattr(state, "mode", "light")

        if "artifacts" in include:
            stages_raw = getattr(state, "stages", "{}")
            stages_dict = json.loads(stages_raw) if isinstance(stages_raw, str) else stages_raw
            artifacts_status = {}
            for stage_id, stage_val in stages_dict.items():
                if isinstance(stage_val, dict):
                    artifacts_status[stage_id] = stage_val.get("status", "unknown")
            result["artifact_statuses"] = artifacts_status

        if "modes" in include:
            metadata_raw = getattr(state, "metadata", "{}")
            metadata_dict = json.loads(metadata_raw) if isinstance(metadata_raw, str) else metadata_raw
            result["teaching_mode"] = metadata_dict.get("teachingMode", "guided")
            result["research_docs"] = metadata_dict.get("researchDocs", False)
            result["paper_mode"] = metadata_dict.get("paperMode", False)

        if "history" in include:
            history_raw = getattr(state, "stage_history", "[]")
            history_list = json.loads(history_raw) if isinstance(history_raw, str) else history_raw
            result["stage_history"] = history_list[-5:] if len(history_list) > 5 else history_list

        if "light_step_data" in include:
            light_raw = getattr(state, "light_step_data", "{}")
            light_dict = json.loads(light_raw) if isinstance(light_raw, str) else light_raw
            result["light_step_data"] = light_dict

        if "standard_step_data" in include:
            std_raw = getattr(state, "standard_step_data", "{}")
            std_dict = json.loads(std_raw) if isinstance(std_raw, str) else std_raw
            result["standard_step_data"] = std_dict

        return ToolResult(True, data=result)


class SkillStateWriterTool(BaseTool):
    """更新项目 SKILL_STATE"""

    name = "skill_state_writer"
    description = "更新项目的 SKILL_STATE 状态机数据，包括阶段推进、工件状态变更、教学模式切换等"
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "updates": {"type": "object", "description": "要更新的字段键值对"},
            "history_entry": {
                "type": "object",
                "properties": {
                    "action": {"type": "string"},
                    "from_stage": {"type": "string"},
                    "to_stage": {"type": "string"},
                    "note": {"type": "string"},
                },
            },
        },
        "required": ["project_id", "updates"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        updates = params.get("updates")
        if not project_id or not updates:
            return ToolResult(False, error="缺少必填参数 project_id 或 updates")

        history_entry = params.get("history_entry")
        if history_entry:
            existing_state = db.get_skill_state(project_id)
            if existing_state:
                history_raw = getattr(existing_state, "stage_history", "[]")
                history_list = json.loads(history_raw) if isinstance(history_raw, str) else history_raw
                history_entry.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
                history_list.append(history_entry)
                updates["stage_history"] = history_list

        updated = db.update_skill_state(project_id, updates)
        if not updated:
            return ToolResult(False, error=f"更新失败：未找到项目 {project_id}")

        return ToolResult(True, data={"updated_fields": list(updates.keys())})


class StageAdvancerTool(BaseTool):
    """推进项目阶段（含门禁检查）"""

    name = "stage_advancer"
    description = "推进项目到下一个阶段，自动执行门禁检查确保满足完成条件"
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "target_stage": {"type": "string", "description": "目标阶段标识（可选，不填则自动推进到下一阶段）"},
            "evidence": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "artifacts": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "required": ["project_id"],
    }

    STAGE_ORDER_LIGHT = ["step_1", "step_2", "step_3"]
    STAGE_ORDER_STANDARD = [
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

    GATE_CHECKS = {
        "step_1_to_step_2": lambda s: bool(s.get("project_name") and s.get("one_liner") and s.get("core_features")),
        "step_2_to_step_3": lambda s: bool(s.get("code_url") or s.get("key_screenshots")),
        "step_3_to_done": lambda s: True,
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        target_stage = params.get("target_stage")
        evidence = params.get("evidence")

        if not project_id:
            return ToolResult(False, error="缺少必填参数 project_id")

        state = db.get_skill_state(project_id)
        if not state:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        current_stage = getattr(state, "current_stage", "stage_01_brainstorm")
        mode = getattr(state, "mode", "light")
        light_step = getattr(state, "light_step", None)

        if target_stage:
            order = self.STAGE_ORDER_LIGHT if mode == "light" else self.STAGE_ORDER_STANDARD
            try:
                current_idx = order.index(current_stage)
                target_idx = order.index(target_stage)
            except ValueError:
                return ToolResult(False, error=f"无效的阶段标识: {target_stage}")
            if target_idx <= current_idx:
                return ToolResult(False, error="只能前进阶段，不能回退或停留在当前阶段")
        else:
            if mode == "light" and light_step:
                next_map = {1: 2, 2: 3}
                next_light = next_map.get(int(light_step))
                if next_light:
                    gate_key = f"step_{int(light_step)}_to_step_{next_light}"
                    light_data_raw = getattr(state, "light_step_data", "{}")
                    light_data = json.loads(light_data_raw) if isinstance(light_data_raw, str) else light_data_raw
                    if gate_key in self.GATE_CHECKS and not self.GATE_CHECKS[gate_key](light_data):
                        return ToolResult(
                            False,
                            error="门禁检查未通过：当前阶段完成条件尚未满足",
                            data={"missing_requirements": "请先填写项目名称、一句话描述和核心功能列表"}
                        )
                    updates = {"light_step": str(next_light)}
                    if evidence:
                        updates["light_step_data"] = {**light_data, **evidence}
                    db.update_skill_state(project_id, updates)

                    hints = {
                        2: "现在可以开始写代码了！试试修改模板中的文字和颜色",
                        3: "最后一步：写一段简短反思，说说你学到了什么",
                    }
                    return ToolResult(True, data={
                        "previous_stage": f"step_{light_step}",
                        "current_stage": f"step_{next_light}",
                        "message": f"已从「步骤{light_step}」推进到「步骤{next_light}」",
                        "next_hint": hints.get(next_light, "继续推进"),
                    })
                else:
                    return ToolResult(True, data={
                        "message": "轻项目已完成所有步骤！可以生成成果档案卡了",
                        "next_hint": "使用 achievement_card 工具生成成果档案卡",
                    })
            else:
                # 标准轨：通过 pbl_engine 带门禁推进
                result = advance_with_gate(project_id, db)
                if result["success"]:
                    new_stage = result.get("new_stage") or "unknown"
                    stage_hints = {
                        "stage_01_brainstorm": "现在来脑爆选题吧！想 5 个你觉得有趣的项目方向",
                        "stage_02_brief": "来写开题立项书，定义你的项目目标和成功标准",
                        "stage_03_constraints": "把需求分成必须做、最好有、不做三类",
                        "stage_04_track": "确认技术轨道和资源可达性",
                        "stage_05_design": "设计蓝图——先出验收标准，再细化组件结构",
                        "stage_06_step_plan": "制定分步计划，每步都要包含 run/check/rollback",
                        "stage_07_execute": "按里程碑推进并记录开发日志",
                        "stage_08_evaluate": "根据验收标准逐条评估并形成成果档案卡",
                    }
                    return ToolResult(True, data={
                        "previous_stage": current_stage,
                        "current_stage": new_stage,
                        "message": f"已从「{current_stage}」推进到「{new_stage}」",
                        "next_hint": stage_hints.get(new_stage, "继续推进当前阶段"),
                    })
                else:
                    return ToolResult(
                        False,
                        error="门禁检查未通过：当前阶段完成条件尚未满足",
                        data={"missing_requirements": result.get("missing", [])},
                    )

        return ToolResult(False, error="无法自动确定下一阶段")


class ArtifactReaderTool(BaseTool):
    """读取工件内容"""

    name = "artifact_reader"
    description = "读取项目已生成的工件文档内容，如开题报告、技术报告、开发日志等"
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "artifact_name": {"type": "string", "description": "工件名称（必填），如 brainstorm/project_brief/design/dev_log 等"},
        },
        "required": ["project_id", "artifact_name"],
    }

    ARTIFACT_MAP = {
        "brainstorm": ("standard_step_data", "brainstorm_content"),
        "project_brief": ("standard_step_data", "brief_content"),
        "design": ("standard_step_data", "design_content"),
        "step_plan": ("standard_step_data", "step_plan_content"),
        "dev_log": ("standard_step_data", "dev_log_content"),
        "evaluate": ("standard_step_data", "evaluate_content"),
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        artifact_name = params.get("artifact_name")
        if not project_id or not artifact_name:
            return ToolResult(False, error="缺少必填参数")

        state = db.get_skill_state(project_id)
        if not state:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        mapping = self.ARTIFACT_MAP.get(artifact_name)
        if mapping:
            container_key, content_key = mapping
            container_raw = getattr(state, container_key, "{}")
            container = json.loads(container_raw) if isinstance(container_raw, str) else container_raw
            content = container.get(content_key, "")
            status = "valid" if content else "draft"
            return ToolResult(True, data={
                "artifact_name": artifact_name,
                "status": status,
                "content": content[:5000],
            })

        return ToolResult(False, error=f"未知工件名称: {artifact_name}")


class ArtifactWriterTool(BaseTool):
    """生成/更新工件文档"""

    name = "artifact_writer"
    description = "生成或更新项目工件文档，如开题报告、技术报告、开发日志、代码文件等"
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "artifact_name": {"type": "string", "description": "工件名称（必填）"},
            "content": {"type": "string", "description": "文档内容（必填）"},
            "artifact_type": {"type": "string", "enum": ["document", "code", "report"], "description": "工件类型"},
        },
        "required": ["project_id", "artifact_name", "content"],
    }

    ARTIFACT_CONTAINER_MAP = {
        "brainstorm": ("standard_step_data", "brainstorm_content"),
        "project_brief": ("standard_step_data", "brief_content"),
        "design": ("standard_step_data", "design_content"),
        "step_plan": ("standard_step_data", "step_plan_content"),
        "dev_log": ("standard_step_data", "dev_log_content"),
        "evaluate": ("standard_step_data", "evaluate_content"),
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        project_id = params.get("project_id")
        artifact_name = params.get("artifact_name")
        content = params.get("content")
        artifact_type = params.get("artifact_type", "document")

        if not all([project_id, artifact_name, content]):
            return ToolResult(False, error="缺少必填参数 project_id / artifact_name / content")

        state = db.get_skill_state(project_id)
        if not state:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        mapping = self.ARTIFACT_CONTAINER_MAP.get(artifact_name)
        if mapping:
            container_key, content_key = mapping
            container_raw = getattr(state, container_key, "{}")
            container = json.loads(container_raw) if isinstance(container_raw, str) else container_raw
            container[content_key] = content
            container["last_updated_at"] = datetime.now(timezone.utc).isoformat()

            updates = {container_key: json.dumps(container, ensure_ascii=False)}

            stages_raw = getattr(state, "stages", "{}")
            stages_dict = json.loads(stages_raw) if isinstance(stages_raw, str) else stages_dict
            if artifact_name in stages_dict:
                stages_dict[artifact_name]["status"] = "valid"
                updates["stages"] = json.dumps(stages_dict, ensure_ascii=False)

            db.update_skill_state(project_id, updates)

            return ToolResult(True, data={
                "artifact_name": artifact_name,
                "status": "valid",
                "path": f"docs/{artifact_name}.md",
            })

        return ToolResult(False, error=f"未知工件名称: {artifact_name}")


class EvidenceSaverTool(BaseTool):
    """保存证据"""

    name = "evidence_saver"
    description = "保存项目过程中的证据，包括对话摘要、代码片段、运行结果、截图等"
    parameters_schema = {
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID（必填）"},
            "type": {"type": "string", "enum": ["code", "dialogue_summary", "screenshot", "run_result"], "description": "证据类型（必填）"},
            "title": {"type": "string", "description": "证据标题（必填）"},
            "content": {"type": "string", "description": "证据内容（必填）"},
            "stage": {"type": "string", "description": "关联阶段（可选）"},
        },
        "required": ["project_id", "type", "title", "content"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        from app.schemas.evidence import Evidence

        project_id = params.get("project_id")
        ev_type = params.get("type")
        title = params.get("title")
        content = params.get("content")
        stage = params.get("stage")

        if not all([project_id, ev_type, title, content]):
            return ToolResult(False, error="缺少必填参数")

        project = db.get_project(project_id)
        if not project:
            return ToolResult(False, error=f"未找到项目 {project_id}")

        evidence = Evidence(
            id=str(uuid.uuid4()),
            project_id=project_id,
            author_id=getattr(project, "author_id", ""),
            type=ev_type,
            title=title,
            content=content,
            related_step=stage or getattr(project, "current_stage", ""),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        created = db.create_evidence(evidence)
        return ToolResult(True, data={
            "evidence_id": created.id,
            "message": f"已保存为证据：{title}",
        })


class CodeRunnerTool(BaseTool):
    """执行代码"""

    name = "code_runner"
    description = "执行 Python 或 JavaScript 代码并返回运行结果"
    parameters_schema = {
        "type": "object",
        "properties": {
            "code": {"type": "string", "description": "要执行的代码（必填）"},
            "language": {"type": "string", "enum": ["python", "javascript"], "description": "编程语言（必填）"},
            "stdin": {"type": "string", "description": "标准输入（可选）"},
        },
        "required": ["code", "language"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        import subprocess
        import sys
        import io

        code = params.get("code", "")
        language = params.get("language", "python")
        stdin_input = params.get("stdin", "")

        if not code.strip():
            return ToolResult(False, error="代码不能为空")

        started = datetime.now(timezone.utc)
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        exit_code = 0
        exec_time_ms = 0

        try:
            if language == "javascript":
                import asyncio

                js_code = code
                if stdin_input:
                    js_code = f"const _stdin = {json.dumps(stdin_input)};\n{js_code}"

                proc = await asyncio.create_subprocess_shell(
                    "node --input-type=module -e " + "'" + js_code.replace("'", "\\'") + "'",
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    shell=True,
                )
                try:
                    stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=10)
                    exit_code = proc.returncode
                    stdout_capture.write(stdout_bytes.decode("utf-8", errors="replace"))
                    stderr_capture.write(stderr_bytes.decode("utf-8", errors="replace"))
                except asyncio.TimeoutError:
                    proc.kill()
                    stderr_capture.write("执行超时（10秒限制）")
                    exit_code = -1
            else:
                old_stdout = sys.stdout
                old_stderr = sys.stderr
                sys.stdout = stdout_capture
                sys.stderr = stderr_capture
                try:
                    compiled = compile(code, "<ai_code_runner>", "exec")
                    namespace = {"__name__": "__main__"}
                    if stdin_input:
                        namespace["_stdin"] = stdin_input
                    exec(compiled, namespace)
                except TimeoutError:
                    stderr_capture.write("执行超时（10秒限制）")
                    exit_code = -1
                except Exception as exc:
                    stderr_capture.write(f"{type(exc).__name__}: {exc}")
                    exit_code = 1
                finally:
                    sys.stdout = old_stdout
                    sys.stderr = old_stderr
        except Exception as exc:
            stderr_capture.write(str(exc))
            exit_code = 1

        exec_time_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)

        return ToolResult(True, data={
            "success": exit_code == 0,
            "stdout": stdout_capture.getvalue() or "(无输出)",
            "stderr": stderr_capture.getvalue() or "",
            "exit_code": exit_code,
            "execution_time_ms": exec_time_ms,
        })


class ResourceSearcherTool(BaseTool):
    """检索和推荐资源"""

    name = "resource_searcher"
    description = "检索 Demo 模板、课程或知识库，推荐匹配的资源给学生"
    parameters_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "搜索关键词（必填）"},
            "type": {"type": "string", "enum": ["demo", "course", "knowledge"], "description": "资源类型（可选，默认全部）"},
            "tags": {"type": "array", "items": {"type": "string"}, "description": "标签过滤（可选）"},
            "limit": {"type": "integer", "description": "返回数量上限（默认5）"},
        },
        "required": ["query"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        query = params.get("query", "")
        res_type = params.get("type")
        tags = params.get("tags", [])
        limit = params.get("limit", 5)

        results = []
        if res_type in (None, "demo"):
            demos = db.list_demos(skip=0, limit=min(limit, 20), search=query)
            for d in demos[:limit]:
                tech_stack_raw = getattr(d, "tech_stack", "[]")
                tech_stack = json.loads(tech_stack_raw) if isinstance(tech_stack_raw, str) else tech_stack_raw
                subjects_raw = getattr(d, "subjects", "[]")
                subjects = json.loads(subjects_raw) if isinstance(subjects_raw, str) else subjects_raw
                match_reason = ""
                if query.lower() in getattr(d, "name", "").lower():
                    match_reason = "名称匹配"
                elif any(t in subjects for t in tags):
                    match_reason = "学科标签匹配"
                elif any(t in tech_stack for t in tags):
                    match_reason = "技术栈匹配"
                else:
                    match_reason = "关键词相关"
                results.append({
                    "id": getattr(d, "id", ""),
                    "type": "demo",
                    "title": getattr(d, "name", ""),
                    "difficulty": getattr(d, "difficulty", "beginner"),
                    "tech_stack": tech_stack,
                    "subjects": subjects,
                    "match_reason": match_reason,
                })

        if res_type in (None, "course"):
            courses = db.list_courses(owner_id="")
            matching_courses = [c for c in courses if query.lower() in getattr(c, "title", "").lower()]
            for c in matching_courses[:min(limit - len(results), 3)]:
                results.append({
                    "id": getattr(c, "id", ""),
                    "type": "course",
                    "title": getattr(c, "title", ""),
                    "subject": getattr(c, "subject", ""),
                    "difficulty": getattr(c, "difficulty", "beginner"),
                    "match_reason": "课程名称匹配",
                })

        return ToolResult(True, data={"results": results[:limit], "total": len(results)})


class ProjectCreatorTool(BaseTool):
    """创建项目 / Fork Demo"""

    name = "project_creator"
    description = "创建新项目或从 Demo Fork 项目"
    parameters_schema = {
        "type": "object",
        "properties": {
            "source_type": {"type": "string", "enum": ["demo_fork", "blank"], "description": "来源类型（必填）"},
            "source_demo_id": {"type": "string", "description": "Demo ID（demo_fork 时必填）"},
            "name": {"type": "string", "description": "项目名称（必填）"},
            "description": {"type": "string", "description": "项目描述（可选）"},
            "mode": {"type": "string", "enum": ["light", "standard"], "description": "项目模式（默认 light）"},
            "author_id": {"type": "string", "description": "作者 ID（必填）"},
        },
        "required": ["source_type", "name", "author_id"],
    }

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        from app.schemas.projects import Project

        source_type = params.get("source_type")
        name = params.get("name")
        author_id = params.get("author_id")
        mode = params.get("mode", "light")
        description = params.get("description", "")

        if not all([source_type, name, author_id]):
            return ToolResult(False, error="缺少必填参数 source_type / name / author_id")

        initial_data: Dict[str, Any] = {}
        demo = None
        if source_type == "demo_fork":
            demo_id = params.get("source_demo_id")
            if not demo_id:
                return ToolResult(False, error="demo_fork 模式需要提供 source_demo_id")
            demo = db.get_demo(demo_id)
            if not demo:
                return ToolResult(False, error=f"未找到 Demo: {demo_id}")
            initial_data = {
                "from_demo_id": demo_id,
                "demo_name": getattr(demo, "name", ""),
            }

        project = Project(
            id=str(uuid.uuid4()),
            author_id=author_id,
            name=name,
            mode=mode,
            description=description,
            current_stage="step_1" if mode == "light" else "stage_00_bootstrap",
            initial_data=initial_data,
        )
        created = db.create_project(project)
        if created.mode == "light":
            step_seed = {
                "project_name": created.name,
                "one_liner": description or f"{created.name} 的首个可运行版本",
                "core_features": [description] if description else ["生成首个可运行版本"],
            }
            db.update_skill_state(
                created.id,
                {
                    "light_step_data": step_seed,
                },
            )

        suggestions = []
        if demo:
            suggestions.extend([
                f"试试修改「{getattr(demo, 'name', '')}」的显示文字",
                "添加一个新功能按钮",
                "改变颜色主题",
            ])
        else:
            suggestions.extend([
                "先确定你想做什么类型的 Web 应用",
                "考虑用 HTML/CSS/JS 做一个简单原型",
                "或者用 Python + Streamlit 做数据分析工具",
            ])

        return ToolResult(True, data={
            "project_id": created.id,
            "name": created.name,
            "mode": created.mode,
            "current_stage": created.current_stage,
            "initial_code": getattr(demo, "minimal_replica", "") if demo else "",
            "suggestions": suggestions,
        })


TOOL_REGISTRY: Dict[str, BaseTool] = {
    "skill_state_reader": SkillStateReaderTool(),
    "skill_state_writer": SkillStateWriterTool(),
    "stage_advancer": StageAdvancerTool(),
    "artifact_reader": ArtifactReaderTool(),
    "artifact_writer": ArtifactWriterTool(),
    "evidence_saver": EvidenceSaverTool(),
    "code_runner": CodeRunnerTool(),
    "resource_searcher": ResourceSearcherTool(),
    "project_creator": ProjectCreatorTool(),
}


def get_tool(name: str) -> Optional[BaseTool]:
    return TOOL_REGISTRY.get(name)


def get_all_tools_definitions() -> List[Dict[str, Any]]:
    return [
        {"name": t.name, "description": t.description, "parameters": t.parameters_schema}
        for t in TOOL_REGISTRY.values()
    ]
