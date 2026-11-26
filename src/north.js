// 寒烬北行 · 1.1 北境：分岔（下一站走哪条路）和站点奇遇
// 分岔：这一站的烽火塔点亮以后（第十站以后：这一章做完），侦察兵带回去下一站的两条路（三岔侦察 → 三条）.
// 每条路的地貌、特产、会碰上的奇遇、带的好处和目标难度都不一样；下一站的位置不变，选了哪条，那一片地就照它重新生成
// 奇遇：北境每一站一件，到站半天以后出现，分两三段，每段选一样.最坏丢点东西、耽误点时间，不会卡住
import { RES, DAY_LEN, SPECS, SPEC_MAX, NORTH_RULES, NORTH_RULE_KEYS, RICH_KINDS, CAMP_SPEC, SPOTS, FORK, FORK_BONUS, WONDERS, WONDER_KEYS, QY, QY_KEYS } from './data.js';
import { northStop, setNorthPick, northPicks, regenWorld, getWorld, hash3 } from './worldgen.js';
import { rt, dirty, getCamp, logMsg, techDone, towerLit, chapters, addPeople, bumpMood, trimWorkers, revealCircle, campDefense, raidStrength, addBuff, gBuffAdd, bankPts, MIN_PEOPLE, TOWER_N } from './sim.js';
import { journeyOf, mainCamp, SPINE, northN, stopOf } from './journey.js';

const shuffle = (L, seed, a, b) => { L = L.slice(); for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(hash3(seed, a, b + i) * (i + 1)) % (i + 1); [L[i], L[j]] = [L[j], L[i]]; } return L; };
const ember = (S, n) => { S.meta.embers = Math.max(0, (S.meta.embers || 0) + n); if (n > 0) S.meta.emberTotal = (S.meta.emberTotal || 0) + n; };

// ---------- 分岔 ----------
export const forkN = S => techDone(S, 'fork3') ? 3 : 2;
// 这一程走过的奇遇（分岔先挑没碰过的）
export const qySeen = S => S.qyRun || (S.qyRun = []);
// 去第 k 站（journey 的站号）的三条路：第一条是种子原来定的地貌，另外两条换别的；只看前 forkN 条
export function forkOptions(S, k) {
  const N = k - SPINE, seed = S.runSeed, p = northStop(seed, N), cur = (stopOf(S, k - 1) || {}).rule;
  const rules = [p.rule0, ...shuffle(NORTH_RULE_KEYS.filter(r => r !== p.rule0 && r !== cur), seed, N, 300).slice(0, 2)];
  const seen = qySeen(S), qs = shuffle(QY_KEYS, seed, N, 340), qy = [...qs.filter(q => !seen.includes(q)), ...qs.filter(q => seen.includes(q))];
  const bon = shuffle(['embers', 'bp', 'spec'], seed, N, 320), dif = shuffle([0, 1, 2], seed, N, 330);
  return rules.map((rule, i) => {
    const o = { rule, qy: qy[i], bonus: bon[i], d: dif[i] };
    if (rule === 'rich') o.rich = i === 0 && p.rich0 ? p.rich0 : RICH_KINDS[Math.floor(hash3(seed, N, 310 + i) * RICH_KINDS.length) % RICH_KINDS.length];
    return o;
  });
}
export function forkOf(S) { const J = journeyOf(S); return J.fork && J.fork.k === J.stage + 1 ? J.fork : null; }
// 侦察兵什么时候回来：前十站点亮这一站的塔；再往北没有塔了，这一章做完
export function forkReady(S) {
  const J = journeyOf(S), N = northN(J.stage);
  if (!N || J.trip) return false;
  if (N <= TOWER_N) return towerLit(S, N);
  const ch = chapters(S).find(c => c.i === J.stage);
  return !ch || ch.done;
}
export function forkStep(S) {
  if (forkOf(S) || !forkReady(S)) return;
  const J = journeyOf(S), k = J.stage + 1;
  J.fork = { k, opts: forkOptions(S, k), pick: null, t: S.t };
  logMsg(S, `🧭 정찰 군인이 돌아왔습니다: "${stopOf(S, k).n}"으로 가는 ${forkN(S)}가지 방법이 있으며, 지형, 마주하게 될 것, 혜택이 다릅니다. 출발 전 "북쪽방향 › 북상" 경로 중 하나를 선택하세요(선택하지 않을 경우 첫 번째 경로 이용).`, 'story', { act: 'tb', arg: 'migrate', label: '경로를 선택하려면' });
  rt(S).fx.push({ kind: 'fork' });
}
// 一条路的特产（北境的站按地貌定，富矿带按那种矿）
export function forkSpec(o) {
  const key = o.rule === 'rich' && o.rich ? o.rich : o.rule, cs = CAMP_SPEC[key];
  return cs ? cs.n : o.rule === 'rich' && o.rich ? SPOTS[o.rich].n : '';
}
export function bonusTxt(kind, d) {
  const rf = FORK.rew[d ?? 1];
  const base = kind === 'embers' ? `잔불 ${Math.round(FORK.embers * rf)}` : FORK_BONUS[kind].n;
  return kind !== 'embers' && rf > 1 ? `${base} + 잔불 ${FORK.hardEmbers}` : base;
}
// 选一条路：下一站那片地马上按新地貌重新生成（地图上就能看到）；出发前还能改
export function pickFork(S, i, auto) {
  const J = journeyOf(S), F = forkOf(S);
  if (!F || !(i >= 0 && i < forkN(S))) return { ok: false, reason: '대안이 없다' };
  if (J.trip) return { ok: false, reason: '행렬이 이미 진행 중입니다.' };
  const o = F.opts[i], N = F.k - SPINE, st = northStop(S.runSeed, N);
  const changed = st.rule !== o.rule || (st.rich || null) !== (o.rich || null);
  F.pick = i;
  (J.picks ||= {})[F.k] = { rule: o.rule, rich: o.rich, qy: o.qy, bonus: o.bonus, d: o.d };
  setNorthPick(S.runSeed, N, o);
  const R = rt(S);
  if (changed) { regenWorld(S.runSeed); getWorld(S.runSeed); R.worldGen = (R.worldGen || 0) + 1; R.revealDirty = true; R.revealN = (R.revealN || 0) + 1; }
  if (R.nch) delete R.nch[F.k];
  if (R.tspec) delete R.tspec[N];
  dirty(S);
  const rl = NORTH_RULES[o.rule];
  logMsg(S, `🧭 ${auto ? '아무도 경로를 선택하지 않고 행렬는 정찰 병사가 추천한 첫 번째 경로를 따릅니다.' : '길을 택했다'}: "${stopOf(S, F.k).n}"은(는) ${rl.ic}${rl.n}, ${FORK.dn[o.d]}입니다.`, 'story');
  return { ok: true, changed };
}
// 读档：把这一程选过的地貌交给地图生成（选法和上次不一样就重新生成）
export function loadPicks(S) {
  const P = {}, J = S.journey;
  if (J && J.picks) for (const k in J.picks) P[k - SPINE] = { rule: J.picks[k].rule, rich: J.picks[k].rich };
  if (northPicks(S.runSeed, P)) regenWorld(S.runSeed);
}
// 选过的路在这一站的目标难度和奖励
export function pickOf(S, k) { return ((journeyOf(S).picks || {})[k]) || null; }
// 领这一章奖励时给的好处
export function forkBonus(S, kind, d, camp) {
  const rf = FORK.rew[d ?? 1];
  let msg = '';
  if (kind === 'bp') { const w = giveBp(S); if (w) msg = `불가사의 그림 "${WONDERS[w].n}"`; else kind = 'embers'; }
  if (kind === 'spec') { const m = giveSpec(S, camp); if (m) msg = m; else kind = 'embers'; }
  if (kind === 'embers') { const n = Math.round(FORK.embers * rf); ember(S, n); msg = `잔불 ${n}`; }
  else if (rf > 1) { ember(S, FORK.hardEmbers); msg += `, 험난한 길에는 잔불 ${FORK.hardEmbers}로 향하는 도로가 더 있습니다.`; }
  return msg;
}
// 奇观图纸：挑一张还没有的（研究给的也算有）
export const bpHave = (S, w) => !!((S.wbp || {})[w] || techDone(S, WONDERS[w].tech));
export function giveBp(S, salt = 0) {
  const L = shuffle(WONDER_KEYS, S.runSeed, journeyOf(S).stage, 360 + salt).filter(w => !bpHave(S, w));
  if (!L.length) return null;
  (S.wbp ||= {})[L[0]] = 1;
  return L[0];
}
// 一位专家：没来过的先来，都来过就给一位升一级；全满就算了
export function giveSpec(S, camp) {
  const M = S.meta.specs || (S.meta.specs = {});
  const L = shuffle(SPECS.map(x => x.id), S.runSeed, journeyOf(S).stage, 370 + (S.t | 0) % 7);
  const id = L.find(x => !M[x]) || L.find(x => M[x].lvl < SPEC_MAX);
  if (!id) return '';
  const sp = SPECS.find(x => x.id === id);
  if (!M[id]) { M[id] = { lvl: 1 }; return `전문가「${sp.n}」(${sp.role}) 가입됨`; }
  M[id].lvl++; return `전문가「${sp.n}」이(가) ${M[id].lvl} 레벨로 업그레이드되었습니다.`;
}

