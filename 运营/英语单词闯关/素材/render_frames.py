# -*- coding: utf-8 -*-
"""逐帧渲染 video.html → _render/f%06d.jpg，随后 ffmpeg 合成 + 混音。"""
import os, sys, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 24
TOTAL = 487.74
OUT = os.path.join(HERE, '_render')
os.makedirs(OUT, exist_ok=True)

t0 = time.time()
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--allow-file-access-from-files', '--disable-web-security'])
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.goto('file:///G:/mediaProjects/fineSTEM/运营/英语单词闯关/素材/video.html')
    pg.wait_for_timeout(3000)
    n = int(TOTAL * FPS) + 1
    for k in range(n):
        t = k / FPS
        pg.evaluate(f'SEEK({t:.4f})')
        pg.screenshot(path=os.path.join(OUT, f'f{k:06d}.jpg'), type='jpeg', quality=80)
        if k % 500 == 0:
            el = time.time() - t0
            eta = el / (k + 1) * (n - k - 1)
            print(f'frame {k}/{n}  elapsed {el:.0f}s  eta {eta/60:.1f}min', flush=True)
    b.close()
print('RENDER DONE', time.time() - t0, 's', flush=True)

os.system(f'ffmpeg -y -v error -framerate {FPS} -i "{OUT}/f%06d.jpg" -i "{HERE}/少年配音/少年视频旁白_完整_Ethan.mp3" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "{HERE}/../拆开一个单词游戏_成片_v1.mp4"')
print('MUX DONE', flush=True)
