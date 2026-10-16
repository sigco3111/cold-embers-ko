// 1.1 物流网：所有营地连成一张路网。每个营地算出自己「缺」什么、「余」什么，每 10 秒派雪橇把余的货运到缺的地方，
// 哪个方向都行，货可以经过中间的营地转运；也能手动送一批、长期供货、不外送。
// 路分三种：雪橇道、北行主干道、铁路；一条路的运力由路上所有货共用，路远只是到得慢，不会少运。
import { RES, RES_KEYS, FUEL, furnaceBurn } from './data.js';
import {
  getCamp, rt, storeCap, logMsg, up, techSum, relicSum, wxeAt, WXE_SLOW, getB, upgradeCost, canAfford, pay, missing, EAT,
  keepOf, queueCost, fuelUnitsOf, dirty, dogsOf, trimWorkers, freeBeds, popRoom, MIN_PEOPLE, towerSpec, coldAt, coldFuel,
} from './sim.js';
import { journeyOf, mainCamp, tripPlan, ruleNow, nsOf } from './journey.js';

export const ROAD = {
  sled: { n: '雪橇道', cap: 30, spd: 3 },
  trunk: { n: '北行主干道', cap: 60, spd: 3 },
  rail: { n: '铁路', cap: 120, spd: 8 },
};
export const ROAD_MAX = 5, NET_TICK = 10, NET_BATCH = 10, BASE_FILL = 200, FEED_MAX = 6, SHOW_SLEDS = 6;
export const BASE_KS = ['wood', 'plank', 'stone', 'iron'];
export const RAIL_COST = { steel: 150, seal: 40, engine: 10 };
// 缺口的七档：前面的先满足
export const TIER = ['', '保命', '手动送的', '建造队列', '长期供货', '产线缺料', '主营地大事', '补底'];
const FUEL_SHIP = ['coke', 'coal', 'wood', 'battery']; // 补燃料时先送热值高又不太金贵的

// 研究、号令、奇观以后往这里加：cap 运力倍数、spd 雪橇速度、rail 铁路速度、thrift 修路省料、tick 调度间隔
export function netMul(S, k) {
  const R = rt(S), m = R.netMul && R.netMul[k];
  return m != null ? m : 1;
}