// ---------- 站点奇遇 ----------
const lack = o => (S, c) => { const m = Object.keys(o).filter(k => (c.stock[k] || 0) < o[k]); return m.length ? `${m.map(k => RES[k].n).join('、')} 부족` : ''; };
const hands = n => (S, c) => c.people - n < Math.max(MIN_PEOPLE, 10) ? `일손로는 충분하지 않습니다. (${n}명을 보낸 후 야영지에는 최소 10명이 남습니다.)` : '';
const both = (...f) => (S, c) => { for (const g of f) { const r = g(S, c); if (r) return r; } return ''; };
const take = (c, o) => { for (const k in o) c.stock[k] = Math.max(0, (c.stock[k] || 0) - o[k]); };
const give = (c, o) => { for (const k in o) c.stock[k] = (c.stock[k] || 0) + o[k]; };
const txt = (o, sg = '+') => Object.keys(o).map(k => `${RES[k].n} ${sg}${o[k]}`).join(' · ');
const allHope = (S, n) => { for (const c of S.camps) bumpMood(c, n, 0); };
const revealN = (S, c, r) => { revealCircle(S, c.x, c.y + 18, r); rt(S).revealDirty = true; };
const wolfStr = (S, c) => Math.round(raidStrength(S, c, { var: 0.75 }) * 1.3);
const flag = (S, k) => { (S.meta.f13 ||= {})[k] = 1; };
const wolfWin = (S, c) => { flag(S, 'wolfking'); give(c, { game: 300 }); addBuff(S, c, 'loot', 1, DAY_LEN, '늑대왕이 넘어졌다'); bumpMood(c, 5, -2); return { m: '늑대왕이 눈에 떨어졌습니다. 털은 나무 프레임에 늘어져 용광로 곁에 걸려 있었습니다(장식 "늑대왕 가죽"로 잠금 해제됨). 생고기 +300, 습격을 처치하면 다음 날 전리품이 두 배가 됩니다.' }; };
const wolfLose = (S, c) => { const n = Math.min(200, Math.floor(c.stock.food || 0)); take(c, { food: n }); bumpMood(c, -3, 3); return { m: `늑대왕은 창고를 부수고 열고 큰 고기 조각을 빼앗아 바람과 눈 속으로 사라졌습니다. 요리 −${n}.` }; };

