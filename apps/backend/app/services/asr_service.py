"""
ASR（语音识别）服务 —— 听懂孩子对小知说的话

引擎链（2026-11-07 改造，用户确认"先用已购服务"）：
  1. GLM-ASR（智谱 glm-asr-flash，GLM_API_KEY——已购智谱，OpenAI 兼容
     multipart 协议，约 0.0002 元/秒）——主力
  2. 百炼 qwen3-asr-flash（BAILIAN_API_KEY）——兜底（本地 key 免费额度
     已耗尽 403 FreeTierOnly，需充值后才真正可用）

输入：前端录好的 16kHz mono WAV。限制：≤10MB、≤5 分钟。
失败：抛 ASRError，message 已是孩子友好文案。
"""

from __future__ import annotations

import base64
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GLM_ASR_URL = "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions"
# glm-asr = 最新稳定别名（2026-11-06 实测 200；glm-asr-flash 不存在）
GLM_ASR_MODEL = "glm-asr"

ASR_MODEL_BAILIAN = "qwen3-asr-flash"
ASR_BASE_URL_BAILIAN = "https://dashscope.aliyuncs.com/compatible-mode/v1"

ASR_TIMEOUT_SECONDS = 30
MAX_AUDIO_BYTES = 10 * 1024 * 1024


class ASRError(Exception):
    """语音识别失败（key 缺失 / 音频无效 / 上游错误）。"""


def _friendly_upstream_error(status: int, detail: str) -> str:
    """上游 401/403/429 → 孩子友好提示；技术细节进日志。"""
    # 429 code 1113 = 智谱余额不足；403 FreeTierOnly = 百炼免费额度耗尽——都是账号侧额度问题
    if status == 429 or any(kw in detail for kw in ("余额不足", "资源包")):
        return "小知的耳朵没话费啦（语音额度用完了），可以先打字告诉小知哦"
    if status in (401, 403):
        if any(kw in detail.upper() for kw in ("FREETIER", "QUOTA", "ARREARAGE", "ARREARS")):
            return "小知的耳朵今天休息啦（语音额度用完了），可以先打字告诉小知哦"
        return "语音识别服务暂时不可用，可以先打字告诉小知哦"
    return "语音识别服务开小差了，请再试一次"


def _transcribe_glm(wav_bytes: bytes) -> str:
    """智谱 GLM-ASR：OpenAI 兼容 multipart 上传，返回 {"text": "..."} 或choices 结构。"""
    files = {"file": ("speech.wav", wav_bytes, "audio/wav")}
    data = {"model": GLM_ASR_MODEL}
    try:
        resp = httpx.post(
            GLM_ASR_URL,
            files=files,
            data=data,
            headers={"Authorization": f"Bearer {settings.GLM_API_KEY}"},
            timeout=ASR_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as e:
        logger.error("[asr][glm] 网络错误: %s", e)
        raise ASRError("语音识别服务开小差了，请再试一次")

    if resp.status_code != 200:
        detail = resp.text[:300]
        logger.error("[asr][glm] HTTP %s: %s", resp.status_code, detail)
        raise ASRError(_friendly_upstream_error(resp.status_code, detail))

    text = ""
    try:
        payload = resp.json()
        # 兼容两种返回：{"text": "..."}（transcriptions 标准）与 choices 结构
        text = (payload.get("text") or "").strip()
        if not text:
            choices = payload.get("choices") or []
            if choices:
                text = ((choices[0].get("message") or {}).get("content") or "").strip()
    except (ValueError, AttributeError, IndexError, KeyError) as e:
        logger.error("[asr][glm] 响应解析失败: %s %s", e, resp.text[:200])
        raise ASRError("语音识别服务开小差了，请再试一次")

    if not text:
        raise ASRError("没听清你说的话，请靠近一点再试")
    logger.info("[asr][glm] 识别成功 chars=%d", len(text))
    return text


def _transcribe_bailian(wav_bytes: bytes) -> str:
    """阿里百炼 qwen3-asr-flash：OpenAI 兼容 chat/completions + base64 data URI。"""
    data_uri = "data:audio/wav;base64," + base64.b64encode(wav_bytes).decode("ascii")
    body = {
        "model": ASR_MODEL_BAILIAN,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "input_audio", "input_audio": {"data": data_uri}},
                ],
            }
        ],
        "asr_options": {"enable_itn": True},
    }
    try:
        resp = httpx.post(
            f"{ASR_BASE_URL_BAILIAN}/chat/completions",
            json=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.BAILIAN_API_KEY}",
            },
            timeout=ASR_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as e:
        logger.error("[asr][bailian] 网络错误: %s", e)
        raise ASRError("语音识别服务开小差了，请再试一次")

    if resp.status_code != 200:
        detail = resp.text[:300]
        logger.error("[asr][bailian] HTTP %s: %s", resp.status_code, detail)
        raise ASRError(_friendly_upstream_error(resp.status_code, detail))

    try:
        data = resp.json()
        text = (data["choices"][0]["message"]["content"] or "").strip()
    except (KeyError, IndexError, ValueError, TypeError) as e:
        logger.error("[asr][bailian] 响应解析失败: %s %s", e, resp.text[:200])
        raise ASRError("语音识别返回格式异常")

    if not text:
        raise ASRError("没听清你说的话，请靠近一点再试")
    logger.info("[asr][bailian] 识别成功 chars=%d", len(text))
    return text


# 高频同音字纠正：产品名"小知"常被识别成同音字（2026-11-07 实测"小芝"）
_HOMOPHONE_FIXES = {
    "小芝": "小知",
    "小之": "小知",
    "小枝": "小知",
    "小致": "小知",
}


def _fix_homophones(text: str) -> str:
    for wrong, right in _HOMOPHONE_FIXES.items():
        text = text.replace(wrong, right)
    return text


def transcribe_wav(wav_bytes: bytes) -> str:
    """
    识别 16kHz mono WAV 音频，按引擎链尝试（GLM → 百炼），返回转写文本。

    Raises:
        ASRError: 全部引擎失败 / 音频无效（message 已是孩子友好文案）。
    """
    if not wav_bytes or len(wav_bytes) < 800:
        raise ASRError("音频太短或为空，请再录一次")
    if len(wav_bytes) > MAX_AUDIO_BYTES:
        raise ASRError("音频超过 10MB 上限")

    engines = []
    if settings.GLM_API_KEY:
        engines.append(("glm", _transcribe_glm))
    if settings.BAILIAN_API_KEY:
        engines.append(("bailian", _transcribe_bailian))
    if not engines:
        raise ASRError("语音识别服务未配置，可以先打字告诉小知哦")

    last_err: ASRError | None = None
    for name, fn in engines:
        try:
            return _fix_homophones(fn(wav_bytes))
        except ASRError as e:
            last_err = e
            logger.warning("[asr] 引擎 %s 失败，尝试下一个: %s", name, e)
    raise last_err or ASRError("语音识别服务开小差了，请再试一次")
