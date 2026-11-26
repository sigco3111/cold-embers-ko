import json, re, os, subprocess, urllib.parse, time, glob, collections

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
finals = json.load(open(BASE + '/finals.json'))
segmap = json.load(open(BASE + '/segmap.json'))
glossary = json.load(open(BASE + '/glossary.json'))
terms = sorted(glossary.keys(), key=lambda k: -len(k))
token_of = {t: 'ZZG%03dZZ' % i for i, t in enumerate(terms)}
CJK = re.compile(r'[一-鿿]')

def protect(s):
    hits = {}
    for t in terms:
        if t in s:
            tok = token_of[t]
            s = s.replace(t, tok)
            hits[tok] = glossary[t]
    return s, hits

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
def mt_call(qs, tries=4):
    q = urllib.parse.urlencode([('q', x) for x in qs])
    url = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=zh-CN&tl=ko&' + q
    for k in range(tries):
        r = subprocess.run(['curl', '-s', '--max-time', '30', '-A', UA, url], capture_output=True, text=True)
        try:
            out = json.loads(r.stdout)
            if isinstance(out, list) and len(out) == len(qs):
                return out
        except Exception:
            pass
        time.sleep(1.5 * (k + 1))
    return None

def batches(items, maxchars=700):
    cur, n = [], 0
    for v in items:
        L = len(v) + 20
        if cur and n + L > maxchars:
            yield cur
            cur, n = [], 0
        cur.append(v); n += L
    if cur:
        yield cur

def scan_file(src):
    # yields ('str', start, end, quote, inner) for quoted strings with CJK, skipping comments
    i, n = 0, len(src)
    stack = []  # 'tpl' markers; expr tracked by brace depth list
    out = []
    state = 'code'
    expr_depths = []
    while i < n:
        c = src[i]
        if state == 'code':
            if c == '/' and i + 1 < n and src[i+1] == '/':
                j = src.find('\n', i)
                i = n if j < 0 else j + 1
                continue
            if c == '/' and i + 1 < n and src[i+1] == '*':
                j = src.find('*/', i + 2)
                i = n if j < 0 else j + 2
                continue
            if c in '"\'':
                q = c; j = i + 1; buf = []
                while j < n and src[j] != q:
                    if src[j] == '\\':
                        buf.append(src[j:j+2]); j += 2
                    else:
                        if src[j] == '\n':
                            break  # unterminated; bail
                        buf.append(src[j]); j += 1
                if j < n and src[j] == q:
                    inner = ''.join(buf)
                    if CJK.search(inner):
                        out.append((i, j + 1, q, inner))
                    i = j + 1
                else:
                    i = j + 1
                continue
            if c == '`':
                state = 'tpl'; i += 1; continue
            if c == '{':
                if expr_depths:
                    expr_depths[-1] += 1
                i += 1; continue
            if c == '}':
                if expr_depths:
                    expr_depths[-1] -= 1
                    if expr_depths[-1] == 0:
                        expr_depths.pop()
                        state = 'tpl'
                i += 1; continue
            i += 1; continue
        else:  # tpl text
            if c == '\\':
                i += 2; continue
            if c == '`':
                state = 'code'; i += 1; continue
            if src.startswith('${', i):
                expr_depths.append(1)
                state = 'code'
                i += 2; continue
            i += 1; continue
    return out

allstr = collections.defaultdict(list)  # inner -> list of (file, start, end, quote)
for f in sorted(glob.glob(os.path.join(ROOT, 'src/*.js'))):
    src = open(f, encoding='utf-8').read()
    for (a, b, q, inner) in scan_file(src):
        allstr[inner].append((os.path.relpath(f, ROOT), a, b, q))
print('unique CJK quoted strings:', len(allstr), 'occurrences:', sum(len(v) for v in allstr.values()))

# translate
trans = {}
todo = []
for inner in allstr:
    if inner in finals and finals[inner]:
        trans[inner] = finals[inner]
    elif inner in segmap:
        trans[inner] = segmap[inner]
    else:
        todo.append(inner)
print('reused:', len(trans), 'to MT:', len(todo))
prot = {s: protect(s) for s in todo}
res = []
for b in batches([prot[s][0] for s in todo]):
    r = mt_call(b)
    res.extend(r if r else [None] * len(b))
    time.sleep(0.15)
for s, r in zip(todo, res):
    if r is None:
        continue
    ko = r
    for tok, t in prot[s][1].items():
        ko = ko.replace(tok, t)
    trans[s] = ko
flags = []
for s, ko in trans.items():
    if s.count('<') != ko.count('<'):
        flags.append(('TAG', s[:60], ko[:60]))
    if CJK.search(re.sub(r'ZZG\d{3}ZZ', '', ko)):
        flags.append(('CJK', s[:60], ko[:60]))
print('translated:', len(trans), 'flags:', len(flags))
json.dump(flags, open(BASE + '/qflags.json', 'w'), ensure_ascii=False, indent=1)

def esc(s, q):
    return s.replace('\\', '\\\\').replace(q, '\\' + q).replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')

byfile = collections.defaultdict(list)
for inner, occs in allstr.items():
    ko = trans.get(inner)
    if ko is None:
        continue
    for (fn, a, b, q) in occs:
        byfile[fn].append((a, b, q, inner, ko))
changed = 0
for fn, lst in byfile.items():
    path = os.path.join(ROOT, fn)
    src = open(path, encoding='utf-8').read()
    for (a, b, q, inner, ko) in sorted(lst, key=lambda x: -x[0]):
        if src[a] != q or src[b-1] != q:
            print('POSMISMATCH', fn, a)
            continue
        src = src[:a] + q + esc(ko, q) + q + src[b:]
        changed += 1
    open(path, 'w', encoding='utf-8').write(src)
print('replaced:', changed)
