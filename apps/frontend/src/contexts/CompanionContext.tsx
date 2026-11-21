/**
 * 全局语音引擎（数字人导师「小知」）—— Context
 *
 * 产品模型（2026-11-06 晚，用户定调）：
 *   用户进来就是要跟 AI 助学导师聊天的。聊天不该只有打字——小知是
 *   「聊天的化身」：孩子开口说（语音输入），她开口回答（朗读+口型），
 *   形象本身内嵌在两个聊天界面里（首页智能对话区左侧立绘 + Create
 *   聊天区头部头像）。**没有独立的悬浮数字人组件。**
 *
 * 本 Provider 提供"嗓子+耳朵+见面礼仪"：
 *   - speech：语音合成播放队列（分句、口型信号、字幕）—— useCompanionSpeech
 *   - recorder：录音 —— useVoiceRecorder（16k mono WAV）
 *   - transcribe：录音 → 百炼 ASR → 文字（401/403 映射成孩子的友好提示）
 *   - voiceOn：朗读开关（默认开，sessionStorage 同步给 Create 的语音风格提示词注入）
 *   - speakMaybe：voiceOn 时才朗读（Create onEnd 调用）
 *   - tryGreet：小知先说话——进站首次手势即打招呼（每会话一次；
 *     浏览器自动播放策略要求出声前有手势，无手势时的提前尝试只作探测）
 *   - startVoiceInput / finishVoiceInput：点击小知进语音模式的原语
 *     （点她→她开始听；再点→结束并识别）
 *
 * 跨页面朗读不中断：Provider 挂在 Layout 层。朗读期间由 <SpeakingCapsule>
 * 显示一个极小的"正在说话"胶囊（字幕+停止），说完自动消失——这是音频控件，
 * 不是数字人。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useCompanionSpeech } from '../hooks/useCompanionSpeech';
import { asr } from '../services/voiceApi';
import { setVoiceModeOn, isVoiceModeOn, COMPANION_GREETING } from '../lib/companionPrompts';

const GREET_KEY = 'finestem_companion_greeted';
const GESTURE_KEY = 'finestem_companion_has_gesture';

/** 手势标记跨整页导航持久（sessionStorage）：进站后点过任意处，音频出声即被允许 */
function readHasGesture(): boolean {
  try { return sessionStorage.getItem(GESTURE_KEY) === '1'; } catch { return false; }
}

interface CompanionContextValue {
  speech: ReturnType<typeof useCompanionSpeech>;
  recorder: ReturnType<typeof useVoiceRecorder>;
  /** 语音识别中（说完→请求识别的间隙） */
  asrBusy: boolean;
  /** 语音识别失败的孩子友好提示（各聊天界面自行渲染） */
  asrError: string | null;
  clearAsrError: () => void;
  /** 结束录音并识别，返回文字。失败抛 Error（message 已是孩子友好文案）。 */
  transcribe: () => Promise<string>;
  /** 朗读开关（默认开；同步 sessionStorage，Create 据此注入语音风格提示词） */
  voiceOn: boolean;
  toggleVoice: () => void;
  /** voiceOn 时朗读一段文本（AI 回复 onEnd 用）；自动先解锁音频 */
  speakMaybe: (text: string) => void;
  /** 小知先说话：打招呼（每会话一次；有手势立即说，无手势挂起等首次手势） */
  tryGreet: () => void;
  /** 点击小知→开始听（语音模式）；失败提示走 asrError/recorder.error */
  startVoiceInput: () => void;
  /** 再点一下→结束 listening 并识别，返回文字（空串=没录到/失败） */
  finishVoiceInput: () => Promise<string>;
}

const CompanionContext = createContext<CompanionContextValue | null>(null);

export function useCompanion(): CompanionContextValue {
  const ctx = useContext(CompanionContext);
  if (!ctx) throw new Error('useCompanion 必须在 <CompanionProvider> 内使用');
  return ctx;
}

