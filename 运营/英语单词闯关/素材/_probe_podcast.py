# -*- coding: utf-8 -*-
"""播客舞台探针：抽取关键帧检查。用法：python _probe_podcast.py t1,t2,..."""
import os, sys
from playwright.sync_api import sync_playwright

times = [float(x) for x in sys.argv[1].split(',')] if len(sys.argv) > 1 else [30, 92, 620, 786]
os.makedirs('_frames', exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--allow-file-access-from-files'])
    pg = b.new_page(viewport={'width': 1080, 'height': 1920})
    pg.goto('file:///G:/mediaProjects/fineSTEM/%E8%BF%90%E8%90%A5/%E8%8B%B1%E8%AF%AD%E5%8D%95%E8%AF%8D%E9%97%AF%E5%85%B3/%E7%B4%A0%E6%9D%90/podcast.html')
    pg.wait_for_timeout(2500)
    for t in times:
        pg.evaluate(f'SEEK({t})'); pg.wait_for_timeout(150)
        pg.evaluate(f'SEEK({t})'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'_frames/pp3_{t:05.0f}.jpg', type='jpeg', quality=78)
    b.close()
print('probe ok')
