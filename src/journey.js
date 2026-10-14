// 寒烬北行 · 一路往北：每一程的状态、北迁门槛、车队、新营地的范围
// 整局只有一条路：主营地带着车队从一个地标搬到下一个，留在后面的营地变成补给站或者熄火
import { LANDMARKS, FAR_MARKS, BLD, RES, FUEL, FUEL_ORDER, SPOT_KEYS, furnaceBurn } from './data.js';
import { W, H, T_ROCK, getWorld, idx, inMap } from './worldgen.js';
import {
  rt, dirty, getB, getCamp, logMsg, revealCircle, canAfford, missing, pay, chapters, makeCamp, markFounded, trimWorkers,
  autoAssign, clearFootprint, landmarkBlock, siteAt, occAt, housingOf, bumpMood, diffOf, relicSum, upgradeCost, maxWorkers, levelMul,
  EAT, FOUND_DIST, CAMP_GAP,
} from './sim.js';

// ---------- 一程一程的站 ----------
// 0～6 是七个地标，7～12 是永恒之炉以北的六个远方地标，世界之脊（12）是终点
export const STOP_N = LANDMARKS.length + FAR_MARKS.length;
export function stopOf(S, k) {
  if (k < 0 || k >= STOP_N) return null;
  if (k < LANDMARKS.length) { const l = LANDMARKS[k]; return { k, n: l.n, x: l.x, y: l.row, far: false }; }
  const i = k - LANDMARKS.length, p = (getWorld(S.runSeed).far || [])[i];
  return p ? { k, n: FAR_MARKS[i].n, x: p.x + 0.5, y: p.y + 0.5, far: true, fi: i } : null;
}
// 离开第 k 站时主营地熔炉要几级：3、7、11……27，永恒之炉以北每程再 +2
export const gateFlvl = k => k < LANDMARKS.length ? 3 + 4 * k : 27 + 2 * (k - LANDMARKS.length + 1);

export const ARRIVE_R = 10;      // 探出来的路走到离地标这么近，就算路通了
export const PERSON_LOAD = 40;   // 一个人在车上占 40 份货的地方
export const DEPOT_MIN = 10;     // 留守成补给站至少留下的人
export const CREW = 3;           // 熄火的营地留几个人守火，车队到了再跟上
export const ARRIVE_AUTO = 90;   // 车队到了以后这么久没人选地方，就放在推荐的位置
export const VEH = {
  sled: { n: '雪橇', cap: 200, fuel: 'wood', cost: { wood: 60, plank: 30 }, secs: 45 },
  tractor: { n: '蒸汽拖车', cap: 1000, fuel: 'coal', cost: { steel: 30, gear: 10, engine: 1 }, secs: 120, from: 2 },
};
export const VEH_KEYS = Object.keys(VEH);
export const FURNACE_KIT = { wood: 260, stone: 160, plank: 60 }; // 点新熔炉的材料，装在车上带过去

export function journeyOf(S) {
  if (!S.journey) {
    // 老存档：最北边的营地当主营地，其他营地变成补给站
    const main = S.camps.slice().sort((a, b) => b.y - a.y)[0];
    let stage = 0;
    for (let k = 0; k < STOP_N; k++) {
      const p = stopOf(S, k); if (!p) break;
      if (Math.hypot(p.x - main.x, p.y - main.y) <= FOUND_DIST + 2 || p.y <= main.y) stage = k;
    }
    S.journey = { stage, main: main.id, trip: null, fleet: { sled: 0, tractor: 0 }, plan: {}, legs: [], ruins: [] };
    if (S.t > 0) for (const c of S.camps) if (c.id !== main.id) c.depot = true;
    // 章节任务换了（第一项改成产能目标）：领过奖的章节照旧算完，没领的按新任务重新算
    const C = S.chap;
    if (C && C.ok) for (const key of Object.keys(C.ok)) if (!(C.got || {})[key.split(':')[0]]) delete C.ok[key];
  }
  return S.journey;
}
export function mainCamp(S) { return getCamp(S, journeyOf(S).main) || S.camps[0]; }
export function isMain(S, c) { return !!c && journeyOf(S).main === c.id; }

