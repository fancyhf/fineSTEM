/**
 * 数字人语音播放 hook —— 小知的嗓音 + 口型信号源
 *
 * 职责：
 * 1. 把 assistant 回复清洗分句（speechText.ts），逐句请求后端 TTS，
 *    顺序播放（队列），单句失败不阻塞整段。
 * 2. 播放经 WebAudio AnalyserNode 实时算振幅 → 写入 mouthSignal.value，
 *    CompanionCharacter 每帧读取驱动口型（真口型同步）。
 * 3. 后端 TTS 不可用（503/网络）→ 回退浏览器 speechSynthesis，
 *    口型改用正弦假动画（InteractiveCodeTour 的朗读先例同款 API）。
 *
 * 浏览器自动播放策略：AudioContext 必须在用户手势后 resume，
 * Widget 在首次点击展开时调用 unlock()。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tts } from '../services/voiceApi';
import { splitIntoSpeakableSentences } from '../lib/speechText';
import type { MouthSignal } from '../components/Companion/CompanionCharacter';

export interface UseCompanionSpeechResult {
  /** 正在播放（含浏览器兜底朗读） */
  speaking: boolean;
  /** 当前正在朗读的句子（字幕展示用） */
  currentSentence: string;
  /** 播完整个队列时回调一次 */
  speak: (rawText: string, onDone?: () => void) => void;
  stop: () => void;
  /** 用户手势后调用一次，解锁 AudioContext */
  unlock: () => void;
  /** 口型信号（传给 CompanionCharacter） */
  mouthSignal: MouthSignal;
  /** 本会话是否真正出过声（audio/speechSynthesis onstart 置 true，稳定 ref，
   *  供"小知先说话"在 setTimeout 闭包里读取，不受 speech 对象重建影响）。 */
  hasPlayedAudioRef: { current: boolean };
}

