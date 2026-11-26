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

def parse_tpl(src, a):
    # a is index of opening backtick. returns (end_exclusive, text_spans)
    spans = []
    i = a + 1
    n = len(src)
    tstart = i
    while i < n:
        c = src[i]
        if c == '\\':
            i += 2; continue
        if c == '`':
            if tstart < i:
                spans.append((tstart, i))
            return i + 1, spans
        if src.startswith('${', i):
            if tstart < i:
                spans.append((tstart, i))
            # parse expression
            j = i + 2
            depth = 1
            while j < n and depth > 0:
                ch = src[j]
                if ch in '"\'':
                    q = ch; j += 1
                    while j < n and src[j] != q:
                        j += 2 if src[j] == '\\' else 1
                    j += 1
                    continue
                if ch == '`':
                    end, sub = parse_tpl(src, j)
                    spans.extend(sub)
                    j = end
                    continue
                if ch == '/' and j + 1 < n and src[j+1] == '/':
                    k = src.find('\n', j)
                    j = n if k < 0 else k + 1
                    continue
                if ch == '/' and j + 1 < n and src[j+1] == '*':
                    k = src.find('*/', j + 2)
                    j = n if k < 0 else k + 2
                    continue
                if ch == '{': depth += 1
                elif ch == '}': depth -= 1
                j += 1
            i = j
            tstart = i
            continue
        i += 1
    return n, spans

def file_tpl_spans(src):
    spans = []
    i, n = 0, len(src)
    state = 'code'
    expr_depths = []
    while i < n:
        c = src[i]
        if state == 'code':
            if c == '/' and i + 1 < n and src[i+1] == '/':
                j = src.find('\n', i); i = n if j < 0 else j + 1; continue
            if c == '/' and i + 1 < n and src[i+1] == '*':
                j = src.find('*/', i + 2); i = n if j < 0 else j + 2; continue
            if c in '"\'':
                q = c; i += 1
                while i < n and src[i] != q:
                    i += 2 if src[i] == '\\' else 1
                i += 1; continue
            if c == '`':
                end, sub = parse_tpl(src, i)
                spans.extend(sub)
                i = end; continue
            if c == '{':
                if expr_depths: expr_depths[-1] += 1
                i += 1; continue
            if c == '}':
                if expr_depths:
                    expr_depths[-1] -= 1
                    if expr_depths[-1] == 0:
                        expr_depths.pop(); state = 'tpl'
                i += 1; continue
            i += 1; continue
        else:  # tpl (only re-entered via } popping; top-level handled by parse_tpl)
            state = 'code'
    return spans

uniq = collections.OrderedDict()
occs = collections.defaultdict(list)
for f in sorted(glob.glob(os.path.join(ROOT, 'src/*.js'))):
    rel = os.path.relpath(f, ROOT)
    src = open(f, encoding='utf-8').read()
    for (a, b) in file_tpl_spans(src):
        seg = src[a:b]
        if CJK.search(seg):
            uniq.setdefault(seg, None)
            occs[seg].append((rel, a, b))
print('unique CJK tpl text segments:', len(uniq), 'occurrences:', sum(len(v) for v in occs.values()))

trans = {}
todo = []
for s in uniq:
    if s in finals and finals[s]:
        trans[s] = finals[s]
    elif s in segmap:
        trans[s] = segmap[s]
    else:
        todo.append(s)
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
        flags.append(('TAG', s[:70], ko[:70]))
    if CJK.search(re.sub(r'ZZG\d{3}ZZ', '', ko)):
        flags.append(('CJK', s[:70], ko[:70]))
print('translated:', len(trans), 'flags:', len(flags))
json.dump(flags, open(BASE + '/tflags.json', 'w'), ensure_ascii=False, indent=1)
# persist for review
json.dump({s: trans.get(s) for s in uniq}, open(BASE + '/tsegs.json', 'w'), ensure_ascii=False, indent=1)

def esc(s):
    return s.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')

byfile = collections.defaultdict(list)
for s, occ in occs.items():
    ko = trans.get(s)
    if ko is None:
        continue
    for (fn, a, b) in occ:
        byfile[fn].append((a, b, s, ko))
changed = 0
for fn, lst in byfile.items():
    path = os.path.join(ROOT, fn)
    src = open(path, encoding='utf-8').read()
    for (a, b, s, ko) in sorted(lst, key=lambda x: -x[0]):
        if src[a:b] != s:
            print('POSMISMATCH', fn, a)
            continue
        src = src[:a] + esc(ko) + src[b:]
        changed += 1
    open(path, 'w', encoding='utf-8').write(src)
print('replaced:', changed)
