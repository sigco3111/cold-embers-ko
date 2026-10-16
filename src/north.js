// 寒烬北行 · 1.1 北境：分岔（下一站走哪条路）和站点奇遇
// 分岔：这一站的烽火塔点亮以后（第十站以后：这一章做完），侦察兵带回去下一站的两条路（三岔侦察 → 三条）。
// 每条路的地貌、特产、会碰上的奇遇、带的好处和目标难度都不一样；下一站的位置不变，选了哪条，那一片地就照它重新生成
// 奇遇：北境每一站一件，到站半天以后出现，分两三段，每段选一样。最坏丢点东西、耽误点时间，不会卡住
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
  logMsg(S, `🧭 侦察兵回来了：去「${stopOf(S, k).n}」有 ${forkN(S)} 条路，地貌、会碰上的事和好处都不一样。出发前在「北行 › 北迁」里选一条（不选就走第一条）。`, 'story', { act: 'tb', arg: 'migrate', label: '去选路' });
  rt(S).fx.push({ kind: 'fork' });
}
// 一条路的特产（北境的站按地貌定，富矿带按那种矿）
export function forkSpec(o) {
  const key = o.rule === 'rich' && o.rich ? o.rich : o.rule, cs = CAMP_SPEC[key];
  return cs ? cs.n : o.rule === 'rich' && o.rich ? SPOTS[o.rich].n : '';
}
export function bonusTxt(kind, d) {
  const rf = FORK.rew[d ?? 1];
  const base = kind === 'embers' ? `余烬 ${Math.round(FORK.embers * rf)}` : FORK_BONUS[kind].n;
  return kind !== 'embers' && rf > 1 ? `${base} + 余烬 ${FORK.hardEmbers}` : base;
}
// 选一条路：下一站那片地马上按新地貌重新生成（地图上就能看到）；出发前还能改
export function pickFork(S, i, auto) {
  const J = journeyOf(S), F = forkOf(S);
  if (!F || !(i >= 0 && i < forkN(S))) return { ok: false, reason: '没有可选的路' };
  if (J.trip) return { ok: false, reason: '车队已经在路上' };
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
  logMsg(S, `🧭 ${auto ? '没人选路，车队按侦察兵推荐的第一条走' : '选好了路'}：「${stopOf(S, F.k).n}」是${rl.ic}${rl.n}，${FORK.dn[o.d]}。`, 'story');
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
  if (kind === 'bp') { const w = giveBp(S); if (w) msg = `奇观图纸「${WONDERS[w].n}」`; else kind = 'embers'; }
  if (kind === 'spec') { const m = giveSpec(S, camp); if (m) msg = m; else kind = 'embers'; }
  if (kind === 'embers') { const n = Math.round(FORK.embers * rf); ember(S, n); msg = `余烬 ${n}`; }
  else if (rf > 1) { ember(S, FORK.hardEmbers); msg += `，难走的路多给余烬 ${FORK.hardEmbers}`; }
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
  if (!M[id]) { M[id] = { lvl: 1 }; return `专家「${sp.n}」（${sp.role}）加入了`; }
  M[id].lvl++; return `专家「${sp.n}」升到 ${M[id].lvl} 级`;
}

