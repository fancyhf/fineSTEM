"""
语音数字人伴学（小知）API 测试

用途：覆盖 TTS 缓存/失败、ASR 正常/失败、feature flag 门禁、音频文件取用
维护者：AI Agent
"""

import io
import struct

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings


# ── 外呼 mock ──────────────────────────────────────────────────────

class _FakeResponse:
    def __init__(self, status_code=200, content=b"", json_data=None, text=""):
        self.status_code = status_code
        self.content = content
        self._json = json_data
        self.text = text

    def json(self):
        if self._json is None:
            raise ValueError("no json")
        return self._json


def _fake_wav() -> bytes:
    """构造一个 >5KB 的合法 WAV 头 + 静音数据（tts_service 只看大小）。"""
    sample_rate = 16000
    num_samples = 4096
    data = b"".join(struct.pack("<h", 0) for _ in range(num_samples))
    header = b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVEfmt " + struct.pack(
        "<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16
    ) + b"data" + struct.pack("<I", len(data))
    return header + data


def _asr_ok_response(text: str) -> _FakeResponse:
    return _FakeResponse(json_data={
        "choices": [{"message": {"content": text}}],
    })


# ── TTS ────────────────────────────────────────────────────────────

class TestTTS:
    def test_tts_success_and_cache_hit(
        self, client: TestClient, registered_user: dict, auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch, tmp_path,
    ):
        import app.api.voice as voice_mod
        from app.services import tts_service

        monkeypatch.setattr(settings, "VOICE_TTS_CACHE_DIR", str(tmp_path / "tts_cache"))
        calls = []
        def _fake_post(url, **kwargs):
            calls.append(url)
            assert "bigmodel.cn" in url
            assert kwargs["headers"]["Authorization"].startswith("Bearer ")
            assert kwargs["json"]["model"] == "glm-tts"
            return _FakeResponse(content=_fake_wav())
        monkeypatch.setattr(tts_service.httpx, "post", _fake_post)

        resp = client.post("/api/v1/voice/tts", json={"text": "你好呀，我是小知"},
                           headers=auth_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["cached"] is False
        assert data["url"].startswith("/api/v1/voice/tts-audio/")
        assert data["url"].endswith(".wav")
        assert len(calls) == 1

        # 同文本第二次：命中缓存，不再外呼
        resp2 = client.post("/api/v1/voice/tts", json={"text": "你好呀，我是小知"},
                            headers=auth_headers)
        assert resp2.status_code == 200
        assert resp2.json()["data"]["cached"] is True
        assert resp2.json()["data"]["url"] == data["url"]
        assert len(calls) == 1

    def test_tts_engine_failure_returns_503(
        self, client: TestClient, registered_user: dict, auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch, tmp_path,
    ):
        from app.services import tts_service

        monkeypatch.setattr(settings, "VOICE_TTS_CACHE_DIR", str(tmp_path / "tts_cache"))
        def _fake_post(url, **kwargs):
            return _FakeResponse(status_code=500, text="upstream boom")
        monkeypatch.setattr(tts_service.httpx, "post", _fake_post)

        resp = client.post("/api/v1/voice/tts", json={"text": "测试失败场景"},
                           headers=auth_headers)
        assert resp.status_code == 503
        assert "合成失败" in resp.json()["detail"]

    def test_tts_rejects_blank_text(
        self, client: TestClient, registered_user: dict, auth_headers: dict,
    ):
        resp = client.post("/api/v1/voice/tts", json={"text": "   "},
                           headers=auth_headers)
        assert resp.status_code == 422

    def test_tts_requires_login(self, client: TestClient):
        resp = client.post("/api/v1/voice/tts", json={"text": "匿名不行"})
        assert resp.status_code in (401, 403)

    def test_tts_audio_roundtrip_and_traversal_guard(
        self, client: TestClient, registered_user: dict, auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch, tmp_path,
    ):
        from app.services import tts_service

        monkeypatch.setattr(settings, "VOICE_TTS_CACHE_DIR", str(tmp_path / "tts_cache"))
        monkeypatch.setattr(tts_service.httpx, "post", lambda url, **kw: _FakeResponse(content=_fake_wav()))

        resp = client.post("/api/v1/voice/tts", json={"text": "取音频测试"},
                           headers=auth_headers)
        url = resp.json()["data"]["url"]

        audio = client.get(url)
        assert audio.status_code == 200
        assert audio.headers["content-type"].startswith("audio/wav")
        assert len(audio.content) > 1000

        # 非法指纹（路径穿越/格式不对）→ 404
        assert client.get("/api/v1/voice/tts-audio/../../etc/passwd.wav").status_code == 404
        assert client.get("/api/v1/voice/tts-audio/zzzz.wav").status_code == 404


# ── ASR ────────────────────────────────────────────────────────────

class TestASR:
    def test_asr_glm_primary(
        self, client: TestClient, registered_user: dict, auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """引擎链主力=智谱 GLM-ASR（OpenAI 兼容 multipart），已购智谱。"""
        from app.services import asr_service

        def _fake_post(url, **kwargs):
            assert "open.bigmodel.cn" in url
            assert "/audio/transcriptions" in url
            assert kwargs["data"]["model"] == "glm-asr"
            files = kwargs["files"]
            assert files["file"][0] == "speech.wav"
            return _FakeResponse(json_data={"text": "你好小知，我想做一个生态岛游戏"})
        monkeypatch.setattr(asr_service.httpx, "post", _fake_post)

        wav = _fake_wav()
        resp = client.post("/api/v1/voice/asr",
                           files={"file": ("speech.wav", io.BytesIO(wav), "audio/wav")},
                           headers=auth_headers)
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["text"] == "你好小知，我想做一个生态岛游戏"

    def test_asr_bailian_fallback_when_glm_fails(
        self, client: TestClient, registered_user: dict, auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """GLM 失败 → 自动切百炼兜底。"""
        from app.services import asr_service

        calls = []
        def _fake_post(url, **kwargs):
            calls.append(url)
            if "open.bigmodel.cn" in url:
                return _FakeResponse(status_code=403, text='{"error":"FreeTierOnly"}')
            assert "dashscope.aliyuncs.com" in url
            body = kwargs["json"]
            assert body["model"] == "qwen3-asr-flash"
            return _asr_ok_response("兜底引擎识别结果")
        monkeypatch.setattr(asr_service.httpx, "post", _fake_post)

        wav = _fake_wav()
        resp = client.post("/api/v1/voice/asr",
                           files={"file": ("speech.wav", io.BytesIO(wav), "audio/wav")},
                           headers=auth_headers)
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["text"] == "兜底引擎识别结果"
        assert len(calls) == 2  # 两个引擎都试了

    def test_asr_all_engines_fail_friendly(
        self, client: TestClient, registered_user: dict, auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
    ):
        from app.services import asr_service

        def _fake_post(url, **kwargs):
            if "open.bigmodel.cn" in url:
                return _FakeResponse(status_code=500, text="boom")
            return _FakeResponse(status_code=403, text="FreeTierOnly quota")
        monkeypatch.setattr(asr_service.httpx, "post", _fake_post)

        wav = _fake_wav()
        resp = client.post("/api/v1/voice/asr",
                           files={"file": ("speech.wav", io.BytesIO(wav), "audio/wav")},
                           headers=auth_headers)
        assert resp.status_code == 400
        # 最终错误来自链上最后一个引擎（百炼 403 额度）——文案对孩子友好
        assert "打字告诉小知" in resp.json()["detail"]

    def test_asr_rejects_tiny_audio(
        self, client: TestClient, registered_user: dict, auth_headers: dict,
    ):
        resp = client.post("/api/v1/voice/asr",
                           files={"file": ("speech.wav", io.BytesIO(b"RIFFtiny"), "audio/wav")},
                           headers=auth_headers)
        assert resp.status_code == 400
        assert "太短" in resp.json()["detail"]


# ── feature flag 门禁 ──────────────────────────────────────────────

class TestVoiceFeatureFlag:
    @pytest.fixture
    def flag_off(self, monkeypatch: pytest.MonkeyPatch):
        import app.api.voice as voice_mod
        monkeypatch.setattr(
            voice_mod.feature_flag_service, "is_enabled",
            lambda flag, user_id: False,
        )

    def test_tts_forbidden_when_flag_off(
        self, client: TestClient, registered_user: dict, auth_headers: dict, flag_off,
    ):
        resp = client.post("/api/v1/voice/tts", json={"text": "你好"}, headers=auth_headers)
        assert resp.status_code == 403

    def test_asr_forbidden_when_flag_off(
        self, client: TestClient, registered_user: dict, auth_headers: dict, flag_off,
    ):
        resp = client.post("/api/v1/voice/asr",
                           files={"file": ("speech.wav", io.BytesIO(_fake_wav()), "audio/wav")},
                           headers=auth_headers)
        assert resp.status_code == 403

    def test_voice_companion_flag_in_snapshot(self):
        """flag 必须出现在 snapshot 里（否则 feature_flags.json 永远覆盖不到它）。"""
        from app.services.feature_flags import feature_flag_service
        assert "voice_companion" in feature_flag_service.snapshot()
