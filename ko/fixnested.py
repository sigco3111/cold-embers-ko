import json, re, os, subprocess, urllib.parse, time, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
nested = json.load(open(BASE + '/nested.json'))
finals = json.load(open(BASE + '/finals.json'))
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

# parse template literal raw into (is_text, value) tokens at all nesting depths
def scan_tpl(raw):
    # raw includes outer backticks
    toks = []  # ('text', str) or ('code', str)
    i = 1
    n = len(raw) - 1
    buf = []
    while i < n:
        c = raw[i]
        if c == '\\':
            buf.append(raw[i:i+2]); i += 2; continue
        if raw.startswith('${', i):
            if buf:
                toks.append(('text', ''.join(buf))); buf = []
            # capture expression, brace-aware, string/template aware
            j = i + 2
            depth = 1
            out = ['${']
            while j < n and depth > 0:
                ch = raw[j]
                if ch in '"\'':
                    q = ch; out.append(ch); j += 1
                    while j < n and raw[j] != q:
                        if raw[j] == '\\':
                            out.append(raw[j:j+2]); j += 2
                        else:
                            out.append(raw[j]); j += 1
                    if j < n:
                        out.append(raw[j]); j += 1
                    continue
                if ch == '`':
                    # nested template: capture whole thing
                    k = j + 1
                    sub = ['`']
                    d2 = 1
                    while k < n and d2 > 0:
                        c2 = raw[k]
                        if c2 == '\\':
                            sub.append(raw[k:k+2]); k += 2; continue
                        if c2 == '`':
                            d2 -= 1; sub.append('`'); k += 1; continue
                        if raw.startswith('${', k):
                            # nested expr inside nested template: count braces
                            m = k + 2; d3 = 1; sub.append('${')
                            while m < n and d3 > 0:
                                c3 = raw[m]
                                if c3 in '"\'':
                                    q3 = c3; sub.append(c3); m += 1
                                    while m < n and raw[m] != q3:
                                        if raw[m] == '\\':
                                            sub.append(raw[m:m+2]); m += 2
                                        else:
                                            sub.append(raw[m]); m += 1
                                    if m < n:
                                        sub.append(raw[m]); m += 1
                                    continue
                                if c3 == '{': d3 += 1
                                elif c3 == '}': d3 -= 1
                                sub.append(c3); m += 1
                            k = m; continue
                        sub.append(c2); k += 1
                    out.append(''.join(sub)); j = k; continue
                if ch == '{': depth += 1
                elif ch == '}': depth -= 1
                out.append(ch); j += 1
            toks.append(('code', ''.join(out)))
            i = j
            continue
        buf.append(c); i += 1
    if buf:
        toks.append(('text', ''.join(buf)))
    return toks

def esc_tpl_text(s):
    return s.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')

# NOTE on escapes: text segments from source may contain escape sequences like \n.
# We keep untranslatable escapes intact by splitting them out before MT.

# collect all CJK text segments (including inside nested templates within code tokens)
def collect_cjk_texts(raw, acc):
    for kind, val in scan_tpl(raw):
        if kind == 'text' and CJK.search(val):
            acc.add(val)
        elif kind == 'code':
            # find nested template literals inside the code token and recurse
            for m in re.finditer(r'`', val):
                pass
            # simpler: re-scan code token for backtick-delimited subtemplates
            for sub in extract_subtemplates(val):
                collect_cjk_texts(sub, acc)

def extract_subtemplates(code):
    subs = []
    i = 0
    n = len(code)
    while i < n:
        if code[i] == '`':
            j = i + 1
            buf = ['`']
            d = 1
            while j < n and d > 0:
                c = code[j]
                if c == '\\':
                    buf.append(code[j:j+2]); j += 2; continue
                if c == '`':
                    d -= 1; buf.append('`'); j += 1; continue
                if code.startswith('${', j):
                    m = j + 2; d3 = 1; buf.append('${')
                    while m < n and d3 > 0:
                        c3 = code[m]
                        if c3 in '"\'':
                            q3 = c3; buf.append(c3); m += 1
                            while m < n and code[m] != q3:
                                if code[m] == '\\':
                                    buf.append(code[m:m+2]); m += 2
                                else:
                                    buf.append(code[m]); m += 1
                            if m < n:
                                buf.append(code[m]); m += 1
                            continue
                        if c3 == '{': d3 += 1
                        elif c3 == '}': d3 -= 1
                        buf.append(c3); m += 1
                    j = m; continue
                buf.append(c); j += 1
            subs.append(''.join(buf))
            i = j
        else:
            i += 1
    return subs

acc = set()
for e in nested:
    collect_cjk_texts(e['raw'], acc)
print('unique CJK text segments:', len(acc))

# translate: reuse finals where possible, else MT
segmap = {}
todo = []
for s in acc:
    if s in finals and finals[s]:
        segmap[s] = finals[s]
    else:
        todo.append(s)
print('from finals:', len(segmap), 'to MT:', len(todo))

prot_map = {}
for s in todo:
    p, hits = protect(s)
    prot_map[s] = (p, hits)
qs = [prot_map[s][0] for s in todo]
res = []
for b in batches(qs):
    r = mt_call(b)
    if not r:
        print('MT FAIL batch of', len(b))
        res.extend([None] * len(b))
    else:
        res.extend(r)
    time.sleep(0.15)
for s, r in zip(todo, res):
    if r:
        ko = r
        for tok, t in prot_map[s][1].items():
            ko = ko.replace(tok, t)
        segmap[s] = ko

flags = []
for s, ko in segmap.items():
    if s.count('<') != ko.count('<'):
        flags.append(('TAG', s[:80], ko[:80]))
    if re.search(r'[一-鿿]', re.sub(r'ZZG\d{3}ZZ', '', ko)):
        flags.append(('CJK', s[:80], ko[:80]))
print('segmap:', len(segmap), 'flags:', len(flags))
json.dump({s: k for s, k in segmap.items()}, open(BASE + '/segmap.json', 'w'), ensure_ascii=False)
json.dump(flags, open(BASE + '/segflags.json', 'w'), ensure_ascii=False, indent=1)

# rebuild and apply
def rewrite_tpl(raw):
    out = []
    for kind, val in scan_tpl(raw):
        if kind == 'text':
            if val in segmap:
                out.append(esc_tpl_text(segmap[val]))
            else:
                out.append(val)
        else:
            out.append(rewrite_code(val))
    return '`' + ''.join(out) + '`'

def rewrite_code(code):
    # replace nested subtemplates inside code
    res = code
    for sub in extract_subtemplates(code):
        newsub = rewrite_tpl(sub)
        res = res.replace(sub, newsub, 1)
    return res

changed = 0
missing = []
byfile = {}
for e in nested:
    byfile.setdefault(e['file'], []).append(e)
for fn, lst in byfile.items():
    path = os.path.join(ROOT, fn)
    src = open(path, encoding='utf-8').read()
    for e in lst:
        raw = e['raw']
        if raw not in src:
            missing.append((fn, raw[:60]))
            continue
        newraw = rewrite_tpl(raw)
        src = src.replace(raw, newraw)
        changed += 1
    open(path, 'w', encoding='utf-8').write(src)
print('rewritten literals:', changed, 'missing:', len(missing))
for m_ in missing[:10]:
    print('MISS', m_)