// ---------- 路 ----------
export function roads(S) { return S.roads || (S.roads = []); }
export function roadOf(S, id) { return roads(S).find(r => r.id === id) || null; }
export function roadBetween(S, a, b) { return roads(S).find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a)) || null; }
export function roadsAt(S, cid) { return roads(S).filter(r => r.a === cid || r.b === cid); }
export const roadOn = r => !(r.pend && r.pend.what === 'build');
export function roadLen(S, r) {
  const a = getCamp(S, r.a), b = getCamp(S, r.b); if (!a || !b) return 4;
  if (!r.via) return Math.max(4, Math.hypot(a.x - b.x, a.y - b.y));
  const P = roadPath(S, r); let d = 0; for (let i = 1; i < P.length; i++) d += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  return Math.max(4, d); // 主干道沿着车队踩出的路走，弯一点
}
export function netRoadName(S, r) { const a = getCamp(S, r.a), b = getCamp(S, r.b); return `「${a ? a.name : '?'}」⇄「${b ? b.name : '?'}」`; }
export function roadKindName(r) { return ROAD[r.kind].n; }
// 运力（件/分钟）：每级 +50%；搬运研究、遗物、雪橇犬照旧加（铁路上狗减半）；冰湖开裂慢三成
export function roadDogs(S, r) { return Math.min(0.45, 0.03 * (dogsOf(S, r.a) + dogsOf(S, r.b))) * (r.kind === 'rail' ? 0.5 : 1); }
export function roadCap(S, r) {
  const ev = wxeAt(S, S.t);
  return ROAD[r.kind].cap * (1 + 0.5 * (r.lvl - 1)) * (1 + 0.12 * up(S, 'haul') + techSum(S, 'line') + relicSum(S, 'haul')) * (1 + roadDogs(S, r))
    * (ev.on && ev.ev.kind === 'crack' ? WXE_SLOW : 1) * netMul(S, 'cap');
}
export function roadSpd(S, r) { return ROAD[r.kind].spd * netMul(S, r.kind === 'rail' ? 'rail' : 'spd'); }
export function roadTime(S, r) { return roadLen(S, r) / roadSpd(S, r); }
export function roadCost(S, a, b) {
  const ca = getCamp(S, a), cb = getCamp(S, b), d = Math.hypot(ca.x - cb.x, ca.y - cb.y), m = netMul(S, 'thrift');
  return { wood: Math.round((150 + d * 4) * m), plank: Math.round((60 + d * 1.5) * m) };
}
export function roadUpCost(S, r) {
  if (r.lvl >= ROAD_MAX) return null;
  const m = Math.pow(1.5, r.lvl) * netMul(S, 'thrift');
  if (r.kind === 'rail') return { steel: Math.round(60 * m), seal: Math.round(15 * m) };
  return { wood: Math.round(100 * m), plank: Math.round(60 * m), ...(r.lvl >= 2 ? { iron: Math.round(10 * m) } : {}) };
}
export function railOk(S, r) { return r.kind !== 'rail' && r.lvl >= 3 && S.known >= 4; }
function addRoadRaw(S, a, b, kind, lvl = 1, extra = {}) {
  const r = { id: S.nextId++, a, b, kind, lvl, ...extra };
  roads(S).push(r); dirty(S);
  return r;
}
// 修路、升级、改铁路：先用你正在看的营地的料，不够用路另一头的；两头都不够就排队，物流网把料运过去
function payEnds(S, r, cost, view) {
  const ends = [r.a, r.b].sort((x, y) => (x === view ? -1 : 0) - (y === view ? -1 : 0));
  for (const cid of ends) { const c = getCamp(S, cid); if (c && canAfford(c.stock, cost)) { pay(c.stock, cost); return cid; } }
  return 0;
}
function applyPend(S, r, what) {
  if (what === 'build') { logMsg(S, `🛷 ${netRoadName(S, r)}的雪橇道修好了。`, 'good'); }
  else if (what === 'rail') { r.kind = 'rail'; r.lvl = 1; logMsg(S, `🚂 ${netRoadName(S, r)}改建成铁路，运得多、跑得快。`, 'good'); }
  else { r.lvl++; logMsg(S, `🛷 ${netRoadName(S, r)}的${roadKindName(r)}升到 ${r.lvl} 级。`, 'good'); }
  delete r.pend; dirty(S);
}
function payOrQueue(S, r, what, cost, view) {
  const by = payEnds(S, r, cost, view);
  if (by) { applyPend(S, r, what); return { ok: true, by }; }
  const ends = [r.a, r.b], who = ends.includes(view) ? view : ends.includes(mainCamp(S).id) ? mainCamp(S).id : r.a;
  r.pend = { what, cost, by: who };
  dirty(S);
  return { ok: true, queued: true, by: who, reason: `两头的料都不够（${missing(getCamp(S, who).stock, cost).join('，')}），先排进「${getCamp(S, who).name}」的建造队列，物流网会把料运过去` };
}
export function buildRoad(S, a, b, view) {
  if (a === b) return { ok: false, reason: '同一个营地' };
  if (!getCamp(S, a) || !getCamp(S, b)) return { ok: false, reason: '营地不在了' };
  if (roadBetween(S, a, b)) return { ok: false, reason: '这两个营地之间已经有路了' };
  const r = addRoadRaw(S, a, b, 'sled', 1, { pend: { what: 'build' } });
  return payOrQueue(S, r, 'build', roadCost(S, a, b), view);
}
export function upgradeRoad(S, rid, view) {
  const r = roadOf(S, rid); if (!r) return { ok: false, reason: '路不在了' };
  if (r.pend) return { ok: false, reason: '这条路已经在排队等料' };
  const cost = roadUpCost(S, r); if (!cost) return { ok: false, reason: `已经 ${ROAD_MAX} 级了` };
  return payOrQueue(S, r, 'up', cost, view);
}
export function railRoad(S, rid, view) {
  const r = roadOf(S, rid); if (!r) return { ok: false, reason: '路不在了' };
  if (r.pend) return { ok: false, reason: '这条路已经在排队等料' };
  if (!railOk(S, r)) return { ok: false, reason: '到「油与铁路」这一层、路升到 3 级以后才能改铁路' };
  return payOrQueue(S, r, 'rail', { ...RAIL_COST }, view);
}
export function cancelRoad(S, rid) {
  const r = roadOf(S, rid); if (!r || !r.pend) return;
  if (r.pend.what === 'build') S.roads = roads(S).filter(x => x !== r); else delete r.pend;
  dirty(S);
}
function pendStep(S) {
  for (const r of [...roads(S)]) {
    if (!r.pend || !r.pend.cost) continue;
    const c = getCamp(S, r.pend.by); if (!c) { r.pend.by = r.a; continue; }
    if (canAfford(c.stock, r.pend.cost)) { pay(c.stock, r.pend.cost); applyPend(S, r, r.pend.what); }
  }
}
// 新营地一放下：免费修一条一级雪橇道，接到离它最近的营地
export function autoRoad(S, cid) {
  const c = getCamp(S, cid); if (!c || roadsAt(S, cid).length) return null;
  let best = null, bd = 1e9;
  for (const o of S.camps) if (o.id !== cid) { const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < bd) { bd = d; best = o; } }
  return best ? addRoadRaw(S, cid, best.id, 'sled', 1, { auto: 1 }) : null;
}
// 每次北迁：车队走过的路变成北行主干道，连着旧主营地和新主营地
export function trunkRoad(S, a, b) {
  if (!getCamp(S, a) || !getCamp(S, b) || a === b) return null;
  const r = roadBetween(S, a, b);
  if (r) { if (r.kind === 'sled') r.kind = 'trunk'; r.via = 1; delete r.pend; return r; }
  return addRoadRaw(S, a, b, 'trunk', 1, { auto: 1, via: 1 });
}
// 营地没了（熄火、并走）：它两头的营地自动连一条路，保留两段里较低的等级，网不会断
export function healNet(S, cid, to) {
  const rs = roadsAt(S, cid); if (!rs.length) return;
  const nb = rs.map(r => ({ id: r.a === cid ? r.b : r.a, r })).filter(x => getCamp(S, x.id));
  S.roads = roads(S).filter(r => r.a !== cid && r.b !== cid);
  nb.sort((x, y) => getCamp(S, x.id).y - getCamp(S, y.id).y);
  for (let i = 1; i < nb.length; i++) {
    const p = nb[i - 1], q = nb[i];
    if (roadBetween(S, p.id, q.id)) continue;
    const kind = p.r.kind === q.r.kind ? p.r.kind : p.r.kind === 'rail' || q.r.kind === 'rail' ? 'sled' : 'trunk';
    addRoadRaw(S, p.id, q.id, kind, Math.max(1, Math.min(p.r.lvl, q.r.lvl)), { auto: 1, ...(p.r.via && q.r.via ? { via: 1 } : {}) });
  }
  // 路上的货：送这里的改送 to；从这里出发的照样送到
  for (const s of ships(S)) if (s.to === cid) s.to = to || (mainCamp(S) || {}).id;
  S.sends = sends(S).filter(x => x.from !== cid && x.to !== cid);
  S.feeds = feeds(S).filter(x => x.from !== cid && x.to !== cid);
  for (const c of S.camps) if (!roadsAt(S, c.id).length && S.camps.length > 1) autoRoad(S, c.id);
}

