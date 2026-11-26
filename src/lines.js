// 寒烬北行 · 产线：主线和支线、升星、累计产量里程碑、规划器的配比、老向导
// 一条产线 = 一种材料 + 一路给它供料的上游建筑。主线由这一程给，支线自己立
import { BLD, RES, RES_KEYS, SPOTS, SPOT_KEYS, FUEL, ALT_SWITCH } from './data.js';
import {
  rt, dirty, getCamp, logMsg, prodRate, rateGoals, holdOf, popCap, maxWorkers, heatRadius, levelMul,
  nextRaid, raidPrep, idleLabor, unlocked, checkPlace, HOLD, buildCost, canAfford, pay, queueBuild, QUEUE_MAX, ORE_URGENT, gatherTypeFor,
  servedSpots, spotLeft, moveBlock, prodBonus, getB, blocksOre, chapIdx, chapterDef, countType, fuelLeft, KEEP_WHY, FUEL_KEEP_WHY, FUEL_KEEP_MIN, isBuildMat, keepOf, storeCap, queueCost,
  bdef, recipeOf, altOk, altDef, recipeTxt,
} from './sim.js';
import { getWorld, idx, W } from './worldgen.js';
import { journeyOf, mainCamp, stopOf, departGate, gateFlvl, depotAuto } from './journey.js';
import { roadOf, netRoadView, netRoadName, roadKindName, railOk, campSpare, netView } from './net.js';

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
  if (!producersOf(r).length) return { ok: false, reason: '이 자재는 시공능력이 없습니다.' };
  if (lineOf(S, r)) return { ok: false, reason: '이 자료에 대한 줄이 이미 있습니다.' };
  if (sideCount(S) >= sideMax(S)) return { ok: false, reason: `최대 분기 노선은 ${sideMax(S)}입니다(완료된 각 여정마다 1개 추가).` };
  const f = qualFloor(S, r);
  n = Math.max(f, Math.round(n || f));
  const L = plinesOf(S);
  L.push({ id: (S.nextId++), r, n, main: false, st: 0, star: 0, t0: S.t });
  logMsg(S, `${RES[r].n} 분기 라인이 설정되었습니다: 목표 ${n}/분. 10분 동안 속도가 목표보다 높게 유지되면 별 1개를 얻습니다.`, 'good');
  return { ok: true };
}
export function setPLine(S, id, n) {
  const l = plinesOf(S).find(x => x.id === id); if (!l) return { ok: false };
  const f = l.main ? l.n0 || l.n : qualFloor(S, l.r);
  if (n < f) return { ok: false, reason: `${f}/분 미만일 수 없습니다.` };
  l.n = Math.round(n * 10) / 10;
  return { ok: true };
}
export function dropPLine(S, id) {
  const l = plinesOf(S).find(x => x.id === id);
  if (!l || l.main) return { ok: false, reason: '본선은 철회할 수 없습니다' };
  S.plines = plinesOf(S).filter(x => x.id !== id);
  dirty(S);
  return { ok: true };
}
// 章节里的产能目标就是主线：开始一章时自动立起来（同种材料的支线直接升成主线，星留着）
function syncMain(S) {
  for (const i of chapIdx(S)) {
    const ch = chapterDef(S, i); if (!ch) continue;
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
      const fx = ['', `생산량 +15%`, '각 건물에는 최소 1개의 일꾼이 필요합니다.', '생산량 +30% 더 보기'][l.star];
      logMsg(S, `⭐ ${RES[l.r].n}${l.main ? '본선' : '지선'}이 ${'★'.repeat(l.star)}로 상승: 이 선에 ${fx}을(를) 구축합니다.`, 'good', { act: 'plan', arg: l.r, label: '생산라인을 살펴보세요' });
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
      logMsg(S, `🎆 ${RES[k].n}이(가) 총 ${fmtBig(MILE[lv - 1])}을(를) 벌었습니다. 지금부터 이 자료 생산량은 영구적으로 +5%가 되며 ${e}포인트 잔불을 추가로 받게 됩니다.`, 'good');
      rt(S).fx.push({ kind: 'mile', r: k, lv });
      dirty(S);
    }
  }
}
export function fmtBig(n) { return n >= 1e4 ? (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + '만' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + '천' : String(Math.round(n)); }

// ---------- 规划器：一条线每一环现在产多少、目标要多少、差多少 ----------
export function planLine(S, r, n) {
  const need = {}, depth = {}, via = {};
  const walk = (k, q, d, from) => {
    need[k] = (need[k] || 0) + q;
    if (depth[k] == null || d < depth[k]) { depth[k] = d; via[k] = from; }
    const t = producersOf(k)[0], D = t && recipeOf(S, t); if (!D || !D.in) return; // 这一种大多换了替代配方，就按替代配方算原料
    for (const i in D.in) walk(i, q * D.in[i] / D.out[k], d + 1, k);
  };
  walk(r, n, 0, null);
  const R = rt(S), bs = {};
  for (const b of S.buildings) (bs[b.type] || (bs[b.type] = [])).push(b);
  const nodes = Object.keys(need).sort((a, b) => depth[a] - depth[b]).map(k => {
    const types = producersOf(k), list = types.flatMap(t => bs[t] || []);
    const lvl = list.length ? Math.round(list.reduce((a, b) => a + b.lvl, 0) / list.length) : 1;
    const t = types[0], one = t ? recipeOf(S, t).out[k] * levelMul(lvl) : 0; // 一座这个等级、满员的建筑每分钟产多少（不算加成）
    const prod = prodRate(S, k), q = need[k];
    const workers = list.reduce((a, b) => a + b.workers, 0);
    const stat = {};
    for (const b of list) { const s = (R.b[b.id] || {}).status; if (s) stat[s] = (stat[s] || 0) + 1; }
    return { k, need: Math.round(q * 10) / 10, prod: Math.round(prod * 10) / 10, gap: Math.max(0, q - prod), ratio: q > 0 ? prod / q : 1, depth: depth[k], via: via[k], type: t, count: list.length, alt: list.filter(b => b.alt).length, lvl, one, workers, stat, ids: list.map(b => b.id) };
  });
  // 最卡的那一环：从这条线的成品往上找，原料比成品更缺就往上走
  const by = Object.fromEntries(nodes.map(x => [x.k, x]));
  let cur = nodes[0];
  if (cur.ratio < 0.999) {
    for (let guard = 0; guard < 8; guard++) {
      const t = cur.type; if (!t || !recipeOf(S, t).in) break;
      const ins = Object.keys(recipeOf(S, t).in).map(k => by[k]).filter(Boolean).sort((a, b) => a.ratio - b.ratio);
      const worst = ins[0];
      const starved = Object.keys(cur.stat).some(s => s.startsWith('부족'));
      // 建筑自己说缺哪样，就先看那样：总产量够、却被别的建筑吃掉了，也算卡在这里
      const named = ins.filter(x => cur.stat['부족' + RES[x.k].n]).sort((a, b) => (cur.stat['부족' + RES[b.k].n] || 0) - (cur.stat['부족' + RES[a.k].n] || 0))[0];
      if (named) { named.from = cur.k; cur = named; if (named.ratio >= 1) { named.comp = true; break; } continue; }
      if (worst && (worst.ratio < cur.ratio - 0.05 || (starved && worst.ratio < 1))) { worst.from = cur.k; cur = worst; } else break;
    }
  } else cur = null;
  if (cur) cur.worst = true;
  // 配比提示：上一环一座建筑吃多少，这一环大约要几座
  for (const x of nodes) {
    if (!x.via) continue;
    const up = by[x.via], ut = up.type; if (!ut || !x.type) continue;
    const eat = (recipeOf(S, ut).in[x.k] || 0) * levelMul(up.lvl), give = recipeOf(S, x.type).out[x.k] * levelMul(x.lvl);
    x.hint = `1개 ${up.lvl} level${BLD[ut].n}은 분당 ${fmtR(eat)}조각${RES[x.k].n}을 먹습니다. 이는 ${fmtR(eat / give)}개 ${x.lvl} level${BLD[x.type].n} 정도입니다.`;
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
// 谁产这样东西：能建的采集建筑优先（伐木场、矿场），再是加工建筑
function producerOf(S, k) {
  const ts = Object.keys(BLD).filter(t => BLD[t].out && BLD[t].out[k] && BLD[t].cat !== 'deco');
  return ts.find(t => BLD[t].gather && unlocked(S, t)) || ts.find(t => unlocked(S, t)) || ts[0] || null;
}
// 物流网的三句话：路堵了（升级它）、整张网都没有（去有原料的营地多建一座）、在等运货（正从哪运来，多久到）
const gName = k => k === '@fuel' ? '연료' : RES[k].n;
function netTip(S, R, main, wait) {
  const N = R.net; if (!N || S.camps.length < 2) return null;
  const camps = [main, ...S.camps.filter(c => c !== main && !c.depot)];
  if (!wait) {
    // 路堵了：堵住的是排队的建筑、产线要的料（补底和主营地攒着升炉子的不算）
    for (const rid in N.jam) {
      const r = roadOf(S, +rid); if (!r) continue;
      const J = N.jam[rid].filter(j => { const q = ((N.short || {})[j.c] || {})[j.k]; return q && q.tier <= 5; });
      if (!J.length) continue;
      const v = netRoadView(S, r), ks = [...new Set(J.map(j => gName(j.k)))].slice(0, 2).join(',');
      return { pri: 1, kind: 'netjam', short: '도로가 막혔습니다. 업그레이드는 절반을 더 운송할 수 있습니다.', text: `${netRoadName(S, r)}의 ${roadKindName(r)}이 가득 찼습니다(${Math.round(v.flow)}/${Math.round(v.cap)}개/분). ${ks}가 대기열에 있습니다. 업그레이드는 ${railOk(S, r) ? ', 철도로 변경하면 3배 이상 수송 가능' : ''}의 절반을 더 전송할 수 있습니다.`, act: 'netroad', arg: r.id };
    }
    return null;
  }
  // 整张网都没有：营地要的高级货哪儿都没有多余的（主营地的主线有上面更细的话，这里只在别的营地有原料时说）
  for (const c of camps) {
    const sh = (N.short || {})[c.id] || {};
      for (const k in sh) {
        const q = sh[k]; if (!q.none || q.tier > 5 || k === '@fuel' || RES[k].t < 2) continue;
        const pt = producerOf(S, k); if (!pt || !unlocked(S, pt)) continue;
        const ins = Object.keys(BLD[pt].in || {});
        let best = null, bs = 0;
        for (const o of S.camps) { if (o.id === c.id || depotAuto(o)) continue; const sp = campSpare(S, o, {}); const sc = ins.length ? Math.min(...ins.map(x => sp[x] || 0)) : 0; if (sc > bs) { bs = sc; best = o; } }
        if (!best && c === main) continue;
        const where = best ? `"${best.name}"에 추가 ${BLD[pt].n}을(를) 구축하면 거기에 ${ins.map(x => RES[x].n).join('그리고')} 이상이 있을 것입니다.` : `하나 더 만드세요${BLD[pt].n}`;
        return { pri: 2, kind: 'netnone', camp: c.id, short: `"${c.name}"에 ${RES[k].n}이(가) 누락되어 아무것도 남지 않았습니다.`, text: `"${c.name}"에는 ${RES[k].n}(${q.why})이 부족하며 야영지: ${where}에는 초과 항목이 없습니다.`, act: 'campgo', arg: (best || c).id };
      }
  }
  // 在等运货：新营地（不是主营地）的建筑在等料，料已经在路上
  for (const c of camps) {
    if (c === main) continue;
    const sh = (N.short || {})[c.id] || {}, inc = netView(S, c.id).inc, cr = R.c[c.id] || {}, fl = cr.flow || {};
    for (const k in inc) {
      const f = fl[k], i = inc[k], want = f && f.want - f.c > Math.max(0.05, f.want * 0.08);
      const q = (S.queue || []).find(x => x.camp === c.id && (queueCost(S, x)[k] || 0) > (c.stock[k] || 0));
      if (!want && !q) continue;
      const user = q ? `${BLD[q.type].n} 대기 중` : (() => { const b = S.buildings.find(b => b.camp === c.id && bdef(b).in && bdef(b).in[k]); return b ? `${BLD[b.type].n} 중` : ''; })();
      const from = [...i.from].map(id => `「${(getCamp(S, id) || {}).name}」`).join('');
      return { pri: 2, kind: 'netwait', camp: c.id, short: `${RES[k].n} 배송 중, 약 ${fmtS(i.eta)}`, text: `"${c.name}" ${user}이(가) ${RES[k].n}을(를) 기다리고 있습니다. ${from}에서 약 ${fmtS(i.eta)}(으)로 배송됩니다.`, act: 'netview', arg: c.id };
    }
  }
  return null;
}
export function advisor(S) {
  const R = rt(S), J = journeyOf(S), main = mainCamp(S);
  if (!main) return null;
  // 急事
  for (const c of S.camps) {
    const cr = R.c[c.id] || {};
    // 补给站自己运转，只在撑不住时说一句
    if (c.depot && !c.manual) { if (c.dWarn) return { pri: 0, kind: 'depot', camp: c.id, short: `보급 창고 "${c.name}"은(는) 더 이상 보유할 수 없습니다.`, text: `공급 스테이션 "${c.name}" ${c.dWarn}: 일시적으로 인계받거나 종료하고 잔불으로 교체할 수 있습니다.`, act: 'campgo', arg: c.id }; continue; }
    if (cr.foodNet != null && cr.foodNet < -0.05) {
      const m = (c.stock.food || 0) / -cr.foodNet;
      if (m < 10) return { pri: 0, kind: 'food', camp: c.id, short: `요리에는 ${Math.max(1, Math.floor(m))}분 동안만 충분합니다.`, text: `"${c.name}"에는 ${Math.max(1, Math.floor(m))}분 동안만 요리가 충분합니다. 사냥하고 요리하거나 다른 야영지에서 음식을 운반하는 데 더 많은 일손 배치가 있습니다.` };
    }
    { const fm = cr.burnPerMin > 0 ? fuelLeft(cr) : Infinity; // 算上进账：伐木跟得上熔炉就不报
      if (fm < 10) {
        const how = countType(S, c.id, 'batteryworks') ? '수정 배터리 공장에는 더 많은 일손 배치가 있으며 몇 개 더 구축하십시오.' : countType(S, c.id, 'coker') ? '일손 배치보다 더 많은 탄광 및 코크스 퍼니스' : countType(S, c.id, 'coalmine') ? '일손 배치보다 벌목장 및 탄광이 더 많습니다.' : '일손 배치보다 벌목장이 많거나 다른 것을 구축하세요';
        const early = !countType(S, c.id, 'coalmine') && !countType(S, c.id, 'coker') && !countType(S, c.id, 'batteryworks');
        return { pri: 0, kind: 'fuel', camp: c.id, short: fm < 0.5 ? `"${c.name}"의 용광로가 연료를 깨뜨렸습니다.` : `연료는 ${Math.max(1, Math.floor(fm))}분만 남았습니다.`, ...(early && c === main ? { act: 'place', arg: 'lumber' } : {}), text: fm < 0.5 ? `"${c.name}"의 용광로가 연료: ${how}에 의해 손상되었습니다. 연료를 사용하려는 공장은 먼저 중단하고 연료를 용광로에 맡깁니다.` : `"${c.name}"의 연료는 ${Math.max(1, Math.floor(fm))}분 밖에 남지 않았으며 들어가는 것보다 빨리 소진됩니다: ${how}. 연료를 사용하려는 공장은 먼저 중단하고 연료를 용광로에 맡깁니다.` };
      } }
    if (cr.tH != null && cr.tH < -8 && c.people > 3) return { pri: 0, kind: 'cold', camp: c.id, short: `「${c.name}」너무 추워요 동상 여러분`, text: `"${c.name}"은(는) 너무 차갑습니다. 어떤 사람들은 동상: 더 많은 연료를 태우거나 과부하를 켜거나 천막업그레이드를 따뜻하게 유지합니다.` };
  }
  const nr = nextRaid(S);
  if (nr && nr.in < 300 && !raidPrep(S, nr)) return { pri: 0, kind: 'raid', camp: nr.camp, short: `습격 ${Math.max(1, Math.ceil(nr.in / 60))}분 안에 도착하여 전투 준비`, text: `습격"${(getCamp(S, nr.camp) || {}).name}"까지 ${Math.max(1, Math.ceil(nr.in / 60))}분 남았습니다. 준비하려면 클릭하세요.`, act: 'raid' };
  if (J.trip && J.trip.road) return { pri: 0, kind: 'road', short: '행렬 길에서 뭔가를 마주하고 당신의 결정을 기다리고 있어요', text: '행렬은 길에서 뭔가를 마주했고 당신이 마음을 정할 때까지 멈춰서 기다렸습니다.', act: 'roadopen' };
  if (J.trip && J.trip.hold > 0) return { pri: 1, kind: 'trip', short: '행렬멈추고 잠시 쉬어가세요', text: `행렬은 잠시(${Math.ceil(J.trip.hold)}초 더) 멈췄고, 그 뒤에 있는 야영지는 평소처럼 계속 작동했습니다.`, act: null };
  if (J.trip) return { pri: 1, kind: 'trip', short: J.trip.phase === 'arrive' ? '행렬이 도착했습니다. 블록을 선택하고 용광로를 바닥에 놓습니다.' : `행렬이 "${stopOf(S, J.trip.to).n}" 방향으로 향하고 있습니다.`, text: J.trip.phase === 'arrive' ? `행렬이 "${stopOf(S, J.trip.to).n}"에 도착했습니다. 평평한 땅을 선택하고 새 용광로를 내려놓으세요.` : `행렬은 "${stopOf(S, J.trip.to).n}" 방향으로 향하고 있으며 그 뒤의 야영지는 평소대로 작동하고 있습니다.`, act: J.trip.phase === 'arrive' ? 'arrive' : null };
  // 矿快挖完了（剩不到 5%，又不是深井）：先说一声
  for (const c of [main, ...S.camps.filter(x => x !== main && !depotAuto(x))]) {
    const ore = (R.c[c.id] || {}).ore || {};
    for (const k in ore) {
      const o = ore[k];
      if (o.frac >= ORE_URGENT || o.deep) continue;
      const t = gatherTypeFor(k);
      return { pri: 1, kind: 'ore', camp: c.id, short: `${SPOTS[k].n} 굴착 작업이 거의 완료되었으며 깊은 우물을 파낼 수 있습니다.`, text: `"${c.name}" 난방권의 ${SPOTS[k].n}이 거의 완료되었습니다(${Math.max(0, Math.round(o.frac * 100))}% 남음). ${BLD[t].n}에 대해 깊은 우물을 파면 파낸 후에도 여전히 생산량의 35%가 남아 있습니다. 또는 탐사팀을 정찰 막사로 보내 새로운 광맥을 찾으세요. 이번에는 최저 가격으로 만나보세요.`, act: 'spot', arg: o.b };
    }
  }
  // 搬运工不够：每座建筑都跟着慢下来，比哪一环都要紧（不然会误判成「仓库满了」「缺料」）
  {
    const cr = R.c[main.id] || {};
    if (cr.hf != null && cr.hf < 0.6 && cr.demand > 3) {
      const wh = S.buildings.filter(b => b.camp === main.id && b.type === 'warehouse');
      const room = wh.reduce((a, b) => a + Math.max(0, maxWorkers('warehouse', b.lvl) - b.workers), 0);
      const tip = wh.length && room > 0 ? `전체 인원을 창고로 보냅니다. (${room} 더 보낼 수 있습니다.)` : '창고를 하나 더 만든 다음 일손 배치를 건설하세요.';
      return { pri: 1, kind: 'haul', camp: main.id, short: '운반꾼 부족, ~ 창고일손 배치', text: `"${main.name}" 운반꾼 부족(${Math.ceil(cr.demand)}명 필요, ${Math.floor(cr.haulers)}명만 필요), 각 건물은 사람들이 자재를 전달하기를 기다리고 있습니다. 운반꾼은 창고, ${tip}에 거주합니다. 도로를 건설하면 교통이 더 빨라질 수도 있습니다.`, act: wh.length ? 'spot' : 'place', arg: wh.length ? wh[0].id : 'warehouse' };
    }
  }
  // 物流网：要紧的货（排队的建筑、产线缺料）路满了运不过来，或者整张网都没有
  { const n = netTip(S, R, main, false); if (n) return n; }
  // 替代配方：一座加工厂缺一样原料停了好一阵，换一套配方就能接着干
  { const a = altTip(S, R, main, 180); if (a) return a; }
  // 主线卡在哪
  const g = rateGoals(S).find(x => !x.eternal) || rateGoals(S)[0];
  if (g) {
    const rate = prodRate(S, g.r), h = holdOf(S, g.id);
    if (rate >= g.n - 1e-9) return { pri: 1, kind: 'hold', short: `${RES[g.r].n}이면 충분합니다. ${fmtS(HOLD - h.p)}만 기다리세요.`, text: `${RES[g.r].n} 라인은 ${fmtR(rate)}/분에 도달하고, ${fmtS(HOLD - h.p)}를 유지하면 기준에 도달하게 됩니다.`, act: 'plan', arg: g.r };
    const P = planLine(S, g.r, g.n), w = P.worst;
    if (w) {
      if (!w.count && w.type && !unlocked(S, w.type)) return { pri: 1, kind: 'line', short: `${BLD[w.type].n}이(가) 잠금 해제되지 않았습니다. 북쪽으로 이동하여 길을 탐색하세요.`, text: `${RES[g.r].n} 라인에는 ${RES[w.k].n}이 필요하지만 ${BLD[w.type].n}는 아직 잠금 해제되지 않았습니다. 정찰대를 보내 북쪽을 탐색하고 더 북쪽 위도가 보이면 이를 구축할 수 있습니다.`, act: 'plan', arg: g.r };
      if (!w.count) return { pri: 1, kind: 'line', short: `${RES[g.r].n} 라인에 ${w.type ? BLD[w.type].n : RES[w.k].n}이(가) 없습니다. 먼저 하나 건설하세요.`, text: `${RES[g.r].n} 행에 링크가 없습니다. 아직 ${w.type ? BLD[w.type].n : RES[w.k].n}이 없습니다. ${RES[w.k].n}의 비용은 분당 ${fmtR(w.need)}입니다. 먼저 건설하세요.`, act: 'plan', arg: g.r };
      const by = P.nodes.find(x => x.k === (w.from || w.via));
      const full = Object.keys(w.stat).find(s => s === '창고가 가득 참');
      if (full) return { pri: 1, kind: 'line', short: `${RES[w.k].n}이(가) 창고가 가득 참에서 멈췄습니다.`, text: `${RES[w.k].n}이(가) 창고가 가득 참에 멈췄습니다. 창고를 더 구축하거나 야영지 패널에서 "전체 포지션 자동 상환"을 켜세요.`, act: 'plan', arg: g.r };
      // 总产量够，却被别的建筑吃掉了
      if (w.comp && by) {
        const eat = {};
        for (const b of S.buildings) { const ir = ((R.b[b.id] || {}).inRate || {})[w.k]; if (ir > 0 && b.type !== by.type) eat[b.type] = (eat[b.type] || 0) + ir; }
        const top = Object.keys(eat).sort((a, b) => eat[b] - eat[a])[0];
        return { pri: 1, kind: 'line', short: `${RES[w.k].n}을(를) ${top ? BLD[top].n : '다른 곳에서'}님이 먹었습니다.`, text: `${RES[g.r].n}줄이 끼어있다${RES[w.k].n}：${RES[w.k].n}1분${fmtR(w.prod)}, 이 줄에는${fmtR(w.need)},할 수 있다${BLD[by.type].n}공유를 받을 수 없습니다.${top ? `, 그들 중 대부분은${BLD[top].n}먹다(${fmtR(eat[top])}/가리키다). 더 적은 사람을 그곳으로 보내세요${BLD[top].n}` : '. 더 많이 번식하세요'}，${BLD[by.type].n}작업이 시작됩니다.`, act: 'plan', arg: g.r };
      }
      // 这一环自己在等料（缺料、留料给建造、留燃料给熔炉）：再多建它也没用，该补的是上游
      { const cnt = Object.values(w.stat || {}).reduce((a, n) => a + n, 0) || 1;
        const st = Object.keys(w.stat || {}).find(x => (x.startsWith('부족') || x === KEEP_WHY || x === FUEL_KEEP_WHY) && w.stat[x] * 2 >= cnt);
        const ins = w.type && recipeOf(S, w.type).in ? Object.keys(recipeOf(S, w.type).in) : [];
        const k = st && (st.startsWith('부족') ? ins.find(x => RES[x].n === st.slice(1)) : ins.find(x => st === FUEL_KEEP_WHY ? FUEL[x] : isBuildMat(x)));
        const pt = k && producerOf(S, k);
        if (k && pt) {
          const n = BLD[w.type].n, kn = RES[k].n, idle = P.idle >= 1, can = unlocked(S, pt);
          const more = `${BLD[pt].n}(그리고 ${P.idle}명의 여유 인원)을 더 확보하세요.`;
          let text, short = `${n}이(가) ${kn}을(를) 기다리고 있지만 ${BLD[pt].n}을(를) 제공할 수 없습니다.`;
          if (st === KEEP_WHY || st === FUEL_KEEP_WHY) {
            // 留料：木材这种东西先留给盖房、留给熔炉，攒过这条线，多出来的才拿去加工
            const cr = R.c[main.id] || {}, kb = isBuildMat(k) ? keepOf(main, k, storeCap(S, main)) : 0, kf = FUEL[k] ? (cr.burnPerMin || 0) * FUEL_KEEP_MIN / FUEL[k] : 0;
            const forW = [kb > 0 && '집을 짓다', kf > 0 && '용광로'].filter(Boolean).join('그리고');
            short = `${kn}은 ${forW}에 먼저 남게 되는데, 이는 충분하지 않습니다.`;
            text = `${RES[g.r].n}줄이 끼어있다${kn}：${kn}먼저 저축해야 해${Math.ceil(Math.max(kb, kf))}부분(남은 시간${forW}), 추가 금액이 제공됩니다${n}。${idle ? `${more}아니면 먼저 집을 적게 지으세요.${kn}저축하다` : `먼저 집을 적게 짓자.${kn}저장해 두세요. 사람이 많아지면 건물을 더 짓고${BLD[pt].n}`}。`;
          } else text = `${RES[g.r].n}줄이 끼어있다${kn}：${n}대기 중${kn}，${BLD[pt].n}공급할 수 없습니다.${idle ? more : `남은 사람이 없습니다. 더 많은 사람들이 참여할 수 있도록 천막를 구축한 다음${BLD[pt].n}멀티일손 배치`}。`;
          { const sw = altSwap(S, w.type, k); if (sw) text += `${n}를 ${kn} 대신 ${sw}로 바꿀 수도 있습니다.`; }
          return { pri: 1, kind: 'line', text, short: short, act: can && idle ? 'place' : 'plan', arg: can && idle ? pt : g.r };
        } }
      const why = by ? `${BLD[by.type].n}의 비용은 ${fmtR(w.need)}/센트, ${BLD[w.type].n}의 비용은 ${fmtR(w.prod)}/센트입니다.` : `${fmtR(w.need)}/포인트 목표, 현재 ${fmtR(w.prod)}/포인트`;
      const more = Math.max(1, Math.ceil((w.need - w.prod) / Math.max(0.1, w.one)));
      let fix = w.workers < w.count * maxWorkers(w.type, w.lvl) ? `${BLD[w.type].n}명 모두 먼저 보내기` : `또 다른 ${more} 블록 ${BLD[w.type].n} 또는 업그레이드 구축`;
      let fs = fix.startsWith('첫 번째') ? '사람을 먼저 보내라' : `${more}석 추가 구축`;
      // 采集建筑没地方放了：矿点旁边都被占了
      let blk = null;
      if (fix.startsWith('재구축') && BLD[w.type].gather && !gatherRoom(S, main, w.type)) {
        blk = blockerOf(S, main, w.type); fs = '광산 지점 옆에는 공간이 없습니다.';
        fix = `할 수 있다${RES[w.k].n}광산 옆에는 공간이 없습니다.${BLD[w.type].n}(다른 건물이 점유하거나 난방권 외부에 있음):${blk ? `미네랄 포인트 옆에 놓으세요${BLD[blk.type].n}이동(클릭하고 "위치 이동"을 선택하면 재료가 소모되지 않습니다)` : '광산 지점 옆에 건물 1~2개 이동(건물을 클릭하고 "위치 이동" 선택)'}, 또는 용광로를 업그레이드하여 난방권를 확장하거나 정찰 막사를 확장하여 새로운 정맥을 탐색할 수도 있습니다.`;
      }
      // 没有闲人：这条线上产得太多的一环，可以撤人过来
      if (fix.startsWith('재구축') && P.idle < (BLD[w.type].w || 1)) {
        const over = P.nodes.filter(x => x.type && x.workers > 0 && x.ratio > 1.8 && x.k !== g.r).sort((a, b) => b.ratio - a.ratio)[0];
        if (over) fs = `${BLD[over.type].n}에서 사용자 제거`;
        if (over) fix = `남은 사람이 없습니다. ${BLD[over.type].n}는 ${fmtR(over.prod)}/cent를 생성합니다. 이 회선의 비용은 ${fmtR(over.need)}/센트입니다. 거기에서 몇 사람을 철수할 수 있습니다.`;
      }
      return { pri: 1, kind: 'line', short: `${RES[g.r].n} 라인이 ${BLD[w.type].n}에서 멈쳤습니다, ${fs}`, text: `${RES[g.r].n} 줄이 ${RES[w.k].n}:${why}에서 멈췄습니다. ${fix}.`, act: blk ? 'spot' : 'plan', arg: blk ? blk.id : g.r };
    }
  }
  // 物流网：新营地在等运货（告诉一声正从哪运来、多久到）
  { const n = netTip(S, R, main, true); if (n) return n; }
  // 人手和地盘
  if (main.people >= popCap(S, main) && !main.depot) return { pri: 2, kind: 'pop', short: '인구가 가득 찼습니다. 용광로로 업그레이드하면 그곳에 사는 사람의 수가 늘어날 수 있습니다.', text: `인구가 가득 찼습니다(${main.people}/${popCap(S, main)}): 용광로로 업그레이드하여 더 많은 사람을 수용하거나 생산 라인을 별 2개로 업그레이드하여 일손을 절약하세요.`, act: 'furnace' };
  if (freeLand(S, main) < 2) return { pri: 2, kind: 'land', short: '난방권에는 공간이 거의 없습니다', text: '난방권에는 공간이 거의 없습니다. 용광로를 업그레이드하여 난방권을 확장하거나 도중에 전초 기지 야영지를 엽니다.', act: 'furnace' };
  // 下一程的方向
  const gt = departGate(S);
  if (gt) {
    const miss = gt.items.find(i => !i.ok);
    if (!miss) return { pri: 3, kind: 'go', short: '북상에는 네 가지가 준비되어 있습니다.', text: `북상에 대해 네 가지가 준비되어 있습니다. 북상 패널을 열고 "${gt.next.n}"으로 이동합니다.`, act: 'migrate' };
    if (miss.id === 'route') return { pri: 3, kind: 'route', short: `북쪽으로 갈 수 있는 블록이 아직 ${gt.route.gap}개 정도 남아 있습니다.`, text: `"${gt.next.n}"으로 가는 길은 아직 ${gt.route.gap}제곱 정도입니다. 정찰대를 보내 북쪽을 탐험하세요. 행렬은 탐색한 경로만 이용할 수 있습니다.`, act: 'scout' };
    if (miss.id === 'flvl') return { pri: 3, kind: 'flvl', short: `용광로는 ${gateFlvl(J.stage)} 레벨로 업그레이드한 후에만 북상이 될 수 있습니다.`, text: `용광로를 북상(현재 레벨 ${miss.cur})로 업그레이드하려면 ${gateFlvl(J.stage)} 레벨로 업그레이드해야 합니다.`, act: 'furnace' };
    if (miss.id === 'car') {
      // 哪个营地的雪橇棚都能造车（老营地的也行），主营地的优先
      const P = gt.plan, sheds = S.buildings.filter(b => b.type === 'sledshed'), shed = sheds.find(b => b.camp === main.id) || sheds[0];
      if (!P.roomOk && !shed) return { pri: 3, kind: 'car', short: '먼저 썰매 헛간을 건설한 다음 썰매를 건설하세요.', text: `행렬에는 여전히 자동차가 부족합니다. 먼저 본영에 썰매 헛간을 구축하고 목재 및 목판을 사용하여 썰매(${miss.sub})를 구축합니다.`, act: 'place', arg: 'sledshed' };
      if (!P.roomOk) return { pri: 3, kind: 'car', short: '행렬에는 차량이 부족합니다. 더 구매하려면 썰매 헛간으로 이동하세요.', text: `행렬는 아직 준비되지 않았습니다.${miss.sub}. 가다${shed.camp === main.id ? '' : `「${getCamp(S, shed.camp).name}"의`}썰매 헛간를 몇 개 더 만드세요.`, act: 'spot', arg: shed.id };
      return { pri: 3, kind: 'car', short: '행렬은 아직 준비되지 않았습니다', text: `행렬은 아직 준비되지 않았습니다: ${miss.sub}.`, act: 'migrate' };
    }
    const nxt = chapterDef(S, J.stage + 1), q = nxt && nxt.tasks.find(t => t.k === 'rate');
    if (q) return { pri: 3, kind: 'next', short: `다음 여행 비용은 ${RES[q.r].n}입니다.`, text: `다음 여행 비용: ${RES[q.r].n}: ${nextNeeds(S, q.r)}`, act: 'plan', arg: q.r };
  }
  return null;
}
// 换一套配方能不能绕开缺的这样原料：另一套不吃它，而且另一套要的营地里都有
function altSwap(S, type, k, camp) {
  if (!type || !altOk(S, type)) return null;
  const list = S.buildings.filter(b => b.type === type && (!camp || b.camp === camp.id)), on = list.filter(b => b.alt).length * 2 > list.length;
  const other = on ? BLD[type] : altDef(type);
  if (!other.in || other.in[k]) return null;
  const c = camp || mainCamp(S), flow = (rt(S).c[c.id] || {}).flow || {};
  const have = x => (c.stock[x] || 0) >= other.in[x] * 3 || ((flow[x] || {}).p || 0) - ((flow[x] || {}).want || 0) >= other.in[x] * 0.5;
  return Object.keys(other.in).every(have) ? `${on ? '오리지널 레시피' : '대체 레시피'}(${recipeTxt(other)})` : null;
}
export function altTip(S, R, main, secs) {
  for (const b of S.buildings) {
    if (b.camp !== main.id || !altOk(S, b.type) || b.altT > S.t) continue;
    const br = R.b[b.id]; if (!br || br.stop0 == null || S.t - br.stop0 < secs) continue;
    const k = Object.keys(bdef(b).in || {}).find(x => br.status === '부족' + RES[x].n); if (!k) continue;
    const other = b.alt ? BLD[b.type] : altDef(b.type);
    if (other.in[k]) continue;
    const flow = (R.c[main.id] || {}).flow || {};
    const have = x => (main.stock[x] || 0) >= other.in[x] * 3 || ((flow[x] || {}).p || 0) - ((flow[x] || {}).want || 0) >= other.in[x] * 0.5;
    if (!Object.keys(other.in).every(have)) continue;
    return { pri: 1, kind: 'alt', camp: main.id, short: `${BLD[b.type].n}이(가) 중지되었습니다. 레시피를 변경할 수 있습니다.`, text: `${BLD[b.type].n}에 ${RES[k].n}이 누락되어 ${Math.floor((S.t - br.stop0) / 60)}분 동안 중지되었습니다. ${b.alt ? '오리지널 레시피' : '대체 레시피'}(${recipeTxt(other)})으로 변경하고 계속할 수 있습니다. 클릭하고 "레시피"에서 변경한 후 ${ALT_SWITCH}초 동안 작업을 중지하세요.`, act: 'spot', arg: b.id };
  }
  return null;
}
const fmtS = s => { s = Math.max(0, Math.ceil(s)); return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`; };
function nextNeeds(S, r) {
  const raw = [];
  const walk = k => { for (const t of producersOf(k).slice(0, 1)) { if (BLD[t].gather) raw.push([k, t]); for (const i in BLD[t].in || {}) walk(i); } };
  walk(r);
  const locked = raw.filter(([, t]) => !unlocked(S, t));
  if (locked.length) return `${locked.map(([k]) => RES[k].n).join('、')}을(를) 얻으려면 먼저 정찰대를 보내 북쪽을 탐험하고 ${locked.map(([, t]) => BLD[t].n).join('、')}을(를) 잠금 해제해야 합니다.`;
  return `${[...new Set(raw.map(([k]) => RES[k].n))].join('、')}이(가) 필요합니다. 먼저 이 광산과 채집 지점을 찾으세요.`;
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
    if (BLD[type].gather && !ck.spots) { plan.push({ type, x, y, st: 'bad', reason: '근처에 자원 포인트가 없습니다' }); bad++; continue; }
    const cid = ck.camp, c = getCamp(S, cid); camp = camp ?? cid;
    const st = left[cid] || (left[cid] = { ...c.stock });
    const cost = buildCost(S, type, cid, y, extra[cid] || 0);
    for (const k in cost) total[k] = (total[k] || 0) + cost[k];
    workers += maxWorkers(type, 1);
    if (canAfford(st, cost)) { pay(st, cost); extra[cid] = (extra[cid] || 0) + 1; plan.push({ type, x, y, st: 'ok', camp: cid }); ok++; continue; }
    const inQ = (S.queue || []).filter(e => e.camp === cid).length + (qn[cid] || 0);
    if (inQ >= QUEUE_MAX) { plan.push({ type, x, y, st: 'bad', reason: `이 야영지는 ${QUEUE_MAX} 대기열에 추가되었으며 자료를 기다리고 있습니다.` }); bad++; continue; }
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