// 每件奇遇：st 是一段一段；每段 x 是这段的话，o 是选项；g 是「奇遇向导」研究多给的一个选项（都在第一段）
// 选项：t 名字，d 说明，need 不够时返回原因，go 做完返回 { m 结果, nx 下一段, w 过多久出现, away 派出去几个人（下一段出现时回来）}
export const QE = {
  wolfking: { st: [
    { x: '밤에는 말보다 키가 큰 흰 늑대가 난방권 밖에서 세 바퀴를 돌았습니다. 눈 위의 발자국은 세면대만큼 컸습니다. 늙은 사냥꾼은 늑대왕라고 말하며 오늘 밤 먹을 곳을 고르고 있었습니다.',
      o: [
        { t: '매복하고 서클에 들어갈 때까지 기다립니다.', d: '화살탑 오늘 밤은 잠이 안 온다 나중에 보자', go: () => ({ m: '모두들 횃불을 반쯤 꺼냈고, 화살탑에 탄 사람들은 숨을 죽였다.', nx: 1, w: 90 }) },
        { t: '고기 한 점 투척', d: '생고기 −150 · 희망 +2', need: lack({ game: 150 }), go: (S, c) => { take(c, { game: 150 }); bumpMood(c, 2, 0); return { m: '늑대왕은 고기를 집어들고 야영지를 돌아보며 천천히 눈 속으로 걸어갔다.' }; } },
      ],
      g: { t: '발자국을 따라가면 늑대 굴을 찾을 수 있습니다', d: '4분간 8명 보내기', need: hands(8), go: () => ({ m: '늙은 길잡이는 8명을 데리고 발자국을 따라 산으로 들어갔습니다.', nx: 2, w: 240, away: 8 }) } },
    { x: '한밤중에 예상대로 늑대왕이 왔습니다. 조명이 켜진 곳을 우회해 바로 고기가 쌓여 있는 창고로 향했다.',
      o: [
        { t: '화살탑이 화살을 쏜다', d: (S, c) => `야영지방어 ${campDefense(S, c)}, 늑대왕 약 ${wolfStr(S, c)}: 방어가 패배할 수 있음`, go: (S, c) => campDefense(S, c) >= wolfStr(S, c) ? wolfWin(S, c) : wolfLose(S, c) },
        { t: '횃불을 들고 앞으로 달려가세요', d: '반 대 반: 승리하면 늑대왕 가죽을 얻고, 패배하면 일부 요리를 잃습니다.', go: (S, c, q) => hash3(S.runSeed, q.k, 77) < 0.5 ? wolfWin(S, c) : wolfLose(S, c) },
      ] },
    { x: '늑대 굴은 바람이 불어오는 쪽 바위 틈새에 있었는데 늑대왕은 거기에 없었습니다. 그 안에는 그가 겨울 내내 구한 사냥감 더미와 눈을 뜨지 못한 세 마리의 작은 늑대가 있었습니다.',
      o: [
        { t: '모든 사냥감을 뒤로 이동', d: '생고기 +600', go: (S, c) => { give(c, { game: 600 }); return { m: '여덟 명이 한동안 먹을 만큼 얼린 고기를 들고 돌아왔다.' }; } },
        { t: '아무것도 움직이지 말고 조용히 나가세요', d: '희망 +6 · 하루 안에 습격을 처치하면 전리품이 두 배로 늘어납니다.', go: (S, c) => { bumpMood(c, 6, 0); addBuff(S, c, 'loot', 1, DAY_LEN, '늑대왕의 답례품'); return { m: '아무도 아무것도 가져가지 않았습니다. 다음 날 이른 아침, 야영지의 문 앞에는 얼어붙은 사슴이 있었습니다.' }; } },
      ] },
  ] },
  undercity: { st: [
    { x: '군인 정찰은 얼음호수에 누워 아래를 내려다보았습니다. 얼음 아래에는 지붕과 거리, 종탑이 있었고 도시 전체가 얼음 속에 얼어붙었습니다.',
      o: [
        { t: '얼음을 자르기 위해 10명의 남자를 보내세요', d: '10명이 10분간 간다', need: hands(10), go: () => ({ m: '10명의 남자가 얼음 송곳과 밧줄을 가지고 내려갔습니다.', nx: 1, w: 600, away: 10 }) },
        { t: '얼음에 구멍을 뚫어라 보기', d: '고대 부품 +30', go: (S, c) => { give(c, { part: 30 }); return { m: '여러 개의 새겨진 금속 조각이 구멍에 연결되었습니다.' }; } },
      ],
      g: { t: '늙은 길잡이가 앞장서 주세요', d: '그는 길을 알고 있습니다: 5분 안에 5명만 가면 갈 수 있습니다', need: hands(5), go: () => ({ m: '늙은 길잡이는 어렸을 때 이 도시에 대한 이야기를 듣고 5명과 함께 그곳으로 내려갔다고 합니다.', nx: 1, w: 300, away: 5 }) } },
    { x: '얼음 아래 도시는 상상 이상으로 크다. 등유는 조금 더 오래 쓸 수 있을 정도밖에 없었고, 한 가지만 가져갈 시간도 없었습니다.',
      o: [
        { t: '고대 부품 분해', d: '고대 부품 +120', go: (S, c) => { give(c, { part: 120 }); return { m: '썰매는 고성의 부품으로 채워져 있습니다.' }; } },
        { t: '시계탑으로 가서 설계도를 찾으세요', d: '불가사의 도면 한 장 (둘 다 있는 경우 고대 부품 120으로 교체)', go: (S, c) => { const w = giveBp(S, 1); if (w) return { m: `종탑 꼭대기에 그림 두루마리가 압착되어 있습니다. 바로 "${WONDERS[w].n}" 그림입니다!` }; give(c, { part: 120 }); return { m: '도면은 모두 사용 가능했으며 고대 부품 120개는 쉽게 분해되었습니다.' }; } },
      ] },
  ] },
  geyser: { st: [
    { x: '야영지 옆에 눈밭에 구멍이 뚫리더니 하얀 김이 솟아오르는 온천이 뿜어져 나왔다. 주변의 눈이 눈 깜짝할 사이에 녹았습니다.',
      o: [
        { t: '주변을 따뜻하게 유지하세요', d: '이 야영지 몸의 느낌은 +5° · 어느 날', go: (S, c) => { addBuff(S, c, 'heat', 5, DAY_LEN, '지열 분출'); return { m: '모두가 침구를 온천 가장자리로 옮겼습니다.' }; } },
        { t: '길들여라', d: '강재 −80 · 10명 5분 이동', need: both(lack({ steel: 80 }), hands(10)), go: (S, c) => { take(c, { steel: 80 }); return { m: '10명의 사람들이 온천을 연결하기 위해 쇠파이프를 운반했습니다.', nx: 1, w: 300, away: 10 }; } },
      ],
      g: { t: '열을 따라 근원을 찾아라', d: '6명은 주변을 파헤치기 위해 3분 동안 이동한다 안개', need: hands(6), go: (S, c) => { revealN(S, c, 12); return { m: '더위는 산기슭에서 북쪽으로 옵니다.', nx: 1, w: 180, away: 6 }; } } },
    { x: '배관을 연결하고 밸브를 돌리면 온천에서 뜨거운 증기가 꾸준히 나옵니다.',
      o: [
        { t: '지열정 구축', d: '이 야영지는 지열정을 무료로 구축할 수 있습니다(지열 골짜기가 아니더라도 상관없습니다).', go: (S, c) => { (c.freeB ||= {}).geowell = (c.freeB.geowell || 0) + 1; return { m: '온천 입구가 저장되었습니다. 건설 메뉴에서 무료로 지열정을 만들 수 있습니다.' }; } },
        { t: '뜨거운 공기를 용광로에 연결하십시오', d: '이 야영지연료는 -20% · 2일을 소비합니다.', go: (S, c) => { addBuff(S, c, 'fuel', -0.2, DAY_LEN * 2, '용광로에 연결된 지열'); return { m: '용광로는 더욱 효율적으로 연소됩니다.' }; } },
      ] },
  ] },
  whale: { st: [
    { x: '회색 언덕이 빙원 밖으로 솟아오른다. 가까이 다가가보니 용광로보다 길이가 긴 얼음 속에 얼어붙은 거대한 고래인 것이 분명하게 보였습니다.',
      o: [
        { t: '고기 자르기 위해 전체 야영지 파견됨', d: '20명이 8분에 갑니다', need: hands(20), go: () => ({ m: '20명의 사람들이 톱질과 썰매를 끌기 시작했습니다.', nx: 1, w: 480, away: 20 }) },
        { t: '닥치는 대로 잘라라', d: '생고기 +400', go: (S, c) => { give(c, { game: 400 }); return { m: '노출된 부분을 잘라내면 언덕만큼 커질 것이다.' }; } },
      ],
      g: { t: '늙은 길잡이는 모두에게 칼 조작 방법을 가르칩니다.', d: '8분에 10명만 가요', need: hands(10), go: () => ({ m: '늙은 길잡이는 어렸을 때 바닷가에 살았으며 최소한의 노력으로 어디를 잘라야 할지 알고 있었습니다.', nx: 1, w: 480, away: 10 }) } },
    { x: '고래 고기가 산더미처럼 쌓여 있었고 고래 기름 통도 있었습니다. 썰매는 동일한 것만 당길 수 있습니다.',
      o: [
        { t: '고기를 다 뒤로 빼내세요', d: '생고기 +2000', go: (S, c) => { give(c, { game: 2000 }); return { m: '창고에는 냉동 고래 고기가 가득하고 부엌은 며칠 동안 바쁠 것입니다.' }; } },
        { t: '고래기름을 가져와서 태워버리세요', d: '석탄 +800 (고래기름탑 석탄 연소)', go: (S, c) => { give(c, { coal: 800 }); return { m: '용광로에 고래기름을 부으니 불길이 치솟았습니다.' }; } },
      ] },
  ] },
  aurora: { st: [
    { x: '하늘에는 오로라가 커튼처럼 눈에 드리워져 있고, 나침반은 빙글빙글 돌고 있는데, 공학 작업장의 기구는 놀라울 정도로 밝다.',
      o: [
        { t: '공학 작업장 밤새 기록', d: '연구 속도 ×2 · 1일', go: S => { gBuffAdd(S, 'res', 1, DAY_LEN, '오로라 폭풍'); return { m: '공학 작업장의 빛은 밤새도록 켜져 있었습니다.', nx: 1, w: DAY_LEN }; } },
        { t: '나와서 야영지 전체를 살펴보세요', d: '모두야영지희망 +8', go: S => { allHope(S, 8); return { m: '어른들 아이는 모두 눈밭으로 달려가 밤새도록 올려다보았습니다.' }; } },
      ],
      g: { t: '오로라의 빛을 용광로에 도입하세요', d: '연구 속도 ×2 어느 날, 모두 야영지희망 +4', go: S => { gBuffAdd(S, 'res', 1, DAY_LEN, '오로라 폭풍'); allHope(S, 4); return { m: '용광로의 불꽃은 녹색으로 물들었고, 공학 작업장의 기구에도 불이 들어왔습니다.', nx: 1, w: DAY_LEN }; } } },
    { x: '오로라가 흩어져 있습니다. 내가 적어 놓은 것들이 테이블 여기저기에 쌓여 있었는데, 그 중 절반도 알아듣는 사람이 없었다.',
      o: [
        { t: '도면으로 정리', d: '연구 포인트 +300', go: S => { bankPts(S, 300); return { m: '기술자는 이틀 밤을 새워가며 그림 더미를 정리했습니다.' }; } },
        { t: '돌에 새겨진 용광로 곁', d: '이 야영지희망 +6', go: (S, c) => { bumpMood(c, 6, 0); return { m: '돌에는 빛의 곡선 모양의 띠가 새겨져 있어 지나가는 사람이 다시 한 번 살펴보게 됩니다.' }; } },
      ] },
  ] },
  caravan: { st: [
    { x: '바람과 눈 속에서 종소리가 울렸다. 대상은 길을 잃었고 수레를 끄는 설소는 추위에 떨고 있었다.',
      o: [
        { t: '일손 배치다시 가져가세요', d: '요리 −60 · 8명이 4분 갔습니다', need: both(lack({ food: 60 }), hands(8)), go: (S, c) => { take(c, { food: 60 }); return { m: '여덟 명이 뜨거운 국물을 들고 나섰습니다.', nx: 1, w: 240, away: 8 }; } },
        { t: '멀리서부터 길을 보여주세요', d: '잔불 +5', go: S => { ember(S, 5); return { m: '대상은 불이 있는 방향으로 방향을 틀었고, 종소리는 점점 더 멀어졌다.' }; } },
      ],
      g: { t: '봉화를 켜고 스스로 찾도록 하세요.', d: '목재 −100, 일손 배치를 사용하지 마십시오', need: lack({ wood: 100 }), go: (S, c) => { take(c, { wood: 100 }); return { m: '야영지 북쪽에서 화재가 발생했습니다.', nx: 1, w: 240 }; } } },
    { x: '캐러밴 안의 사람들은 몸을 녹였습니다. 팀장은 자신들이 북방 상회 소속이고 야영지에게 은혜를 입었다고 말했습니다.',
      o: [
        { t: '상회로 말하도록 요청하세요.', d: '상회 배송비 +20% · 1일', go: S => { gBuffAdd(S, 'guild', 0.2, DAY_LEN, '캐러밴 호의'); return { m: '팀장은 가슴을 두드리며 \'상회가 이날 상품을 접수하면 20%를 더 주겠다\'고 말했다.' }; } },
        { t: '한 트럭분의 상품을 교환하세요', d: txt({ steel: 150, alloy: 60, battery: 40 }), go: (S, c) => { give(c, { steel: 150, alloy: 60, battery: 40 }); return { m: '캐러밴은 감사의 선물로 많은 물건을 내렸습니다.' }; } },
      ] },
  ] },
  sleepers: { st: [
    { x: '얼음동굴 깊은 곳에는 십여 명이 넘는 사람들이 두꺼운 담요에 싸인 채 누워 있었고, 가슴은 살짝 부풀려 동면 중이었다.',
      o: [
        { t: '리프트 백 난방권', d: '요리 −120 · 8명 3분 이동', need: both(lack({ food: 120 }), hands(8)), go: (S, c) => { take(c, { food: 120 }); return { m: '8명은 썰매를 이용해 동면 중인 사람들을 한 명씩 끌어내렸다.', nx: 1, w: 180, away: 8 }; } },
        { t: '구멍을 막고 표시를 남깁니다.', d: '희망 +3', go: (S, c) => { bumpMood(c, 3, 0); return { m: '동굴 입구는 얼음벽돌로 막고 깃발을 꽂았다.' }; } },
      ],
      g: { t: '용광로의 열을 사용하여 천천히 깨우세요.', d: '석탄 −150, 일손 배치를 사용하지 마십시오', need: lack({ coal: 150 }), go: (S, c) => { take(c, { coal: 150 }); return { m: '긴 파이프가 용광로의 뜨거운 공기를 얼음 동굴로 보냅니다.', nx: 1, w: 180 }; } } },
    { x: '동면하던 사람들은 너무 배고파서 말을 할 수 없을 정도로 하나 둘 깨어났다. 선두 노인은 남쪽으로 가고 있다고 말했습니다.',
      o: [
        { t: '그들에게 머물라고 해라', d: '+12명', go: (S, c) => { const a = addPeople(S, c, 12); return { m: `12명이 묵었어요${a && a.wait ? `, 침대가 부족해요.${a.wait}사람들은 먼저 오두막에서 기다려요` : ''}.` }; } },
        { t: '그들을 남쪽으로 보내세요', d: '잔불 +12', go: S => { ember(S, 12); return { m: '그들은 건조한 음식을 가지고 남쪽으로 갔고, 떠나기 전에 불지킴이에게 잔불 한 봉지를주었습니다.' }; } },
      ] },
  ] },
  starfall: { st: [
    { x: '한밤중에 불줄기가 하늘을 가로질러 야영지의 북쪽에 떨어지면서 여전히 연기가 나는 커다란 분화구가 생겼습니다.',
      o: [
        { t: '더울 때 파세요', d: '10명이 5분간 진행 (구덩이는 아직 뜨거워서 누군가 화상을 입을 수도 있음)', need: hands(10), go: (S, c) => { c.sick = (c.sick || 0) + 2; return { m: '열 명이 더위를 견디며 구덩이에 들어갔고, 일손 두 대에 물집이 생겼습니다.', nx: 1, w: 300, away: 10 }; } },
        { t: '식을 때까지 기다리세요', d: '오랫동안 기다리세요', go: () => ({ m: '모두들 모여서 멀리서 지켜보며 구덩이 속의 연기가 사라지기를 기다리고 있었습니다.', nx: 1, w: DAY_LEN / 2 }) },
      ],
      g: { t: '먼저 구멍을 눈으로 채운 다음 파십시오.', d: '10명이 5분 동안 화상을 입지 않고 갈 수 있습니다.', need: hands(10), go: () => ({ m: '눈이 구덩이에 쏟아져 하얗게 김이 피어올랐습니다.', nx: 1, w: 300, away: 10 }) } },
    { x: '구덩이 바닥에는 주먹만한 크기의 돌이 놓여 있는데, 그 돌은 파란색으로 빛나고 손에 닿으면 여전히 따뜻합니다.',
      o: [
        { t: '조각조각 나눠서 다시 가져가세요', d: '별핵 +12', go: (S, c) => { give(c, { starcore: 12 }); return { m: '망치 하나로 12개의 조각으로 부서졌습니다 별핵.' }; } },
        { t: '전체 블록은 용광로 곁에 제공됩니다.', d: '이야영지희망 +8 · 잔불 +10', go: (S, c) => { bumpMood(c, 8, 0); ember(S, 10); return { m: '빛나는 돌은 밤의 작은 램프처럼 용광로 곁에 배치됩니다.' }; } },
      ] },
  ] },
  wreck: { st: [
    { x: '얼음호수 중간에 쇄빙선이 얼어붙었습니다. 선체는 그대로 남아 있었지만 보일러에 붉은 녹이 묻어 있었습니다.',
      o: [
        { t: '부품 분해', d: '강재 +200 · 고대 부품 +30', go: (S, c) => { give(c, { steel: 200, part: 30 }); return { m: '선체는 한 조각씩 벗겨졌고, 썰매는 그것을 여러 번 잡아당겼습니다.' }; } },
        { t: '고치다', d: '강재 −120 · 증기기관 −6 · 8명 6분 이동', need: both(lack({ steel: 120, engine: 6 }), hands(8)), go: (S, c) => { take(c, { steel: 120, engine: 6 }); return { m: '보일러실에는 8명이 들어갔습니다.', nx: 1, w: 360, away: 8 }; } },
      ],
      g: { t: '선장의 객실을 살펴보고 있습니다.', d: '북쪽의 넓은 지역을 발견하세요 안개 · 연구 포인트 +120', go: (S, c) => { revealN(S, c, 16); bankPts(S, 120); return { m: '선장의 항법도에는 얼음호수와 산길이 북쪽에 그려져 있습니다.' }; } } },
    { x: '보일러에서 또 연기가 나요! 쇄빙선은 야영지로 돌아갔습니다.',
      o: [
        { t: '발전소로 유지하세요', d: '이 야영지연료는 -15% · 2일을 소비합니다.', go: (S, c) => { addBuff(S, c, 'fuel', -0.15, DAY_LEN * 2, '쇄빙선 보일러'); return { m: '선박의 보일러는 용광로가 작업의 일부를 공유하는 데 도움이 되었습니다.' }; } },
        { t: '분해해서 좋은 부품으로 교체했습니다', d: '고대 부품 +80 · 톱니바퀴 +120', go: (S, c) => { give(c, { part: 80, gear: 120 }); return { m: '수리된 부품은 분해하여 모두 사용할 수 있습니다.' }; } },
      ] },
  ] },
  hermit: { st: [
    { x: '눈이 쌓인 집에는 한 노인이 살고 있었는데, 그의 수염은 얼음으로 뒤덮여 있었습니다. 그는 사람들이 북쪽으로 가기만을 40년 동안 이곳에서 기다렸다고 말했습니다.',
      o: [
        { t: '그에게 북쪽에 대해 말해 달라고 하세요', d: '북쪽에서 안개 조각 공개', go: (S, c) => { revealN(S, c, 10); return { m: '노인은 손가락으로 눈 위에 지도를 그렸습니다.', nx: 1, w: 120 }; } },
        { t: '그에게 음식을 좀 줘', d: '요리 −40 · 희망 +2', need: lack({ food: 40 }), go: (S, c) => { take(c, { food: 40 }); bumpMood(c, 2, 0); return { m: '노인은 손이 심하게 떨리며 뜨거운 국물을 받아들었다.', nx: 1, w: 120 }; } },
      ],
      g: { t: '그를 용광로 곁에 앉도록 초대하세요', d: '요리 −40, 그는 더 많은 이야기를 할 것입니다', need: lack({ food: 40 }), go: (S, c) => { take(c, { food: 40 }); return { m: '노인은 용광로 곁에 앉아 손을 따뜻하게 하고 이야기를 시작했다.', nx: 2, w: 120 }; } } },
    { x: '노인은 팔에서 누렇게 변한 쪽지를 꺼내더니 어렸을 때 그걸 적어 두었다고 말했습니다.',
      o: [
        { t: '메모 받기', d: '연구 포인트 +200', go: S => { bankPts(S, 200); return { m: '북쪽 각 역의 지뢰와 바람이 노트에 기록됩니다.' }; } },
        { t: '그에게 머물러달라고 부탁해', d: '전문가 한 명(모두 요청하면 잔불 15로 교체)', go: (S, c) => { const m = giveSpec(S, c); if (m) return { m: `그 노인은 유능한 사람 ${m}을(를) 알고 있습니다.` }; ember(S, 15); return { m: '노인은 미소를 지으며 고개를 저은 다음 불지킴이에게 잔불 한 봉지를 주었다.' }; } },
      ] },
    { x: '노인은 밤새도록 난로 옆에 앉아 북쪽의 각 정류장에서 눈보라, 늑대, 얼음호수에 대한 이야기를 들려주었습니다.',
      o: [
        { t: '그가 말하는 모든 것을 적어라', d: '연구 포인트 +200 · 전문가 한 명', go: (S, c) => { bankPts(S, 200); const m = giveSpec(S, c); if (!m) ember(S, 15); return { m: `책 한권을 다 외웠다${m ? `, 그리고 초대된 도우미:${m}` : ''}.` }; } },
        { t: '그에게 아이에게 이야기를 들려달라고 요청하세요.', d: '모두야영지희망 +6', go: S => { allHope(S, 6); return { m: '아이 사람들은 노인을 에워싸고 한밤중에 그 소리를 듣고 잠을 자지 않았습니다.' }; } },
      ] },
  ] },
  stormeye: { st: [
    { x: '군인 정찰은 다시 달려가 보고했습니다. 야영지를 향해 폭풍이 다가오고 있었지만 폭풍 한가운데에는 고요했고 눈도 내리지 않았습니다.',
      o: [
        { t: 'Quan야영지는 집에 숨어 있습니다', d: '목재 −200은 잠시 동안 연소되며 안정적입니다.', need: lack({ wood: 200 }), go: (S, c) => { take(c, { wood: 200 }); return { m: '폭풍이 머리 위로 휘몰아쳤고, 그 집 사람들은 밤새 잠을 이루지 못했습니다.' }; } },
        { t: '폭풍의 눈 속에서 일자리를 빼앗아라', d: '이 야영지생산량 +50% · 10분 후 폭풍의 꼬리가 휩쓸 것입니다.', go: (S, c) => { addBuff(S, c, 'prod', 0.5, 600, '폭풍의 눈'); return { m: '이 평온함을 이용하여 모두가 쉬지 않고 일했습니다.', nx: 1, w: 600 }; } },
      ],
      g: { t: '폭풍의 눈을 따라 북쪽으로 잠시 걸어가세요', d: '작업을 지연시키지 않고 북쪽 안개의 넓은 지역을 발견하십시오', go: (S, c) => { revealN(S, c, 18); return { m: '정찰 병사들은 폭풍의 눈을 멀리 따라가며 북쪽을 선명하게 볼 수 있었습니다.' }; } } },
    { x: '폭풍의 꼬리가 휩쓸고 지붕에 있던 스노우 보드가 날아갔습니다.',
      o: [
        { t: '목판으로 강화', d: '목판 −150', need: lack({ plank: 150 }), go: (S, c) => { take(c, { plank: 150 }); return { m: '지붕은 단단히 못으로 박혀 있었고 폭풍은 지나갔습니다.' }; } },
        { t: '그것을 통해 수행', d: '이 야영지희망 −4에는 다른 손실이 없습니다.', go: (S, c) => { bumpMood(c, -4, 2); return { m: '스노보드 몇 개를 뒤집고 아이 몇 개를 울렸습니다. 다행히 다들 괜찮았어요.' }; } },
      ] },
  ] },
  altar: { st: [
    { x: '눈 아래에 돌로 만든 제단이 파헤쳐졌습니다. 제단 밑에 있는 숯불은 마치 누군가가 불에 불을 더해 주기를 기다리는 것처럼 여전히 따뜻했습니다.',
      o: [
        { t: '잔불으로 다시 불붙여보세요', d: '잔불 −15', need: S => (S.meta.embers || 0) < 15 ? '잔불로는 충분하지 않습니다' : '', go: S => { ember(S, -15); return { m: '잔불 한 줌이 던져지자, 불의 제단이 굉음과 함께 빛났다.', nx: 1, w: 60 }; } },
        { t: '야영지로 다시 이동하세요.', d: '10명이 4분 갑니다', need: hands(10), go: () => ({ m: '10명은 썰매를 이용해 불제단을 뒤로 끌고 갔다.', nx: 2, w: 240, away: 10 }) },
      ],
      g: { t: '불 제단 옆에서 하룻밤을 보내세요', d: '비용은 전혀 들지 않습니다. 조금만 기다리시면 됩니다.', go: () => ({ m: '불지킴이는 밤새도록 제단 곁에 앉아 있었는데, 새벽이 되자 숯불이 피기 시작했습니다.', nx: 1, w: DAY_LEN / 2 }) } },
    { x: '금색 불꽃 덩어리가 불 제단에서 터져 나오며 조용하고 안정적으로 타올랐습니다.',
      o: [
        { t: '화재 용광로를 소개합니다', d: '이 야영지연료는 -20% · 2일을 소비합니다.', go: (S, c) => { addBuff(S, c, 'fuel', -0.2, DAY_LEN * 2, '금색 화재'); return { m: '용광로에는 금색의 불꽃이 있습니다.' }; } },
        { t: '각 야영지 제공', d: '전체야영지희망 +5', go: S => { allHope(S, 5); return { m: '금색의 불씨는 모든 야영지에 전달되었습니다.' }; } },
      ] },
    { x: '불의 제단은 용광로 옆에 서있었습니다. 아이 사람들은 안에서 과거의 사람들을 볼 수 있다며 둘러쌌다.',
      o: [
        { t: '그냥 거기 세워두세요', d: '이 야영지희망 +6', go: (S, c) => { bumpMood(c, 6, 0); return { m: '불제단은 야영지에서 가장 활기 넘치는 곳이 되었습니다.' }; } },
        { t: '제단 앞에 이 정류장의 이름을 새깁니다.', d: '잔불 +8 · 희망 +3', go: (S, c) => { ember(S, 8); bumpMood(c, 3, 0); return { m: '돌에는 또 다른 이름이 있습니다.' }; } },
      ] },
  ] },
};