// ---------- 这一程的范围：前哨营地只能建在主营地和下一个地标之间 ----------
export function outpostRange(S) {
  const J = journeyOf(S), cur = stopOf(S, J.stage), nx = stopOf(S, J.stage + 1);
  return { y0: cur.y - 16, y1: nx ? nx.y - FOUND_DIST - 2 : H - 1, next: nx };
}
export function outpostBlock(S, cy) {
  const J = journeyOf(S);
  if (J.trip) return '车队在路上：到了新地标再开新营地';
  const r = outpostRange(S);
  if (cy > r.y1) return `超出这一程的范围：「${r.next.n}」附近要等车队北迁过去，这里先不能占`;
  if (cy < r.y0) return '太靠南了：新营地要开在主营地和下一个地标之间';
  return '';
}
// 先遣队要带的口粮和燃料：离出发的营地越远带得越多
export function outpostKit(S, payer, cx, cy) {
  const d = Math.hypot(payer.x - cx, payer.y - cy);
  return { food: Math.round(60 + 3 * d), fuel: Math.round(40 + 2 * d), d };
}
// 从 from 拿走 units 份燃料（先拿木材、煤这些便宜的），原样放进 to；返回实际拿了多少份
export function moveFuel(from, to, units) {
  let need = units;
  for (const f of [...FUEL_ORDER].reverse()) {
    if (need <= 0) break;
    const take = Math.min(from[f] || 0, Math.ceil(need / FUEL[f]));
    if (take <= 0) continue;
    from[f] -= take; if (to) to[f] = (to[f] || 0) + take; need -= take * FUEL[f];
  }
  return units - Math.max(0, need);
}
export function fuelUnits(st) { let u = 0; for (const f in FUEL) u += (st[f] || 0) * FUEL[f]; return u; }

// ---------- 探路：从主营地沿着雾外的雪地能不能走到下一个地标 ----------
const passable = (S, w, x, y) => inMap(x, y) && S.reveal[idx(x, y)] === 1 && w.terrain[idx(x, y)] !== T_ROCK;
export function routeInfo(S) {
  const J = journeyOf(S), R = rt(S), main = mainCamp(S), nx = stopOf(S, J.stage + 1);
  if (!nx || !main) return { ok: false, none: true, gap: 0, len: 0, path: [] };
  const key = `${J.stage}:${main.id}:${R.revealN || 0}`;
  if (R.route && R.route.key === key) return R.route;
  const w = getWorld(S.runSeed);
  const y0 = Math.max(0, Math.floor(Math.min(main.y, nx.y) - 14)), y1 = Math.min(H - 1, Math.ceil(Math.max(main.y, nx.y) + 14));
  const N = W * (y1 - y0 + 1), prev = new Int32Array(N).fill(-2);
  const sx = Math.floor(main.x), sy = Math.floor(main.y), li = (x, y) => (y - y0) * W + x;
  const goal = (x, y) => Math.hypot(x + 0.5 - nx.x, y + 0.5 - nx.y) <= ARRIVE_R;
  let q = [li(sx, sy)], hit = -1, best = 1e9;
  prev[q[0]] = -1;
  for (let h = 0; h < q.length && hit < 0; h++) {
    const c = q[h], x = c % W, y = y0 + Math.floor(c / W);
    const g = Math.hypot(x + 0.5 - nx.x, y + 0.5 - nx.y);
    if (g < best) best = g;
    if (goal(x, y)) { hit = c; break; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (yy < y0 || yy > y1 || !passable(S, w, xx, yy)) continue;
      if (dx && dy && !(passable(S, w, x + dx, y) && passable(S, w, x, y + dy))) continue; // 不从石头缝的对角钻过去
      const j = li(xx, yy);
      if (prev[j] !== -2) continue;
      prev[j] = c; q.push(j);
    }
  }
  let out;
  if (hit < 0) out = { ok: false, gap: Math.max(1, Math.round(best - ARRIVE_R)), len: 0, path: [] };
  else {
    const tiles = [];
    for (let c = hit; c >= 0; c = prev[c]) tiles.push([c % W + 0.5, y0 + Math.floor(c / W) + 0.5]);
    tiles.reverse();
    const path = smooth(S, w, tiles);
    let len = 0; for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    out = { ok: true, gap: 0, len, path };
  }
  out.key = key;
  R.route = out;
  return out;
}
// 拉直：能直接看到的点就跳过中间的格子
function smooth(S, w, P) {
  if (P.length <= 2) return P;
  const sees = (a, b) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    for (let i = 1; i < n; i++) { const t = i / n; if (!passable(S, w, Math.floor(a[0] + (b[0] - a[0]) * t), Math.floor(a[1] + (b[1] - a[1]) * t))) return false; }
    return true;
  };
  const out = [P[0]];
  let i = 0;
  while (i < P.length - 1) {
    let j = P.length - 1;
    while (j > i + 1 && !sees(P[i], P[j])) j--;
    out.push(P[j]); i = j;
  }
  return out;
}

