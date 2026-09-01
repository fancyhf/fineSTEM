# -*- coding: utf-8 -*-
"""程序原创 BGM 合成器（有节拍/旋律/和声的短衰减音色，无任何持续长音 → 无嗡嗡感）。
用法：python bgm_music.py young|soft [输出秒数]
young：108 BPM 五声音阶琶音 + 贝斯 + 轻打点（少年科普，轻快）
soft ：84 BPM 马林巴慢琶音 + 柔贝斯（家长对谈，温和）
输出：bgm_young.wav / bgm_soft.wav
"""
import sys, numpy as np, wave

SR = 24000
mode = sys.argv[1] if len(sys.argv) > 1 else 'young'
secs = float(sys.argv[2]) if len(sys.argv) > 2 else (492 if mode == 'young' else 800)

rng = np.random.default_rng(42 if mode == 'young' else 7)

def pluck(freq, dur, amp, bright=1.0):
    """短衰减拨音：基频+偶次泛音，快 attack、指数衰减——天然无持续音"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq
    env = np.exp(-t * (5.0 * bright)) * (1 - np.exp(-t * 900))
    w = (np.sin(2*np.pi*f*t) + 0.4*bright*np.sin(2*np.pi*2*f*t)
         + 0.15*np.sin(2*np.pi*3*f*t + 0.5))
    return w * env * amp

def hat(dur=0.045, amp=0.12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n) * np.exp(-t * 160)
    # 简单高通：一阶差分
    hp = np.diff(noise, prepend=0)
    return hp * amp

NOTE = {}
names = ['C','Cs','D','Ds','E','F','Fs','G','Gs','A','As','B']
for octv in range(1, 6):
    for i, nm in enumerate(names):
        NOTE[f'{nm}{octv}'] = 440 * 2 ** ((i - 9) / 12 + (octv - 4))

if mode == 'young':
    BPM = 108; beat = 60 / BPM
    # Am – F – C – G 五声琶音（A C D E G）
    prog = [
        (['A2','A2'], ['A4','C5','E5','G5','A5','E5']),
        (['F2','F2'], ['F4','A4','C5','E5','A4','C5']),
        (['C3','C3'], ['G4','C5','E5','G5','C5','E5']),
        (['G2','G2'], ['G4','B4','D5','E5','G5','B4']),
    ]
    bars_per_chord = 1
    swing = 0.12
else:
    BPM = 84; beat = 60 / BPM
    prog = [
        (['C3','G2'], ['E4','G4','C5']),
        (['G2','D3'], ['D4','G4','B4']),
        (['A2','E3'], ['C4','E4','A4']),
        (['F2','C3'], ['A3','C4','F4']),
    ]
    bars_per_chord = 2
    swing = 0.0

bar = 4 * beat
total_bars = int(np.ceil(secs / bar))
music = np.zeros(int(total_bars * bar * SR) + SR)

def add(buf, start_s, sig):
    s = int(start_s * SR)
    if s < 0:
        sig = sig[-s:]; s = 0
    if s >= len(buf): return
    e = min(len(buf), s + len(sig))
    if e > s:
        buf[s:e] += sig[:e-s]

for b in range(total_bars):
    t0 = b * bar
    chord = prog[(b // bars_per_chord) % len(prog)]
    bass_notes, mel = chord
    # 贝斯：1、3 拍
    add(music, t0, pluck(NOTE[bass_notes[0]], beat*1.8, 0.30, bright=0.7))
    add(music, t0 + 2*beat, pluck(NOTE[bass_notes[1]], beat*1.8, 0.24, bright=0.7))
    # 旋律：八分音符琶音（偶数拍重音），五声/和弦音随机游走
    steps = 8
    idx = int(rng.integers(0, len(mel)))
    for st in range(steps):
        if rng.random() < (0.12 if mode == 'young' else 0.25):
            continue  # 留白
        idx = max(0, min(len(mel)-1, idx + int(rng.integers(-1, 2))))
        sw = swing * beat * (0.5 if st % 2 else -0.5)
        amp = (0.34 if st % 2 == 0 else 0.22) * (mode == 'soft' and 0.8 + 0.2 or 1.0)
        add(music, t0 + st*beat/2 + sw, pluck(NOTE[mel[idx]], beat*0.9, amp, bright=1.2 if mode=='young' else 0.9))
    # 打点（轻）
    if mode == 'young':
        for st in range(8):
            add(music, t0 + st*beat/2, hat(amp=0.10 if st % 2 else 0.16))

music = music[:int(secs * SR)]
music /= np.max(np.abs(music))
# 整体温和压缩 + 首尾淡入淡出
music = np.tanh(music * 1.1) * 0.8
f = int(2.5 * SR)
music[:f] *= np.linspace(0, 1, f); music[-f:] *= np.linspace(1, 0, f)

pcm = (music * 32767 * 0.9).astype('<i2')
out = f'bgm_{mode}.wav'
w = wave.open(out, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(pcm.tobytes()); w.close()
print(out, 'generated:', round(secs), 's | BPM', BPM)
