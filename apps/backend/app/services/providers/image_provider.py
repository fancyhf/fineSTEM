"""
AI 图像生成服务

用途：基于智谱 CogView 模型为成果档案卡自动生成封面图
维护者：AI Agent
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GLM_IMAGE_BASE = "https://open.bigmodel.cn/api/paas/v4"
DEFAULT_IMAGE_MODEL = "cogview-3-flash"
DEFAULT_IMAGE_SIZE = "1024x1024"
IMAGE_TIMEOUT_SECONDS = 60


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
