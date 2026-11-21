/**
 * 数字人「小知」——纯 SVG 二次元元气少女（半身 + 全身两种立绘）
 *
 * 设计（2026-11-06）：青绿品牌色系（#087F78 家族），青绿渐变短发+呆毛+
 * 星形发饰+耳机麦（"科技学院"气质），大眼腮红，连帽衫。
 * variant='full'（2026-11-06 下午）：全身立绘——同款头 + 连帽衫/百褶裙/腿鞋，
 * 游戏角色待机（重心左右轻移 + 手臂反向摆 + 脚下影子呼吸），供屏幕中央
 * 可拖动的全身模式使用。
 *
 * 口型：parent 传入 mouthSignal（{value: 0-1} 可变对象），组件内部 rAF
 * 直接改 SVG 节点属性——不经过 React state，60fps 不触发重渲染。
 * 表情：mood 状态机 idle / listening / thinking / talking / happy。
 */
import { memo, useEffect, useRef } from 'react';
import './companion.css';

export type CompanionMood = 'idle' | 'listening' | 'thinking' | 'talking' | 'happy';
export type CompanionVariant = 'bust' | 'full';

/** 口型信号：语音播放层实时写入 value（0=闭嘴，1=大张），组件每帧读取 */
export interface MouthSignal { value: number }

interface Props {
  mood?: CompanionMood;
  mouthSignal?: MouthSignal | null;
  /** 显示宽度（px）；full 变体高度按 200:340 比例自动放大 */
  size?: number;
  className?: string;
  /** 带柔和背景（浮窗大头像/全身立绘用） */
  showBackdrop?: boolean;
  variant?: CompanionVariant;
}

