# keys out chroma green backgrounds and writes web ready assets
import sys, numpy as np
from PIL import Image, ImageFilter
SPR = {'soldier_idle':1000,'soldier_aim':1000,'soldier_aim2':1000,'gunner':1000,'soldier_hit':900,'truck':900,'jeep':1000,'tank':1400,'uzi':1000,'en_officer':1000,'en_prone':700,'en_run':1000,'en_surrender':1000,'en_throw':1000,'bunker':1100,'wire':900,'tent':1000,'fp_uzi':900,'fp_fal':900,'fp_mag':900,'fp_grenade':900,'arch':1000,'house':1100,'fort':1500,'hedgehog':700,'target_enemy':900,'target_civ':900,'civ_man':1000,'civ_woman':1000,'bunker_basalt':1000,'watchtower':1100}
def key(name, h):
    im = Image.open(f'raw/{name}.jpg').convert('RGB'); a = np.asarray(im).astype(np.float32)
    corners = np.concatenate([a[:8,:8].reshape(-1,3), a[:8,-8:].reshape(-1,3), a[-8:,:8].reshape(-1,3), a[-8:,-8:].reshape(-1,3)])
    bg = np.median(corners, axis=0)
    r,g,b = a[...,0],a[...,1],a[...,2]
    # greenness: how much green dominates
    gd = g - np.maximum(r,b)
    bgd = bg[1]-max(bg[0],bg[2])
    dist = np.sqrt(((a-bg)**2).sum(-1))
    alpha = np.clip((dist-40)/70,0,1)
    alpha = np.minimum(alpha, np.clip(1-(gd-12)/(bgd*0.55),0,1))
    al = Image.fromarray((alpha*255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    alpha = np.asarray(al).astype(np.float32)/255
    # despill
    lim = np.maximum(r,b)
    g2 = np.where(g>lim, lim + (g-lim)*0.15, g)
    out = np.dstack([r,g2,b,alpha*255]).clip(0,255).astype(np.uint8)
    o = Image.fromarray(out,'RGBA')
    bbox = o.getchannel('A').point(lambda v:255 if v>20 else 0).getbbox()
    o = o.crop(bbox)
    sc = h/max(o.height, o.width*0.6) if name in ('truck','jeep','tank','bunker','wire','tent','en_prone','fort','bunker_basalt','arch','house') else h/o.height
    if sc<1: o = o.resize((round(o.width*sc), round(o.height*sc)), Image.LANCZOS)
    o.save(f'assets/{name}.webp', quality=90, method=6)
    print(name, o.size)
import os
only = sys.argv[1:]
for n,h in SPR.items():
    if not only or n in only: key(n,h)
def tex(name, size, q=85):
    im = Image.open(f'raw/{name}.jpg').convert('RGB'); im = im.resize(size, Image.LANCZOS); im.save(f'assets/{name}.webp', quality=q, method=6); print(name, im.size)
if only: sys.exit()
tex('sand',(1024,1024)); tex('burlap',(512,512)); tex('rock',(1024,1024)); tex('crate',(512,512)); tex('commander',(640,640))
im = Image.open('raw/sky.jpg').convert('RGB'); print('sky raw', im.size); im.save('assets/sky.webp', quality=88, method=6)
tex('explosion',(512,512))