// 路在地图上怎么走：主干道（和它改成的铁路）沿着车队踩出的路，其余的直着连
export function roadPath(S, r) {
  const a = getCamp(S, r.a), b = getCamp(S, r.b); if (!a || !b) return [];
  const legs = journeyOf(S).legs || [], key = `${a.x},${a.y},${b.x},${b.y},${r.via ? legs.length : 0}`;
  const C = rt(S).netPath || (rt(S).netPath = {});
  if (C[r.id] && C[r.id].key === key) return C[r.id].P;
  const P = [[a.x, a.y]];
  if (r.via) {
    const up = b.y > a.y, lo = Math.min(a.y, b.y) + 3, hi = Math.max(a.y, b.y) - 3;
    const mid = legs.flatMap(l => l.path || []).filter(p => p[1] > lo && p[1] < hi).sort((p, q) => up ? p[1] - q[1] : q[1] - p[1]);
    for (const p of mid) { const l = P[P.length - 1]; if (up ? p[1] > l[1] + 0.3 : p[1] < l[1] - 0.3) P.push(p); }
  }
  P.push([b.x, b.y]);
  C[r.id] = { key, P };
  return P;
}

// ---------- 路上的货 ----------
export function ships(S) { return S.ships || (S.ships = []); }
export function sends(S) { return S.sends || (S.sends = []); }
export function feeds(S) { return S.feeds || (S.feeds = []); }
// 一车货此刻在哪：第几段路、走了多少
export function shipPos(S, s) {
  let e = (S.t - s.t0) / Math.max(1e-6, s.dur) * s.dur;
  for (let i = 0; i < s.legs.length; i++) {
    const [rid, from] = s.legs[i], r = roadOf(S, rid); if (!r) continue;
    const t = roadTime(S, r);
    if (e <= t || i === s.legs.length - 1) return { r, from, f: Math.max(0, Math.min(1, e / t)) };
    e -= t;
  }
  return null;
}
export function inbound(S, cid) { const m = {}; for (const s of ships(S)) if (s.to === cid) m[s.k] = (m[s.k] || 0) + s.n; return m; }
function deliver(S, s) {
  const to = getCamp(S, s.to) || mainCamp(S); if (!to) return;
  to.stock[s.k] = (to.stock[s.k] || 0) + s.n;
  if (s.k === 'plank' && to.id === journeyOf(S).main && ruleNow(S)) { const ns = nsOf(S); ns.plank = (ns.plank || 0) + s.n; } // 冻土无林：运到这一站的木板
  const R = rt(S), N = R.net || (R.net = {});
  (N.got || (N.got = [])).push({ k: s.k, n: s.n, to: to.id, from: s.from, src: s.src, t: S.t });
  if (N.got.length > 40) N.got.shift();
  if (!to.gotFirst && !to.depot && to.id !== (mainCamp(S) || {}).id) { to.gotFirst = 1; logMsg(S, `🛷 第一批货运到了「${to.name}」：${RES[s.k].n} ${Math.round(s.n)}。以后缺什么，物流网会自己送来。`, 'good', { act: 'netview', arg: to.id, label: '看物流' }); }
  if (s.bid) {
    const b = sends(S).find(x => x.id === s.bid);
    if (b) { b.arr = (b.arr || 0) + s.n; if (b.left <= 0.5 && b.arr >= b.n - 0.5) { S.sends = sends(S).filter(x => x !== b); logMsg(S, `🛷 送到了：${RES[b.k].n} ${Math.round(b.n)} 从「${(getCamp(S, b.from) || {}).name}」运到了「${to.name}」。`, 'good'); } }
  }
}

