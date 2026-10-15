// 寒烬北行 · 产线：主线和支线、升星、累计产量里程碑、规划器的配比、老向导
// 一条产线 = 一种材料 + 一路给它供料的上游建筑。主线由这一程给，支线自己立
import { BLD, RES, RES_KEYS, CHAPTERS, SPOTS, SPOT_KEYS } from './data.js';
import {
  rt, dirty, getCamp, logMsg, prodRate, rateGoals, holdOf, popCap, maxWorkers, heatRadius, levelMul,
  nextRaid, raidPrep, idleLabor, unlocked, checkPlace, HOLD, buildCost, canAfford, pay, queueBuild, QUEUE_MAX, ORE_URGENT, gatherTypeFor,
  servedSpots, spotLeft, moveBlock, prodBonus, getB, blocksOre,
} from './sim.js';
import { getWorld, idx, W } from './worldgen.js';
import { journeyOf, mainCamp, stopOf, departGate, gateFlvl, depotAuto } from './journey.js';

export const STAR_T = [600, 1800, 5400];        // 稳住 10、30、90 分钟（游戏时间）升一颗星
export const STAR_PROD = [0, 0.15, 0.15, 0.45]; // 一星 +15%，二星省人，三星再 +30%
export const MILE = [1000, 10000, 100000], MILE_PROD = 0.05, MILE_EMB = [3, 8, 20];

// ---------- 链条 ----------
const PRODUCERS = {};
for (const t in BLD) for (const k in BLD[t].out || {}) (PRODUCERS[k] || (PRODUCERS[k] = [])).push(t);
export function producersOf(r) { return PRODUCERS[r] || []; }
const LT = {};
export function lineTypes(r) {
  if (LT[r]) return LT[r];
  const set = new Set(), seen = new Set();
  const walk = k => { if (seen.has(k)) return; seen.add(k); for (const t of producersOf(k)) { set.add(t); for (const i in BLD[t].in || {}) walk(i); } };
  walk(r);
  return (LT[r] = set);
}
// 能立成产线的材料：有建筑产出的（熟食、木材这些也算）
export const LINE_RES = RES_KEYS.filter(k => producersOf(k).length);

// ---------- 产线 ----------
export function plinesOf(S) { return S.plines || (S.plines = []); }
export const sideMax = S => 3 + journeyOf(S).legs.length;
export const sideCount = S => plinesOf(S).filter(l => !l.main).length;
// 合格线：大约两座 1 级建筑的产量，越往北越高——免得设个 1/分钟白拿星
export function qualFloor(S, r) {
  const t = producersOf(r)[0]; if (!t) return 1;
  return Math.max(1, Math.ceil(2 * BLD[t].out[r] * (1 + 0.25 * journeyOf(S).stage)));
}
export function lineOf(S, r) { return plinesOf(S).find(l => l.r === r) || null; }
export function addPLine(S, r, n) {
  if (!producersOf(r).length) return { ok: false, reason: '这种材料没有建筑能产' };
  if (lineOf(S, r)) return { ok: false, reason: '这种材料已经有一条线了' };
  if (sideCount(S) >= sideMax(S)) return { ok: false, reason: `支线最多 ${sideMax(S)} 条（每走完一程多 1 条）` };
  const f = qualFloor(S, r);
  n = Math.max(f, Math.round(n || f));
  const L = plinesOf(S);
  L.push({ id: (S.nextId++), r, n, main: false, st: 0, star: 0, t0: S.t });
  logMsg(S, `立了一条${RES[r].n}支线：目标 ${n}/分钟。速度在目标以上稳住 10 分钟升一星。`, 'good');
  return { ok: true };
}
export function setPLine(S, id, n) {
  const l = plinesOf(S).find(x => x.id === id); if (!l) return { ok: false };
  const f = l.main ? l.n0 || l.n : qualFloor(S, l.r);
  if (n < f) return { ok: false, reason: `不能低于 ${f}/分钟` };
  l.n = Math.round(n * 10) / 10;
  return { ok: true };
}
export function dropPLine(S, id) {
  const l = plinesOf(S).find(x => x.id === id);
  if (!l || l.main) return { ok: false, reason: '主线不能撤' };
  S.plines = plinesOf(S).filter(x => x.id !== id);
  dirty(S);
  return { ok: true };
}
// 章节里的产能目标就是主线：开始一章时自动立起来（同种材料的支线直接升成主线，星留着）
function syncMain(S) {
  for (const i of S.founded) {
    const ch = CHAPTERS[i]; if (!ch) continue;
    ch.tasks.forEach((q, k) => {
      if (q.k !== 'rate') return;
      const key = `c${i}:${k}`;
      if (plinesOf(S).some(l => l.key === key)) return;
      const l = lineOf(S, q.r);
      if (l) { l.main = true; l.key = key; l.n = Math.max(l.n, q.n); l.n0 = q.n; l.stage = i; return; }
      plinesOf(S).push({ id: S.nextId++, r: q.r, n: q.n, n0: q.n, main: true, key, stage: i, st: 0, star: 0, t0: S.t });
    });
  }
}
// 每种建筑现在挂几颗星（同时在几条线上，按最高的算）
function typeStars(S) {
  const R = rt(S), L = plinesOf(S), sig = L.map(l => l.r + l.star).join(',');
  if (R.tsSig === sig) return R.ts;
  const ts = {};
  for (const l of L) if (l.star) for (const t of lineTypes(l.r)) ts[t] = Math.max(ts[t] || 0, l.star);
  R.tsSig = sig; R.ts = ts;
  return ts;
}
export function bStar(S, b) { return typeStars(S)[b.type] || 0; }
// 二星：每座建筑少要 1 个工人（最少留 1 个）
export function bMax(S, b) { const m = maxWorkers(b.type, b.lvl); return m && bStar(S, b) >= 2 ? Math.max(1, m - 1) : m; }
// 产线带来的产量加成：星级 + 累计产量里程碑
export function lineProd(S, b) {
  const d = BLD[b.type]; let v = STAR_PROD[bStar(S, b)] || 0;
  if (d.out) { let m = 0; for (const k in d.out) m = Math.max(m, mileOf(S, k)); v += m * MILE_PROD; }
  return v;
}
export function mileOf(S, k) { return (S.mile && S.mile[k]) || 0; }