// ---------- 车队怎么装 ----------
const sum = o => { let n = 0; for (const k in o) n += o[k] || 0; return n; };
const addTo = (a, b) => { for (const k in b) if (b[k]) a[k] = (a[k] || 0) + b[k]; return a; };
export function specsIn(S, cid) {
  return Object.keys(S.meta.specs || {}).filter(sid => { const bid = S.specAt[sid]; if (bid == null) return true; const b = getB(S, bid); return !b || b.camp === cid; });
}
// 默认带的货：新营地半小时的口粮和燃料，再加搭帐篷的木材
export function defaultGoods(S, main, people, fl) {
  const st = main.stock, g = {};
  g.food = Math.ceil(people * EAT * 30);
  g.wood = 25 * Math.ceil(people / 5) + 60;
  let fuel = Math.ceil(furnaceBurn(fl) * 30);
  for (const f of FUEL_ORDER) { // 优先带热值高的燃料，车上省地方
    if (fuel <= 0) break;
    const n = Math.min(Math.floor(st[f] || 0) - (g[f] || 0), Math.ceil(fuel / FUEL[f]));
    if (n > 0) { g[f] = (g[f] || 0) + n; fuel -= n * FUEL[f]; }
  }
  // 新熔炉接着升两级要的门槛材料（铁锭、钢材这些）：到了新地方一时做不出来，有多少带多少
  for (const L of [fl, fl + 1]) {
    const c = upgradeCost(S, { type: 'furnace', lvl: L });
    for (const k in c) if (!FURNACE_KIT[k] && !FUEL[k]) g[k] = Math.min(Math.floor(st[k] || 0), (g[k] || 0) + c[k]);
  }
  for (const k in g) if (!(g[k] > 0)) delete g[k];
  return g;
}
export function tripPlan(S) {
  const J = journeyOf(S), main = mainCamp(S), P = J.plan || (J.plan = {});
  const route = routeInfo(S), nx = stopOf(S, J.stage + 1);
  const len = route.ok ? route.len : nx ? Math.abs(nx.y - main.y) * 1.2 : 0;
  const fl = getB(S, main.furnace).lvl;
  const camps = S.camps.map(c => {
    const mode = (P.mode && P.mode[c.id]) || 'keep', im = c.id === main.id;
    let stay, go;
    if (mode === 'douse') { stay = Math.min(CREW, c.people); go = c.people - stay; }
    else if (im) { stay = Math.max(DEPOT_MIN, Math.min(c.people, P.stay ?? DEPOT_MIN)); go = Math.max(0, c.people - stay); }
    else { stay = c.people; go = 0; }
    const lvl = getB(S, c.furnace).lvl;
    return { id: c.id, name: c.name, mode, main: im, people: c.people, stay, go, lvl, embers: mode === 'douse' ? douseEmbers(S, lvl) : 0 };
  });
  const people = camps.reduce((a, c) => a + c.go, 0);
  const specs = specsIn(S, main.id);
  const goods = P.goods ? { ...P.goods } : defaultGoods(S, main, people, fl);
  const kit = { ...FURNACE_KIT };
  const steps = Math.ceil(len / 10);
  // 先挑拖车（大、快），不够再上雪橇；燃料也占地方，所以算两遍
  const fleet = J.fleet, veh = { sled: 0, tractor: 0 };
  let base = people * PERSON_LOAD + sum(goods) + sum(kit) + people * steps, cap = 0;
  for (let pass = 0; pass < 2; pass++) {
    const need = base + (veh.sled + veh.tractor) * steps;
    veh.sled = 0; veh.tractor = 0; cap = 0;
    for (const v of ['tractor', 'sled']) while (cap < need && veh[v] < (fleet[v] || 0)) { veh[v]++; cap += VEH[v].cap; }
  }
  const load = base + (veh.sled + veh.tractor) * steps;
  const supplies = { food: people * steps };
  if (veh.sled) supplies.wood = veh.sled * steps;
  if (veh.tractor) supplies.coal = veh.tractor * steps;
  const need = addTo(addTo(addTo({}, goods), kit), supplies);
  const short = missing(main.stock, need);
  const fullCap = (fleet.sled || 0) * VEH.sled.cap + (fleet.tractor || 0) * VEH.tractor.cap;
  const secs = tripSecs(len, !veh.sled && veh.tractor > 0), speed = len / Math.max(1, secs);
  const roomOk = fullCap >= load;
  return {
    to: nx, len, steps, fl, camps, people, specs, goods, kit, supplies, need, veh, load, cap: fullCap, roomOk,
    lack: Math.max(0, load - fullCap), short, speed, secs,
    ok: !!nx && route.ok && roomOk && !short.length && people >= 5,
  };
}
// 路上要走多久：每程 4 到 6 分钟，路越长越久；全是拖车的话快一半
export const tripSecs = (len, fast) => Math.max(240, Math.min(360, 240 + (len - 35) * 2)) / (fast ? 1.5 : 1);
export const douseEmbers = (S, lvl) => Math.round(2 * lvl * (1 + relicSum(S, 'ember')) * diffOf(S).ember);