export function useCompanionSpeech(): UseCompanionSpeechResult {
  const [speaking, setSpeaking] = useState(false);
  const [currentSentence, setCurrentSentence] = useState('');
  const hasPlayedAudioRef = useRef(false);
  // 稳定可变对象（非 ref）：语音层每帧写 value，角色组件每帧读，绕开 React 渲染
  const mouthSignal = useMemo<MouthSignal>(() => ({ value: 0 }), []);

  const queueRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const srcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef(0);
  const fakeMouthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneCbRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);  // 每次 speak/stop 递增，旧句的回调全部作废

  const unlock = useCallback(() => {
    try {
      if (!ctxRef.current) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new Ctor();
        analyserRef.current = ctxRef.current.createAnalyser();
        analyserRef.current.fftSize = 512;
      }
      if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
    } catch (e) {
      console.warn('[companionSpeech] AudioContext 初始化失败，口型将退化为假动画', e);
    }
  }, []);

  const _clearMouthLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const _startMouthLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return; // 无 analyser：浏览器兜底路径自己起假动画
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      // 取低中频段（人声能量区）
      const bands = Math.min(80, buf.length);
      for (let i = 2; i < bands; i++) sum += buf[i];
      const rms = sum / (bands - 2) / 255;
      // 归一化+平滑：语音能量通常在 0~0.5 区间，拉到口型可用范围
      const next = Math.max(0, Math.min(1, rms * 2.6));
      mouthSignal.value = mouthSignal.value * 0.5 + next * 0.5;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [mouthSignal]);

  /** 假口型：正弦开合（浏览器兜底朗读拿不到音频流时用） */
  const _startFakeMouth = useCallback(() => {
    if (fakeMouthTimerRef.current) return;
    const t0 = Date.now();
    fakeMouthTimerRef.current = setInterval(() => {
      const phase = (Date.now() - t0) / 180;
      mouthSignal.value = 0.5 + 0.5 * Math.abs(Math.sin(phase));
    }, 66);
  }, [mouthSignal]);

  const _stopFakeMouth = useCallback(() => {
    if (fakeMouthTimerRef.current) {
      clearInterval(fakeMouthTimerRef.current);
      fakeMouthTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    doneCbRef.current = null;
    _clearMouthLoop();
    _stopFakeMouth();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    mouthSignal.value = 0;
    setSpeaking(false);
    setCurrentSentence('');
  }, [_clearMouthLoop, _stopFakeMouth, mouthSignal]);

  const speak = useCallback((rawText: string, onDone?: () => void) => {
    stop();
    const sentences = splitIntoSpeakableSentences(rawText);
    if (!sentences.length) {
      onDone?.();
      return;
    }
    queueRef.current = sentences;
    doneCbRef.current = onDone ?? null;
    setSpeaking(true);
    _playNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- _playNext 为模块内稳定闭包，见下
  }, [stop]);

  const _playNext = useCallback(() => {
    const generation = generationRef.current;
    const sentence = queueRef.current.shift();
    if (sentence === undefined) {
      // 队列播完
      _clearMouthLoop();
      _stopFakeMouth();
      mouthSignal.value = 0;
      setSpeaking(false);
      setCurrentSentence('');
      const cb = doneCbRef.current;
      doneCbRef.current = null;
      cb?.();
      return;
    }
    setCurrentSentence(sentence);
    mouthSignal.value = 0;

    tts(sentence)
      .then((result) => {
        if (generation !== generationRef.current) return; // 已被 stop() 打断
        _playAudioUrl(result.url, generation);
      })
      .catch((err) => {
        console.warn('[companionSpeech] TTS 失败，回退浏览器朗读:', err?.message || err);
        if (generation !== generationRef.current) return;
        _playBrowserFallback(sentence, generation);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 稳定依赖由调用链保证
  }, [_clearMouthLoop, _stopFakeMouth, mouthSignal]);

  const _playAudioUrl = useCallback((url: string, generation: number) => {
    unlock();
    const audio = new Audio(url);
    audioRef.current = audio;
    try {
      if (ctxRef.current && analyserRef.current && !srcRef.current) {
        srcRef.current = ctxRef.current.createMediaElementSource(audio);
        srcRef.current.connect(analyserRef.current);
        analyserRef.current.connect(ctxRef.current.destination);
      } else if (ctxRef.current && analyserRef.current) {
        // 复用 ctx 的 audio 元素不能重复 createMediaElementSource：每次新建 audio 后
        // 旧的 source 仍指向旧元素；这里对每个新 audio 建独立 source（html audio 不受同源限制）
        const src = ctxRef.current.createMediaElementSource(audio);
        src.connect(analyserRef.current);
      }
    } catch (e) {
      console.warn('[companionSpeech] WebAudio 路由失败，仅播放无口型:', e);
    }
    _startMouthLoop();
    audio.onplaying = () => { hasPlayedAudioRef.current = true; };
    audio.onended = () => {
      if (generation !== generationRef.current) return;
      audioRef.current = null;
      _playNext();
    };
    audio.onerror = () => {
      if (generation !== generationRef.current) return;
      console.warn('[companionSpeech] 音频播放失败，跳到下一句');
      _playNext();
    };
    void audio.play().catch((e) => {
      console.warn('[companionSpeech] play() 被自动播放策略拦截:', e);
      // 播放被拦截：整段停下，等下一次手势
      stop();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hook 内部私有链
  }, [unlock, _startMouthLoop, _playNext, stop]);

  const _playBrowserFallback = useCallback((sentence: string, generation: number) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) throw new Error('speechSynthesis 不可用');
      const utter = new SpeechSynthesisUtterance(sentence);
      utter.lang = 'zh-CN';
      utter.rate = 1.05;
      const voice = _pickChineseVoice(synth);
      if (voice) utter.voice = voice;
      utter.onstart = () => { hasPlayedAudioRef.current = true; };
      utter.onend = () => {
        if (generation !== generationRef.current) return;
        _stopFakeMouth();
        _playNext();
      };
      utter.onerror = () => {
        if (generation !== generationRef.current) return;
        _stopFakeMouth();
        _playNext();
      };
      _startFakeMouth();
      synth.speak(utter);
    } catch (e) {
      console.warn('[companionSpeech] 浏览器朗读兜底失败，跳句:', e);
      _playNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hook 内部私有链
  }, [_stopFakeMouth, _startFakeMouth, _playNext]);

  // 卸载时全部清干净
  useEffect(() => () => {
    stop();
    try { srcRef.current?.disconnect(); } catch { /* ignore */ }
    try { analyserRef.current?.disconnect(); } catch { /* ignore */ }
    try { void ctxRef.current?.close(); } catch { /* ignore */ }
  }, [stop]);

  return { speaking, currentSentence, speak, stop, unlock, mouthSignal, hasPlayedAudioRef };
}

function _pickChineseVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices?.() || [];
  if (!voices.length) return null;
  const prefer = ['xiaoxiao', 'xiaoyi', 'huihui', 'yaoyao', 'kangkang', 'tingting', 'meijia', 'google'];
  for (const key of prefer) {
    const hit = voices.find((v) => v.lang?.toLowerCase().startsWith('zh') && v.name.toLowerCase().includes(key));
    if (hit) return hit;
  }
  return voices.find((v) => v.lang?.toLowerCase().startsWith('zh')) || null;
}
