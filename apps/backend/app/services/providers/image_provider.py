"""
AI 图像服务

用途：
1. 基于智谱 CogView 模型为成果档案卡自动生成封面图
2. 基于智谱 GLM-4V 识别学生在聊天中发送的截图（报错/界面/代码）
维护者：AI Agent
"""

from __future__ import annotations

import base64
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GLM_IMAGE_BASE = "https://open.bigmodel.cn/api/paas/v4"
DEFAULT_IMAGE_MODEL = "cogview-3-flash"
DEFAULT_IMAGE_SIZE = "1024x1024"
IMAGE_TIMEOUT_SECONDS = 60

# 2026-07-30 聊天发图：主对话模型（DeepSeek）不支持视觉，
# 用 GLM-4V（免费 flash 版）把截图转成文字描述后注入对话。
VISION_MODEL = "glm-4v-flash"
VISION_TIMEOUT_SECONDS = 45
VISION_PROMPT = (
    "这是学生在编程学习时发来的截图。请仔细识别并用中文回答：\n"
    "1. 如果包含代码、报错信息或控制台输出，请逐字转录全部文字（保持原格式，报错信息一字不漏）\n"
    "2. 如果是网页/应用界面截图，请描述界面内容、布局和看起来异常的地方\n"
    "3. 如果是设计图/草图，请描述其中的元素和意图\n"
    "只输出识别结果，不要加建议或分析。"
)


async def describe_chat_image(image_bytes: bytes, mime_type: str = "image/png") -> Optional[str]:
    """
    调用 GLM-4V 识别聊天截图，返回文字描述（代码/报错会被逐字转录）。

    失败时返回 None（不抛异常，前端降级为"图片识别不可用"提示）。
    """
    api_key = settings.glm_key
    if not api_key:
        logger.warning("glm_key 未配置，无法识别聊天图片")
        return None

    b64 = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "model": VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
                    {"type": "text", "text": VISION_PROMPT},
                ],
            }
        ],
        "temperature": 0.1,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    try:
        async with httpx.AsyncClient(timeout=VISION_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{GLM_IMAGE_BASE}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        choices = data.get("choices", [])
        if not choices:
            logger.warning("GLM-4V 返回空 choices: %s", str(data)[:200])
            return None
        content = (choices[0].get("message") or {}).get("content")
        if not content or not str(content).strip():
            logger.warning("GLM-4V 返回空内容")
            return None
        logger.info("聊天图片识别成功: %d 字节图片 → %d 字描述", len(image_bytes), len(str(content)))
        return str(content).strip()

    except httpx.HTTPError as e:
        logger.error("GLM-4V API 调用失败: %s", e)
        return None
    except Exception as e:
        logger.error("聊天图片识别异常: %s", e)
        return None


def _build_prompt(title: str, one_liner: str, subjects: Optional[list[str]] = None) -> str:
    """根据成果卡信息构建文生图 prompt"""
    subject_hint = "、".join(subjects) if subjects else "STEM 教育"
    # 扁平化插画风格，确保视觉一致性
    return (
        f"为青少年 STEM 研学项目设计一张封面插画。"
        f"项目主题：{title}。"
        f"项目简介：{one_liner}。"
        f"相关学科：{subject_hint}。"
        f"风格要求：扁平化插画风格，色彩明快，适合教育场景，蓝绿色调为主，简洁现代。"
    )


async def generate_cover_image(
    title: str,
    one_liner: str,
    subjects: Optional[list[str]] = None,
) -> Optional[str]:
    """
    调用智谱 CogView 生成封面图，返回图片 CDN URL。

    Args:
        title: 成果卡标题
        one_liner: 成果卡一句话简介
        subjects: 相关学科标签

    Returns:
        图片 URL 字符串，失败时返回 None（不抛异常，不阻断主流程）
    """
    api_key = settings.glm_key
    if not api_key:
        logger.warning("glm_key 未配置，跳过封面图生成")
        return None

    prompt = _build_prompt(title, one_liner, subjects)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "model": DEFAULT_IMAGE_MODEL,
        "prompt": prompt,
        "size": DEFAULT_IMAGE_SIZE,
    }

    try:
        async with httpx.AsyncClient(timeout=IMAGE_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{GLM_IMAGE_BASE}/images/generations",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        images = data.get("data", [])
        if not images:
            logger.warning("CogView 返回空图片列表: %s", str(data)[:200])
            return None

        image_url = images[0].get("url")
        if not image_url:
            logger.warning("CogView 返回结果无 url 字段")
            return None

        logger.info("封面图生成成功: title=%s, model=%s", title[:30], DEFAULT_IMAGE_MODEL)
        return image_url

    except httpx.HTTPError as e:
        logger.error("CogView API 调用失败: %s", e)
        return None
    except Exception as e:
        logger.error("封面图生成异常: %s", e)
        return None