export function linesTick(S, dt) {
  syncMain(S);
  for (const l of plinesOf(S)) {
    const on = prodRate(S, l.r) >= l.n - 1e-9;
    l.on = on;
    if (!on || l.star >= 3) continue;
    l.st += dt;
    if (l.st >= STAR_T[l.star]) {
      l.star++;
      dirty(S);
      const fx = ['', `产量 +15%`, '每座建筑少要 1 个工人', '产量再 +30%'][l.star];
      logMsg(S, `⭐ ${RES[l.r].n}${l.main ? '主线' : '支线'}升到 ${'★'.repeat(l.star)}：这条线上的建筑${fx}。`, 'good', { act: 'plan', arg: l.r, label: '看产线' });
      rt(S).fx.push({ kind: 'star', r: l.r, star: l.star });
    }
  }
  // 累计产量里程碑：每种材料一共做出 1 千、1 万、10 万个
  const M = S.mile || (S.mile = {});
  for (const k in S.stats.prod) {
    let lv = M[k] || 0;
    while (lv < MILE.length && S.stats.prod[k] >= MILE[lv]) {
      lv++; M[k] = lv;
      const e = MILE_EMB[lv - 1];
      S.meta.embers += e; S.meta.emberTotal = (S.meta.emberTotal || 0) + e;
      logMsg(S, `🎆 ${RES[k].n}一共做出了 ${fmtBig(MILE[lv - 1])} 个：以后这种材料产量永久 +5%，再得 ${e} 点余烬。`, 'good');
      rt(S).fx.push({ kind: 'mile', r: k, lv });
      dirty(S);
    }
  }
}
export function fmtBig(n) { return n >= 1e4 ? (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + ' 万' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + ' 千' : String(Math.round(n)); }

// ---------- 规划器：一条线每一环现在产多少、目标要多少、差多少 ----------
export function planLine(S, r, n) {
  const need = {}, depth = {}, via = {};
  const walk = (k, q, d, from) => {
    need[k] = (need[k] || 0) + q;
    if (depth[k] == null || d < depth[k]) { depth[k] = d; via[k] = from; }
    const t = producersOf(k)[0]; if (!t || !BLD[t].in) return;
    for (const i in BLD[t].in) walk(i, q * BLD[t].in[i] / BLD[t].out[k], d + 1, k);
  };
  walk(r, n, 0, null);
  const R = rt(S), bs = {};
  for (const b of S.buildings) (bs[b.type] || (bs[b.type] = [])).push(b);
  const nodes = Object.keys(need).sort((a, b) => depth[a] - depth[b]).map(k => {
    const types = producersOf(k), list = types.flatMap(t => bs[t] || []);
    const lvl = list.length ? Math.round(list.reduce((a, b) => a + b.lvl, 0) / list.length) : 1;
    const t = types[0], one = t ? BLD[t].out[k] * levelMul(lvl) : 0; // 一座这个等级、满员的建筑每分钟产多少（不算加成）
    const prod = prodRate(S, k), q = need[k];
    const workers = list.reduce((a, b) => a + b.workers, 0);
    const stat = {};
    for (const b of list) { const s = (R.b[b.id] || {}).status; if (s) stat[s] = (stat[s] || 0) + 1; }
    return { k, need: Math.round(q * 10) / 10, prod: Math.round(prod * 10) / 10, gap: Math.max(0, q - prod), ratio: q > 0 ? prod / q : 1, depth: depth[k], via: via[k], type: t, count: list.length, lvl, one, workers, stat, ids: list.map(b => b.id) };
  });
  // 最卡的那一环：从这条线的成品往上找，原料比成品更缺就往上走
  const by = Object.fromEntries(nodes.map(x => [x.k, x]));
  let cur = nodes[0];
  if (cur.ratio < 0.999) {
    for (let guard = 0; guard < 8; guard++) {
      const t = cur.type; if (!t || !BLD[t].in) break;
      const ins = Object.keys(BLD[t].in).map(k => by[k]).filter(Boolean).sort((a, b) => a.ratio - b.ratio);
      const worst = ins[0];
      const starved = Object.keys(cur.stat).some(s => s.startsWith('缺'));
      // 建筑自己说缺哪样，就先看那样：总产量够、却被别的建筑吃掉了，也算卡在这里
      const named = ins.filter(x => cur.stat['缺' + RES[x.k].n]).sort((a, b) => (cur.stat['缺' + RES[b.k].n] || 0) - (cur.stat['缺' + RES[a.k].n] || 0))[0];
      if (named) { named.from = cur.k; cur = named; if (named.ratio >= 1) { named.comp = true; break; } continue; }
      if (worst && (worst.ratio < cur.ratio - 0.05 || (starved && worst.ratio < 1))) { worst.from = cur.k; cur = worst; } else break;
    }
  } else cur = null;
  if (cur) cur.worst = true;
  // 配比提示：上一环一座建筑吃多少，这一环大约要几座
  for (const x of nodes) {
    if (!x.via) continue;
    const up = by[x.via], ut = up.type; if (!ut || !x.type) continue;
    const eat = BLD[ut].in[x.k] * levelMul(up.lvl), give = BLD[x.type].out[x.k] * levelMul(x.lvl);
    x.hint = `1 座 ${up.lvl} 级${BLD[ut].n}每分钟吃 ${fmtR(eat)} 个${RES[x.k].n}，大约要 ${fmtR(eat / give)} 座 ${x.lvl} 级${BLD[x.type].n}`;
  }
  const main = mainCamp(S);
  const people = nodes.reduce((a, x) => a + x.workers, 0);
  return { r, n, nodes, worst: cur, people, cap: popCap(S, main), pop: main.people, idle: idleLabor(S, main), free: freeLand(S, main), rate: prodRate(S, r) };
}
const fmtR = v => v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
// 供热圈里还能放几座 2×2 的建筑（粗算）
export function freeLand(S, camp) {
  const R = rt(S), key = `${camp.id}:${heatRadius(S, camp)}:${S.buildings.length}:${R.revealN || 0}`;
  if (R.land && R.land.key === key) return R.land.n;
  const r = heatRadius(S, camp), taken = new Set();
  let n = 0;
  for (let y = Math.floor(camp.y - r); y <= camp.y + r; y += 2) for (let x = Math.floor(camp.x - r); x <= camp.x + r; x += 2) {
    if (taken.has(x + ',' + y)) continue;
    const ck = checkPlace(S, 'sawmill', x, y);
    if (ck.ok || ck.soft) { if (ck.camp === camp.id) n++; }
  }
  R.land = { key, n };
  return n;
}

// 采集建筑在供热圈里还有没有能挖到矿的位置（矿点旁边被别的建筑占了、太冷、地不平都算没有）
export function gatherRoom(S, camp, type) {
  const R = rt(S), r = heatRadius(S, camp), key = `${camp.id}:${type}:${r}:${S.buildings.length}:${S.lay || 0}:${R.revealN || 0}`;
  const C = R.groom || (R.groom = {});
  if (C[type] && C[type].key === key) return C[type].ok;
  let ok = false;
  for (let y = Math.floor(camp.y - r); y <= camp.y + r && !ok; y++) for (let x = Math.floor(camp.x - r); x <= camp.x + r; x++) { const q = checkPlace(S, type, x, y); if (q.ok && q.spots > 0) { ok = true; break; } }
  C[type] = { key, ok };
  return ok;
}

// ---------- 规划手感（第十三版）：摆放之前就算出这座建筑对产线的影响 ----------
// 预演：在 (x, y) 放一座 type，产线速度从多少变成多少、上游原料够不够、人手够不够。ck 是 checkPlace 的结果
export function placePreview(S, type, x, y, ck) {
  const d = BLD[type]; if (!d || !d.out || !ck || ck.camp == null || ck.camp < 0) return null;
  const camp = getCamp(S, ck.camp); if (!camp) return null;
  const r = Object.keys(d.out)[0];
  const fake = { id: -1, type, lvl: 1, camp: camp.id, x, y, workers: 0 };
  const bonus = prodBonus(S, fake, camp, ck.syn || 0, 0).sum;
  const w = maxWorkers(type, 1), idle = Math.max(0, idleLabor(S, camp));
  const staff = w ? Math.min(1, idle / w) : 1;
  let full = d.out[r] * (1 + bonus);                  // 满员时一分钟产多少
  if (d.gather && !ck.spots) full = 0;
  // 上游：这座满员要吃多少原料，营地里现在有没有余量
  const flow = (rt(S).c[camp.id] || {}).flow || {}, ins = [];
  let feed = 1;
  for (const k in d.in || {}) {
    const need = d.in[k] * (1 + bonus) * staff, f = flow[k], spare = f ? Math.max(0, f.p - f.want) : 0;
    ins.push({ k, need, spare });
    if (need > 0) feed = Math.min(feed, spare / need);
  }
  const add = full * staff * Math.min(1, feed);
  const line = lineOf(S, r), goal = rateGoals(S).find(g => g.r === r);
  const before = prodRate(S, r);
  return { r, before, after: before + add, add, full, target: goal ? goal.n : line ? line.n : null, named: !!(line || goal), ins, w, idle, staff };
}
// 挪的时候：这一座自己的产量会怎么变（联动加成换了）
export function movePreview(S, id, x, y, ck) {
  const b = getB(S, id); if (!b || !BLD[b.type].out || !ck || !ck.ok) return null;
  const camp = getCamp(S, b.camp), r = Object.keys(BLD[b.type].out)[0], now = ((rt(S).b[b.id] || {}).rate || {})[r] || 0;
  const b0 = prodBonus(S, b, camp).sum, b1 = prodBonus(S, b, camp, ck.syn || 0).sum;
  return { r, now, after: now * (1 + b1) / Math.max(0.01, 1 + b0), syn0: rt(S).adj.get(b.id) || 0, syn1: ck.syn || 0 };
}
// 推荐位置：营地暖圈里挑最多 3 处（离仓库近、有联动、采集建筑够得着资源点、不挡矿、少清树）
export function suggestSpots(S, type, cid, n = 3) {
  const camp = getCamp(S, cid), d = BLD[type]; if (!camp || !d || type === 'furnace') return [];
  const R = rt(S), key = `${type}:${cid}:${S.buildings.length}:${S.lay || 0}:${(S.queue || []).length}:${R.revealN || 0}`;
  const C = R.sug || (R.sug = {});
  if (C.key === key) return C.v;
  const r = heatRadius(S, camp), s = d.size, cands = [];
  for (let y = Math.floor(camp.y - r - s); y <= camp.y + r; y++) for (let x = Math.floor(camp.x - r - s); x <= camp.x + r; x++) {
    const ck = checkPlace(S, type, x, y);
    if (!(ck.ok || ck.soft) || ck.camp !== cid) continue;
    if (d.gather && !ck.spots) continue;
    const sc = (d.gather ? Math.min(6, ck.spots) * 3 : 0) + (ck.syn || 0) * 2 - (ck.dist || 0) * 0.3 - (ck.clears || 0) * 0.4;
    cands.push({ x, y, s, sc });
  }
  cands.sort((a, b) => b.sc - a.sc);
  const out = [];
  for (const c of cands.slice(0, 24)) {
    if (out.length >= n) break;
    if (out.some(o => Math.abs(o.x - c.x) < s + 1 && Math.abs(o.y - c.y) < s + 1)) continue;
    if (blocksOre(S, type, c.x, c.y, cid).length) continue;
    out.push(c);
  }
  C.key = key; C.v = out;
  return out;
}

// 矿点旁边最挡路的那栋（离一处没人挖的矿最近的非采集建筑）
function blockerOf(S, camp, type) {
  const w = getWorld(S.runSeed), kinds = BLD[type].gather.map(k => SPOT_KEYS.indexOf(k)), r = heatRadius(S, camp), served = servedSpots(S);
  let best = null, bd = 4.5;
  for (let y = Math.floor(camp.y - r); y <= camp.y + r; y++) for (let x = Math.floor(camp.x - r); x <= camp.x + r; x++) {
    if (x < 0 || x >= W || (x + 0.5 - camp.x) ** 2 + (y + 0.5 - camp.y) ** 2 > r * r) continue;
    const i = idx(x, y);
    if (!kinds.includes(w.spot[i]) || served.has(i) || !S.reveal[i] || spotLeft(S, i) <= 0) continue;
    for (const b of S.buildings) {
      if (b.camp !== camp.id || BLD[b.type].gather || b.type === 'furnace' || moveBlock(S, b)) continue;
      const s = BLD[b.type].size, d = Math.hypot(Math.max(b.x - x, 0, x - (b.x + s - 1)), Math.max(b.y - y, 0, y - (b.y + s - 1)));
      if (d < bd) { bd = d; best = b; }
    }
  }
  return best;
}

// ---------- 老向导：一次只说一句，按急事 → 主线卡在哪 → 人手和地盘 → 下一程的方向 ----------
export function advisor(S) {
  const R = rt(S), J = journeyOf(S), main = mainCamp(S);
  if (!main) return null;
  // 急事
  for (const c of S.camps) {
    const cr = R.c[c.id] || {};
    // 补给站自己运转，只在撑不住时说一句
    if (c.depot && !c.manual) { if (c.dWarn) return { pri: 0, kind: 'depot', camp: c.id, text: `补给站「${c.name}」${c.dWarn}：可以临时接手管一下，或者让它熄火换余烬。`, act: 'campgo', arg: c.id }; continue; }
    if (cr.foodNet != null && cr.foodNet < -0.05) {
      const m = (c.stock.food || 0) / -cr.foodNet;
      if (m < 10) return { pri: 0, kind: 'food', camp: c.id, text: `「${c.name}」的熟食只够 ${Math.max(1, Math.floor(m))} 分钟了：多派人去打猎和做饭，或者从别的营地运吃的过来。` };
    }
    if (cr.burnPerMin > 0 && cr.fuelUnits != null && cr.fuelUnits / cr.burnPerMin < 10) return { pri: 0, kind: 'fuel', camp: c.id, text: `「${c.name}」的燃料只够 ${Math.max(1, Math.floor(cr.fuelUnits / cr.burnPerMin))} 分钟了：先保住熔炉，伐木场和煤矿多派人。` };
    if (cr.tH != null && cr.tH < -8 && c.people > 3) return { pri: 0, kind: 'cold', camp: c.id, text: `「${c.name}」太冷了，有人会冻伤：多烧燃料、开超载，或者给帐篷升级保暖。` };
  }
  const nr = nextRaid(S);
  if (nr && nr.in < 300 && !raidPrep(S, nr)) return { pri: 0, kind: 'raid', camp: nr.camp, text: `袭营还有 ${Math.max(1, Math.ceil(nr.in / 60))} 分钟就到「${(getCamp(S, nr.camp) || {}).name}」：点开去备战。`, act: 'raid' };
  if (J.trip && J.trip.road) return { pri: 0, kind: 'road', text: '车队在路上遇到了事，停下来等你拿主意。', act: 'roadopen' };
  if (J.trip && J.trip.hold > 0) return { pri: 1, kind: 'trip', text: `车队停下来歇一会儿（还要 ${Math.ceil(J.trip.hold)} 秒），后面的营地照常运转。`, act: null };
  if (J.trip) return { pri: 1, kind: 'trip', text: J.trip.phase === 'arrive' ? `车队到了「${stopOf(S, J.trip.to).n}」：挑一块平地放下新熔炉。` : `车队正往「${stopOf(S, J.trip.to).n}」走，后面的营地照常运转。`, act: J.trip.phase === 'arrive' ? 'arrive' : null };
  // 矿快挖完了（剩不到 5%，又不是深井）：先说一声
  for (const c of [main, ...S.camps.filter(x => x !== main && !depotAuto(x))]) {
    const ore = (R.c[c.id] || {}).ore || {};
    for (const k in ore) {
      const o = ore[k];
      if (o.frac >= ORE_URGENT || o.deep) continue;
      const t = gatherTypeFor(k);
      return { pri: 1, kind: 'ore', camp: c.id, text: `「${c.name}」暖圈里的${SPOTS[k].n}快挖完了（剩 ${Math.max(0, Math.round(o.frac * 100))}%）：给${BLD[t].n}挖深井，挖完也有三成五的产量；或者去侦察营派勘探队找新矿脉，这次按最低价。`, act: 'spot', arg: o.b };
    }
  }
  // 主线卡在哪
  const g = rateGoals(S).find(x => !x.eternal) || rateGoals(S)[0];
  if (g) {
    const rate = prodRate(S, g.r), h = holdOf(S, g.id);
    if (rate >= g.n - 1e-9) return { pri: 1, kind: 'hold', text: `${RES[g.r].n}线到了 ${fmtR(rate)}/分钟，再稳住 ${fmtS(HOLD - h.p)} 就达标。`, act: 'plan', arg: g.r };
    const P = planLine(S, g.r, g.n), w = P.worst;
    if (w) {
      if (!w.count && w.type && !unlocked(S, w.type)) return { pri: 1, kind: 'line', text: `${RES[g.r].n}线要${RES[w.k].n}，可${BLD[w.type].n}还没解锁：派侦察队往北探，看到更北的纬度就能建。`, act: 'plan', arg: g.r };
      if (!w.count) return { pri: 1, kind: 'line', text: `${RES[g.r].n}线缺一环：还没有${w.type ? BLD[w.type].n : RES[w.k].n}。${RES[w.k].n}要 ${fmtR(w.need)}/分钟，先建一座。`, act: 'plan', arg: g.r };
      const by = P.nodes.find(x => x.k === (w.from || w.via));
      const full = Object.keys(w.stat).find(s => s === '仓库满了');
      if (full) return { pri: 1, kind: 'line', text: `${RES[w.k].n}卡在仓库满了：多建仓库，或者在营地面板里打开「满仓自动兑换」。`, act: 'plan', arg: g.r };
      // 总产量够，却被别的建筑吃掉了
      if (w.comp && by) {
        const eat = {};
        for (const b of S.buildings) { const ir = ((R.b[b.id] || {}).inRate || {})[w.k]; if (ir > 0 && b.type !== by.type) eat[b.type] = (eat[b.type] || 0) + ir; }
        const top = Object.keys(eat).sort((a, b) => eat[b] - eat[a])[0];
        return { pri: 1, kind: 'line', text: `${RES[g.r].n}线卡在${RES[w.k].n}：${RES[w.k].n}一分钟产 ${fmtR(w.prod)}，这条线只要 ${fmtR(w.need)}，可${BLD[by.type].n}分不到${top ? `，大半被${BLD[top].n}吃掉了（${fmtR(eat[top])}/分）。少派几个人去${BLD[top].n}` : '。多产一些'}，${BLD[by.type].n}就能开工。`, act: 'plan', arg: g.r };
      }
      const why = by ? `${BLD[by.type].n}要 ${fmtR(w.need)}/分，${BLD[w.type].n}只供 ${fmtR(w.prod)}/分` : `目标 ${fmtR(w.need)}/分，现在 ${fmtR(w.prod)}/分`;
      let fix = w.workers < w.count * maxWorkers(w.type, w.lvl) ? '先把人派满' : `再建 ${Math.max(1, Math.ceil((w.need - w.prod) / Math.max(0.1, w.one)))} 座，或者升级`;
      // 采集建筑没地方放了：矿点旁边都被占了
      let blk = null;
      if (fix.startsWith('再建') && BLD[w.type].gather && !gatherRoom(S, main, w.type)) {
        blk = blockerOf(S, main, w.type);
        fix = `可${RES[w.k].n}矿点旁边已经放不下${BLD[w.type].n}了（被别的建筑占着，或者在供热圈外）：${blk ? `把矿点旁边的${BLD[blk.type].n}挪开（点它，选「挪位置」，不花材料）` : '把矿点旁边的一两座建筑挪开（点建筑，选「挪位置」）'}，或者升熔炉扩大供热圈，侦察营也能勘探新矿脉`;
      }
      // 没有闲人：这条线上产得太多的一环，可以撤人过来
      if (fix.startsWith('再建') && P.idle < (BLD[w.type].w || 1)) {
        const over = P.nodes.filter(x => x.type && x.workers > 0 && x.ratio > 1.8 && x.k !== g.r).sort((a, b) => b.ratio - a.ratio)[0];
        if (over) fix = `没有闲人了：${BLD[over.type].n}产 ${fmtR(over.prod)}/分，这条线只要 ${fmtR(over.need)}/分，可以从那边撤几个人过来`;
      }
      return { pri: 1, kind: 'line', text: `${RES[g.r].n}线卡在${RES[w.k].n}：${why}。${fix}。`, act: blk ? 'spot' : 'plan', arg: blk ? blk.id : g.r };
    }
  }
  // 人手和地盘
  if (main.people >= popCap(S, main) && !main.depot) return { pri: 2, kind: 'pop', text: `人口满了（${main.people}/${popCap(S, main)}）：升熔炉能多住人，或者让产线升到二星，省出人手。`, act: 'furnace' };
  if (freeLand(S, main) < 2) return { pri: 2, kind: 'land', text: '供热圈里快没地方了：升熔炉扩大供热圈，或者在这一程里开前哨营地。', act: 'furnace' };
  // 下一程的方向
  const gt = departGate(S);
  if (gt) {
    const miss = gt.items.find(i => !i.ok);
    if (!miss) return { pri: 3, kind: 'go', text: `北迁的四件事都备好了：打开北迁面板，往「${gt.next.n}」出发。`, act: 'migrate' };
    if (miss.id === 'route') return { pri: 3, kind: 'route', text: `往「${gt.next.n}」的路还差约 ${gt.route.gap} 格：派侦察队往北探，车队只能走探开的路。`, act: 'scout' };
    if (miss.id === 'flvl') return { pri: 3, kind: 'flvl', text: `熔炉要升到 ${gateFlvl(J.stage)} 级才能北迁（现在 ${miss.cur} 级）。`, act: 'furnace' };
    if (miss.id === 'car') {
      // 哪个营地的雪橇棚都能造车（老营地的也行），主营地的优先
      const P = gt.plan, sheds = S.buildings.filter(b => b.type === 'sledshed'), shed = sheds.find(b => b.camp === main.id) || sheds[0];
      if (!P.roomOk && !shed) return { pri: 3, kind: 'car', text: `车队还缺车：先在主营地建一座雪橇棚，用木材和木板造雪橇（${miss.sub}）。`, act: 'place', arg: 'sledshed' };
      if (!P.roomOk) return { pri: 3, kind: 'car', text: `车队还没备好：${miss.sub}。去${shed.camp === main.id ? '' : `「${getCamp(S, shed.camp).name}」的`}雪橇棚多造几架。`, act: 'spot', arg: shed.id };
      return { pri: 3, kind: 'car', text: `车队还没备好：${miss.sub}。`, act: 'migrate' };
    }
    const nxt = CHAPTERS[J.stage + 1], q = nxt && nxt.tasks.find(t => t.k === 'rate');
    if (q) return { pri: 3, kind: 'next', text: `下一程要${RES[q.r].n}：${nextNeeds(S, q.r)}`, act: 'plan', arg: q.r };
  }
  return null;
}
const fmtS = s => { s = Math.max(0, Math.ceil(s)); return s >= 60 ? `${Math.floor(s / 60)} 分 ${s % 60} 秒` : `${s} 秒`; };
function nextNeeds(S, r) {
  const raw = [];
  const walk = k => { for (const t of producersOf(k).slice(0, 1)) { if (BLD[t].gather) raw.push([k, t]); for (const i in BLD[t].in || {}) walk(i); } };
  walk(r);
  const locked = raw.filter(([, t]) => !unlocked(S, t));
  if (locked.length) return `要${locked.map(([k]) => RES[k].n).join('、')}，得先派侦察队往北探，解锁${locked.map(([, t]) => BLD[t].n).join('、')}。`;
  return `要${[...new Set(raw.map(([k]) => RES[k].n))].join('、')}。先把这几样的矿场和采集点找好。`;
}

// ---------- 一键复制产线：从一座营地里挑出这条线的建筑，记下相对位置，拖到别处放下就排进建造队列 ----------
export const COPY_MAX = 12;
export function lineBlueprint(S, r, cid) {
  const types = lineTypes(r), core = b => BLD[b.type].out && BLD[b.type].out[r];
  if (cid == null) { // 默认挑这条线成品建筑最多的营地
    const n = {}; for (const b of S.buildings) if (core(b)) n[b.camp] = (n[b.camp] || 0) + 1;
    cid = +Object.keys(n).sort((a, b) => n[b] - n[a])[0];
  }
  const all = S.buildings.filter(b => b.camp === cid && types.has(b.type));
  const cs = all.filter(core);
  if (!cs.length) return null;
  const cx = cs.reduce((a, b) => a + b.x, 0) / cs.length, cy = cs.reduce((a, b) => a + b.y, 0) / cs.length;
  const pick = all.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, COPY_MAX);
  const x0 = Math.min(...pick.map(b => b.x)), y0 = Math.min(...pick.map(b => b.y));
  const items = pick.map(b => ({ type: b.type, dx: b.x - x0, dy: b.y - y0 }));
  return { r, camp: cid, items, w: Math.max(...items.map(i => i.dx + BLD[i.type].size)), h: Math.max(...items.map(i => i.dy + BLD[i.type].size)) };
}
// 预演：每栋能马上建（ok）、排队等材料（q）、还是放不下（bad）
export function blueprintPlan(S, bp, ax, ay) {
  const left = {}, extra = {}, qn = {}, plan = [], total = {};
  let ok = 0, q = 0, bad = 0, workers = 0, camp = null;
  for (const it of bp.items) {
    const x = ax + it.dx, y = ay + it.dy, type = it.type;
    const ck = checkPlace(S, type, x, y);
    if (!ck.ok && !ck.soft) { plan.push({ type, x, y, st: 'bad', reason: ck.reason }); bad++; continue; }
    if (BLD[type].gather && !ck.spots) { plan.push({ type, x, y, st: 'bad', reason: '附近没有资源点' }); bad++; continue; }
    const cid = ck.camp, c = getCamp(S, cid); camp = camp ?? cid;
    const st = left[cid] || (left[cid] = { ...c.stock });
    const cost = buildCost(S, type, cid, y, extra[cid] || 0);
    for (const k in cost) total[k] = (total[k] || 0) + cost[k];
    workers += maxWorkers(type, 1);
    if (canAfford(st, cost)) { pay(st, cost); extra[cid] = (extra[cid] || 0) + 1; plan.push({ type, x, y, st: 'ok', camp: cid }); ok++; continue; }
    const inQ = (S.queue || []).filter(e => e.camp === cid).length + (qn[cid] || 0);
    if (inQ >= QUEUE_MAX) { plan.push({ type, x, y, st: 'bad', reason: `这个营地已经排了 ${QUEUE_MAX} 栋在等材料` }); bad++; continue; }
    qn[cid] = (qn[cid] || 0) + 1; plan.push({ type, x, y, st: 'q', camp: cid }); q++;
  }
  const c = camp != null ? getCamp(S, camp) : null;
  return { plan, ok, q, bad, total, workers, camp, idle: c ? Math.max(0, idleLabor(S, c)) : 0 };
}
export function placeBlueprint(S, bp, ax, ay) {
  const pl = blueprintPlan(S, bp, ax, ay);
  let built = 0, queued = 0, failed = 0, reason = '';
  for (const e of pl.plan) {
    if (e.st === 'bad') { failed++; reason = reason || e.reason; continue; }
    const r = queueBuild(S, e.type, e.x, e.y);
    if (!r.ok) { failed++; reason = reason || r.reason; } else if (r.queued) queued++; else built++;
  }
  return { built, queued, failed, reason };
}
