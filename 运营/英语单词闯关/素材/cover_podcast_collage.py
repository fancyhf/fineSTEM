# -*- coding: utf-8 -*-
"""家长播客封面 v3：拼贴笔记风（拍立得照片卡 + 胶带 + 便签 + 红笔手绘 + 纸张颗粒）。
输出：封面_家长播客_小红书_1242x1660.png / 封面_家长播客_抖音视频号_1080x1920.png
"""
import os, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
YHB = 'C:/Windows/Fonts/msyhbd.ttc'
KAI = 'C:/Windows/Fonts/simkai.ttf'
load = ImageFont.truetype
INK = '#221D18'; RED = '#C0392B'; GOLD = '#B8924A'; PAPER = '#F6F1E7'
SHOT = os.path.abspath(os.path.join(HERE, '..', '素材', '_cover_shot.png'))

def grain(img, alpha=10):
    n = (np.random.default_rng(3).integers(0, 255, (img.height, img.width), dtype=np.uint8))
    g = Image.fromarray(n, 'L').filter(ImageFilter.GaussianBlur(0.4))
    overlay = Image.merge('RGBA', [g.point(lambda v: 128)]*3 + [g.point(lambda v: alpha)])
    return Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')

def shadow_paste(base, layer, mask, pos, angle, blur=14, dy=18):
    sh = Image.new('RGBA', layer.size, (30, 25, 18, 255))
    sh.putalpha(mask.point(lambda v: int(v * 0.55)))
    sh = sh.rotate(angle, expand=True, resample=Image.BICUBIC)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(sh, (pos[0]-6, pos[1]+dy))
    l = layer.convert('RGBA'); l.putalpha(mask)
    l = l.rotate(angle, expand=True, resample=Image.BICUBIC)
    base.alpha_composite(l, pos)

def tape(base, cx, cy, w, h, color=(201,162,75), alpha=150, angle=-6):
    color = tuple(color) + (alpha,) if len(color) == 3 else tuple(color)
    tp = Image.new('RGBA', (int(w), int(h)), color)
    tp = tp.rotate(angle, expand=True, resample=Image.BICUBIC)
    base.alpha_composite(tp, (int(cx - tp.width/2), int(cy - tp.height/2)))

