// 寒烬北行 · 一路往北：每一程的状态、北迁门槛、车队、新营地的范围
// 整局只有一条路：主营地带着车队从一个地标搬到下一个，留在后面的营地变成补给站或者熄火
import { LANDMARKS, FAR_MARKS, BLD, RES, RES_KEYS, FUEL, FUEL_ORDER, SPOT_KEYS, furnaceBurn, furnaceRadius, NORTH_RULES, NORTH_MARKS } from './data.js';
import { W, H, T_ROCK, getWorld, idx, inMap, mulberry32, northStop } from './worldgen.js';
import {
  rt, dirty, getB, getCamp, logMsg, revealCircle, canAfford, missing, pay, chapters, makeCamp, markFounded, trimWorkers, specForStop,
  autoAssign, clearFootprint, landmarkBlock, siteAt, occAt, housingOf, bumpMood, diffOf, relicSum, upgradeCost, maxWorkers, levelMul,
  storeCap, addPeople, up, techSum, weatherAt, growFor, northEmbers,
  EAT, FOUND_DIST, CAMP_GAP,
} from './sim.js';
import { trunkRoad, healNet } from './net.js';
import { forkOf, pickFork, qyArrive, qyLeave } from './north.js';
import { wonderTrip } from './wonder.js';

// ---------- 一程一程的站 ----------
// 0～6 是七个地标，7～12 是永恒之炉以北的六个远方地标，世界之脊（12）以北是北境，一站接一站没有尽头
export const STOP_N = LANDMARKS.length + FAR_MARKS.length; // 有名字的站（到世界之脊为止）
export const SPINE = STOP_N - 1;
export const northN = k => k > SPINE ? k - SPINE : 0;      // 第 k 站是北境第几站（0：不是北境）
export function stopOf(S, k) {
  if (k < 0) return null;
  if (k < LANDMARKS.length) { const l = LANDMARKS[k]; return { k, n: l.n, x: l.x, y: l.row, far: false }; }
  if (k > SPINE) {
    const p = northStop(S.runSeed, k - SPINE);
    return { k, n: `북방번째 역 ${p.k}·${p.name}`, short: p.name, x: p.x + 0.5, y: p.y + 0.5, far: true, north: p.k, r: p.r, rule: p.rule, mark: p.mark, rich: p.rich };
  }
  const i = k - LANDMARKS.length, p = (getWorld(S.runSeed).far || [])[i];
  return p ? { k, n: FAR_MARKS[i].n, x: p.x + 0.5, y: p.y + 0.5, far: true, fi: i, r: FAR_MARKS[i].r } : null;
}
export const ruleOf = st => st && st.rule ? NORTH_RULES[st.rule] : null;
// ---------- 地貌规则：只管当前这一站的主营地，走了就没了 ----------
export function ruleNow(S) { const J = journeyOf(S); return J.stage > SPINE ? northStop(S.runSeed, J.stage - SPINE).rule : null; }
export function campRule(S, camp) { return camp && camp.id === journeyOf(S).main ? ruleNow(S) : null; }
// 哪段时间在哪条规则下（天气、袭营、流星的时间表按到站时间排，走了以后排好的那些也就没了）
export function ruleSpans(S, r) { const h = journeyOf(S).rh; return h ? h.filter(x => x.r === r) : []; }
export function ruleSpan(S, t) { for (const h of journeyOf(S).rh || []) if (t >= h.t0 && (h.t1 == null || t < h.t1)) return h; return null; }
// 这一站的地貌任务计数（到站时清零）
export function nsOf(S) { const J = journeyOf(S); return J.ns && J.ns.k === J.stage ? J.ns : (J.ns = { k: J.stage }); }
// 离开第 k 站时主营地熔炉要几级：3、7、11……27，永恒之炉以北每程再 +2；到了世界之脊就不再往上加
export const gateFlvl = k => k < LANDMARKS.length ? 3 + 4 * k : 27 + 2 * (Math.min(k, SPINE - 1) - LANDMARKS.length + 1);
// 地图得生成到下一站再往北一截
export function growNext(S) { const J = journeyOf(S), nx = stopOf(S, J.stage + 1); return nx ? growFor(S, nx.y) : false; }