// ---------- 缺和余 ----------
function queueNeeds(S, c) {
  const qn = {}, add = cost => { for (const k in cost) qn[k] = (qn[k] || 0) + cost[k]; };
  for (const q of S.queue || []) if (q.camp === c.id) add(queueCost(S, q));
  for (const b of S.buildings) if (b.qup && b.camp === c.id) { const cost = upgradeCost(S, b); if (!Object.keys(cost).some(k => RES[k].t > S.known)) add(cost); }
  for (const r of roads(S)) if (r.pend && r.pend.cost && r.pend.by === c.id) add(r.pend.cost);
  return qn;
}
// 每座营地要留几分钟的燃料：平常半小时；寒潮报出来还没到时，留够寒潮那一天（按加倍以后的烧法）再多十分钟
export function fuelKeepMin(S) { const c = coldAt(S); return c && !c.on && c.fc ? Math.max(30, 12 * coldFuel(S) + 10) : 30; }
const fuelU = (m) => { let u = 0; for (const k in FUEL) u += (m[k] || 0) * FUEL[k]; return u; };
// 这个营地缺的：按七档排好，每档先用掉库存和在路上的货
export function campGaps(S, c, inc = inbound(S, c.id)) {
  const R = rt(S), cr = R.c[c.id] || {}, fl = cr.flow || {}, st = c.stock, cap = storeCap(S, c), m = mainCamp(S), isMain = !!m && m.id === c.id;
  const out = [], avail = {}, claim = {};
  for (const k of RES_KEYS) avail[k] = (st[k] || 0) + (inc[k] || 0);
  const need = (k, amt, tier, why) => {
    if (!(amt > 0) || RES[k].t > S.known && !(st[k] > 0)) return;
    const a = avail[k] || 0, g = Math.max(0, amt - a); avail[k] = Math.max(0, a - amt);
    const room = Math.max(0, cap - (st[k] || 0) - (inc[k] || 0) - (claim[k] || 0)), n = Math.min(g, room);
    if (n >= 1) { out.push({ c: c.id, k, n, tier, why, main: isMain }); claim[k] = (claim[k] || 0) + n; }
  };
  // 1 保命：燃料、口粮不到 20 分钟就补到 30 分钟
  const burn = cr.burnPerMin || 0, units = fuelUnitsOf(st) + fuelU(inc);
  const fk = fuelKeepMin(S); // 寒潮报出来了：先补到能烧过寒潮那一天
  if (burn > 0 && units < burn * (fk > 30 ? fk : 20)) out.push({ c: c.id, k: '@fuel', n: burn * fk - units, tier: 1, why: fk > 30 ? '备寒潮' : '燃料', main: isMain });
  const eat = c.people * EAT;
  if (eat > 0 && avail.food < eat * 20) need('food', eat * 30, 1, '口粮');
  // 3 建造队列、排队的升级、排队的路
  const qn = queueNeeds(S, c);
  for (const k in qn) need(k, qn[k], 3, '建造队列');
  // 5 产线缺料：建筑想用却拿不到的，补到十分钟的量
  for (const k of RES_KEYS) { const f = fl[k]; if (f && f.want - f.c > Math.max(0.05, f.want * 0.08)) need(k, f.want * 10, 5, '产线缺料'); }
  // 6 主营地的大事：熔炉下一级、北迁要带的货、塔身建好等点火的燃料
  if (isMain) {
    const fc = upgradeCost(S, getB(S, c.furnace));
    if (!Object.keys(fc).some(k => RES[k].t > S.known)) for (const k in fc) need(k, fc[k], 6, '熔炉下一级');
    const J = journeyOf(S);
    if (!J.trip) { try { const p = tripPlan(S); if (p && p.need) for (const k in p.need) need(k, p.need[k], 6, '北迁要带的'); } catch (e) { /* 没有下一站 */ } }
    for (const b of S.buildings) if (b.camp === c.id && b.tw && !b.tw.lit) { const sp = towerSpec(S, b.tn); if (b.tw.p >= sp.dur) for (const k in sp.fuel) need(k, sp.fuel[k], 6, '烽火塔点火'); }
  }
  // 7 补底：木材、木板、石料、铁锭补到 200，新营地起步就有料盖房
  for (const k of BASE_KS) if (RES[k].t <= S.known) need(k, BASE_FILL, 7, '补底');
  return out;
}
// 这个营地能拿出来的：库存减去自己要留的（半小时燃料口粮、产线十分钟原料、建造队列、留料给建造，木材木板石料铁锭至少留 200）；不外送的不算
export function campSpare(S, c, lack = {}, manual = false) {
  const R = rt(S), cr = R.c[c.id] || {}, fl = cr.flow || {}, st = c.stock, cap = storeCap(S, c);
  const burn = cr.burnPerMin || furnaceBurn(getB(S, c.furnace).lvl);
  const out = { __fu: Math.max(0, fuelUnitsOf(st) - burn * fuelKeepMin(S)) };
  const qn = manual ? {} : queueNeeds(S, c);
  for (const k of RES_KEYS) {
    if (!manual && (lack[k] || (c.hold && c.hold[k]))) continue;
    let res = manual ? 0 : Math.max(keepOf(c, k, cap), BASE_KS.includes(k) && RES[k].t <= S.known ? BASE_FILL : 0) + (fl[k] ? fl[k].c * 10 : 0) + (qn[k] || 0);
    if (k === 'food') res += c.people * EAT * 30;
    const sp = (st[k] || 0) - res;
    if (sp >= 1) out[k] = sp;
  }
  return out;
}
// 能拿出多少：自己也缺这样、而且自己缺的那档更靠前（或一样），就不往外送——不会来回倒
const spOf = (sp, k, tier = 9) => (sp.__lack && sp.__lack[k] <= tier) ? 0 : FUEL[k] ? Math.min(sp[k] || 0, sp.__fu / FUEL[k]) : (sp[k] || 0);

