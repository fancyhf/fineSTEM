"""
Agent 编排服务（v2：Tool Calling + Skill 路由）

用途：协调 LLM Tool Calling 与 Skill 路由，驱动 PBL 研学流程
维护者：AI Agent
links: .trae/documents/产品与规划/fineSTEM_AI对话流设计规格_v1.0.0.md
"""

from typing import Any, AsyncGenerator, Dict, List, Optional
import re


def _clean_dsml_content(content: str) -> str:
    if not content:
        return content
    cleaned = re.sub(r'<[<｜|/!\-\w\s=":._]*DSML[<｜|/!\-\w\s=":._]*>', '', content, flags=re.IGNORECASE)
    cleaned = re.sub(r'<\|[^|]*\|\|>', '', cleaned)
    cleaned = re.sub(r'<\|[\s\S]*?\|>', '', cleaned)
    cleaned = re.sub(r'^\s*(tool_calls|invoke name=|parameter name=|artifact_writer\b).*$',
                     '',
                     cleaned,
                     flags=re.IGNORECASE | re.MULTILINE)
    if "artifact_writer" in cleaned and ("project_brief" in cleaned or "artifact_name" in cleaned):
        return ""
    safe_lines: list[str] = []
    for raw_line in cleaned.split('\n'):
        line = raw_line.strip()
        if not line:
            continue
        if re.fullmatch(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}", line, flags=re.IGNORECASE):
            continue
        if re.search(r'"op"\s*:\s*"(?:replace|add|remove)"', line) or re.search(r'"path"\s*:\s*"/', line):
            continue
        if re.match(r'^\s*[\[{].*(project_id|tool_call_id|stage_passed|current_stage|teaching_mode).*[\]}]?\s*$', line):
            continue
        safe_lines.append(line)
    return '\n'.join(safe_lines).strip()


def _has_direct_code_intent(message: str) -> bool:
    if not message:
        return False
    return bool(re.search(
        r"(开始编码|开始开发|给我完整的代码|完整代码|用\s*(Python|JavaScript|TypeScript|HTML|CSS)\s*实现|直接进入编码|直接推进到编码|进入执行阶段|直接做|立即做|马上做|不要再问|别再问|别问了|直接实现|直接开发|跳过引导|跳过开题|跳过前置|直接给代码|直接输出代码|直接给出完整代码|写到编辑器|写入编辑器|代码为空|代码是空|没有代码|没代码|重新生成代码|重新写代码|生成代码文件|main\.py\s*(为空|没有|没|空的)|代码文件.*(为空|没有|没|空的))",
        message,
        flags=re.IGNORECASE,
    ))


def _has_strong_code_intent(message: str) -> bool:
    if not message:
        return False
    return bool(re.search(
        r"(开始编码|开始开发|给我完整的代码|完整代码|用\s*(Python|JavaScript|TypeScript|HTML|CSS)\s*实现|直接进入编码|直接推进到编码|进入执行阶段|直接实现|直接开发|直接给代码|直接输出代码|直接给出完整代码|写到编辑器|写入编辑器)",
        message,
        flags=re.IGNORECASE,
    ))
import uuid
import httpx
import time
import json
import logging

from app.core.config import settings
from app.repositories.runtime_db import db
from app.schemas.agent import AgentChatRequest, AgentChatResponse, AgentToolTrace
from app.services.feature_flags import feature_flag_service
from app.services.observability import agent_observability_service
from app.services.providers.zeroclaw_provider import ZeroClawProvider
from app.core.time_utils import utc_now
from app.services.skill_registry import (
    match_skill,
    skill_registry_v2,
    SKILL_REGISTRY,
)
from app.services.tools import get_tool, get_all_tools_definitions, ToolResult
from app.services.pbl_engine import ARTIFACT_TO_BLOB_KEY, advance_with_gate, save_artifact

logger = logging.getLogger(__name__)

MAX_TOOL_CALL_ROUNDS = 5
SKILL_HINT_PATTERN = re.compile(r"^\s*\[\[skill:([A-Za-z0-9_-]+)\]\]\s*")
VALID_TEACHING_MODES = {"guided", "demo", "hands_on", "lecture"}