export const ARRIVE_R = 10;      // 探出来的路走到离地标这么近，就算路通了
export const PERSON_LOAD = 40;   // 一个人在车上占 40 份货的地方
export const DEPOT_MIN = 10;     // 留守成补给站至少留下的人
export const CREW = 3;           // 熄火的营地留几个人守火，车队到了再跟上
export const ARRIVE_AUTO = 90;   // 车队到了以后这么久没人选地方，就放在推荐的位置
export const VEH = {
  sled: { n: '썰매', cap: 200, fuel: 'wood', cost: { wood: 60, plank: 30 }, secs: 45 },
  tractor: { n: '증기 트레일러', cap: 1000, fuel: 'coal', cost: { steel: 30, gear: 10, engine: 1 }, secs: 120, from: 2 },
  icebreaker: { n: '쇄빙차', cap: 2400, fuel: 'battery', cost: { alloy: 80, part: 30, engine: 6 }, secs: 200, from: 8 }, // 到了沉睡的破冰船才会造；冰面裂开不用绕路
};
const VEH_ORDER = ['icebreaker', 'tractor', 'sled']; // 装车先挑大的
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
  if (J.trip) return '행렬이 운행 중입니다. 새로운 랜드마크에서 새로운 야영지를 운전해 보세요.';
  const r = outpostRange(S);
  if (cy > r.y1) return `이번 운행 범위를 벗어나는 경우: 행렬북상이 "${r.next.n}" 근처를 지나갈 때까지 기다려야 합니다. 당신은 이곳을 먼저 차지할 수 없습니다.`;
  if (cy < r.y0) return '너무 남쪽에 있음: 새로운 야영지는 본영과 다음 랜드마크 사이에서 주행해야 합니다.';
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
// 默认带的货：新营地半小时的口粮和燃料、搭帐篷的木材，再加一点路上备用（路上的事要花）
export function defaultGoods(S, main, people, fl) {
  const st = main.stock, g = {};
  g.food = Math.ceil(people * EAT * 40); // 30 分钟的开局口粮，再加 10 分钟路上备用
  g.wood = 25 * Math.ceil(people / 5) + 140; // 搭帐篷，再加 80 路上备用
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
  const fleet = J.fleet, veh = { sled: 0, tractor: 0, icebreaker: 0 }, nv = () => veh.sled + veh.tractor + veh.icebreaker;
  let base = people * PERSON_LOAD + sum(goods) + sum(kit) + people * steps, cap = 0;
  for (let pass = 0; pass < 2; pass++) {
    const need = base + nv() * steps;
    veh.sled = 0; veh.tractor = 0; veh.icebreaker = 0; cap = 0;
    for (const v of VEH_ORDER) while (cap < need && veh[v] < (fleet[v] || 0)) { veh[v]++; cap += VEH[v].cap; }
  }
  const load = base + nv() * steps;
  const supplies = { food: people * steps };
  if (veh.sled) supplies.wood = veh.sled * steps;
  if (veh.tractor) supplies.coal = veh.tractor * steps;
  if (veh.icebreaker) supplies.battery = Math.ceil(veh.icebreaker * steps / 3);
  const need = addTo(addTo(addTo({}, goods), kit), supplies);
  const short = missing(main.stock, need);
  const fullCap = VEH_KEYS.reduce((a, v) => a + (fleet[v] || 0) * VEH[v].cap, 0);
  const secs = tripSecs(len, !veh.sled && veh.tractor + veh.icebreaker > 0) / wonderTrip(S), speed = len / Math.max(1, secs); // 铁路总站：车队快 30%
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
    { id: 'route', ok: route.ok, t: '도로가 발견되었습니다', sub: route.ok ? `도로 길이는 약 ${Math.round(route.len)}제곱입니다` : `본영에서 "${nx.n}"까지의 도로는 아직 ${route.gap} 블록 정도 떨어져 있습니다.` },
    { id: 'chap', ok: !ch || ch.done, t: ch ? `"${ch.ch.n}" 완료됨` : '이번 장은 끝났습니다', sub: !ch || ch.done ? '완료' : `과제에 대한 항목이 ${left}개 더 있습니다.` },
    { id: 'flvl', ok: fl >= need, t: `본영용광로 ${need} 레벨`, sub: `현재 ${fl} 레벨입니다`, cur: fl, n: need },
    { id: 'car', ok: plan.roomOk && !plan.short.length && plan.people >= 5, t: '행렬이 준비되었습니다',
      sub: plan.people < 5 ? '최소 5명 이상이 도로에 있어야 합니다.' : !plan.roomOk ? `차에 아직 ${plan.lack} 공간이 남아 있습니다(약 ${Math.ceil(plan.lack / VEH.sled.cap)} 썰매).` : plan.short.length ? '부족: ' + plan.short.join(',') : `${plan.people}명, ${plan.veh.icebreaker ? plan.veh.icebreaker + '대만 쇄빙차' : ''}${plan.veh.tractor ? plan.veh.tractor + '트레일러' : ''}${plan.veh.sled ? plan.veh.sled + '자동차 썰매' : ''}` },
  ];
  return { k, next: nx, items, n: items.filter(i => i.ok).length, ok: items.every(i => i.ok), plan, route };
}
export function setPlan(S, patch) { const J = journeyOf(S); J.plan = { ...(J.plan || {}), ...patch }; }
export function setCampMode(S, cid, mode) { const J = journeyOf(S); J.plan = J.plan || {}; (J.plan.mode || (J.plan.mode = {}))[cid] = mode === 'douse' ? 'douse' : 'keep'; }

// ---------- 出发 ----------
export function depart(S) {
  const J = journeyOf(S), g = departGate(S);
  if (!g) return { ok: false, reason: '이미 끝났어' };
  if (J.trip) return { ok: false, reason: '행렬이 이미 진행 중입니다.' };
  if (!g.ok) return { ok: false, reason: g.items.filter(i => !i.ok).map(i => i.t + ':' + i.sub).join(';') };
  // 1.1 北境：没选路就走侦察兵推荐的第一条；这一站没做完的奇遇就错过了
  { const F = forkOf(S); if (F && F.pick == null) pickFork(S, 0, true); }
  qyLeave(S);
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
  J.trip.ev = rollRoad(S, J.trip);
  dirty(S);
  logMsg(S, `🛷 행렬은 "${main.name}"에서 출발: ${p.people}명, "${g.next.n}"까지 북쪽으로 향합니다. 도로에서 약 ${Math.max(1, Math.round(p.secs / 60))}분 소요됩니다.`, 'story');
  rt(S).fx.push({ kind: 'depart', to: J.trip.to });
  return { ok: true };
}
// ---------- 雪橇棚：造车。造好的车归车队，跟着主营地走 ----------
export const VQ_MAX = 10;
export const vehName = v => (VEH[v] || VEH.sled).n;
export function vehBlock(S, b, v) {
  const V = VEH[v]; if (!V || !b || b.type !== 'sledshed') return '여기서는 지을 수 없어요';
  if (V.from && journeyOf(S).stage < V.from) return `"${stopOf(S, V.from).n}"에 도달한 후에만 생성할 수 있습니다.`;
  for (const k in V.cost) if (RES[k].t > S.known) return `"${RES[k].n}" 필요`;
  if ((b.vq || []).length >= VQ_MAX) return `최대 대기열 ${VQ_MAX} 차량`;
  const camp = getCamp(S, b.camp);
  if (!canAfford(camp.stock, V.cost)) return '부족: ' + missing(camp.stock, V.cost).join(',');
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
    if (!q) { br.status = '게으른'; continue; }
    if (!b.workers) { br.status = '배치된 일손 없음'; continue; }
    br.status = `${vehName(q.v)} ${Math.floor(q.p * 100)}% 건설 중`;
    q.p += dt * sp / VEH[q.v].secs;
    if (q.p < 1) continue;
    b.vq.shift();
    J.fleet[q.v] = (J.fleet[q.v] || 0) + 1;
    R.fx.push({ kind: 'veh', b: b.id, v: q.v });
    if (!b.vq.length) logMsg(S, `🛷 썰매 헛간 차량이 완성되었습니다. 이제 행렬를 구매할 수 있습니다.${J.fleet.sled || 0}프레임 썰매${J.fleet.tractor ? `、${J.fleet.tractor}대만 증기 트레일러` : ''}。`, 'good', { act: 'spot', arg: b.id, label: '보기' });
    dirty(S);
  }
}