// ---------- 调货 ----------
// 从 dest 往外找路（只走这一轮还有运力的路）：每个营地到 dest 最快多久、走哪几段、最窄的一段还剩多少
function pathsTo(S, dest, bud) {
  const best = { [dest]: { t: 0, legs: [], bott: Infinity } }, done = new Set();
  for (;;) {
    let u = null; for (const id in best) if (!done.has(+id) && (u == null || best[id].t < best[u].t)) u = +id;
    if (u == null) break;
    done.add(u);
    for (const r of roads(S)) {
      if (!roadOn(r) || !(bud[r.id] >= 1)) continue;
      const v = r.a === u ? r.b : r.b === u ? r.a : null; if (v == null || done.has(v) || !getCamp(S, v)) continue;
      const t = best[u].t + roadTime(S, r);
      if (!best[v] || t < best[v].t) best[v] = { t, legs: [[r.id, v]].concat(best[u].legs), bott: Math.min(best[u].bott, bud[r.id]) };
    }
  }
  return best;
}
const INF = S => Object.fromEntries(roads(S).filter(roadOn).map(r => [r.id, 1e9]));
function sendShip(S, k, n, from, to, legs, src, bid, bud, N) {
  const fc = getCamp(S, from); fc.stock[k] = Math.max(0, (fc.stock[k] || 0) - n);
  let dur = 0; for (const [rid] of legs) { const r = roadOf(S, rid); dur += roadTime(S, r); bud[rid] -= n; const nr = N.road[rid]; if (nr) nr.used += n; }
  ships(S).push({ id: S.nextId++, k, n, from, to, legs, t0: S.t, dur, src, bid });
}
// 一个缺口：从最近的、有余的营地派车；最快的路满了就试第二条
function fill(S, g, spare, bud, N, minB, onlyFrom) {
  let left = g.n, jam = false, none = true;
  for (let guard = 0; left >= minB && guard < 10; guard++) {
    const P = pathsTo(S, g.c, bud);
    let best = null;
    for (const id in P) {
      const cid = +id; if (cid === g.c || (onlyFrom && cid !== onlyFrom)) continue;
      const sp = spOf(spare[cid] || {}, g.k, g.tier); if (sp < Math.min(minB, left)) continue;
      none = false;
      if (!best || P[id].t < best.t) best = { cid, sp, ...P[id] };
    }
    if (!best) break;
    const amt = Math.min(left, best.sp, best.bott);
    if (amt < minB) { jam = true; break; }
    sendShip(S, g.k, amt, best.cid, g.c, best.legs, g.src || 'auto', g.bid, bud, N);
    const sp = spare[best.cid]; sp[g.k] -= amt; if (FUEL[g.k]) sp.__fu -= amt * FUEL[g.k];
    left -= amt;
  }
  if (left >= minB) { // 还没送够：有余的营地被满了的路挡住了，记下是哪几条路
    const P = pathsTo(S, g.c, INF(S));
    let src = null;
    for (const id in P) { const cid = +id; if (cid === g.c || (onlyFrom && cid !== onlyFrom) || spOf(spare[cid] || {}, g.k, g.tier) < minB) continue; if (!src || P[id].t < P[src].t) src = id; }
    if (src) for (const [rid] of P[src].legs) if (!(bud[rid] >= minB)) { jam = true; (N.jam[rid] || (N.jam[rid] = [])).push({ c: g.c, k: g.k }); }
    if (src) none = false;
  }
  return { left, jam, none: none && !jam };
}
function dispatch(S, win) {
  const R = rt(S), N = R.net = { ...(R.net || {}), t: S.t, win, road: {}, short: {}, jam: {}, gaps: {} };
  // 每条路这一轮能运多少：慢路没用完的攒着，攒够一车十件就能发；新路一开始就能发一车；平均下来不会超过运力
  const bud = {}, B0 = R.netBud || {}, B1 = R.netBud = {};
  for (const r of roads(S)) if (roadOn(r)) { const cap = roadCap(S, r); const w = cap * win / 60; bud[r.id] = Math.min(Math.max(NET_BATCH, w), (B0[r.id] ?? NET_BATCH) + w); N.road[r.id] = { cap, used: 0 }; }
  const inc = {}; for (const s of ships(S)) { const m = inc[s.to] || (inc[s.to] = {}); m[s.k] = (m[s.k] || 0) + s.n; }
  const G = [], lack = {};
  const lo = (L, k, t) => { L[k] = Math.min(L[k] ?? 99, t); };
  for (const c of S.camps) for (const g of campGaps(S, c, inc[c.id] || {})) { G.push(g); const L = lack[c.id] || (lack[c.id] = {}); lo(L, g.k, g.tier); if (g.k === '@fuel') for (const k in FUEL) lo(L, k, g.tier); }
  // 自己缺的东西不是不能给：只给比自己那档更急的（主营地攒着升熔炉的石料，照样先给前哨排队的房子）
  const spare = {}; for (const c of S.camps) { spare[c.id] = campSpare(S, c, {}); spare[c.id].__lack = lack[c.id] || {}; }
  // 同一档里主营地先拿，其余按离主营地近的先拿
  const m = mainCamp(S), dm = {};
  if (m) { const P = pathsTo(S, m.id, INF(S)); for (const id in P) dm[id] = P[id].t; }
  G.sort((a, b) => a.tier - b.tier || (b.main - a.main) || ((dm[a.c] ?? 1e9) - (dm[b.c] ?? 1e9)) || a.c - b.c);
  const minOf = g => g.tier === 5 || g.tier === 7 ? NET_BATCH : Math.min(NET_BATCH, Math.max(1, Math.floor(g.n)));
  const note = (g, r) => { if (r.left < 1) return; const o = N.short[g.c] || (N.short[g.c] = {}); if (!o[g.k] || o[g.k].tier > g.tier) o[g.k] = { tier: g.tier, n: r.left, why: g.why, jam: r.jam, none: r.none }; };
  const run = g => {
    (N.gaps[g.c] || (N.gaps[g.c] = [])).push(g);
    if (g.k === '@fuel') {
      let leftU = g.n, jam = false, none = true;
      for (const k of FUEL_SHIP) {
        if (leftU < 1 || RES[k].t > S.known) continue;
        const r = fill(S, { ...g, k, n: leftU / FUEL[k] }, spare, bud, N, Math.max(1, Math.min(NET_BATCH, Math.floor(leftU / FUEL[k]))));
        leftU = r.left * FUEL[k]; jam = jam || r.jam; none = none && r.none;
      }
      note(g, { left: leftU, jam, none }); // k 还是 '@fuel'：界面上写「燃料」
      return;
    }
    note(g, fill(S, g, spare, bud, N, minOf(g)));
  };
  // 同一档、同一个营地缺好几样：轮着一车一车地发，几样都先到一点，不会一样送满了才轮到下一样
  const runCamp = gs => {
    const fuel = gs.filter(g => g.k === '@fuel'); fuel.forEach(run);
    const all = gs.filter(g => g.k !== '@fuel').map(g => { (N.gaps[g.c] || (N.gaps[g.c] = [])).push(g); return { g, left: g.n, r: { left: g.n, jam: false, none: true } }; });
    const LS = R.netLast || (R.netLast = {}), key = p => p.g.c + ':' + p.g.k; // 最久没发过的那样先发，慢路上几样也能轮着来
    let pend = all.slice().sort((a, b) => (LS[key(a)] || 0) - (LS[key(b)] || 0));
    while (pend.length) {
      const next = [];
      for (const p of pend) {
        const minB = minOf(p.g), ch = Math.min(p.left, Math.max(minB, NET_BATCH));
        const r = fill(S, { ...p.g, n: ch }, spare, bud, N, minB), sent = ch - r.left;
        p.left -= sent; p.r = { ...r, left: p.left }; if (sent > 0) LS[key(p)] = S.t;
        if (sent > 0 && p.left >= minB) next.push(p);
      }
      pend = next;
    }
    for (const p of all) note(p.g, p.r);
  };
  const runTier = (lo, hi) => {
    const grp = [];
    for (; i < G.length && G[i].tier <= hi; i++) grp.push(G[i]);
    for (let a = 0; a < grp.length;) { let b = a; while (b < grp.length && grp[b].tier === grp[a].tier && grp[b].c === grp[a].c) b++; runCamp(grp.slice(a, b)); a = b; }
  };
  let i = 0;
  for (; i < G.length && G[i].tier <= 1; i++) run(G[i]);
  // 2 手动送的一批：可以动用留料，但不动保命的燃料和口粮
  for (const b of sends(S)) {
    if (b.left < 0.5) continue;
    const fc = getCamp(S, b.from); if (!fc) continue;
    const sp = { [b.from]: campSpare(S, fc, {}, true) };
    const r = fill(S, { c: b.to, k: b.k, n: b.left, tier: 2, src: 'manual', bid: b.id }, sp, bud, N, Math.min(NET_BATCH, Math.max(1, Math.floor(b.left))), b.from);
    const sent = b.left - r.left; b.left = r.left;
    if (spare[b.from] && spare[b.from][b.k] != null) spare[b.from][b.k] -= sent;
    if (r.left >= 1) note({ c: b.to, k: b.k, tier: 2, why: '手动送的' }, r);
  }
  runTier(3, 3);
  // 4 长期供货：每分钟 N 件，攒够一车就发
  for (const f of feeds(S)) {
    const fc = getCamp(S, f.from), tc = getCamp(S, f.to); if (!fc || !tc) continue;
    f.owed = Math.min(f.rate * 5, (f.owed || 0) + f.rate * win / 60);
    if (f.k === 'people') {
      let n = Math.floor(f.owed), moved = 0, free = Math.floor(Math.min(freeBeds(S, tc), popRoom(S, tc)));
      while (n-- > 0 && free > 0 && fc.people > MIN_PEOPLE + 3) { fc.people--; tc.people++; free--; moved++; }
      f.owed -= moved; if (moved) trimWorkers(S, fc);
      continue;
    }
    if (f.owed < Math.min(NET_BATCH, f.rate)) continue;
    const sp = { [f.from]: campSpare(S, fc, {}, false) }; delete (sp[f.from].__hold);
    const hold = fc.hold && fc.hold[f.k]; if (hold) { const s2 = campSpare(S, { ...fc, hold: null }, {}, false); sp[f.from][f.k] = s2[f.k] || 0; }
    const r = fill(S, { c: f.to, k: f.k, n: f.owed, tier: 4, src: 'feed' }, sp, bud, N, Math.min(NET_BATCH, f.owed), f.from);
    f.owed = r.left;
    if (spare[f.from] && spare[f.from][f.k] != null) spare[f.from][f.k] = Math.min(spare[f.from][f.k], sp[f.from][f.k] || 0);
  }
  runTier(5, 99);
  // 实际运量取一分钟左右的平均；没用完的运力留到下一轮
  const F = R.netFlow || (R.netFlow = {});
  for (const rid in N.road) { const nr = N.road[rid], f = nr.used / win * 60; F[rid] = (F[rid] ?? f) + (f - (F[rid] ?? f)) * Math.min(1, win / 60); nr.flow = F[rid]; B1[rid] = bud[rid]; }
  // 「路满了」只算真满的：一分钟平均跑到运力的八成五以上；只是这一轮刚好用完的不算，那些货下一车就走
  for (const rid in N.jam) { const nr = N.road[rid]; if (!nr || nr.flow < nr.cap * 0.85) delete N.jam[rid]; }
  const jk = new Set(); for (const rid in N.jam) for (const j of N.jam[rid]) jk.add(j.c + ':' + j.k);
  for (const cid in N.short) for (const k in N.short[cid]) { const q = N.short[cid][k]; if (q.jam && !jk.has(cid + ':' + k)) q.jam = false; }
}
export function netStep(S, dt) {
  if (!S.roads) migrateNet(S);
  pendStep(S);
  // 到站的货卸下来
  const L = ships(S);
  if (L.length) {
    const keep = [];
    for (const s of L) { if (S.t + dt >= s.t0 + s.dur) deliver(S, s); else keep.push(s); }
    S.ships = keep;
  }
  const R = rt(S); R.netT = (R.netT || 0) + dt;
  const tick = NET_TICK * netMul(S, 'tick');
  if (R.netT >= tick) { const win = R.netT; R.netT = 0; if (S.camps.length > 1) dispatch(S, win); }
}

