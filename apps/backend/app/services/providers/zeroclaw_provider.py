"""
ZeroClaw Provider 适配器

用途：对接 ZeroClaw Gateway，向编排层提供统一调用接口
维护者：AI Agent
links: .trae/documents/技术与架构/ZeroClaw_技术知识库_v1.0.0.md
"""

import json
from typing import Any, AsyncGenerator, Dict, List, Optional
import httpx


STEM_SYSTEM_PROMPT = """你是 fineSTEM 助教，一位专业的青少年 STEM 研学指导老师。

## 你的核心职责
1. 帮助学生完成 STEM 项目（科学、技术、工程、数学）
2. 引导学生从兴趣出发，通过实践学习编程和科学方法
3. 回答要简洁、友好、有启发性，适合 12-18 岁学生理解

## 编程指导规范
- 优先使用 Python 和 JavaScript 作为教学语言
- 代码示例必须完整可运行，包含必要 import
- 解释代码时先说"做什么"，再说"怎么做"，最后说"为什么"
- 遇到报错时，先引导学生自己分析错误信息，再给出修复建议
- 推荐使用项目模板（Demo）作为起点，而非从零开始

## 研学流程引导
- 学生说"我想做一个项目"→ 推荐从 Demo 墙 Fork 开始
- 学生说"不知道做什么"→ 询问兴趣方向，推荐对应 Demo
- 学生说"代码跑不起来"→ 引导检查错误信息，逐步排查
- 学生说"下一步做什么"→ 根据当前阶段给出具体任务

## 回答风格
- 使用中文回答
- 代码块标注语言类型（```python / ```javascript）
- 关键概念用粗体标注
- 复杂问题分步骤回答，每步一个小目标

## 提问格式规范（重要！）
当你需要向学生提问、提供选项让学生选择时，必须使用以下 XML 格式输出，这样系统才能正确渲染选项卡：

<question type="single" title="你的问题标题">
  <option id="option_1" label="选项1标签">选项1描述（可选）</option>
  <option id="option_2" label="选项2标签">选项2描述（可选）</option>
  <option id="option_3" label="选项3标签">选项3描述（可选）</option>
</question>

- type="single" 表示单选，type="multiple" 表示多选
- id 必须是唯一的，格式为 option_数字
- label 是显示给学生的简短标签
- 普通文本描述和 XML 选项可以一起输出"""


SCENE_SYSTEM_PROMPTS = {
    "问问题": STEM_SYSTEM_PROMPT + """

## 当前场景：问问题
学生正在咨询 STEM 相关问题。你需要：
- 准确回答科学/技术/工程/数学问题
- 用类比和实例帮助理解抽象概念
- 如果问题超出你的知识范围，坦诚说明并建议搜索方向""",

    "解释代码": STEM_SYSTEM_PROMPT + """

## 当前场景：解释代码
学生需要代码分析和讲解。你需要：
- 逐行或逐段解释代码逻辑
- 标注关键语法和设计模式
- 指出潜在问题和改进空间
- 如果学生提供了代码片段，先分析再建议""",

    "开始项目": STEM_SYSTEM_PROMPT + """

## 当前场景：开始项目
学生想要创建一个新的 STEM 项目。你需要：
1. 询问项目方向（Web应用/数据分析/游戏/AI/硬件）
2. 评估难度是否匹配学生水平
3. 推荐合适的 Demo 模板作为起点
4. 如果没有合适模板，给出完整可运行的项目方案
5. 引导学生使用"我也做一个"功能 Fork Demo

项目创建后的第一步建议：
- 先运行模板代码，确认能跑起来
- 修改一个小地方（改文字/改颜色），体验"代码→效果"
- 再逐步添加自己的功能""",

    "写报告": STEM_SYSTEM_PROMPT + """

## 当前场景：写报告
学生需要撰写研究报告或成果文档。你需要：
- 帮助组织报告结构（引言→方法→结果→讨论→结论）
- 引导使用项目中的证据和数据支撑论点
- 提供学术写作的基本规范
- 生成成果档案卡的摘要文本""",

    "create": STEM_SYSTEM_PROMPT + """

## 当前场景：AI 工作台
学生正在使用 AI 工作台进行创作。根据对话内容自动判断意图并回应。""",

    "explore": STEM_SYSTEM_PROMPT + """

## 当前场景：探索中心
学生正在浏览 Demo 和课程。回答与 Demo 功能、技术栈、学习路径相关的问题。""",

    "research": STEM_SYSTEM_PROMPT + """

## 当前场景：研学流程
学生正在进行研学项目。根据当前阶段给出针对性指导：
- stage_00-01: 帮助脑爆选题，发散思维
- stage_02-03: 帮助收敛范围，明确约束
- stage_04-05: 帮助选择技术轨道，设计方案
- stage_06-07: 帮助制定计划，编写代码
- stage_08: 帮助总结成果，准备展示""",
}


def build_system_prompt(context: Dict[str, Any]) -> str:
    scene = context.get("scene") or context.get("page") or "create"
    return SCENE_SYSTEM_PROMPTS.get(scene, STEM_SYSTEM_PROMPT)


def build_context_block(context: Dict[str, Any]) -> str:
    parts: List[str] = []

    project_id = context.get("project_id")
    if project_id:
        parts.append(f"当前项目ID: {project_id}")

    current_stage = context.get("current_stage")
    if current_stage:
        parts.append(f"当前阶段: {current_stage}")

    demo_id = context.get("demo_id")
    if demo_id:
        parts.append(f"当前Demo ID: {demo_id}")

    tool_results = context.get("tool_results")
    if tool_results and tool_results != "无":
        parts.append(f"技能分析结果: {tool_results}")

    user_role = context.get("user_role", "student")
    if user_role != "student":
        parts.append(f"用户角色: {user_role}")

    return "\n".join(parts) if parts else ""


