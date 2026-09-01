# -*- coding: utf-8 -*-
"""家长播客 · 双人对谈逐句合成
解析 04_家长播客_台词稿_v4.md（**主持**/**小雅** 轮次，## 分段），
每轮用角色音色合成（>100 字自动分块），产出精确时间轴 + 完整旁白轨。
输出：podcast_timeline.json + 旁白_逐句_播客.mp3
"""
import os, re, io, sys, json, subprocess, time, wave, requests

HERE = os.path.dirname(os.path.abspath(__file__))
MD = os.path.join(HERE, '..', '..', '04_家长播客_一家人一起学英语_台词稿_v4.md')
VOICE = {'主持': 'Cherry', '小雅': 'Chelsie'}
GAP_CHUNK, GAP_TURN = 0.12, 0.38
SR = 24000

key = None
for ln in io.open(r'G:/mediaProjects/fineSTEM/apps/backend/.env', encoding='utf-8'):
    m = re.match(r'\s*BAILIAN_API_KEY\s*=\s*(\S+)', ln)
    if m: key = m.group(1).strip(); break
URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
H = {'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}

def dur(fp):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0', fp]).decode().strip())

def synth(text, out, voice, tries=8):
    for a in range(tries):
        try:
            r = requests.post(URL, headers=H, timeout=60, json={'model':'qwen-tts-latest','input':{'text':text,'voice':voice}})
            if r.status_code != 200:
                raise RuntimeError(f'http {r.status_code}')
            io.open(out,'wb').write(requests.get(r.json()['output']['audio']['url'], timeout=60).content)
            d = dur(out)
            if d > 0.2:
                time.sleep(0.4)
                return d
            raise RuntimeError('empty')
        except Exception as e:
            print('  retry', a+1, type(e).__name__, str(e)[:70], flush=True)
            time.sleep(3 + a*4)
    raise SystemExit('synth failed: ' + out)

# 1) 解析台词稿
md = io.open(MD, encoding='utf-8').read().split('## 写后自检')[0]
sections = []  # [(标题, [ (role, text) ])]
for part in md.split('## ')[1:]:
    title = part.split('\n')[0].strip()
    turns = []
    for ln in part.splitlines():
        m = re.match(r'^\*\*(主持|小雅)\*\*：(.+)$', ln)
        if m:
            text = re.sub(r'〔.*?〕', '', m.group(2)).strip()
            if text: turns.append((m.group(1), text))
    if turns:
        sections.append((title.split('（')[0].strip(), turns))
print('sections:', [s[0] for s in sections])

# 2) 逐轮合成
def chunk_text(text, limit=100):
    sents = re.findall(r'[^。？！]*[。？！]|[^。？！]+$', text)
    chunks, cur = [], ''
    for s in sents:
        if len(cur) + len(s) > limit and cur: chunks.append(cur); cur = ''
        cur += s
    if cur: chunks.append(cur)
    return chunks

outdir_c = os.path.join(HERE, 'Cherry_turn'); os.makedirs(outdir_c, exist_ok=True)
outdir_x = os.path.join(HERE, 'Chelsie_turn'); os.makedirs(outdir_x, exist_ok=True)

# 静音
for name, sec in [('p012.wav', GAP_CHUNK), ('p038.wav', GAP_TURN)]:
    p = os.path.join(HERE, name)
    if not (os.path.exists(p) and abs(dur(p)-sec) < 0.02):
        subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i',f'anullsrc=r={SR}:cl=mono','-t',str(sec),'-sample_fmt','s16',p], check=True)

timeline = {'sections': [], 'turns': []}
CONCAT = []
t = 0.0
for si, (title, turns) in enumerate(sections):
    sec_start = t
    for ti, (role, text) in enumerate(turns):
        turn_a = t
        chunks = chunk_text(text)
        for ci, ch in enumerate(chunks):
            vdir = outdir_c if role == '主持' else outdir_x
            w = os.path.join(vdir, f't{len(CONCAT):03d}.wav')
            if not (os.path.exists(w) and os.path.getsize(w) > 800):
                synth(ch, w, VOICE[role])
            CONCAT.append(w)
            d = dur(w)
            t += d
            if ci < len(chunks)-1:
                CONCAT.append(os.path.join(HERE,'p012.wav')); t += GAP_CHUNK
        timeline['turns'].append({'role': role, 'sec': si, 'a': round(turn_a,3), 'b': round(t,3), 'text': text})
        if ti < len(turns)-1:
            CONCAT.append(os.path.join(HERE,'p038.wav')); t += GAP_TURN
    timeline['sections'].append({'title': title, 'a': round(sec_start,3), 'b': round(t,3)})
    if si < len(sections)-1:
        t += 0.0  # 段间由轮次间隙承担
total_audio = round(t, 3)
timeline['total_audio'] = total_audio
print('turns:', len(timeline['turns']), '| audio total:', total_audio)

json.dump(timeline, io.open(os.path.join(HERE,'podcast_timeline.json'),'w',encoding='utf-8'), ensure_ascii=False)

# 3) PCM 拼整轨
lst = os.path.join(HERE, 'concat_podcast.txt')
io.open(lst, 'w', encoding='utf-8').write('\n'.join("file '"+p.replace('\\','/')+"'" for p in CONCAT))
full = os.path.join(HERE, '旁白_逐句_播客.wav')
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',lst,'-ar',str(SR),'-ac','1',full], check=True)
print('full wav:', round(dur(full),2), 's (expect', total_audio, ')')

# mp3 版
subprocess.run(['ffmpeg','-y','-v','error','-i',full,'-b:a','192k', os.path.join(HERE,'旁白_逐句_播客.mp3')], check=True)
print('done')