// ---------- 手动 ----------
export function sendBatch(S, from, to, k, n) {
  const fc = getCamp(S, from), tc = getCamp(S, to);
  if (!fc || !tc || from === to) return { ok: false, reason: '选两个不同的营地' };
  if (!RES[k]) return { ok: false, reason: '选一样货' };
  const sp = campSpare(S, fc, {}, true)[k] || 0;
  const amt = n === 'all' ? Math.floor(campSpare(S, fc, {}, false)[k] || 0) : Math.min(+n, Math.floor(sp));
  if (amt < 1) return { ok: false, reason: `「${fc.name}」没有多余的${RES[k].n}` };
  if (!pathsTo(S, to, INF(S))[from]) return { ok: false, reason: '两个营地之间没有路，先修一条' };
  sends(S).push({ id: S.nextId++, from, to, k, n: amt, left: amt, arr: 0, t: S.t });
  dirty(S);
  return { ok: true, n: amt };
}
export function cancelSend(S, id) { S.sends = sends(S).filter(b => b.id !== id); dirty(S); }
export function addFeed(S, from, to, k, rate) {
  if (from === to || !getCamp(S, from) || !getCamp(S, to)) return { ok: false, reason: '选两个不同的营地' };
  if (feeds(S).filter(f => f.from === from).length >= FEED_MAX) return { ok: false, reason: `一个营地最多 ${FEED_MAX} 条长期供货` };
  const f = feeds(S).find(x => x.from === from && x.to === to && x.k === k);
  if (f) { f.rate = rate; dirty(S); return { ok: true }; }
  feeds(S).push({ id: S.nextId++, from, to, k, rate, owed: 0 });
  dirty(S);
  return { ok: true };
}
export function delFeed(S, id) { S.feeds = feeds(S).filter(f => f.id !== id); dirty(S); }
export function toggleHold(S, cid, k) {
  const c = getCamp(S, cid); if (!c) return;
  c.hold = c.hold || {};
  if (c.hold[k]) delete c.hold[k]; else c.hold[k] = 1;
  dirty(S);
}