function CompanionCharacterImpl({
  mood = 'idle',
  mouthSignal = null,
  size = 120,
  className = '',
  showBackdrop = true,
  variant = 'bust',
}: Props) {
  const mouthOpenRef = useRef<SVGEllipseElement | null>(null);
  const mouthTongueRef = useRef<SVGEllipseElement | null>(null);
  const mouthSmileRef = useRef<SVGPathElement | null>(null);

  // 口型驱动：每帧读 signal 改属性，绕开 React 渲染
  useEffect(() => {
    if (!mouthSignal) return;
    let raf = 0;
    const loop = () => {
      const level = Math.max(0, Math.min(1, mouthSignal.value));
      const open = mouthOpenRef.current;
      const smile = mouthSmileRef.current;
      const tongue = mouthTongueRef.current;
      if (open) {
        if (level > 0.06) {
          open.setAttribute('ry', (2 + level * 9).toFixed(2));
          open.setAttribute('opacity', '1');
        } else {
          open.setAttribute('opacity', '0');
        }
      }
      if (tongue) tongue.setAttribute('opacity', level > 0.4 ? '1' : '0');
      if (smile) smile.setAttribute('opacity', level > 0.06 ? '0' : '1');
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mouthSignal]);

  const isHappy = mood === 'happy';
  const isTalking = mood === 'talking';
  const eyeBlinkClass = isHappy ? '' : 'companion-eye';

  // ── 共享部件：双马尾 / 头部（半身全身同一份坐标，y 34~132）──
  const tails = (
    <>
      <path
        className="companion-tail-left"
        d="M52 78 C 30 92, 26 130, 38 162 C 44 176, 58 172, 60 156 C 64 130, 62 100, 58 84 Z"
        fill="url(#xz-hair)"
        stroke="#086158"
        strokeWidth="2"
      />
      <path
        className="companion-tail-right"
        d="M148 78 C 170 92, 174 130, 162 162 C 156 176, 142 172, 140 156 C 136 130, 138 100, 142 84 Z"
        fill="url(#xz-hair)"
        stroke="#086158"
        strokeWidth="2"
      />
    </>
  );

  const head = (
    <>
      {/* 后层头发（脑后轮廓） */}
      <path
        d="M46 96 C 40 58, 68 38, 100 38 C 132 38, 160 58, 154 96 C 152 112, 148 124, 142 132 L 58 132 C 52 124, 48 112, 46 96 Z"
        fill="url(#xz-hair)"
        stroke="#086158"
        strokeWidth="2.5"
      />
      {/* 耳机 */}
      <path
        d="M46 92 C 44 52, 68 34, 100 34 C 132 34, 156 52, 154 92"
        fill="none"
        stroke="#26413E"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <rect x="36" y="86" width="18" height="30" rx="9" fill="#1F8E83" stroke="#0A5F58" strokeWidth="2" />
      <rect x="146" y="86" width="18" height="30" rx="9" fill="#1F8E83" stroke="#0A5F58" strokeWidth="2" />
      <rect x="41" y="93" width="8" height="16" rx="4" fill="#0A5F58" />
      <rect x="151" y="93" width="8" height="16" rx="4" fill="#0A5F58" />
      {/* 脸 */}
      <ellipse cx="100" cy="96" rx="46" ry="44" fill="#FFE9DA" />
      {/* 耳朵 */}
      <ellipse cx="54" cy="100" rx="6" ry="9" fill="#FFE9DA" stroke="#F0C4A8" strokeWidth="1.5" />
      <ellipse cx="146" cy="100" rx="6" ry="9" fill="#FFE9DA" stroke="#F0C4A8" strokeWidth="1.5" />
      {/* 麦克风（右耳罩伸出）+ 听取光环 */}
      <path
        d="M158 108 C 152 124, 136 130, 122 128"
        fill="none"
        stroke="#26413E"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="120" cy="128" r="5" fill="#26413E" />
      <circle className="companion-mic-glow" cx="120" cy="128" r="10" fill="none" stroke="#4FE3D4" strokeWidth="2.5" opacity="0" />
      {/* 眉毛 */}
      <path d="M70 78 Q 80 74, 90 78" fill="none" stroke="#0B6B62" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M110 78 Q 120 74, 130 78" fill="none" stroke="#0B6B62" strokeWidth="2.5" strokeLinecap="round" />
      {/* 眼睛（正常态，眨眼动画） */}
      {!isHappy && (
        <>
          <g className={eyeBlinkClass}>
            <ellipse cx="80" cy="100" rx="11" ry="13" fill="#FFFFFF" stroke="#3A4A48" strokeWidth="1.5" />
            <ellipse cx="80" cy="101" rx="8" ry="10.5" fill="url(#xz-iris)" />
            <ellipse cx="80" cy="102" rx="3.6" ry="5.4" fill="#123833" />
            <circle cx="77" cy="96" r="3.2" fill="#FFFFFF" />
            <circle cx="84" cy="106" r="1.8" fill="#FFFFFF" opacity="0.9" />
          </g>
          <g className={`${eyeBlinkClass} companion-eye-right`}>
            <ellipse cx="120" cy="100" rx="11" ry="13" fill="#FFFFFF" stroke="#3A4A48" strokeWidth="1.5" />
            <ellipse cx="120" cy="101" rx="8" ry="10.5" fill="url(#xz-iris)" />
            <ellipse cx="120" cy="102" rx="3.6" ry="5.4" fill="#123833" />
            <circle cx="117" cy="96" r="3.2" fill="#FFFFFF" />
            <circle cx="124" cy="106" r="1.8" fill="#FFFFFF" opacity="0.9" />
          </g>
          {/* 上睫毛 */}
          <path d="M69 94 Q 80 88, 91 94" fill="none" stroke="#123833" strokeWidth="3" strokeLinecap="round" />
          <path d="M109 94 Q 120 88, 131 94" fill="none" stroke="#123833" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {/* 开心眯眯眼 ^^ */}
      {isHappy && (
        <>
          <path d="M69 101 Q 80 92, 91 101" fill="none" stroke="#123833" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M109 101 Q 120 92, 131 101" fill="none" stroke="#123833" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
      {/* 腮红 */}
      <ellipse cx="66" cy="115" rx="8" ry="4.5" fill="#FFAC9E" opacity="0.55" />
      <ellipse cx="134" cy="115" rx="8" ry="4.5" fill="#FFAC9E" opacity="0.55" />
      {/* 嘴（默认微笑；说话时由 rAF 切换为开口椭圆） */}
      <path
        ref={mouthSmileRef}
        d="M92 122 Q 100 129, 108 122"
        fill="none"
        stroke="#A64553"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <ellipse ref={mouthOpenRef} cx="100" cy="125" rx="8" ry="2" fill="#94434E" opacity="0" />
      <ellipse ref={mouthTongueRef} cx="100" cy="128.5" rx="4.5" ry="2.4" fill="#E58A93" opacity="0" />
      {/* 前发（刘海） */}
      <path
        d="M52 92 C 50 56, 74 40, 100 40 C 126 40, 150 56, 148 92 C 140 84, 136 72, 132 64 C 128 76, 118 84, 112 88 C 112 78, 108 68, 104 62 C 98 74, 88 84, 80 88 C 78 78, 76 70, 72 64 C 66 74, 58 84, 52 92 Z"
        fill="url(#xz-hair)"
        stroke="#086158"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* 刘海高光 */}
      <path d="M62 58 C 72 48, 88 44, 100 44" fill="none" stroke="#6FE3D6" strokeWidth="3" opacity="0.5" strokeLinecap="round" />
      {/* 星星发饰 */}
      <path
        d="M70 70 L72.4 75 L78 75.8 L74 79.6 L75 85 L70 82.2 L65 85 L66 79.6 L62 75.8 L67.6 75 Z"
        fill="#FFC94D"
        stroke="#E8A723"
        strokeWidth="1"
      />
      {/* 呆毛 */}
      <path
        className="companion-ahoge"
        d="M100 40 C 98 30, 106 24, 114 26 C 106 27, 103 33, 104 40 Z"
        fill="url(#xz-hair)"
        stroke="#086158"
        strokeWidth="2"
      />
    </>
  );

  const neck = <rect x="92" y="138" width="16" height="18" rx="7" fill="#F7D0B8" />;

  const defs = (
    <defs>
      <radialGradient id="xz-bg" cx="50%" cy="42%" r="65%">
        <stop offset="0%" stopColor="#E2F8F4" />
        <stop offset="100%" stopColor="#B9ECE3" />
      </radialGradient>
      <linearGradient id="xz-hair" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2FBFAE" />
        <stop offset="100%" stopColor="#0A7A70" />
      </linearGradient>
      <linearGradient id="xz-iris" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3AD8CB" />
        <stop offset="100%" stopColor="#076A60" />
      </linearGradient>
      <linearGradient id="xz-hoodie" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#18B3A4" />
        <stop offset="100%" stopColor="#0B857A" />
      </linearGradient>
    </defs>
  );

  const decorations = (
    <>
      {mood === 'thinking' && (
        <g className="companion-think-bubble">
          <rect x="146" y="38" width="44" height="30" rx="12" fill="#FFFFFF" stroke="#9BD9D0" strokeWidth="2" />
          <path d="M152 66 L 148 74 L 160 68 Z" fill="#FFFFFF" stroke="#9BD9D0" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="160" cy="53" r="2.6" fill="#0B857A" />
          <circle cx="168" cy="53" r="2.6" fill="#0B857A" />
          <circle cx="176" cy="53" r="2.6" fill="#0B857A" />
        </g>
      )}
      {isHappy && (
        <g>
          <path className="companion-sparkle" d="M30 56 L33 62 L39 63 L34 67 L35 73 L30 70 L25 73 L26 67 L21 63 L27 62 Z" fill="#FFC94D" />
          <path className="companion-sparkle companion-sparkle-2" d="M172 118 L174 122 L178 123 L175 126 L176 130 L172 128 L168 130 L169 126 L166 123 L170 122 Z" fill="#FF8FA3" />
          <path className="companion-sparkle companion-sparkle-3" d="M40 140 L42 144 L46 145 L43 148 L44 152 L40 150 L36 152 L37 148 L34 145 L38 144 Z" fill="#4FE3D4" />
        </g>
      )}
    </>
  );

  if (variant === 'full') {
    const fullHeight = Math.round(size * 340 / 200);
    return (
      <svg
        width={size}
        height={fullHeight}
        viewBox="0 0 200 340"
        className={`companion-character select-none ${className}`}
        role="img"
        aria-label="数字学伴小知（全身）"
      >
        {defs}
        {showBackdrop && <ellipse cx="100" cy="176" rx="94" ry="158" fill="url(#xz-bg)" opacity="0.9" />}
        {/* 脚下影子（不随重心移动翻转，单独呼吸） */}
        <ellipse className="companion-ground-shadow" cx="100" cy="330" rx="50" ry="8" fill="#0A6F66" opacity="0.28" />
        {/* 游戏待机：重心左右轻移 */}
        <g className={`companion-idle-shift ${isTalking ? 'companion-talking' : ''}`}>
          {tails}
          {/* 手臂（垂在身侧，随重心反向轻摆） */}
          <g className="companion-arm-left">
            <path
              d="M138 156 C 148 170, 152 204, 147 228 L 132 226 C 136 204, 135 180, 128 162 Z"
              fill="url(#xz-hoodie)"
              stroke="#086158"
              strokeWidth="2.5"
            />
            <circle cx="141" cy="233" r="7.5" fill="#FFE9DA" stroke="#F0C4A8" strokeWidth="1.5" />
          </g>
          <g className="companion-arm-right">
            <path
              d="M62 156 C 52 170, 48 204, 53 228 L 68 226 C 64 204, 65 180, 72 162 Z"
              fill="url(#xz-hoodie)"
              stroke="#086158"
              strokeWidth="2.5"
            />
            <circle cx="59" cy="233" r="7.5" fill="#FFE9DA" stroke="#F0C4A8" strokeWidth="1.5" />
          </g>
          {/* 连帽衫躯干 */}
          <path
            d="M60 162 C 60 150, 80 145, 100 145 C 120 145, 140 150, 140 162 L 142 230 C 142 242, 128 246, 100 246 C 72 246, 58 242, 58 230 Z"
            fill="url(#xz-hoodie)"
            stroke="#086158"
            strokeWidth="2.5"
          />
          {/* 兜帽兜边 */}
          <path d="M72 154 C 84 147, 116 147, 128 154 C 120 150, 80 150, 72 154 Z" fill="#0A6F66" opacity="0.6" />
          {/* 白色领口 */}
          <path d="M86 147 C 92 157, 108 157, 114 147 C 110 152, 90 152, 86 147 Z" fill="#FFFFFF" stroke="#D5EAE7" strokeWidth="1" />
          {/* 口袋与拉链 */}
          <path d="M74 202 Q 100 213, 126 202" fill="none" stroke="#0A6F66" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="100" y1="158" x2="100" y2="228" stroke="#0A6F66" strokeWidth="2" strokeLinecap="round" />
          {/* 星星徽章 */}
          <path
            d="M126 172 L129 178 L136 179 L131 184 L132 191 L126 187 L120 191 L121 184 L116 179 L123 178 Z"
            fill="#FFC94D"
            stroke="#E8A723"
            strokeWidth="1"
          />
          {/* 百褶裙 */}
          <g className="companion-skirt">
            <path
              d="M62 244 L 138 244 L 148 274 Q 100 284, 52 274 Z"
              fill="#0A6F66"
              stroke="#086158"
              strokeWidth="2"
            />
            <path d="M78 246 L 71 276 M100 246 L 100 279 M122 246 L 129 276" stroke="#085F58" strokeWidth="1.5" opacity="0.7" fill="none" />
          </g>
          {/* 腿与鞋 */}
          <rect x="81" y="276" width="15" height="42" rx="7" fill="#FFE9DA" stroke="#F0C4A8" strokeWidth="1.5" />
          <rect x="104" y="276" width="15" height="42" rx="7" fill="#FFE9DA" stroke="#F0C4A8" strokeWidth="1.5" />
          <rect x="81" y="306" width="15" height="12" rx="4" fill="#FFFFFF" opacity="0.9" />
          <rect x="104" y="306" width="15" height="12" rx="4" fill="#FFFFFF" opacity="0.9" />
          <rect x="73" y="316" width="25" height="16" rx="7" fill="#FFFFFF" stroke="#D5EAE7" strokeWidth="1.5" />
          <rect x="102" y="316" width="25" height="16" rx="7" fill="#FFFFFF" stroke="#D5EAE7" strokeWidth="1.5" />
          <path d="M74 327 L 97 327 M103 327 L 126 327" stroke="#16AFA0" strokeWidth="2.5" strokeLinecap="round" />
          {neck}
          {head}
        </g>
        {decorations}
      </svg>
    );
  }

  // ── 半身（浮窗/气泡头像，原版）──
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`companion-character select-none ${className}`}
      role="img"
      aria-label="数字学伴小知"
    >
      {defs}
      {showBackdrop && <circle cx="100" cy="100" r="96" fill="url(#xz-bg)" />}
      <g className={`companion-sway ${isTalking ? 'companion-talking' : ''}`}>
        {tails}
        {/* 肩膀与连帽衫 */}
        <path
          d="M54 200 C 54 166, 76 152, 100 152 C 124 152, 146 166, 146 200 Z"
          fill="url(#xz-hoodie)"
          stroke="#086158"
          strokeWidth="2.5"
        />
        <path d="M70 162 C 84 152, 116 152, 130 162 C 122 158, 78 158, 70 162 Z" fill="#0A6F66" opacity="0.6" />
        <path d="M86 153 C 92 162, 108 162, 114 153 C 110 158, 90 158, 86 153 Z" fill="#FFFFFF" stroke="#D5EAE7" strokeWidth="1" />
        <line x1="100" y1="161" x2="100" y2="196" stroke="#0A6F66" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M128 176 L131 182 L138 183 L133 188 L134 195 L128 191 L122 195 L123 188 L118 183 L125 182 Z"
          fill="#FFC94D"
          stroke="#E8A723"
          strokeWidth="1"
        />
        {neck}
        {head}
      </g>
      {decorations}
    </svg>
  );
}

export const CompanionCharacter = memo(CompanionCharacterImpl);