// ---------- 北迁门槛：四条全满足才能出发 ----------
export function departGate(S) {
  const J = journeyOf(S), k = J.stage, nx = stopOf(S, k + 1), main = mainCamp(S);
  if (!nx) return null;
  const route = routeInfo(S), plan = tripPlan(S);
  const ch = chapters(S).find(c => c.i === k);
  const left = ch ? ch.tasks.filter(t => !t.ok).length : 0;
  const fl = getB(S, main.furnace).lvl, need = gateFlvl(k);
  const items = [
    { id: 'route', ok: route.ok, t: '路探到了', sub: route.ok ? `路长约 ${Math.round(route.len)} 格` : `从主营地往「${nx.n}」的路还差约 ${route.gap} 格没探开` },
    { id: 'chap', ok: !ch || ch.done, t: ch ? `做完「${ch.ch.n}」` : '这一章做完了', sub: !ch || ch.done ? '做完了' : `还有 ${left} 项任务` },
    { id: 'flvl', ok: fl >= need, t: `主营地熔炉 ${need} 级`, sub: `现在 ${fl} 级`, cur: fl, n: need },
    { id: 'car', ok: plan.roomOk && !plan.short.length && plan.people >= 5, t: '车队备好了',
      sub: plan.people < 5 ? '至少要有 5 个人上路' : !plan.roomOk ? `车上还差 ${plan.lack} 份地方（约 ${Math.ceil(plan.lack / VEH.sled.cap)} 架雪橇）` : plan.short.length ? '缺：' + plan.short.join('，') : `${plan.people} 人，${plan.veh.tractor ? plan.veh.tractor + ' 辆拖车 ' : ''}${plan.veh.sled ? plan.veh.sled + ' 辆雪橇' : ''}` },
  ];
  return { k, next: nx, items, n: items.filter(i => i.ok).length, ok: items.every(i => i.ok), plan, route };
}
export function setPlan(S, patch) { const J = journeyOf(S); J.plan = { ...(J.plan || {}), ...patch }; }
export function setCampMode(S, cid, mode) { const J = journeyOf(S); J.plan = J.plan || {}; (J.plan.mode || (J.plan.mode = {}))[cid] = mode === 'douse' ? 'douse' : 'keep'; }