// ---------- 给界面看的 ----------
// 每个营地：正在运来的、往外送的、还缺的（缺的写清从哪来、多久到；整张网都没有的标出来）
export function netView(S, cid) {
  const R = rt(S), N = R.net || {}, inc = {}, out = {};
  for (const s of ships(S)) {
    if (s.to === cid) { const o = inc[s.k] || (inc[s.k] = { n: 0, eta: Infinity, from: new Set() }); o.n += s.n; o.eta = Math.min(o.eta, s.t0 + s.dur - S.t); o.from.add(s.from); }
    if (s.from === cid) { const o = out[s.k] || (out[s.k] = { n: 0, to: new Set() }); o.n += s.n; o.to.add(s.to); }
  }
  return { inc, out, short: (N.short || {})[cid] || {}, gaps: (N.gaps || {})[cid] || [] };
}
export function netRoadView(S, r) {
  const R = rt(S), N = R.net || {}, nr = (N.road || {})[r.id] || {};
  let onRoad = 0; for (const s of ships(S)) { const p = shipPos(S, s); if (p && p.r === r) onRoad++; }
  return { cap: roadCap(S, r), flow: nr.flow || 0, jam: (N.jam || {})[r.id] || null, ships: onRoad };
}

// ---------- 旧存档 ----------
// 原来的运输线变成雪橇道（等级、铁路都保留），上面设好的路线变成长期供货；补给站往主营地的路按北迁顺序连成主干道；
// 补给站手动选过的「送哪几样」变成长期供货；还没连上的营地免费补一条雪橇道
export function migrateNet(S) {
  S.roads = []; S.ships = S.ships || []; S.sends = S.sends || []; S.feeds = S.feeds || [];
  const added = [];
  for (const l of S.lines || []) {
    if (!getCamp(S, l.a) || !getCamp(S, l.b) || roadBetween(S, l.a, l.b)) continue;
    const old = Math.max(1, (l.rail ? 50 : 12) * (1 + 0.5 * (l.lvl - 1)));
    addRoadRaw(S, l.a, l.b, l.rail ? 'rail' : 'sled', Math.min(ROAD_MAX, l.lvl));
    const act = (l.routes || []).filter(r => r.res);
    for (const r of act) {
      const from = r.from === 'b' ? l.b : l.a, to = from === l.a ? l.b : l.a;
      if (feeds(S).filter(f => f.from === from).length >= FEED_MAX) continue;
      feeds(S).push({ id: S.nextId++, from, to, k: r.res, rate: r.res === 'people' ? 0.67 : Math.max(1, Math.round(old / act.length)), owed: 0 });
    }
  }
  S.lines = [];
  for (const c of S.camps) c.gotFirst = 1; // 老营地不再报「第一批货到了」
  const m = mainCamp(S);
  if (m) {
    const chain = S.camps.filter(c => c.depot && c.id !== m.id).sort((a, b) => a.y - b.y);
    chain.push(m);
    // 主干道的等级跟上原来补给站的运量（原来每分钟 24×(1+人/40)，离得远慢一些）
    for (let i = 1; i < chain.length; i++) {
      const c = chain[i - 1], r = trunkRoad(S, c.id, chain[i].id); if (!r) continue;
      added.push(r.id);
      const d = Math.hypot(c.x - m.x, c.y - m.y), old = 24 * (1 + c.people / 40) * Math.max(0.35, Math.min(1, 80 / Math.max(1, d)));
      r.lvl = Math.max(r.lvl, Math.min(ROAD_MAX, Math.ceil((old / ROAD.trunk.cap - 1) / 0.5 + 1)));
    }
    for (const c of S.camps) {
      if (!c.depot || c.id === m.id) continue;
      if (c.send && c.send.length) for (const k of c.send) if (RES[k] && feeds(S).filter(f => f.from === c.id).length < FEED_MAX) feeds(S).push({ id: S.nextId++, from: c.id, to: m.id, k, rate: 20, owed: 0 });
      delete c.send;
    }
  }
  if (S.camps.length > 1) for (const c of S.camps) { const r = autoRoad(S, c.id); if (r) added.push(r.id); }
  S.meta.netNew = added;
}
