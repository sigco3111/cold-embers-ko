import json, re, os

BASE = os.path.dirname(os.path.abspath(__file__))
entries = json.load(open('/tmp/entries.json'))
m = json.load(open(BASE + '/map.json'))
glossary = json.load(open(BASE + '/glossary.json'))
terms = sorted(glossary.keys(), key=lambda k: -len(k))
token_of = {t: 'ZZG%03dZZ' % i for i, t in enumerate(terms)}
ko_of_tok = {'ZZG%03dZZ' % i: glossary[t] for i, t in enumerate(terms)}

def has_batchim(ch):
    o = ord(ch)
    if 0xAC00 <= o <= 0xD7A3:
        return (o - 0xAC00) % 28 != 0
    return True  # latin/digit: treat as batchim

PAIRS = [('이','가'), ('을','를'), ('은','는'), ('과','와'), ('으로','로'), ('이나','나'), ('이랑','랑'), ('아','야'), ('이에요','예요'), ('이었','였'), ('이라','라'), ('이고','고'), ('이며','며'), ('이든','든')]

def fix_particles(s):
    # after substituted term, choose correct allomorph based on batchim
    out = []
    i = 0
    while i < len(s):
        m2 = re.match(r'ZZG(\d{3})ZZ', s[i:])
        if m2:
            tok = m2.group(0)
            term = ko_of_tok[tok]
            i += len(tok)
            bat = has_batchim(term[-1])
            # check particles, longest first
            rest = s[i:]
            matched = False
            for a, b in sorted(PAIRS, key=lambda p: -len(p[0])):
                want = a if bat else b
                other = b if bat else a
                if rest.startswith(other):
                    # particle must be followed by space/punct/end to be safe
                    nxt = rest[len(other):len(other)+1]
                    if nxt == '' or nxt in ' .,!?)]}>:·、。，！？」\"\'' or nxt == '\n':
                        out.append(term + want)
                        i += len(other)
                        matched = True
                        break
            if not matched:
                out.append(term)
        else:
            out.append(s[i])
            i += 1
    return ''.join(out)

def final(view):
    ko = m.get(view)
    if ko is None:
        return None
    # restore glossary tokens with particle fixing
    ko = fix_particles(ko)
    return ko

flags = []
finals = {}
for e in entries:
    v = e['view']
    if v in finals:
        continue
    ko = final(v)
    finals[v] = ko
    if ko is None:
        flags.append(('MT_NONE', v[:80]))
        continue
    # validation
    if re.search(r'[一-鿿]', re.sub(r'ZZG\d{3}ZZ', '', ko)):
        flags.append(('RESIDUAL_CJK', v[:80], ko[:80]))
    if e['kind'] == 't':
        n_ph = len([p for p in e['parts'] if p[0] == 'expr'])
        got = re.findall(r'\$\{(\d+)\}', ko)
        if sorted(int(x) for x in got) != list(range(n_ph)):
            flags.append(('PH_MISMATCH', v[:100], ko[:120]))
    if v.count('<') != ko.count('<'):
        flags.append(('TAG_MISMATCH', v[:100], ko[:120]))

json.dump(finals, open(BASE + '/finals.json', 'w'), ensure_ascii=False)
print('finals:', len(finals))
print('flags:', len(flags))
from collections import Counter
print(Counter(f[0] for f in flags))
json.dump(flags, open(BASE + '/flags.json', 'w'), ensure_ascii=False, indent=1)
for f in flags[:10]:
    print(f)
