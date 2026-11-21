/**
 * 语音 API（数字人伴学助手「小知」）
 *
 * TTS：文本 → 后端 GLM-TTS 合成的 wav 音频地址（带指纹缓存）
 * ASR：按住说话录的 WAV blob → 百炼识别文本
 *
 * 单独实现 fetch（不复用 api.ts 的 request()）：
 * ASR 是 multipart 上传，不能带 application/json 头；且语音接口的
 * 失败要静默降级（回退浏览器朗读），不该触发 request() 里的
 * 401 整页跳转登录逻辑。
 */

import { authStorage } from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface TTSResult {
  url: string;
  cached: boolean;
  chars: number;
}

function authHeaders(): Record<string, string> {
  const token = authStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 语音接口错误 → 给孩子看的友好文案（技术细节不透出） */
function friendlyVoiceError(status: number, fallback: string): string {
  if (status === 401 || status === 403) {
    return '请先登录，才能和小知语音聊天哦～';
  }
  return fallback;
}

/** 文本 → TTS 音频地址。失败抛错（调用方决定是否回退 speechSynthesis）。 */
export async function tts(text: string, speed?: number): Promise<TTSResult> {
  const resp = await fetch(`${API_BASE_URL}/voice/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text, speed }),
  });
  if (!resp.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 错误结构动态解析
    let detail = `TTS 请求失败(${resp.status})`;
    try {
      const body = await resp.json();
      detail = body?.detail || body?.message || detail;
    } catch { /* 非 JSON 响应体 */ }
    if (resp.status === 401 || resp.status === 403) {
      detail = friendlyVoiceError(resp.status, detail);
    }
    const err = new Error(detail) as Error & { status: number };
    err.status = resp.status;
    throw err;
  }
  const json = await resp.json();
  return json.data as TTSResult;
}

/** WAV blob → 识别文本。失败抛错。 */
export async function asr(wavBlob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', wavBlob, 'speech.wav');
  const resp = await fetch(`${API_BASE_URL}/voice/asr`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: form,
  });
  if (!resp.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detail = `语音识别失败(${resp.status})`;
    try {
      const body = await resp.json();
      detail = body?.detail || body?.message || detail;
    } catch { /* ignore */ }
    throw new Error(friendlyVoiceError(resp.status, detail));
  }
  const json = await resp.json();
  return json.data?.text ?? '';
}