class ZeroClawProvider:
    def __init__(self, gateway_url: Optional[str], timeout_seconds: int = 30, api_key: Optional[str] = None):
        self.gateway_url = gateway_url.rstrip("/") if gateway_url else None
        self.timeout_seconds = timeout_seconds
        self.api_key = api_key

    async def complete_with_tool_calls(self, payload: Dict[str, Any], gateway_url: Optional[str] = None) -> Dict[str, Any]:
        target_gateway = gateway_url.rstrip("/") if gateway_url else self.gateway_url
        if not target_gateway or not self.api_key:
            raise RuntimeError("ZeroClaw 网关或 API 密钥未配置")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        request_payload = self._build_request_payload(payload, target_gateway)

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{target_gateway}/chat/completions",
                json=request_payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        choices = data.get("choices", [])
        if not choices:
            return {"content": "", "tool_calls": []}

        choice = choices[0]
        message = choice.get("message", {})
        content = str(message.get("content") or "")
        tool_calls = message.get("tool_calls") or []
        finish_reason = choice.get("finish_reason", "")

        return {
            "content": content,
            "tool_calls": tool_calls,
            "finish_reason": finish_reason,
        }

    async def complete(self, payload: Dict[str, Any], gateway_url: Optional[str] = None) -> str:
        target_gateway = gateway_url.rstrip("/") if gateway_url else self.gateway_url
        if not target_gateway or not self.api_key:
            raise RuntimeError("ZeroClaw 网关或 API 密钥未配置")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        request_payload = self._build_request_payload(payload, target_gateway)

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{target_gateway}/chat/completions",
                json=request_payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        content = self._extract_content(data, target_gateway)
        return str(content) if content else ""

    async def stream_complete(self, payload: Dict[str, Any], gateway_url: Optional[str] = None) -> AsyncGenerator[str, None]:
        """
        流式完成请求，yield token 字符串。
        注意：最后一个 yield 可能是特殊的 finish_reason 标记，格式为 "__FINISH_REASON__:xxx"
        """
        target_gateway = gateway_url.rstrip("/") if gateway_url else self.gateway_url
        if not target_gateway or not self.api_key:
            raise RuntimeError("ZeroClaw 网关或 API 密钥未配置")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        request_payload = self._build_request_payload(payload, target_gateway)
        request_payload["stream"] = True

        finish_reason = None

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            async with client.stream(
                "POST",
                f"{target_gateway}/chat/completions",
                json=request_payload,
                headers=headers,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        token = self._extract_stream_token(chunk, target_gateway)
                        if token:
                            yield token

                        # 检查 finish_reason
                        choices = chunk.get("choices", [])
                        if choices and isinstance(choices[0], dict):
                            reason = choices[0].get("finish_reason")
                            if reason:
                                finish_reason = reason
                    except json.JSONDecodeError:
                        continue

                # 在流结束时，如果检测到 finish_reason，yield 一个特殊标记
                if finish_reason:
                    yield f"__FINISH_REASON__:{finish_reason}"

    @staticmethod
    def _is_glm_gateway(gateway_url: str) -> bool:
        return "open.bigmodel.cn" in gateway_url

    @staticmethod
    def _is_deepseek_gateway(gateway_url: str) -> bool:
        return "api.deepseek.com" in gateway_url

    def _build_request_payload(self, payload: Dict[str, Any], gateway_url: str) -> Dict[str, Any]:
        from app.core.config import settings

        if "messages" in payload:
            result = {
                "model": str(payload.get("model") or "deepseek-chat"),
                "messages": payload["messages"],
                "max_tokens": settings.ZEROCLAW_MAX_TOKENS,
            }
            if payload.get("stream") is not None:
                result["stream"] = payload["stream"]
            if payload.get("tools"):
                result["tools"] = payload["tools"]
            if payload.get("tool_choice"):
                result["tool_choice"] = payload["tool_choice"]
            return result

        if not self._is_glm_gateway(gateway_url) and not self._is_deepseek_gateway(gateway_url):
            return payload

        model = str(payload.get("model") or "deepseek-chat")
        message = str(payload.get("message") or "")
        context = payload.get("context") or {}

        system_prompt = build_system_prompt(context)
        context_block = build_context_block(context)
        if context_block:
            system_prompt += f"\n\n## 当前上下文\n{context_block}"

        return {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
        }

    def _extract_content(self, data: Dict[str, Any], gateway_url: str) -> str:
        if self._is_glm_gateway(gateway_url) or self._is_deepseek_gateway(gateway_url):
            choices = data.get("choices", [])
            if choices and isinstance(choices[0], dict):
                message = choices[0].get("message", {})
                if isinstance(message, dict):
                    return str(message.get("content") or "")
            return ""
        return str(data.get("data", {}).get("content") or data.get("message") or "")

    def _extract_stream_token(self, chunk: Dict[str, Any], gateway_url: str) -> str:
        if self._is_glm_gateway(gateway_url) or self._is_deepseek_gateway(gateway_url):
            choices = chunk.get("choices", [])
            if choices and isinstance(choices[0], dict):
                delta = choices[0].get("delta", {})
                if isinstance(delta, dict):
                    return str(delta.get("content") or "")
            return ""
        return str(chunk.get("data", {}).get("token") or chunk.get("token") or "")