class AgentOrchestratorService:
    def __init__(self) -> None:
        self.provider = ZeroClawProvider(
            gateway_url=settings.ZEROCLAW_GATEWAY_URL,
            timeout_seconds=settings.ZEROCLAW_TIMEOUT_SECONDS,
            api_key=settings.ZEROCLAW_API_KEY,
        )

    @staticmethod
    def _strip_skill_hint(message: str) -> str:
        if not message:
            return message
        return SKILL_HINT_PATTERN.sub("", message, count=1).strip()

    @staticmethod
    def _get_requested_skill_id(req: AgentChatRequest) -> str | None:
        if req.skill_id:
            return req.skill_id
        if not req.message:
            return None
        match = SKILL_HINT_PATTERN.match(req.message)
        return match.group(1) if match else None

    @staticmethod
    def _get_request_project_id(req: AgentChatRequest) -> str:
        if req.project_id:
            return req.project_id
        context = req.context or {}
        for key in ("project_id", "projectId"):
            value = context.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    @classmethod
    def _resolve_skill(cls, req: AgentChatRequest):
        """优先使用前端显式选择的 skill，避免被关键词误路由到无关技能。"""
        if not req.enable_tools:
            return None
        requested_skill_id = cls._get_requested_skill_id(req)
        user_message = cls._strip_skill_hint(req.message)
        if requested_skill_id:
            selected_skill = skill_registry_v2.get_skill(requested_skill_id)
            if selected_skill:
                logger.info(
                    "skill_resolved_by_request requested=%s resolved=%s",
                    requested_skill_id,
                    selected_skill.skill_id,
                )
                return selected_skill
            logger.warning("skill_request_not_found requested=%s", requested_skill_id)
        matched_skill = match_skill(user_message)
        if matched_skill:
            logger.info("skill_resolved_by_match matched=%s", matched_skill.skill_id)
        else:
            logger.info("skill_resolved_by_match matched=None")
        return matched_skill

    @staticmethod
    def _get_current_stage(req: AgentChatRequest) -> str:
        context = req.context or {}
        for key in ("current_stage", "currentStage"):
            value = context.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        project_id = AgentOrchestratorService._get_request_project_id(req)
        if project_id:
            current_state = db.get_skill_state(project_id)
            stage = getattr(current_state, "current_stage", "") if current_state else ""
            if stage:
                return stage
        return ""

    @staticmethod
    def _get_teaching_mode(req: AgentChatRequest) -> str:
        context = req.context or {}
        for key in ("teaching_mode", "teachingMode"):
            value = context.get(key)
            if isinstance(value, str) and value.strip() in VALID_TEACHING_MODES:
                return value.strip()

        project_id = AgentOrchestratorService._get_request_project_id(req)
        if project_id:
            current_state = db.get_skill_state(project_id)
            if current_state:
                metadata = getattr(current_state, "metadata", {}) or {}
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except Exception:
                        metadata = {}
                teaching_mode = metadata.get("teachingMode", "guided")
                if isinstance(teaching_mode, str) and teaching_mode in VALID_TEACHING_MODES:
                    return teaching_mode
        return "guided"

    @classmethod
    def _build_teaching_mode_instruction(cls, req: AgentChatRequest) -> str:
        current_stage = cls._get_current_stage(req)
        teaching_mode = cls._get_teaching_mode(req)
        if not current_stage.startswith("stage_07") and not current_stage.startswith("stage_08"):
            return ""

        instructions = {
            "guided": """
## 当前教学模式：guided（引导式）
- 优先给学生一个最小代码框架、分步填空点或待完成的小目标，而不是一上来倾倒全部细节。
- 回答结构优先使用：先做什么 → 学生自己补哪一块 → 你再给关键提示。
- 如果要给代码，优先给可运行骨架和关键片段，并明确指出“下一步你来补什么”。
""".strip(),
            "demo": """
## 当前教学模式：demo（演示式）
- 先展示完整、最小可运行版本，再解释整体结构与模仿路径。
- 回答结构优先使用：完整示例 → 模块拆解 → 建议学生照着改的 2-3 个点。
- 不要把代码拆得太碎，重点让学生先看见完整结果。
""".strip(),
            "hands_on": """
## 当前教学模式：hands_on（动手式）
- 优先把任务拆成一个学生可独立尝试的小挑战，先让学生动手，再给提示。
- 默认不要直接给完整答案，除非学生明确卡住、主动要完整代码，或当前问题已经阻塞继续推进。
- 回答结构优先使用：本轮任务 → 验证标准 → 常见报错提示 → 必要时补关键代码。
""".strip(),
            "lecture": """
## 当前教学模式：lecture（讲解式）
- 先讲清原理、概念、结构和为什么这样设计，再进入代码。
- 回答结构优先使用：概念解释 → 设计思路 → 关键代码 → 结果验证。
- 如果给代码，必须配合解释关键变量、流程和设计取舍。
""".strip(),
        }
        return instructions.get(teaching_mode, "")

    @classmethod
    def _is_achievement_scene(cls, req: AgentChatRequest) -> bool:
        context = req.context or {}
        scene = context.get("scene")
        current_stage = cls._get_current_stage(req)
        if scene == "generate_achievement":
            return True
        return scene == "continue_stage" and current_stage == "stage_08_evaluate"

    @classmethod
    def _build_scene_instruction(cls, req: AgentChatRequest) -> str:
        if not cls._is_achievement_scene(req):
            return ""
        return """
## 当前特殊场景：成果档案卡生成
- 这是成果档案卡生成/验收收口场景，不是代码演示或路径探查场景。
- 禁止输出 `with open(...)`、`print(f.read())`、`python</`、伪代码、文件路径探查脚本。
- 如果当前材料已经足够，必须优先调用 `achievement_card` 工具创建或更新成果档案卡。
- 如需补充信息，只能围绕成果卡字段提问：一句话介绍、解决问题、方法、反思。
- 禁止输出与当前任务无关的通用问题，例如“接下来你想怎么做？”、“换个方向”等。
""".strip()

    def _should_force_code_generation(self, req: AgentChatRequest) -> bool:
        """
        判断是否进入强制代码生成路径。

        与 stem-pbl-guide Skill 状态机严格对齐：
        - 仅 stage_05_design / stage_07_execute / stage_08_evaluate 允许产出可执行代码块；
          stage_05 才生成初始代码框架，stage_07 才正式开发，stage_08 才修订与验收。
        - stage_00～stage_04（含范围裁剪 stage_03_constraints）阶段，无论用户怎么说
          "代码为空 / 没代码 / 重新生成" 等关键词，都不进入 force_code_generation；
          应在系统提示词里引导回当前阶段任务（如 must-have / wont-do）。
        - context.force_code_generation 显式信号最高优先级（前端已做阶段联合判断）。
        """
        context = req.context or {}
        forced_by_context = bool(context.get("force_code_generation"))
        if forced_by_context:
            return True
        normalized_message = self._strip_skill_hint(req.message)
        project_id = self._get_request_project_id(req)
        if not project_id:
            return False
        if _has_strong_code_intent(normalized_message):
            return True
        current_stage = self._get_current_stage(req)
        ALLOWED_CODE_STAGES = {
            "stage_05_design",
            "stage_07_execute",
            "stage_08_evaluate",
        }
        if current_stage not in ALLOWED_CODE_STAGES:
            return False
        if current_stage == "stage_07_execute":
            return True
        return _has_direct_code_intent(normalized_message)

    @staticmethod
    def _contains_executable_code_block(content: str) -> bool:
        """检测响应中是否含有可执行语言的完整 Markdown 代码块。

        仅 python/javascript/typescript/html/css 这些"可写入编辑器"的语言才算
        合法代码产出；text/json/markdown/bash 等不算（避免 AI 用 ```text streamlit run...
        这样的命令块伪装成代码已生成）。
        """
        if not content:
            return False
        executable_langs = {"python", "py", "javascript", "js", "typescript", "ts",
                            "tsx", "jsx", "html", "css"}
        # 匹配完整代码块：```lang\n...\n```
        pattern = re.compile(r"```(\w+)?\n([\s\S]*?)```", re.MULTILINE)
        for match in pattern.finditer(content):
            lang = (match.group(1) or "").strip().lower()
            code = (match.group(2) or "").strip()
            if lang in executable_langs and len(code) > 30:
                return True
        return False

    @staticmethod
    def _extract_executable_code_block(content: str) -> dict[str, str] | None:
        """提取最适合写入编辑器的可执行 Markdown 代码块。"""
        if not content:
            return None
        executable_langs = {
            "python", "py", "javascript", "js", "typescript", "ts",
            "tsx", "jsx", "html", "css",
        }
        candidates: list[dict[str, str]] = []
        pattern = re.compile(r"```(\w+)?\n([\s\S]*?)```", re.MULTILINE)
        for match in pattern.finditer(content):
            language = (match.group(1) or "").strip().lower()
            code = (match.group(2) or "").strip()
            if language in executable_langs and len(code) > 30:
                candidates.append({
                    "language": AgentOrchestratorService._normalize_code_language(language),
                    "code": code,
                })
        if not candidates:
            return None
        html_candidate = next((item for item in candidates if item["language"] == "html"), None)
        if html_candidate:
            return html_candidate
        return max(candidates, key=lambda item: len(item["code"]))

    @staticmethod
    def _normalize_code_language(language: str) -> str:
        normalized = (language or "html").lower()
        if normalized == "py":
            return "python"
        if normalized == "js":
            return "javascript"
        if normalized == "ts":
            return "typescript"
        return normalized

    @staticmethod
    def _guess_code_filename(language: str) -> str:
        normalized = AgentOrchestratorService._normalize_code_language(language)
        if normalized == "html":
            return "index.html"
        if normalized == "javascript":
            return "main.js"
        if normalized == "typescript":
            return "main.ts"
        if normalized == "css":
            return "style.css"
        if normalized == "python":
            return "main.py"
        return "main.txt"

    @staticmethod
    def _build_code_generated_payload(project_id: str, code: str, language: str, saved_at: str) -> dict[str, Any]:
        filename = AgentOrchestratorService._guess_code_filename(language)
        return {
            "project_id": project_id,
            "code": code,
            "language": AgentOrchestratorService._normalize_code_language(language),
            "filename": filename,
            "files": [{
                "name": filename,
                "language": AgentOrchestratorService._normalize_code_language(language),
                "content": code,
                "is_main": True,
            }],
            "saved_at": saved_at,
        }

    @staticmethod
    def _build_fallback_code(req: AgentChatRequest) -> dict[str, str]:
        """强制编码但模型未产出源码时，生成最小可运行代码兜底。"""
        context = req.context or {}
        preferred = str(context.get("preferred_output_language") or "").lower()
        message = AgentOrchestratorService._strip_skill_hint(req.message)
        if preferred == "python" or re.search(r"python|猜数字|命令行", message, re.IGNORECASE):
            return {
                "language": "python",
                "code": """import random


def main():
    answer = random.randint(1, 100)
    tries = 0
    print("欢迎来到猜数字游戏！我已经想好了 1 到 100 之间的一个整数。")
    while True:
        raw_value = input("请输入你的猜测：")
        if raw_value.lower() in {"q", "quit", "exit"}:
            print(f"游戏结束，正确答案是 {answer}。")
            break
        try:
            guess = int(raw_value)
        except ValueError:
            print("请输入整数，或输入 q 退出。")
            continue
        tries += 1
        if guess < answer:
            print("低了，再试试。")
        elif guess > answer:
            print("高了，再试试。")
        else:
            print(f"恭喜你猜对了！一共用了 {tries} 次。")
            break


if __name__ == "__main__":
    main()
""",
            }
        return {
            "language": "html",
            "code": """<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>fineSTEM MVP</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #ecfeff; }
    main { width: min(560px, 92vw); padding: 28px; border-radius: 18px; background: white; box-shadow: 0 18px 50px rgba(15, 118, 110, 0.18); }
    h1 { margin-top: 0; color: #0f766e; }
    button { border: 0; border-radius: 10px; padding: 10px 16px; background: #0d9488; color: white; cursor: pointer; }
    #result { margin-top: 16px; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>我的 STEM 项目 MVP</h1>
    <p>这是一个可运行的最小版本，你可以继续让 AI 按你的项目主题扩展功能。</p>
    <button id="actionButton">点击验证交互</button>
    <div id="result">等待操作...</div>
  </main>
  <script>
    const button = document.querySelector('#actionButton');
    const result = document.querySelector('#result');
    let count = 0;
    button.addEventListener('click', () => {
      count += 1;
      result.textContent = `已成功运行 ${count} 次。`;
    });
  </script>
</body>
</html>
""",
        }

    def _is_complete_missing_artifacts_request(self, req: AgentChatRequest) -> bool:
        """识别“现在补/一次性补全”这类确定性补全文档请求。"""
        if not req.project_id:
            return False
        normalized_message = self._strip_skill_hint(req.message)
        compact_message = re.sub(r"\s+", "", normalized_message)
        if not compact_message:
            return False
        return bool(re.search(
            r"(回答[:：]?(现在补|立即补|开始补|补全|一次性补全|全部补上)|现在补|立即补|开始补|补全(剩余|缺失|所有|全部)?(文档|工件|资料)|一次性(生成|补全|补齐|补上)|全部补上|推进到验收)",
            compact_message,
            flags=re.IGNORECASE,
        ))

    @staticmethod
    def _build_bootstrap_followup(req: AgentChatRequest) -> tuple[str, dict[str, Any]] | None:
        """Bootstrap 基础三问的确定性续问，避免 LLM 输出半截问题但没有 option。"""
        message = AgentOrchestratorService._strip_skill_hint(req.message or "")
        if not message.startswith("[选择]"):
            return None
        compact_message = re.sub(r"\s+", "", message)

        if re.search(r"(年级|几年级).*回答[:：]?(初中|高中|小学|初一|初二|初三|高一|高二|高三)", compact_message):
            content = "好的，收到！接下来想确认你的时间安排。"
            question = {
                "id": f"q-bootstrap-time-{int(utc_now().timestamp())}",
                "title": "你打算花多长时间完成这个项目？",
                "options": [
                    {"id": "time-2h", "label": "2小时", "description": "适合做最小可运行版本"},
                    {"id": "time-6h", "label": "6小时", "description": "适合完成完整小项目", "recommended": True},
                    {"id": "time-12h", "label": "12小时+", "description": "适合加入更多功能和展示效果"},
                ],
                "multiple": False,
                "allow_custom": True,
                "stage": "stage_00_bootstrap",
                "step": 2,
                "total_steps": 3,
            }
            return content, question

        if re.search(r"(多长时间|时间).*回答[:：]?(2小时|6小时|12小时|半天|一天|两天|一周|\d+小时)", compact_message):
            content = "好的，时间安排已记录。最后一个问题：你现在有没有初步项目想法？"
            question = {
                "id": f"q-bootstrap-idea-{int(utc_now().timestamp())}",
                "title": "你有初步想法了吗？",
                "options": [
                    {
                        "id": "brainstorm",
                        "label": "完全没想法，需要脑爆",
                        "description": "从零开始，一起探索可做的项目方向",
                    },
                    {
                        "id": "direction",
                        "label": "有个大概方向",
                        "description": "我知道想做什么类型，但还需要一起收敛",
                    },
                    {
                        "id": "idea",
                        "label": "已经有具体想法",
                        "description": "直接基于我的想法进入立项和方案设计",
                        "recommended": True,
                    },
                ],
                "multiple": False,
                "allow_custom": True,
                "stage": "stage_00_bootstrap",
                "step": 3,
                "total_steps": 3,
                "is_stage_final": True,
            }
            return content, question

        return None

    def _build_completion_artifact_content(
        self,
        artifact_name: str,
        project_name: str,
        current_stage: str,
        source_summary: str,
    ) -> str:
        """根据已确认上下文生成阶段工件内容，未确认信息显式标注待确认。"""
        safe_project_name = project_name or "未命名项目"
        source_block = source_summary.strip()[:1200] or "当前对话中没有更多可用细节。"
        common_header = (
            f"# {safe_project_name} - {artifact_name}\n\n"
            f"- 生成方式：根据当前对话和项目状态自动整理\n"
            f"- 当前阶段：{current_stage or '未知'}\n"
            f"- 注意：未在对话中确认的信息均标注为“待确认”，不虚构事实。\n\n"
            f"## 可用上下文\n{source_block}\n\n"
        )
        templates = {
            "brainstorm": "## 脑爆记录\n- 核心方向：围绕项目名称和已确认想法展开。\n- 候选方向：待确认。\n- 推荐方向：优先选择最小可运行、可展示、可验收的方案。\n",
            "project_brief": "## 项目立项书\n- 项目目标：完成一个可运行、可演示、可复盘的 STEM 项目。\n- 目标用户：待确认。\n- 成功标准：能运行、能说明原理、能展示结果。\n- 风险预案：若时间不足，优先保留核心功能，延后美化和扩展。\n",
            "constraints": "## 范围裁剪\n### must-have\n1. 可运行的核心功能。\n2. 清晰的输入、处理和输出流程。\n3. 可展示的结果或界面。\n\n### nice-to-have\n1. 更好的视觉样式。\n2. 更多交互反馈。\n\n### won't-have\n1. 暂不做复杂账号系统。\n2. 暂不接入未确认的第三方服务。\n",
            "track_plan": "## 技术轨道\n- 推荐轨道：轻量 Web / Python 原型，按项目已有代码形态确认。\n- 选择理由：依赖少、反馈快、适合课堂展示。\n- 替代方案：如果运行环境受限，先用单文件 HTML 或 Python 标准库版本。\n",
            "design": "## 设计蓝图\n- 页面/模块：输入区、核心处理区、结果展示区。\n- 数据流：用户输入 -> 核心逻辑处理 -> 展示/反馈。\n- 验收用例：\n  1. 正常输入时能得到结果。\n  2. 空输入或异常输入时有提示。\n  3. 结果能被学生解释和展示。\n",
            "step_plan": "## 分步计划\n### 里程碑 1：基础框架\n- run：打开或运行项目入口。\n- check：能看到初始界面或输出。\n- rollback：回退到上一版入口文件。\n\n### 里程碑 2：核心功能\n- run：实现核心逻辑并运行。\n- check：核心用例通过。\n- rollback：保留最小可运行版本。\n\n### 里程碑 3：完善与验收\n- run：补充提示、样式和说明。\n- check：按验收用例逐条检查。\n- rollback：移除非必要扩展。\n",
            "dev_log": "## 开发日志\n- 已完成：根据当前项目状态整理开发记录。\n- 当前证据：待补充运行截图、运行日志或演示记录。\n- 后续动作：运行核心用例并记录结果。\n",
            "evaluate": "## 验收评估\n- 验收项 1：项目是否能运行。状态：待人工复核。\n- 验收项 2：核心功能是否符合目标。状态：待人工复核。\n- 反思 1：先完成最小可运行版本，再逐步扩展。\n- 反思 2：每一步都应保留运行证据。\n- 下一步：补充真实运行截图/日志后完成最终成果档案。\n",
        }
        return common_header + templates.get(artifact_name, "## 工件内容\n- 待确认。\n")

    def _complete_missing_artifacts(self, req: AgentChatRequest, owner_id: str) -> dict[str, Any]:
        """确定性补齐 PBL 工件，并按门禁尽可能推进到验收阶段。"""
        project_id = req.project_id
        if not project_id:
            return {"success": False, "message": "缺少项目 ID，无法补全文档。"}
        state = db.get_skill_state(project_id)
        project = db.get_project(project_id)
        if not state or not project:
            return {"success": False, "message": "未找到项目或 SKILL_STATE，无法补全文档。"}

        standard_data_raw = getattr(state, "standard_step_data", {})
        if isinstance(standard_data_raw, str):
            try:
                standard_data = json.loads(standard_data_raw)
            except json.JSONDecodeError:
                standard_data = {}
        else:
            standard_data = standard_data_raw if isinstance(standard_data_raw, dict) else {}

        history_messages = self._build_history_messages(req)
        source_summary = "\n".join(
            f"{item.get('role')}: {str(item.get('content') or '').strip()}"
            for item in history_messages[-8:]
            if str(item.get("content") or "").strip()
        )
        current_stage = getattr(state, "current_stage", "")
        project_name = getattr(project, "name", "")
        saved: list[dict[str, Any]] = []
        skipped: list[str] = []

        for artifact_name, blob_key in ARTIFACT_TO_BLOB_KEY.items():
            existing_content = standard_data.get(blob_key)
            if isinstance(existing_content, str) and existing_content.strip():
                skipped.append(artifact_name)
                continue
            content = self._build_completion_artifact_content(
                artifact_name=artifact_name,
                project_name=project_name,
                current_stage=current_stage,
                source_summary=source_summary,
            )
            result = save_artifact(project_id, artifact_name, content, db)
            saved.append(result)
            standard_data[blob_key] = content

        transitions: list[dict[str, Any]] = []
        for _ in range(10):
            before_state = db.get_skill_state(project_id)
            before_stage = getattr(before_state, "current_stage", "") if before_state else ""
            advance_result = advance_with_gate(project_id, db)
            if not advance_result.get("success"):
                break
            after_stage = str(advance_result.get("new_stage") or "")
            transitions.append(advance_result)
            if not after_stage or after_stage == before_stage or after_stage == "stage_08_evaluate":
                break

        final_state = db.get_skill_state(project_id)
        final_stage = getattr(final_state, "current_stage", current_stage) if final_state else current_stage
        return {
            "success": True,
            "project_id": project_id,
            "saved": saved,
            "skipped_existing": skipped,
            "transitions": transitions,
            "final_stage": final_stage,
            "message": "已按当前可用信息补齐缺失工件，并按门禁推进阶段。",
        }

    @staticmethod
    def _format_completion_report(result: dict[str, Any]) -> str:
        """将确定性补全文档结果格式化为用户可读报告。"""
        if not result.get("success"):
            return str(result.get("message") or "补全文档失败。")
        saved = result.get("saved") or []
        skipped = result.get("skipped_existing") or []
        transitions = result.get("transitions") or []
        lines = ["已执行补全文档流程。", ""]
        if saved:
            lines.append("## 本次补齐")
            for item in saved:
                lines.append(f"- {item.get('artifact_name')} -> {item.get('path') or '已写入'}")
        if skipped:
            lines.append("")
            lines.append("## 已存在，未重复覆盖")
            for artifact_name in skipped:
                lines.append(f"- {artifact_name}")
        if transitions:
            lines.append("")
            lines.append("## 阶段推进")
            for item in transitions:
                lines.append(f"- {item.get('current_stage')} -> {item.get('new_stage')}")
        lines.append("")
        lines.append(f"当前阶段：{result.get('final_stage') or '未知'}")
        lines.append("说明：未在对话中确认的信息已在文档内标注为“待确认”，没有虚构外部数据。")
        return "\n".join(lines)

    def _resolve_stage_with_fallback(self, skill_def: Any, req: AgentChatRequest) -> tuple[Any, Optional[str]]:
        """
        解析当前阶段：优先关键词路由，失败时回退到 context.current_stage。

        修复场景：用户消息"我们继续协作完成【脑爆选题】"不含阶段 trigger 关键词
        （如"多轮脑爆"），导致 route_to_stage 返回 None，system_prompt 缺少
        当前阶段详细规范，AI 给出与阶段无关的回答。

        回退策略：从 context 或项目状态读取 current_stage，若该 stage 在 skill
        的 stages 字典中存在，则使用它，确保 AI 拿到正确的阶段规范。
        """
        if not skill_def:
            return None, None
        user_message = self._strip_skill_hint(req.message)
        stage = skill_def.route_to_stage(user_message)
        if stage:
            return stage, stage.stage_id
        # 关键词路由失败，回退到 context / 项目状态中的 current_stage
        context_stage = self._get_current_stage(req)
        if context_stage and hasattr(skill_def, "stages"):
            fallback_stage = skill_def.stages.get(context_stage)
            if fallback_stage:
                logger.info(
                    "stage_resolved_by_context_fallback stage=%s (keyword_match_failed)",
                    context_stage,
                )
                return fallback_stage, fallback_stage.stage_id
        return None, None

    async def chat(self, owner_id: str, req: AgentChatRequest) -> AgentChatResponse:
        started = time.perf_counter()
        trace_id = str(uuid.uuid4())
        session_id = req.session_id or str(uuid.uuid4())
        logger.info("agent_chat_start trace_id=%s owner_id=%s", trace_id, owner_id)

        try:
            skill_def = self._resolve_skill(req)
            user_message = self._strip_skill_hint(req.message)
            stage, sub_skill_id = self._resolve_stage_with_fallback(skill_def, req)

            system_prompt = self._build_system_prompt(req, skill_def, sub_skill_id)
            context_block = self._build_context_block(req, owner_id)
            messages = self._build_messages(req, system_prompt, context_block)
            available_tools = self._get_available_tools(skill_def, sub_skill_id, req)

            tool_traces: List[AgentToolTrace] = []
            full_content = ""
            model_name = settings.ZEROCLAW_DEFAULT_MODEL

            for round_idx in range(MAX_TOOL_CALL_ROUNDS):
                content, tool_calls, model = await self._call_llm_with_tools(
                    messages, available_tools, owner_id
                )

                if not tool_calls:
                    full_content = _clean_dsml_content(content) if content else ""
                    model_name = model
                    break

                # 保存工具调用时的AI对话内容
                if content and content.strip():
                    cleaned = _clean_dsml_content(content)
                    if cleaned and cleaned.strip():
                        full_content += cleaned + "\n\n"

                for tc in tool_calls:
                    tool_name = tc.get("function", {}).get("name", "")
                    tool_args_str = tc.get("function", {}).get("arguments", "{}")
                    try:
                        tool_args = json.loads(tool_args_str)
                    except json.JSONDecodeError:
                        tool_args = {}

                    tool_started = time.perf_counter()
                    tool_result = await self._execute_tool(tool_name, tool_args, owner_id)
                    tool_latency = int((time.perf_counter() - tool_started) * 1000)

                    tool_traces.append(AgentToolTrace(
                        tool_name=tool_name,
                        status="success" if tool_result.success else "failed",
                        summary=tool_result.to_string()[:500],
                        duration_ms=tool_latency,
                    ))

                    messages.append({"role": "assistant", "content": None, "tool_calls": [tc]})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "content": tool_result.to_string(),
                    })

            if not full_content and tool_traces:
                snippets = "；".join([f"{t.tool_name}: {t.summary[:100]}" for t in tool_traces])
                full_content = f"已完成分析：{snippets}"

            if req.project_id:
                self._write_auto_evidence(req.project_id, owner_id, full_content, tool_traces)

            response = AgentChatResponse(
                role="assistant",
                content=full_content,
                trace_id=trace_id,
                session_id=session_id,
                used_tools=tool_traces,
                model=model_name,
                created_at=utc_now(),
            )
            latency_ms = int((time.perf_counter() - started) * 1000)
            agent_observability_service.record(success=True, latency_ms=latency_ms)
            logger.info("agent_chat_success trace_id=%s latency_ms=%s tools=%s", trace_id, latency_ms, len(tool_traces))
            return response
        except Exception:
            latency_ms = int((time.perf_counter() - started) * 1000)
            agent_observability_service.record(success=False, latency_ms=latency_ms)
            logger.exception("agent_chat_failed trace_id=%s latency_ms=%s", trace_id, latency_ms)
            raise

    async def stream_chat(self, owner_id: str, req: AgentChatRequest) -> AsyncGenerator[str, None]:
        trace_id = str(uuid.uuid4())
        logger.info("agent_stream_start trace_id=%s owner_id=%s", trace_id, owner_id)

        try:
            skill_def = self._resolve_skill(req)
            user_message = self._strip_skill_hint(req.message)
            stage, sub_skill_id = self._resolve_stage_with_fallback(skill_def, req)

            system_prompt = self._build_system_prompt(req, skill_def, sub_skill_id)
            context_block = self._build_context_block(req, owner_id)
            messages = self._build_messages(req, system_prompt, context_block)
            available_tools = self._get_available_tools(skill_def, sub_skill_id, req)

            tool_traces: List[AgentToolTrace] = []
            full_content = ""
            pre_tool_content = ""  # 保存工具调用前的AI对话内容

            for round_idx in range(MAX_TOOL_CALL_ROUNDS):
                content, tool_calls, model = await self._call_llm_with_tools(
                    messages, available_tools, owner_id
                )

                if not tool_calls:
                    full_content = content or ""
                    break

                # ✅ 关键修复：保存工具调用时的AI对话内容
                if content and content.strip():
                    pre_tool_content = content
                    cleaned_content = _clean_dsml_content(content)
                    if cleaned_content and cleaned_content.strip():
                        full_content += cleaned_content + "\n\n"

                        # 立即输出对话内容给前端（让用户看到对话过程）
                        yield ("token", {"token": cleaned_content})

                        # 检查是否包含question块，如果有立即发送
                        if _contains_question_block(cleaned_content):
                            question_data = _parse_question_block(cleaned_content)
                            if question_data:
                                yield ("question", question_data)

                for tc in tool_calls:
                    tool_name = tc.get("function", {}).get("name", "")
                    tool_args_str = tc.get("function", {}).get("arguments", "{}")
                    try:
                        tool_args = json.loads(tool_args_str)
                    except json.JSONDecodeError:
                        tool_args = {}

                    tool_result = await self._execute_tool(tool_name, tool_args, owner_id)
                    tool_traces.append(AgentToolTrace(
                        tool_name=tool_name,
                        status="success" if tool_result.success else "failed",
                        summary=tool_result.to_string()[:500],
                        duration_ms=0,
                    ))

                    messages.append({"role": "assistant", "content": None, "tool_calls": [tc]})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "content": tool_result.to_string(),
                    })

            chain: list[tuple[str | None, str]] = [(settings.ZEROCLAW_GATEWAY_URL, settings.ZEROCLAW_DEFAULT_MODEL)]
            if feature_flag_service.is_enabled("provider_fallback", owner_id):
                chain.append((settings.ZEROCLAW_FALLBACK_GATEWAY_URL, settings.ZEROCLAW_FALLBACK_MODEL))

            streamed = False
            for gateway, model_name in chain:
                if not gateway:
                    continue
                payload = {
                    "model": model_name,
                    "messages": messages,
                    "stream": True,
                    "tools": self._format_tools_for_api(available_tools) if available_tools else None,
                }
                try:
                    async for token in self.provider.stream_complete(payload, gateway_url=gateway):
                        full_content += token
                        yield token
                        streamed = True
                    break
                except (httpx.HTTPError, RuntimeError):
                    continue

            if not streamed:
                fallback_content, _ = await self._generate_fallback(owner_id, req, tool_traces)
                full_content = fallback_content
                for chunk in self.build_stream_tokens(fallback_content):
                    yield chunk

            if req.project_id:
                self._write_auto_evidence(req.project_id, owner_id, full_content, tool_traces)

            logger.info("agent_stream_success trace_id=%s tools=%s", trace_id, len(tool_traces))
        except Exception:
            logger.exception("agent_stream_failed trace_id=%s", trace_id)
            raise

    async def stream_chat_with_events(
        self, owner_id: str, req: AgentChatRequest
    ) -> AsyncGenerator[tuple[str, Dict[str, Any]], None]:
        trace_id = str(uuid.uuid4())
        logger.info("agent_stream_events_start trace_id=%s owner_id=%s", trace_id, owner_id)

        try:
            skill_def = self._resolve_skill(req)
            user_message = self._strip_skill_hint(req.message)
            stage, sub_skill_id = self._resolve_stage_with_fallback(skill_def, req)
            force_code_generation = self._should_force_code_generation(req)

            if skill_def:
                yield ("skill_activated", {
                    "skill_id": skill_def.skill_id,
                    "skill_name": skill_def.name,
                    "sub_skill_id": sub_skill_id,
                    "sub_skill_name": stage.name if stage else None,
                })

            system_prompt = self._build_system_prompt(req, skill_def, sub_skill_id)
            context_block = self._build_context_block(req, owner_id)
            messages = self._build_messages(req, system_prompt, context_block)
            available_tools = self._get_available_tools(skill_def, sub_skill_id, req)

            tool_traces: List[AgentToolTrace] = []
            full_content = ""
            last_known_stage: str | None = None
            code_generated_sent = False

            if req.project_id:
                current_state = db.get_skill_state(req.project_id)
                if current_state:
                    last_known_stage = current_state.current_stage
                    yield ("stage_changed", {
                        "stage": current_state.current_stage,
                        "stage_name": self._get_stage_display_name(current_state.current_stage),
                    })

            bootstrap_followup = self._build_bootstrap_followup(req)
            if bootstrap_followup:
                full_content, question_data = bootstrap_followup
                yield ("content_update", {"content": full_content})
                yield ("question", question_data)
                yield ("final", {"status": "completed", "tools_used": 0, "content": full_content})
                logger.info("agent_stream_events_bootstrap_followup_success trace_id=%s", trace_id)
                return

            if self._is_complete_missing_artifacts_request(req):
                completion_result = self._complete_missing_artifacts(req, owner_id)
                full_content = self._format_completion_report(completion_result)
                yield ("tool_call", {
                    "tool_name": "complete_missing_artifacts",
                    "success": bool(completion_result.get("success")),
                    "data": completion_result,
                })
                final_stage = str(completion_result.get("final_stage") or last_known_stage or "")
                if final_stage:
                    yield ("stage_changed", {
                        "stage": final_stage,
                        "stage_name": self._get_stage_display_name(final_stage),
                    })
                yield ("content_update", {"content": full_content})
                if req.project_id:
                    self._write_auto_evidence(req.project_id, owner_id, full_content, tool_traces)
                yield ("final", {"status": "completed", "tools_used": 1, "content": full_content})
                logger.info("agent_stream_events_completion_success trace_id=%s", trace_id)
                return

            for round_idx in range(MAX_TOOL_CALL_ROUNDS):
                content, tool_calls, model = await self._call_llm_with_tools(
                    messages, available_tools, owner_id
                )

                # 关键修复：累积工具调用前的 content（AI 在调用工具前已生成的用户可见文字）
                # 类似 stream_chat 中的 pre_tool_content 逻辑
                # 重要：只在有 tool_calls 时才 yield token，避免与第二轮流式调用重复推送
                if tool_calls and content and content.strip():
                    cleaned = _clean_dsml_content(content)
                    if cleaned and cleaned.strip():
                        full_content += cleaned + "\n\n"
                        # 实时把工具调用前的对话内容推给前端（让用户看到思考/引导语）
                        yield ("token", {"token": cleaned})
                        if _contains_question_block(cleaned):
                            question_data = _parse_question_block(cleaned)
                            if question_data:
                                yield ("question", question_data)

                if not tool_calls:
                    break

                for tc in tool_calls:
                    tool_name = tc.get("function", {}).get("name", "")
                    tool_args_str = tc.get("function", {}).get("arguments", "{}")
                    try:
                        tool_args = json.loads(tool_args_str)
                    except json.JSONDecodeError:
                        tool_args = {}

                    yield ("tool_start", {
                        "tool_name": tool_name,
                        "tool_args": tool_args,
                    })

                    tool_result = await self._execute_tool(tool_name, tool_args, owner_id)
                    tool_traces.append(AgentToolTrace(
                        tool_name=tool_name,
                        status="success" if tool_result.success else "failed",
                        summary=tool_result.to_string()[:500],
                        duration_ms=0,
                    ))

                    yield ("tool_end", {
                        "tool_name": tool_name,
                        "success": tool_result.success,
                        "data": tool_result.data if tool_result.success else None,
                        "error": tool_result.error if not tool_result.success else None,
                    })

                    yield ("tool_call", {
                        "tool_name": tool_name,
                        "success": tool_result.success,
                        "data": tool_result.data if tool_result.success else None,
                    })

                    if tool_name == "project_creator" and tool_result.success and tool_result.data:
                        project_data = tool_result.data if isinstance(tool_result.data, dict) else {}
                        created_stage = str(project_data.get("current_stage") or "stage_01_brainstorm")
                        yield ("project_created", {
                            "project_id": project_data.get("project_id", str(uuid.uuid4())),
                            "project_name": project_data.get("name") or project_data.get("project_name", "新项目"),
                            "current_stage": created_stage,
                        })
                        last_known_stage = created_stage
                        yield ("stage_changed", {
                            "stage": created_stage,
                            "stage_name": self._get_stage_display_name(created_stage),
                        })

                    if tool_name == "project_code_writer" and tool_result.success and tool_result.data:
                        code_data = tool_result.data if isinstance(tool_result.data, dict) else {}
                        workspace = db.get_project_workspace(str(code_data.get("project_id") or req.project_id or "")) or {}
                        code = str(workspace.get("code") or "")
                        language = str(workspace.get("language") or code_data.get("language") or "html")
                        if code:
                            code_generated_sent = True
                            yield ("code_generated", {
                                "project_id": code_data.get("project_id") or req.project_id,
                                "code": code,
                                "language": language,
                                "filename": workspace.get("filename") or code_data.get("filename"),
                                "files": workspace.get("files") or [],
                                "saved_at": workspace.get("saved_at") or code_data.get("saved_at"),
                                "source": "tool",
                            })

                    if req.project_id:
                        current_state = db.get_skill_state(req.project_id)
                        if current_state and current_state.current_stage != last_known_stage:
                            last_known_stage = current_state.current_stage
                            yield ("stage_changed", {
                                "stage": current_state.current_stage,
                                "stage_name": self._get_stage_display_name(current_state.current_stage),
                            })

                    messages.append({"role": "assistant", "content": None, "tool_calls": [tc]})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "content": tool_result.to_string(),
                    })

            if full_content and _contains_question_block(full_content) and not force_code_generation:
                question_data = _parse_question_block(full_content)
                if question_data:
                    yield ("question", question_data)

            chain: list[tuple[str | None, str]] = [(settings.ZEROCLAW_GATEWAY_URL, settings.ZEROCLAW_DEFAULT_MODEL)]
            if feature_flag_service.is_enabled("provider_fallback", owner_id):
                chain.append((settings.ZEROCLAW_FALLBACK_GATEWAY_URL, settings.ZEROCLAW_FALLBACK_MODEL))

            streamed = False
            for gateway, model_name in chain:
                if not gateway:
                    continue
                payload = {
                    "model": model_name,
                    "messages": messages,
                    "stream": True,
                }
                try:
                    async for token in self.provider.stream_complete(payload, gateway_url=gateway):
                        full_content += token
                        yield ("token", {"token": token})
                        streamed = True
                    break
                except (httpx.HTTPError, RuntimeError):
                    continue

            if not streamed:
                fallback_content, _ = await self._generate_fallback(owner_id, req, tool_traces)
                full_content = fallback_content
                for chunk in self.build_stream_tokens(fallback_content):
                    yield ("token", {"token": chunk})

            full_content = _clean_dsml_content(full_content)

            # 输出层去重：修复 LLM 重复输出问题（如"好好想法想法"→"好想法"）
            deduped_content = self.deduplicate_repeated_text(full_content)
            if deduped_content != full_content and len(deduped_content) > 0:
                full_content = deduped_content

            # 剥离 question XML 块（内部协议格式，不显示给用户）
            raw_for_question_parse = full_content
            clean_content, has_question = self.strip_question_xml(full_content)
            if clean_content != full_content:
                yield ("content_update", {"content": clean_content})
                full_content = clean_content

            if not force_code_generation:
                # 用原始内容（含XML）解析 question 事件，发送给前端渲染选项卡
                # 关键修复：当 _contains_question_block 为 True 但 _parse_question_block 解析失败时
                # （AI 输出了残破/不规范的 <question>/<option> 标签），必须回退到 fallback，
                # 否则前端永远收不到 question 事件，选项按钮不显示
                question_data = None
                if has_question or _contains_question_block(raw_for_question_parse):
                    question_data = _parse_question_block(raw_for_question_parse)
                    if question_data:
                        question_data["stage"] = last_known_stage
                        question_data["is_stage_final"] = _is_stage_final_question(question_data)
                        yield ("question", question_data)

                # 普通对话不要再硬编码通用按钮。
                # 只有在明确的成果卡补充场景下，才允许用专用 fallback question。
                if not question_data and full_content.strip():
                    fallback_question = self._generate_fallback_question(req, full_content, tool_traces)
                    if fallback_question:
                        yield ("question", fallback_question)
                    else:
                        template_question = self._generate_skill_template_question(skill_def, req)
                        if template_question:
                            yield ("question", template_question)
                        elif has_question or _contains_question_block(raw_for_question_parse):
                            logger.warning("question_block_parse_failed_without_fallback stage=%s", last_known_stage)

            if req.project_id:
                self._write_auto_evidence(req.project_id, owner_id, full_content, tool_traces)

            # 关键校验：在 force_code_generation 模式下，必须输出"完整可执行代码块"
            # 防止 AI 谎称"已写入"但实际只输出 ```text 命令或纯叙述
            if force_code_generation and not code_generated_sent:
                code_result = self._extract_executable_code_block(full_content)
                if code_result and req.project_id:
                    saved_at = utc_now().isoformat()
                    payload = self._build_code_generated_payload(
                        req.project_id,
                        code_result["code"],
                        code_result["language"],
                        saved_at,
                    )
                    db.save_project_workspace(req.project_id, {
                        "code": payload["code"],
                        "language": payload["language"],
                        "filename": payload["filename"],
                        "files": payload["files"],
                        "saved_at": saved_at,
                    }, updated_by=owner_id)
                    code_generated_sent = True
                    payload["source"] = "server_parse"
                    yield ("code_generated", payload)
                elif not code_result and req.project_id:
                    fallback_code = self._build_fallback_code(req)
                    saved_at = utc_now().isoformat()
                    payload = self._build_code_generated_payload(
                        req.project_id,
                        fallback_code["code"],
                        fallback_code["language"],
                        saved_at,
                    )
                    db.save_project_workspace(req.project_id, {
                        "code": payload["code"],
                        "language": payload["language"],
                        "filename": payload["filename"],
                        "files": payload["files"],
                        "saved_at": saved_at,
                    }, updated_by=owner_id)
                    full_content = (
                        (full_content or "").strip()
                        + "\n\n---\n\n已生成一个可运行的最小代码版本，并写入编辑器。"
                    ).strip()
                    yield ("content_update", {"content": full_content})
                    logger.warning(
                        "force_code_generation_fallback_saved trace_id=%s len=%s",
                        trace_id, len(payload["code"]),
                    )
                    code_generated_sent = True
                    payload["source"] = "server_fallback"
                    yield ("code_generated", payload)
                else:
                    yield ("code_generation_failed", {
                        "project_id": req.project_id,
                        "reason": "missing_project_id",
                        "message": "已检测到代码，但缺少项目 ID，无法保存到编辑器工作区。",
                    })

            yield ("final", {"status": "completed", "tools_used": len(tool_traces), "content": full_content})
            logger.info("agent_stream_events_success trace_id=%s tools=%s", trace_id, len(tool_traces))
        except Exception:
            logger.exception("agent_stream_events_failed trace_id=%s", trace_id)
            raise

    def _build_system_prompt(self, req: AgentChatRequest, skill_def: Any, sub_skill_id: Optional[str]) -> str:
        teaching_mode_instruction = self._build_teaching_mode_instruction(req)
        scene_instruction = self._build_scene_instruction(req)
        if self._should_force_code_generation(req):
            force_prompt = """
你是 fineSTEM 的代码生成助手，现在必须直接完成编码实现。

## 强制目标
- 用户已经明确要求直接生成代码
- 当前项目已经处于执行或验收阶段
- 本轮回复必须以“可运行代码”为核心产出

## 强制规则
- 禁止继续追问年级、基础、时间安排、偏好、方案选择
- 禁止继续输出脑爆、开题、范围裁剪、计划确认之类内容
- 禁止输出任何 XML、DSML、tool_calls、artifact、question 协议文本
- 必须输出完整 Markdown 代码块，代码要尽量最小可运行
- **代码块语言标签必须为 python / javascript / html / css / typescript 之一**
- **禁止使用 ```text、```bash、```shell、```cmd、```markdown、```json 等非可执行语言标签**
- **禁止仅输出运行命令（如 `streamlit run src/main.py`）而不附带完整源代码**
- **禁止声称"代码已写入"但实际只输出命令或叙述；必须附上完整 Markdown 代码块作为证据**
- 默认优先生成单文件、零配置、少依赖的版本，但不要默认收窄成 Python 小程序
- 必须根据用户目标和项目类型主动选择最合适的技术形式：
  - 如果是网页、可视化、交互界面、作品展示，优先生成 HTML/CSS/JavaScript 版本
  - 如果是脚本、数据处理、命令行工具、算法演示，可以优先生成 Python 版本
  - 如果用户明确指定语言、框架或已有工作区语言，就严格跟随，不要擅自改成别的语言
- 如果生成 Python 代码，优先使用标准库；如果生成前端代码，优先生成可直接预览的原生 HTML/CSS/JavaScript
- 不要为了"容易执行"把原本应做成网页/界面的需求强行改写成命令行程序
- 若当前环境不适合运行某类程序，也要先给出正确技术方向的代码，再用简短说明交代运行方式
- 先给完整代码，再给 3 条以内的简短运行说明
- 如果工具 `project_code_writer` 可用，必须优先调用它保存同一份完整代码；工具参数必须包含 project_id、code、language、filename

## 输出格式
1. 一句中文说明
2. 一个完整 Markdown 代码块
3. 最多 3 条运行说明

如果信息不完整，也不要继续追问，直接采用最稳妥默认值生成 MVP 代码。
""".strip()
            if teaching_mode_instruction:
                force_prompt += f"\n\n{teaching_mode_instruction}"
            if scene_instruction:
                force_prompt += f"\n\n{scene_instruction}"
            return force_prompt

        direct_code_override = ""
        if skill_def:
            prompt = skill_def.get_system_prompt_for_stage(sub_skill_id)
            current_stage_id = self._get_current_stage(req) or ""
            stage_code_lock = ""
            CODE_ALLOWED_STAGES = {"stage_05_design", "stage_07_execute", "stage_08_evaluate"}
            if current_stage_id and current_stage_id not in CODE_ALLOWED_STAGES:
                stage_code_lock = f"""

---

## 当前阶段代码生成硬约束（最高优先级）

当前阶段是 `{current_stage_id}`，根据 stem-pbl-guide Skill 状态机：
- 本阶段**禁止**输出 ``` 包裹的可执行代码块（python / javascript / typescript / html / css 等）。
- 本阶段**禁止**声称"我已经生成了代码 / 写入了 main.py / 代码已写入编辑器"等说法。
- 即使用户说"代码为空 / 没代码 / 重新生成代码 / main.py 是空的"，也**禁止**直接输出代码；
  必须先回应：当前阶段不产出完整代码，代码框架要在 stage_05_design 才会生成，正式开发在 stage_07_execute。
- 必须先把当前阶段的工件（如 stage_03_constraints 的 must-have / nice-to-have / won't-have）补完，再进入下一阶段。
- 如果用户连续要求生成代码，请引导：先回答当前阶段问题；阶段完成后会自动推进到设计与执行阶段。
"""
            # 追加 XML 交互格式指令，确保需要选择题时输出可解析的 <question> 标签。
            xml_instruction = """

---

## 交互规则（仅在需要学生做选择时使用）

只有当你确实需要学生做选择、补充关键信息、或确认下一步方向时，才输出一个可解析的选项块。

- 当前上下文已经给出的项目 ID、项目名称、当前阶段、年级、时间预算、项目想法都视为已确认信息，禁止再次提问确认。
- 禁止把“项目名称 / 项目名 / 叫什么名字”作为 question，除非上下文明确没有项目名称且用户正在新建项目。
- 如果当前阶段是 stage_02_brief，问题必须围绕问题陈述、目标用户、成功标准、风险预案，不得回到项目名称。
- 如果当前阶段是 stage_03_constraints，问题必须围绕 must-have / nice-to-have / won't-have，不得回到项目名称。
- 如果当前阶段是 stage_05_design，问题必须围绕页面结构、模块、数据流、验收条件，不得回到项目名称。
- 如果当前阶段是 stage_07_execute，禁止再输出 question；必须直接生成可运行代码。
- 如果聊天历史或当前上下文里已经出现过年级、时间预算、初步想法，就不要重复问这三项。
- 如果信息已经足够推进当前阶段，就直接继续推进，不要为了凑交互而重复提问。
- 如果年级、时间预算、初步想法已经齐全，必须主动给出具体创意方向、MVP 方案或实现建议，不能继续停留在空泛提问。
- 如果用户明确要求“直接进入编码实现 / 直接给代码 / 写入编辑器 / 直接做”，且当前上下文已明确要求跳过引导或当前已在执行/验收阶段，才切到编码实现；否则继续当前 PBL 阶段，先给创意收敛、方向选择或方案建议。
- 生成代码、给出设计方案、总结结果时，默认不要额外附带 `<question>`，除非下一步真的需要用户选择。
- 同一轮回复最多包含一个 `<question>` 块。
- 禁止输出通用标题，例如“接下来你想怎么做？”、“你想怎么继续？”、“请选择”。
- 禁止输出通用按钮，例如“继续 / 详细说说 / 换个方向 / 了解更多”；按钮必须直接对应当前阶段、当前材料缺口或当前方案分支。

```xml
<question type="single" title="脑暴方向里，你更想先收敛哪一种？">
<option id="opt_poetry" label="古诗词生成器">先做一个能输入关键词生成古诗的小工具</option>
<option id="opt_story" label="互动故事机">先做一个能根据选择推进剧情的网页故事</option>
<option id="opt_other" label="其他">我有其他想法</option>
</question>
```

当你决定提问时：
- 优先使用 `<question>` / `<option>` XML。
- 如果你沿用阶段文档里的 AskUserQuestion 示例，也可以输出等价的 JSON 结构。
- 如果你已经在正文里列出 2-6 个明确备选项，也可以直接输出清晰的编号列表，每个选项单独一行。
- 选项要和当前阶段强相关，避免回到已经问过的起始问题。
- question 的 title 必须能单独成立，用户只看按钮区也能知道自己在选什么。
- 不要把选项藏在大段散文里；要让系统能够从 XML、JSON 或编号列表中稳定提取出来。
"""
            full_prompt = prompt + direct_code_override + xml_instruction + stage_code_lock
            if teaching_mode_instruction:
                full_prompt += f"\n\n{teaching_mode_instruction}"
            if scene_instruction:
                full_prompt += f"\n\n{scene_instruction}"
            return full_prompt

        from app.services.providers.zeroclaw_provider import build_system_prompt
        fallback_prompt = build_system_prompt(req.context or {}) + direct_code_override
        if teaching_mode_instruction:
            fallback_prompt += f"\n\n{teaching_mode_instruction}"
        if scene_instruction:
            fallback_prompt += f"\n\n{scene_instruction}"
        return fallback_prompt

    def _build_context_block(self, req: AgentChatRequest, owner_id: str) -> str:
        parts: List[str] = []
        if req.project_id:
            parts.append(f"当前项目ID: {req.project_id}")
            project = db.get_project(req.project_id)
            if project:
                parts.append(f"项目名称: {getattr(project, 'name', '')}")
                parts.append(f"当前阶段: {getattr(project, 'current_stage', '')}")
                parts.append(f"项目模式: {getattr(project, 'mode', '')}")
                state = db.get_skill_state(req.project_id)
                if state:
                    import json as _json
                    metadata_raw = getattr(state, "metadata", "{}")
                    metadata = _json.loads(metadata_raw) if isinstance(metadata_raw, str) else metadata_raw
                    teaching_mode = metadata.get("teachingMode", "guided")
                    parts.append(f"教学模式: {teaching_mode}")
                    evidence_count = db.count_evidence(req.project_id)
                    parts.append(f"证据数量: {evidence_count}")
        profile = self._collect_confirmed_profile(req)
        if profile.get("grade"):
            parts.append(f"已确认年级: {profile['grade']}")
        if profile.get("timeBudget"):
            parts.append(f"已确认时间预算: {profile['timeBudget']}")
        if profile.get("idea"):
            parts.append(f"已确认项目想法: {profile['idea']}")
        confirmed_fields = [name for name in ("grade", "timeBudget", "idea") if profile.get(name)]
        if confirmed_fields:
            missing_labels: List[str] = []
            if not profile.get("grade"):
                missing_labels.append("年级")
            if not profile.get("timeBudget"):
                missing_labels.append("时间预算")
            if not profile.get("idea"):
                missing_labels.append("初步想法")
            if missing_labels:
                parts.append(f"首次信息采集状态: 已确认部分基础信息；仅可追问缺失项：{'、'.join(missing_labels)}。")
            else:
                parts.append("首次信息采集状态: 年级、时间预算、初步想法均已确认，禁止重复追问。")
        context = req.context or {}
        if context.get("scene"):
            parts.append(f"场景: {context['scene']}")
        if context.get("project_name"):
            parts.append(f"前端已确认项目名称: {context['project_name']}")
        if context.get("force_code_generation"):
            parts.append("本轮强制目标: 直接生成可运行代码，禁止继续提问。")
        if context.get("preferred_output_language"):
            parts.append(f"期望输出语言: {context['preferred_output_language']}")
        if context.get("teaching_mode"):
            parts.append(f"请求教学模式: {context['teaching_mode']}")
        if context.get("demo_id"):
            parts.append(f"当前Demo ID: {context['demo_id']}")
        parts.append(
            "【禁止行为（最高优先级）】"
            "禁止把 project_id（UUID 格式）写入回复正文；"
            "禁止在正文中输出 'Skill' / 'skill_state_writer' / 工具名称等内部标识符；"
            "禁止伪造工具调用——需要写入文档时必须真正调用 skill_state_writer 工具，"
            "不得只在文字里声称'已写入'或'已生成'而不实际调用工具。"
        )
        return "\n".join(parts) if parts else ""

    def _build_messages(self, req: AgentChatRequest, system_prompt: str, context_block: str) -> List[Dict[str, Any]]:
        messages: List[Dict[str, Any]] = []
        full_system = system_prompt
        if context_block:
            full_system += f"\n\n## 当前上下文\n{context_block}"
        messages.append({"role": "system", "content": full_system})
        history_messages = self._build_history_messages(req)
        if history_messages:
            messages.extend(history_messages)
        messages.append({"role": "user", "content": self._strip_skill_hint(req.message)})
        return messages

    def _build_history_messages(self, req: AgentChatRequest) -> List[Dict[str, str]]:
        raw_messages: List[Any] = list(req.messages or [])
        if not raw_messages and req.project_id:
            workspace = db.get_project_workspace(req.project_id) or {}
            raw_messages = workspace.get("chat_messages") or []

        history_messages: List[Dict[str, str]] = []
        for item in raw_messages[-12:]:
            role = getattr(item, "role", None)
            content = getattr(item, "content", None)
            if isinstance(item, dict):
                role = item.get("role")
                content = item.get("content")
            if role not in {"user", "assistant"}:
                continue
            if not isinstance(content, str):
                continue
            cleaned_content = content.strip()
            if not cleaned_content:
                continue
            history_messages.append({"role": role, "content": cleaned_content})
        return history_messages

    @staticmethod
    def _is_generic_project_name(project_name: str) -> bool:
        """
        过滤创建阶段的通用项目名，避免把“我想做一个项目”误判成已有具体想法。
        """
        normalized = re.sub(r"\s+", "", project_name or "")
        normalized = re.sub(r"[。.!！？,，、…]+$", "", normalized)
        normalized = re.sub(r"\.{3,}$", "", normalized)
        if not normalized:
            return True
        if normalized in {"未命名项目", "新项目", "创建新项目", "开始项目"}:
            return True
        return bool(re.fullmatch(
            r"(?:我想做(?:一?个)?项目(?:[，,、]?(?:帮我(?:选题(?:和规划)?|规划)|先(?:选题|脑爆)|需要(?:选题|脑爆)|一起(?:选题|规划)))?|帮我(?:选题(?:和规划)?|规划))",
            normalized,
        ))

    def _collect_confirmed_profile(self, req: AgentChatRequest) -> Dict[str, str]:
        history_messages = self._build_history_messages(req)
        text_parts = [item["content"] for item in history_messages if item.get("content")]
        user_text_parts = [item["content"] for item in history_messages if item.get("role") == "user" and item.get("content")]
        current_message = self._strip_skill_hint(req.message)
        if current_message:
            text_parts.append(current_message)
            user_text_parts.append(current_message)

        project_name = ""
        if req.project_id:
            project = db.get_project(req.project_id)
            if project and getattr(project, "name", ""):
                project_name = str(getattr(project, "name", "")).strip()

        full_text = "\n".join(text_parts)
        user_text = "\n".join(user_text_parts)
        profile: Dict[str, str] = {}

        grade_matches = re.findall(r"(初中生|高中生|初中|高中)", full_text)
        if grade_matches:
            raw_grade = grade_matches[-1]
            profile["grade"] = "高中" if "高" in raw_grade else "初中"

        time_matches = re.findall(
            r"((?:\d+\s*-\s*\d+|\d+\s*到\s*\d+|\d+)\s*小时(?:间)?(?:以上|\+)?|半天|一天|两天|一周|2小时|4-6小时|6小时|12小时\+?)",
            full_text,
            flags=re.IGNORECASE,
        )
        if time_matches:
            profile["timeBudget"] = re.sub(r"\s+", "", time_matches[-1])

        if project_name and not self._is_generic_project_name(project_name):
            profile["idea"] = project_name
        else:
            if re.search(r"回答[:：]?(完全没想法|有个大概方向|已经有具体想法|需要脑爆)", user_text):
                profile["idea"] = "需要脑爆" if "完全没想法" in user_text or "需要脑爆" in user_text else "已确认起点"
                return profile
            # idea 只能从用户表达中提取，避免把 assistant 的“做一个超简单的MVP”误判成已确认想法。
            idea_match = re.search(r"(?:想做一个项目[，,：:]?|做一个|项目主题是|主题是)([^。\n]{4,60})", user_text)
            if idea_match:
                profile["idea"] = idea_match.group(1).strip(" ，,：:")

        return profile

    def _get_available_tools(self, skill_def: Any, sub_skill_id: Optional[str], req: Optional[AgentChatRequest] = None) -> List[str]:
        if req and self._should_force_code_generation(req):
            return ["project_code_writer", "code_runner"]
        if not skill_def:
            tools = ["skill_state_reader", "resource_searcher", "code_runner"]
        else:
            tools = skill_def.get_tools_for_stage(sub_skill_id)
        if req and self._is_achievement_scene(req):
            tools = list(tools) + ["artifact_reader", "resource_searcher", "achievement_card"]
        return list(dict.fromkeys(tools))

    def _format_tools_for_api(self, tool_names: List[str]) -> List[Dict[str, Any]]:
        all_defs = {t["name"]: t for t in get_all_tools_definitions()}
        result = []
        for name in tool_names:
            if name in all_defs:
                result.append({"type": "function", "function": all_defs[name]})
        return result

    async def _call_llm_with_tools(
        self,
        messages: List[Dict[str, Any]],
        available_tools: List[str],
        owner_id: str,
    ) -> tuple[str, List[Dict[str, Any]], str]:
        chain: list[tuple[str | None, str]] = [(settings.ZEROCLAW_GATEWAY_URL, settings.ZEROCLAW_DEFAULT_MODEL)]
        if feature_flag_service.is_enabled("provider_fallback", owner_id):
            chain.append((settings.ZEROCLAW_FALLBACK_GATEWAY_URL, settings.ZEROCLAW_FALLBACK_MODEL))

        tools_api = self._format_tools_for_api(available_tools) if available_tools else None

        for gateway, model in chain:
            if not gateway:
                continue
            payload = {
                "model": model,
                "messages": messages,
                "stream": False,
            }
            if tools_api:
                payload["tools"] = tools_api
                payload["tool_choice"] = "auto"

            try:
                result = await self.provider.complete_with_tool_calls(payload, gateway_url=gateway)
                return result["content"], result["tool_calls"], model
            except (httpx.HTTPError, RuntimeError):
                continue

        if settings.ZEROCLAW_ENABLE_MOCK_FALLBACK:
            return "AI 模型暂时不可用，请稍后重试。", [], settings.ZEROCLAW_LOCAL_SAFE_MODEL
        raise RuntimeError("ZeroClaw 网关调用失败，且已禁用 Mock 回退")

    async def _execute_tool(self, tool_name: str, params: Dict[str, Any], owner_id: str) -> ToolResult:
        tool = get_tool(tool_name)
        if not tool:
            return ToolResult(False, error=f"未知工具: {tool_name}")
        try:
            if tool_name == "project_creator":
                params = {
                    **params,
                    "author_id": owner_id,
                }
            return await tool.execute(params)
        except Exception as exc:
            logger.exception("tool_execution_failed tool=%s", tool_name)
            return ToolResult(False, error=f"工具执行失败: {exc}")

    def _write_auto_evidence(
        self,
        project_id: str,
        user_id: str,
        content: str,
        tool_traces: List[AgentToolTrace],
    ) -> None:
        from app.schemas.evidence import Evidence

        project = db.get_project(project_id)
        if not project:
            return

        summary_parts = [content[:500]]
        if tool_traces:
            tools_summary = "；".join([f"{t.tool_name}({t.status})" for t in tool_traces])
            summary_parts.append(f"工具调用: {tools_summary}")

        db.create_evidence(Evidence(
            id=str(uuid.uuid4()),
            project_id=project_id,
            author_id=user_id,
            type="text_log",
            content="\n".join(summary_parts),
            related_step=getattr(project, "current_stage", ""),
            created_at=utc_now(),
            updated_at=utc_now(),
            created_by=user_id,
        ))

    async def _generate_fallback(
        self,
        owner_id: str,
        req: AgentChatRequest,
        tool_traces: List[AgentToolTrace],
    ) -> tuple[str, str]:
        if tool_traces:
            snippets = "；".join([f"{item.tool_name}: {item.summary}" for item in tool_traces])
            return f"AI 模型暂时不可用，但我已通过内置技能完成分析：{snippets}\n\n你可以稍后重试。", settings.ZEROCLAW_LOCAL_SAFE_MODEL
        return f"已收到你的问题：「{req.message}」\n\n当前 AI 模型服务繁忙，请稍后重试。", settings.ZEROCLAW_LOCAL_SAFE_MODEL

    def build_stream_tokens(self, content: str) -> List[str]:
        if not content:
            return []
        chunk_size = 20
        return [content[i : i + chunk_size] for i in range(0, len(content), chunk_size)]

    @staticmethod
    def _get_stage_display_name(stage_id: str) -> str:
        mapping = {
            "stage_00_bootstrap": "初始化",
            "stage_01_brainstorm": "脑爆选题",
            "stage_02_brief": "开题立项",
            "stage_03_constraints": "范围裁剪",
            "stage_04_track": "轨道选择",
            "stage_05_design": "设计蓝图",
            "stage_06_step_plan": "分步计划",
            "stage_07_execute": "编码实现",
            "stage_08_evaluate": "验收展示",
        }
        return mapping.get(stage_id, stage_id)

    @staticmethod
    def deduplicate_repeated_text(text: str) -> str:
        """
        去除重复的文字（如"好好想法想法"→"好想法"）
        
        使用正则检测连续重复的词/字并合并为单个
        """
        if not text or len(text) < 4:
            return text
        
        import re
        
        for _ in range(3):
            # 模式1：连续重复的单字（如"好好好"→"好"）
            text = re.sub(r'([\u4e00-\u9fff])\1{1,3}', r'\1', text)

            # 模式2：连续重复的短词/短句（如"想法想法"→"想法"）
            text = re.sub(r'([\u4e00-\u9fff]{2,12})\1{1,2}', r'\1', text)

            # 模式3：连续重复的英文单词（如"AppApp"→"App"）
            text = re.sub(r'([A-Za-z]{2,})\1{1,2}', r'\1', text)

            # 模式4：标点符号后紧跟重复内容（如"，，"→"，"）
            text = re.sub(r'([，。！？、；：,.!?])\1+', r'\1', text)

            # 模式5：空格后重复（如"  "→" "）
            text = re.sub(r' {2,}', ' ', text)

            # 模式6：特殊符号重复（如"****"→"*"，"----"→"-"）
            text = re.sub(r'([*~\-#`]+)\1{1,}', r'\1', text)

        lines = text.splitlines()
        compact_lines: list[str] = []
        for line in lines:
            if compact_lines and compact_lines[-1] == line and line.strip():
                continue
            compact_lines.append(line)

        return '\n'.join(compact_lines).strip()

    @staticmethod
    def strip_question_xml(text: str) -> tuple[str, bool]:
        """
        剥离 question XML 块，返回 (干净文本, 是否包含question)
        
        XML 标签是内部协议格式，不应显示给用户
        """
        if not text:
            return text, False
        
        import re
        
        has_question = _contains_question_block(text)
        
        # 移除 <question>...</question> 整块（包括嵌套的子标签）
        cleaned = re.sub(
            r'<question[^>]*>.*?</question>',
            '',
            text,
            flags=re.DOTALL | re.IGNORECASE
        )
        
        # 移除裸露的 <option>...</option> 标签（AI 有时不用 question 包裹）
        cleaned = re.sub(
            r'<option\s+id=["\'][^"\']*["\'][^>]*>.*?</option>',
            '',
            cleaned,
            flags=re.DOTALL | re.IGNORECASE
        )
        
        # 清理可能残留的多余空行
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        
        return cleaned.strip(), has_question

    def _generate_fallback_question(self, req: AgentChatRequest, content: str, tool_traces: List[Any]) -> dict | None:
        """
        仅为明确业务场景生成专用 fallback question。

        普通对话禁止猜测式地生成“继续 / 详细说说 / 换个方向”这类通用按钮，
        否则会与 AI 正文脱节，造成按钮看起来像硬编码。
        """
        if self._is_achievement_scene(req):
            return {
                "id": f"q-achievement-fallback-{int(utc_now().timestamp())}",
                "title": "成果档案卡还缺一点信息，你想先补哪一项？",
                "options": [
                    {"id": "opt_one_liner", "label": "一句话介绍", "description": "补一句最精炼的成果总结", "recommended": True},
                    {"id": "opt_problem", "label": "解决了什么问题", "description": "补核心问题和挑战"},
                    {"id": "opt_method", "label": "用了什么方法", "description": "补实现方法、流程或技术"},
                    {"id": "opt_reflection", "label": "我的反思", "description": "补收获、反思和下次改进"},
                    {"id": "opt_other", "label": "其他", "description": "我想自己补充说明"},
                ],
                "multiple": False,
                "allow_custom": True,
            }
        trimmed_content = content.strip()
        if (
            re.search(r"(最后一个问题|最后一题)[:：]?\s*$", trimmed_content)
            or (
                re.search(r"(最后一个问题|最后一题)", content)
                and re.search(r"(初步项目想法|初步想法|项目想法|你的起点)", content)
            )
            or re.search(r"(你(?:已经|现在)?有初步(?:项目)?想法了吗|有没有初步(?:项目)?想法|有具体想法了吗)", content)
        ):
            return {
                "id": f"q-bootstrap-idea-fallback-{int(utc_now().timestamp())}",
                "title": "你有初步想法了吗？",
                "options": [
                    {
                        "id": "brainstorm",
                        "label": "完全没想法，需要脑爆",
                        "description": "从零开始，一起探索可做的项目方向",
                    },
                    {
                        "id": "direction",
                        "label": "有个大概方向",
                        "description": "我知道想做什么类型，但还需要一起收敛",
                    },
                    {
                        "id": "idea",
                        "label": "已经有具体想法",
                        "description": "直接基于我的想法进入立项和方案设计",
                        "recommended": True,
                    },
                ],
                "multiple": False,
                "allow_custom": True,
                "stage": "stage_00_bootstrap",
                "step": 3,
                "total_steps": 3,
                "is_stage_final": True,
            }
        if req.project_id and re.search(r"(补齐|补全|补上|缺失文档|推进到验收|stage_08_evaluate|这样可以吗|是否现在)", content):
            return {
                "id": f"q-complete-missing-{int(utc_now().timestamp())}",
                "title": "要现在补齐缺失文档并推进到验收吗？",
                "options": [
                    {
                        "id": "opt_complete_now",
                        "label": "现在补",
                        "description": "按当前已有内容补齐缺失阶段文档，并按门禁推进到验收",
                        "recommended": True,
                    },
                    {
                        "id": "opt_not_now",
                        "label": "暂不补",
                        "description": "先停在当前阶段，继续手动补充项目信息",
                    },
                ],
                "multiple": False,
                "allow_custom": True,
            }
        if re.search(r"((怎么才算|如何定义).*项目做好|什么是.*成功标准)\?$", content.strip()):
            return {
                "id": f"q-brief-success-criteria-{int(utc_now().timestamp())}",
                "title": "怎么才算这个项目做好了？",
                "options": [
                    {
                        "id": "core_playable",
                        "label": "能完整玩一局",
                        "description": "能输入数字、判断高低、猜中后结束",
                        "recommended": True,
                    },
                    {
                        "id": "restartable",
                        "label": "可以重新开始",
                        "description": "猜中或放弃后能开启新一局",
                    },
                    {
                        "id": "clear_feedback",
                        "label": "提示清楚",
                        "description": "每次猜测都有明确的高了、低了或猜中了反馈",
                    },
                ],
                "multiple": True,
                "allow_custom": True,
                "stage": "stage_02_brief",
            }
        return None

    def _generate_skill_template_question(self, skill_def: Any, req: AgentChatRequest) -> dict | None:
        """
        当 LLM 只输出自然语言问题、却没有产出结构化 question 时，
        从 stem-pbl-guide 的标准模板中补发当前缺失的资料采集题。
        """
        resolved_skill_id = (
            getattr(skill_def, "skill_id", None)
            or getattr(getattr(skill_def, "manifest", None), "skill_id", "")
        )
        if not skill_def or resolved_skill_id != "stem-pbl-guide":
            return None

        current_stage = self._get_current_stage(req)
        if current_stage and current_stage not in {"stage_00_bootstrap", "stage_01_brainstorm"}:
            return None

        bootstrap_stage = getattr(skill_def, "stages", {}).get("stage_00_bootstrap")
        if not bootstrap_stage or not getattr(bootstrap_stage, "content", "").strip():
            return None

        template_blocks = re.findall(
            r"<question\b[^>]*>[\s\S]*?</question>",
            bootstrap_stage.content,
            flags=re.IGNORECASE,
        )
        if not template_blocks:
            return None

        parsed_templates: list[dict[str, Any]] = []
        for block in template_blocks:
            parsed = _parse_question_block(block)
            if parsed:
                parsed["stage"] = "stage_00_bootstrap"
                parsed["is_stage_final"] = _is_stage_final_question(parsed)
                parsed_templates.append(parsed)

        if not parsed_templates:
            return None

        confirmed_profile = self._collect_confirmed_profile(req)
        desired_keywords: list[str] | None = None
        if "grade" not in confirmed_profile:
            desired_keywords = ["年级"]
        elif "timeBudget" not in confirmed_profile:
            desired_keywords = ["多长时间", "完成"]
        elif "idea" not in confirmed_profile:
            desired_keywords = ["初步想法", "想法"]
        else:
            return None

        for question in parsed_templates:
            title = str(question.get("title") or "")
            if any(keyword in title for keyword in desired_keywords):
                return question
        return None


