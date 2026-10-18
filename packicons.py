# 1.2 新图标打包：icons-src/ 里每个 SVG 变成一个 <symbol>，压缩后写进 src/icons12.js
# 组和 id 前缀：m 材料、g1/g2 小图标 → i-名字（和旧图标同名，直接顶替）；b1/b2 建筑 → b-；r 研究 → r-；c 其它 → c-；x 向导头像 → c-
# 压缩：去空白、坐标保留 1 位小数、渐变等 id 换成短名
import re, glob, os, json, zlib, base64
import xml.etree.ElementTree as ET
from collections import Counter

ROOT = os.path.dirname(os.path.abspath(__file__))
SETS = [('m', 'i'), ('g1', 'i'), ('g2', 'i'), ('b1', 'b'), ('b2', 'b'), ('r', 'r'), ('c', 'c'), ('x', 'c')]
COORD = {'d', 'points', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'width', 'height', 'transform', 'stroke-width', 'font-size', 'stroke-dasharray', 'stroke-dashoffset'}
B36 = '0123456789abcdefghijklmnopqrstuvwxyz'
cnt = [0]


def sid():
    n, s = cnt[0], ''
    cnt[0] += 1
    while True:
        s = B36[n % 36] + s
        n //= 36
        if not n:
            break
    return 'q' + s


def num(m, nd):
    v = round(float(m.group(0)), nd)
    if v == int(v):
        return str(int(v))
    s = f'{v:.{nd}f}'.rstrip('0')
    return s.replace('0.', '.', 1) if s.startswith('0.') else s.replace('-0.', '-.', 1)


NUM = re.compile(r'-?\d*\.\d+(?:e-?\d+)?')


def squeeze_path(d):
    d = NUM.sub(lambda m: num(m, 1), d)
    d = re.sub(r'\s*([MmLlHhVvCcSsQqTtAaZz])\s*', r'\1', d)
    d = re.sub(r'\s*,\s*', ',', d)
    d = re.sub(r'\s+', ' ', d).strip()
    d = re.sub(r'[ ,](-)', r'\1', d)          # "1 -2" → "1-2"
    return d


def attr(m):
    k, q, v = m.group(1), m.group(2), m.group(3)
    if k in ('d', 'points'):
        v = squeeze_path(v)
    elif k in COORD:
        v = NUM.sub(lambda mm: num(mm, 1), v)
    else:
        v = NUM.sub(lambda mm: num(mm, 2), v)
    return f' {k}="{v}"'


def pack(path, sym_id):
    t = open(path).read()
    t = re.sub(r'<\?xml[^>]*\?>|<!--.*?-->|<metadata>.*?</metadata>|<title>.*?</title>', '', t, flags=re.S)
    mo = re.search(r'<svg\b([^>]*)>(.*)</svg>', t, re.S)
    attrs, inner = mo.group(1), mo.group(2)
    vb = re.search(r'viewBox="([^"]*)"', attrs).group(1)
    # 本图标里的 id → 短 id
    ids = re.findall(r'\bid="([^"]+)"', inner)
    rep = {i: sid() for i in ids}
    if rep:
        inner = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{rep[m.group(1)]}"', inner)
        inner = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{rep.get(m.group(1), m.group(1))})', inner)
        inner = re.sub(r'(xlink:)?href="#([^"]+)"', lambda m: f'href="#{rep.get(m.group(2), m.group(2))}"', inner)
    inner = re.sub(r'\s([a-zA-Z:-]+)=(["\'])(.*?)\2', attr, inner, flags=re.S)
    inner = re.sub(r'>\s+<', '><', inner).strip()
    keep = ''.join(f' {k}="{v}"' for k, v in re.findall(r'\s([a-zA-Z:-]+)="([^"]*)"', attrs) if k not in ('xmlns', 'width', 'height', 'viewBox') and ':' not in k)
    inner = hoist(inner, keep)
    inner = re.sub(r'\s+/>', '/>', inner)
    return f"<symbol id='{sym_id}' viewBox='{vb}'>{inner}</symbol>".replace('"', "'")


# 描边的几样属性大多每个形状都写一遍：挑最常见的值挂到外面一层 <g> 上，形状里一样的就删掉；
# 原来没写的补上默认值（不描边 = none），这样看起来和原来完全一样
HOIST = [('stroke', 'none'), ('stroke-width', '1'), ('stroke-linejoin', 'miter'), ('stroke-linecap', 'butt')]


def ser(e):
    a = ''.join(f' {k}="{v}"' for k, v in e.attrib.items())
    body = (e.text or '') + ''.join(ser(c) + (c.tail or '') for c in e)
    return f'<{e.tag}{a}>{body}</{e.tag}>' if body else f'<{e.tag}{a}/>'


def opt(el, eff):
    """el 是容器（<g> 或最外层），eff 是 el 里面的形状继承到的描边属性"""
    kids = [c for c in el if c.tag not in ('defs', 'title', 'desc', 'style', 'clipPath', 'mask', 'linearGradient', 'radialGradient')]
    eff = dict(eff)
    for k, _ in HOIST:
        if k in el.attrib:
            eff[k] = el.get(k)
    if len(kids) >= 3:
        for k, _ in HOIST:
            vals = Counter(c.get(k, eff[k]) for c in kids)
            v, n = vals.most_common(1)[0]
            if v == eff[k] or n < 3:
                continue
            for c in kids:
                if c.get(k, eff[k]) == v:
                    c.attrib.pop(k, None)
                elif k not in c.attrib:
                    c.set(k, eff[k])
            el.set(k, v)
            eff[k] = v
    for c in kids:
        if c.tag == 'g':
            opt(c, eff)


def hoist(inner, rootattrs):
    root = ET.fromstring(f'<g xmlns="http://www.w3.org/2000/svg"{rootattrs}>{inner}</g>')
    for el in root.iter():
        el.tag = el.tag.split('}')[-1]
    opt(root, dict(HOIST))
    if not root.attrib:
        return ''.join(ser(c) for c in root)
    return ser(root)


out, keys, total_in = [], {}, 0
for s, pre in SETS:
    for f in sorted(glob.glob(f'{ROOT}/icons-src/{s}/*.svg')):
        k = os.path.basename(f)[:-4]
        total_in += os.path.getsize(f)
        out.append(pack(f, f'{pre}-{k}'))
        keys.setdefault(pre, []).append(k)
sprite = ''.join(out)
# 压成 deflate-raw 再转 base64（游戏里已经用 DecompressionStream 解存档码，同一个办法）：87 万字 → 18 万字
z = zlib.compressobj(9, zlib.DEFLATED, -15)
packed = base64.b64encode(z.compress(sprite.encode()) + z.flush()).decode()
js = ('// 自动生成（packicons.py），别手改。1.2 新画的全部图标：一串 <symbol>，压缩成 deflate-raw + base64\n'
      f'export const SPRITE12_Z = "{packed}";\n'
      f'export const KEYS12 = {json.dumps(keys, ensure_ascii=False)};\n')
open(f'{ROOT}/src/icons12.js', 'w').write(js)
print('icons', sum(len(v) for v in keys.values()), 'in', total_in // 1024, 'KB → sprite', len(sprite) // 1024, 'KB → js', len(js) // 1024, 'KB')
