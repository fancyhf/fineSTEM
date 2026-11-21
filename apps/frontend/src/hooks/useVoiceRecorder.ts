/**
 * 语音录音 hook —— 孩子对小知说话的采集端
 *
 * 实现：getUserMedia + ScriptProcessorNode 采集原始 PCM → 停止时
 * 重采样到 16kHz 单声道 → 编码 16-bit PCM WAV Blob。
 *
 * 为什么不用 MediaRecorder：它只能给 webm/opus，云端 ASR 接口对 wav
 * 最稳；自编码 WAV 约 80 行且零依赖、不需要 ffmpeg。
 * 为什么不用 AudioWorklet：需要额外 worklet 文件和模块加载时序，
 * ScriptProcessor 虽标记过时但所有浏览器都支持，够用。
 */
import { useCallback, useRef, useState } from 'react';

const TARGET_SAMPLE_RATE = 16000;

export interface UseVoiceRecorderResult {
  recording: boolean;
  error: string | null;
  /** 开始录音。麦克风权限被拒时置 error。 */
  start: () => Promise<void>;
  /** 停止并返回 WAV Blob；未在录音时返回 null。 */
  stop: () => Blob | null;
  /** 丢弃当前录音。 */
  cancel: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const baseRateRef = useRef<number>(44100);

  const _cleanup = useCallback(() => {
    try { nodeRef.current?.disconnect(); } catch { /* ignore */ }
    try { ctxRef.current?.close(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    nodeRef.current = null;
    ctxRef.current = null;
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      // getUserMedia 可能因权限对话框状态静默挂起（尤其无头/自动化环境）：
      // 5 秒无结果视为启动失败，给出可操作提示，避免"按了没反应"
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('麦克风启动超时，请检查浏览器权限后重试')), 5000),
        ),
      ]);
      streamRef.current = stream;
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      ctxRef.current = ctx;
      baseRateRef.current = ctx.sampleRate;
      chunksRef.current = [];

      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;
      node.onaudioprocess = (e) => {
        // 拷贝一份：onaudioprocess 复用同一 buffer
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(node);
      // 接一个零增益输出：部分浏览器（旧 Safari）不接 destination 不跑回调
      const mute = ctx.createGain();
      mute.gain.value = 0;
      node.connect(mute);
      mute.connect(ctx.destination);

      setRecording(true);
    } catch (err) {
      const name = (err as Error)?.name || '';
      _cleanup();
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('麦克风权限被拒绝，请在浏览器地址栏允许使用麦克风');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError('没有检测到可用的麦克风');
      } else {
        setError('麦克风启动失败，请重试');
      }
      throw err;
    }
  }, [_cleanup]);

  const stop = useCallback((): Blob | null => {
    if (!recording) return null;
    setRecording(false);
    const chunks = chunksRef.current;
    const rate = baseRateRef.current;
    _cleanup();

    if (!chunks.length) return null;

    // 合并 → 降采样到 16kHz
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    const pcm = _downsample(merged, rate, TARGET_SAMPLE_RATE);
    return _encodeWav(pcm, TARGET_SAMPLE_RATE);
  }, [recording, _cleanup]);

  const cancel = useCallback(() => {
    setRecording(false);
    chunksRef.current = [];
    _cleanup();
  }, [_cleanup]);

  return { recording, error, start, stop, cancel };
}

/** 线性插值降采样（44.1k/48k → 16k，质量对语音识别足够） */
function _downsample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = src - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

/** Float32 PCM → 16-bit PCM WAV Blob */
function _encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let pos = 44;
  for (let i = 0; i < samples.length; i++, pos += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