def _is_stage_final_question(question_data: dict) -> bool:
    """
    轻量启发式：判断当前 question 是否是该阶段的最后一个问题。
    基于 question_data 中的 step/total_steps 字段。
    这是一个辅助信号而非硬约束——即使误判为 False，LLM 仍可通过 stage_advancer 工具推进。
    """
    step = question_data.get("step")
    total_steps = question_data.get("total_steps") or question_data.get("totalSteps")
    if step is not None and total_steps is not None:
        try:
            return int(step) >= int(total_steps)
        except (ValueError, TypeError):
            pass
    return False


def _extract_plaintext_question_options(text: str) -> tuple[str | None, list[dict[str, Any]]]:
    if not text:
        return None, []

    lines = [line.rstrip() for line in text.splitlines()]
    option_pattern = re.compile(
        r"^\s*(?:"
        r"[-*•]\s+|"
        r"(?:\d{1,2}|[A-Za-z]|[一二三四五六七八九十]+)[\.\)、]\s+|"
        r"(?:[0-9]\ufe0f?\u20e3|🔟|[①②③④⑤⑥⑦⑧⑨⑩])\s*"
        r")(.+?)\s*$"
    )

    def is_status_list_line(line: str) -> bool:
        return bool(
            re.search(r"[✅❌✔✘☑☒⚠❗❓]", line)
            or re.search(r"\b(?:docs|src|assets|tests|reports|public|app|pages|components|backend|frontend)/", line)
            or re.search(r"\.(?:json|md|py|ts|tsx|js|html|css)\b", line)
            or re.search(r"[（(](?:已补|已生成|缺失|已完成|未完成|待完成)[）)]", line)
        )

    def is_status_list_block(start: int, end: int) -> bool:
        block_lines = [line for line in lines[start:end] if option_pattern.match(line)]
        if not block_lines:
            return False
        status_count = sum(1 for line in block_lines if is_status_list_line(line))
        return status_count / len(block_lines) >= 0.5

    candidate_blocks: list[tuple[int, int]] = []
    block_start = -1
    for index, line in enumerate(lines):
        if option_pattern.match(line):
            if block_start < 0:
                block_start = index
        elif block_start >= 0:
            if index - block_start >= 2:
                candidate_blocks.append((block_start, index))
            block_start = -1
    if block_start >= 0 and len(lines) - block_start >= 2:
        candidate_blocks.append((block_start, len(lines)))

    if not candidate_blocks:
        return None, []

    selectable_blocks = [block for block in candidate_blocks if not is_status_list_block(*block)]
    if not selectable_blocks:
        return None, []

    start, end = selectable_blocks[-1]
    trailing_question = next(
        (
            line.strip()
            for line in lines[end:]
            if line.strip() and re.search(r"[？?]", line.strip()) and len(line.strip()) <= 120
        ),
        None,
    )
    title = trailing_question
    if not title:
        for idx in range(start - 1, -1, -1):
            candidate = lines[idx].strip()
            if not candidate:
                continue
            if any(marker in candidate for marker in ("？", "?", "：", ":")):
                title = candidate.rstrip("：:")
                break
            if len(candidate) <= 80:
                title = candidate
                break

    options: list[dict[str, Any]] = []
    for index, raw_line in enumerate(lines[start:end], 1):
        match = option_pattern.match(raw_line)
        if not match:
            continue
        body = match.group(1).strip()
        if not body:
            continue
        label, separator, description = body.partition("：")
        if not separator:
            label, separator, description = body.partition(":")
        final_label = re.sub(r"^[*_`\s]+|[*_`\s]+$", "", (label or body).strip())[:100]
        final_description = description.strip()[:200] if separator and description.strip() else None
        options.append({
            "id": f"opt-{index}",
            "label": final_label,
            "description": final_description,
            "recommended": index == 1,
        })

    return title, options