def build(W, H, cfg):
    img = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(img)
    step = int(W / 12)
    for gx in range(step, W, step):
        d.line([(gx, 0), (gx, H)], fill='#EDE6D6', width=1)
    for gy in range(step, H, step):
        d.line([(0, gy), (W, gy)], fill='#EFE9DA', width=1)
    img = grain(img, alpha=9).convert('RGBA')
    d = ImageDraw.Draw(img)

    f_chip = load(YHB, cfg['chip'])
    chip = 'fineSTEM 课堂 · 家长播客 第 1 期'
    cw = d.textlength(chip, font=f_chip)
    y0 = cfg['chip_y']
    d.rounded_rectangle([(W-cw)/2-30, y0, (W+cw)/2+30, y0+52], 26, outline=GOLD, width=3)
    d.text(((W-cw)/2, y0+10), chip, font=f_chip, fill=GOLD)

    f1 = load(YHB, cfg['t1'])
    t1 = '一家人'
    d.text(((W-d.textlength(t1, font=f1))/2, cfg['t1y']), t1, font=f1, fill=INK)
    f2 = load(YHB, cfg['t2'])
    t2 = '一起学英语'
    w2 = d.textlength(t2, font=f2)
    x2 = (W-w2)/2
    y2 = cfg['t2y']
    d.text((x2, y2), t2, font=f2, fill=INK)
    for k, (dx, dy, wd) in enumerate([(0,0,8), (6,4,5)]):
        d.ellipse([x2-26+dx, y2-12+dy, x2+d.textlength('一起', font=f2)+26+dx, y2+cfg['t2']*1.02+dy],
                  outline=(192,57,43,235-k*40), width=wd)

    ph_w, ph_h = cfg['ph']
    shot = Image.open(SHOT).convert('RGB')
    crop = shot.crop((0, 60, 1000, 60 + int(1000*(ph_h-24)/ph_w)))
    inner = crop.resize((ph_w-24, ph_h-24))
    card = Image.new('RGB', (ph_w, ph_h), '#FFFFFF')
    card.paste(inner, (12, 12))
    dm = ImageDraw.Draw(card)
    dm.text((16, ph_h-46), '英语单词闯关 · 学员作品', font=load(YHB, int(cfg['note1']*0.8)), fill='#8a8175')
    pmask = Image.new('L', (ph_w, ph_h), 0)
    ImageDraw.Draw(pmask).rounded_rectangle([0, 0, ph_w-1, ph_h-1], 10, fill=255)
    px, py = cfg['ph_pos']
    shadow_paste(img, card, pmask, (px, py), cfg['ph_angle'])
    tape(img, px + ph_w*0.24, py + 6, cfg['tape_w'], 56, (201,162,75,150), angle=-8)

    st_w, st_h = cfg['st']
    sticky = Image.new('RGB', (st_w, st_h), '#FBEFC9')
    sd = ImageDraw.Draw(sticky)
    sd.text((int(st_w*0.10), int(st_h*0.14)), '连对 3 次', font=load(KAI, cfg['note1']), fill='#7a3b2e')
    sd.text((int(st_w*0.10), int(st_h*0.14)+int(cfg['note1']*1.35)), '→ 毕业', font=load(KAI, cfg['note1']), fill='#7a3b2e')
    sd.line([int(st_w*0.10), int(st_h*0.62), int(st_w*0.72), int(st_h*0.62)], fill=RED, width=4)
    sd.text((int(st_w*0.10), int(st_h*0.70)), '忘了就再约一次', font=load(KAI, int(cfg['note1']*0.82)), fill='#8a6d3b')
    smask = Image.new('L', (st_w, st_h), 0)
    ImageDraw.Draw(smask).rounded_rectangle([0, 0, st_w-1, st_h-1], 8, fill=255)
    sx, sy = cfg['st_pos']
    shadow_paste(img, sticky, smask, (sx, sy), cfg['st_angle'], blur=10, dy=10)
    tape(img, sx + st_w/2, sy - 4, cfg['tape_w']*0.7, 40, (234,140,120,150), angle=5)

    f_l = load(YHB, cfg['list'])
    items = ['① 一起看：字幕三步，一集看十遍',
             '② 一起说：家庭英语角，每晚 15 分钟',
             '③ 一起背：连对三次，单词才能毕业']
    iy = cfg['list_y']
    for it in items:
        d.text((int(W*0.10), iy), it, font=f_l, fill=INK)
        iy += cfg['list_gap']
    f_b = load(YHB, cfg['foot'])
    foot = '爸妈不用先学会 · 教练不用比运动员游得快'
    d.text(((W-d.textlength(foot, font=f_b))/2, H-int(cfg['foot'])-52), foot, font=f_b, fill='#6f675a')
    return img.convert('RGBA')

out_dir = os.path.abspath(os.path.join(HERE, '..'))
img = build(1242, 1660, dict(chip=30, chip_y=64, t1=140, t1y=168, t2=168, t2y=352,
    ph=(620, 470), ph_pos=(96, 620), ph_angle=-3.2, tape_w=170,
    st=(330, 300), st_pos=(830, 900), st_angle=5, note1=44,
    list=38, list_y=1150, list_gap=74, foot=30))
img.save(os.path.join(out_dir, '封面_家长播客_小红书_1242x1660.png'))
print('xhs saved')

img = build(1080, 1920, dict(chip=28, chip_y=78, t1=130, t1y=196, t2=158, t2y=388,
    ph=(600, 500), ph_pos=(70, 640), ph_angle=-3.2, tape_w=160,
    st=(320, 292), st_pos=(760, 980), st_angle=5, note1=42,
    list=36, list_y=1330, list_gap=70, foot=28))
img.save(os.path.join(out_dir, '封面_家长播客_抖音视频号_1080x1920.png'))
print('douyin saved')
