import json, re, subprocess, urllib.parse, time, os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
entries = json.load(open('/tmp/entries.json'))
glossary = json.load(open(BASE + '/glossary.json'))

# order terms longest-first; stable token per term
terms = sorted(glossary.keys(), key=lambda k: -len(k))
token_of = {t: 'ZZG%03dZZ' % i for i, t in enumerate(terms)}

def protect(view):
    s = view
    hits = {}
    for t in terms:
        if t in s:
            tok = token_of[t]
            s = s.replace(t, tok)
            hits[tok] = glossary[t]
    return s, hits

# unique views
views = []
seen = set()
for e in entries:
    v = e['view']
    if v not in seen:
        seen.add(v)
        views.append(v)
print('unique views:', len(views))

def batches(items, maxchars=700):
    cur, n = [], 0
    for v in items:
        L = len(v) + 20
        if cur and n + L > maxchars:
            yield cur
            cur, n = [], 0
        cur.append(v); n += L
    if cur: yield cur

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

# resume
outfile = BASE + '/map.json'
m = json.load(open(outfile)) if os.path.exists(outfile) else {}
todo = [v for v in views if v not in m]
print('todo:', len(todo))

n_batch = 0
for b in batches(todo):
    prot = [protect(v)[0] for v in b]
    hitlist = [protect(v)[1] for v in b]
    res = mt_call(prot)
    if res is None:
        # fall back to one-by-one
        for v, p in zip(b, prot):
            r1 = mt_call([p])
            if r1:
                m[v] = r1[0]
            else:
                m[v] = None
            time.sleep(0.2)
    else:
        for v, k in zip(b, res):
            m[v] = k
    n_batch += 1
    if n_batch % 10 == 0:
        json.dump(m, open(outfile, 'w'), ensure_ascii=False)
        print('done batches:', n_batch, 'mapped:', len(m), flush=True)
    time.sleep(0.25)
json.dump(m, open(outfile, 'w'), ensure_ascii=False)
print('ALL DONE mapped:', len(m), 'failures:', sum(1 for x in m.values() if x is None))