def _extract_json_question_payload(text: str) -> dict[str, Any] | None:
    if not text:
        return None

    decoder = json.JSONDecoder()
    candidate_blocks = [block.strip() for block in re.findall(r"```json\s*([\s\S]*?)```", text, re.IGNORECASE) if block.strip()]
    if '"questions"' in text:
        candidate_blocks.append(text.strip())

    for candidate in candidate_blocks:
        if '"questions"' not in candidate:
            continue
        for match in re.finditer(r"\{", candidate):
            try:
                payload, _ = decoder.raw_decode(candidate[match.start():])
            except Exception:
                continue
            if not isinstance(payload, dict):
                continue
            questions = payload.get("questions")
            if not isinstance(questions, list) or not questions:
                continue
            first_question = questions[0]
            if not isinstance(first_question, dict):
                continue
            raw_options = first_question.get("options")
            if not isinstance(raw_options, list) or not raw_options:
                continue

            options: list[dict[str, Any]] = []
            for index, option in enumerate(raw_options, 1):
                if not isinstance(option, dict):
                    continue
                label = str(option.get("label") or "").strip()
                if not label:
                    continue
                description = str(option.get("description") or "").strip() or None
                options.append({
                    "id": f"opt-{index}",
                    "label": label[:100],
                    "description": description[:200] if description else None,
                    "recommended": index == 1,
                })

            if not options:
                continue

            return {
                "title": str(first_question.get("question") or first_question.get("header") or "请选择").strip(),
                "options": options,
                "multiple": bool(first_question.get("multiSelect", False)),
            }
    return None


