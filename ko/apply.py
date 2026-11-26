import json, re, os, collections

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
entries = json.load(open('/tmp/entries.json'))
finals = json.load(open(BASE + '/finals.json'))

# dedupe
seen = set()
ents = []
for e in entries:
    k = (e['file'], e['start'], e['end'])
    if k in seen:
        continue
    seen.add(k)
    ents.append(e)
print('unique literals:', len(ents))

by_file = collections.defaultdict(list)
for e in ents:
    by_file[e['file']].append(e)

def esc_sq(s, q):
    s = s.replace('\\', '\\\\')
    s = s.replace(q, '\\' + q)
    s = s.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
    return s

def esc_tpl_text(s):
    s = s.replace('\\', '\\\\')
    s = s.replace('`', '\\`')
    s = s.replace('${', '\\${')
    return s

changed_files = 0
skipped = []
for fn, lst in by_file.items():
    path = os.path.join(ROOT, fn)
    src = open(path, encoding='utf-8').read()
    lst.sort(key=lambda e: -e['start'])
    n = 0
    for e in lst:
        ko = finals.get(e['view'])
        if ko is None:
            skipped.append((fn, e['view'][:60]))
            continue
        old = src[e['start']:e['end']]
        if e['kind'] == 't':
            recon = '`' + ''.join((p[1] if p[0]=='text' else '${'+p[1]+'}') for p in e['parts']) + '`'
            if recon != old:
                skipped.append((fn, 'NESTED_MISMATCH', e['view'][:60]))
                continue
        if e['kind'] == 'q':
            q = old[0]
            assert q in '"\'', (fn, old[:20])
            new = q + esc_sq(ko, q) + q
        else:
            exprs = [p[1] for p in e['parts'] if p[0] == 'expr']
            # split ko on ${i}
            segs = re.split(r'\$\{(\d+)\}', ko)
            # segs: text, idx, text, idx, ...
            out = ['`']
            out.append(esc_tpl_text(segs[0]))
            for i in range(1, len(segs), 2):
                idx = int(segs[i])
                out.append('${' + exprs[idx] + '}')
                out.append(esc_tpl_text(segs[i + 1]))
            out.append('`')
            new = ''.join(out)
        src = src[:e['start']] + new + src[e['end']:]
        n += 1
    if n:
        open(path, 'w', encoding='utf-8').write(src)
        changed_files += 1
        print(fn, n)
print('changed files:', changed_files)
print('skipped:', len(skipped))
for s in skipped[:10]:
    print('SKIP', s)