// ---------- 路上的事：每一程抽两三件，车队停下来等你拿主意 ----------
// 一分钟（游戏里的时间，关着页面补算时也一样）没人选，按第一项「默认」办：宁可花物资，不伤人
export const ROAD_WAIT = 60;
const nVeh = T => VEH_KEYS.reduce((a, v) => a + (T.veh[v] || 0), 0);
// 车上的货里，点炉要用的那份不动，剩下的才能在路上花
// 熟食再留 10 分钟的口粮给新营地开局
export const roadHave = (T, k) => Math.max(0, Math.floor((T.goods[k] || 0) - (FURNACE_KIT[k] || 0) - (k === 'food' ? T.people * EAT * 10 : 0)));
const foodTxt = (T, n) => { const a = Math.min(n, roadHave(T, 'food')); return a ? `요리 −${a}` : '차에 추가 요리가 없습니다'; };
const roadTake = (T, k, n) => { const a = Math.min(n, roadHave(T, k)); T.goods[k] = (T.goods[k] || 0) - a; return a; };
// 燃料按热值算，先烧不值钱的
const FUEL_LOW = FUEL_ORDER.slice().reverse();
function fuelPlan(T, u) {
  const out = {}; let left = u;
  for (const f of FUEL_LOW) { if (left <= 0) break; const n = Math.min(roadHave(T, f), Math.ceil(left / FUEL[f])); if (n > 0) { out[f] = n; left -= n * FUEL[f]; } }
  return { take: out, short: Math.max(0, left) };
}
const resTxt = o => Object.keys(o).map(k => `${RES[k].n} −${o[k]}`).join(',');
const roomLeft = T => VEH_KEYS.reduce((a, v) => a + (T.veh[v] || 0) * VEH[v].cap, 0) - T.people * PERSON_LOAD - sum(T.goods);
const stepsLeft = T => Math.max(1, Math.ceil((T.len - T.d) / 10));
function roadLoot(T) {
  const k = T.to;
  if (k <= 4) return { gear: 15 + 5 * k, engine: 2 + k };
  if (k <= 6) return { battery: 6 * k, alloy: 4 * k };
  return { part: 2 * k, star: 4 * k };
}
const ROAD = [
  { id: 'storm', n: '눈보라 프레스 오버', w: 3, when: () => true,
    ctx: (S, T) => ({ u: 8 * nVeh(T) + 2 * Math.ceil(T.people / 5), wait: 40, hurt: Math.max(1, Math.round(T.people * 0.08)) }),
    text: () => '수평선에 흰 벽이 눌려 있었고 바람은 점점 더 세게 불었습니다. 수레를 끄는 사람들은 리더인 썰매를 바라보았다.',
    opts: [
      { t: '캠프를 준비하고 기다리세요', d: (S, T, x) => { const f = fuelPlan(T, x.u); return `${resTxt(f.take) || '차에 추가 연료가 없습니다'} · 약 ${x.wait + Math.ceil(f.short / 2)}초 늦음`; },
        go: (S, T, x) => { const f = fuelPlan(T, x.u); for (const k in f.take) roadTake(T, k, f.take[k]); T.hold = (T.hold || 0) + x.wait + Math.ceil(f.short / 2); return '행렬은 원을 그리며 진을 치고 밤새도록 불을 피웠습니다. 눈이 그친 뒤 그들은 길을 떠났다.'; } },
      { t: '등을 대고 걸어라', d: (S, T, x) => `정시에 도착 · ${x.hurt}명 동상, 도착 시 먼저 회복`, go: (S, T, x) => { T.sick = (T.sick || 0) + x.hurt; return `행렬은 바람과 눈 속에서 앞으로 걸어갔지만 ${x.hurt} 개인적으로 동상이 문제에 빠졌습니다.`; } },
    ] },
  { id: 'lost', n: '갇힌 사람들', w: 3, when: () => true,
    ctx: (S, T, r) => { const n = 3 + Math.floor(r() * 4); return { n, food: n * 12, eat: n * stepsLeft(T) }; },
    text: (S, T, x) => `눈 속에 뒤집힌 낡은 썰매가 있었고, ${x.n}명의 사람들이 그 아래에 모여서 몸을 따뜻하게 유지하고 있었습니다. 그들은 남쪽에서 멀리 탈출했습니다.`,
    opts: [
      { t: '떠나기 전에 먹을 것을 남겨두세요', d: (S, T, x) => `${foodTxt(T, x.food)} · 도착 후 희망 +5 · 잔불 +2`,
        go: (S, T, x) => { roadTake(T, 'food', x.food); T.hope = (T.hope || 0) + 5; S.meta.embers += 2; S.meta.emberTotal = (S.meta.emberTotal || 0) + 2; return '모두가 배급의 일부를 그들에게 주었고 어떤 사람들은 울며 감사했습니다.'; } },
      { t: '그것들을 가지고 가세요', d: (S, T, x) => `+${x.n}명 · 차에 ${x.n * PERSON_LOAD} 공간이 필요합니다(현재 ${Math.max(0, roomLeft(T))}이 비어 있음) · 요리 −${x.eat}`,
        ok: (S, T, x) => roomLeft(T) >= x.n * PERSON_LOAD + x.eat && roadHave(T, 'food') >= x.eat,
        go: (S, T, x) => { roadTake(T, 'food', x.eat); T.people += x.n; return `${x.n} 누군가 썰매에 올라가서 행렬과 함께 북쪽으로 걸어갔습니다.`; } },
    ] },
  { id: 'wolves', n: '늑대들이 따라온다', w: 2, when: (S, T) => T.to <= 2,
    ctx: (S, T, r) => ({ meat: 20 + T.people, u: 6 * nVeh(T), hurt: r() < 0.5 ? 1 + Math.floor(r() * 2) : 0 }),
    text: () => '설원 위에 녹색 눈이 한줄기 빛나고, 늑대들은 행렬을 멀리서 따라오며 점점 가까워졌다.',
    opts: [
      { t: '고기를 좀 남겨서 유인하세요', d: (S, T, x) => { const g = Math.min(x.meat, roadHave(T, 'game')), f = Math.min(x.meat - g, roadHave(T, 'food')), lack = x.meat - g - f; return [g && `생고기 −${g}`, f && `요리 −${f}`, lack && `고기가 부족합니다. 조금 더 진행하세요. 약 ${Math.ceil(lack / 2)}초 늦었습니다.`].filter(Boolean).join(' · '); },
        go: (S, T, x) => { const g = roadTake(T, 'game', x.meat), f = roadTake(T, 'food', x.meat - g), lack = x.meat - g - f; if (lack > 0) T.hold = (T.hold || 0) + Math.ceil(lack / 2); return '고기가 눈 속에 던져졌고, 늑대들은 음식을 잡기 위해 멈춰 섰습니다. 행렬은 기회를 잡았습니다.'; } },
      { t: '원을 그리며 경계하다', d: (S, T, x) => { const f = fuelPlan(T, x.u); return `${resTxt(f.take)} · 누군가가 부상을 입을 수 있습니다`; }, ok: (S, T, x) => !fuelPlan(T, x.u).short,
        go: (S, T, x) => { const f = fuelPlan(T, x.u); for (const k in f.take) roadTake(T, k, f.take[k]); if (x.hurt) T.sick = (T.sick || 0) + x.hurt; return x.hurt ? `불은 밤새도록 지켰는데, 한 무리의 늑대가 그 불을 덮쳐 ${x.hurt}명이 물렸습니다.` : '불은 밤새도록 지켰고, 늑대들은 새벽이 되기 전에 흩어졌습니다.'; } },
    ] },
  { id: 'ice', n: '얼음 균열', w: 2, when: (S, T) => T.to >= 3 && T.to <= 4,
    ctx: (S, T) => ({ far: 10, food: T.people, plank: 20 + 5 * nVeh(T), ib: (T.veh.icebreaker || 0) > 0 }),
    text: () => '전방 빙하에 틈이 생기고, 얼음 아래로 검은 물이 급격하게 흘러 썰매가 통과하기 어렵게 됐다.',
    opts: [
      { t: '우회', tib: '쇄빙차가 앞쪽으로 길을 열어줍니다.', d: (S, T, x) => x.ib ? '지연 없음, 비용 없음' : `약 ${x.far} 정사각형 더 이동 · ${foodTxt(T, x.food)}`,
        go: (S, T, x) => { if (x.ib) return '쇄빙차는 얼음 틈새 양쪽의 얼음을 부수었고, 행렬은 그 흔적을 따라가며 지나갔습니다.'; roadTake(T, 'food', x.food); T.detour = (T.detour || 0) + x.far; return '행렬은 강둑을 따라 긴 원을 그리며 건너갈 곳을 찾았습니다.'; } },
      { t: '목판을 사용하여 다리 건설', d: (S, T, x) => `목판 −${x.plank} (차량에 추가 요금) · 지체 없음`, ok: (S, T, x) => roadHave(T, 'plank') >= x.plank,
        go: (S, T, x) => { roadTake(T, 'plank', x.plank); return '목판은 균열을 하나씩 통과했고, 행렬은 차례로 지나갔다.'; } },
    ] },
  { id: 'wreck', n: '옛날의 잔재', w: 2, when: (S, T) => T.from >= 3,
    ctx: (S, T) => ({ loot: roadLoot(T), wait: 45 }),
    text: () => '길가에는 구시대의 대형 기계가 반쯤 묻혀있습니다. 양철은 바람과 눈에 의해 광택이 나고 내부에 손상되지 않은 부품이 있는 것처럼 보였습니다.',
    opts: [
      { t: '멈추지 말고 계속 가세요', d: () => '지연 없음', go: () => '행렬은 멈추지 않았고 잔해는 그 뒤의 바람과 눈 속으로 천천히 사라졌습니다.' },
      { t: '중지 및 해체', d: (S, T, x) => `약속 시간에 늦다${x.wait}두번째 ·${Object.keys(x.loot).map(k => `${RES[k].n} +${x.loot[k]}`).join('，')}`,
        go: (S, T, x) => { T.hold = (T.hold || 0) + x.wait; addTo(T.goods, x.loot); return '모두가 오랫동안 그것을 분해하고 사용할 수있는 모든 것을 차에 넣었습니다.'; } },
    ] },
  { id: 'bot', n: '분실 오토마톤', w: 2, when: (S, T) => T.from >= 5,
    ctx: (S, T) => ({ star: 25 + 3 * T.to, part: 8 }),
    text: () => '오토마톤은 눈 위에서 원을 그리며 회전하고 있었고 관절은 얼음으로 덮여 있었습니다. 행렬을 보고 따라갔습니다.',
    opts: [
      { t: '분해해서 가져간 성철', d: (S, T, x) => `성철 +${x.star}`, go: (S, T, x) => { addTo(T.goods, { star: x.star }); return '오토마톤을 분해하고 성철을 차량에 설치했습니다.'; } },
      { t: '수리해서 가지고 가세요', d: (S, T, x) => `구성요소 −${x.part} · 오토마톤 코어 1개 획득(오토마톤 격납고로 2개 유닛을 각성할 수 있음)`, ok: (S, T, x) => roadHave(T, 'part') >= x.part,
        go: (S, T, x) => { roadTake(T, 'part', x.part); addTo(T.goods, { core: 1 }); return '여러 부품을 교체한 후 오토마톤은 다시 자리를 잡고 순종적으로 행렬을 따라갔습니다.'; } },
    ] },
  { id: 'night', n: '극지방의 밤', w: 3, when: (S, T) => T.from >= 6,
    ctx: (S, T, r) => ({ u: 10 * nVeh(T) + 3 * Math.ceil(T.people / 5), lose: r() < 0.5 }),
    text: () => '오랫동안 해가 뜨지 않았습니다. 사방이 칠흑같이 캄캄했고, 몇 걸음 앞의 눈을 비춰주는 자동차 불빛만 있었습니다.',
    opts: [
      { t: '횃불을 켜고 길을 가세요', d: (S, T, x) => { const f = fuelPlan(T, x.u); return `${resTxt(f.take) || '차에 추가 연료가 없습니다'}${f.short ? `· 횃불 부족, 천천히 걷기: 약속시간에 늦게 도착${Math.ceil(f.short / 2)}두번째` : ''}`; },
        go: (S, T, x) => { const f = fuelPlan(T, x.u); for (const k in f.take) roadTake(T, k, f.take[k]); if (f.short) T.hold = (T.hold || 0) + Math.ceil(f.short / 2); return '긴 횃불이 어두운 밤에 빛나는 강처럼 북쪽으로 이동했습니다.'; } },
      { t: '어둠 속을 걸어보세요', d: () => '불태우지 마세요 연료 · 차량이 분실될 수 있습니다. (차량에 실린 물건도 포함)', ok: (S, T) => nVeh(T) > 1,
        go: (S, T, x) => {
          if (!x.lose) return '모두가 밧줄을 잡고 어둠 속을 걸었고, 새벽에도 차는 한 대도 사라지지 않았습니다.';
          const v = T.veh.sled ? 'sled' : T.veh.tractor ? 'tractor' : 'icebreaker', cap = VEH_KEYS.reduce((a, k) => a + (T.veh[k] || 0) * VEH[k].cap, 0), f = VEH[v].cap / Math.max(1, cap);
          T.veh[v]--; const J = journeyOf(S); J.fleet[v] = Math.max(0, (J.fleet[v] || 0) - 1);
          const gone = {}; for (const k in T.goods) { const n = Math.floor(roadHave(T, k) * f); if (n > 0) { T.goods[k] -= n; gone[k] = n; } }
          return `새벽에 차량 ${vehName(v)} 1대가 없어졌고, 해당 차량에 있던 물품도 ${Object.keys(gone).length ? '：' + resTxt(gone) : ''}이(가) 없어졌습니다.`;
        } },
    ] },
  { id: 'chasm', n: '빙상 균열', w: 2, when: (S, T) => T.from >= 6,
    ctx: (S, T) => ({ far: 14, food: T.people, steel: 30 + 5 * nVeh(T), ib: (T.veh.icebreaker || 0) > 0 }),
    text: () => '빙상에는 바닥이 없는 균열이 있었고, 바람은 바닥에서 위로 불어오며 윙윙거리는 소리를 냈습니다.',
    opts: [
      { t: '주변에서 길을 찾아보세요', tib: '쇄빙차가 앞쪽으로 길을 열어줍니다.', d: (S, T, x) => x.ib ? '지연 없음, 비용 없음' : `약 ${x.far} 정사각형 더 이동 · ${foodTxt(T, x.food)}`,
        go: (S, T, x) => { if (x.ib) return '쇄빙차는 균열 계곡 가장자리를 따라 얼음 길을 눌렀고, 행렬은 그 주위를 꾸준히 돌았습니다.'; roadTake(T, 'food', x.food); T.detour = (T.detour || 0) + x.far; return '행렬은 균열 계곡을 따라 먼 길을 걸어 돌아다닐 수 있는 좁은 장소를 찾았습니다.'; } },
      { t: '다리', d: (S, T, x) => `강재 −${x.steel} (차로 가져옴) · 지체 없음`, ok: (S, T, x) => roadHave(T, 'steel') >= x.steel,
        go: (S, T, x) => { roadTake(T, 'steel', x.steel); return '강철빔이 균열 계곡을 가로지르고, 행렬이 차례로 지나갔다.'; } },
    ] },
];
export const ROAD_IDS = ROAD.map(e => e.id);
export const roadName = id => (ROAD.find(e => e.id === id) || {}).n || id;
// 出发时抽好这一程会遇到的事和地点（按路程的比例），路上走到了才弹出来
export function rollRoad(S, T) {
  const r = mulberry32((S.runSeed * 131 + T.to * 7919 + Math.floor(T.t0)) >>> 0);
  const pool = ROAD.filter(e => e.when(S, T)), n = Math.min(pool.length, 2 + (r() < 0.5 ? 1 : 0)), pick = [];
  while (pick.length < n) {
    const tot = pool.reduce((a, e) => a + e.w, 0); let x = r() * tot, k = 0;
    while (x >= pool[k].w) { x -= pool[k].w; k++; }
    pick.push(pool.splice(k, 1)[0].id);
  }
  const ev = pick.map((id, i) => ({ id, at: 0.18 + (i + 0.2 + 0.6 * r()) * 0.66 / n }));
  // 这一程会碰上暴风雪：那段路一定要停下来拿主意（扎营等它过去，或者顶着走）
  const wx = tripWeather(S, T.len / Math.max(1e-6, T.speed));
  if (wx) {
    const at = Math.max(0.12, Math.min(0.92, wx.f + 0.02)), s = ev.find(e => e.id === 'storm');
    if (s) s.at = at; else if (ev.length >= 3) ev[ev.length - 1] = { id: 'storm', at }; else ev.push({ id: 'storm', at });
    // 别和别的事挤在一起
    for (const e of ev) if (e.id !== 'storm' && Math.abs(e.at - at) < 0.06) e.at = Math.max(0.12, Math.min(0.95, at + (e.at < at ? -0.08 : 0.08)));
  }
  return ev;
}
// 车队路上的天气：出发以后这一程会不会碰上暴风雪（极光观测站以后，北迁面板里直接能看到）
export function tripWeather(S, secs) {
  for (let t = 0; t <= secs; t += 10) { const w = weatherAt(S, S.t + t); if (w.blizzard) return { at: t, f: t / Math.max(1, secs), left: w.until - S.t - t }; }
  return null;
}
function roadPop(S, T, e) {
  const def = ROAD.find(x => x.id === e.id); if (!def) return;
  const r = mulberry32((S.runSeed * 17 + T.to * 131 + Math.round(e.at * 1000)) >>> 0);
  T.road = { id: e.id, x: def.ctx(S, T, r), t0: S.t };
  rt(S).fx.push({ kind: 'road', id: e.id });
  dirty(S);
}
export function roadView(S) {
  const T = journeyOf(S).trip, v = T && T.road; if (!v) return null;
  const e = ROAD.find(x => x.id === v.id); if (!e) { T.road = null; return null; }
  return { id: e.id, title: e.n, text: e.text(S, T, v.x), left: Math.max(0, Math.ceil(ROAD_WAIT - (S.t - v.t0))),
    opts: e.opts.map((o, i) => ({ t: o.tib && v.x.ib ? o.tib : o.t, d: o.d(S, T, v.x), ok: !o.ok || o.ok(S, T, v.x), def: i === 0 })) };
}
export function resolveRoad(S, i, auto) {
  const T = journeyOf(S).trip, v = T && T.road; if (!v) return null;
  const e = ROAD.find(x => x.id === v.id), o = e && e.opts[i];
  if (!o || (o.ok && !o.ok(S, T, v.x))) return null;
  const msg = o.go(S, T, v.x);
  (T.done || (T.done = [])).push([e.id, i]);
  T.road = null;
  logMsg(S, `【${e.n}】${auto ? '아무도 결정을 내리지 않았습니다. 기본값을 따르십시오.' : ''}${msg}`, 'story');
  dirty(S);
  return msg;
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
  if (!T || T.phase !== 'arrive') return { ok: false, reason: '행렬이 아직 도착하지 않았습니다' };
  const st = stopOf(S, T.to), w = getWorld(S.runSeed), cx = x + 1.5, cy = y + 1.5;
  if (Math.hypot(cx - st.x, cy - st.y) > FOUND_DIST - 1) return { ok: false, reason: `"${st.n}" 근처의 ${FOUND_DIST - 1} 공백 내에 배치됩니다.` };
  for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 3; xx++) {
    if (!inMap(xx, yy)) return { ok: false, reason: '지도 밖에서' };
    const i = idx(xx, yy);
    if (!S.reveal[i]) return { ok: false, reason: '건설은 안개에서 사용할 수 없습니다.' };
    if (w.terrain[i] !== 0) return { ok: false, reason: '고르지 않은 지형(바위 또는 얼음호수)' };
    if (occAt(S, xx, yy)) return { ok: false, reason: '다른 건물과 겹쳐서' };
    if (landmarkBlock(xx, yy, S)) return { ok: false, reason: '랜드마크와 유적지가 이곳을 차지하고 있습니다.' };
    if (siteAt(S, xx, yy, 1)) return { ok: false, reason: '여기에 폐허가 있습니다' };
    if (w.spot[i] >= 0 && !['tree', 'rock', 'herd'].includes(spotKey(w, i)) && S.spots[i] !== 0) return { ok: false, reason: '이것은 광산이다' };
  }
  for (const c of S.camps) if (Math.hypot(c.x - cx, c.y - cy) < CAMP_GAP) return { ok: false, reason: `"${c.name}"에 너무 가깝습니다.` };
  return { ok: true };
}
const spotKey = (w, i) => SPOT_KEYS[w.spot[i]];
// 推荐的位置：地标南边几格、离地标最近的一块平地
export function arriveSpot(S) {
  const J = journeyOf(S), T = J.trip; if (!T) return null;
  const st = stopOf(S, T.to);
  const r = st.r || 2.5;
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
  if (x == null) { const a = arriveSpot(S); if (!a) return { ok: false, reason: '근처에 용광로를 놓을 수 있는 평지가 없습니다.' }; x = a.x; y = a.y; }
  const ck = arriveCheck(S, x, y); if (!ck.ok) return ck;
  const st = stopOf(S, T.to);
  const camp = makeCamp(S, x, y, st.n);
  clearFootprint(S, 'furnace', x, y, camp.id);
  trunkRoad(S, J.main, camp.id); // 车队走过的路成了北行主干道（旧主营地要是熄火，两头会自动接上）
  getB(S, camp.furnace).lvl = T.fl;
  camp.spec = specForStop(S, camp, st, furnaceRadius(T.fl) + 1); // 营地特产：北境按地貌，别处按暖圈里的矿
  camp.people = T.people;
  if (T.sick) camp.sick = Math.min(camp.people * 0.3, (camp.sick || 0) + T.sick);
  if (T.hope) bumpMood(camp, T.hope, 0);
  addTo(camp.stock, T.goods);
  for (const k of Object.keys(FURNACE_KIT)) camp.stock[k] = Math.max(0, (camp.stock[k] || 0) - FURNACE_KIT[k]); // 点炉用掉
  // 余烬「人望」「行囊」：每到一站也算一次「开局」，多来几个人、多一笔补给（和开局那份一样大）
  const upP = up(S, 'people'), upS = up(S, 'supply'), k = T.to;
  if (upP) camp.people += 3 * upP;
  if (upS) { const f = 0.5 * upS; camp.stock.wood = (camp.stock.wood || 0) + Math.round((120 + 120 * k) * f); camp.stock.food = (camp.stock.food || 0) + Math.round((70 + 40 * k) * f); camp.stock.stone = (camp.stock.stone || 0) + Math.round((40 + 80 * k) * f); }
  // 后面的营地：留守的变成补给站；熄火的把守火的人和一部分材料带上来，留下一片废墟
  let embers = 0;
  for (const m of T.camps) {
    const c = getCamp(S, m.id); if (!c) continue;
    if (m.mode === 'douse') {
      const lvl = getB(S, c.furnace).lvl;
      camp.people += c.people;
      for (const k in c.stock) if (c.stock[k] > 0) camp.stock[k] = (camp.stock[k] || 0) + Math.floor(c.stock[k] * 0.3);
      embers += douseEmbers(S, lvl);
      J.ruins.push({ x: c.x, y: c.y, lvl, n: c.name, t: S.t, b: S.buildings.filter(b => b.camp === c.id && b.type !== 'furnace' && !BLD[b.type].tower).map(b => [b.type, b.x, b.y]) });
      removeCamp(S, c.id, camp.id);
    } else { c.depot = true; c.auto = true; delete c.focus; delete c.manual; }
  }
  if (embers) { S.meta.embers += embers; S.meta.emberTotal = (S.meta.emberTotal || 0) + embers; }
  J.legs.push({ from: T.from, to: T.to, t0: T.t0, t1: S.t, people: T.people, road: T.done || [], path: [...T.path, [camp.x, camp.y]].map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]) });
  J.stage = T.to; J.main = camp.id; J.trip = null; J.plan = {};
  S.active = camp.id;
  // 北境：记下这一站的地貌规则从什么时候开始（上一站的到此为止），任务计数清零
  if (J.rh) for (const h of J.rh) if (h.t1 == null) h.t1 = S.t;
  if (st.rule) {
    (J.rh ||= []).push({ r: st.rule, k: st.north, t0: S.t });
    if (J.rh.length > 4) J.rh.shift();
    J.ns = { k: J.stage, plank: Math.max(0, Math.round(((T.goods || {}).plank || 0) - FURNACE_KIT.plank)) }; // 车上带来的木板也算运到的
  }
  S.safeUntil = Math.max(S.safeUntil || 0, S.t + 3600); // 刚到的营地一小时内不会遇袭
  revealCircle(S, st.x, st.y, 14);
  markFounded(S, camp);
  const tents = arriveTents(S, camp);
  autoAssign(S, camp);
  dirty(S);
  for (const c of S.camps) bumpMood(c, 6, -3);
  logMsg(S, `🔥 행렬가 도착했습니다 「${st.n}", 새로운 용광로가 켜집니다 (${T.fl}레벨).${tents ? `먼저 설정하세요.${tents}상단 천막.` : ''}${embers ? `정지된 야영지를 교체했습니다.${embers}잔불를 클릭하세요.` : ''}`, 'story');
  rt(S).fx.push({ kind: 'arrive-stop', k: J.stage });
  if (st.rule) logMsg(S, `${NORTH_RULES[st.rule].ic} 늙은 길잡이: 「${NORTH_RULES[st.rule].tip}」`, 'story');
  // 北境：新的一章；第一次走到这个站号给一点余烬，记下最远纪录（新的北行也留着）
  if (st.north) {
    qyArrive(S, J.stage); // 1.1 这一站的奇遇：半天以后出现
    rt(S).fx.push({ kind: 'chapter', i: J.stage });
    if (st.north > (S.meta.northMax || 0)) {
      S.meta.northMax = st.north;
      const e = northEmbers(S); S.meta.embers += e; S.meta.emberTotal = (S.meta.emberTotal || 0) + e;
      logMsg(S, `처음으로 북방의 ${st.north}을(를) 멈추기 위해 걸어갔습니다! ${e} 포인트잔불을 가져옵니다.`, 'story');
    }
  }
  growNext(S);
  // 走到世界之脊：真结局
  if (J.stage === SPINE) {
    const first = !S.meta.trueEnd; S.meta.trueEnd = (S.meta.trueEnd || 0) + 1;
    logMsg(S, '🏔 행렬이 세계의 척추를 뒤집었습니다. 길을 따라 모닥불이 선을 형성했습니다. 이것이 실제 끝점입니다.', 'story');
    rt(S).fx.push({ kind: 'trueend', first });
  }
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
    beds += housingOf(b, S); n++;
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
// 把一座营地从地图上拿掉（熄火）：它的建筑、路、排队、侦察队都要收拾干净
export function removeCamp(S, cid, to) {
  const gone = new Set(S.buildings.filter(b => b.camp === cid).map(b => b.id));
  S.buildings = S.buildings.filter(b => b.camp !== cid);
  S.camps = S.camps.filter(c => c.id !== cid);
  healNet(S, cid, to); // 它两头的营地自动连上，路上的货改送 to
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

// ---------- 老营地：补给站自己运转，多出来的货由物流网调走；也可以临时接手，或者熄火换余烬 ----------
export const isDepot = c => !!(c && c.depot);
export const depotAuto = c => !!(c && c.depot && !c.manual); // 补给站自己管自己：不盖新房、不升级
export function takeOver(S, cid, on) {
  const c = getCamp(S, cid); if (!c || !c.depot) return { ok: false };
  c.manual = !!on; if (!on) c.auto = true;
  logMsg(S, on ? `귀하는 일시적으로 보급 창고 "${c.name}"을(를) 인수했습니다. 집 업그레이드를 지을 수 있습니다. 관리한 후에는 다시 돌려주고 스스로 작동하도록 놔두는 것을 잊지 마세요.` : `보급 창고 "${c.name}"이(가) 반환되어 자체적으로 작동하기 시작했습니다.`, 'info');
  dirty(S); return { ok: true };
}
// 补给站熄火：人去主营地，拆下三成材料送过去，按熔炉等级换余烬，原地留下一片废墟
export function douseDepot(S, cid) {
  const c = getCamp(S, cid), m = mainCamp(S);
  if (!c || !c.depot || !m || c.id === m.id) return { ok: false, reason: '공급 스테이션만이 화염을 차단할 수 있습니다.' };
  if (journeyOf(S).trip) return { ok: false, reason: '행렬이 오는 중입니다. 나중에 이야기하겠습니다.' };
  const lvl = getB(S, c.furnace).lvl, embers = douseEmbers(S, lvl), n = c.people;
  const a = addPeople(S, m, n);
  for (const k in c.stock) if (c.stock[k] > 0) m.stock[k] = (m.stock[k] || 0) + Math.floor(c.stock[k] * 0.3);
  S.meta.embers += embers; S.meta.emberTotal = (S.meta.emberTotal || 0) + embers;
  journeyOf(S).ruins.push({ x: c.x, y: c.y, lvl, n: c.name, t: S.t, b: S.buildings.filter(b => b.camp === c.id && b.type !== 'furnace' && !BLD[b.type].tower).map(b => [b.type, b.x, b.y]) });
  removeCamp(S, c.id, m.id);
  logMsg(S, `🕯 「${c.name}"엔진이 꺼져 있습니다."${n}나는 개인적으로 북쪽으로 갔다."${m.name}」${a.wait ? `（${a.wait}사람들은 먼저 오두막에서 침대를 기다립니다)` : ''}, 그 대가로${embers}잔불를 클릭하세요.`, 'story');
  rt(S).fx.push({ kind: 'douse', x: c.x, y: c.y });
  return { ok: true, embers };
}
// 补给站撑不住了：燃料不到 10 分钟、挨饿、人太少，提醒一次（好了再坏会再提醒）
export function depotTrouble(S, c) {
  const cr = rt(S).c[c.id] || {};
  if (c.people < DEPOT_MIN) return `${c.people}명만 남았습니다`;
  if ((cr.hunger || 0) > 0.1) return '굶주리는';
  if (cr.burnPerMin && (cr.fuelUnits || 0) / cr.burnPerMin < 10) return '연료는 10분도 버틸 수 없습니다';
  return '';
}
// 补给站自己运转：撑不住了提醒一次（货都交给物流网调，见 net.js）
function supplyStep(S, dt) {
  const J = journeyOf(S), m = mainCamp(S);
  if (!m) return;
  J.supT = (J.supT || 0) + dt;
  if (J.supT < 30) return;
  J.supT = 0;
  for (const c of S.camps) {
    if (!c.depot || c.id === m.id || c.manual) continue;
    const why = depotTrouble(S, c);
    if (why && c.dWarn !== why) logMsg(S, `⚠ 공급 스테이션 "${c.name}" ${why}: 일시적으로 인수하거나 폐쇄하고 잔불으로 교체할 수 있습니다.`, 'warn', { act: 'campgo', arg: c.id, label: '가 보기' });
    c.dWarn = why;
  }
}

