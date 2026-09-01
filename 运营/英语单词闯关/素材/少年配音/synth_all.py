# -*- coding: utf-8 -*-
"""少年讲解视频旁白批量合成脚本（可复用）
用法：python synth_all.py [voice]   # 默认 Ethan；换音色：python synth_all.py Dylan
输入：../../03_少年讲解视频_台词稿_v5.md（按「## 第 N 段」分节，"> " 行为旁白）
输出：本目录 segNN.mp3（每段一条，剪辑单元）+ 少年视频旁白_完整_<voice>.mp3
"""
import io, os, re, sys, time, requests

VOICE = sys.argv[1] if len(sys.argv) > 1 else 'Ethan'
HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, '..', '..', '03_少年讲解视频_台词稿_v5.md')

key = None
for ln in io.open(r'G:/mediaProjects/fineSTEM/apps/backend/.env', encoding='utf-8'):
    m = re.match(r'\s*BAILIAN_API_KEY\s*=\s*(\S+)', ln)
    if m:
        key = m.group(1).strip()
        break
URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
H = {'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}


def synth(text, out, tries=5):
    for a in range(tries):
        try:
            r = requests.post(URL, headers=H, timeout=60,
                              json={'model': 'qwen-tts-latest', 'input': {'text': text, 'voice': VOICE}})
            aurl = r.json()['output']['audio']['url']
            io.open(out, 'wb').write(requests.get(aurl, timeout=60).content)
            return True
        except Exception as e:
            print('  retry', a + 1, type(e).__name__, str(e)[:80])
            time.sleep(2 + a * 2)
    return False


def chunk_text(text, limit=100):
    """按句切分后聚合成 ≤limit 字的块"""
    sents = re.findall(r'[^。？！]*[。？！]', text)
    chunks, cur = [], ''
    for s in sents:
        if len(cur) + len(s) > limit and cur:
            chunks.append(cur)
            cur = ''
        cur += s
    if cur:
        chunks.append(cur)
    return chunks


# 1) 解析台词稿
t = io.open(SCRIPT, encoding='utf-8').read().split('## 写后自检')[0]
segments = []  # [(标题, 全文)]
for part in t.split('## ')[1:]:
    if not part.startswith('第'):
        continue
    title = part.split('\n')[0].strip()
    lines = [m for m in re.findall(r'^> (.+)$', part, re.M) if not m.startswith('〔')]
    if lines:
        segments.append((title, ''.join(lines)))
print('segments:', len(segments))

outdir = os.path.join(HERE, VOICE)
os.makedirs(outdir, exist_ok=True)
seg_files, seg_durs = [], []
for si, (title, text) in enumerate(segments, 1):
    chunks = chunk_text(text)
    wavs = []
    for ci, ch in enumerate(chunks, 1):
        w = os.path.join(outdir, f'seg{si:02d}_c{ci:02d}.wav')
        if not (os.path.exists(w) and os.path.getsize(w) > 1000):
            ok = synth(ch, w)
            if not ok:
                raise SystemExit('synth failed: ' + w)
        wavs.append(w)
    # 段内拼接
    lst = os.path.join(outdir, f'seg{si:02d}_list.txt')
    io.open(lst, 'w', encoding='utf-8').write('\n'.join(f"file '{os.path.abspath(w)}'" for w in wavs))
    segmp3 = os.path.join(HERE, f'seg{si:02d}_{VOICE}.mp3')
    os.system(f'ffmpeg -y -v error -f concat -safe 0 -i "{lst}" -ar 24000 -ac 1 -b:a 160k "{segmp3}"')
    dur = float(os.popen(f'ffprobe -v error -show_entries format=duration -of csv=p=0 "{segmp3}"').read().strip())
    seg_files.append(segmp3)
    seg_durs.append(dur)
    print(f'{title} | {len(text)}字 {len(chunks)}块 | {dur:.1f}s')

# 2) 段间 600ms 静音，拼完整轨
sil = os.path.join(HERE, 'sil600.wav')
os.system(f'ffmpeg -y -v error -f lavfi -i anullsrc=r=24000:cl=mono -t 0.6 -sample_fmt s16 "{sil}"')
full_lst = os.path.join(HERE, f'full_{VOICE}_list.txt')
rows = []
for i, f in enumerate(seg_files):
    rows.append(f"file '{os.path.abspath(f)}'")
    if i < len(seg_files) - 1:
        rows.append(f"file '{os.path.abspath(sil)}'")
io.open(full_lst, 'w', encoding='utf-8').write('\n'.join(rows))
full = os.path.join(HERE, f'少年视频旁白_完整_{VOICE}.mp3')
os.system(f'ffmpeg -y -v error -f concat -safe 0 -i "{full_lst}" -ar 24000 -ac 1 -b:a 192k "{full}"')
total = float(os.popen(f'ffprobe -v error -show_entries format=duration -of csv=p=0 "{full}"').read().strip())
print(f'\nFULL: {full} | {total:.1f}s = {total/60:.1f}min')
vol = os.popen(f'ffmpeg -i "{full}" -af volumedetect -f null - 2>&1 | grep -E "max_volume|mean_volume"').read()
print(vol)
