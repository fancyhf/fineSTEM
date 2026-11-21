"""
语音数字人伴学助手（小知）API 路由

用途：TTS（AI 回复合成语音）与 ASR（孩子语音转文字）
维护者：AI Agent

约定（2026-11-06）：
- 全部经 feature flag `voice_companion` 门禁（admin 可经
  /agent/feature-flags/voice_companion 一键关闭，止损计费）。
- TTS 按文本指纹落盘缓存，GET 音频文件无需登录（指纹不可预测，
  与 /media /uploads 公开静态目录同一安全模型）。
- handler 用同步 def：httpx 是同步调用，FastAPI 会丢线程池执行，
  不阻塞事件循环（与 orchestrator 直连链路同理）。
"""

import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.auth import get_current_user
from app.core.config import settings
from app.schemas.auth import UserResponse
from app.schemas.common import ApiResponse
from app.services import tts_service
from app.services.asr_service import ASRError, transcribe_wav
from app.services.feature_flags import feature_flag_service
from app.services.tts_service import TTSError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Voice"])

# 缓存指纹只允许 hex，防路径穿越
_FINGERPRINT_RE = re.compile(r"^[0-9a-f]{64}$")


def _ensure_voice_enabled(user: UserResponse) -> None:
    if not feature_flag_service.is_enabled("voice_companion", str(getattr(user, "id", "") or "")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="语音伴学功能暂未开放",
        )


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=settings.VOICE_TTS_MAX_CHARS)
    speed: Optional[float] = Field(None, ge=0.5, le=2.0)


class TTSResponse(BaseModel):
    url: str          # 音频下载地址（相对 API 根）
    cached: bool      # 是否命中缓存（未计费）
    chars: int


class ASRResponse(BaseModel):
    text: str


@router.post("/tts", response_model=ApiResponse[TTSResponse])
def synthesize_speech(
    body: TTSRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """文本 → 语音（GLM-TTS 童童音色）。前端数字人朗读用。"""
    _ensure_voice_enabled(current_user)
    if not body.text.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="文本不能为空")
    # 先查缓存：命中则零成本零延迟，cached 标记给前端/观测用
    existing = tts_service.cached_tts_path(body.text, speed=body.speed)
    if existing is not None:
        path = existing
        was_cached = True
    else:
        try:
            path = tts_service.synthesize(body.text, speed=body.speed)
        except TTSError as e:
            # 503：让前端明确走 speechSynthesis 浏览器兜底，而非当成业务错误弹窗
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
        was_cached = False
    fingerprint = path.stem
    return ApiResponse(
        data=TTSResponse(
            url=f"{settings.API_V1_STR}/voice/tts-audio/{fingerprint}.wav",
            cached=was_cached,
            chars=len(body.text.strip()),
        ),
        message="合成成功",
    )


@router.get("/tts-audio/{fingerprint}.wav")
def get_tts_audio(fingerprint: str):
    """取缓存的 TTS 音频。指纹不可预测，公开访问（同 /media 安全模型）。"""
    if not _FINGERPRINT_RE.match(fingerprint):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="音频不存在")
    path = tts_service.cache_dir() / f"{fingerprint}.wav"
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="音频不存在")
    return FileResponse(path, media_type="audio/wav", filename=f"{fingerprint}.wav")


@router.post("/asr", response_model=ApiResponse[ASRResponse])
def recognize_speech(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
):
    """语音 → 文本（百炼 Qwen3-ASR）。孩子按住说话的输入链路。"""
    _ensure_voice_enabled(current_user)
    wav_bytes = file.file.read()
    try:
        text = transcribe_wav(wav_bytes)
    except ASRError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return ApiResponse(data=ASRResponse(text=text), message="识别成功")