// ---------- 站点奇遇 ----------
const lack = o => (S, c) => { const m = Object.keys(o).filter(k => (c.stock[k] || 0) < o[k]); return m.length ? `缺${m.map(k => RES[k].n).join('、')}` : ''; };
const hands = n => (S, c) => c.people - n < Math.max(MIN_PEOPLE, 10) ? `人手不够（派 ${n} 个人以后营地里至少要留 10 个）` : '';
const both = (...f) => (S, c) => { for (const g of f) { const r = g(S, c); if (r) return r; } return ''; };
const take = (c, o) => { for (const k in o) c.stock[k] = Math.max(0, (c.stock[k] || 0) - o[k]); };
const give = (c, o) => { for (const k in o) c.stock[k] = (c.stock[k] || 0) + o[k]; };
const txt = (o, sg = '+') => Object.keys(o).map(k => `${RES[k].n} ${sg}${o[k]}`).join(' · ');
const allHope = (S, n) => { for (const c of S.camps) bumpMood(c, n, 0); };
const revealN = (S, c, r) => { revealCircle(S, c.x, c.y + 18, r); rt(S).revealDirty = true; };
const wolfStr = (S, c) => Math.round(raidStrength(S, c, { var: 0.75 }) * 1.3);
const flag = (S, k) => { (S.meta.f13 ||= {})[k] = 1; };
const wolfWin = (S, c) => { flag(S, 'wolfking'); give(c, { game: 300 }); addBuff(S, c, 'loot', 1, DAY_LEN, '狼王倒下了'); bumpMood(c, 5, -2); return { m: '狼王倒在了雪地里。它的皮毛绷在木架上，挂到了熔炉边（装饰「狼王皮」解锁）。生肉 +300，接下来一天打退袭营的战利品翻倍。' }; };
const wolfLose = (S, c) => { const n = Math.min(200, Math.floor(c.stock.food || 0)); take(c, { food: n }); bumpMood(c, -3, 3); return { m: `狼王撞开仓房，叼走了一大块肉，消失在风雪里。熟食 −${n}。` }; };