// ---------- 出发 ----------
export function depart(S) {
  const J = journeyOf(S), g = departGate(S);
  if (!g) return { ok: false, reason: '已经走到尽头了' };
  if (J.trip) return { ok: false, reason: '车队已经在路上' };
  if (!g.ok) return { ok: false, reason: g.items.filter(i => !i.ok).map(i => i.t + '：' + i.sub).join('；') };
  const p = g.plan, main = mainCamp(S);
  pay(main.stock, p.need);
  for (const c of p.camps) {
    if (!c.go) continue;
    const camp = getCamp(S, c.id);
    camp.people -= c.go;
    trimWorkers(S, camp);
  }
  for (const sid of p.specs) delete S.specAt[sid];
  J.trip = {
    from: J.stage, to: J.stage + 1, path: g.route.path.map(q => q.slice()), len: g.route.len, d: 0, speed: p.speed,
    people: p.people, specs: p.specs.slice(), goods: addTo({ ...p.goods }, p.kit), veh: { ...p.veh }, fl: p.fl, t0: S.t,
    camps: p.camps.map(c => ({ id: c.id, mode: c.mode, main: c.main })), phase: 'go',
  };
  dirty(S);
  logMsg(S, `🛷 车队从「${main.name}」出发了：${p.people} 人，往北去「${g.next.n}」。路上大约 ${Math.max(1, Math.round(p.secs / 60))} 分钟。`, 'story');
  rt(S).fx.push({ kind: 'depart', to: J.trip.to });
  return { ok: true };
}
// ---------- 雪橇棚：造车。造好的车归车队，跟着主营地走 ----------
export const VQ_MAX = 10;
export const vehName = v => v === 'sled' ? '雪橇' : '蒸汽拖车';
export function vehBlock(S, b, v) {
  const V = VEH[v]; if (!V || !b || b.type !== 'sledshed') return '这里造不了';
  if (V.from && journeyOf(S).stage < V.from) return `到了「${stopOf(S, V.from).n}」以后才能造`;
  for (const k in V.cost) if (RES[k].t > S.known) return `需要「${RES[k].n}」`;
  if ((b.vq || []).length >= VQ_MAX) return `最多排 ${VQ_MAX} 辆`;
  const camp = getCamp(S, b.camp);
  if (!canAfford(camp.stock, V.cost)) return '缺：' + missing(camp.stock, V.cost).join('，');
  return '';
}
export function orderVeh(S, bid, v, n = 1) {
  const b = getB(S, bid); let made = 0, why = '';
  for (let i = 0; i < n; i++) { why = vehBlock(S, b, v); if (why) break; pay(getCamp(S, b.camp).stock, VEH[v].cost); (b.vq || (b.vq = [])).push({ v, p: 0 }); made++; }
  if (made) dirty(S);
  return made ? { ok: true, n: made, reason: why } : { ok: false, reason: why };
}
export function cancelVeh(S, bid, i) {
  const b = getB(S, bid); if (!b || !b.vq || !b.vq[i]) return;
  const q = b.vq.splice(i, 1)[0], st = getCamp(S, b.camp).stock;
  for (const k in VEH[q.v].cost) st[k] = (st[k] || 0) + VEH[q.v].cost[k];
  dirty(S);
}
// 造车速度：满员时雪橇 45 秒一架、拖车 2 分钟一台；每升一级快 15%
export function vehSpeed(S, b) { const mx = maxWorkers(b.type, b.lvl); return (mx ? Math.min(1, b.workers / mx) : 0) * levelMul(b.lvl); }
function vehStep(S, dt) {
  const R = rt(S), J = journeyOf(S);
  for (const b of S.buildings) {
    if (b.type !== 'sledshed') continue;
    const br = R.b[b.id] || (R.b[b.id] = {}), q = b.vq && b.vq[0], sp = vehSpeed(S, b);
    br.act = q ? sp : 0; br.staff = sp;
    if (!q) { br.status = '空闲'; continue; }
    if (!b.workers) { br.status = '没有派人'; continue; }
    br.status = `在造${vehName(q.v)} ${Math.floor(q.p * 100)}%`;
    q.p += dt * sp / VEH[q.v].secs;
    if (q.p < 1) continue;
    b.vq.shift();
    J.fleet[q.v] = (J.fleet[q.v] || 0) + 1;
    R.fx.push({ kind: 'veh', b: b.id, v: q.v });
    if (!b.vq.length) logMsg(S, `🛷 雪橇棚的车造完了：车队现在有 ${J.fleet.sled || 0} 架雪橇${J.fleet.tractor ? `、${J.fleet.tractor} 台蒸汽拖车` : ''}。`, 'good', { act: 'spot', arg: b.id, label: '看看' });
    dirty(S);
  }
}