// ---------- 每一步 ----------
// 信号灯塔：建好、升级以后把四周的雾照开
function beaconStep(S) {
  for (const b of S.buildings) {
    if (b.type !== 'beacon' || b.lit === b.lvl) continue;
    b.lit = b.lvl;
    revealCircle(S, b.x + 1, b.y + 1, BLD.beacon.reveal + 4 * (b.lvl - 1));
    logMsg(S, `🗼 신호 등탑이 켜집니다: ${BLD.beacon.reveal + 4 * (b.lvl - 1)} 블록 주변의 안개가 밝아집니다.`, 'good');
  }
}
export function journeyStep(S, dt) {
  vehStep(S, dt);
  supplyStep(S, dt);
  beaconStep(S);
  const J = journeyOf(S), T = J.trip;
  if (!T) return;
  if (T.phase === 'go') {
    if (T.road) { if (S.t - T.road.t0 >= ROAD_WAIT) resolveRoad(S, 0, true); return; }
    if (T.hold > 0) { T.hold = Math.max(0, T.hold - dt); return; }
    let nx = null; for (const e of T.ev || []) if (!e.seen && (!nx || e.at < nx.at)) nx = e;
    if (nx && T.d + T.speed * dt >= nx.at * T.len) { T.d = nx.at * T.len; nx.seen = 1; roadPop(S, T, nx); return; }
    // 绕路：绕的这段走一半算一半，多花的时间正好是多走的那几格
    let m = T.speed * dt;
    if (T.detour > 0) { m *= 0.5; T.detour = Math.max(0, T.detour - m); }
    T.d += m;
    if (T.d >= T.len) {
      T.d = T.len; T.phase = 'arrive'; T.at = S.t;
      const st = stopOf(S, T.to);
      revealCircle(S, st.x, st.y, 14);
      logMsg(S, `행렬이 "${st.n}"에 도착했습니다. 새로운 용광로를 배치할 토지를 선택하세요(${ARRIVE_AUTO}초 내에 선택하지 않으면 권장 위치에 배치됩니다).`, 'good', { act: 'arrive', label: '가서 용광로를 넣어' });
      rt(S).fx.push({ kind: 'trip-arrived', k: T.to });
    }
  } else if (T.phase === 'arrive' && S.t - T.at >= ARRIVE_AUTO) { // 关着页面补算时也一样：先等这一分半
    const r = arrive(S);
    if (!r.ok) T.at = S.t; // 实在放不下就过一会儿再试
  }
}