export function qyOf(S) { return S.qy && S.qy.k === journeyOf(S).stage ? S.qy : null; }
// 到了北境的一站：定下这一站的奇遇（选过路的按那条路，没选过的按种子），半天以后出现
export function qyArrive(S, k) {
  const pk = pickOf(S, k);
  let id = pk && pk.qy;
  if (!id || !QE[id]) { const seen = qySeen(S), L = shuffle(QY_KEYS, S.runSeed, k - SPINE, 350); id = L.find(q => !seen.includes(q)) || L[0]; }
  S.qy = { k, id, st: 0, at: S.t + DAY_LEN / 2, camp: journeyOf(S).main };
}
export function qyPending(S) { const q = qyOf(S); return q && !q.done && S.t >= q.at && !journeyOf(S).trip ? q : null; }
// 还没出现（或者人还没回来）：多久以后
export function qyWait(S) { const q = qyOf(S); return q && !q.done && S.t < q.at ? { q, left: q.at - S.t } : null; }
const optsOf = (S, q) => { const st = QE[q.id].st[q.st], L = st.o.slice(); if (st.g && techDone(S, 'guide')) L.push({ ...st.g, g: 1 }); return L; };
const qyCamp = (S, q) => getCamp(S, q.camp) || mainCamp(S);
export function qyView(S) {
  const q = qyPending(S); if (!q) return null;
  const st = QE[q.id].st[q.st], c = qyCamp(S, q);
  const opts = optsOf(S, q).map(o => { const why = o.need ? o.need(S, c, q) : ''; return { t: o.t, d: typeof o.d === 'function' ? o.d(S, c, q) : o.d, ok: !why, why, g: !!o.g }; });
  return { id: q.id, n: QY[q.id].n, ic: QY[q.id].ic, text: typeof st.x === 'function' ? st.x(S, c, q) : st.x, opts, st: q.st, camp: c.name };
}
export function qyChoose(S, i) {
  const q = qyPending(S); if (!q) return { ok: false, reason: '결정하지 않아도 돼요 기연' };
  const o = optsOf(S, q)[i]; if (!o) return { ok: false, reason: '그런 옵션은 없습니다' };
  const c = qyCamp(S, q), why = o.need ? o.need(S, c, q) : '';
  if (why) return { ok: false, reason: why };
  const r = o.go(S, c, q) || { m: '' };
  (q.h ||= []).push([q.st, i]);
  if (r.away) { const n = Math.max(0, Math.min(r.away, c.people - MIN_PEOPLE)); q.away = n; c.people -= n; trimWorkers(S, c); }
  logMsg(S, `${QY[q.id].ic}【${QY[q.id].n}】${r.m}`, 'story');
  if (r.nx != null) { q.st = r.nx; q.at = S.t + (r.w || 0); delete q.told; }
  else qyEnd(S, q);
  dirty(S);
  return { ok: true, msg: r.m, next: r.nx != null, wait: r.w || 0 };
}
function qyBack(S, q, quiet) {
  if (!q.away) return;
  const c = qyCamp(S, q), n = q.away; q.away = 0; c.people += n;
  if (!quiet) logMsg(S, `${QY[q.id].ic} "${QY[q.id].n}"(으)로 갔던 ${n}명이 돌아왔습니다.`, 'good');
}
function qyEnd(S, q) {
  q.done = 1; qyBack(S, q, true);
  const M = S.meta.qy || (S.meta.qy = {}); M[q.id] = (M[q.id] || 0) + 1;
  const seen = qySeen(S); if (!seen.includes(q.id)) seen.push(q.id);
  rt(S).fx.push({ kind: 'qy-end', id: q.id });
}
// 出发去下一站：没做完的奇遇就错过了，派出去的人先回来
export function qyLeave(S) {
  const q = S.qy; if (!q || q.done) return;
  qyBack(S, q, true); q.done = 1; q.miss = 1;
  logMsg(S, `${QY[q.id].ic}「${QY[q.id].n}」이(가) 끝나기도 전에 행렬이 출발했습니다.`);
}
// 派出去的人数（占着床位，不干活）
export const qyAway = (S, camp) => S.qy && S.qy.away && S.qy.camp === camp.id ? S.qy.away : 0;
// 两秒一次：派出去的人到点回来；新的一段出现时提醒一次（离线追赶时不提醒）
export function qyStep(S) {
  const q = S.qy; if (!q) return;
  if (q.away && S.t >= q.at) qyBack(S, q);
  if (q.done || q.k !== journeyOf(S).stage || S.t < q.at || q.told === q.st || rt(S).offline) return;
  q.told = q.st;
  logMsg(S, `${QY[q.id].ic} 기연「${QY[q.id].n}」${q.st ? '다음과 함께' : '：' + QY[q.id].d}`, 'story', { act: 'qyopen', label: '가 보기' });
  rt(S).fx.push({ kind: 'qy', id: q.id });
}