// 每件奇遇：st 是一段一段；每段 x 是这段的话，o 是选项；g 是「奇遇向导」研究多给的一个选项（都在第一段）
// 选项：t 名字，d 说明，need 不够时返回原因，go 做完返回 { m 结果, nx 下一段, w 过多久出现, away 派出去几个人（下一段出现时回来）}
export const QE = {
  wolfking: { st: [
    { x: '夜里，一头比马还高的白狼在暖圈外转了三圈，雪地上的脚印有脸盆那么大。老猎人说，那是狼王，它在挑今晚从哪儿下口。',
      o: [
        { t: '埋伏起来，等它进圈', d: '箭塔今晚不睡，过一会儿见分晓', go: () => ({ m: '大家把火把熄了一半，箭塔上的人屏住了气。', nx: 1, w: 90 }) },
        { t: '扔给它一扇肉', d: '生肉 −150 · 希望 +2', need: lack({ game: 150 }), go: (S, c) => { take(c, { game: 150 }); bumpMood(c, 2, 0); return { m: '狼王叼起肉，回头看了营地一眼，慢慢走进了风雪里。' }; } },
      ],
      g: { t: '跟着脚印去找狼窝', d: '派 8 个人去 4 分钟', need: hands(8), go: () => ({ m: '老向导带着 8 个人，顺着脚印往山里摸。', nx: 2, w: 240, away: 8 }) } },
    { x: '后半夜，狼王果然来了。它绕开亮着的地方，直奔堆肉的仓房。',
      o: [
        { t: '箭塔放箭', d: (S, c) => `营地防御 ${campDefense(S, c)}，狼王大约 ${wolfStr(S, c)}：防御够就能打倒它`, go: (S, c) => campDefense(S, c) >= wolfStr(S, c) ? wolfWin(S, c) : wolfLose(S, c) },
        { t: '举着火把冲上去', d: '一半对一半：赢了拿狼王皮，输了丢一些熟食', go: (S, c, q) => hash3(S.runSeed, q.k, 77) < 0.5 ? wolfWin(S, c) : wolfLose(S, c) },
      ] },
    { x: '狼窝在一处背风的石缝里，狼王不在。里面堆着它攒了一冬的猎物，还有三只没睁眼的小狼。',
      o: [
        { t: '把猎物都搬回去', d: '生肉 +600', go: (S, c) => { give(c, { game: 600 }); return { m: '8 个人扛着冻肉回来了，够吃好一阵子。' }; } },
        { t: '什么都不动，悄悄离开', d: '希望 +6 · 一天里打退袭营的战利品翻倍', go: (S, c) => { bumpMood(c, 6, 0); addBuff(S, c, 'loot', 1, DAY_LEN, '狼王的回礼'); return { m: '大家什么都没拿。第二天清早，营地门口放着一头冻鹿。' }; } },
      ] },
  ] },
  undercity: { st: [
    { x: '侦察兵趴在冰湖上往下看：冰底下有屋顶、街道和一座钟楼，一整座城被冻在了冰里。',
      o: [
        { t: '派 10 个人凿冰下去', d: '10 个人去 10 分钟', need: hands(10), go: () => ({ m: '十个人带着冰镐和绳子下去了。', nx: 1, w: 600, away: 10 }) },
        { t: '在冰面上开个洞看看', d: '古代构件 +30', go: (S, c) => { give(c, { part: 30 }); return { m: '从洞口勾上来几块刻着花纹的金属。' }; } },
      ],
      g: { t: '请老向导带路', d: '他认得路：只要 5 个人去 5 分钟', need: hands(5), go: () => ({ m: '老向导说他小时候听过这座城的故事，带着 5 个人下去了。', nx: 1, w: 300, away: 5 }) } },
    { x: '冰下的城比想象的大。灯油只够再撑一会儿，只来得及带走一样东西。',
      o: [
        { t: '拆古代构件', d: '古代构件 +120', go: (S, c) => { give(c, { part: 120 }); return { m: '雪橇上堆满了古城的零件。' }; } },
        { t: '去钟楼里找设计图', d: '一张奇观图纸（都有了就换成古代构件 120）', go: (S, c) => { const w = giveBp(S, 1); if (w) return { m: `钟楼顶上压着一卷图纸：是「${WONDERS[w].n}」的图纸！` }; give(c, { part: 120 }); return { m: '图纸都已经有了，大家顺手拆回了 120 件古代构件。' }; } },
      ] },
  ] },
  geyser: { st: [
    { x: '营地边上的雪地裂开一道口子，喷出一股冒白汽的热泉，周围的雪眨眼就化了。',
      o: [
        { t: '围着它取暖', d: '这座营地体感 +5° · 一天', go: (S, c) => { addBuff(S, c, 'heat', 5, DAY_LEN, '地热喷发'); return { m: '大家把被褥都搬到了热泉边上。' }; } },
        { t: '驯服它', d: '钢材 −80 · 10 个人去 5 分钟', need: both(lack({ steel: 80 }), hands(10)), go: (S, c) => { take(c, { steel: 80 }); return { m: '十个人扛着钢管去接热泉。', nx: 1, w: 300, away: 10 }; } },
      ],
      g: { t: '顺着热气找源头', d: '6 个人去 3 分钟，揭开周围的迷雾', need: hands(6), go: (S, c) => { revealN(S, c, 12); return { m: '热气是从北边的山脚下冒出来的。', nx: 1, w: 180, away: 6 }; } } },
    { x: '管子接好了，阀门一拧，热泉稳稳地往外冒热气。',
      o: [
        { t: '修成一座地热井', d: '这座营地能免费建一座地热井（不是地热谷也行）', go: (S, c) => { (c.freeB ||= {}).geowell = (c.freeB.geowell || 0) + 1; return { m: '热泉口留好了：在建造菜单里能免费建一座地热井。' }; } },
        { t: '把热气接进熔炉', d: '这座营地燃料消耗 −20% · 两天', go: (S, c) => { addBuff(S, c, 'fuel', -0.2, DAY_LEN * 2, '地热接进熔炉'); return { m: '熔炉烧得更省了。' }; } },
      ] },
  ] },
  whale: { st: [
    { x: '冰原上鼓起一座灰色的小山。走近了才看清，是一头冻在冰里的巨鲸，比熔炉还长。',
      o: [
        { t: '全营地出动切肉', d: '20 个人去 8 分钟', need: hands(20), go: () => ({ m: '二十个人拖着锯子和雪橇出发了。', nx: 1, w: 480, away: 20 }) },
        { t: '切能切到的', d: '生肉 +400', go: (S, c) => { give(c, { game: 400 }); return { m: '露在外面的那一截切下来，也有小山那么一堆。' }; } },
      ],
      g: { t: '老向导教大家怎么下刀', d: '只要 10 个人去 8 分钟', need: hands(10), go: () => ({ m: '老向导年轻时在海边住过，知道从哪儿下刀最省力。', nx: 1, w: 480, away: 10 }) } },
    { x: '鲸肉堆成了小山，鲸油也装了好几桶。雪橇只拉得动一样。',
      o: [
        { t: '把肉都拉回来', d: '生肉 +2000', go: (S, c) => { give(c, { game: 2000 }); return { m: '冻鲸肉塞满了仓房，厨房要忙好几天了。' }; } },
        { t: '把鲸油拉回来烧', d: '煤 +800（鲸油顶煤烧）', go: (S, c) => { give(c, { coal: 800 }); return { m: '鲸油倒进熔炉，火苗蹿得老高。' }; } },
      ] },
  ] },
  aurora: { st: [
    { x: '天上的极光像帘子一样垂到雪地上，罗盘乱转，工程站的仪器却亮得出奇。',
      o: [
        { t: '工程站通宵记录', d: '研究速度 ×2 · 一天', go: S => { gBuffAdd(S, 'res', 1, DAY_LEN, '极光风暴'); return { m: '工程站的灯亮了一整夜。', nx: 1, w: DAY_LEN }; } },
        { t: '全营地出来看', d: '所有营地希望 +8', go: S => { allHope(S, 8); return { m: '大人孩子都跑到雪地上，仰着头看了半夜。' }; } },
      ],
      g: { t: '把极光的光引进熔炉', d: '研究速度 ×2 一天，所有营地希望 +4', go: S => { gBuffAdd(S, 'res', 1, DAY_LEN, '极光风暴'); allHope(S, 4); return { m: '熔炉的火苗染成了绿色，工程站的仪器也跟着亮。', nx: 1, w: DAY_LEN }; } } },
    { x: '极光散了。记下来的东西堆了一桌子，有一半谁也看不懂。',
      o: [
        { t: '整理成图纸', d: '研究点 +300', go: S => { bankPts(S, 300); return { m: '工程师们熬了两夜，整理出一摞图纸。' }; } },
        { t: '刻在熔炉边的石头上', d: '这座营地希望 +6', go: (S, c) => { bumpMood(c, 6, 0); return { m: '石头上刻满了弯弯曲曲的光带，路过的人都要看两眼。' }; } },
      ] },
  ] },
  caravan: { st: [
    { x: '风雪里传来一串铃铛声：一支商队迷了路，拉车的雪牛冻得直打哆嗦。',
      o: [
        { t: '派人把他们领回来', d: '熟食 −60 · 8 个人去 4 分钟', need: both(lack({ food: 60 }), hands(8)), go: (S, c) => { take(c, { food: 60 }); return { m: '八个人背着热汤出发了。', nx: 1, w: 240, away: 8 }; } },
        { t: '远远给他们指路', d: '余烬 +5', go: S => { ember(S, 5); return { m: '商队朝着火光的方向拐了过去，铃铛声越来越远。' }; } },
      ],
      g: { t: '点起信号火，让他们自己找过来', d: '木材 −100，不用派人', need: lack({ wood: 100 }), go: (S, c) => { take(c, { wood: 100 }); return { m: '一堆大火在营地北边烧起来。', nx: 1, w: 240 }; } } },
    { x: '商队的人暖过来了。领队说他们是北方商会的，欠营地一个人情。',
      o: [
        { t: '请他们在商会里说句话', d: '商会收货价 +20% · 一天', go: S => { gBuffAdd(S, 'guild', 0.2, DAY_LEN, '商队的人情'); return { m: '领队拍着胸脯说，这一天商会收你们的货多给两成。' }; } },
        { t: '换一车货', d: txt({ steel: 150, alloy: 60, battery: 40 }), go: (S, c) => { give(c, { steel: 150, alloy: 60, battery: 40 }); return { m: '商队卸下一车货当谢礼。' }; } },
      ] },
  ] },
  sleepers: { st: [
    { x: '冰洞深处躺着十几个人，裹着厚厚的毛毡，胸口还在微微起伏：他们在冬眠。',
      o: [
        { t: '抬回暖圈', d: '熟食 −120 · 8 个人去 3 分钟', need: both(lack({ food: 120 }), hands(8)), go: (S, c) => { take(c, { food: 120 }); return { m: '八个人用雪橇把冬眠的人一个个拉了回来。', nx: 1, w: 180, away: 8 }; } },
        { t: '封好洞口，留下记号', d: '希望 +3', go: (S, c) => { bumpMood(c, 3, 0); return { m: '洞口用冰砖封好，插上了一面旗子。' }; } },
      ],
      g: { t: '用熔炉的热气慢慢唤醒他们', d: '煤 −150，不用派人', need: lack({ coal: 150 }), go: (S, c) => { take(c, { coal: 150 }); return { m: '一根长管子把熔炉的热气送进了冰洞。', nx: 1, w: 180 }; } } },
    { x: '冬眠的人一个个醒了，饿得说不出话。领头的老人说，他们本来是要往南走的。',
      o: [
        { t: '请他们留下', d: '+12 人', go: (S, c) => { const a = addPeople(S, c, 12); return { m: `十二个人留了下来${a && a.wait ? `，床位不够，${a.wait} 人先在窝棚里等` : ''}。` }; } },
        { t: '送他们往南走', d: '余烬 +12', go: S => { ember(S, 12); return { m: '他们带着干粮往南走了，临走前把一袋余烬塞给了守火人。' }; } },
      ] },
  ] },
  starfall: { st: [
    { x: '半夜一道火光划过天空，落在营地北边，砸出一个还在冒烟的大坑。',
      o: [
        { t: '趁热去挖', d: '10 个人去 5 分钟（坑里还烫，可能有人烫伤）', need: hands(10), go: (S, c) => { c.sick = (c.sick || 0) + 2; return { m: '十个人冒着热气下了坑，两个人手上烫起了泡。', nx: 1, w: 300, away: 10 }; } },
        { t: '等它凉了再说', d: '等半天', go: () => ({ m: '大家远远围着看，等坑里的烟散了。', nx: 1, w: DAY_LEN / 2 }) },
      ],
      g: { t: '先拿雪把坑填上再挖', d: '10 个人去 5 分钟，不会烫伤人', need: hands(10), go: () => ({ m: '雪一铲铲倒进坑里，滋滋地冒白汽。', nx: 1, w: 300, away: 10 }) } },
    { x: '坑底躺着一块拳头大的石头，发着蓝光，捧在手里还是温的。',
      o: [
        { t: '敲碎了带回去', d: '星核 +12', go: (S, c) => { give(c, { starcore: 12 }); return { m: '一锤下去，碎成了十二块星核。' }; } },
        { t: '整块供在熔炉边上', d: '这座营地希望 +8 · 余烬 +10', go: (S, c) => { bumpMood(c, 8, 0); ember(S, 10); return { m: '发光的石头摆在熔炉边，夜里像一盏小灯。' }; } },
      ] },
  ] },
  wreck: { st: [
    { x: '一艘破冰船冻在冰湖中间，船身还完好，锅炉上结了一层红锈。',
      o: [
        { t: '拆零件', d: '钢材 +200 · 古代构件 +30', go: (S, c) => { give(c, { steel: 200, part: 30 }); return { m: '船壳一块块撬下来，雪橇拉了好几趟。' }; } },
        { t: '把它修好', d: '钢材 −120 · 蒸汽机 −6 · 8 个人去 6 分钟', need: both(lack({ steel: 120, engine: 6 }), hands(8)), go: (S, c) => { take(c, { steel: 120, engine: 6 }); return { m: '八个人钻进了锅炉房。', nx: 1, w: 360, away: 8 }; } },
      ],
      g: { t: '翻翻船长室', d: '揭开北边一大片迷雾 · 研究点 +120', go: (S, c) => { revealN(S, c, 16); bankPts(S, 120); return { m: '船长的航海图上，画着北边的冰湖和山口。' }; } } },
    { x: '锅炉重新冒烟了！破冰船突突地开回了营地边上。',
      o: [
        { t: '留着当发电站', d: '这座营地燃料消耗 −15% · 两天', go: (S, c) => { addBuff(S, c, 'fuel', -0.15, DAY_LEN * 2, '破冰船的锅炉'); return { m: '船上的锅炉帮熔炉分担了一部分活。' }; } },
        { t: '拆了换成好零件', d: '古代构件 +80 · 齿轮 +120', go: (S, c) => { give(c, { part: 80, gear: 120 }); return { m: '修好的零件拆下来，个个都能用。' }; } },
      ] },
  ] },
  hermit: { st: [
    { x: '一个老人住在雪窝子里，胡子上全是冰碴。他说他在这儿等了四十年，就为了等往北走的人。',
      o: [
        { t: '请他讲讲北边', d: '揭开北边一片迷雾', go: (S, c) => { revealN(S, c, 10); return { m: '老人用手指在雪上画了一张地图。', nx: 1, w: 120 }; } },
        { t: '送他些吃的', d: '熟食 −40 · 希望 +2', need: lack({ food: 40 }), go: (S, c) => { take(c, { food: 40 }); bumpMood(c, 2, 0); return { m: '老人接过热汤，手抖得厉害。', nx: 1, w: 120 }; } },
      ],
      g: { t: '请他到熔炉边坐坐', d: '熟食 −40，他会多讲一些', need: lack({ food: 40 }), go: (S, c) => { take(c, { food: 40 }); return { m: '老人在熔炉边坐下，烤着手，话匣子打开了。', nx: 2, w: 120 }; } } },
    { x: '老人从怀里摸出一卷发黄的笔记，说是他年轻时一路记下的。',
      o: [
        { t: '收下笔记', d: '研究点 +200', go: S => { bankPts(S, 200); return { m: '笔记里记着北边每一站的矿和风。' }; } },
        { t: '请他留下来', d: '一位专家（都请到了就换成余烬 15）', go: (S, c) => { const m = giveSpec(S, c); if (m) return { m: `老人认识一位能人：${m}。` }; ember(S, 15); return { m: '老人笑着摇头，塞给守火人一袋余烬。' }; } },
      ] },
    { x: '老人在火边坐了一整夜，把北边每一站的风雪、狼群和冰湖都讲了一遍。',
      o: [
        { t: '把他讲的都记下来', d: '研究点 +200 · 一位专家', go: (S, c) => { bankPts(S, 200); const m = giveSpec(S, c); if (!m) ember(S, 15); return { m: `记了满满一本${m ? `，还请来了帮手：${m}` : ''}。` }; } },
        { t: '请他给孩子们讲故事', d: '所有营地希望 +6', go: S => { allHope(S, 6); return { m: '孩子们围着老人，听到半夜都不肯睡。' }; } },
      ] },
  ] },
  stormeye: { st: [
    { x: '侦察兵跑回来报信：一团风暴正朝营地压过来，可风暴正中间是平静的，连雪都不下。',
      o: [
        { t: '全营地躲进屋里', d: '木材 −200 多烧一阵，稳稳当当', need: lack({ wood: 200 }), go: (S, c) => { take(c, { wood: 200 }); return { m: '风暴从头顶滚了过去，屋里的人一夜没睡踏实。' }; } },
        { t: '趁风暴眼抢工', d: '这座营地产量 +50% · 10 分钟，之后风暴的尾巴会扫过来', go: (S, c) => { addBuff(S, c, 'prod', 0.5, 600, '风暴之眼'); return { m: '趁着这片平静，大家一刻不停地干活。', nx: 1, w: 600 }; } },
      ],
      g: { t: '跟着风暴眼往北走一段', d: '揭开北边一大片迷雾，不耽误干活', go: (S, c) => { revealN(S, c, 18); return { m: '侦察兵跟着风暴眼走了老远，把北边看了个清楚。' }; } } },
    { x: '风暴的尾巴扫过来了，屋顶上的雪板被掀得哗哗响。',
      o: [
        { t: '拿木板加固', d: '木板 −150', need: lack({ plank: 150 }), go: (S, c) => { take(c, { plank: 150 }); return { m: '屋顶钉得结结实实，风暴过去了。' }; } },
        { t: '硬扛过去', d: '这座营地希望 −4，别的没什么损失', go: (S, c) => { bumpMood(c, -4, 2); return { m: '掀了几块雪板，吓哭了几个孩子，好在人都没事。' }; } },
      ] },
  ] },
  altar: { st: [
    { x: '雪下挖出一座石头火坛，坛底的炭居然还是温的，像在等人来添一把火。',
      o: [
        { t: '用余烬重新点燃它', d: '余烬 −15', need: S => (S.meta.embers || 0) < 15 ? '余烬不够' : '', go: S => { ember(S, -15); return { m: '一把余烬撒进去，火坛轰地亮了。', nx: 1, w: 60 }; } },
        { t: '把它搬回营地', d: '10 个人去 4 分钟', need: hands(10), go: () => ({ m: '十个人用雪橇拖着火坛往回走。', nx: 2, w: 240, away: 10 }) },
      ],
      g: { t: '在火坛边守一夜', d: '什么也不花，等半天', go: () => ({ m: '守火人在坛边坐了一夜，天亮时炭火自己旺了起来。', nx: 1, w: DAY_LEN / 2 }) } },
    { x: '火坛里窜起一团金色的火苗，烧得又稳又安静。',
      o: [
        { t: '把火引进熔炉', d: '这座营地燃料消耗 −20% · 两天', go: (S, c) => { addBuff(S, c, 'fuel', -0.2, DAY_LEN * 2, '金色的火'); return { m: '熔炉里多了一缕金色的火苗。' }; } },
        { t: '分给每一座营地', d: '所有营地希望 +5', go: S => { allHope(S, 5); return { m: '金色的火种送到了每一座营地。' }; } },
      ] },
    { x: '火坛立在了熔炉旁边。孩子们围着它，说里面能看见以前的人。',
      o: [
        { t: '就让它立在那儿', d: '这座营地希望 +6', go: (S, c) => { bumpMood(c, 6, 0); return { m: '火坛成了营地里最热闹的地方。' }; } },
        { t: '在坛前刻下这一站的名字', d: '余烬 +8 · 希望 +3', go: (S, c) => { ember(S, 8); bumpMood(c, 3, 0); return { m: '石头上又多了一个名字。' }; } },
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
  const q = qyPending(S); if (!q) return { ok: false, reason: '没有要拿主意的奇遇' };
  const o = optsOf(S, q)[i]; if (!o) return { ok: false, reason: '没有这个选项' };
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
  if (!quiet) logMsg(S, `${QY[q.id].ic} 去「${QY[q.id].n}」的 ${n} 个人回来了。`, 'good');
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
  logMsg(S, `${QY[q.id].ic}「${QY[q.id].n}」没来得及做完，车队就出发了。`);
}
// 派出去的人数（占着床位，不干活）
export const qyAway = (S, camp) => S.qy && S.qy.away && S.qy.camp === camp.id ? S.qy.away : 0;
// 两秒一次：派出去的人到点回来；新的一段出现时提醒一次（离线追赶时不提醒）
export function qyStep(S) {
  const q = S.qy; if (!q) return;
  if (q.away && S.t >= q.at) qyBack(S, q);
  if (q.done || q.k !== journeyOf(S).stage || S.t < q.at || q.told === q.st || rt(S).offline) return;
  q.told = q.st;
  logMsg(S, `${QY[q.id].ic} 奇遇「${QY[q.id].n}」${q.st ? '有了下文' : '：' + QY[q.id].d}`, 'story', { act: 'qyopen', label: '去看看' });
  rt(S).fx.push({ kind: 'qy', id: q.id });
}