export function CompanionProvider({ children }: { children: ReactNode }) {
  const speech = useCompanionSpeech();
  const recorder = useVoiceRecorder();
  const [voiceOn, setVoiceOnState] = useState(() => isVoiceModeOn());
  const [asrBusy, setAsrBusy] = useState(false);
  const [asrError, setAsrError] = useState<string | null>(null);
  const asrBusyRef = useRef(false);
  const greetedRef = useRef(false);

  const clearAsrError = useCallback(() => setAsrError(null), []);

  // 朗读开关与 sessionStorage 保持同步（挂载即写默认值）：
  // Create 发消息前读 isVoiceModeOn() 决定是否注入"适合朗读"的风格提示词
  useEffect(() => { setVoiceModeOn(voiceOn); }, [voiceOn]);

  const toggleVoice = useCallback(() => {
    setVoiceOnState((prev) => {
      const next = !prev;
      setVoiceModeOn(next); // sessionStorage + 立即生效（关闭时停掉正在读的）
      if (!next) speech.stop();
      return next;
    });
  }, [speech]);

  const speakMaybe = useCallback((text: string) => {
    if (!voiceOn || !text?.trim()) return;
    speech.unlock();
    speech.speak(text);
  }, [voiceOn, speech]);

  // ── 小知先说话（2026-11-07 用户验收）：
  // 进站后她的第一句话不该等孩子操作语音。浏览器自动播放策略要求出声前
  // 页面发生过手势，所以手势只记标记（跨整页导航持久），打招呼由聊天页面
  // （Home/Create 挂载时 tryGreet）消费——避免登录页的点击把打招呼机会
  // 浪费在未登录的 401 上。每会话只说一次。
  const [hasGesture, setHasGesture] = useState(readHasGesture);
  const hasGestureRef = useRef(hasGesture);
  useEffect(() => { hasGestureRef.current = hasGesture; }, [hasGesture]);
  const pendingGreetRef = useRef(false);
  const voiceOnRef = useRef(voiceOn);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);

  // 真正开口打招呼（说话+标记+被拦截回滚）
  const _greetNow = useCallback(() => {
    speech.unlock();
    speech.speak(COMPANION_GREETING);
    greetedRef.current = true;
    pendingGreetRef.current = false;
    try { sessionStorage.setItem(GREET_KEY, '1'); } catch { /* ignore */ }
    // Chrome 的 user activation 按整页导航重置：sessionStorage 手势标记只代表
    // "本站会话内点过"，不代表"本导航内点过"。若 3.5s 后仍未真正出声
    // （play 被自动播放策略拦截→内部 stop），回滚标记并重新挂起——
    // 用户下一次真实点击时她会真正开口。
    window.setTimeout(() => {
      if (!speech.hasPlayedAudioRef.current) {
        greetedRef.current = false;
        pendingGreetRef.current = true;
        try { sessionStorage.removeItem(GREET_KEY); } catch { /* ignore */ }
      }
    }, 3500);
  }, [speech]);

  const tryGreet = useCallback(() => {
    if (greetedRef.current || !voiceOnRef.current) return;
    try {
      if (sessionStorage.getItem(GREET_KEY) === '1') { greetedRef.current = true; return; }
    } catch { /* 无存储环境 */ }
    if (hasGestureRef.current) {
      _greetNow();
    } else {
      // 还没有手势：挂起等首次 pointerdown（那时一定是手势）
      pendingGreetRef.current = true;
    }
  }, [_greetNow]);

  const _greetNowRef = useRef(_greetNow);
  useEffect(() => { _greetNowRef.current = _greetNow; }, [_greetNow]);
  const tryGreetRef = useRef(tryGreet);
  useEffect(() => { tryGreetRef.current = tryGreet; }, [tryGreet]);

  // 任意手势：持久标记；若有挂起的打招呼请求立即兑现；
  // 若已标记但从未真正出声（被自动播放策略拦截的窗口内），此刻给了
  // 真实手势 → 回滚标记立即重说
  useEffect(() => {
    const onGesture = () => {
      if (!hasGestureRef.current) {
        hasGestureRef.current = true;
        setHasGesture(true);
        try { sessionStorage.setItem(GESTURE_KEY, '1'); } catch { /* ignore */ }
      }
      if (pendingGreetRef.current) {
        pendingGreetRef.current = false;
        greetedRef.current = false;
        _greetNowRef.current();
      } else if (greetedRef.current && !speech.hasPlayedAudioRef.current) {
        greetedRef.current = false;
        _greetNowRef.current();
      }
    };
    document.addEventListener('pointerdown', onGesture, { capture: true });
    return () => document.removeEventListener('pointerdown', onGesture, { capture: true });
  }, [speech]);

  const transcribe = useCallback(async (): Promise<string> => {
    setAsrError(null);
    const blob = recorder.stop();
    if (!blob) throw new Error('没录到声音，再试一次吧');
    asrBusyRef.current = true;
    setAsrBusy(true);
    try {
      const text = await asr(blob);
      return text;
    } catch (err) {
      const msg = (err as Error)?.message || '没听清，再试一次吧';
      setAsrError(msg);
      throw err;
    } finally {
      asrBusyRef.current = false;
      setAsrBusy(false);
    }
  }, [recorder]);

  // ── 点击小知进语音模式（2026-11-07 用户验收）：
  // 点她一下→她开始听（listening）；再点→结束并识别。与输入栏"按住说话"并存。
  const startVoiceInput = useCallback(() => {
    if (asrBusyRef.current) return;
    clearAsrError();
    speech.stop(); // 不一边说一边听
    speech.unlock();
    recorder.start().catch(() => { /* recorder 内部已置 error */ });
  }, [recorder, speech, clearAsrError]);

  const finishVoiceInput = useCallback(async (): Promise<string> => {
    if (!recorder.recording) return '';
    try {
      return await transcribe();
    } catch {
      return ''; // 错误已由 context 置为友好提示
    }
  }, [recorder, transcribe]);

  const value = useMemo<CompanionContextValue>(() => ({
    speech,
    recorder,
    asrBusy,
    asrError,
    clearAsrError,
    transcribe,
    voiceOn,
    toggleVoice,
    speakMaybe,
    tryGreet,
    startVoiceInput,
    finishVoiceInput,
  }), [speech, recorder, asrBusy, asrError, clearAsrError, transcribe, voiceOn, toggleVoice, speakMaybe, tryGreet, startVoiceInput, finishVoiceInput]);

  return (
    <CompanionContext.Provider value={value}>
      {children}
      <SpeakingCapsule />
    </CompanionContext.Provider>
  );
}

/**
 * 正在说话胶囊：仅朗读期间出现的极小音频控件（字幕 + 停止）。
 * 跨页面导航时朗读不中断，靠它保持可控。说完自动消失。
 * 容器 pointer-events-none（不挡页面点击），仅停止按钮可点。
 */
function SpeakingCapsule() {
  const { speech } = useCompanion();
  if (!speech.speaking) return null;
  return (
    <div
      data-testid="companion-speaking-capsule"
      className="pointer-events-none fixed z-40 bottom-4 left-1/2 -translate-x-1/2 max-w-[min(480px,calc(100vw-2rem))] flex items-center gap-2 bg-teal-600/95 text-white rounded-full shadow-lg pl-3 pr-1.5 py-1.5"
    >
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-200 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
      </span>
      <span className="text-xs truncate" data-testid="companion-capsule-text">
        {speech.currentSentence || '小知正在说…'}
      </span>
      <button
        onClick={speech.stop}
        className="pointer-events-auto flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
        title="停止朗读"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