def _contains_question_block(text: str) -> bool:
    if not text:
        return False
    import re
    # 支持 <question>、<question type="...">、<question\n 等多种格式
    markers = ["<question>", "<question ", "<question\n", "【提问】", "[提问]", "::question::", "{{question}}"]
    if any(m in text.lower() for m in markers):
        return True
    if _extract_json_question_payload(text):
        return True
    # 支持裸露的 <option 标签（AI 有时不用 question 包裹）
    if re.search(r'<option\s+id=["\']', text, re.IGNORECASE):
        return True
    _, options = _extract_plaintext_question_options(text)
    return len(options) >= 2


def _parse_question_block(text: str) -> dict | None:
    import re
    from datetime import datetime

    json_question = _extract_json_question_payload(text)
    if json_question:
        return {
                "id": f"q-{int(utc_now().timestamp())}",
            "title": json_question["title"],
            "options": json_question["options"][:8],
            "multiple": json_question.get("multiple", False),
            "allow_custom": True,
            "step": None,
            "total_steps": None,
        }

    raw = None
    question_block_source = None

    # 首先尝试直接匹配 <question>...</question>
    pattern = r'<question[^>]*>(.*?)</question>'
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    
    if match:
        raw = match.group(1).strip()
        question_block_source = match.group(0)
        q_tag_match = re.search(r'<question[^>]*title=["\']([^"\']*)["\']', text, re.IGNORECASE)
        q_title = q_tag_match.group(1).strip() if q_tag_match else None
    else:
        # 尝试从代码块中提取（AI 有时会把 question 放在 ``` 代码块中）
        code_block_pattern = r'```(?:xml)?\s*\n?(<question[^>]*>.*?</question>)\s*\n?```'
        match = re.search(code_block_pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            raw = match.group(1).strip()
            question_block_source = match.group(1)
            q_tag_match = re.search(r'<question[^>]*title=["\']([^"\']*)["\']', text, re.IGNORECASE)
            q_title = q_tag_match.group(1).strip() if q_tag_match else None
        else:
            q_title = None
    
    # 如果没有 <question> 包裹，尝试直接从文本中提取裸露的 <option> 标签
    if not raw and re.search(r'<option\s+id=["\']', text, re.IGNORECASE):
        raw = text

    title = "请选择"
    options = []

    if raw:
        title_match = re.search(r'<title>(.*?)</title>', raw, re.DOTALL | re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()
        elif q_title:
            title = q_title
        elif '<option' not in raw.split('\n')[0]:
            title = raw.split('\n')[0][:200]

        opt_pattern = r'<option\s+id=["\']([^"\']*)["\'](?:[^>]*?label=["\']([^"\']*)["\'])?[^>]*>(.*?)</option>'
        for om in re.finditer(opt_pattern, raw, re.DOTALL | re.IGNORECASE):
            opt_id = om.group(1).strip()
            attr_label = om.group(2).strip() if om.group(2) else None
            opt_body = om.group(3).strip()

            child_label_match = re.search(r'<label>(.*?)</label>', opt_body, re.DOTALL | re.IGNORECASE)
            desc_match = re.search(r'<desc>(.*?)</desc>', opt_body, re.DOTALL | re.IGNORECASE)

            final_label = attr_label
            if not final_label:
                if child_label_match:
                    final_label = child_label_match.group(1).strip()
                else:
                    clean_body = re.sub(r'</?(?:label|desc)[^>]*>', '', opt_body).strip()
                    final_label = clean_body.split('\n')[0][:100]

            options.append({
                "id": opt_id or f"opt-{len(options)}",
                "label": final_label,
                "description": desc_match.group(1).strip() if desc_match else None,
                "recommended": "推荐" in opt_body or "recommended" in opt_body.lower(),
            })

    if not options:
        plaintext_title, plaintext_options = _extract_plaintext_question_options(text)
        if not plaintext_options:
            return None
        title = plaintext_title or title
        options = plaintext_options

    raw_text = question_block_source or raw or text
    multiple = "multiple" in raw_text.lower() or "多选" in raw_text
    step_m = re.search(r'\bstep\b\s*(?:=|:)\s*["\']?(\d+)', raw_text, re.IGNORECASE)
    total_m = re.search(r'\b(?:total_steps|totalSteps|total)\b\s*(?:=|:)\s*["\']?(\d+)', raw_text, re.IGNORECASE)

    question_data = {
        "id": f"q-{int(utc_now().timestamp())}",
        "title": title,
        "options": options[:8],
        "multiple": multiple,
        "allow_custom": True,
        "step": int(step_m.group(1)) if step_m else None,
        "total_steps": int(total_m.group(1)) if total_m else None,
    }

    normalized_title = str(question_data["title"]).strip()
    normalized_option_labels = {
        str(option.get("label") or "").strip()
        for option in question_data["options"]
        if str(option.get("label") or "").strip()
    }
    generic_titles = {
        "请选择",
        "接下来你想怎么做？",
        "接下来你想怎么做",
        "你想怎么继续？",
        "你想怎么继续",
    }
    generic_option_labels = {
        "继续",
        "详细说说",
        "换个方向",
        "了解更多",
        "其他",
    }
    if normalized_title in generic_titles:
        return None
    if normalized_option_labels and normalized_option_labels.issubset(generic_option_labels):
        return None

    return question_data


agent_orchestrator_service = AgentOrchestratorService()