// 车队现在在哪
export function tripPos(trip) {
  let d = trip.d;
  const P = trip.path;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= L || i === P.length - 1) { const t = L ? Math.min(1, d / L) : 1; return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, dir: Math.atan2(b[1] - a[1], b[0] - a[0]) }; }
    d -= L;
  }
  const e = P[P.length - 1] || [0, 0];
  return { x: e[0], y: e[1], dir: Math.PI / 2 };
}

// ---------- 到了：放下新熔炉 ----------
export function arriveCheck(S, x, y) {
  const J = journeyOf(S), T = J.trip;
  if (!T || T.phase !== 'arrive') return { ok: false, reason: '车队还没到' };
  const st = stopOf(S, T.to), w = getWorld(S.runSeed), cx = x + 1.5, cy = y + 1.5;
  if (Math.hypot(cx - st.x, cy - st.y) > FOUND_DIST - 1) return { ok: false, reason: `要放在「${st.n}」附近 ${FOUND_DIST - 1} 格以内` };
  for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 3; xx++) {
    if (!inMap(xx, yy)) return { ok: false, reason: '超出地图' };
    const i = idx(xx, yy);
    if (!S.reveal[i]) return { ok: false, reason: '迷雾里不能建造' };
    if (w.terrain[i] !== 0) return { ok: false, reason: '地形不平（岩石或冰湖）' };
    if (occAt(S, xx, yy)) return { ok: false, reason: '和其他建筑重叠' };
    if (landmarkBlock(xx, yy, S)) return { ok: false, reason: '地标遗迹占着这里' };
    if (siteAt(S, xx, yy, 1)) return { ok: false, reason: '这里有一处遗迹' };
    if (w.spot[i] >= 0 && !['tree', 'rock', 'herd'].includes(spotKey(w, i)) && S.spots[i] !== 0) return { ok: false, reason: '这里是矿点' };
  }
  for (const c of S.camps) if (Math.hypot(c.x - cx, c.y - cy) < CAMP_GAP) return { ok: false, reason: `离「${c.name}」太近` };
  return { ok: true };
}
const spotKey = (w, i) => SPOT_KEYS[w.spot[i]];
// 推荐的位置：地标南边几格、离地标最近的一块平地
export function arriveSpot(S) {
  const J = journeyOf(S), T = J.trip; if (!T) return null;
  const st = stopOf(S, T.to);
  const r = st.far ? FAR_MARKS[st.fi].r : 2.5;
  const ideal = { x: st.x, y: st.y - r - 4.5 };
  let best = null, bs = 1e9;
  for (let y = Math.floor(st.y - FOUND_DIST); y <= st.y + FOUND_DIST; y++) for (let x = Math.floor(st.x - FOUND_DIST); x <= st.x + FOUND_DIST; x++) {
    const sc = Math.hypot(x + 1.5 - ideal.x, y + 1.5 - ideal.y) + (y + 1.5 > st.y ? 6 : 0);
    if (sc >= bs) continue;
    if (arriveCheck(S, x, y).ok) { bs = sc; best = { x, y }; }
  }
  return best;
}
export function arrive(S, x, y) {
  const J = journeyOf(S), T = J.trip;
  if (x == null) { const a = arriveSpot(S); if (!a) return { ok: false, reason: '附近找不到能放熔炉的平地' }; x = a.x; y = a.y; }
  const ck = arriveCheck(S, x, y); if (!ck.ok) return ck;
  const st = stopOf(S, T.to);
  const camp = makeCamp(S, x, y, st.n);
  clearFootprint(S, 'furnace', x, y, camp.id);
  getB(S, camp.furnace).lvl = T.fl;
  camp.people = T.people;
  addTo(camp.stock, T.goods);
  for (const k of Object.keys(FURNACE_KIT)) camp.stock[k] = Math.max(0, (camp.stock[k] || 0) - FURNACE_KIT[k]); // 点炉用掉
  // 后面的营地：留守的变成补给站；熄火的把守火的人和一部分材料带上来，留下一片废墟
  let embers = 0;
  for (const m of T.camps) {
    const c = getCamp(S, m.id); if (!c) continue;
    if (m.mode === 'douse') {
      const lvl = getB(S, c.furnace).lvl;
      camp.people += c.people;
      for (const k in c.stock) if (c.stock[k] > 0) camp.stock[k] = (camp.stock[k] || 0) + Math.floor(c.stock[k] * 0.3);
      embers += douseEmbers(S, lvl);
      J.ruins.push({ x: c.x, y: c.y, lvl, n: c.name, t: S.t, b: S.buildings.filter(b => b.camp === c.id && b.type !== 'furnace').map(b => [b.type, b.x, b.y]) });
      removeCamp(S, c.id, camp.id);
    } else { c.depot = true; delete c.focus; }
  }
  if (embers) { S.meta.embers += embers; S.meta.emberTotal = (S.meta.emberTotal || 0) + embers; }
  J.legs.push({ from: T.from, to: T.to, t0: T.t0, t1: S.t, people: T.people });
  J.stage = T.to; J.main = camp.id; J.trip = null; J.plan = {};
  S.active = camp.id;
  S.safeUntil = Math.max(S.safeUntil || 0, S.t + 3600); // 刚到的营地一小时内不会遇袭
  revealCircle(S, st.x, st.y, 14);
  markFounded(S, camp);
  const tents = arriveTents(S, camp);
  autoAssign(S, camp);
  dirty(S);
  for (const c of S.camps) bumpMood(c, 6, -3);
  logMsg(S, `🔥 车队到了「${st.n}」，新熔炉点着了（${T.fl} 级）。${tents ? `先搭好了 ${tents} 顶帐篷。` : ''}${embers ? `熄火的营地换来 ${embers} 点余烬。` : ''}`, 'story');
  rt(S).fx.push({ kind: 'arrive-stop', k: J.stage });
  return { ok: true, camp: camp.id };
}
// 到了先把帐篷搭起来：用车上带来的木材，紧挨着熔炉
function arriveTents(S, camp) {
  const f = getB(S, camp.furnace), cx = f.x + 1.5, cy = f.y + 1.5, R = 6;
  let n = 0, beds = 0;
  while (beds < camp.people && canAfford(camp.stock, BLD.tent.cost) && n < 12) {
    let best = null, bs = 1e9;
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const d = Math.hypot(x + 1 - cx, y + 1 - cy);
      if (d < 2.6 || d >= bs) continue;
      if (!tentFits(S, x, y)) continue;
      bs = d; best = [x, y];
    }
    if (!best) break;
    pay(camp.stock, BLD.tent.cost);
    clearFootprint(S, 'tent', best[0], best[1], camp.id);
    const b = { id: S.nextId++, type: 'tent', x: best[0], y: best[1], lvl: 1, workers: 0, camp: camp.id };
    S.buildings.push(b); dirty(S);
    beds += housingOf(b); n++;
  }
  return n;
}
function tentFits(S, x, y) {
  const w = getWorld(S.runSeed);
  for (let yy = y; yy < y + 2; yy++) for (let xx = x; xx < x + 2; xx++) {
    if (!inMap(xx, yy)) return false;
    const i = idx(xx, yy);
    if (!S.reveal[i] || w.terrain[i] !== 0 || occAt(S, xx, yy) || landmarkBlock(xx, yy, S) || siteAt(S, xx, yy, 1)) return false;
    if (w.spot[i] >= 0 && !['tree', 'rock', 'herd'].includes(spotKey(w, i)) && S.spots[i] !== 0) return false;
  }
  return true;
}
// 把一座营地从地图上拿掉（熄火）：它的建筑、运输线、排队、侦察队都要收拾干净
export function removeCamp(S, cid, to) {
  const gone = new Set(S.buildings.filter(b => b.camp === cid).map(b => b.id));
  S.buildings = S.buildings.filter(b => b.camp !== cid);
  S.camps = S.camps.filter(c => c.id !== cid);
  S.lines = (S.lines || []).filter(l => l.a !== cid && l.b !== cid);
  S.queue = (S.queue || []).filter(q => q.camp !== cid);
  S.reqs = (S.reqs || []).filter(r => r.camp !== cid);
  for (const s of S.scouts) if (s.camp === cid) s.camp = to;
  for (const sid in S.specAt) if (gone.has(S.specAt[sid])) delete S.specAt[sid];
  if (S.car && S.car.camp === cid) S.car = null;
  if (S.sur && S.sur.camp === cid) S.sur = null;
  if (S.rprep && S.rprep.camp === cid) S.rprep = null;
  if (S.active === cid) S.active = to;
  if (S.gangs) for (const k in S.gangs) { const g = S.gangs[k]; if (g && g.dem && g.dem.camp === cid) delete g.dem; }
  dirty(S);
}

// ---------- 每一步 ----------
export function journeyStep(S, dt) {
  vehStep(S, dt);
  const J = journeyOf(S), T = J.trip;
  if (!T) return;
  if (T.phase === 'go') {
    T.d += T.speed * dt;
    if (T.d >= T.len) {
      T.d = T.len; T.phase = 'arrive'; T.at = S.t;
      const st = stopOf(S, T.to);
      revealCircle(S, st.x, st.y, 14);
      logMsg(S, `车队到了「${st.n}」。选一块地放下新熔炉吧（${ARRIVE_AUTO / 60 | 0} 分钟内没选，就放在推荐的位置）。`, 'good', { act: 'arrive', label: '去放熔炉' });
      rt(S).fx.push({ kind: 'trip-arrived', k: T.to });
    }
  } else if (T.phase === 'arrive' && (rt(S).offline || S.t - T.at >= ARRIVE_AUTO)) {
    const r = arrive(S);
    if (!r.ok) T.at = S.t; // 实在放不下就过一会儿再试
  }
}
