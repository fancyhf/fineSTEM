"""
TTS（文字转语音）服务 —— 数字人伴学助手「小知」的嗓子

用途：把 AI 回复文本合成为音频，供前端数字人播放+口型同步
维护者：AI Agent

设计（2026-11-06）：
- 引擎：智谱 GLM-TTS（POST /api/paas/v4/audio/speech），复用 .env 已有
  GLM_API_KEY，零新增凭证。协议与 video-factory/build_audio2.py synth_glm()
  实证一致：model=glm-tts, voice=tongtong（童声彤彤，儿童陪伴场景），
  response_format=wav，返回 wav 二进制。
- 缓存：sha256(text+voice+speed) 指纹落盘 VOICE_TTS_CACHE_DIR，同文本命中
  缓存零成本零延迟（打招呼语、高频短句受益最大）。
- 失败：抛 TTSError，API 层转成引导前端走 speechSynthesis 兜底的响应。
"""

from __future__ import annotations

import hashlib
import logging
import time
from pathlib import Path
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GLM_TTS_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/audio/speech"
GLM_TTS_TIMEOUT_SECONDS = 60


class TTSError(Exception):
    """TTS 合成失败（key 缺失 / 上游错误 / 响应异常）。"""


def _cache_path(text: str, voice: str, speed: float) -> Path:
    fingerprint = hashlib.sha256(
        f"v1|{voice}|{speed}|{text}".encode("utf-8")
    ).hexdigest()
    return Path(settings.VOICE_TTS_CACHE_DIR) / f"{fingerprint}.wav"


def cache_dir() -> Path:
    """TTS 缓存目录（API 层取音频文件用）。"""
    return Path(settings.VOICE_TTS_CACHE_DIR)


def cached_tts_path(text: str, voice: Optional[str] = None, speed: Optional[float] = None) -> Optional[Path]:
    """返回已缓存的音频路径；未命中返回 None。"""
    v = voice or settings.GLM_TTS_VOICE
    s = speed if speed is not None else settings.GLM_TTS_SPEED
    path = _cache_path(text, v, s)
    if path.exists() and path.stat().st_size > 1000:
        return path
    return None


def synthesize(text: str, voice: Optional[str] = None, speed: Optional[float] = None) -> Path:
    """
    合成语音并写入缓存，返回音频文件路径（wav）。

   Raises:
        TTSError: key 未配置、文本为空/超长、上游失败。
    """
    v = voice or settings.GLM_TTS_VOICE
    s = speed if speed is not None else settings.GLM_TTS_SPEED
    clean_text = (text or "").strip()
    if not clean_text:
        raise TTSError("TTS 文本为空")
    if len(clean_text) > settings.VOICE_TTS_MAX_CHARS:
        raise TTSError(f"TTS 文本过长（>{settings.VOICE_TTS_MAX_CHARS} 字），请分句合成")

    cache = _cache_path(clean_text, v, s)
    if cache.exists() and cache.stat().st_size > 1000:
        return cache

    if not settings.GLM_API_KEY:
        raise TTSError("GLM_API_KEY 未配置，无法合成语音")

    body = {
        "model": "glm-tts",
        "input": clean_text,
        "voice": v,
        "response_format": "wav",
        "speed": s,
    }

    last_err = ""
    for attempt in range(2):
        try:
            resp = httpx.post(
                GLM_TTS_ENDPOINT,
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.GLM_API_KEY}",
                },
                timeout=GLM_TTS_TIMEOUT_SECONDS,
            )
            if resp.status_code != 200:
                last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
                # 4xx 参数/凭证问题重试无意义
                if 400 <= resp.status_code < 500 and resp.status_code != 429:
                    break
            else:
                audio = resp.content
                # 参照 build_audio2.py 经验：过小的响应体是无效音频
                if len(audio) > 5000:
                    cache.parent.mkdir(parents=True, exist_ok=True)
                    # 先写临时文件再原子改名，避免并发请求读到半截文件
                    tmp = cache.with_suffix(".tmp")
                    tmp.write_bytes(audio)
                    tmp.rename(cache)
                    logger.info("[tts] 合成成功 voice=%s chars=%d bytes=%d", v, len(clean_text), len(audio))
                    return cache
                last_err = f"响应过小 {len(audio)} bytes"
        except httpx.HTTPError as e:
            last_err = f"网络错误: {e}"
        if attempt == 0:
            time.sleep(1.0)

    logger.error("[tts] 合成失败: %s", last_err)
    raise TTSError(f"语音合成失败：{last_err}")
