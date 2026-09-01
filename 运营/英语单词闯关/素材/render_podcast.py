# -*- coding: utf-8 -*-
"""家长播客成片渲染：podcast.html 逐帧 → _prender/f%06d.jpg → ffmpeg + BGM 混音。"""
import os, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 24
TOTAL = 791.94
OUT = os.path.join(HERE, '_prender')
os.makedirs(OUT, exist_ok=True)

t0 = time.time()
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--allow-file-access-from-files'])
    pg = b.new_page(viewport={'width': 1080, 'height': 1920})
    pg.goto('file:///G:/mediaProjects/fineSTEM/运营/英语单词闯关/素材/podcast.html')
    pg.wait_for_timeout(3000)
    n = int(TOTAL * FPS) + 1
    for k in range(n):
        pg.evaluate(f'SEEK({k/FPS:.4f})')
        pg.screenshot(path=os.path.join(OUT, f'f{k:06d}.jpg'), type='jpeg', quality=80)
        if k % 1000 == 0:
            el = time.time() - t0
            print(f'frame {k}/{n} elapsed {el:.0f}s eta {el/(k+1)*(n-k-1)/60:.1f}min', flush=True)
    b.close()
print('RENDER DONE', time.time() - t0, flush=True)

# 混音：旁白(已含tempo) + BGM(循环, 9%, 首尾淡入淡出) → v1 成片
fc = (''
      '[0:a]apad=whole_dur=791.94[aout]')
os.system(f'ffmpeg -y -v error -framerate {FPS} -i "{OUT}/f%06d.jpg" -i "{HERE}/播客配音/旁白_播客_1x08.wav" '
          f'-filter_complex "{fc}" -map 0:v -map "[aout]" -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -c:a aac -b:a 160k '
          f'-t 791.94 "{HERE}/../一家人一起学英语_家长播客_成片_v1.mp4"')
print('MUX DONE', flush=True)
