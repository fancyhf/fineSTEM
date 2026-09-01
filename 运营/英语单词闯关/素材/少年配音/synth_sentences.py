# -*- coding: utf-8 -*-
"""逐句合成旁白：每句一个音频，时间轴精确已知 → 字幕帧级同步。
用法：python synth_sentences.py [voice]
输出：
  <voice>_sent/segNN_kk.wav   每句音频
  sent_timeline.json          {starts(seg), durs(seg), sents:[{seg,a,d,text}]}
  旁白_逐句_<voice>.mp3       完整旁白（句间 0.30s，段间 0.70s）
"""
import os, re, io, sys, json, subprocess, time, requests

VOICE = sys.argv[1] if len(sys.argv) > 1 else 'Ethan'
HERE = os.path.dirname(os.path.abspath(__file__))
MD = os.path.join(HERE, '..', '..', '03_少年讲解视频_台词稿_v5.md')
GAP_IN, GAP_INTER = 0.30, 0.70

key = None
for ln in io.open(r'G:/mediaProjects/fineSTEM/apps/backend/.env', encoding='utf-8'):
    m = re.match(r'\s*BAILIAN_API_KEY\s*=\s*(\S+)', ln)
    if m: key = m.group(1).strip(); break
URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
H = {'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}

def dur(fp):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0', fp]).decode().strip())

def synth(text, out, tries=8):
    for a in range(tries):
        try:
            r = requests.post(URL, headers=H, timeout=60, json={'model':'qwen-tts-latest','input':{'text':text,'voice':VOICE}})
            if r.status_code != 200:
                raise RuntimeError(f'http {r.status_code}: {r.text[:100]}')
            io.open(out,'wb').write(requests.get(r.json()['output']['audio']['url'], timeout=60).content)
            d = dur(out)
            if d > 0.2:
                time.sleep(0.25)
                return d
            raise RuntimeError('empty audio')
        except Exception as e:
            print('  retry', a+1, type(e).__name__, str(e)[:80], flush=True)
            time.sleep(3 + a*4)
    raise SystemExit('synth failed: ' + out)

# 1) 解析台词 → 句
md = io.open(MD, encoding='utf-8').read().split('## 写后自检')[0]
segs = []
for part in md.split('## ')[1:]:
    if not part.startswith('第'): continue
    lines = [x for x in re.findall(r'^> (.+)$', part, re.M) if not x.startswith('〔')]
    segs.append(re.findall(r'[^。？！]*[。？！]', ''.join(lines)))

# 2) 静音文件
for name, sec in [('sil030.wav', GAP_IN), ('sil070.wav', GAP_INTER)]:
    p = os.path.join(HERE, name)
    if not (os.path.exists(p) and abs(dur(p)-sec) < 0.02):
        subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i',f'anullsrc=r=24000:cl=mono','-t',str(sec),'-sample_fmt','s16',p], check=True)

# 3) 逐句合成
sdir = os.path.join(HERE, VOICE + '_sent')
CONCAT = []
os.makedirs(sdir, exist_ok=True)
sents, t = [], 0.0
seg_starts, seg_durs = [], []
for si, sentences in enumerate(segs, 1):
    seg_starts.append(round(t, 3))
    seg_t0 = t
    items = []
    for ki, s in enumerate(sentences, 1):
        w = os.path.join(sdir, f's{si:02d}_{ki:02d}.wav')
        if not (os.path.exists(w) and os.path.getsize(w) > 800):
            d = synth(s, w)
        else:
            d = dur(w)
        items.append({'file': w, 'a': round(t, 3), 'd': round(d, 3), 'text': s})
        CONCAT.append(w)
        t += d
        if ki < len(sentences):
            items.append({'file': os.path.join(HERE,'sil030.wav'), 'a': round(t,3), 'd': GAP_IN, 'sil': True})
            CONCAT.append(os.path.join(HERE,'sil030.mp3'))
            t += GAP_IN
    seg_durs.append(round(t - seg_t0, 3))
    sents.extend(items)
    if si < len(segs):
        sents.append({'file': os.path.join(HERE,'sil070.wav'), 'a': round(t,3), 'd': GAP_INTER, 'sil': True})
        CONCAT.append(os.path.join(HERE,'sil070.mp3'))
        t += GAP_INTER
total_audio = round(t, 3)
print('sentences:', sum(1 for x in sents if not x.get('sil')), '| audio total:', total_audio)

# 4) 拼整轨（全 mp3 + concat demuxer）
lst = os.path.join(HERE, f'concat_{VOICE}.txt')
io.open(lst, 'w', encoding='utf-8').write('\n'.join("file '"+os.path.abspath(p).replace("\\","/")+"'" for p in CONCAT))
