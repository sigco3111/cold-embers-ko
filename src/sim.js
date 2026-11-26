// 寒烬北行 · 模拟内核（纯逻辑，可在 Node 里跑测试）
import {
  RES, RES_KEYS, FUEL, FUEL_ORDER, GATE, GATE_EVERY, SPOTS, SPOT_KEYS, LANDMARKS, BAND_START,
  tierOfRow, baseTempOfRow, ETERNAL_STAGES, BLD, furnaceHeat, furnaceRadius, furnaceBurn,
  SPECS, SPEC_MAX, specBonus, specTrainCost, EMBER_UPS, emberCost, RAIDERS, STORY, DAY_LEN, LAWS, LAW_CD, TECHS, TECH_GATE, ENDLESS, BOT, BOT_MODELS, CMDS, SITES, CHAPTERS, INFRA, LM_R, FAR_MARKS, DIFF, DIFF_KEYS, FOCUS, FOCUS_KEYS, FOCUS_LVL, FOCUS_CD, NORTH_RULES, RULE_FX, RICH_KINDS, CAMP_SPEC, CSPEC_FX, CSPEC_FX2, ALT, ALT_SWITCH, NORTH_HI, TITLES, FLAMES, FLAGS, FRAMES, NDECO, NORTH_TASK, NORTH_STORY, NORTH_END, TOWER_STEPS, TOWER_FX, FORK, QY, QY_KEYS, WONDERS, WONDER_KEYS,
} from './data.js';
import { W, H, BASE_H, setRows, rowsFor, northStop, northPicks, regenWorld, T_SNOW, T_ICE, getWorld, idx, inMap, hash3, mulberry32 } from './worldgen.js';
import { journeyOf, journeyStep, mainCamp, outpostBlock, outpostKit, moveFuel, fuelUnits, stopOf, depotAuto, growNext, ruleNow, campRule, ruleSpan, ruleSpans, nsOf, SPINE, northN } from './journey.js';
export * from './journey.js';
import { linesTick, bMax, bStar, lineProd, plinesOf, STAR_PROD } from './lines.js';
export * from './lines.js';
import { netStep, autoRoad, roads, roadOn, ships, migrateNet } from './net.js';
export * from './net.js';
import { guildStep, shopHave } from './guild.js';
import { forkStep, qyStep, qyAway, forkBonus, pickOf, loadPicks, bonusTxt } from './north.js';
import { seasonStep, peakProd, tideNow, tideAt, tideGather, TIDE } from './tide.js';
import { feedMul, wonderLock, wonderIn, wonderDem, wonderFeed, wonderDone, wonderProd, wonderCap, wonderWarm, wonderFuel, wonderRes, wonderHope, colossusScare, townBeds, townHope, townProd, townSpec, townStep, isWonder, wonderSpec } from './wonder.js';
export * from './tide.js';
export * from './wonder.js';
export * from './guild.js';
export * from './north.js';

export const VERSION = 1;
export const MIN_PEOPLE = 3;          // 营地永远不会全灭
export const EAT = 0.22;              // 每人每分钟熟食
const HAUL_SPEED = 1.6;        // 格/秒
const SCOUT_SPEED = 0.35;      // 格/秒
const BLIZ_P = 12600, BLIZ_FIRST = 2400, BLIZ_WARN = 600;
export const FORECAST = 3600;  // 暴风雪提前一小时有预报
// 超载熔炉：燃料烧两倍，多出一截热量；炉温 30 分钟烧满，停下后 20 分钟降回来，烧满了被迫停炉 5 分钟
export const OD_FUEL = 2, OD_UP = 100 / 1800, OD_DOWN = 100 / 1200, OD_STALL = 300;
export const odBoost = lvl => 6 + 0.2 * furnaceHeat(lvl);
const RAID_P = 14400, RAID_FIRST = 5400, RAID_WARN = 150;
export const RAID_PREP = 900, RAID_AUTO = 300; // 提前 15 分钟发现袭击者，可以备战；没人下令的话 5 分钟前自动备战
export const FOUND_DIST = 14;         // 熔炉离地标多近算“到达”
export const CAMP_GAP = 18;           // 两座熔炉之间的最小距离

// ---------- 元数据（跨轮保留）----------
export function defaultMeta() {
  return { embers: 0, emberTotal: 0, ups: {}, specs: {}, sites: [0], runs: 0, graduated: false, best: 0 };
}
export function up(S, k) { return (S.meta.ups && S.meta.ups[k]) || 0; }
// 第十二版资源曲线：巧手每级 +4%、最多 15 级，老存档多出来的级数退回余烬
export function fixMeta(meta) {
  if (!meta || meta.curve12) return meta;
  meta.curve12 = true;
  const u = meta.ups || {}, mx = EMBER_UPS.prod.max;
  if ((u.prod || 0) > mx) { let back = 0; for (let l = mx; l < u.prod; l++) back += emberCost('prod', l); meta.embers = (meta.embers || 0) + back; u.prod = mx; meta.refund12 = back; }
  return meta;
}

// ---------- 新的一轮 ----------
export function newRun(meta, site = 0, seed) {
  meta = fixMeta(meta || defaultMeta());
  const runSeed = seed != null ? seed : (Math.floor(Math.random() * 1e9) + 1);
  setRows(BASE_H);
  if (northPicks(runSeed, {})) regenWorld(runSeed); // 1.1 分岔：新的一程，没有选过的路
  const S = {
    v: VERSION, runSeed, t: 0, savedAt: Date.now(), site, nextId: 1, sk: 1, bt: 1,
    camps: [], buildings: [], belts: [], reqs: [], spots: {}, sap: {}, poiDone: {}, poiFound: {}, scouts: [], lines: [], roads: [], ships: [], sends: [], feeds: [],
    reveal: new Uint8Array(W * H), rows: BASE_H, discovered: [], founded: [], known: 1,
    eternal: { stage: 0, have: 0 }, specAt: {}, raidDone: -1,
    stats: { prod: {}, deaths: 0, arrivals: 0, raids: 0, raidsWon: 0, blizzards: 0 },
    log: [], meta, active: 0, ended: false,
  };
  meta.runs = (meta.runs || 0) + 1;
  rt(S);
  const L = LANDMARKS[site];
  const fx = L.x - 1, fy = site === 0 ? L.row - 1 : L.row - 8; // 地标遗迹在营地北边
  const camp = makeCamp(S, fx, fy, L.n);
  S.active = camp.id;
  camp.spec = pickCampSpec(S, camp, furnaceRadius(1) + 1);
  S.journey = { stage: site, main: camp.id, trip: null, fleet: { sled: 0, tractor: 0 }, plan: {}, legs: [], ruins: [] };
  const k = site;
  // 越往北起点：熔炉等级更高、人更多，但更冷
  const supply = 1 + 0.5 * up(S, 'supply');
  camp.people = 8 + 3 * up(S, 'people') + 3 * k;
  const st = camp.stock;
  st.wood = Math.round((120 + 120 * k) * supply);
  st.food = Math.round((70 + 40 * k) * supply);
  st.stone = Math.round((40 + 80 * k) * supply);
  st.plank = Math.round(30 * supply);
  if (k >= 1) { st.plank = Math.round(150 * k * supply); st.coal = Math.round(250 * k * k * supply); st.food += 120 * k; }
  if (k >= 2) { st.iron = Math.round(80 * (k - 1) * supply); }
  if (k >= 3) { st.steel = Math.round(60 * (k - 2) * supply); st.gear = Math.round(20 * (k - 2) * supply); st.engine = 6 * (k - 2); }
  if (k >= 4) { st.seal = Math.round(30 * (k - 3) * supply); }
  if (k >= 5) { st.alloy = Math.round(30 * (k - 4) * supply); st.battery = 60 * (k - 4); }
  if (k >= 6) { st.part = 40; }
  const fb = getB(S, camp.furnace);
  fb.lvl = 1 + 2 * k;
  revealCircle(S, L.x, L.row, 12 + up(S, 'sight'));
  markFounded(S, camp);
  S.known = Math.max(1, tierOfRow(L.row));
  logMsg(S, k === 0 ? STORY.intro : `${STORY.migrate}(${L.n}부터)`, 'story');
  if (k > 0) {
    const kit = starterKit(S, camp, k);
    S.safeUntil = SAFE_START;
    logMsg(S, `사전 팀이 야영지: ${kit}을(를) 설정했습니다. 북쪽의 늑대와 약탈자들은 아직 당신을 알아차리지 못했고, 당신은 약 ${Math.round(SAFE_START / 3600)}시간 동안 공격을 받지 않을 것입니다. 이 시간을 활용하여 방어를 구축하세요.`, 'good');
  }
  return S;
}
// 从北边地标重开：先遣队带着一套现成的营地过来，紧挨着熔炉摆好，人手自动分配
const SAFE_START = 6 * 3600;
function starterKit(S, camp, k) {
  const list = ['tent', 'tent', 'hunter', 'kitchen', 'lumber', 'warehouse'];
  for (let i = 0; i < Math.floor(k / 2); i++) list.push('tent');
  if (k >= 1) list.push('coalmine');
  if (k >= 2) list.push('greenhouse');
  for (let i = 0; i < Math.min(3, k - 1); i++) list.push('tower');
  const f = getB(S, camp.furnace), cx = f.x + 1.5, cy = f.y + 1.5, R = Math.floor(heatRadius(S, camp));
  const got = {};
  for (const type of list) {
    const d = BLD[type], s = d.size;
    let best = null, bs = 1e9;
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const dd = Math.hypot(x + s / 2 - cx, y + s / 2 - cy);
      // 箭塔站在营地外沿，其余的尽量贴着熔炉
      const pre = type === 'tower' ? Math.abs(dd - R * 0.55) : dd - (d.gather ? 6 : 0);
      if (dd > R || pre > bs) continue;
      const ck = checkPlace(S, type, x, y);
      if (!(ck.ok || ck.soft) || ck.camp !== camp.id || (d.gather && !ck.spots)) continue;
      const sc = type === 'tower' ? pre : dd - (d.gather ? Math.min(6, ck.spots) : 0);
      if (sc < bs) { bs = sc; best = [x, y]; }
    }
    if (!best) continue;
    clearFootprint(S, type, best[0], best[1], camp.id);
    S.buildings.push({ id: S.nextId++, type, x: best[0], y: best[1], lvl: type === 'tower' ? 1 + Math.floor(k / 2) : 1, workers: 0, camp: camp.id });
    got[type] = (got[type] || 0) + 1;
    dirty(S);
  }
  autoAssign(S, camp);
  return Object.keys(got).map(t => BLD[t].n + (got[t] > 1 ? ' ×' + got[t] : '')).join(',');
}

export function makeCamp(S, fx, fy, name) {
  const id = S.nextId++;
  const camp = { id, name, stock: {}, people: 0, wait: 0, popFix: 1, bots: 0, cores: 0, furnace: 0, x: fx + 1.5, y: fy + 1.5, deathAcc: 0, arriveAcc: 0, temp: 0, fuelPref: 'auto' };
  S.camps.push(camp);
  const b = { id: S.nextId++, type: 'furnace', x: fx, y: fy, lvl: 1, workers: 0, camp: id };
  S.buildings.push(b);
  camp.furnace = b.id;
  dirty(S);
  return camp;
}

// ---------- 运行期缓存（不存档）----------
export function rt(S) {
  if (!S._rt) Object.defineProperty(S, '_rt', { value: { b: {}, c: {}, dirty: true, fx: [], warn: {} }, enumerable: false, writable: true });
  return S._rt;
}
export function dirty(S) { rt(S).dirty = true; }
function rebuild(S) {
  const R = rt(S);
  if (!R.veinsOk) { R.veinsOk = true; applyVeins(S); }
  if (!S.belts) S.belts = [];
  if (!R.dirty) return R;
  R.dirty = false;
  R.occ = new Int32Array(W * H);
  R.byId = new Map();
  for (const b of S.buildings) {
    R.byId.set(b.id, b);
    const s = BLD[b.type].size;
    for (let y = b.y; y < b.y + s; y++) for (let x = b.x; x < b.x + s; x++) if (inMap(x, y)) R.occ[idx(x, y)] = b.id;
  }
  // 排队等材料的建筑也占着地（记成负的 id）
  for (const q of S.queue || []) {
    const s = BLD[q.type].size;
    for (let y = q.y; y < q.y + s; y++) for (let x = q.x; x < q.x + s; x++) if (inMap(x, y)) R.occ[idx(x, y)] = -q.id;
  }
  R.campOf = new Map(S.camps.map(c => [c.id, c]));
  R.gatherSpots = new Map();
  R.dist = new Map();
  R.adj = new Map();
  for (const b of S.buildings) {
    const d = BLD[b.type];
    if (d.gather) R.gatherSpots.set(b.id, findSpots(S, b.type, b.x, b.y));
    R.dist.set(b.id, haulDistOf(S, b.camp, b.x, b.y, d.size, b.id));
  }
  for (const b of S.buildings) R.adj.set(b.id, synergyOf(S, b.type, b.x, b.y, b.id));
  // 传送带：占着的地、每栋建筑哪些物资是直供的
  R.beltOcc = new Map(); R.beltIn = new Map(); R.beltOut = new Map();
  S.belts = S.belts.filter(e => R.byId.has(e.a) && R.byId.has(e.b));
  for (const e of S.belts) {
    for (const i of beltTiles(R.byId.get(e.a), R.byId.get(e.b))) R.beltOcc.set(i, e.id);
    const o = R.beltOut.get(e.a) || {}; o[e.k] = Math.max(o[e.k] || 0, e.lvl); R.beltOut.set(e.a, o);
    const n = R.beltIn.get(e.b) || {}; n[e.k] = Math.max(n[e.k] || 0, e.lvl); R.beltIn.set(e.b, n);
  }
  return R;
}
export function getB(S, id) { return rebuild(S).byId.get(id); }
export function getCamp(S, id) { return rebuild(S).campOf.get(id); }
export function campBuildings(S, cid) { return S.buildings.filter(b => b.camp === cid); }
export function occAt(S, x, y) { return inMap(x, y) ? rebuild(S).occ[idx(x, y)] : -1; }

export function logMsg(S, msg, kind = 'info', act) {
  S.log.push({ t: S.t, msg, kind });
  if (S.log.length > 80) S.log.shift();
  rt(S).fx.push({ kind: 'toast', msg, type: kind, act });
}

// ---------- 地图查询 ----------
export function isRevealed(S, x, y) { return inMap(x, y) && S.reveal[idx(x, y)] === 1; }
export function revealCircle(S, cx, cy, r) {
  const W0 = getWorld(S.runSeed);
  let changed = false;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (!inMap(x, y)) continue;
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
    const i = idx(x, y);
    if (!S.reveal[i]) { S.reveal[i] = 1; changed = true; }
  }
  if (!changed) return;
  rt(S).revealDirty = true; rt(S).revealN = (rt(S).revealN || 0) + 1;
  // 解锁新层（看到了更北的纬度）
  const top = Math.min(H - 1, Math.floor(cy + r));
  const t = tierOfRow(top);
  if (t > S.known) {
    for (let k = S.known + 1; k <= t; k++) logMsg(S, `정찰더 북쪽 땅으로 이동: "${['', '모닥불', '석탄과 철', '강철과 증기', '석유와 철도', '서리수정', '유적 금속', '노심'][k]}"의 1층에 있는 건물을 잠금 해제하세요.`, 'good');
    S.known = t;
  }
  LANDMARKS.forEach((l, i) => {
    if (S.discovered.includes(i)) return;
    if ((l.x - cx) ** 2 + (l.row - cy) ** 2 <= r * r) {
      S.discovered.push(i);
      if (i > 0) logMsg(S, `랜드마크 "${l.n}" 발견: ${l.desc} 행렬북상 여기에 도착하면 새로운 본영입니다.`, 'story');
    }
  });
  void W0;
}
export function spotLeft(S, i) {
  if (S.spots[i] != null) return S.spots[i];
  const w = getWorld(S.runSeed);
  return w.spot[i] >= 0 ? w.spotInit[i] * (1 + 0.15 * up(S, 'reserve')) : 0;
}
export function spotMax(S, i) { const w = getWorld(S.runSeed); return w.spotInit[i] * (1 + 0.15 * up(S, 'reserve')); }
// 砍光的树林、打光的猎场会慢慢长回来；长到三成以前是树苗/幼崽，不能采
export const SAP_RIPE = 0.3;
export function isSapling(S, i) { return !!(S.sap && S.sap[i]); }
export function harvestLeft(S, i) { return isSapling(S, i) ? 0 : spotLeft(S, i); }

function findSpots(S, type, x, y) {
  const d = BLD[type], w = getWorld(S.runSeed);
  const cx = x + d.size / 2, cy = y + d.size / 2, r = d.reach + d.size / 2;
  const kinds = d.gather.map(k => SPOT_KEYS.indexOf(k)), occ = rt(S).occ;
  const out = [];
  for (let yy = Math.floor(cy - r); yy <= cy + r; yy++) for (let xx = Math.floor(cx - r); xx <= cx + r; xx++) {
    if (!inMap(xx, yy)) continue;
    const i = idx(xx, yy);
    if (!kinds.includes(w.spot[i])) continue;
    if ((occ && occ[i]) || (xx >= x && xx < x + d.size && yy >= y && yy < y + d.size)) continue; // 压在建筑下面的不算
    const dd = Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy);
    if (dd > r) continue;
    if (!S.reveal[i]) continue;
    out.push({ i, d: dd, x: xx, y: yy });
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}

// 到最近仓储点（熔炉/仓库）的距离
function haulDistOf(S, campId, x, y, size, selfId) {
  const cx = x + size / 2, cy = y + size / 2;
  let best = 99;
  for (const b of S.buildings) {
    if (b.camp !== campId || b.id === selfId) continue;
    if (b.type !== 'furnace' && b.type !== 'warehouse') continue;
    const s = BLD[b.type].size;
    const d = Math.hypot(b.x + s / 2 - cx, b.y + s / 2 - cy) - (s + size) / 2 + 1;
    if (d < best) best = d;
  }
  return Math.max(1, best);
}
function synergyOf(S, type, x, y, selfId) {
  const d = BLD[type];
  if (!d.syn) return 0;
  const R = rt(S);
  const seen = new Set();
  const s = d.size;
  for (let yy = y - 1; yy <= y + s; yy++) for (let xx = x - 1; xx <= x + s; xx++) {
    if (!inMap(xx, yy)) continue;
    const inside = xx >= x && xx < x + s && yy >= y && yy < y + s;
    if (inside) continue;
    const o = R.occ[idx(xx, yy)];
    if (o && o !== selfId) {
      const ob = R.byId.get(o);
      if (ob && d.syn.includes(ob.type)) seen.add(o);
    }
  }
  return Math.min(4, seen.size);
}
export const SYN_PER = 0.12;

// 供热圈半径：熔炉等级 + 蒸汽管道
export function heatRadius(S, camp) { return furnaceRadius(getB(S, camp.furnace).lvl) + (camp.pipe || 0) + (firstLeg(S) ? 2 : 0) + ruleWarm(S, camp) + (towerLitAt(S, camp) ? TOWER_FX.warm : 0) + (cmdOn(S, 'shelter', camp) ? 2 : 0) + wonderWarm(S); }
// 地貌规则改暖圈：地热谷 +3，富矿带 −2（只管这一站的主营地）
// 暖圈变小的站（富矿带）：到站头两天照样给首程那 +2 格，抵掉 −2，先把营地铺开
export const RICH_GRACE = 2 * DAY_LEN;
export function richGrace(S) { const h = ruleSpan(S, S.t); return !!h && h.r === 'rich' && S.t - h.t0 < RICH_GRACE; }
export function ruleWarm(S, camp) { const r = campRule(S, camp); return r === 'geo' ? RULE_FX.geoWarm : r === 'rich' ? (richGrace(S) ? 0 : RULE_FX.richWarm) : 0; }
// 不烧燃料也扩暖圈的建筑：蒸汽暖炉、地热井（以建筑中心算）
const WARMERS = ['heater', 'geowell'];
// 第一程放宽：人口上限 +10，供热圈 +2 格
export function firstLeg(S) { return journeyOf(S).stage === 0; }
// 人口上限：每座营地 12 + 6 × 熔炉等级。帐篷再多，超过上限也没人来；已经超过的不会走
// 补给站自己运转时只按留守的人烧火：熔炉按「够这么多人住」的那一级烧，不会几小时烧光一座大熔炉的燃料、再一批批冻死人
// 「临时接手」以后照常按熔炉等级烧
// 燃料还能撑几分钟：算上伐木、挖煤的进账（cr.flow 里的产出减消耗，消耗已经含熔炉）。进账跟得上就是 Infinity；眼下就断着燃料是 0
export function fuelLeft(cr) {
  if (!cr || !cr.burnPerMin) return Infinity;
  if ((cr.fueled ?? 1) < 0.999) return 0;
  const fl = cr.flow || {}; let net = 0;
  for (const f in FUEL) { const x = fl[f]; if (x) net += (x.p - x.c) * FUEL[f]; }
  return net >= -0.05 ? Infinity : (cr.fuelUnits || 0) / -net;
}
export function depotFireLvl(S, camp, fb = getB(S, camp.furnace)) {
  if (!depotAuto(camp)) return fb.lvl;
  return Math.max(1, Math.min(fb.lvl, Math.ceil((camp.people - 12) / 6) + 1));
}
export function popCap(S, camp) { return 12 + 6 * getB(S, camp.furnace).lvl + (firstLeg(S) ? 10 : 0); }
export function popRoom(S, camp) { return popCap(S, camp) - camp.people - awayOf(S, camp); }
// 营地基建
export function infraCost(S, camp, k) { const L = INFRA[k].lv[(camp[k] || 0) + 1]; return L ? L.cost : null; }
export function upgradeInfra(S, cid, k) {
  const camp = getCamp(S, cid), cost = infraCost(S, camp, k);
  if (!cost) return { ok: false, reason: '이미 최고레벨이네' };
  for (const r in cost) if (RES[r].t > S.known) return { ok: false, reason: `"${RES[r].n}" 필요 - 먼저 정찰 북쪽으로 위도까지 이동하세요.` };
  if (!canAfford(camp.stock, cost)) return { ok: false, reason: '부족: ' + missing(camp.stock, cost).join(',') };
  pay(camp.stock, cost);
  camp[k] = (camp[k] || 0) + 1;
  const L = INFRA[k].lv[camp[k]];
  if (k === 'pipe') revealCircle(S, camp.x, camp.y, heatRadius(S, camp) + 2);
  dirty(S); rt(S).infraDirty = true;
  logMsg(S, `"${camp.name}"이 ${L.n}:${L.d}을(를) 수정했습니다.`, 'good');
  return { ok: true };
}

// 某格属于哪个营地的供热区（-1 = 冷区）
export function warmCampAt(S, x, y) {
  const px = x + 0.5, py = y + 0.5;
  let best = -1, bd = 1e9;
  for (const c of S.camps) {
    const r = heatRadius(S, c);
    const d = Math.hypot(px - c.x, py - c.y);
    if (d <= r && d < bd) { bd = d; best = c.id; }
  }
  if (best >= 0) return best;
  for (const b of S.buildings) {
    if (!WARMERS.includes(b.type)) continue;
    const h = BLD[b.type].size / 2, d = Math.hypot(px - (b.x + h), py - (b.y + h));
    if (d <= BLD[b.type].hreach && d < bd) { bd = d; best = b.camp; }
  }
  return best;
}

// ---------- 花费 ----------
export function countType(S, cid, type) { let n = 0; for (const b of S.buildings) if (b.camp === cid && b.type === type) n++; return n; }
// ---------- 装饰：让大家心里亮一点 ----------
export const DECO_CAP = 16;
export function decoHope(S, camp) {
  let raw = 0;
  for (const b of S.buildings) {
    if (b.camp !== camp.id) continue;
    const d = BLD[b.type]; if (!d.hope) continue;
    const mx = maxWorkers(b.type, b.lvl);
    raw += d.hope * (1 + 0.25 * (b.lvl - 1)) * (mx ? Math.min(1, b.workers / mx) : 1);
  }
  return { raw, v: DECO_CAP * (1 - Math.exp(-raw / DECO_CAP)) };
}
export function decoOne(b) { const d = BLD[b.type]; return d.hope ? d.hope * (1 + 0.25 * (b.lvl - 1)) : 0; }
// ---------- 医务所 ----------
export const WARD_GUARD = 0.35, WARD_REC = 0.3, DOC_AFTER = 180;
export function wardBeds(lvl) { return BLD.infirmary.beds + 2 * (lvl - 1); }
// 全营地的病床（按人手折算）、平均医护水平（医生加成）、值守程度（最好的那座）
export function wardOf(S, camp) {
  let beds = 0, care = 0, guard = 0;
  for (const b of S.buildings) {
    if (b.camp !== camp.id || b.type !== 'infirmary') continue;
    const mx = maxWorkers(b.type, b.lvl), sf = mx ? Math.min(1, b.workers / mx) : 0, n = wardBeds(b.lvl) * sf;
    beds += n; care += n * (1 + specOf(S, b)); guard = Math.max(guard, sf);
  }
  return { beds, care: beds ? care / beds : 1, guard };
}
// ---------- 营地专精 ----------
export function focusOf(camp) { return camp && camp.focus ? FOCUS[camp.focus] : null; }
const inList = (L, type) => L === 'make' ? BLD[type].cat === 'make' && type !== 'kitchen' && type !== 'greenhouse' : L === 'gather' ? BLD[type].cat === 'gather' : !!L && L.includes(type);
export function focusProd(camp, type) {
  const F = focusOf(camp); if (!F) return 0;
  let v = F.all || 0;
  if (inList(F.up, type)) v += F.upV;
  if (inList(F.down, type)) v += F.downV;
  return v;
}
export function focusLeft(S, camp) { return camp.focusAt == null ? 0 : Math.max(0, FOCUS_CD - (S.t - camp.focusAt)); }
export function focusBlock(S, camp, k) {
  if (getB(S, camp.furnace).lvl < FOCUS_LVL) return `용광로 ${FOCUS_LVL} 레벨 이후에만 전문화를 선택할 수 있습니다.`;
  if (camp.focus === k) return '이건 이미 전문이야';
  const left = focusLeft(S, camp);
  if (camp.focus && left > 0) return `전문화를 변경했지만 여전히 ${Math.ceil(left / 60)}분 기다려야 함`;
  return null;
}
export function setFocus(S, cid, k) {
  const camp = getCamp(S, cid); if (!camp || !FOCUS[k]) return { ok: false };
  const why = focusBlock(S, camp, k); if (why) return { ok: false, reason: why };
  const had = camp.focus;
  camp.focus = k; camp.focusAt = S.t;
  logMsg(S, had ? `"${camp.name}"이(가) ${FOCUS[k].n}야영지로 변경되었습니다.` : `"${camp.name}"은 ${FOCUS[k].n}야영지 방향을 설정합니다. ${FOCUS[k].d}`, 'good');
  rt(S).fx.push({ kind: 'focus', camp: cid, k });
  return { ok: true };
}
export function diffOf(S) { return DIFF[S.meta && S.meta.diff] || DIFF.std; }
function thrift(S) { return (1 - 0.04 * up(S, 'thrift')) * diffOf(S).cost; }
export function buildCost(S, type, cid, y, extra = 0) {
  const d = BLD[type];
  const out = {};
  if (d.rule && freeTok(getCamp(S, cid), type)) return out; // 奇遇给的，不要材料
  if (type === 'furnace') {
    const n = S.camps.length;
    const t = tierOfRow(y);
    const m = Math.pow(1.25, n - 1) * thrift(S);
    for (const k in d.cost) out[k] = Math.round(d.cost[k] * m);
    for (let g = 2; g <= t - 1; g++) out[GATE[g]] = (out[GATE[g]] || 0) + Math.round(150 * Math.pow(1.4, t - 1 - g) * m);
    return out;
  }
  const m = Math.pow(1.1, countType(S, cid, type) + extra) * thrift(S); // 同种建筑每多一座贵 10%
  for (const k in d.cost) out[k] = Math.round(d.cost[k] * m);
  return out;
}
export function gateTier(type, lvl) { return Math.min(7, BLD[type].t + Math.floor(lvl / GATE_EVERY)); }
export function upgradeCost(S, b) {
  const d = BLD[b.type];
  const L = b.lvl;
  const out = {};
  const m = thrift(S);
  const base = b.type === 'furnace' ? { wood: 120, stone: 80, plank: 30 } : d.cost;
  const g = gateTier(b.type, L);
  // 基础材料每级贵 10%；产量每级只加固定的 15%，所以 10 级以后光升级越来越不划算，该开新线或者往北走
  const baseGrow = Math.pow(UP_GROW, L);
  for (const k in base) out[k] = Math.round(base[k] * baseGrow * m);
  if (g > d.t) {
    const gm = GATE[g];
    const into = L - (g - d.t) * GATE_EVERY; // 进入本层后的级数
    out[gm] = (out[gm] || 0) + Math.round((b.type === 'furnace' ? 30 : 12) * Math.pow(1.35, Math.min(4, Math.max(0, into))) * Math.pow(UP_GROW, Math.max(0, into - 4)) * (1 + 0.6 * (g - 2)) * m);
    // 上一层门槛材料继续少量需要，让老流水线保持有用
    if (g - 1 > d.t) { const pm = GATE[g - 1]; out[pm] = (out[pm] || 0) + Math.round(out[gm] * 1.5); }
  }
  if (b.type === 'furnace' && L >= 8) out.engine = Math.round(4 * Math.pow(UP_GROW, L - 8) * m);
  if (b.type === 'furnace' && L >= 18) out.battery = Math.round(10 * Math.pow(UP_GROW, L - 18) * m);
  if (b.type === 'furnace' && L >= 35) out.starcore = Math.round(6 * Math.pow(UP_GROW, L - 35) * m); // 35 级以后要星核
  return out;
}
export function canAfford(stock, cost) { for (const k in cost) if ((stock[k] || 0) < cost[k] - 1e-9) return false; return true; }
export function pay(stock, cost) { for (const k in cost) stock[k] = (stock[k] || 0) - cost[k]; }
export function missing(stock, cost) { const m = []; for (const k in cost) if ((stock[k] || 0) < cost[k]) m.push(`${RES[k].n} ${Math.ceil(cost[k] - (stock[k] || 0))}`); return m; }

// ---------- 摆放 ----------
// 建筑每升一级产量 +15%（按 1 级的量算，不利滚利）；升级花费每级贵 10%
export const LVL_STEP = 0.15, UP_GROW = 1.1;
export const levelMul = lvl => 1 + LVL_STEP * (lvl - 1);
// 每 5 级（跨一层）多一个岗位：前 10 级升级让每个人做得更多，再往后主要省地方
export function maxWorkers(type, lvl) { const d = BLD[type]; return d.w ? d.w + Math.floor((lvl - 1) / 5) : 0; }
export function housingOf(b, S) { const n = BLD.tent.housing + 3 * (b.lvl - 1), c = S && getCamp(S, b.camp); return c && c.town ? Math.round(n * townBeds(c)) : n; } // 镇以上床位 +20%
// 床位：帐篷总床位；出门侦察、探险的人床位给他们留着
export function bedsOf(S, camp) { let n = 0; for (const b of S.buildings) if (b.camp === camp.id && b.type === 'tent') n += housingOf(b, S); return n; }
export function awayOf(S, camp) { let n = qyAway(S, camp); for (const s of S.scouts) if (s.camp === camp.id) n += s.n; return n; }
export function freeBeds(S, camp) { return bedsOf(S, camp) - camp.people - awayOf(S, camp); }
// 新来的人：有空床就住进来，没有就先在营地外的窝棚里等床位（不干活也不算人口，盖好帐篷自动住进来）
export function addPeople(S, camp, n) {
  const inn = Math.max(0, Math.min(n, Math.floor(freeBeds(S, camp))));
  camp.people += inn;
  if (n > inn) camp.wait = (camp.wait || 0) + n - inn;
  S.stats.arrivals += n;
  return { inn, wait: n - inn };
}
export function insulOf(b) { return BLD.tent.insul + 2 * (b.lvl - 1); }
export function storeCap(S, camp) {
  let cap = 250 + 150 * getB(S, camp.furnace).lvl;
  for (const b of S.buildings) if (b.camp === camp.id && b.type === 'warehouse') cap += BLD.warehouse.store * Math.pow(b.lvl, 1.2);
  return Math.round(cap * (1 + techSum(S, 'cap')) * wonderCap(S));
}
// 1.1 奇遇给的免费建筑（地热喷发 → 一座地热井，不看地貌）
export const freeTok = (camp, type) => !!(camp && camp.freeB && camp.freeB[type] > 0);
export const freeAny = (S, type) => S.camps.some(c => freeTok(c, type));
export function unlocked(S, type) { const d = BLD[type]; return d.t <= S.known && (!d.shop || shopHave(S, type)) && (!d.gift || cosHave(S, 'deco', type)) && (!d.stage || journeyOf(S).stage >= d.stage) && (!d.rule || ruleNow(S) === d.rule || freeAny(S, type)) && (!d.tower || !towerLock(S, type)) && (!d.wonder || !wonderLock(S, type)); }
// 永恒之炉以北的新东西：走到那一程才解锁；北境地貌的建筑：只有那种地貌的站能建
export const stageLock = (S, type) => { const d = BLD[type]; if (d.shop && !shopHave(S, type)) return `${d.shop} 은화에 북방 상회에서 청사진을 구매하세요`; if (d.gift && !cosHave(S, 'deco', type)) { const a = giftFrom('deco', type); return `업적「${a && a.hid && !bookOf(S).a[a.id] ? '？？？' : a ? a.n : '？'}」 잠금 해제됨`; } if (d.rule && ruleNow(S) !== d.rule && !freeAny(S, type)) return `"${NORTH_RULES[d.rule].n}" 사이트에만 구축할 수 있습니다.`; if (d.tower && towerLock(S, type)) return towerLock(S, type); if (d.wonder && wonderLock(S, type)) return wonderLock(S, type); return d.stage && journeyOf(S).stage < d.stage ? `빌드하려면 "${stopOf(S, d.stage).n}"으로 이동해야 합니다.` : ''; };
export const forecastOf = S => FORECAST * (journeyOf(S).stage >= 9 ? 2 : 1) * (ruleNow(S) === 'storm' ? 2 : 1); // 到了极光观测站，天气预报提前一倍；风暴走廊再早一倍
// 加工厂不把基础建材吃光：锯木厂不会把木材全锯成木板、炼钢厂不会把铁锭用完——仓库里留两成（最多 300）给建造。
// 只管前两层的建材；更高层的中间品本来就是为了往下加工，留料会卡住整条链
export const KEEP_FRAC = 0.2, KEEP_MAX = 300, KEEP_WHY = '건설용 재료 남겨두기';
// 燃料也留一份给熔炉：工厂和烽火塔塔身拿燃料（木材、煤、焦煤、晶体电池）时，营地的燃料总量不低于熔炉 FUEL_KEEP_MIN 分钟的用量
export const FUEL_KEEP_MIN = 10, FUEL_KEEP_WHY = '연료를 용광로에 맡기세요';
// 「造燃料」的建筑：产出的燃料份数比吃进去的燃料多（晶体电池厂、焦煤炉）。它们缺的非燃料原料（铁锭）算进 feed，造这些原料的建筑也不受留燃料限制
export function fuelGain(d) { let o = 0, i = 0; for (const k in d.out || {}) o += (FUEL[k] || 0) * d.out[k]; for (const k in d.in || {}) i += (FUEL[k] || 0) * d.in[k]; return o > 0 && o > i; }
export function fuelFeedOf(plans) {
  const feed = new Set();
  for (const p of plans) {
    const d = p.d; if (!d.in || !fuelGain(d) || p.b.workers <= 0) continue;
    for (const k in d.in) if (!FUEL[k]) feed.add(k);
  }
  return feed;
}
export function fuelFeedFree(d, feed) { if (fuelGain(d)) return true; for (const k in d.out || {}) if (feed.has(k)) return true; return false; }
export function fuelKeep(st, k, keepU) { return FUEL[k] && keepU > 0 ? Math.max(0, (keepU - (fuelUnitsOf(st) - (st[k] || 0) * FUEL[k])) / FUEL[k]) : 0; }
const BUILD_MAT = new Set(); for (const t in BLD) for (const k in BLD[t].cost || {}) if (RES[k].t <= 2 && k !== 'game' && k !== 'food') BUILD_MAT.add(k); // 生肉、熟食是口粮，不当建材留
export function isBuildMat(k) { return BUILD_MAT.has(k); }
export function keepOf(camp, k, cap) { return camp.keep !== false && BUILD_MAT.has(k) ? Math.min(KEEP_MAX, cap * KEEP_FRAC) : 0; }

export function checkPlace(S, type, x, y, selfQ = 0, selfB = 0) {
  const d = BLD[type];
  const s = d.size;
  const w = getWorld(S.runSeed);
  const res = { ok: false, reason: '', camp: -1, dist: 0, spots: 0, syn: 0, cost: null };
  if (!Number.isFinite(x) || !Number.isFinite(y)) { res.reason = '지도 밖에서'; return res; }
  if (!unlocked(S, type)) { res.reason = d.t <= S.known ? stageLock(S, type) : `먼저 "${['', '모닥불', '석탄과 철', '강철과 증기', '석유와 철도', '서리수정', '유적 금속', '노심'][d.t]}" 위도까지 정찰이 필요합니다.`; return res; }
  if (type === 'furnace') { const why = outpostBlock(S, y + 1.5); if (why) { res.reason = why; return res; } }
  for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) {
    if (!inMap(xx, yy)) { res.reason = '지도 밖에서'; return res; }
    const i = idx(xx, yy);
    if (!S.reveal[i]) { res.reason = '건설은 안개에서 사용할 수 없습니다.'; return res; }
    if (w.terrain[i] !== T_SNOW) { res.reason = '고르지 않은 지형(바위 또는 얼음호수)'; return res; }
    if (w.spot[i] >= 0 && spotLeft(S, i) > 0) {
      // 树、碎石、兽群可以顺手清掉（返还一点材料）；矿点不能压
      if (!CLEARABLE[SPOT_KEYS[w.spot[i]]]) { res.reason = SPOT_KEYS[w.spot[i]] === 'ruin' ? '고성 폐허가 이 장소를 차지하고 있습니다. 폐허를 클릭하여 철거하세요. 일손 배치' : '채굴 현장은 다음과 같습니다. 옆에 건설하고 해당 채집 건물을 사용하여 채굴하세요.'; return res; }
      res.clears = (res.clears || 0) + 1;
    }
    { const o = occAt(S, xx, yy); if (o && o !== -selfQ && (!selfB || o !== selfB)) { res.reason = o < 0 ? '자재를 기다리는 건물이 여기 늘어서 있어요' : '다른 건물과 겹쳐서'; return res; } }
    if (landmarkBlock(xx, yy, S)) { res.reason = '랜드마크와 유적지가 이곳을 차지하고 있습니다.'; return res; }
    if (siteAt(S, xx, yy, 1)) { res.reason = '여기에 폐허가 있습니다'; return res; }
    if (caravanAt(S, xx, yy)) { res.reason = '캐러밴의 썰매가 여기에 멈췄습니다.'; return res; }
    if (rebuild(S).beltOcc.has(i)) { res.reason = '컨베이어 벨트가 여기를 통과해요'; return res; }
  }
  if (type === 'furnace') {
    const cx = x + 1.5, cy = y + 1.5;
    for (const c of S.camps) if (Math.hypot(c.x - cx, c.y - cy) < CAMP_GAP) { res.reason = `'${c.name}'에 너무 가깝습니다(최소 ${CAMP_GAP} 블록).`; return res; }
    const act = getCamp(S, S.active), payer = act && !act.depot ? act : mainCamp(S);
    res.camp = payer.id;
    res.cost = buildCost(S, type, payer.id, y);
    if (payer.people < 16) { res.reason = `"${payer.name}"에는 사전 팀을 구성하기 위해 최소 16명이 필요합니다.`; return res; }
    // 先遣队路上和开头要吃要烧：离得越远带得越多
    const kit = res.kit = outpostKit(S, payer, cx, cy);
    const all = { ...res.cost }; all.food = (all.food || 0) + kit.food;
    const short = missing(payer.stock, all);
    if (fuelUnits(payer.stock) < kit.fuel + 1e-9) short.push(`연료 ${Math.ceil(kit.fuel - fuelUnits(payer.stock))} 부분`);
    if (short.length) { res.reason = '부족: ' + short.join(','); res.soft = true; return res; }
    res.ok = true; return res;
  }
  // 普通建筑：整块都要在同一营地的供热区
  let camp = -2;
  for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) {
    const c = warmCampAt(S, xx, yy);
    if (c < 0) { res.reason = '용광로난방 구역에는 없음(너무 추움)'; return res; }
    if (camp === -2) camp = c; else if (camp !== c) { res.reason = '두 개의 야영지를 교차했습니다.'; return res; }
  }
  res.camp = camp;
  const cobj = getCamp(S, camp);
  if (d.rule && !freeTok(cobj, type) && (camp !== journeyOf(S).main || ruleNow(S) !== d.rule)) { res.reason = freeAny(S, type) ? `기연이 제공하는 무료 ${d.n}은(는) "${S.camps.find(c => freeTok(c, type)).name}"에만 구축할 수 있습니다.` : `본영은 "${NORTH_RULES[d.rule].n}" 역에서만 건설할 수 있습니다.`; return res; }
  if (d.tower && camp !== journeyOf(S).main) { res.reason = `${d.n}은(는) 이 스테이션의 본영에만 건설할 수 있습니다.`; return res; }
  if (d.wonder) { const o = wonderIn(S, camp); if (o && o.id !== selfB) { res.reason = `"${cobj.name}"에는 이미 하나의 ${BLD[o.type].n}(야영지 하나, 최대 불가사의 하나)이 있습니다.`; return res; } }
  if (depotAuto(cobj)) { res.reason = `"${cobj.name}"은(는) 보급 창고입니다. 자체적으로 운영되며 새 집을 짓지 않습니다(지어야 할 경우 "일시적으로 인수"해야 함).`; return res; }
  res.cost = buildCost(S, type, camp, y);
  res.dist = haulDistOf(S, camp, x, y, s, selfB || -1);
  if (d.gather) res.spots = findSpots(S, type, x, y).filter(p => spotLeft(S, p.i) > 0).length;
  res.syn = synergyOf(S, type, x, y, selfB || -1);
  if (!canAfford(cobj.stock, res.cost)) { res.reason = '부족: ' + missing(cobj.stock, res.cost).join(','); res.soft = true; return res; }
  res.ok = true;
  return res;
}

export function place(S, type, x, y) {
  const c = checkPlace(S, type, x, y);
  if (!c.ok) return c;
  clearFootprint(S, type, x, y, c.camp);
  if (type === 'furnace') {
    const payer = getCamp(S, c.camp);
    pay(payer.stock, c.cost);
    const name = nearLandmarkName(x + 1.5, y + 1.5) || `번호 ${S.camps.length + 1} 야영지`;
    const camp = makeCamp(S, x, y, name);
    const move = Math.min(10, payer.people - 6);
    payer.people -= move; camp.people += move;
    trimWorkers(S, payer);
    getB(S, camp.furnace).lvl = 2 + 2 * (tierOfRow(camp.y) - 1); // 越往北，前哨熔炉一开始就要烧得越旺
    camp.spec = pickCampSpec(S, camp, furnaceRadius(getB(S, camp.furnace).lvl) + 1);
    // 先遣队带上口粮和燃料，再顺手捎点木板
    payer.stock.food -= c.kit.food; camp.stock.food = (camp.stock.food || 0) + c.kit.food;
    moveFuel(payer.stock, camp.stock, c.kit.fuel);
    { const take = Math.min(payer.stock.plank || 0, 60); payer.stock.plank = (payer.stock.plank || 0) - take; camp.stock.plank = (camp.stock.plank || 0) + take; }
    revealCircle(S, camp.x, camp.y, 8);
    markFounded(S, camp);
    logMsg(S, `전초기지 야영지 켜짐: "${camp.name}". ${move}는 배급의 ${c.kit.food}개 사본 및 연료의 ${c.kit.fuel}개 사본과 함께 "${payer.name}"에서 이동했습니다. ${autoRoad(S, camp.id) ? '썰매 도로가 수리되어 가장 가까운 야영지에 연결되었습니다. 필요한 자재가 무엇이든 물류망가 스스로 운반합니다.' : ''}`, 'good');
    S.active = camp.id;
    dirty(S);
    return { ok: true, id: camp.furnace, camp: camp.id };
  }
  const camp = getCamp(S, c.camp);
  pay(camp.stock, c.cost);
  if (BLD[type].rule && freeTok(camp, type)) { camp.freeB[type]--; if (camp.freeB[type] <= 0) delete camp.freeB[type]; }
  const b = { id: S.nextId++, type, x, y, lvl: 1, workers: 0, camp: c.camp };
  S.buildings.push(b);
  dirty(S);
  if (BLD[type].wonder) { b.wd = { ph: 0, p: 0 }; const sp = wonderSpec(type, 0); logMsg(S, `🏗️ ${BLD[type].n}건설 현장은 동그라미로 표시되어 있습니다. 건설은 3단계로 나누어진다. 첫 번째 단계 "${sp.n}」：${sp.kinds.map(k => `${RES[k].n} ${sp.amt[k]}`).join('、')}, 운반꾼가 조금씩 투입되며, 하나가 없으면 작동을 멈춥니다.`, 'story'); }
  if (BLD[type].tower) { b.tn = northN(journeyOf(S).stage); b.tw = { p: 0 }; const sp = towerSpec(S, b.tn); logMsg(S, `🗼 ${towerName(b.tn)}의 기초가 세워졌습니다. 타워 본체에는 ${sp.rate}/분당 ${sp.kinds.map(k => RES[k].n).join('、')}가 필요합니다. ${sp.dur / 60}분 동안 함께 식사하세요. 한 가지 유형이 누락되면 중지됩니다.`, 'story'); }
  // 默认派满人
  b.workers = Math.min(maxWorkers(type, 1), Math.max(0, idleLabor(S, camp)));
  if (b.workers < maxWorkers(type, 1)) autoAssign(S, camp);
  return { ok: true, id: b.id };
}
const CLEARABLE = { tree: { wood: 20 }, rock: { stone: 20 }, herd: { game: 6 }, dead: { wood: 20 } };
export function clearFootprint(S, type, x, y, cid) {
  const w = getWorld(S.runSeed), s = BLD[type].size, camp = getCamp(S, cid);
  let n = 0;
  for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) {
    const i = idx(xx, yy);
    if (w.spot[i] < 0 || spotLeft(S, i) <= 0) continue;
    const g = CLEARABLE[SPOT_KEYS[w.spot[i]]]; if (!g) continue;
    S.spots[i] = 0; n++;
    if (REGROW[SPOT_KEYS[w.spot[i]]]) (S.sap || (S.sap = {}))[i] = 1;
    if (camp) for (const k in g) camp.stock[k] = (camp.stock[k] || 0) + g[k];
  }
  if (n) rt(S).spotsDirty = true;
}
export function landmarkBlock(x, y, S) {
  for (let i = 1; i < LANDMARKS.length; i++) { const l = LANDMARKS[i], r = LM_R[i]; if ((x - l.x) ** 2 + (y - l.row) ** 2 < r * r) return true; }
  if (S && y > 330) { const far = getWorld(S.runSeed).far || []; for (let i = 0; i < far.length; i++) { const r = FAR_MARKS[i].r; if ((x + 0.5 - far[i].x - 0.5) ** 2 + (y + 0.5 - far[i].y - 0.5) ** 2 < r * r) return true; } }
  if (S && y > 840) { // 北境各站的地标
    const k0 = Math.max(1, Math.round((y - 800) / 80));
    for (let k = Math.max(1, k0 - 1); k <= k0 + 1; k++) { const p = northStop(S.runSeed, k); if ((x - p.x) ** 2 + (y - p.y) ** 2 < p.r * p.r) return true; }
  }
  return false;
}
// ---------- 远方地标与遗物 ----------
export function relicSum(S, k) { const R = S.meta.relics; if (!R) return 0; let v = 0; FAR_MARKS.forEach((f, i) => { if (R[i] && f.relic.k === k) v += f.relic.v; }); return v; }
export function farState(S, i) { const F = S.far || {}; return (F.lit || []).includes(i) ? 'lit' : (F.seen || []).includes(i) ? 'seen' : 'none'; }
export const farEmbers = i => 20 + 10 * i;
function farStep(S) {
  const far = getWorld(S.runSeed).far; if (!far) return;
  const F = S.far || (S.far = { seen: [], lit: [] });
  far.forEach((p, i) => {
    const f = FAR_MARKS[i];
    if (!F.seen.includes(i) && S.reveal[idx(p.x, p.y)]) {
      F.seen.push(i);
      const fs = S.meta.farSeen || (S.meta.farSeen = {}), e = fs[i] ? 5 : farEmbers(i); fs[i] = 1; S.meta.embers += e; S.meta.emberTotal = (S.meta.emberTotal || 0) + e;
      logMsg(S, `📍 정찰대가 영야 빙원에서 "${f.n}"을(를) 발견했습니다! ${e}포인트 잔불을 되찾으세요. 옆에 있는 ${FOUND_DIST} 상자에서 용광로를 클릭하면 "${f.relic.n}" 유물을 다시 가져올 수 있습니다.`, 'story', { act: 'far', arg: i, label: '보기' });
      rt(S).fx.push({ kind: 'far', i, lit: false });
    }
    if (F.seen.includes(i) && !F.lit.includes(i) && S.camps.some(c => Math.hypot(c.x - p.x - 0.5, c.y - p.y - 0.5) <= FOUND_DIST + 1)) {
      F.lit.push(i);
      const had = !!(S.meta.relics && S.meta.relics[i]);
      (S.meta.relics || (S.meta.relics = {}))[i] = 1;
      logMsg(S, had ? `야영지의 불빛이 "${f.n}"을(를) 비춥니다. 유물 "${f.relic.n}"이(가) 돌아왔고 모두 이곳에서 쉬었습니다.` : `야영지의 불은 "${f.n}"을 밝히고 유물 "${f.relic.n}": ${f.relic.d}를 가져왔습니다(영구적으로 유효하며 북상 이후에도 유지됩니다).`, 'story', { act: 'far', arg: i, label: '보기' });
      rt(S).fx.push({ kind: 'far', i, lit: true, had });
    }
  });
}
function nearLandmarkName(cx, cy) {
  for (const l of LANDMARKS) if (Math.hypot(l.x - cx, l.row - cy) <= FOUND_DIST) return l.n;
  return null;
}
export function markFounded(S, camp) {
  LANDMARKS.forEach((l, i) => {
    if (Math.hypot(l.x - camp.x, l.row - camp.y) > FOUND_DIST) return;
    if (!S.founded.includes(i)) { S.founded.push(i); if (S.t > 0) rt(S).fx.push({ kind: 'chapter', i }); }
    if (!S.discovered.includes(i)) S.discovered.push(i);
    if (!S.meta.sites.includes(i)) {
      S.meta.sites.push(i); S.meta.sites.sort((a, b) => a - b);
      if (i > 0) { const e = arriveEmbers(S, i, true); S.meta.embers += e; S.meta.emberTotal = (S.meta.emberTotal || 0) + e; logMsg(S, `처음으로 "${l.n}"에 도착했습니다! ${e} 포인트잔불을 가져옵니다.`, 'story'); }
      if (S.t > 0) for (const c of S.camps) bumpMood(c, 12, -5);
    }
    S.meta.best = Math.max(S.meta.best || 0, i);
  });
  // 永恒之炉以北的六个远方地标：第 7～12 站，各开一章
  const far = getWorld(S.runSeed).far || [];
  far.forEach((p, j) => {
    const i = LANDMARKS.length + j;
    if (!CHAPTERS[i] || Math.hypot(p.x + 0.5 - camp.x, p.y + 0.5 - camp.y) > FOUND_DIST + 2) return;
    if (!S.founded.includes(i)) { S.founded.push(i); if (S.t > 0) rt(S).fx.push({ kind: 'chapter', i }); }
    const fa = S.meta.farArr || (S.meta.farArr = {});
    if (!fa[j]) { fa[j] = 1; const e = arriveEmbers(S, i, true); S.meta.embers += e; S.meta.emberTotal = (S.meta.emberTotal || 0) + e; logMsg(S, `처음으로 "${FAR_MARKS[j].n}"에 도착했습니다! ${e} 포인트잔불을 가져옵니다.`, 'story'); if (S.t > 0) for (const c of S.camps) bumpMood(c, 12, -5); }
    S.meta.best = Math.max(S.meta.best || 0, i);
  });
}

// 第一次到达地标给的余烬（新的北行里再到一次只给一点）
export function arriveEmbers(S, i, first) { return Math.round((first ? 15 * i : 5) * (1 + relicSum(S, 'ember')) * diffOf(S).ember); }

export function assignedWorkers(S, cid) { let n = 0; for (const b of S.buildings) if (b.camp === cid) n += b.workers; return n; }
export function idleLabor(S, camp) { return camp.people + botUnits(S, camp) - assignedWorkers(S, camp.id) - scoutsOut(S, camp.id); }
function scoutsOut(S, cid) { return 0 * cid; } // 侦察队成员出发时已从人口中扣除
export function setWorkers(S, bid, n) {
  const b = getB(S, bid); if (!b) return;
  b.hold = n < bMax(S, b); // 玩家手动减人后，自动分配就不再往这里塞人
  const camp = getCamp(S, b.camp);
  const mx = bMax(S, b);
  const free = idleLabor(S, camp) + b.workers;
  b.workers = Math.max(0, Math.min(mx, n, free));
}
export function upgrade(S, bid) {
  const b = getB(S, bid); if (!b) return { ok: false };
  const camp = getCamp(S, b.camp);
  if (depotAuto(camp)) return { ok: false, reason: `"${camp.name}"은(는) 공급 스테이션입니다. 그것은 스스로 작동합니다. 업그레이드가 필요하지 않습니다(승격하려면 "일시적으로 인수").` };
  if (BLD[b.type].tower) return { ok: false, reason: `${BLD[b.type].n}은(는) 사용되지 않습니다. 업그레이드` };
  if (BLD[b.type].wonder) return { ok: false, reason: '불가사의에는 업그레이드가 필요하지 않습니다.' };
  const cost = upgradeCost(S, b);
  if (cost.starcore && journeyOf(S).stage < RES.starcore.stage) return { ok: false, reason: `용광로 레벨 35 이후에는 별핵을 사용해야 합니다. "${stopOf(S, RES.starcore.stage).n}"로 이동하면 파낼 수 있습니다.` };
  for (const k in cost) if (RES[k].t > S.known) return { ok: false, reason: `"${RES[k].n}" 필요 - 먼저 정찰 북쪽으로 위도까지 이동하세요.` };
  if (!canAfford(camp.stock, cost)) return { ok: false, reason: '부족: ' + missing(camp.stock, cost).join(',') };
  pay(camp.stock, cost);
  b.lvl++;
  if (b.hold && b.workers >= maxWorkers(b.type, b.lvl - 1)) b.hold = false;
  dirty(S);
  if (b.type === 'furnace') {
    revealCircle(S, camp.x, camp.y, heatRadius(S, camp) + 2);
    logMsg(S, `"${camp.name}" 용광로가 ${b.lvl} 레벨로 업그레이드되었으며 난방권이 ${heatRadius(S, camp)} 레벨로 확장되었습니다.`, 'good');
  }
  return { ok: true };
}
export function demolish(S, bid) {
  const b = getB(S, bid);
  if (!b || b.type === 'furnace') return { ok: false };
  if (BLD[b.type].tower && (b.tw.lit || b.tw.p > 0)) return { ok: false, reason: '타워 건설은 이미 시작되었으므로 철거할 수 없습니다.' };
  if (BLD[b.type].wonder && b.wd && (b.wd.ph > 0 || b.wd.p > 0)) return { ok: false, reason: '불가사의는 건설을 시작했으며 철거할 수 없습니다' };
  const camp = getCamp(S, b.camp);
  const d = BLD[b.type];
  for (const k in d.cost) camp.stock[k] = (camp.stock[k] || 0) + Math.floor(d.cost[k] * 0.5);
  for (const sid in S.specAt) if (S.specAt[sid] === bid) delete S.specAt[sid];
  if (b.type === 'bay' && b.bots) { if (techDone(S, 'corerec')) { camp.stock.core = (camp.stock.core || 0) + Math.floor(b.bots / 2); logMsg(S, `오토마톤 격납고를 해체한 후 ${b.bots} 오토마톤을 해체하고 ${Math.floor(b.bots / 2)} 핵심을 해체했습니다.`, 'info'); } b.bots = 0; }
  S.buildings = S.buildings.filter(x => x.id !== bid);
  if (b.type === 'bay') { campBots(S, camp); trimWorkers(S, camp); }
  S.belts = (S.belts || []).filter(e => e.a !== bid && e.b !== bid);
  dirty(S);
  return { ok: true };
}

// ---------- 挪建筑（第十三版）：同一个营地的暖圈里换个地方，等级、工人、专家都留着，不花材料，停工 30 秒 ----------
export const MOVE_PAUSE = 30;
export function moveBlock(S, b) {
  if (!b) return '건물이 없어졌어요';
  if (b.type === 'furnace') return '용광로는 이동할 수 없습니다';
  if (BLD[b.type].nomove) return `${BLD[b.type].n}을(를) 이동할 수 없습니다`;
  if (BLD[b.type].tower && (b.tw.lit || b.tw.p > 0)) return '타워 건설이 이미 시작되어 이동할 수 없습니다.';
  if (BLD[b.type].wonder && b.wd && (b.wd.ph > 0 || b.wd.p > 0)) return '불가사의가 공사를 시작하여 이동할 수 없습니다.';
  if (depotAuto(getCamp(S, b.camp))) return '보급창고가 자체적으로 운영되기 때문에 \'임시인계\'로 이전해야 함';
  return '';
}
export function checkMove(S, id, x, y) {
  const b = getB(S, id), why = moveBlock(S, b);
  if (why) return { ok: false, reason: why, camp: -1 };
  const ck = checkPlace(S, b.type, x, y, 0, id);
  if (!ck.ok && !ck.soft) return ck;
  if (ck.camp !== b.camp) return { ...ck, ok: false, soft: false, reason: '동일한 야영지의 난방권 내에서만 이동할 수 있습니다.' };
  if (x === b.x && y === b.y) return { ...ck, ok: false, soft: false, reason: '아직도 같은 곳에' };
  ck.ok = true; ck.soft = false; ck.reason = ''; ck.cost = null;
  ck.belts = (S.belts || []).filter(e => e.a === id || e.b === id).length;
  return ck;
}
export function moveBuilding(S, id, x, y) {
  const ck = checkMove(S, id, x, y); if (!ck.ok) return ck;
  const b = getB(S, id);
  for (const e of (S.belts || []).filter(e => e.a === id || e.b === id)) removeBelt(S, e.id); // 连着的传送带拆掉，退一半材料
  clearFootprint(S, b.type, x, y, b.camp);
  b.x = x; b.y = y; b.moveT = S.t + MOVE_PAUSE;
  const wasDeep = !!b.deep; b.deep = 0; // 深井留在原地
  S.lay = (S.lay || 0) + 1; S.meta.moves = (S.meta.moves || 0) + 1;
  dirty(S);
  return { ok: true, wasDeep, belts: ck.belts };
}

// ---------- 传送带 / 蒸汽轨道：挨着的上下游直接供料，省搬运工，下游也快一点 ----------
export const BELT_MAX = 6, BELT_PER = 4;
export const BELT = [null, { n: '컨베이어 벨트', cut: 0.6, bonus: 0.08, tier: 2 }, { n: '증기 트랙', cut: 0.85, bonus: 0.15, tier: 3 }];
function rectOf(b) { const s = BLD[b.type].size; return { x0: b.x, y0: b.y, s, cx: b.x + s / 2, cy: b.y + s / 2 }; }
// 两栋建筑之间的那一段：从 A 的边沿着中心连线走到 B 的边
export function beltEnds(a, b) {
  const A = rectOf(a), B = rectOf(b), dx = B.cx - A.cx, dy = B.cy - A.cy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const edge = R => Math.min(ux ? R.s / 2 / Math.abs(ux) : Infinity, uy ? R.s / 2 / Math.abs(uy) : Infinity);
  const ta = edge(A), tb = edge(B);
  return { p0: [A.cx + ux * ta, A.cy + uy * ta], p1: [B.cx - ux * tb, B.cy - uy * tb], len: Math.max(0, L - ta - tb), ux, uy };
}
function beltTiles(a, b) {
  const e = beltEnds(a, b), out = new Set(), n = Math.ceil(e.len / 0.15) + 1;
  const inA = (x, y, q) => x >= q.x && x < q.x + BLD[q.type].size && y >= q.y && y < q.y + BLD[q.type].size;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = e.p0[0] + (e.p1[0] - e.p0[0]) * t, y = e.p0[1] + (e.p1[1] - e.p0[1]) * t;
    for (const o of [-0.2, 0.2]) {
      const tx = Math.floor(x - e.uy * o), ty = Math.floor(y + e.ux * o);
      if (!inMap(tx, ty) || inA(tx, ty, a) || inA(tx, ty, b)) continue;
      out.add(idx(tx, ty));
    }
  }
  return [...out];
}
export function beltCost(S, len, lvl) {
  const n = Math.ceil(len), m = thrift(S);
  return lvl === 2 ? { steel: Math.round((25 + 4 * n) * m), engine: 1 } : { plank: Math.round((20 + 4 * n) * m), iron: Math.round((10 + 2 * n) * m) };
}
export function beltsOf(S, bid) { return (S.belts || []).filter(e => e.a === bid || e.b === bid); }
export function beltCheck(S, aid, bid, k) {
  const a = getB(S, aid), b = getB(S, bid), res = { ok: false, reason: '' };
  if (!a || !b || a.id === b.id) { res.reason = '건물이 없어졌어요'; return res; }
  if (a.camp !== b.camp) { res.reason = '동일한 야영지에 있지 않음'; return res; }
  if (S.known < BELT[1].tier) { res.reason = '컨베이어 벨트는 정찰이 "석탄과 철"의 위도에 도달한 후에만 건설할 수 있습니다.'; return res; }
  if (!(bdef(a).out || {})[k] || !(bdef(b).in || {})[k]) { res.reason = '두 건물 사이에는 그러한 물질적 교환이 없습니다.'; return res; }
  if (S.belts.some(e => e.a === aid && e.b === bid && e.k === k)) { res.reason = '이미 연결됨'; return res; }
  if (beltsOf(S, aid).length >= BELT_PER || beltsOf(S, bid).length >= BELT_PER) { res.reason = `건물에는 최대 ${BELT_PER}개의 링크가 있을 수 있습니다.`; return res; }
  const e = beltEnds(a, b);
  res.len = e.len;
  if (e.len > BELT_MAX) { res.reason = `너무 멀리 떨어져 있음(최대 ${BELT_MAX} 간격)`; return res; }
  const w = getWorld(S.runSeed), R = rebuild(S);
  for (const i of beltTiles(a, b)) {
    const x = i % W, y = Math.floor(i / W);
    if (w.terrain[i] !== T_SNOW) { res.reason = '중앙에 바위가 있거나 얼음호수가 있습니다.'; return res; }
    if (R.occ[i]) { res.reason = '가운데를 막고 있는 건물이 있어요'; return res; }
    if (R.beltOcc.has(i)) { res.reason = '다른 컨베이어 벨트와 교차'; return res; }
    if (w.spot[i] >= 0 && spotLeft(S, i) > 0 && !CLEARABLE[SPOT_KEYS[w.spot[i]]]) { res.reason = '중간에 미네랄 포인트가 있어요'; return res; }
    if (landmarkBlock(x, y, S) || siteAt(S, x, y, 1)) { res.reason = '중간에 폐허도 있고'; return res; }
  }
  res.cost = beltCost(S, e.len, 1);
  const c = getCamp(S, a.camp);
  if (!canAfford(c.stock, res.cost)) { res.reason = '부족: ' + missing(c.stock, res.cost).join(','); res.soft = true; return res; }
  res.ok = true;
  return res;
}
export function addBelt(S, aid, bid, k) {
  const ck = beltCheck(S, aid, bid, k);
  if (!ck.ok) return ck;
  const a = getB(S, aid), b = getB(S, bid), camp = getCamp(S, a.camp), w = getWorld(S.runSeed);
  pay(camp.stock, ck.cost);
  // 路上的树、碎石顺手清掉（不会再长回来）
  for (const i of beltTiles(a, b)) {
    if (w.spot[i] < 0 || spotLeft(S, i) <= 0) continue;
    const g = CLEARABLE[SPOT_KEYS[w.spot[i]]]; if (!g) continue;
    S.spots[i] = 0; if (S.sap) delete S.sap[i];
    for (const q in g) camp.stock[q] = (camp.stock[q] || 0) + g[q];
    rt(S).spotsDirty = true;
  }
  S.belts.push({ id: S.nextId++, camp: a.camp, a: aid, b: bid, k, lvl: 1 });
  dirty(S);
  logMsg(S, `"${BLD[a.type].n}"에서 "${BLD[b.type].n}"까지의 컨베이어 벨트가 연결되어 있습니다. ${RES[k].n}가 그곳으로 직접 전송됩니다. 운반꾼을 적게 사용하십시오.`, 'good');
  return { ok: true };
}
export function beltUpBlock(S, e) {
  if (e.lvl >= 2) return '이미 증기 트랙입니다';
  if (S.known < BELT[2].tier) return '정찰이 "강철과 증기"의 위도에 도달한 후에만 업그레이드를 사용할 수 있습니다.';
  const a = getB(S, e.a), b = getB(S, e.b), c = getCamp(S, e.camp), cost = beltCost(S, beltEnds(a, b).len, 2);
  if (!canAfford(c.stock, cost)) return '부족: ' + missing(c.stock, cost).join(',');
  return '';
}
export function upBelt(S, id) {
  const e = (S.belts || []).find(x => x.id === id); if (!e) return { ok: false, reason: '컨베이어벨트가 사라졌다' };
  const why = beltUpBlock(S, e); if (why) return { ok: false, reason: why };
  pay(getCamp(S, e.camp).stock, beltCost(S, beltEnds(getB(S, e.a), getB(S, e.b)).len, 2));
  e.lvl = 2; dirty(S);
  logMsg(S, `컨베이어 벨트가 증기 트랙으로 교체되어 더 빠르고 노동력이 절약됩니다.`, 'good');
  return { ok: true };
}
export function removeBelt(S, id) {
  const e = (S.belts || []).find(x => x.id === id); if (!e) return { ok: false };
  const a = getB(S, e.a), b = getB(S, e.b), c = getCamp(S, e.camp);
  if (a && b && c) { const cost = beltCost(S, beltEnds(a, b).len, 1); for (const k in cost) c.stock[k] = (c.stock[k] || 0) + Math.floor(cost[k] * 0.5); }
  S.belts = S.belts.filter(x => x.id !== id); dirty(S);
  return { ok: true };
}
// 这栋建筑能连到哪：产品送给附近用它的，原料从附近产它的来
export function beltOptions(S, bid) {
  const b = getB(S, bid); if (!b) return [];
  const d = bdef(b), out = [];
  for (const x of S.buildings) {
    if (x.camp !== b.camp || x.id === b.id) continue;
    const dx = bdef(x);
    for (const k in d.out || {}) if ((dx.in || {})[k]) out.push({ a: b.id, b: x.id, k, dir: 'out', other: x });
    for (const k in d.in || {}) if ((dx.out || {})[k]) out.push({ a: x.id, b: b.id, k, dir: 'in', other: x });
  }
  for (const o of out) { o.ck = beltCheck(S, o.a, o.b, o.k); o.len = beltEnds(getB(S, o.a), getB(S, o.b)).len; }
  return out.filter(o => o.len <= BELT_MAX && o.ck.reason !== '이미 연결됨').sort((p, q) => (q.ck.ok ? 1 : 0) - (p.ck.ok ? 1 : 0) || p.len - q.len);
}

// ---------- 天气与袭营（由种子决定的时间表，在线离线一致）----------
export function blizzardSlot(S, k) {
  const a = hash3(k, 11, S.runSeed), b = hash3(k, 23, S.runSeed), c = hash3(k, 37, S.runSeed);
  const start = BLIZ_FIRST + k * BLIZ_P + a * (BLIZ_P - 3600);
  return { k, start, end: start + 1200 + b * 1500, drop: 14 + c * 10 };
}
export function weatherAt(S, t) {
  const k = Math.max(0, Math.floor((t - BLIZ_FIRST) / BLIZ_P));
  const xs = S.journey && S.journey.rh ? stormSlots(S, t) : null;
  const all = [k - 1, k, k + 1].filter(kk => kk >= 0).map(kk => blizzardSlot(S, kk)).concat(xs || []);
  for (const s of all) if (t >= s.start && t < s.end) return { blizzard: true, drop: s.drop, until: s.end, slot: s };
  for (const s of all) if (t >= s.start - BLIZ_WARN && t < s.start) return { blizzard: false, warn: true, inSec: s.start - t, slot: s };
  let nx = blizzardSlot(S, k);
  if (nx.start <= t) nx = blizzardSlot(S, k + 1);
  if (xs) for (const s of xs) if (s.start > t && s.start < nx.start) nx = s;
  return { blizzard: false, next: nx.start - t, slot: nx };
}
// 风暴走廊：待在这一站的时候，按到站时间再排一串暴风雪（和平常的一样长短冷热），合起来是平常的两倍。
// 不和平常的暴风雪、别的天气撞在一起；离开这一站以后还没开始的就不来了
export function stormSlot(S, h, j) {
  const sd = S.runSeed + h.k * 131, a = hash3(j, 13, sd), b = hash3(j, 29, sd), c = hash3(j, 43, sd);
  let start = h.t0 + 1800 + j * BLIZ_P + a * (BLIZ_P - 5400);
  const len = 1200 + b * 1500;
  for (let i = 0; i < 4; i++) {
    let hit = 0;
    const kb = Math.max(0, Math.floor((start - BLIZ_FIRST) / BLIZ_P));
    for (const kk of [kb - 1, kb, kb + 1]) { if (kk < 0) continue; const z = blizzardSlot(S, kk); if (start < z.end + 900 && start + len > z.start - BLIZ_WARN - 900) hit = Math.max(hit, z.end); }
    const kw = Math.max(0, Math.floor((start - WXE_FIRST) / WXE_P));
    for (const kk of [kw - 1, kw, kw + 1]) { if (kk < 0) continue; const z = wxeSlot(S, kk); if (start < z.end + 600 && start + len > z.start - BLIZ_WARN) hit = Math.max(hit, z.end); }
    if (!hit) break;
    start = hit + 1200;
  }
  return { k: `s${h.k}.${j}`, start, end: start + len, drop: 14 + c * 10, x: 1 };
}
function stormSlots(S, t) {
  const out = [];
  for (const h of ruleSpans(S, 'storm')) {
    const j0 = Math.floor((t - h.t0 - 1800) / BLIZ_P);
    for (const j of [j0 - 1, j0, j0 + 1, j0 + 2]) {
      if (j < 0) continue;
      const z = stormSlot(S, h, j);
      if (h.t1 != null && z.start >= h.t1) continue;
      out.push(z);
    }
  }
  return out;
}
// 极光夜、冰雾早晨：只改变画面和气氛，不影响产出。由种子和日子决定，暴风雪时不出现
export function skyAt(S, t) {
  const p = ((t / DAY_LEN) % 1 + 1) % 1, d = Math.floor(t / DAY_LEN);
  const ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const we = wxeAt(S, t), bz = weatherAt(S, t).blizzard || (we.on && we.ev.kind === 'ice'); // 冰风暴时天上也是厚云
  // 第一夜一定有极光，之后大约三夜一次
  const aurDay = d === 0 || hash3(d, 211, S.runSeed) < 0.34 || (S.journey && S.journey.rh && (ruleSpan(S, t) || {}).r === 'night'); // 永夜：夜夜有极光
  const aurora = !bz && aurDay ? ss(0.6, 0.68, p) - ss(0.84, 0.91, p) : 0;
  // 冰雾在天亮前后升起、上午散去；属于第 md 天的早晨
  const md = p >= 0.9 ? d + 1 : d;
  const fogDay = md > 0 && hash3(md, 223, S.runSeed) < 0.3;
  const icefog = !bz && fogDay ? (p >= 0.9 ? ss(0.91, 0.98, p) : 1 - ss(0.2, 0.32, p)) : 0;
  return { aurora: Math.max(0, aurora), icefog: Math.max(0, icefog) };
}
// ---------- 其他天气：冰风暴、极寒夜、冰湖开裂 ----------
// 和暴风雪一样由种子排好时间表（在线离线一致），提前一小时预报；每座营地可以花点材料提前准备
export const WXE = {
  ice: { n: '얼음 폭풍', ic: '🧊', d: '얼어붙는 비는 모든 것을 얼음 층으로 덮었습니다. 용광로와 난방 파이프가 얼어 난방이 제공되지 않았으며 실외 채집은 30% 더 느렸습니다.', prep: '단열 담요로 파이프 감싸기', prepD: '용광로와 난방 파이프는 평소와 같이 계속해서 열을 공급합니다.', cost: { wood: 40, plank: 30 } },
  cold: { n: '매우 추운 밤', ic: '🌡', d: '밤새 온도가 다시 떨어집니다. 용광로는 연료보다 60% 더 많이 연소되어야 합니다. 충분히 타면 방은 몇도 정도 더 추워질 것입니다. 연료가 충분히 연소되지 않으면 더욱 추워집니다.', prep: '문과 창문의 균열을 밀봉하세요.', prepD: '절반으로 냉각', cost: { wood: 50, plank: 10 } },
  crack: { n: '얼음호수 크래킹', ic: '💧', d: '얼음호수에는 도랑이 있으므로 우회만 할 수 있습니다. 야영지 근처에 얼음호수가 있으며 교통 속도가 35% 더 느립니다. 정찰대 및 물류망 도로도 30% 더 느립니다.', prep: '목판 보도 포장', prepD: '야영지의 교통은 평소와 같습니다.', cost: { plank: 60 } },
};
export const WXE_KEYS = Object.keys(WXE);
const WXE_P = 9000, WXE_FIRST = 6000;
export const WXE_WARN = 600, WXE_ICE_GATHER = 0.7, WXE_FUEL = 1.6, WXE_CRACK = 0.65, WXE_SLOW = 0.7;
export function wxeSlot(S, k) {
  const a = hash3(k, 41, S.runSeed), b = hash3(k, 53, S.runSeed), c = hash3(k, 67, S.runSeed);
  const kind = WXE_KEYS[Math.floor(b * 3) % 3];
  let start = WXE_FIRST + k * WXE_P + a * (WXE_P - 3600), len = 900 + c * 600;
  // 极寒夜从天黑开始到天亮；都不和暴风雪撞在一起（撞上了挪到暴风雪过后）
  for (let i = 0; i < 4; i++) {
    if (kind === 'cold') { const st0 = Math.floor(start / DAY_LEN) * DAY_LEN + 0.58 * DAY_LEN; start = st0 >= start ? st0 : st0 + DAY_LEN; len = 0.39 * DAY_LEN; }
    const kb = Math.max(0, Math.floor((start - BLIZ_FIRST) / BLIZ_P));
    let hit = null;
    for (const kk of [kb - 1, kb, kb + 1]) { if (kk < 0) continue; const z = blizzardSlot(S, kk); if (start < z.end + 600 && start + len > z.start - BLIZ_WARN) hit = z; }
    if (!hit) break;
    start = hit.end + 900;
  }
  // 冰湖群：冰湖开裂常见得多（只在这一站待着的时候）
  if (kind !== 'crack' && S.journey && S.journey.rh && (ruleSpan(S, start) || {}).r === 'lakes' && hash3(k, 71, S.runSeed) < 0.6) return { k, kind: 'crack', start, end: start + Math.min(len, 1500) };
  return { k, kind, start, end: start + len };
}
// 眼下或下一场：{ on, ev, left } 或 { on:false, ev, inSec }
export function wxeAt(S, t) {
  const k = Math.max(0, Math.floor((t - WXE_FIRST) / WXE_P));
  let next = null;
  for (const kk of [k - 1, k, k + 1, k + 2]) {
    if (kk < 0) continue;
    const z = wxeSlot(S, kk);
    if (t >= z.start && t < z.end) return { on: true, ev: z, left: z.end - t };
    if (z.start > t && (!next || z.start < next.start)) next = z;
  }
  return { on: false, ev: next, inSec: next ? next.start - t : Infinity };
}
export function wxePrepped(S, camp, ev) { return !!(ev && S.wxPrep && S.wxPrep[ev.k] && S.wxPrep[ev.k][camp.id]); }
export function wxePrepCost(S, camp, ev) { const m = 1 + 0.25 * (tierOfRow(camp.y) - 1), o = {}; for (const k in WXE[ev.kind].cost) o[k] = Math.ceil(WXE[ev.kind].cost[k] * m); return o; }
// 营地附近（供热圈外再 3 格）有没有冰湖：冰湖开裂只影响这些营地
export function campIce(S, camp) {
  const R = rt(S), key = camp.id + ':' + heatRadius(S, camp);
  R.iceNear ||= {};
  if (R.iceNear[camp.id] && R.iceNear[camp.id].key === key) return R.iceNear[camp.id].n;
  const w = getWorld(S.runSeed), r = heatRadius(S, camp) + 3;
  let n = 0;
  for (let y = Math.floor(camp.y - r); y <= camp.y + r; y++) for (let x = Math.floor(camp.x - r); x <= camp.x + r; x++) if (inMap(x, y) && Math.hypot(x + 0.5 - camp.x, y + 0.5 - camp.y) <= r && w.terrain[idx(x, y)] === T_ICE) n++;
  R.iceNear[camp.id] = { key, n };
  return n;
}
// 这场天气对这座营地有没有要准备的（没有暖炉暖气管就不怕冰风暴冻管子，附近没冰湖就不怕开裂）
export function wxeMatters(S, camp, ev) {
  if (!ev) return false;
  if (ev.kind === 'ice') return (camp.pipe || 0) > 0 || S.buildings.some(b => b.camp === camp.id && b.type === 'heater');
  if (ev.kind === 'crack') return campIce(S, camp) > 0;
  return true;
}
export function wxePrep(S, cid) {
  const c = getCamp(S, cid), e = wxeAt(S, S.t), ev = e.ev;
  if (!c || !ev || (!e.on && e.inSec > forecastOf(S))) return { ok: false, reason: '현재로서는 해당 일기예보가 없습니다.' };
  if (wxePrepped(S, c, ev)) return { ok: false, reason: '준비가 된' };
  if (!wxeMatters(S, c, ev)) return { ok: false, reason: '이건 준비할 필요가 없어요 야영지' };
  const cost = wxePrepCost(S, c, ev);
  if (!canAfford(c.stock, cost)) return { ok: false, reason: '자료가 충분하지 않습니다.' };
  for (const k in cost) c.stock[k] -= cost[k];
  S.wxPrep ||= {}; (S.wxPrep[ev.k] ||= {})[c.id] = 1;
  for (const k in S.wxPrep) if (+k < ev.k - 2) delete S.wxPrep[k];
  logMsg(S, `「${c.name}」${WXE[ev.kind].prep}: ${WXE[ev.kind].n}이 와도 두려워하지 마세요, ${WXE[ev.kind].prepD}.`, 'good');
  return { ok: true };
}
export function blizzDrop(S, camp, w) { return w.blizzard ? slotDrop(S, camp, w.slot) : 0; }
export function slotDrop(S, camp, slot) { return (slot.drop + 3 * (tierOfRow(camp.y) - 1)) * diffOf(S).cold * (1 - Math.min(0.8, buffOf(S, camp, 'shield') + relicSum(S, 'shield') + ((focusOf(camp) || {}).cold || 0))); }
// 这一跳熔炉是否超载：手动打开，或暴风雪中自动（炉温到 85% 歇一歇，降到 40% 再开；燃料不够烧 20 分钟就不自动开）
function odActive(S, camp, w, fb) {
  if (camp.odCool > 0) return false;
  if (camp.od) return true;
  if (camp.odAuto === false || !w.blizzard) { camp.odA = 0; return false; }
  const ovh = camp.ovh || 0;
  if (ovh >= 85) camp.odA = 0;
  else if (!camp.odA && ovh <= 40 && fuelUnitsOf(camp.stock) >= furnaceBurn(fb.lvl) * OD_FUEL * 20) camp.odA = 1;
  return !!camp.odA;
}
export function setOverdrive(S, cid, on) {
  const c = getCamp(S, cid); if (!c) return { ok: false };
  if (on && c.odCool > 0) return { ok: false, reason: '퍼니스가 아직 식는 중입니다. 잠시만 기다려주세요.' };
  c.od = on ? 1 : 0;
  if (!on && c.odAuto !== false) c.odA = 0; // 手动关掉后，自动超载也先歇着，等炉温降到 40% 再说
  return { ok: true };
}
export function setOdAuto(S, cid, on) { const c = getCamp(S, cid); if (c) { c.odAuto = !!on; if (!on) c.odA = 0; } }
export function raidSlot(S, k) {
  const a = hash3(k, 101, S.runSeed), b = hash3(k, 103, S.runSeed), c = hash3(k, 107, S.runSeed);
  return { k, t: RAID_FIRST + k * RAID_P + a * (RAID_P - 1200), pick: b, var: c };
}
export const RAID_GROW = 1.4; // 每往北一个纬度带袭击强 40%（箭塔改成每级加固定值后跟着放缓）
export function raidStrength(S, camp, slot) {
  const tier = tierOfRow(camp.y);
  return Math.round(9 * Math.pow(RAID_GROW, tier - 1) * (1 + Math.min(0.6, S.t / 86400 * 0.1)) * Math.min(1, 0.5 + S.t / 172800) * (0.8 + 0.4 * slot.var) * diffOf(S).raid); // 新一轮头一天袭击较弱，给北方起点留出建箭塔的时间
}
export const towerPower = lvl => BLD.tower.power * (1 + 0.3 * (lvl - 1)); // 每级 +30%（按 1 级算）
export function campDefense(S, camp) {
  let d = 4 + Math.min(10, camp.people * 0.15);
  for (const b of S.buildings) {
    if (b.camp !== camp.id || b.type !== 'tower') continue;
    const mx = maxWorkers('tower', b.lvl);
    const staff = mx ? b.workers / mx : 1;
    d += towerPower(b.lvl) * staff * (1 + specOf(S, b) + 0.15 * up(S, 'guard') + ((focusOf(camp) || {}).tower || 0) + campSpecFx(S, b, camp));
  }
  return Math.round(d * (1 + buffOf(S, camp, 'def') + lawSum(S, 'def') + techSum(S, 'def') + relicSum(S, 'def') + ((focusOf(camp) || {}).def || 0)));
}
export function nextRaid(S) {
  const k = Math.max(0, Math.ceil((S.t - RAID_FIRST - RAID_P) / RAID_P));
  let out = null;
  for (let kk = k; kk < k + 3; kk++) {
    const s = raidSlot(S, kk);
    if (s.t > S.t && kk > S.raidDone && s.t >= (S.safeUntil || 0)) {
      const camp = S.camps[Math.floor(s.pick * S.camps.length)];
      out = { ...s, camp: camp.id, in: s.t - S.t };
      break;
    }
  }
  const x = S.journey && S.journey.rh ? wolfNext(S) : null;
  return x && (!out || x.t < out.t) ? x : out;
}
// 狼群领地：待在这一站的时候，按到站时间再排一串冲着主营地来的狼群（每 8 小时一次左右），合起来是平常的一倍半
export function wolfSlot(S, h, j) {
  const sd = S.runSeed + h.k * 137;
  return { k: 1e6 + h.k * 1000 + j, x: 1, hk: h.k, j, t: h.t0 + 3600 + RAID_P * 2 * j + hash3(j, 101, sd) * (RAID_P * 2 - 2400), pick: 0, var: hash3(j, 107, sd) };
}
function wolfNext(S) {
  const J = journeyOf(S), h = ruleSpans(S, 'wolf').find(q => q.t1 == null);
  if (!h || !getCamp(S, J.main)) return null;
  const done = (S.raidX || {})[h.k] ?? -1;
  for (let j = Math.max(done + 1, Math.floor((S.t - h.t0 - 3600) / (RAID_P * 2)) - 1); j < done + 40; j++) {
    if (j <= done) continue;
    const z = wolfSlot(S, h, j);
    if (z.t <= S.t || z.t < (S.safeUntil || 0)) continue;
    return { ...z, camp: J.main, in: z.t - S.t };
  }
  return null;
}
// 袭营的是谁：狼群领地的主营地一定是狼
export function raiderName(S, camp) { return campRule(S, camp) === 'wolf' ? '눈늑대 무리' : RAIDERS[tierOfRow(camp.y)]; }

// ---------- 加成：各项百分比先加在一起再乘一次，每样都有上限（全部拉满大约 ×4）----------
// 吃不饱、太冷、希望低、人手不足照旧打折扣，这些不算加成
// ---------- 1.1 替代配方 ----------
// 换了配方的建筑（b.alt）吃的、产的换成另一套；别的（人手、等级、加成）都一样
const ALT_DEF = {};
for (const t in ALT) ALT_DEF[t] = { ...BLD[t], in: ALT[t].in, out: ALT[t].out, alt: true };
export function bdef(b) { return b.alt && ALT_DEF[b.type] ? ALT_DEF[b.type] : BLD[b.type]; }
export const altDef = type => ALT_DEF[type] || null;
export const ALT_TECH = { alt1: '대체 레시피 1', alt2: '대체 레시피 2' };
export const altTech = type => (BLD[type].t <= 3 ? 'alt1' : 'alt2');
const fmtQ = v => Math.round(v * 10) / 10;
export const recipeTxt = d => Object.keys(d.in || {}).map(k => RES[k].n + fmtQ(d.in[k])).join('+') + '→' + Object.keys(d.out || {}).map(k => RES[k].n + fmtQ(d.out[k])).join('+');
export function altOk(S, type) { return !!ALT[type] && techDone(S, altTech(type)); }
export function setAlt(S, id, on) {
  const b = getB(S, id);
  if (!b || !ALT[b.type]) return { ok: false, reason: '이 건물에는 대체 레시피가 없습니다.' };
  on = !!on;
  if (!!b.alt === on) return { ok: true, same: true };
  if (on && !altOk(S, b.type)) return { ok: false, reason: `첫 번째연구「${ALT_TECH[altTech(b.type)]}」` };
  if (on) b.alt = 1; else delete b.alt;
  b.altT = S.t + ALT_SWITCH; // 换配方要停工一会儿
  dirty(S);
  return { ok: true };
}
// 这一种建筑现在大多用哪套配方（规划器按多数算；一座都没有就按原配方）
export function recipeOf(S, type) {
  let a = 0, n = 0;
  for (const b of S.buildings) if (b.type === type) { n++; if (b.alt) a++; }
  return a * 2 > n && ALT_DEF[type] ? ALT_DEF[type] : BLD[type];
}

// ---------- 1.1 营地特产 ----------
export function campSpecOf(camp) { return camp && camp.spec && CAMP_SPEC[camp.spec] ? CAMP_SPEC[camp.spec] : null; }
export function campSpecFx(S, b, camp) {
  const sp = campSpecOf(camp || getCamp(S, b.camp));
  const c = camp || getCamp(S, b.camp);
  return sp && sp.b.includes(b.type) ? (techDone(S, 'specpro') ? CSPEC_FX2 : CSPEC_FX) * townSpec(c) : 0;
}
// 按暖圈里的矿点定特产：哪种矿比平常多就是哪种（按每种矿的平常密度折算）；一处矿都没有，就看树、碎石、猎物
const SPEC_ALIAS = { dead: 'tree' };
export function pickCampSpec(S, camp, rad) {
  const w = getWorld(S.runSeed), r = rad || 10, cnt = {};
  for (let y = Math.floor(camp.y - r); y <= camp.y + r; y++) for (let x = Math.floor(camp.x - r); x <= camp.x + r; x++) {
    if (!inMap(x, y) || Math.hypot(x + 0.5 - camp.x, y + 0.5 - camp.y) > r) continue;
    let k = SPOT_KEYS[w.spot[idx(x, y)]]; if (!k) continue;
    k = SPEC_ALIAS[k] || k; if (!CAMP_SPEC[k]) continue;
    cnt[k] = (cnt[k] || 0) + 1;
  }
  const rel = k => cnt[k] / (SPOTS[k].dens || 0.02);
  const ores = RICH_KINDS.filter(k => cnt[k]), pool = ores.length ? ores : ['tree', 'rock', 'herd'].filter(k => cnt[k]);
  if (!pool.length) return 'tree';
  return pool.sort((a, b) => rel(b) - rel(a) || RICH_KINDS.indexOf(a) - RICH_KINDS.indexOf(b))[0];
}
// 北境的站按地貌，富矿带按那一种矿，别的营地按矿点
export function specForStop(S, camp, st, rad) { return st && st.rule ? (st.rule === 'rich' ? st.rich : st.rule) : pickCampSpec(S, camp, rad); }

export const PERM_CAP = 2, BONUS_BURST = new Set(['장려하다', '불가사의', '불이 한창이다']);
export const BONUS_CAP = { tech: 0.4, spec: 1, focus: 0.3, star: 0.45, mile: 0.15, ember: 0.6, relic: 0.1, adj: 0.4 };
export const EMBER_PROD = 0.04;
export function prodBonus(S, b, camp, syn, beltB) {
  const R = rt(S);
  if (syn == null) syn = R.adj.get(b.id) || 0;
  if (beltB == null) beltB = (R.b[b.id] || {}).beltB || 0;
  const st = bStar(S, b), stV = Math.min(BONUS_CAP.star, STAR_PROD[st] || 0);
  const mi = Math.min(BONUS_CAP.mile, lineProd(S, b) - (STAR_PROD[st] || 0));
  const parts = [
    ['떠오르는 별', stV],
    ['중요한 단계', mi],
    ['연구', Math.min(BONUS_CAP.tech, techBP(S, b.type))],
    ['전문가', Math.min(BONUS_CAP.spec, specOf(S, b))],
    ['전문화하다', Math.min(BONUS_CAP.focus, focusProd(camp, b.type))],
    ['전문', campSpecFx(S, b, camp)],
    ['숙련된', skillBonus(b)],
    ['인접, 컨베이어 벨트', Math.min(BONUS_CAP.adj, SYN_PER * syn + beltB)],
    ['잔불', Math.min(BONUS_CAP.ember, EMBER_PROD * up(S, 'prod'))],
    ['유물', Math.min(BONUS_CAP.relic, relicSum(S, 'prod'))],
    ['봉화의 여운', techDone(S, 'afterglow') ? 0.03 * towersLit(S) : 0],
    ['헨타이연구', ENDLESS.prod * endlessLvl(S)],
    ['무인 공방', techDone(S, 'autofac') && BLD[b.type].cat === 'make' ? 0.1 + 0.1 * ((R.c[camp.id] || {}).botFr || 0) : 0],
    ['법률 및 명령', lawSum(S, 'prod')],
    ['장려하다', buffOf(S, camp, 'prod')],
    ['불가사의', wonderProd(S, b)],
    ['불이 한창이다', peakProd(S, b)],
    ['도시', townProd(camp)],
  ].filter(p => Math.abs(p[1]) > 1e-9);
  // 1.1 长期加成合起来最多 +200%（×3）；鼓舞、奇观、炉火鼎盛这种爆发的另算在上面
  let perm = 0; for (const p of parts) if (!BONUS_BURST.has(p[0]) && p[1] > 0) perm += p[1];
  if (perm > PERM_CAP) parts.push(['장기 보너스 상량', PERM_CAP - perm]);
  let sum = 0; for (const p of parts) sum += p[1];
  return { sum: Math.max(-0.5, sum), parts };
}

// ---------- 专家 ----------
export function specOf(S, b) {
  for (const sid in S.specAt) if (S.specAt[sid] === b.id) {
    const sp = SPECS.find(s => s.id === sid);
    const m = S.meta.specs[sid];
    if (!sp || !m) continue;
    return specBonus(m.lvl, sp.aff.includes(b.type));
  }
  return 0;
}
export function specIn(S, bid) { for (const sid in S.specAt) if (S.specAt[sid] === bid) return sid; return null; }
export function assignSpec(S, sid, bid) {
  if (!S.meta.specs[sid]) return;
  for (const k in S.specAt) if (S.specAt[k] === bid) delete S.specAt[k];
  if (bid == null) delete S.specAt[sid]; else S.specAt[sid] = bid;
}
export function trainSpec(S, sid) {
  const m = S.meta.specs[sid]; if (!m) return { ok: false };
  if (m.lvl >= SPEC_MAX) return { ok: false, reason: '이미 정상까지 연습했어' };
  const camp = getCamp(S, S.active) || S.camps[0];
  const cost = specTrainCost(m.lvl);
  for (const k in cost) if (RES[k].t > S.known) return { ok: false, reason: `"${RES[k].n}" 필요` };
  if (!canAfford(camp.stock, cost)) return { ok: false, reason: '부족: ' + missing(camp.stock, cost).join(',') };
  pay(camp.stock, cost); m.lvl++;
  return { ok: true };
}

// ---------- 研究 ----------
export function techDone(S, id) { return !!(S.tech && S.tech.done[id]); }
export function techSum(S, k) { let v = 0; if (S.tech) for (const t of TECHS) if (S.tech.done[t.id] && t.fx[k]) v += t.fx[k]; return v; }
function techBP(S, type) { let v = 0; if (S.tech) for (const t of TECHS) if (S.tech.done[t.id] && t.fx.bp && t.fx.bp[type]) v += t.fx.bp[type]; return v; }
function techState(S) { return S.tech || (S.tech = { done: {}, cur: null, prog: 0 }); }
// 无尽研究：五条分支都研究完以后开放，一级一级往上，每级所有生产 +2%
export const endlessLvl = S => (S.tech && S.tech.endless) || 0;
export const allTechDone = S => !!S.tech && TECHS.every(t => S.tech.done[t.id]);
export function endlessDef(S) {
  const L = endlessLvl(S), m = Math.pow(ENDLESS.mul, L), cost = {};
  for (const k in ENDLESS.cost) cost[k] = Math.round(ENDLESS.cost[k] * m);
  return { id: 'endless', br: -1, n: `Endless연구 · 레벨 ${L + 1}`, ic: '♾️', t: 0, pts: Math.round(ENDLESS.pts * m), cost, d: `모든 생산 +${Math.round(ENDLESS.prod * 100)}% (현재 +${Math.round(L * ENDLESS.prod * 100)}%)`, fx: {} };
}
export const techDef = (S, id) => (id === 'endless' ? endlessDef(S) : TECHS.find(x => x.id === id));
// 分支开没开：自动化要侦察到遗迹金属纬度，北境要走到北境
export function techGateWhy(S, br) {
  const g = TECH_GATE[br]; if (!g) return '';
  if (g.known && S.known < g.known) return g.why;
  if (g.north && journeyOf(S).stage <= SPINE) return g.why;
  return '';
}
// ---------- 1.1 自动机 ----------
export const botPow = S => (techDone(S, 'botcal') ? BOT.powCal : BOT.pow);
export const bayCap = (S, b) => (techDone(S, 'botbay') ? BOT.bayPro : BOT.bay) * b.lvl;
export const botModelOk = (S, m) => !!BOT_MODELS[m] && (!BOT_MODELS[m].tech || techDone(S, BOT_MODELS[m].tech));
export const botModel = (S, b) => (botModelOk(S, b.model || 'labor') ? b.model || 'labor' : 'labor');
// 营地里各型自动机有几台（按自动机仓算）
export function campBots(S, camp, bs) {
  let n = 0, h = 0, m = 0;
  for (const b of bs || S.buildings.filter(x => x.camp === camp.id)) if (b.type === 'bay') { const k = b.bots || 0, md = botModel(S, b); n += k; if (md === 'haul') h += k; else if (md === 'mine') m += k; }
  camp.bots = n; camp.botH = h; camp.botM = m;
  return { n, h, m, l: n - h - m };
}
// 能派到岗位上的人手（劳工型、采掘型折成人头；搬运型不占岗位）
export function botUnits(S, camp) { return Math.floor(((camp.bots || 0) - (camp.botH || 0)) * botPow(S)); }
export function setBayModel(S, bid, m) {
  const b = getB(S, bid); if (!b || b.type !== 'bay') return { ok: false, reason: '' };
  if (!botModelOk(S, m)) return { ok: false, reason: `첫 번째연구「${TECHS.find(t => t.id === BOT_MODELS[m].tech).n}」` };
  if ((b.model || 'labor') === m) return { ok: false, reason: '' };
  b.model = m; const camp = getCamp(S, b.camp); campBots(S, camp); trimWorkers(S, camp); dirty(S);
  if (b.bots) logMsg(S, `"${camp.name}"의 오토마톤 격납고가 ${BOT_MODELS[m].n}로 변형되었습니다. ${b.bots}의 오토마톤이 장비를 변경했습니다.`, 'info');
  return { ok: true };
}
// 核心回收：拆掉自动机退回核心（两台一个）
export function scrapBots(S, bid, n) {
  const b = getB(S, bid); if (!b || b.type !== 'bay') return { ok: false, reason: '' };
  if (!techDone(S, 'corerec')) return { ok: false, reason: '첫 번째 연구 "코어 회수"' };
  n = Math.min(b.bots || 0, Math.floor(n / 2) * 2); if (n < 2) return { ok: false, reason: '창고에 오토마톤이 없습니다' };
  const camp = getCamp(S, b.camp); b.bots -= n; b.want = b.bots; camp.stock.core = (camp.stock.core || 0) + n / 2;
  campBots(S, camp); trimWorkers(S, camp); dirty(S);
  return { ok: true, n, cores: n / 2 };
}

export function bayRefill(S, bid) { const b = getB(S, bid); if (!b || b.type !== 'bay') return; delete b.want; dirty(S); }

// ---------- 1.1 熔炉号令 ----------
export const cmdOk = (S, id) => techDone(S, CMDS[id].tech);
const cmdOf = (S, id) => (S.cmd || {})[id];
export function cmdOn(S, id, camp) { const c = cmdOf(S, id); return !!c && c.until > S.t && (CMDS[id].net || !camp || c.camp === camp.id); }
export const cmdLeft = (S, id) => { const c = cmdOf(S, id); return c ? Math.max(0, c.until - S.t) : 0; };
export const cmdCd = (S, id) => { const c = cmdOf(S, id); return c ? Math.max(0, c.ready - S.t) : 0; };
export function cmdFuel(S, camp) { return (cmdOn(S, 'blaze', camp) ? 3 : 1) * (cmdOn(S, 'shelter', camp) ? 0.5 : 1); }
export function cmdCheck(S, id) {
  const d = CMDS[id]; if (!d) return { ok: false, reason: '' };
  if (!cmdOk(S, id)) return { ok: false, lock: true, reason: `첫 번째연구「${TECHS.find(t => t.id === d.tech).n}」` };
  if (rt(S).offline) return { ok: false, reason: '오프라인에서는 명령이 실행되지 않습니다.' };
  if (cmdLeft(S, id) > 0) return { ok: false, on: true, reason: '명령이 발효 중입니다.' };
  const cd = cmdCd(S, id); if (cd > 0) return { ok: false, cd, reason: `다시 보내려면 ${Math.ceil(cd / 60)}분이 더 걸립니다.` };
  return { ok: true };
}
export function fireCmd(S, id, cid) {
  const ck = cmdCheck(S, id); if (!ck.ok) return ck;
  const d = CMDS[id], camp = getCamp(S, cid) || mainCamp(S);
  (S.cmd || (S.cmd = {}))[id] = { camp: camp.id, until: S.t + d.len, ready: S.t + d.cd };
  if (id === 'unity') camp.disc = 0;
  logMsg(S, `📯「${camp.name}」 경적을 울립니다: ${d.n}! ${d.d}(${d.len >= 120 ? d.len / 60 + '분' : d.len + '두번째'}).`, 'good');
  rt(S).fx.push({ kind: 'cmd', id, camp: camp.id });
  dirty(S);
  return { ok: true };
}

// 能不能开始研究：已完成 / 正在研究 / 分支没开 / 缺前置 / 没侦察到 / 缺材料
export function techCheck(S, id) {
  const t = techDef(S, id), T = techState(S);
  if (!t) return { ok: false, reason: '' };
  if (id === 'endless' ? !allTechDone(S) : T.done[id]) return id === 'endless' ? { ok: false, lock: true, reason: '연구 완료 후 5개 지점 모두 오픈 예정' } : { ok: false, done: true, reason: '완전한' };
  if (T.cur === id) return { ok: false, cur: true, reason: '연구중' };
  const gw = t.br >= 0 ? techGateWhy(S, t.br) : ''; if (gw) return { ok: false, lock: true, gate: true, reason: gw };
  const miss = (t.req || []).filter(r => !T.done[r]);
  if (miss.length) return { ok: false, lock: true, reason: '퍼스트연구」' + miss.map(r => TECHS.find(x => x.id === r).n).join('""') + '"' };
  if (t.t > S.known) return { ok: false, lock: true, reason: `정찰은 "${['', '모닥불', '석탄과 철', '강철과 증기', '석유와 철도', '서리수정', '유적 금속', '노심'][t.t]}" 위도에 도달한 후에만 연구가 될 수 있습니다.` };
  if (T.cur) return { ok: false, busy: true, reason: `현재 연구「${techDef(S, T.cur).n}」` };
  const camp = getCamp(S, S.active) || S.camps[0];
  if (!canAfford(camp.stock, t.cost)) return { ok: false, soft: true, reason: '부족: ' + missing(camp.stock, t.cost).join(',') };
  return { ok: true };
}
export function startTech(S, id) {
  const ck = techCheck(S, id); if (!ck.ok) return ck;
  const t = techDef(S, id), T = techState(S), camp = getCamp(S, S.active) || S.camps[0];
  pay(camp.stock, t.cost); T.cur = id; T.prog = 0; T.paidBy = camp.id; T.paid = t.cost;
  logMsg(S, `공학 작업장은 연구 "${t.n}"을(를) 시작합니다.`);
  return { ok: true };
}
export function cancelTech(S) {
  const T = techState(S); if (!T.cur) return;
  const t = techDef(S, T.cur), camp = getCamp(S, T.paidBy) || S.camps[0], cost = T.paid || t.cost;
  for (const k in cost) camp.stock[k] = (camp.stock[k] || 0) + cost[k];
  logMsg(S, `연구 "${t.n}"을(를) 중지하고 자료가 "${camp.name}"을(를) 반환했습니다.`);
  T.cur = null; T.prog = 0; delete T.paid;
}
// 研究点数：各营地工程站每分钟的贡献加起来
function researchStep(S, dt) {
  const R = rt(S), T = techState(S);
  let rate = 0;
  for (const c of S.camps) rate += (R.c[c.id] || {}).rp || 0;
  rate *= (1 + gBuff(S, 'res')) * wonderRes(S);
  R.rpRate = rate;
  if (T.cur && T.bank > 0) { T.prog += T.bank; T.bank = 0; } // 探险带回的图纸直接抵研究点数
  if (!T.cur || rate <= 0) { if (T.cur) researchDone(S, T, R); return; }
  T.prog += rate / 60 * dt;
  researchDone(S, T, R);
}
function researchDone(S, T, R) {
  const t = T.cur && techDef(S, T.cur);
  if (t && T.prog >= t.pts) {
    T.bank = (T.bank || 0) + (T.prog - t.pts); // 多出来的点数留给下一项
    if (t.id === 'endless') T.endless = endlessLvl(S) + 1; else T.done[t.id] = true;
    T.cur = null; T.prog = 0; delete T.paid;
    logMsg(S, t.id === 'endless' ? `끝없는 연구가 ${T.endless} 레벨로 업그레이드되었습니다: 모든 생산에 대해 +${Math.round(T.endless * ENDLESS.prod * 100)}%.` : `연구는 "${t.n}": ${t.d}을(를) 완료했습니다.`, 'good');
    if (t.id !== 'endless' && allTechDone(S)) logMsg(S, '연구 5개 지점이 모두 완성되었습니다! 공학 작업장이 "Endless 연구"를 열었습니다. 모든 생산은 각 레벨에서 +2%, 상한선은 없습니다.', 'story', { act: 'tb', arg: 'research', label: '가 보기' });
    R.fx.push({ kind: 'tech', id: t.id });
    dirty(S);
  }
}

// ---------- 人心：希望与不满；营地律令 ----------
const clamp100 = v => Math.max(0, Math.min(100, v));
export function lawOn(S, id) { return !!(S.laws && S.laws[id]); }
export function lawSum(S, k) { let v = 0; if (S.laws) for (const l of LAWS) if (S.laws[l.id] && l[k]) v += l[k]; return v; }
export function lawWait(S, id) { const t = S.lawT && S.lawT[id]; return t != null ? Math.max(0, t + LAW_CD - S.t) : 0; }
export function bumpMood(c, dh, dd) { c.hope = clamp100((c.hope ?? 50) + dh); c.disc = clamp100((c.disc ?? 10) + dd); }
export function toggleLaw(S, id) {
  const l = LAWS.find(x => x.id === id); if (!l) return { ok: false };
  const wait = lawWait(S, id); if (wait > 0) return { ok: false, reason: `"${l.n}"이(가) 방금 수정되었으며 ${Math.ceil(wait / 60)}분 동안 다시 수정되지 않습니다.` };
  S.laws = S.laws || {}; S.lawT = S.lawT || {};
  const on = !S.laws[id];
  if (on) S.laws[id] = true; else { delete S.laws[id]; for (const c of S.camps) bumpMood(c, 0, 4); }
  S.lawT[id] = S.t;
  logMsg(S, on ? `"${l.n}" 법령에 서명했습니다.` : `"${l.n}" 주문이 취소되었습니다. 어떤 사람들은 순서가 하룻밤 사이에 바뀌었을 때 기분이 좋지 않았습니다.`, on ? 'info' : 'warn');
  return { ok: true, on };
}
// 希望和不满会慢慢走向一个「目标值」；目标值由住处、冷暖、吃饭、病人、律令等决定
export function moodFactors(S, camp, cr) {
  const ppl = Math.max(1, camp.people), u = Math.max(0, camp.people - (cr.housed ?? camp.people)) / ppl;
  const tH = cr.tH ?? 10, hung = cr.hunger || 0, sk = Math.max(0, (cr.sick || 0) - 0.5 * (cr.treated || 0)) / ppl, fueled = cr.fueled ?? 1; // 住进医务所的病人，大家没那么揪心
  const hope = [], disc = [];
  hope.push(['거주', u > 0 ? -30 * u : 8]);
  hope.push(['차갑고 따뜻하다', tH >= 10 ? 8 : tH >= 0 ? 0.8 * tH : Math.max(-20, 1.5 * tH)]);
  hope.push(['식사하세요', hung > 0.01 ? -25 * Math.min(1, hung * 2) : (cr.foodNet ?? 0) >= 0 ? 6 : -4]);
  if (sk > 0) hope.push(['환자', -40 * sk]);
  if (fueled < 0.99) hope.push(['용광로 엔진 정지', -15 * (1 - fueled)]);
  const fl = S.founded.length - 1; if (fl > 0) hope.push(['북쪽 방향 진행', 2 * fl]);
  { const D = diffOf(S); if (D.hope) hope.push([`난이도: ${D.n}`, D.hope]); }
  { const dh = decoHope(S, camp); if (dh.raw > 0) hope.push(['장식', dh.v]); }
  if (campRule(S, camp) === 'night') hope.push(['영야오로라', RULE_FX.nightHope]);
  if (towerLitAt(S, camp)) hope.push(['봉화탑 라이트', TOWER_FX.hope]);
  if (wonderHope(S)) hope.push(['오로라 탑', wonderHope(S)]);
  if (townHope(camp)) hope.push(['마을에 살았다', townHope(camp)]);
  { const F = focusOf(camp); if (F && F.hope) hope.push([`${F.n}야영지`, F.hope]); if (F && F.disc) disc.push([`${F.n}야영지`, F.disc]); }
  const glow = (camp.buffs || []).some(b => b.n === '축하잔열' && b.until > S.t);
  if (camp.fest) { hope.push(['모닥불 축하', 18]); disc.push(['모닥불 축하', -10]); }
  else if (glow) { hope.push(['축하잔열', 10]); disc.push(['축하잔열', -6]); }
  else if (buffOf(S, camp, 'prod') > 0) hope.push(['모닥불은', 8]);
  if (u > 0) disc.push(['침대 없음', 25 * u]);
  if (hung > 0.01) disc.push(['굶어 죽다', 30 * Math.min(1, hung * 2)]);
  if (tH < 0) disc.push(['너무 추워요', Math.min(20, -tH * 1.2)]);
  if (sk > 0) disc.push(['환자', 20 * sk]);
  if (S.laws) for (const l of LAWS) if (S.laws[l.id]) { if (l.hope) hope.push([l.n, l.hope]); if (l.disc) disc.push([l.n, l.disc]); }
  if (S.tech) for (const t of TECHS) if (S.tech.done[t.id] && t.fx.hope) hope.push([t.n, t.fx.hope]);
  const r = a => a.map(([n, v]) => [n, Math.round(v * 10) / 10]).filter(x => x[1]);
  const H = r(hope), D = r(disc);
  return { hope: H, disc: D, hT: clamp100(50 + H.reduce((a, x) => a + x[1], 0)), dT: clamp100(10 + D.reduce((a, x) => a + x[1], 0)) };
}
// 希望 50 时不加不减，100 时 +6%、0 时 −6%；不满超过 60 开始拖慢，100 时 −10%
export function moodMul(camp) {
  const h = camp.hope ?? 50, d = camp.disc ?? 10;
  return (1 + (h - 50) / 833) * (d > 60 ? 1 - (d - 60) / 400 : 1);
}
export const LEAVE_AT = 85, LEAVE_MIN = 12; // 不满到 85 开始有人离开；营地少于 12 人时没人走
const MOOD_RATE = 4; // 每分钟最多变化几点
function moodStep(S, camp, cr, dt) {
  if (camp.hope == null) { camp.hope = 50; camp.disc = 10; }
  const m = moodFactors(S, camp, cr), k = MOOD_RATE * dt / 60;
  camp.hope = clamp100(camp.hope + Math.max(-k, Math.min(k, m.hT - camp.hope)));
  camp.disc = clamp100(camp.disc + Math.max(-k, Math.min(k, m.dT - camp.disc)));
  if (cmdOn(S, 'unity', camp)) camp.disc = 0; // 万众一心：号令期间不满不涨
  cr.mood = m;
  // 不满太高：有人趁夜离开（永不全灭）
  if (camp.disc >= LEAVE_AT && camp.people > LEAVE_MIN) {
    camp.leaveAcc = (camp.leaveAcc || 0) + camp.people * 0.003 * (camp.disc - LEAVE_AT) / (100 - LEAVE_AT) / 60 * dt;
    while (camp.leaveAcc >= 1) {
      camp.leaveAcc -= 1;
      if (camp.people <= LEAVE_MIN) { camp.leaveAcc = 0; break; }
      camp.people--; S.stats.left = (S.stats.left || 0) + 1; trimWorkers(S, camp);
      logMsg(S, `「${camp.name}」누군가 야영지에 대한 신뢰를 잃고 밤에 떠났습니다.`, 'bad');
    }
  } else camp.leaveAcc = 0;
  if (camp.disc >= 70 && !camp.discWarn) { camp.discWarn = true; logMsg(S, `"${camp.name}"의 불만이 확산되고 있습니다(${Math.round(camp.disc)}). 85세가 넘으면 누군가는 떠날 것입니다. 보기의 모든 사람이 불만을 "야영지 → 민심"로 만드는 이유.`, 'warn'); }
  if (camp.disc < 60) camp.discWarn = false;
  if (camp.hope <= 20 && !camp.hopeWarn) { camp.hopeWarn = true; logMsg(S, `이름이 "${camp.name}"인 사람은 희망이 거의 없으며(희망 ${Math.round(camp.hope)}) 그의 작업은 점점 지루해지고 있습니다.`, 'warn'); }
  if (camp.hope > 30) camp.hopeWarn = false;
}

// ---------- 1.1 熟练工：每座建筑自己攒经验，满员干 10/20/40/80/160 分钟升一级，每级产量 +6% ----------
export const SKILL_CUM = [10, 30, 70, 150, 310], SKILL_PER = 0.06, SKILL_MAX = 5, SKILL_GRACE = 60;
export const skillable = b => b.type !== 'furnace' && !!(BLD[b.type].out || b.type === 'workshop');
export function skillLvl(b) { const x = (b && b.xp) || 0; let l = 0; while (l < SKILL_MAX && x >= SKILL_CUM[l] - 1e-9) l++; return l; }
export const skillBonus = b => SKILL_PER * skillLvl(b);
// 下一级还要满员干多少分钟（学徒制快一半）
export function skillNext(S, b) { const l = skillLvl(b); return l >= SKILL_MAX ? null : { lvl: l + 1, min: (SKILL_CUM[l] - (b.xp || 0)) / (techDone(S, 'apprentice') ? 1.5 : 1) }; }
function skillStep(S, camp, bs, dt) {
  const R = rt(S), offK = R.offline && R.histOff ? R.histOff.rate : 1, appr = techDone(S, 'apprentice');
  const scouting = S.scouts.some(x => x.camp === camp.id);
  for (const b of bs) {
    if (!skillable(b)) continue;
    const mx = bMax(S, b), w = b.workers || 0, ref = Math.min(b.wRef || 0, mx); // 二星省下的那个岗位不算「被撤走」
    // 撤了人：一分钟内补回来不算；侦察队带走的人等他们回来再说；过了一分钟还缺，按少了的比例掉（学徒制只掉一半）
    if (w >= ref) { b.wRef = w; delete b.wDrop; }
    else if (!scouting) {
      if (b.wDrop == null) b.wDrop = S.t;
      else if (S.t - b.wDrop >= SKILL_GRACE) { const f = ref ? w / ref : 1; b.xp = (b.xp || 0) * (appr ? 1 - (1 - f) / 2 : f); b.wRef = w; delete b.wDrop; }
    }
    if (!mx || !w || b.moveT > S.t) continue;
    const l0 = skillLvl(b); if (l0 >= SKILL_MAX) continue;
    b.xp = Math.min(SKILL_CUM[SKILL_MAX - 1], (b.xp || 0) + Math.min(1, w / mx) * dt / 60 * (appr ? 1.5 : 1) * offK);
    const l1 = skillLvl(b);
    if (l1 > l0 && !R.offline) R.fx.push({ kind: 'skill', b: b.id, lvl: l1 });
  }
}

// ---------- 1.1 寒潮季：第三章起每 5 天来一次，一整天：熔炉烧双倍燃料、户外采集减半、气温再降 10° ----------
export const COLD = { every: 5 * DAY_LEN, len: DAY_LEN, first: 2 * DAY_LEN, from: 2, fuel: 2, fuelCast: 1.7, gather: 0.5, gatherSuit: 0.7, drop: 10, hope: 5, embers: 5 };
export const coldLead = S => DAY_LEN * (techDone(S, 'coldcast') ? 2 : 1);
export const coldFuel = S => (techDone(S, 'coldcast') ? COLD.fuelCast : COLD.fuel);
export const coldGather = S => (techDone(S, 'thermal') ? COLD.gatherSuit : COLD.gather);
// 眼下或下一次寒潮：on 正在寒潮里；fc 已经报出来了
export function coldAt(S, t = S.t) {
  const C = S.cold; if (!C || C.t0 == null) return null;
  const base = C.t0 + COLD.first;
  let k = Math.max(0, Math.floor((t - base) / COLD.every)), start = base + k * COLD.every;
  if (t >= start && t < start + COLD.len) return { on: true, k, start, end: start + COLD.len, left: start + COLD.len - t };
  if (t >= start + COLD.len) { k++; start += COLD.every; }
  return { on: false, k, start, end: start + COLD.len, inSec: start - t, fc: start - t <= coldLead(S) };
}
export const coldNow = S => { const c = coldAt(S); return !!(c && c.on); };
// 这一次寒潮和暴风雪撞上没有
export function coldBliz(S, c) { for (let t = c.start; t < c.end; t += 60) if (weatherAt(S, t).blizzard) return true; return false; }
function coldStep(S) {
  if (!S.cold && journeyOf(S).stage >= COLD.from) S.cold = { t0: S.t };
  const c = coldAt(S); if (!c) return;
  const C = S.cold;
  if (c.on && C.on !== c.k) {
    C.on = c.k; C.hit = {}; S.stats.cold = (S.stats.cold || 0) + 1;
    logMsg(S, `🌨한파가 왔습니다! 용광로는 하루 종일 연료의 ${coldFuel(S)}배를 태웠고 실외 채집은 ${Math.round(coldGather(S) * 100)}%만 남았으며 온도는 ${COLD.drop}° 더 떨어졌습니다. 동상, 희망 및 잔불은 모두 보상을 통과하지 못했습니다.`, 'bad', { act: 'wx', label: '보기' });
  } else if (!c.on && c.fc && C.fc !== c.k) {
    C.fc = c.k;
    logMsg(S, `🌨 한파 예보: 한파는 약 ${Math.max(1, Math.round(c.inSec / 60))}분 후에 발생하고 하루 종일 지속됩니다(${DAY_LEN / 60}분). 용광로는 연료를 ${coldFuel(S)}번 태우고 실외 채집은 반으로 줄고 온도는 ${COLD.drop}° 더 떨어집니다. 물류망은 먼저 각 야영지에 대해 충분한 연료를 준비합니다. ${coldBliz(S, c) ? '이번에도 눈보라와 충돌했으니 연료, 요리를 준비하세요.' : ''}`, 'warn', { act: 'wx', label: '보기' });
  }
  // 寒潮过去：没人冻伤的营地希望 +5；全都挺住了再给余烬
  if (!c.on && C.on != null && C.on === c.k - 1 && C.done !== C.on) {
    C.done = C.on;
    const live = S.camps.filter(x => x.people > 0), hit = live.filter(x => (C.hit || {})[x.id]), ok = live.filter(x => !(C.hit || {})[x.id]);
    for (const x of ok) bumpMood(x, COLD.hope, 0);
    if (!hit.length) { S.meta.embers += COLD.embers; S.meta.emberTotal = (S.meta.emberTotal || 0) + COLD.embers; S.stats.coldOk = (S.stats.coldOk || 0) + 1; }
    logMsg(S, !hit.length ? `🌨 한파가 지나갔고 동상이 아무도 없었습니다. 각 야영지희망 +${COLD.hope}, 잔불 +${COLD.embers}.` : `🌨 한파 합격했습니다.${hit.map(x => `「${x.name}」`).join('')}누군가 동상${ok.length ? `;다른 야영지는 희망 +${COLD.hope}` : ''}. 다음에는 연료를 일찍 준비하고 천막업그레이드를 따뜻하게 유지하세요.`, hit.length ? 'warn' : 'good');
  }
}

// ---------- 主循环 ----------
export function step(S, dt) {
  const R = rebuild(S);
  if (!S.sap) { // 旧存档：已经砍光的树林、打光的猎场先当树苗/幼崽，从头长
    S.sap = {};
    const w = getWorld(S.runSeed);
    for (const k in S.spots) if (S.spots[k] <= 0 && REGROW[SPOT_KEYS[w.spot[k]]]) S.sap[k] = 1;
  }
  const w = weatherAt(S, S.t);
  // 记在存档里：刷新页面不会重复播报、重复计数
  const wx = S.wx || (S.wx = { last: R.lastBliz ?? -1, warn: -1, fc: -1 });
  if (w.blizzard && wx.last !== w.slot.k) { wx.last = w.slot.k; S.stats.blizzards++; logMsg(S, `눈보라가 왔습니다! 기온이 급격하게 떨어지고 밖에 있는 사람들은 동상 할 것이다. ${S.camps.some(c => c.odAuto !== false) ? '용광로는 한파를 견딜 수 있도록 자동으로 과부하되었습니다.' : ''}`, 'bad'); }
  if (w.warn && wx.warn !== w.slot.k) { wx.warn = w.slot.k; logMsg(S, `눈보라는 연료 및 요리가 가득 채워진 상태로 ${Math.ceil(w.inSec / 60)}분 안에 도착합니다.`, 'warn', { act: 'wx', label: '전쟁을 준비하세요' }); }
  if (!w.blizzard && !w.warn && w.next <= forecastOf(S) && wx.fc !== w.slot.k) {
    wx.fc = w.slot.k;
    const c = getCamp(S, S.active) || S.camps[0];
    logMsg(S, `❄ 기상 예측: 약 ${Math.round(w.next / 60)}분 후에 눈보라가 발생하고 약 ${Math.round((w.slot.end - w.slot.start) / 60)}분 동안 지속되며 "${c.name}"의 온도는 ${Math.round(slotDrop(S, c, w.slot))}° 낮아집니다. 보기연료 및 요리를 견딜 수 있습니까?`, 'warn', { act: 'wx', label: '전쟁을 준비하세요' });
  }
  // 其他天气：预报、临近提醒、开始、结束
  const we = w.ev = wxeAt(S, S.t);
  if (we.ev) {
    const E = WXE[we.ev.kind], k = we.ev.k, c0 = getCamp(S, S.active) || S.camps[0];
    if (we.on && wx.es !== k) {
      wx.es = k; wx.ef = wx.ew = k;
      S.stats.wxe ||= {}; S.stats.wxe[we.ev.kind] = (S.stats.wxe[we.ev.kind] || 0) + 1;
      logMsg(S, `${E.ic} ${E.n}이(가) 왔습니다! ${E.d}`, 'bad', { act: 'wx', label: '보기' });
    } else if (!we.on && we.inSec <= WXE_WARN && wx.ew !== k) {
      wx.ew = k; wx.ef = k;
      const need = S.camps.filter(c => wxeMatters(S, c, we.ev) && !wxePrepped(S, c, we.ev));
      logMsg(S, `${E.ic} ${E.n}게다가${Math.ceil(we.inSec / 60)}단 몇 분 거리에 있습니다.${need.length ? `야영지 아직 준비되지 않음:${need.map(c => `「${c.name}」`).join('')}。` : ''}`, 'warn', { act: 'wx', label: '준비하다' });
    } else if (!we.on && we.inSec <= forecastOf(S) && wx.ef !== k) {
      wx.ef = k;
      logMsg(S, `${E.ic}기상 예측: 약.${Math.round(we.inSec / 60)}몇 분 안에 하나 있을 거예요${E.n}, 약 지속됩니다.${Math.round((we.ev.end - we.ev.start) / 60)}분.${wxeMatters(S, c0, we.ev) ? `미리 만들어 놓을 수 있어요${E.prep}」。` : ''}`, 'warn', { act: 'wx', label: '보기' });
    }
  }
  if (wx.es != null && wx.ee !== wx.es && !(we.on && we.ev.k === wx.es)) {
    wx.ee = wx.es;
    const z = wxeSlot(S, wx.es);
    if (S.t >= z.end && S.t - z.end < 600) logMsg(S, `${WXE[z.kind].ic} ${WXE[z.kind].n}이(가) 통과되었습니다.`, 'good');
  }
  regrow(S, dt);
  oreStep(S, dt);
  ruleStep(S, dt, w);
  coldStep(S);
  for (const camp of S.camps) campStep(S, camp, dt, w);
  rateStep(S, dt);
  holdStep(S, dt);
  researchStep(S, dt);
  netStep(S, dt);
  scoutsStep(S, dt);
  raidsStep(S, dt);
  journeyStep(S, dt);
  R.chapT = (R.chapT || 0) + dt; if (R.chapT >= 1) { const cdt = R.chapT; R.chapT = 0; chapterStep(S); linesTick(S, cdt); farStep(S); gangsStep(S); }
  R.qT = (R.qT || 0) + dt; if (R.qT >= 2) { R.qT = 0; queueStep(S); caravanStep(S); guildStep(S); forkStep(S); qyStep(S); townStep(S); seasonStep(S); }
  R.bookT = (R.bookT || 0) + dt; if (R.bookT >= 3) { R.bookT = 0; bookTick(S); }
  S.t += dt;
  histStep(S, dt);
}

// ---------- 北境地貌：按时间表发生的事（由到站时间和种子排好，在线离线一致） ----------
export const MET_GAP = 2700; // 陨石雨：大约 45 分钟落一颗，一半砸中房子
export function metSlot(S, h, j) { const sd = S.runSeed + h.k * 149; return { j, t: h.t0 + 1500 + j * MET_GAP + hash3(j, 3, sd) * 1200, pick: hash3(j, 5, sd), a: hash3(j, 9, sd), hit: hash3(j, 7, sd) < 0.5 }; }
function ruleStep(S, dt, w) {
  const J = journeyOf(S), r = ruleNow(S);
  if (!r) return;
  const main = getCamp(S, J.main); if (!main) return;
  const ns = nsOf(S);
  // 暴风雪：一场过去、这一场里主营地没有新的人冻病，算挺过一场
  if (w.blizzard) {
    const sk = Math.floor(main.sick || 0);
    if (!ns.bz || ns.bz.k !== w.slot.k) ns.bz = { k: w.slot.k, s0: sk, bad: 0 };
    if (sk > ns.bz.s0) ns.bz.bad = 1;
  } else if (ns.bz) { ns.bliz = (ns.bliz || 0) + 1; if (!ns.bz.bad) { ns.blizOk = (ns.blizOk || 0) + 1; if (r === 'storm' && ns.blizOk >= 4) flag13(S, 'storm4'); } ns.bz = null; }
  if (r === 'night') { const hp = main.hope ?? 50; ns.hh = hp >= 70 ? Math.min(600, (ns.hh || 0) + dt) : Math.max(0, (ns.hh || 0) - dt / 2); }
  if (r === 'rich' && !ns.shrunk && !richGrace(S)) { ns.shrunk = 1; dirty(S); logMsg(S, `💎 부광대의 처음 이틀이 지났고 용광로는 여기서 추위를 억제할 수 없습니다. "${main.name}" 난방권이 ${-RULE_FX.richWarm}만큼 줄어들었습니다.`, 'warn'); }
  if (r === 'meteor') {
    const h = ruleSpans(S, 'meteor').find(q => q.t1 == null);
    for (let n = 0; h && n < 20; n++) {
      const z = metSlot(S, h, (ns.metJ ?? -1) + 1);
      if (z.t > S.t + dt) break;
      ns.metJ = z.j;
      meteorFall(S, main, z, ns);
    }
  }
}
// 流星落下：一半砸中一栋在干活的房子（停工修一会，修好如初、不会塌），一半落在营地边上
function meteorFall(S, camp, z, ns) {
  const bs = z.hit ? S.buildings.filter(b => b.camp === camp.id && BLD[b.type].out && !(b.hitT > S.t)) : [];
  if (bs.length) {
    const b = bs[Math.floor(z.pick * bs.length) % bs.length], h = BLD[b.type].size / 2;
    b.hitT = S.t + RULE_FX.metHit;
    ns.hits = (ns.hits || 0) + 1;
    logMsg(S, `☄ 운석이 "${camp.name}" 중 ${BLD[b.type].n}에 부딪혔으며 수리를 위해 작업이 ${Math.round(RULE_FX.metHit / 60)}분 동안 중단되었습니다. 다친 사람은 없었고 예전처럼 수리가 완료되었습니다.`, 'warn');
    rt(S).fx.push({ kind: 'meteor', camp: camp.id, b: b.id, x: b.x + h, y: b.y + h, hit: true });
  } else {
    const a = z.a * Math.PI * 2, d = heatRadius(S, camp) * (0.6 + 0.35 * z.pick);
    rt(S).fx.push({ kind: 'meteor', camp: camp.id, x: camp.x + Math.cos(a) * d, y: camp.y + Math.sin(a) * d, hit: false });
  }
}
// ---------- 古城遗址：拆废墟（一处是连在一起的几格断墙） ----------
export function ruinTiles(S, i) {
  const w = getWorld(S.runSeed), rk = SPOT_KEYS.indexOf('ruin');
  if (w.spot[i] !== rk || spotLeft(S, i) <= 0) return [];
  const out = [i], seen = new Set(out);
  for (let n = 0; n < out.length && out.length < 12; n++) {
    const x = out[n] % W, y = Math.floor(out[n] / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy, j = idx(xx, yy);
      if (!inMap(xx, yy) || seen.has(j)) continue;
      seen.add(j);
      if (w.spot[j] === rk && spotLeft(S, j) > 0) out.push(j);
    }
  }
  return out;
}
export const ruinLoot = n => ({ part: 15 * n, steel: 30 * n });
export const ruinCost = n => ({ food: 15 * n });
export function ruinBlock(S, i) {
  const tiles = ruinTiles(S, i); if (!tiles.length) return { why: '여기에는 폐허가 없습니다.' };
  const camp = getCamp(S, warmCampAt(S, i % W, Math.floor(i / W)));
  if (!camp) return { why: '일손 배치는 야영지 및 난방권에서만 분해할 수 있습니다.', tiles };
  if (depotAuto(camp)) return { why: `"${camp.name}"은(는) 공급 스테이션입니다. 일손 배치를 수행하려면 먼저 "일시적으로 인수"해야 합니다.`, tiles, camp };
  const cost = ruinCost(tiles.length);
  if (!canAfford(camp.stock, cost)) return { why: '부족: ' + missing(camp.stock, cost).join(','), tiles, camp, cost };
  return { why: '', tiles, camp, cost };
}
export function dismantleRuin(S, i) {
  const ck = ruinBlock(S, i); if (ck.why) return { ok: false, reason: ck.why };
  const { tiles, camp, cost } = ck, loot = ruinLoot(tiles.length), cap = storeCap(S, camp);
  pay(camp.stock, cost);
  for (const t of tiles) S.spots[t] = 0;
  for (const k in loot) camp.stock[k] = Math.min(Math.max(cap, camp.stock[k] || 0), (camp.stock[k] || 0) + loot[k]);
  rt(S).spotsDirty = true; dirty(S);
  S.stats.ruins = (S.stats.ruins || 0) + 1; S.meta.ruinsN = (S.meta.ruinsN || 0) + 1;
  if (camp.id === journeyOf(S).main && ruleNow(S)) { const ns = nsOf(S); ns.ruin = (ns.ruin || 0) + 1; }
  const cx = tiles.reduce((a, t) => a + t % W, 0) / tiles.length + 0.5, cy = tiles.reduce((a, t) => a + Math.floor(t / W), 0) / tiles.length + 0.5;
  rt(S).fx.push({ kind: 'ruin', camp: camp.id, x: cx, y: cy });
  logMsg(S, `🏛 「${camp.name}」는 고성 폐허를 철거하여 ${tiles.length} 정사각형을 남겼습니다: 고대 부품 +${loot.part}, 강재 +${loot.steel}.`, 'good');
  return { ok: true, loot };
}

// ---------- 数据曲线：每个营地记两份历史 ----------
// f：细的，30 秒一笔，只留最近 96 笔（4 天）；c：粗的，从建营地开始记，满 120 笔就两两合并、间隔翻倍，整局都装得下
// 每一笔是这段时间里的平均值；离线追赶的那段，物资只按离线收益的比例记
export const HIST = { f: { dt: 30, max: 96, ring: true }, c: { dt: 120, max: 120 } };
const HIST_G = ['pop', 'wait', 'hope', 'disc', 'tin', 'tout'];
function histVals(S, c) {
  const R = rt(S), cr = R.c[c.id] || {};
  const v = { pop: c.people, wait: c.wait || 0, hope: c.hope || 0, disc: c.disc || 0, tin: cr.tH ?? c.temp ?? 0, tout: baseTempOfRow(c.y) - (cr.drop || 0) };
  const off = R.histOff, s0 = off && off.stock.get(c.id);
  for (const k in c.stock) { let x = c.stock[k] || 0; if (s0 && x > (s0[k] || 0)) x = (s0[k] || 0) + (x - (s0[k] || 0)) * off.rate; if (x > 0) v['s:' + k] = x; }
  for (const k in cr.flow || {}) if (cr.flow[k].p > 0) v['p:' + k] = cr.flow[k].p;
  return v;
}
const histRound = (k, x) => k === 'tin' || k === 'tout' || Math.abs(x) < 100 ? Math.round(x * 10) / 10 : Math.round(x);
function histPush(T, cfg) {
  const w = T.a.w;
  for (const k in T.a.s) if (!T.v[k]) T.v[k] = new Array(T.n).fill(null);
  for (const k in T.v) { const A = T.v[k]; A.push(w > 0 ? histRound(k, (T.a.s[k] || 0) / w) : (A.length ? A[A.length - 1] : null)); }
  T.n++; T.a = { w: 0, s: {} };
  if (cfg.ring && T.n > cfg.max) {
    for (const k in T.v) { T.v[k].shift(); if (!HIST_G.includes(k) && T.v[k].every(x => !x)) delete T.v[k]; }
    T.n--; T.t0 += T.dt;
  } else if (!cfg.ring && T.n >= cfg.max) {
    for (const k in T.v) { const A = T.v[k], B = []; for (let i = 0; i + 1 < A.length; i += 2) { const a = A[i], b = A[i + 1]; B.push(a == null ? b : b == null ? a : histRound(k, (a + b) / 2)); } T.v[k] = B; }
    T.n = Math.floor(T.n / 2); T.dt *= 2;
  }
}
function histStep(S, dt) {
  for (const c of S.camps) {
    const H = c.hist || (c.hist = {}), v = histVals(S, c);
    for (const id in HIST) {
      const cfg = HIST[id];
      let T = H[id];
      if (!T) T = H[id] = { dt: cfg.dt, t0: Math.floor((S.t - dt) / cfg.dt) * cfg.dt, n: 0, v: {}, a: { w: 0, s: {} } };
      T.a.w += dt; for (const k in v) T.a.s[k] = (T.a.s[k] || 0) + v[k] * dt;
      while (S.t >= T.t0 + (T.n + 1) * T.dt) histPush(T, cfg);
    }
  }
}
// 一份历史里某个量的点：[{t, v}]，t 取每段的中点
export function histSeries(T, k) { const A = T && T.v[k]; if (!A) return null; return A.map((v, i) => ({ t: T.t0 + (i + 0.5) * T.dt, v })); }

// ---------- 建造队列：材料不够也先摆下，材料一到自动开工；升级也能排 ----------
export const QUEUE_MAX = 8;
export function queueBuild(S, type, x, y) {
  if (type === 'furnace') return { ok: false, reason: '전초기지 용광로를 대기열에 추가할 수 없습니다.' };
  const ck = checkPlace(S, type, x, y);
  if (ck.ok) return place(S, type, x, y);
  if (!ck.soft) return ck;
  S.queue = S.queue || [];
  if (S.queue.filter(q => q.camp === ck.camp).length >= QUEUE_MAX) return { ok: false, reason: `이 야영지는 ${QUEUE_MAX} 대기열에 추가되었으며 자료를 기다리고 있습니다.` };
  const q = { id: S.nextId++, type, x, y, camp: ck.camp, t: S.t };
  S.queue.push(q);
  clearFootprint(S, type, x, y, ck.camp); // 先把地块上的石头树木清掉，免得蓝图和它们穿模
  dirty(S);
  return { ok: true, queued: true, id: q.id };
}
export function queued(S, qid) { return (S.queue || []).find(q => q.id === qid) || null; }
export function unqueue(S, qid) { const n = (S.queue || []).length; S.queue = (S.queue || []).filter(q => q.id !== qid); if (S.queue.length !== n) dirty(S); }
export function queueCost(S, q) { return buildCost(S, q.type, q.camp, q.y); }
export function toggleQueueUp(S, bid) { const b = getB(S, bid); if (!b) return; b.qup = b.qup ? 0 : 1; }

// ---------- 批量操作：同类建筑一起升级 / 一起派满人；建造时拖出一排 ----------
export function sameType(S, b) { return S.buildings.filter(x => x.camp === b.camp && x.type === b.type); }
// 同类一起升：每栋升一级，从等级低的开始；材料不够的排队，材料到齐自动升
export function bulkUpgrade(S, bid) {
  const b = getB(S, bid); if (!b || b.type === 'furnace') return { ok: false, up: 0, q: 0, locked: 0, n: 0 };
  const L = sameType(S, b).sort((x, y) => x.lvl - y.lvl || x.id - y.id);
  let up = 0, q = 0, locked = 0;
  for (const x of L) {
    const cost = upgradeCost(S, x);
    if (Object.keys(cost).some(k => RES[k].t > S.known)) { locked++; continue; }
    if (upgrade(S, x.id).ok) { up++; x.qup = 0; continue; }
    x.qup = 1; q++;
  }
  return { ok: up + q > 0, up, q, locked, n: L.length };
}
// 同类都派满：手动减过人的也重新派满；空闲人手不够时先派给等级高的
export function bulkStaff(S, bid) {
  const b = getB(S, bid); if (!b) return { add: 0, short: 0, n: 0 };
  const L = sameType(S, b).filter(x => bMax(S, x)).sort((x, y) => y.lvl - x.lvl || x.id - y.id);
  let add = 0, short = 0;
  for (const x of L) { const w0 = x.workers, mx = bMax(S, x); setWorkers(S, x.id, mx); add += x.workers - w0; short += mx - x.workers; }
  return { add, short, n: L.length };
}
export function staffOf(S, b) { let w = 0, mx = 0; for (const x of sameType(S, b)) { w += x.workers; mx += bMax(S, x); } return { w, mx }; }
// 拖出一排：沿拖动的主方向，按建筑宽度一栋挨一栋，最多 ROW_MAX 栋
export const ROW_MAX = 10;
export function rowSlots(type, x0, y0, x1, y1) {
  const s = BLD[type].size, dx = x1 - x0, dy = y1 - y0, hz = Math.abs(dx) >= Math.abs(dy), d = hz ? dx : dy;
  const n = Math.min(ROW_MAX, Math.round(Math.abs(d) / s) + 1), sg = Math.sign(d) || 1, out = [];
  for (let i = 0; i < n; i++) out.push(hz ? [x0 + sg * s * i, y0] : [x0, y0 + sg * s * i]);
  return out;
}
// 预演这一排：哪几栋能马上建（同类越建越贵，材料按顺序扣）、哪几栋排队、哪几处不能建
export function rowPlan(S, type, slots) {
  const left = {}, extra = {}, qn = {}, plan = [], total = {};
  let ok = 0, q = 0, bad = 0;
  for (const [x, y] of slots) {
    const ck = checkPlace(S, type, x, y);
    if (!ck.ok && !ck.soft) { plan.push({ x, y, st: 'bad', reason: ck.reason }); bad++; continue; }
    const camp = getCamp(S, ck.camp), cid = ck.camp;
    const st = left[cid] || (left[cid] = { ...camp.stock });
    const cost = buildCost(S, type, cid, y, extra[cid] || 0);
    for (const k in cost) total[k] = (total[k] || 0) + cost[k];
    if (canAfford(st, cost)) { pay(st, cost); extra[cid] = (extra[cid] || 0) + 1; plan.push({ x, y, st: 'ok', camp: cid }); ok++; continue; }
    const inQ = (S.queue || []).filter(e => e.camp === cid).length + (qn[cid] || 0);
    if (inQ >= QUEUE_MAX) { plan.push({ x, y, st: 'bad', reason: `이 야영지는 ${QUEUE_MAX} 대기열에 추가되었으며 자료를 기다리고 있습니다.` }); bad++; continue; }
    qn[cid] = (qn[cid] || 0) + 1; plan.push({ x, y, st: 'q', camp: cid }); q++;
  }
  return { plan, ok, q, bad, total };
}
// 按预演的顺序摆下去：材料够的直接开工，不够的排进建造队列
export function placeRow(S, type, slots) {
  let built = 0, queued = 0, failed = 0, reason = '';
  for (const [x, y] of slots) {
    const r = queueBuild(S, type, x, y);
    if (!r.ok) { failed++; reason = reason || r.reason; } else if (r.queued) queued++; else built++;
  }
  return { built, queued, failed, reason };
}
function queueStep(S) {
  for (const q of [...(S.queue || [])]) {
    const camp = getCamp(S, q.camp); if (!camp) { unqueue(S, q.id); continue; }
    if (!canAfford(camp.stock, queueCost(S, q))) continue;
    const ck = checkPlace(S, q.type, q.x, q.y, q.id);
    if (!ck.ok && !ck.soft) { unqueue(S, q.id); logMsg(S, `대기열에 있는 토지의 ${BLD[q.type].n} 구역은 더 이상 건설할 수 없으며(${ck.reason}) 취소되었습니다.`, 'warn'); continue; }
    if (!ck.ok) continue;
    unqueue(S, q.id);
    const r = place(S, q.type, q.x, q.y);
    if (r.ok) { logMsg(S, `재료가 수집되었으며 ${BLD[q.type].n} 줄이 "${camp.name}"에서 공사를 시작했습니다.`, 'good'); rt(S).fx.push({ kind: 'qbuilt', id: r.id }); }
  }
  for (const b of S.buildings) {
    if (!b.qup) continue;
    const camp = getCamp(S, b.camp), cost = upgradeCost(S, b);
    if (Object.keys(cost).some(k => RES[k].t > S.known)) continue;
    if (!canAfford(camp.stock, cost)) continue;
    b.qup = 0;
    if (upgrade(S, b.id).ok && b.type !== 'furnace') logMsg(S, `모든 자료가 준비되면 ${BLD[b.type].n}이(가) 자동으로 ${b.lvl} 레벨로 업그레이드되었습니다.`, 'good');
  }
}

// ---------- 商队订单：每隔几小时有商队在营地外扎营，带着几张订单，用稀缺物资、余烬或人手换你的货 ----------
export const CAR_P = 10800, CAR_FIRST = 4200, CAR_STAY = 5400, CAR_AUTO = 600;
export function caravanSlot(S, k) { return { k, t: CAR_FIRST + k * CAR_P + hash3(k, 307, S.runSeed) * (CAR_P - CAR_STAY - 600) }; }
export function caravanAt(S, x, y) { const c = S.car; return !!c && x >= c.x && x < c.x + 3 && y >= c.y && y < c.y + 3; }
export function nextCaravan(S) {
  if (S.car) return null;
  let k = Math.max(0, Math.floor((S.t - CAR_FIRST) / CAR_P));
  let sl = caravanSlot(S, k); if (sl.t + CAR_STAY <= S.t || (S.carK ?? -1) >= k) sl = caravanSlot(S, k + 1);
  return { in: sl.t - S.t, k: sl.k };
}
// 熔炉供热圈外面找一块 3×3 的空地扎营：不压建筑、资源点、岩石和遗迹
function caravanSpot(S, camp) {
  const w = getWorld(S.runSeed), R = rebuild(S), r0 = heatRadius(S, camp) + 1.5;
  const free = (x, y) => inMap(x, y) && x >= 1 && x <= W - 2 && w.terrain[idx(x, y)] === T_SNOW && S.reveal[idx(x, y)] && !R.occ[idx(x, y)] && !(w.spot[idx(x, y)] >= 0 && spotLeft(S, idx(x, y)) > 0) && !landmarkBlock(x, y, S) && !siteAt(S, x, y, 1);
  const a0 = hash3(camp.id, S.t | 0, 311) * Math.PI * 2;
  for (let d = r0; d < r0 + 7; d += 1) for (let j = 0; j < 24; j++) {
    const a = a0 + j * Math.PI * 2 / 24, x = Math.round(camp.x + Math.cos(a) * d - 1.5), y = Math.round(camp.y + Math.sin(a) * d - 1.5);
    let ok = true;
    for (let yy = y - 1; yy <= y + 3 && ok; yy++) for (let xx = x - 1; xx <= x + 3; xx++) {
      const inner = xx >= x && xx < x + 3 && yy >= y && yy < y + 3;
      if (inner ? !free(xx, yy) : inMap(xx, yy) && R.occ[idx(xx, yy)]) { ok = false; break; } // 外面一圈不贴建筑
    }
    if (ok) return { x, y };
  }
  return null;
}
function makeOrders(S, camp, k) {
  const r = mulberry32((S.runSeed * 131 + k * 7919) | 0), cr = rt(S).c[camp.id] || {}, fl = cr.flow || {}, cap = storeCap(S, camp);
  const ct = Math.max(1, Math.min(tierOfRow(camp.y), S.known));
  const BAN = ['heart', 'shard', 'core', 'game', 'starcore'];
  let asks = RES_KEYS.filter(q => !BAN.includes(q) && RES[q].t <= ct && RES[q].t >= Math.max(1, ct - 1) && ((fl[q] && fl[q].p > 0.05) || (camp.stock[q] || 0) >= 20));
  if (asks.length < 3) asks = [...new Set([...asks, 'wood', 'stone', 'plank'])];
  // 打乱，三张订单尽量要不同的货
  for (let i = asks.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [asks[i], asks[j]] = [asks[j], asks[i]]; }
  const nice = x => x >= 1000 ? Math.round(x / 50) * 50 : x >= 100 ? Math.round(x / 10) * 10 : Math.max(1, Math.round(x));
  const amt = (q, m) => nice(Math.min(cap * 0.6, Math.max(cap * 0.1, ((fl[q] && fl[q].p) || 0) * 30) * m));
  const rt2 = Math.min(S.known, ct + 1);
  const gifts = RES_KEYS.filter(q => !['heart', 'shard', 'food', 'game', 'starcore'].includes(q) && RES[q].t === rt2 && (rt2 > ct || !RES[q].raw));
  const out = [];
  const g = gifts[Math.floor(r() * gifts.length)] || 'plank', gi = Math.max(0, asks.findIndex(q => q !== g));
  if (gi) [asks[0], asks[gi]] = [asks[gi], asks[0]]; // 换来的货不能和要的一样
  { const q = asks[0], a = amt(q, 1); out.push({ ask: q, n: a, kind: 'goods', give: g, gn: nice(a * resValue(q) * 1.6 / resValue(g)) }); }
  { const q = asks[1 % asks.length]; out.push({ ask: q, n: amt(q, 1.4), kind: 'ember', gn: 2 + ct + Math.floor(r() * 3) }); }
  { const q = asks[2 % asks.length]; out.push({ ask: q, n: amt(q, 0.8), kind: 'people', gn: 3 + ct + Math.floor(r() * 3) }); }
  return out;
}
export function orderBlock(S, i) {
  const c = S.car, o = c && c.orders[i]; if (!o) return '그런 순서는 없어요';
  if (o.done) return '상품이 배송되었습니다';
  const camp = getCamp(S, c.camp); if (!camp) return '야영지가 사라짐';
  if ((camp.stock[o.ask] || 0) < o.n) return `${RES[o.ask].n}이(가) 충분하지 않습니다(${Math.ceil(o.n - (camp.stock[o.ask] || 0))}이(가) 누락되었습니다)`;
  if (o.kind === 'people') {
    const beds = Math.floor(freeBeds(S, camp)); if (beds < o.gn) return `침대 부족: 침대 ${o.gn}개 필요, 현재 침대 ${Math.max(0, beds)}개 사용 가능`;
    // 跟新人自己来投奔一样：口粮撑不住就先别收人，免得大家一起挨饿
    const cr = rt(S).c[camp.id] || {};
    if ((cr.foodNet != null && cr.foodNet < EAT * o.gn) || (camp.stock.food || 0) < (camp.people + o.gn) * EAT * 30) return `배급은 더 이상 ${o.gn}을(를) 모으기에 충분하지 않습니다. 먼저 음식을 더 확보하세요.`;
  }
  return '';
}
export function deliverOrder(S, i, auto) {
  const why = orderBlock(S, i); if (why) return { ok: false, reason: why };
  const c = S.car, o = c.orders[i], camp = getCamp(S, c.camp);
  camp.stock[o.ask] -= o.n; o.done = true; S.stats.carOrders = (S.stats.carOrders || 0) + 1;
  let got;
  if (o.kind === 'goods') { camp.stock[o.give] = Math.max(camp.stock[o.give] || 0, Math.min(storeCap(S, camp), (camp.stock[o.give] || 0) + o.gn)); got = `${o.gn} ${RES[o.give].n}`; }
  else if (o.kind === 'ember') { S.meta.embers += o.gn; S.meta.emberTotal = (S.meta.emberTotal || 0) + o.gn; got = `${o.gn}포인트잔불`; }
  else { addPeople(S, camp, o.gn); got = `캐러밴을 따라가는 방랑자 ${o.gn}명이 야영지에 정착했습니다.`; }
  logMsg(S, `${auto ? '카라반이 떠나기 전,' : ''}「${camp.name}」은(는) ${got}와 교환하여 ${o.n} ${RES[o.ask].n}을(를) 넘겨주었습니다.`, 'good');
  return { ok: true, got };
}
export function setCarAuto(S, on) { S.carAuto = !!on; }
function caravanStep(S) {
  const c = S.car;
  if (c) {
    const camp = getCamp(S, c.camp);
    if (!camp || S.t >= c.until) {
      const n = c.orders.filter(o => o.done).length;
      S.car = null; dirty(S);
      logMsg(S, n ? `캐러밴은 물건을 모으고 출발했으며 이번에는 ${n}를 주문했습니다.` : '캐러밴은 상품을 기다릴 수 없어 썰매를 가져갔습니다.');
      return;
    }
    // 没人照看时（离线、挂机）临走前把多出来的货交掉：只交库存够两倍的
    if (S.carAuto !== false && c.until - S.t <= CAR_AUTO) c.orders.forEach((o, i) => { if (!o.done && !orderBlock(S, i) && (camp.stock[o.ask] || 0) >= o.n * 2) deliverOrder(S, i, true); });
    return;
  }
  const k = Math.max(0, Math.floor((S.t - CAR_FIRST) / CAR_P)), sl = caravanSlot(S, k);
  if (S.t < sl.t || S.t >= sl.t + CAR_STAY || (S.carK ?? -1) >= k) return;
  S.carK = k;
  const camp = S.camps.slice().sort((a, b) => b.people - a.people)[0];
  const at = camp && caravanSpot(S, camp); if (!at) return;
  S.car = { k, camp: camp.id, x: at.x, y: at.y, t: S.t, until: sl.t + CAR_STAY, orders: makeOrders(S, camp, k) };
  dirty(S);
  logMsg(S, `🛷 썰매 캐러밴이 "${camp.name}" 외부에서 캠핑을 하고 ${S.car.orders.length} 주문을 가져왔습니다. 부족한 보급품인 잔불 및 일손을 교환합니다. 약 ${Math.round((S.car.until - S.t) / 60)}분 후에 출발합니다.`, 'good', { act: 'car', label: '순서를 보세요' });
}

// 自动把空闲的人派到缺人的建筑（吃饭、取暖优先）
const AUTO_ORDER = ['kitchen', 'hunter', 'greenhouse', 'lumber', 'nursery', 'coalmine', 'warehouse', 'tower', 'heater'];
function autoPr(t) { const i = AUTO_ORDER.indexOf(t); return i < 0 ? 50 + BLD[t].t : i; }
export function autoAssign(S, camp) {
  if (camp.auto === false && !depotAuto(camp)) return;
  const R = rt(S), FULL = '창고가 가득 참';
  const st = b => (R.b[b.id] || {}).status;
  let idle = idleLabor(S, camp);
  const mine = S.buildings.filter(b => b.camp === camp.id && !b.hold);
  const idleShop = b => (b.type === 'workshop' && !(S.tech && S.tech.cur)) || (b.type === 'sledshed' && !(b.vq && b.vq.length)); // 没有研究课题的工程站、没排车的雪橇棚不派人
  const need = mine.filter(b => b.workers < bMax(S, b) && st(b) !== FULL && !idleShop(b));
  if (!need.length) return;
  need.sort((a, b) => autoPr(a.type) - autoPr(b.type) || a.id - b.id);
  // 产出堆满仓库的建筑等于在白干，把那里的人调去缺人的地方
  const donors = mine.filter(b => b.workers > 0 && (st(b) === FULL || idleShop(b))).sort((a, b) => autoPr(b.type) - autoPr(a.type));
  for (const b of need) {
    let want = bMax(S, b) - b.workers;
    const k = Math.min(idle, want); b.workers += k; idle -= k; want -= k;
    for (const d of donors) { if (want <= 0) break; if (d === b || !d.workers) continue; const m = Math.min(d.workers, want); d.workers -= m; b.workers += m; want -= m; }
    if (idle <= 0 && !donors.some(d => d.workers > 0)) break;
  }
}
function campStep(S, camp, dt, w) {
  const R = rt(S);
  if (camp.fest && S.t + dt >= camp.fest.until) endFest(S, camp);
  camp.autoAcc = (camp.autoAcc || 0) + dt;
  if (camp.autoAcc >= 5) { camp.autoAcc = 0; autoAssign(S, camp); }
  const st = camp.stock;
  const bs = S.buildings.filter(b => b.camp === camp.id);
  const fb = getB(S, camp.furnace);
  // 离线追赶时仓库按入库比例放大：满速跑出来的净增长结算时再打折，最后封到仓库的八成
  const cap = storeCap(S, camp) * (R.histOff ? 1 / Math.max(0.1, R.histOff.rate) : 1);
  const cr = R.c[camp.id] || (R.c[camp.id] = {});
  const prodMul = moodMul(camp);
  const kitMul = 1 + lawSum(S, 'kitchen');
  if (cr.trade) for (const q in cr.trade) { cr.trade[q] *= Math.max(0, 1 - dt / 60); if (cr.trade[q] < 0.01) delete cr.trade[q]; } // 约等于每分钟兑换量

  // 自动机仓：装入核心，每个仓造自己挑的那一型
  let botCap = 0;
  for (const b of bs) if (b.type === 'bay') { const cap = bayCap(S, b), fill = Math.min(cap, b.want ?? cap); b.bots = Math.min(b.bots || 0, cap); botCap += cap; while (b.bots + 2 <= fill && (st.core || 0) >= 1) { st.core -= 1; b.bots += 2; } }
  campBots(S, camp, bs);

  // 燃料：熔炉 + 暖炉
  const od = odActive(S, camp, w, fb), stall = camp.odCool > 0;
  const ev = w.ev && w.ev.on ? w.ev.ev : null, evPrep = !!ev && wxePrepped(S, camp, ev);
  const frozen = !!ev && ev.kind === 'ice' && !evPrep, coldNight = !!ev && ev.kind === 'cold';
  const cRule = campRule(S, camp), cold = coldNow(S), tide = tideNow(S);
  let fuelNeed = furnaceBurn(depotFireLvl(S, camp, fb)) * Math.max(0.3, 1 + buffOf(S, camp, 'fuel') + lawSum(S, 'fuel') + techSum(S, 'fuel')) * (od ? OD_FUEL : 1) * (coldNight ? WXE_FUEL : 1) * Math.max(cold ? coldFuel(S) : 1, tide ? TIDE.fuel : 1) * diffOf(S).fuel * (cRule === 'geo' ? RULE_FX.geoFuel : cRule === 'night' ? RULE_FX.nightFuel : 1) * cmdFuel(S, camp) * wonderFuel(S) / 60 * dt;
  const fuelKeepU = dt > 0 ? fuelNeed / dt * 60 * FUEL_KEEP_MIN : 0; // 工厂和塔身不许动的那份燃料（按燃料份数算）
  let heaterHeat = 0;
  const heaters = bs.filter(b => b.type === 'heater');
  const order = camp.fuelPref === 'auto' ? FUEL_ORDER : [camp.fuelPref, ...FUEL_ORDER.filter(f => f !== camp.fuelPref)];
  let got = 0, burned = {};
  for (const f of order) {
    if (got >= fuelNeed) break;
    const have = st[f] || 0;
    if (have <= 0) continue;
    const take = Math.min(have, (fuelNeed - got) / FUEL[f]);
    st[f] = have - take; got += take * FUEL[f]; burned[f] = take;
  }
  const fueled = fuelNeed > 0 ? Math.min(1, got / fuelNeed) : 1;
  let heaterCoal = 0, heaterWant = 0;
  for (const h of heaters) {
    const mx = maxWorkers('heater', h.lvl);
    const staff = mx ? Math.min(1, h.workers / mx) : 1;
    const need = frozen ? 0 : BLD.heater.burn * h.lvl * staff / 60 * dt; // 冰风暴冻住了管子：不烧也不热
    const take = Math.min(st.coal || 0, need);
    heaterCoal += take; heaterWant += need;
    st.coal = (st.coal || 0) - take;
    if (need > 0) heaterHeat += BLD.heater.heat * (1 + 0.5 * (h.lvl - 1)) * (take / need) * staff * (1 + techSum(S, 'heater') + campSpecFx(S, h, camp));
  }
  // 地热井：不烧燃料，派了人就一直热
  for (const h of bs) {
    if (h.type !== 'geowell') continue;
    const mx = maxWorkers('geowell', h.lvl), staff = mx ? Math.min(1, h.workers / mx) : 1;
    heaterHeat += BLD.geowell.heat * (1 + 0.5 * (h.lvl - 1)) * staff;
  }
  const fSpec = specOf(S, fb);
  const odHeat = od ? odBoost(fb.lvl) * fueled * (1 + fSpec * 0.5) : 0;
  const heat = furnaceHeat(fb.lvl) * (stall ? 0.3 : 0.3 + 0.7 * fueled) * (1 + fSpec * 0.5) + 3 * up(S, 'heat') * fueled + heaterHeat + buffOf(S, camp, 'heat') * fueled + 2 * (camp.pipe || 0) * fueled * (frozen ? 0 : 1) + odHeat; // 断燃或停炉时余烬还剩三成热
  // 炉温：超载时升高（工程师看炉子升得慢），不超载时回落
  if (od) {
    camp.ovh = Math.min(100, (camp.ovh || 0) + OD_UP / (1 + fSpec) * dt);
    if (camp.ovh >= 85 && camp.od && !camp.ovhWarn) { camp.ovhWarn = true; logMsg(S, `"${camp.name}"의 용광로가 빨간색으로 불타고 있습니다(퍼니스 온도 ${Math.round(camp.ovh)}%). 멈추지 않고 과부하가 걸리면 냉각을 위해 퍼니스를 강제로 종료해야 합니다.`, 'warn', { act: 'wx', label: '보일러 온도 좀 보세요' }); }
    if (camp.ovh >= 100) {
      camp.od = 0; camp.odA = 0; camp.odCool = OD_STALL; camp.ovh = 75;
      logMsg(S, `"${camp.name}"의 용광로가 과부하되어 퍼니스가 ${OD_STALL / 60}분 동안 냉각을 강제로 중지했습니다. 이 기간 동안 열은 30%만 남았습니다!`, 'bad');
      rt(S).fx.push({ kind: 'odstall', camp: camp.id });
    }
  } else {
    camp.ovh = Math.max(0, (camp.ovh || 0) - OD_DOWN * dt);
    if (camp.odCool > 0) { camp.odCool = Math.max(0, camp.odCool - dt); if (!camp.odCool) logMsg(S, `"${camp.name}"의 용광로가 냉각되어 정상 가열을 재개했습니다.`, 'good'); }
  }
  if (camp.ovh < 70) camp.ovhWarn = false;
  // 极寒夜：燃料烧够了还冷三成五，烧不够冷得更多；封好门窗缝减半
  const evDrop = coldNight ? (8 + 2 * (tierOfRow(camp.y) - 1)) * diffOf(S).cold * (evPrep ? 0.5 : 1) * (0.35 + 0.65 * (1 - fueled)) : 0;
  const drop = blizzDrop(S, camp, w) + evDrop + Math.max(cold ? COLD.drop : 0, tide ? tide.drop : 0); // 寒潮和永冬潮撞上：按冷的那个算
  cr.ev = ev ? { kind: ev.kind, prep: evPrep, drop: evDrop, frozen } : null;
  const temp = baseTempOfRow(camp.y) + heat - drop;
  camp.temp = temp;

  // 住房与体感温度
  let housing = 0, insW = 0;
  const tInsul = techSum(S, 'insul');
  for (const b of bs) if (b.type === 'tent') { const h = housingOf(b, S); housing += h; insW += h * ((insulOf(b) + tInsul) * (1 + specOf(S, b) * 0.5)); }
  const ins = housing ? insW / housing : 0;
  const away = awayOf(S, camp);
  if (!camp.popFix) { // 旧存档：超出床位的人先去等床位
    camp.popFix = 1;
    const over = Math.min(camp.people - MIN_PEOPLE, Math.floor(camp.people + away - housing));
    if (housing > 0 && over > 0) { camp.people -= over; camp.wait = (camp.wait || 0) + over; trimWorkers(S, camp); }
  }
  if (camp.wait > 0) {
    const k = Math.min(camp.wait, Math.floor(housing - camp.people - away), Math.floor(popRoom(S, camp)));
    if (k >= 1) {
      camp.wait -= k; camp.people += k;
      for (let i = 0; i < Math.min(k, 6); i++) R.fx.push({ kind: 'arrive', camp: camp.id });
      logMsg(S, `「${camp.name}"빈 침대가 있고,${k}오두막에서 기다리고 있던 남자가 들어왔다${camp.wait ? `(게다가${camp.wait}사람들이 기다리고 있어요)` : ''}。`, 'good');
    }
  }
  const housed = Math.min(camp.people, housing);
  const unhoused = camp.people - housed;
  const hardy = 2 * up(S, 'hardy');
  const tH = temp + ins + hardy, tU = temp + hardy;
  const effOf = t => Math.max(0.3, Math.min(1, 1 + 0.03 * Math.min(0, t)));
  const humanEff = camp.people ? (housed * effOf(tH) + unhoused * effOf(tU)) / camp.people : 1;

  // 生病：体感低于 2° 或挨饿时有人病倒，病人不干活；暖和、吃饱后慢慢康复
  const sevS = (housed * Math.max(0, 2 - tH) + unhoused * Math.max(0, 2 - tU)) / Math.max(1, camp.people);
  const hung = cr.hunger || 0;
  let sick = camp.sick || 0;
  // 医务所：病床上的人在屋里养病，外面冷、口粮紧也能好；有人守着，少有人病倒
  const ward = wardOf(S, camp);
  const recMul = 1 + lawSum(S, 'sickRec') + techSum(S, 'sickRec');
  sick += camp.people * (0.0025 * sevS + 0.01 * hung + lawSum(S, 'sickIn')) * (1 - WARD_GUARD * ward.guard) / 60 * dt;
  if (cold && sevS > 0.1 && camp.people > 0 && S.cold) (S.cold.hit || (S.cold.hit = {}))[camp.id] = 1; // 寒潮里有人冻着了
  if (tide && sevS > 0.1 && camp.people > 0 && S.tide) (S.tide.hit || (S.tide.hit = {}))[camp.id] = 1;
  const treated = Math.min(sick, ward.beds);
  if (treated > 0) sick -= treated * WARD_REC * ward.care * recMul / 60 * dt;
  if (sevS === 0 && hung === 0) sick -= Math.max(0.05, Math.max(0, sick - treated) * 0.12) * recMul / 60 * dt;
  camp.sick = Math.max(0, Math.min(camp.people * 0.3, sick));
  cr.treated = Math.min(Math.floor(camp.sick), ward.beds); // 显示和心情都按整人算
  for (const b of bs) if (b.type === 'infirmary') {
    const br = R.b[b.id] || (R.b[b.id] = {}), mx = maxWorkers(b.type, b.lvl), sf = mx ? Math.min(1, b.workers / mx) : 0;
    const share = ward.beds > 0 ? wardBeds(b.lvl) * sf / ward.beds : 0, pts = cr.treated * share;
    br.staff = sf; br.pts = pts; br.act = sf * (pts > 0.05 ? 1 : 0.4); br.rate = {};
    br.status = !b.workers ? '배치된 일손 없음' : sf < 0.99 ? '일손 부족' : '달리기';
  }
  // 医生：医务所开张、有人守着，过一阵何大夫会来投奔
  if (!S.meta.specs.he && ward.guard > 0) {
    S.docT = (S.docT || 0) + dt;
    if (S.docT >= DOC_AFTER) {
      const sp = SPECS.find(x => x.id === 'he');
      S.meta.specs.he = { lvl: 1 };
      logMsg(S, `약상자를 들고 있는 노인이 "${camp.name}"에 들어왔습니다: 전문가 "${sp.n}" (${sp.role})이(가) 합류했습니다! ${sp.story} TA를 진료소로 배열합니다.`, 'story', { act: 'tb', arg: 'specs', label: '정리하다' });
      R.fx.push({ kind: 'arrive', camp: camp.id });
    }
  }
  const sickN = Math.floor(camp.sick);
  if (sickN >= 2 && !camp.sickWarn) { camp.sickWarn = true; logMsg(S, `"${camp.name}"에는 ${sickN}명이 동상이나 배고픔을 겪고 있어 환자가 작동할 수 없습니다. 모두가 따뜻한 곳에서 생활하고 음식을 충분히 섭취하게 하면 점차 나아질 것입니다.`, 'warn'); }
  if (sickN === 0) camp.sickWarn = false;

  // 人手
  // 劳工型自动机和人一起算人手（一台顶 1.5 个）；采掘型只补采集的岗位，干得比人快三成
  const pow = botPow(S), bL = (camp.bots || 0) - (camp.botH || 0) - (camp.botM || 0);
  const labor = camp.people - sickN + bL * pow;
  let assigned = 0, gAss = 0;
  for (const b of bs) { assigned += b.workers; if (BLD[b.type].cat === 'gather') gAss += b.workers; }
  const mineU = Math.min(gAss, (camp.botM || 0) * pow), genAss = assigned - mineU;
  const lf = genAss > 0 ? Math.min(1, labor / genAss) : 1;
  const workEff = labor ? (camp.people * humanEff + bL * pow) / labor : humanEff;
  const botFr = labor > 0 ? bL * pow / labor : 0, gGen = (gAss - mineU) * lf;
  const lfG = gAss > 0 ? (mineU + gGen) / gAss : lf;
  const effG = mineU + gGen > 0 ? (mineU * (1 + BOT.mine) + gGen * workEff) / (mineU + gGen) : workEff;
  const botG = mineU + gGen > 0 ? (mineU + gGen * botFr) / (mineU + gGen) : 0; // 采集岗位上自动机占几成（耐寒外壳用）
  cr.botFr = botFr; cr.botG = botG; cr.mineU = mineU; cr.mineIdle = Math.max(0, (camp.botM || 0) * pow - mineU);
  const blaze = cmdOn(S, 'blaze', camp) ? 2 : 1; // 熔炉狂燃
  const gSlow = Math.min(cold ? coldGather(S) : 1, tide ? tideGather(S) : 1);
  const coldSlow = cold || tide ? (techDone(S, 'botshell') ? botG + (1 - botG) * gSlow : gSlow) : 1; // 耐寒外壳：岗位上的自动机寒潮、永冬潮里不减速

  // 工程站：产出研究点数
  let rp = 0;
  for (const b of bs) {
    if (b.type !== 'workshop') continue;
    const mx = maxWorkers(b.type, b.lvl), staff = mx ? Math.min(1, b.workers * lf / mx) : 0;
    const r = BLD.workshop.research * (1 + 0.25 * (b.lvl - 1)) * staff * workEff * moodMul(camp) * (1 + specOf(S, b) + ((focusOf(camp) || {}).rp || 0) + campSpecFx(S, b, camp) + skillBonus(b));
    const br = R.b[b.id] || (R.b[b.id] = {});
    br.staff = staff; br.rp = r;
    const cur = S.tech && S.tech.cur;
    br.act = cur ? Math.min(1, staff * workEff) : 0;
    br.status = !b.workers ? '배치된 일손 없음' : !cur ? '연구 주제를 기다리는 중' : staff < 0.99 ? '일손 부족' : '연구중';
    if (cur) rp += r;
  }
  cr.rp = rp;
  // 雪橇犬舍：犬夫喂生肉、训狗；喂饱了、人手够，狗才拉得动雪橇
  let dogs = 0, dogFood = 0, dogWant = 0;
  for (const b of bs) {
    if (b.type !== 'kennel') continue;
    const mx = maxWorkers(b.type, b.lvl), staff = mx ? Math.min(1, b.workers * lf / mx) : 0;
    // 没人看的犬舍：狗放出去自己找吃的，不吃营地的生肉，也拉不了雪橇
    const n = kennelDogs(b.lvl) * (staff > 0 ? 1 : 0), need = n * BLD.kennel.feed * dt / 60, have = Math.max(0, st.game || 0);
    const fed = need > 0 ? Math.min(1, have / need) : 1;
    st.game = Math.max(0, (st.game || 0) - need * fed);
    const br = R.b[b.id] || (R.b[b.id] = {});
    br.staff = staff; br.fed = fed; br.dogs = n * staff * fed; br.act = staff * fed;
    br.inRate = { game: n * BLD.kennel.feed * fed }; br.rate = {};
    br.status = !b.workers ? '배치된 일손 없음' : fed < 0.95 ? '누락생고기' : staff < 0.99 ? '일손 부족' : '달리기';
    dogs += br.dogs; dogFood += n * BLD.kennel.feed * fed; dogWant += n * BLD.kennel.feed;
  }
  cr.dogs = dogs; cr.dogFood = dogFood; cr.dogWant = dogWant;
  // 搬运工
  let haulers = 2 + (camp.botH || 0) * BOT.haul * pow / BOT.pow; // 搬运型自动机一台顶两个搬运工
  for (const b of bs) if (b.type === 'warehouse') haulers += b.workers * lf * (1 + specOf(S, b));
  cr.haulBotFr = haulers > 0 ? (camp.botH || 0) * BOT.haul * pow / BOT.pow / haulers : 0;
  const carry = 2 + 0.4 * (fb.lvl - 1);
  const road = camp.road || 0;
  const speed = HAUL_SPEED * (1 + 0.12 * up(S, 'haul') + techSum(S, 'haul') + relicSum(S, 'haul') + 0.2 * road) * (w.blizzard && road < 3 ? 0.6 : 1) * (ev && ev.kind === 'crack' && !evPrep && campIce(S, camp) > 0 ? WXE_CRACK : 1);

  // 第一遍：期望速率与搬运需求
  const plans = [];
  let demand = 0;
  for (const b of bs) {
    const d = bdef(b);
    if (!d.out) continue;
    const mx = bMax(S, b), gth = BLD[b.type].cat === 'gather';
    const staff = mx ? Math.min(1, b.workers * (gth ? lfG : lf) / mx) : 1;
    const syn = R.adj.get(b.id) || 0;
    const bo = R.beltOut.get(b.id), bi = R.beltIn.get(b.id);
    let beltB = 0;
    if (bi && d.in) { const ks = Object.keys(d.in); for (const k of ks) if (bi[k]) beltB += BELT[bi[k]].bonus / ks.length; }
    const mult = levelMul(b.lvl) * (1 + prodBonus(S, b, camp, syn, beltB).sum) * staff * (gth ? effG : workEff) * prodMul * blaze * (ev && ev.kind === 'ice' && gth ? WXE_ICE_GATHER : 1) * (cRule === 'night' && gth ? RULE_FX.nightOut : 1) * ((cold || tide) && gth ? coldSlow : 1);
    const br = R.b[b.id] || (R.b[b.id] = {});
    br.staff = staff;
    if (b.moveT > S.t) { br.act = 0; br.status = '움직이는'; br.haul = 0; br.rate = {}; br.inRate = {}; br.want = {}; br.dep = 0; continue; }
    if (b.hitT > S.t) { br.act = 0; br.status = '운석에 부딪혀 수리 중입니다.'; br.haul = 0; br.rate = {}; br.inRate = {}; br.want = {}; br.dep = 0; continue; }
    if (b.frz > S.t) { br.act = 0; br.status = '언'; br.haul = 0; br.rate = {}; br.inRate = {}; br.want = {}; br.dep = 0; continue; }
    if (b.altT > S.t) { br.act = 0; br.status = '수식 변경'; br.haul = 0; br.rate = {}; br.inRate = {}; br.want = {}; br.dep = 0; continue; }
    if (mult <= 0) { br.act = 0; br.status = b.workers ? '아무도 일하지 않아' : '배치된 일손 없음'; br.haul = 0; continue; }
    const dist = R.dist.get(b.id) || 1;
    let units = 0;
    for (const k in d.out) units += d.out[k] * (bo && bo[k] ? 1 - BELT[bo[k]].cut : 1);
    if (d.in) for (const k in d.in) units += d.in[k] * (bi && bi[k] ? 1 - BELT[bi[k]].cut : 1);
    br.beltB = beltB;
    const perUnit = (2 * dist / speed + 1.5) / carry; // 搬运工·秒 / 件
    const est = (br.avail != null ? br.avail : 1);
    const dem = units / 60 * mult * perUnit * est;
    demand += dem;
    plans.push({ b, d, mult, dem, br, dist });
  }
  // 烽火塔的塔身：搬运工像给加工厂送料一样往塔里送
  const towers = [];
  for (const b of bs) {
    if (!BLD[b.type].tower || !b.tw || b.tw.lit) continue;
    const sp = towerSpec(S, b.tn), feeding = b.tw.p < sp.dur;
    const dem = feeding ? sp.rate * sp.kinds.length / 60 * (2 * (R.dist.get(b.id) || 1) / speed + 1.5) / carry : 0;
    demand += dem; towers.push({ b, sp, dem });
  }
  // 1.1 奇观工地：同样靠搬运工往里送料
  const wons = [];
  for (const b of bs) {
    if (!isWonder(b.type)) continue;
    if (wonderDone(b)) { const br = R.b[b.id] || (R.b[b.id] = {}); br.status = '세워짐'; br.act = 0; br.haul = 0; br.rate = {}; br.inRate = {}; br.want = {}; continue; }
    const dem = wonderDem(S, b, (2 * (R.dist.get(b.id) || 1) / speed + 1.5) / carry);
    demand += dem; wons.push({ b, dem });
  }
  const hf = demand > 0 ? Math.min(1, haulers / demand) : 1;

  // 留给熔炉的那份燃料不拦「造燃料」的链：晶体电池厂要的铁锭、焦煤炉本身（烧煤出更值钱的焦煤）照样能拿，不然燃料越少越造不出燃料
  const fuelFeed = fuelFeedOf(plans);
  // 第二遍：真正生产（上游先算）
  plans.sort((a, b) => (a.d.gather ? 0 : 1) - (b.d.gather ? 0 : 1) || a.d.t - b.d.t || a.b.id - b.b.id);
  for (const p of plans) {
    const { b, d, br } = p;
    let f = p.mult * hf * dt / 60; // 本步“满速分钟数”
    let lim = 1, why = '', whyK = null, deepX = 0, spotShare = 1;
    if (d.gather) {
      const sp = R.gatherSpots.get(b.id) || [];
      let left = 0;
      let young = 0;
      for (const s of sp) { left += harvestLeft(S, s.i); if (isSapling(S, s.i)) young++; }
      const outK = Object.keys(d.out)[0];
      const want = d.out[outK] * f;
      if (left <= 0) { lim = 0; why = young ? ({ tree: '묘목이 자랄 때까지 기다리십시오.', dead: '바람과 눈이 새로운 죽은 나무를 꺼내기를 기다리고 있습니다.', fish: '물고기가 돌아올 때까지 기다리세요' }[SPOT_KEYS[getWorld(S.runSeed).spot[sp.find(q => isSapling(S, q.i)).i]]] || '사냥감이 돌아올 때까지 기다립니다.') : '주변 자원 포인트가 소진되었습니다.'; }
      else if (want > left) lim = left / want;
      // 深井：地表采空后，往下挖还能按三成五的产量一直出（不消耗资源点）
      deepX = b.deep ? Math.max(0, DEEP_RATE - lim) : 0;
      if (deepX > 0) { spotShare = lim / (lim + deepX); lim += deepX; why = DEEP_WHY; } else spotShare = 1;
    }
    const gLim = lim; // 只受资源点限制时的速率（算「想要多少原料」用）
    if (d.in) for (const k in d.in) {
      const need = d.in[k] * f;
      if (need <= 0) continue;
      const fk = fuelFeedFree(d, fuelFeed) ? 0 : fuelKeep(st, k, fuelKeepU), keep = keepOf(camp, k, cap) + fk, have = Math.max(0, (st[k] || 0) - keep);
      if (have < need) { const r = have / need; if (r < lim) { lim = r; why = fk > 0 && (st[k] || 0) > need ? FUEL_KEEP_WHY : keep && (st[k] || 0) >= keep * 0.5 ? KEEP_WHY : `${RES[k].n} 누락됨`; whyK = k; } }
    }
    // 产出满仓则停（开了「满仓自动兑换」就不停，多出来的拿去换）
    let room = 1;
    if (!camp.trade) for (const k in d.out) {
      const add = d.out[k] * f;
      if (add <= 0) continue;
      const r = Math.max(0, cap - (st[k] || 0)) / add;
      if (r < room) room = r;
    }
    if (room < lim) { lim = room; why = '창고가 가득 참'; }
    lim = Math.max(0, Math.min(1, lim));
    br.avail = lim;
    f *= lim;
    if (d.in) for (const k in d.in) st[k] = Math.max(0, (st[k] || 0) - d.in[k] * f);
    for (const k in d.out) {
      const amt = d.out[k] * f * (k === 'food' ? kitMul : 1);
      const s0 = st[k] || 0, over = Math.min(amt, s0 + amt - cap); // 只换新产出里装不下的那份；仓里本来就超出的（拆了仓库、商会买来的）不动
      if (over > 0 && camp.trade) tradeOverflow(S, camp, k, over, cap, cr, d);
      st[k] = Math.max(s0, Math.min(cap, s0 + amt));
      S.stats.prod[k] = (S.stats.prod[k] || 0) + amt;
      (R.made || (R.made = {}))[k] = (R.made[k] || 0) + amt;
      if (d.gather) depleteSpots(S, b, amt * spotShare);
    }
    const wE = BLD[b.type].cat === 'gather' ? effG : workEff;
    br.act = Math.min(1, br.staff * Math.min(1, wE) * hf * lim);
    br.rate = {}; for (const k in d.out) br.rate[k] = d.out[k] * p.mult * hf * lim * (k === 'food' ? kitMul : 1);
    br.dep = d.gather ? d.out[Object.keys(d.out)[0]] * p.mult * hf * lim * spotShare : 0; // 每分钟从资源点上挖走多少
    br.inRate = {}; if (d.in) for (const k in d.in) br.inRate[k] = d.in[k] * p.mult * hf * lim;
    // 想要的原料：只有卡住它的那一种按全速算，其它按实际
    br.want = {}; if (d.in) for (const k in d.in) br.want[k] = k === whyK && (why.startsWith('부족') || why === KEEP_WHY || why === FUEL_KEEP_WHY) ? d.in[k] * p.mult * hf * Math.max(0, Math.min(1, gLim, room)) : br.inRate[k];
    br.haul = p.dem * hf * lim;
    br.dist = p.dist;
    br.status = lim < 0.05 ? why : hf < 0.7 ? '운반꾼 부족' : lim < 0.95 ? why : br.staff < 0.99 ? '일손 부족' : wE < 0.9 ? '너무 추워서 일이 느리다' : '달리기';
    br.deep = deepX > 0;
    if (lim < 0.05 && why.startsWith('부족')) { if (br.stop0 == null) br.stop0 = S.t; } else br.stop0 = null; // 缺料停了多久（老向导提替代配方用）
  }

  { const offK = R.offline && R.histOff ? R.histOff.rate : 1; // 离线时塔身按离线收益的比例吃货、长进度
    for (const t of towers) { towerFeed(S, t.b, t.sp, dt, hf, offK, st, R, t.dem, fuelKeepU); plans.push({ b: t.b, d: BLD[t.b.type], br: R.b[t.b.id], mult: 0, dem: t.dem }); }
    for (const t of wons) { wonderFeed(S, t.b, dt, hf, offK, st, R, t.dem, fuelKeepU); plans.push({ b: t.b, d: BLD[t.b.type], br: R.b[t.b.id], mult: 0, dem: t.dem }); } }
  skillStep(S, camp, bs, dt);
  // 空闲的人会在营地附近拾柴、设陷阱（保证任何时候都能慢慢恢复）
  let stalled = 0;
  for (const p of plans) stalled += p.b.workers * lf * (1 - (p.br.avail != null ? p.br.avail : 1));
  const idle = Math.max(0, camp.people - Math.min(camp.people, assigned)) + Math.min(camp.people, stalled);
  const forage = w.blizzard ? 0 : idle * workEff / 60 * dt;
  st.wood = Math.max(st.wood || 0, Math.min(cap, (st.wood || 0) + forage * 0.35));
  if (tierOfRow(camp.y) >= 2) st.coal = Math.max(st.coal || 0, Math.min(cap, (st.coal || 0) + forage * 0.15)); // 北方地表能捡到煤块
  st.game = Math.max(st.game || 0, Math.min(cap, (st.game || 0) + forage * 0.12));
  st.stone = Math.max(st.stone || 0, Math.min(cap, (st.stone || 0) + forage * 0.06));
  cr.forage = idle;
  // 吃饭
  const eatMul = Math.max(0.3, 1 + lawSum(S, 'food') + techSum(S, 'eat')) * diffOf(S).eat;
  const needFood = camp.people * EAT * eatMul / 60 * dt;
  let eaten = Math.min(st.food || 0, needFood);
  st.food = (st.food || 0) - eaten;
  let short = needFood - eaten;
  let gameEaten = 0;
  if (short > 0 && (st.game || 0) > 0) { const g = Math.min(st.game, short * 2); st.game -= g; short -= g / 2; gameEaten = g; }
  const hunger = needFood > 0 ? Math.max(0, short / needFood) : 0;

  // 死亡（冻、饿），永不全灭
  const sevH = Math.max(0, -tH), sevU = Math.max(0, -tU);
  const deathRate = (housed * 0.0003 * sevH + unhoused * 0.0003 * sevU + camp.people * 0.005 * hunger) / 60;
  camp.deathAcc += deathRate * dt;
  if (deathRate === 0) camp.deathAcc = Math.max(0, camp.deathAcc - dt / 600);
  while (camp.deathAcc >= 1) {
    camp.deathAcc -= 1;
    if (camp.people <= MIN_PEOPLE) { camp.deathAcc = 0; break; }
    camp.people--; S.stats.deaths++; bumpMood(camp, -2, 1);
    trimWorkers(S, camp);
    R.fx.push({ kind: 'death', camp: camp.id });
    logMsg(S, `"${camp.name}" 누군가가 성공하지 못했습니다(${hunger > 0.05 ? '굶주림' : '심한 감기'}).`, 'bad');
  }
  // 新人投奔
  const free = Math.min(housing, popCap(S, camp)) - camp.people - away - (camp.wait || 0);
  // 自己运转的补给站：来了人火就得烧旺一档，攒够半小时的燃料才收人，免得人一多燃料跟不上又冻死一批
  const depotFuelOk = !depotAuto(camp) || fuelUnitsOf(st) >= furnaceBurn(Math.min(fb.lvl, Math.ceil((camp.people + 1 - 12) / 6) + 1)) * 30;
  const canArrive = free >= 1 && (cr.foodNet == null || cr.foodNet >= EAT * 1.5) && (st.food || 0) > camp.people * EAT * 30 && tH >= -2 && !w.blizzard && hunger === 0 && depotFuelOk;
  if (canArrive) {
    camp.arriveAcc += (0.12 + 0.03 * fb.lvl) * (camp.people < 20 ? 3 : 1) * (1 + 0.15 * up(S, 'people') + ((focusOf(camp) || {}).arrive || 0)) * (0.7 + 0.6 * (camp.hope ?? 50) / 100) / 60 * dt; // 开局人少时来得快；希望越高来得越快
    while (camp.arriveAcc >= 1 && camp.people + away < Math.min(housing, popCap(S, camp))) {
      camp.arriveAcc -= 1; camp.people++; S.stats.arrivals++;
      R.fx.push({ kind: 'arrive', camp: camp.id });
    }
  } else if (camp.people < 10 && free >= 1 && !w.blizzard && hunger === 0 && tH >= -2 && (st.food || 0) > (camp.people + 1) * EAT * 20) {
    // 营地快撑不住时，附近流浪的人仍会被火光吸引过来（保证总能恢复）；没吃的、屋里太冷都不来，免得来一个饿死（冻死）一个
    camp.arriveAcc += dt / 600;
    while (camp.arriveAcc >= 1) { camp.arriveAcc -= 1; camp.people++; S.stats.arrivals++; R.fx.push({ kind: 'arrive', camp: camp.id }); }
  } else camp.arriveAcc = Math.min(camp.arriveAcc, 0.9);

  let foodMade = 0;
  for (const p of plans) if (p.br.rate && p.br.rate.food) foodMade += p.br.rate.food;
  // 物资流水（每分钟）：产出、消耗、想要的消耗（全速时）——给「物资」面板找瓶颈用
  const flow = {}, F = k => flow[k] || (flow[k] = { p: 0, c: 0, want: 0 });
  for (const p of plans) {
    for (const k in p.br.rate || {}) F(k).p += p.br.rate[k];
    for (const k in p.br.inRate || {}) F(k).c += p.br.inRate[k];
    for (const k in p.br.want || {}) F(k).want += p.br.want[k];
  }
  const perMin = 60 / Math.max(1e-6, dt), fpm = forage * perMin;
  F('wood').p += fpm * 0.35; F('game').p += fpm * 0.12; F('stone').p += fpm * 0.06; if (tierOfRow(camp.y) >= 2) F('coal').p += fpm * 0.15;
  for (const k in burned) { F(k).c += burned[k] * perMin; }
  const fuelWant = furnaceBurn(depotFireLvl(S, camp, fb));
  for (const k in burned) F(k).want += burned[k] * perMin;
  if (fueled < 1) F('wood').want += fuelWant * (1 - fueled) / FUEL.wood; // 断燃：按木材算缺口
  F('food').c += eaten * perMin; F('food').want += needFood * perMin;
  if (gameEaten) F('game').c += gameEaten * perMin;
  if (cr.dogWant) { F('game').c += cr.dogFood; F('game').want += cr.dogWant; }
  if (heaters.length) { F('coal').c += heaterCoal * perMin; F('coal').want += heaterWant * perMin; }
  for (const k in flow) for (const q of ['p', 'c', 'want']) flow[k][q] = Math.round(flow[k][q] * 100) / 100;
  cr.flow = flow;
  cr.foodNet = foodMade + (cr.forage || 0) * 0.12 / 2 - camp.people * EAT * eatMul;
  Object.assign(cr, {
    temp, tH, tU, heat, fueled, drop, burnPerMin: dt > 0 ? fuelNeed / dt * 60 : furnaceBurn(depotFireLvl(S, camp, fb)), baseBurn: dt > 0 ? fuelNeed / dt * 60 / (od ? OD_FUEL : 1) : furnaceBurn(depotFireLvl(S, camp, fb)), fuelUnits: fuelUnitsOf(st),
    od, odHeat, stall,
    housing, housed, ins, labor, assigned, haulers, demand, hf, workEff, hunger, cap, sick: sickN,
    eatPerMin: camp.people * EAT * eatMul, foodPerMin: 0, botCap,
  });
  moodStep(S, camp, cr, dt);
}
// 满仓兑换：多出来的物资按价值打三折，换成营地最缺的同级或更低级物资
export const TRADE_EFF = 0.3;
export function resValue(k) { const r = RES[k]; return Math.pow(3, r.t - 1) * (r.raw ? 1 : 2.5); }
function tradeOverflow(S, camp, k, over, cap, cr, d) {
  const st = camp.stock, t0 = RES[k].t, flow = cr.flow || {};
  const used = new Set(['food']);
  for (const b of S.buildings) if (b.camp === camp.id && bdef(b).in) for (const q in bdef(b).in) used.add(q);
  for (const f in FUEL) if (RES[f].t <= S.known) used.add(f);
  // 先换「有建筑在等」的，缺得越多越优先；没有在等的，就换库存不到一半的
  let best = null, bs = 0, br = 0.5;
  for (const q of used) {
    if (q === k || RES[q].t > t0 || RES[q].t > S.known || (d.in && d.in[q])) continue;
    const f = flow[q], gap = f ? f.want - f.c : 0, r = (st[q] || 0) / cap;
    if (r >= 0.95) continue;
    if (gap > bs) { bs = gap; best = q; }
    else if (!bs && r < br) { br = r; best = q; }
  }
  if (!best) return;
  const gain = Math.min(cap - (st[best] || 0), over * resValue(k) / resValue(best) * TRADE_EFF);
  if (gain <= 0) return;
  st[best] = (st[best] || 0) + gain;
  const tl = cr.trade || (cr.trade = {});
  const key = k + '>' + best;
  tl[key] = (tl[key] || 0) + gain;
}
export function fuelUnitsOf(st) { let u = 0; for (const f in FUEL) u += (st[f] || 0) * FUEL[f]; return u; }
export function trimWorkers(S, camp) {
  let over = assignedWorkers(S, camp.id) - (camp.people + botUnits(S, camp));
  if (over <= 0) return;
  const bs = S.buildings.filter(b => b.camp === camp.id && b.workers > 0).sort((a, b) => autoPr(b.type) - autoPr(a.type));
  for (const b of bs) { if (over <= 0) break; const k = Math.min(b.workers, over); b.workers -= k; over -= k; }
}
function depleteSpots(S, b, amt) {
  const sp = rt(S).gatherSpots.get(b.id) || [];
  for (const s of sp) {
    if (amt <= 0) break;
    const left = harvestLeft(S, s.i);
    if (left <= 0) continue;
    const take = Math.min(left, amt);
    S.spots[s.i] = left - take;
    amt -= take;
    if (left - take <= 0.001) {
      S.spots[s.i] = 0; rt(S).spotsDirty = true; dirty(S);
      if (REGROW[SPOT_KEYS[getWorld(S.runSeed).spot[s.i]]]) (S.sap || (S.sap = {}))[s.i] = 1;
    }
  }
  rt(S).spotTouched = true;
}

// 林木和猎物会恢复（矿物不会）。伐木场会补种、猎人小屋会留种，范围里的长得快得多
export const REGROW = { tree: 1, herd: 0.5, dead: 1.5, fish: 1 }, TEND = { tree: 4, herd: 3, dead: 3, fish: 3 }; // 枯木堆砍完，风雪过一阵又刮出来一堆
const TEND_BY = { lumber: 'tree', hunter: 'herd', icefish: 'fish' };
export function tendedSpots(S) {
  const R = rebuild(S), out = new Set();
  for (const b of S.buildings) if (TEND_BY[b.type]) for (const s of R.gatherSpots.get(b.id) || []) out.add(s.i);
  return out;
}
export function regrowRate(S, i, tended) {
  const key = SPOT_KEYS[getWorld(S.runSeed).spot[i]], g = REGROW[key];
  if (!g) return 0;
  return g * (tended && tended.has(i) ? TEND[key] : 1) * (1 + 0.15 * up(S, 'reserve'));
}
function regrow(S, dt) {
  const w = getWorld(S.runSeed);
  const R = rt(S);
  R.regrowAcc = (R.regrowAcc || 0) + dt;
  if (R.regrowAcc < 30) return;
  const t = R.regrowAcc; R.regrowAcc = 0;
  const occ = rebuild(S).occ, tended = tendedSpots(S), sap = S.sap || (S.sap = {});
  let touched = false;
  for (const k in S.spots) {
    if (!REGROW[SPOT_KEYS[w.spot[k]]]) continue;
    if (occ[k] || R.beltOcc.has(+k)) continue; // 压在建筑、传送带下面的不会再长
    const mx = spotMax(S, +k);
    const v = S.spots[k];
    if (v >= mx) { delete S.spots[k]; delete sap[k]; continue; }
    const nv = Math.min(mx, v + regrowRate(S, +k, tended) * t / 60);
    if (v <= 0 && nv > 0) R.spotsDirty = true;
    if (sap[k] && nv >= mx * SAP_RIPE) { delete sap[k]; R.spotsDirty = true; }
    S.spots[k] = nv; touched = true;
  }
  if (touched) R.spotTouched = true;
}

// ---------- 雪橇犬 ----------
// 雪橇犬：每只狗让本营地的侦察队快 5%（最多 +60%），让连着的路多运 3%（最多 +45%，铁路减半；见 net.js roadDogs）
export function kennelDogs(lvl) { return BLD.kennel.dogs + 2 * (lvl - 1); }
export function dogsOf(S, cid) { return (rt(S).c[cid] || {}).dogs || 0; }
export function dogScout(S, cid) { return Math.min(0.6, 0.05 * dogsOf(S, cid)); }

// ---------- 侦察与救援 ----------
export function scoutSlots(S, cid) {
  let n = 0, best = 0;
  for (const b of S.buildings) if (b.camp === cid && b.type === 'scout') { n += 1 + Math.floor(b.lvl / 3); best = Math.max(best, b.lvl); }
  return { n, lvl: best, used: S.scouts.filter(s => s.camp === cid).length };
}
export function scoutRange(S, cid) { const sl = scoutSlots(S, cid); return sl.n ? Math.round((22 + 8 * sl.lvl + 3 * up(S, 'sight')) * (1 + relicSum(S, 'sight'))) : 0; }
export function scoutCost(S, cid, tx, ty, kind = 'scout') {
  const c = getCamp(S, cid);
  const d = Math.hypot(tx - c.x, ty - c.y);
  return kind === 'rescue'
    ? { food: Math.round(20 + d * 0.6), wood: Math.round(15 + d * 0.3) }
    : { food: Math.round(10 + d * 0.4), wood: Math.round(10 + d * 0.25) };
}
export function sendScout(S, cid, tx, ty, kind = 'scout', poiId = null) {
  const c = getCamp(S, cid);
  const sl = scoutSlots(S, cid);
  if (!sl.n) return { ok: false, reason: '먼저 정찰 막사를 구축하세요' };
  if (sl.used >= sl.n) return { ok: false, reason: '정찰대는 모두 아웃되었으며 업그레이드정찰 막사는 추가 팀을 보낼 수 있습니다' };
  const range = scoutRange(S, cid);
  if (Math.hypot(tx + 0.5 - c.x, ty + 0.5 - c.y) > range) return { ok: false, reason: `너무 멀다: 정찰 막사 ${sl.lvl} 레벨은 ${range} 정사각형, 업그레이드정찰 막사로만 이동하거나 야영지를 더 북쪽으로 건설할 수 있습니다.` };
  const n = kind === 'rescue' ? 4 : 3;
  if (c.people - n < MIN_PEOPLE) return { ok: false, reason: '야영지사람이 너무 적어요' };
  const cost = scoutCost(S, cid, tx, ty, kind);
  if (!canAfford(c.stock, cost)) return { ok: false, reason: '부족: ' + missing(c.stock, cost).join(',') };
  pay(c.stock, cost);
  c.people -= n;
  trimWorkers(S, c); // 人手不够时从次要岗位上抽人
  S.scouts.push({ id: S.nextId++, camp: cid, kind, poi: poiId, x: c.x, y: c.y, tx: Math.max(0, Math.min(W - 1, tx)), ty: Math.max(0, Math.min(H - 1, ty)), phase: 'out', n, carry: { people: 0, loot: {}, spec: null } });
  return { ok: true };
}
// ---------- 矿挖完的出路：深井 + 勘探新矿脉 ----------
export const DEEP_RATE = 0.35, DEEP_WHY = '심정 운영 진행 중';
// 能挖深井的：矿和碎石（会长回来的树林、猎场不用）
export function deepable(type) { const d = BLD[type]; return !!(d.gather && !d.gather.some(k => REGROW[k])); }
export function gatherLeftFrac(S, b) {
  const sp = rebuild(S).gatherSpots.get(b.id) || [];
  let left = 0, mx = 0;
  for (const s of sp) { left += harvestLeft(S, s.i); mx += spotMax(S, s.i); }
  return mx > 0 ? left / mx : 0;
}
export function deepCost(S, b) {
  const out = {};
  for (const k in BLD[b.type].cost) out[k] = Math.round(BLD[b.type].cost[k] * 1.5 * thrift(S));
  return out;
}
export function deepBlock(S, b) {
  if (!deepable(b.type)) return '광산과 채석장만이 깊은 우물을 파낼 수 있습니다.';
  if (b.deep) return '이미 깊은 우물이야';
  if (gatherLeftFrac(S, b) > 0.25) return '근처에는 아직 광산이 많고, 깊은 우물을 파는 데는 1/4도 채 남지 않았습니다.';
  const c = getCamp(S, b.camp);
  if (!canAfford(c.stock, deepCost(S, b))) return '부족: ' + missing(c.stock, deepCost(S, b)).join(',');
  return '';
}
export function digDeep(S, id) {
  const b = getB(S, id); if (!b) return { ok: false, reason: '건물이 없어졌어요' };
  const why = deepBlock(S, b); if (why) return { ok: false, reason: why };
  pay(getCamp(S, b.camp).stock, deepCost(S, b));
  b.deep = 1; dirty(S);
  logMsg(S, `"${getCamp(S, b.camp).name}"의 ${BLD[b.type].n}이(가) 깊은 우물에 파졌습니다. 표면이 채굴된 후에도 여전히 35% 생산량으로 파낼 수 있습니다.`, 'good');
  return { ok: true };
}

// ---------- 矿点保护（第十三版）：挖完之前提醒、摆放时不把矿挡住、快挖完时勘探保底 ----------
const isOre = k => !REGROW[k] && !CLEARABLE[k];
const GT = {};
export function gatherTypeFor(kind) { return GT[kind] !== undefined ? GT[kind] : (GT[kind] = Object.keys(BLD).find(t => BLD[t].gather && BLD[t].gather.includes(kind)) || null); }
// 一栋采集建筑（连同和它挖同一片矿的同类建筑）按现在的速度还能挖多久，单位是游戏分钟；挖不动、会长回来的返回 null
export function gatherEta(S, b) {
  const d = BLD[b.type]; if (!d.gather || d.gather.some(k => REGROW[k])) return null;
  const R = rebuild(S), set = new Set((R.gatherSpots.get(b.id) || []).map(s => s.i));
  let left = 0; for (const i of set) left += harvestLeft(S, i);
  if (left <= 0) return 0;
  let dep = 0;
  for (const o of S.buildings) {
    if (o.type !== b.type) continue;
    if (o.id !== b.id && !(R.gatherSpots.get(o.id) || []).some(s => set.has(s.i))) continue;
    dep += (rt(S).b[o.id] || {}).dep || 0;
  }
  return dep > 1e-6 ? left / dep : null;
}
// 已经有采集建筑在挖的资源点
export function servedSpots(S) { const out = new Set(); for (const [, sp] of rebuild(S).gatherSpots) for (const p of sp) out.add(p.i); return out; }
// 正在挖这处资源点的建筑
export function minerOf(S, i) { const R = rebuild(S); return S.buildings.find(b => (R.gatherSpots.get(b.id) || []).some(p => p.i === i)) || null; }
// 一座营地暖圈里（加上已有采集建筑够得着的地方）每种矿还剩多少：{ kind: { left, max, frac, dep, deep, b } }
export function oreScan(S, camp) {
  const w = getWorld(S.runSeed), R = rebuild(S), out = {}, kinds = {};
  for (const b of S.buildings) {
    if (b.camp !== camp.id || !BLD[b.type].gather) continue;
    for (const k of BLD[b.type].gather) if (isOre(k)) {
      const o = kinds[k] || (kinds[k] = { deep: true, dep: 0, b: b.id, set: new Set() });
      o.deep = o.deep && !!b.deep; o.dep += (rt(S).b[b.id] || {}).dep || 0;
      for (const sp of R.gatherSpots.get(b.id) || []) o.set.add(sp.i);
    }
  }
  if (!Object.keys(kinds).length) return out;
  const r = heatRadius(S, camp);
  for (let y = Math.floor(camp.y - r); y <= camp.y + r; y++) for (let x = Math.floor(camp.x - r); x <= camp.x + r; x++) {
    if (!inMap(x, y) || (x + 0.5 - camp.x) ** 2 + (y + 0.5 - camp.y) ** 2 > r * r) continue;
    const i = idx(x, y), sk = w.spot[i];
    if (sk >= 0 && S.reveal[i] && kinds[SPOT_KEYS[sk]]) kinds[SPOT_KEYS[sk]].set.add(i);
  }
  for (const k in kinds) {
    const o = kinds[k]; let left = 0, max = 0;
    for (const i of o.set) { if (SPOT_KEYS[w.spot[i]] !== k) continue; left += spotLeft(S, i); max += spotMax(S, i); }
    out[k] = { left, max, frac: max > 0 ? left / max : 0, dep: o.dep, deep: o.deep, b: o.b, eta: o.dep > 1e-6 ? left / o.dep : null };
  }
  return out;
}
export const ORE_WARN = 0.2, ORE_URGENT = 0.05;
// 每 15 秒看一次：剩不到两成在日志里提醒一次（补上矿以后重新算）
function oreStep(S, dt) {
  const R = rt(S);
  R.oreAcc = (R.oreAcc || 0) + dt;
  if (R.oreAcc < 15) return;
  R.oreAcc = 0;
  for (const c of S.camps) {
    if (depotAuto(c)) continue;
    const ore = oreScan(S, c), cr = R.c[c.id] || (R.c[c.id] = {});
    cr.ore = ore;
    const W0 = c.oreWarn || (c.oreWarn = {});
    for (const k in ore) {
      const o = ore[k];
      if (o.frac > 0.3) { delete W0[k]; continue; }
      if (o.frac >= ORE_WARN || o.deep || W0[k]) continue;
      W0[k] = 1;
      const t = gatherTypeFor(k);
      logMsg(S, `「${c.name}"난방권에서${SPOTS[k].n}오직${Math.max(1, Math.round(o.frac * 100))}% 위로${o.eta != null ? `, 현재 속도로 우리는 여전히 약을 채굴할 수 있습니다${Math.max(1, Math.round(o.eta))}분` : ''}. 줄 수 있다${t ? BLD[t].n : '내 거'}깊은 우물을 파거나(생산량의 35%는 파낸 후에도 여전히 사용 가능) 탐사팀을 보내 새로운 광맥을 찾으십시오(이 경우 최저 가격이 적용됩니다).`, 'warn');
    }
  }
}
export function oreInfo(S, camp, k) { return ((((rt(S).c[camp.id] || {}).ore) || {})[k]) || null; }
// 快挖完、又正在用的矿：勘探时排第一个、按最低价
export function oreLow(S, camp, k) {
  const o = (((rt(S).c[camp.id] || {}).ore) || {})[k];
  return !!o && o.frac < ORE_WARN && !o.deep;
}
// 这处矿旁边还放不放得下它的采集建筑（avoid：当作已经被占掉的格子）
function oreRoom(S, i, cid, avoid) {
  const k = SPOT_KEYS[getWorld(S.runSeed).spot[i]], type = gatherTypeFor(k); if (!type) return false;
  return veinRoom(S, type, [{ i, x: i % W, y: Math.floor(i / W) }], cid, avoid);
}
// 摆放预演：放在 (x, y) 会不会占掉某处矿旁边最后的采集位。返回被挡住的矿的名字（没有就是空数组）
export function blocksOre(S, type, x, y, cid) {
  const R = rt(S), key = `${type}:${x}:${y}:${cid}:${S.buildings.length}:${S.lay || 0}:${(S.queue || []).length}:${R.revealN || 0}`;
  if (R.boKey === key) return R.boVal;
  const w = getWorld(S.runSeed), s = BLD[type].size, foot = [];
  for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) if (inMap(xx, yy)) foot.push(idx(xx, yy));
  const own = new Set(BLD[type].gather ? findSpots(S, type, x, y).map(p => p.i) : []);
  const served = servedSpots(S);
  const out = new Set(), M = 6;
  for (let yy = y - M; yy < y + s + M; yy++) for (let xx = x - M; xx < x + s + M; xx++) {
    if (!inMap(xx, yy)) continue;
    const i = idx(xx, yy), sk = w.spot[i]; if (sk < 0) continue;
    const k = SPOT_KEYS[sk];
    if (!isOre(k) || !S.reveal[i] || spotLeft(S, i) <= 0 || served.has(i) || own.has(i) || out.has(SPOTS[k].n)) continue;
    const t = gatherTypeFor(k); if (!t || !unlocked(S, t)) continue;
    if (warmCampAt(S, xx, yy) !== cid) continue;
    if (oreRoom(S, i, cid, [i]) && !oreRoom(S, i, cid, [i, ...foot])) out.add(SPOTS[k].n);
  }
  R.boKey = key; R.boVal = [...out];
  return R.boVal;
}

// 勘探：从侦察营派三个人，在供热圈里找出埋得深的新矿脉（每次两处，越勘越贵）
export const SURVEY_N = 3;
function surveyKinds(S, camp) {
  // 这个纬度有、又不会长回来的矿；最缺的排前面
  const cr = rt(S).c[camp.id] || {}, flow = cr.flow || {};
  const ks = SPOT_KEYS.filter(k => !REGROW[k] && SPOTS[k].from <= camp.y);
  const gap = k => { const f = flow[SPOTS[k].res]; return f ? Math.max(0, f.want - f.p) : 0; };
  const has = k => S.buildings.some(b => b.camp === camp.id && BLD[b.type].gather && BLD[b.type].gather.includes(k));
  const low = k => (has(k) && oreLow(S, camp, k) ? 1 : 0); // 快挖完又正在挖的矿排最前面
  return ks.sort((a, b) => low(b) - low(a) || gap(b) - gap(a) || (has(b) ? 1 : 0) - (has(a) ? 1 : 0) || SPOTS[b].from - SPOTS[a].from);
}
// 勘探的是快挖完的矿：按第一次的价钱（不随次数涨）
export function surveyNext(S, camp) { return surveyKinds(S, camp)[0] || null; }
export function surveyCheap(S, camp) { const k = surveyKinds(S, camp)[0]; return !!k && oreLow(S, camp, k) && S.buildings.some(b => b.camp === camp.id && BLD[b.type].gather && BLD[b.type].gather.includes(k)); }
export function surveyCost(S, camp) {
  const n = surveyCheap(S, camp) ? 0 : camp.surveys || 0, m = Math.pow(1.5, n) * thrift(S), t = tierOfRow(camp.y);
  const out = { food: Math.round(60 * m), plank: Math.round(40 * m) };
  if (t >= 3) out.steel = Math.round(15 * m);
  return out;
}
function veinSpot(S, camp, salt) {
  const w = getWorld(S.runSeed), occ = rebuild(S).occ, r = heatRadius(S, camp) - 0.6;
  const cands = [];
  for (let y = Math.floor(camp.y - r); y <= camp.y + r; y++) for (let x = Math.floor(camp.x - r); x <= camp.x + r; x++) {
    if (!inMap(x, y) || x < 1 || x > W - 2) continue;
    const d = Math.hypot(x + 0.5 - camp.x, y + 0.5 - camp.y);
    if (d > r || d < 3.2) continue;
    const i = idx(x, y);
    if (w.terrain[i] !== T_SNOW || w.spot[i] >= 0 || !S.reveal[i] || landmarkBlock(x, y, S) || siteAt(S, x, y, 1)) continue;
    let near = false; // 离建筑至少隔一格，旁边还能放采集建筑
    for (let yy = y - 1; yy <= y + 1 && !near; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (inMap(xx, yy) && occ[idx(xx, yy)]) { near = true; break; }
    if (near) continue;
    cands.push({ i, x, y, h: hash3(i, salt, S.runSeed) });
  }
  cands.sort((a, b) => a.h - b.h);
  return cands;
}
// 矿脉旁边得放得下对应的矿场（不压矿脉、在同一个营地的供热圈里）
function fitsAt(S, s, x, y, cid, avoid) {
  const w = getWorld(S.runSeed);
  for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) {
    if (!inMap(xx, yy)) return false;
    const i = idx(xx, yy);
    if (avoid.includes(i) || !S.reveal[i] || w.terrain[i] !== T_SNOW) return false;
    if (w.spot[i] >= 0 && spotLeft(S, i) > 0 && !CLEARABLE[SPOT_KEYS[w.spot[i]]]) return false;
    if (occAt(S, xx, yy) || landmarkBlock(xx, yy, S) || siteAt(S, xx, yy, 1) || caravanAt(S, xx, yy)) return false;
    if (warmCampAt(S, xx, yy) !== cid) return false;
  }
  return true;
}
function veinRoom(S, type, tiles, cid, avoid) {
  const d = BLD[type], s = d.size, r = d.reach + s / 2;
  avoid ||= tiles.map(t => t.i);
  for (const t of tiles) for (let y = Math.floor(t.y - r - s); y <= t.y + r; y++) for (let x = Math.floor(t.x - r - s); x <= t.x + r; x++) {
    if (Math.hypot(t.x + 0.5 - x - s / 2, t.y + 0.5 - y - s / 2) > r) continue;
    if (fitsAt(S, s, x, y, cid, avoid)) return true;
  }
  return false;
}
// 选矿脉：两处挨着、旁边放得下矿场；实在找不到成对的就一处
function surveyPick(S, camp) {
  const R = rt(S), key = `${camp.id}:${camp.surveys || 0}:${S.nextId}:${Math.floor(S.t / 30)}`;
  R.svPick ||= {};
  const hit = R.svPick[camp.id];
  if (hit && hit.key === key) return hit.v;
  let v = null;
  const kind = surveyKinds(S, camp)[0];
  if (kind) {
    const type = Object.keys(BLD).find(t => BLD[t].gather && BLD[t].gather.includes(kind));
    const cs = veinSpot(S, camp, 7000 + (camp.surveys || 0) * 13 + camp.id);
    const near = (a, b, n) => a.i !== b.i && Math.abs(a.x - b.x) <= n && Math.abs(a.y - b.y) <= n;
    for (const c of cs.slice(0, 60)) {
      const c2 = cs.find(q => near(q, c, 1)) || cs.find(q => near(q, c, 2));
      const tiles = c2 ? [c, c2] : [c];
      if (!veinRoom(S, type, tiles, camp.id)) continue;
      if (c2) { v = { kind, tiles }; break; }
      v ||= { kind, tiles };
    }
  }
  R.svPick[camp.id] = { key, v };
  return v;
}
export function surveyBlock(S, camp) {
  const sl = scoutSlots(S, camp.id);
  if (!sl.n) return '먼저 이 야영지에 정찰 막사를 빌드하세요.';
  if (S.scouts.some(s => s.camp === camp.id && s.kind === 'survey')) return '탐사팀은 이미 출발했어요';
  if (sl.used >= sl.n) return '정찰대는 모두 나가서 그들이 돌아오기를 기다리고 있다';
  if (camp.people - SURVEY_N < MIN_PEOPLE) return '야영지사람이 너무 적어요';
  if (!surveyKinds(S, camp).length) return '이곳에서는 탐사할 수 있는 광산이 없습니다.';
  if (!surveyPick(S, camp)) return '난방권, 업그레이드용광로 또는 파이프라인 확장 난방권에 새로운 광산을 위한 공간이 없습니다.';
  const cost = surveyCost(S, camp);
  if (!canAfford(camp.stock, cost)) return '부족: ' + missing(camp.stock, cost).join(',');
  return '';
}
export function startSurvey(S, cid) {
  const camp = getCamp(S, cid); if (!camp) return { ok: false, reason: '야영지가 사라짐' };
  const why = surveyBlock(S, camp); if (why) return { ok: false, reason: why };
  pay(camp.stock, surveyCost(S, camp));
  const pk = surveyPick(S, camp), kind = pk.kind, [c, c2] = pk.tiles;
  camp.people -= SURVEY_N; trimWorkers(S, camp);
  camp.surveys = (camp.surveys || 0) + 1;
  S.scouts.push({ id: S.nextId++, camp: cid, kind: 'survey', x: camp.x, y: camp.y, tx: c.x, ty: c.y, phase: 'out', n: SURVEY_N, carry: { people: 0, loot: {}, spec: null }, vein: { k: kind, at: [c.i, ...(c2 ? [c2.i] : [])] } });
  logMsg(S, `탐사팀은 "${camp.name}" 난방권에서 ${SPOTS[kind].n}을(를) 찾기 위해 출발했습니다.`);
  return { ok: true, kind };
}
// 找到的矿脉记在存档里，读档时补进地图
export function applyVeins(S) {
  if (!S.veins || !S.veins.length) return;
  const w = getWorld(S.runSeed);
  for (const v of S.veins) { const k = SPOT_KEYS.indexOf(v.k); if (w.spot[v.i] !== k) { w.spot[v.i] = k; w.spotInit[v.i] = v.init; } }
}
function foundVein(S, s) {
  const camp = getCamp(S, s.camp), v = s.vein, R = rt(S);
  const w = getWorld(S.runSeed), occ = rebuild(S).occ;
  const got = [];
  for (const i of v.at) {
    if (w.spot[i] >= 0 || occ[i] || w.terrain[i] !== T_SNOW) continue; // 走的路上被盖了房子
    const y = Math.floor(i / W), init = Math.round(SPOTS[v.k].reserve * (1 + y / 160) * 0.8);
    (S.veins || (S.veins = [])).push({ i, k: v.k, init });
    got.push(i);
  }
  applyVeins(S);
  if (got.length) {
    R.veinsDirty = true; dirty(S);
    logMsg(S, `탐사팀이 "${camp.name}"에서 ${got.length} 깊이 묻혀 있는 ${SPOTS[v.k].n}을 발굴했습니다! 채굴하려면 옆에 ${BLD[Object.keys(BLD).find(t => BLD[t].gather && BLD[t].gather.includes(v.k))].n}을(를) 건설하세요.`, 'good');
    R.fx.push({ kind: 'vein', camp: camp.id, i: got[0] });
  } else logMsg(S, `탐사대가 그곳에 도착했지만 그곳에는 집이 지어져 있어 빈손으로 돌아와야 했다.`, 'warn');
}

function scoutsStep(S, dt) {
  if (!S.scouts.length) return;
  const w = getWorld(S.runSeed);
  const R = rt(S);
  const we = wxeAt(S, S.t), crackSlow = we.on && we.ev.kind === 'crack' ? WXE_SLOW : 1; // 冰湖开裂：侦察队绕路
  for (const s of S.scouts.slice()) {
    if (s.phase === 'wait') continue; // 探险队在地点旁等玩家决定
    const sl = scoutSlots(S, s.camp);
    const lodge = S.buildings.find(b => b.camp === s.camp && b.type === 'scout');
    const spd = SCOUT_SPEED * (1 + 0.12 * up(S, 'haul') + techSum(S, 'scout')) * (1 + (lodge ? specOf(S, lodge) : 0)) * (1 + dogScout(S, s.camp)) * (weatherAt(S, S.t).blizzard ? 0.5 : 1) * crackSlow;
    const home = getCamp(S, s.camp);
    const tx = s.phase === 'out' ? s.tx + 0.5 : home.x, ty = s.phase === 'out' ? s.ty + 0.5 : home.y;
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
    const mv = spd * dt;
    if (d > mv) {
      const rr = 2 + up(S, 'sight'), n = s.phase === 'out' ? Math.max(1, Math.ceil(mv / rr)) : 0; // 一步走得远（离线追赶、侦察所等级高）：沿路每隔一个揭雾半径揭一次，不留空档
      for (let k = 1; k <= n; k++) revealCircle(S, s.x + dx / d * mv * k / n, s.y + dy / d * mv * k / n, rr);
      s.x += dx / d * mv; s.y += dy / d * mv; continue;
    }
    s.x = tx; s.y = ty;
    if (s.phase === 'out' && s.kind === 'survey') { foundVein(S, s); s.phase = 'back'; continue; }
    if (s.phase === 'out') {
      const r = 5 + up(S, 'sight');
      revealCircle(S, s.x, s.y, r);
      // 风险：越冷越危险
      const risk = coldRisk(S, s.camp, s.ty);
      const risk2 = s.kind === 'exp' ? expRiskOf(risk, s.sup) : risk;
      if (hash3(s.id, 991, S.runSeed) < risk2) { s.n--; S.stats.deaths++; logMsg(S, `${s.kind === 'rescue' ? '구조팀' : s.kind === 'exp' ? '탐험대 회원' : '정찰 군인'} 하나가 영하의 추위 속에서 실종되었습니다. ${s.kind === 'exp' && s.sup !== 'full' ? '준비물을 너무 적게 가져왔습니다.' : ''}`, 'bad'); }
      if (s.kind === 'exp') {
        const p = (w.sites || []).find(q => q.id === s.poi);
        s.phase = 'wait'; s.waitAt = S.t;
        logMsg(S, `탐험대가 "${p ? SITES[p.kind].n : '목적지'}"에 도착하여 귀하가 무엇을 할지 결정하기를 기다리고 있습니다.`, 'story');
        R.fx.push({ kind: 'exp', id: s.id });
        continue;
      }
      if (s.kind === 'rescue') {
        const p = w.pois.find(p => p.id === s.poi);
        if (p && !S.poiDone[p.id]) { s.carry.people = p.n; S.poiDone[p.id] = 1; delete S.poiFound[p.id]; }
      } else {
        for (const p of w.pois) {
          if (S.poiDone[p.id] || S.poiFound[p.id]) continue;
          if (Math.hypot(p.x - s.x, p.y - s.y) > r) continue;
          if (p.kind === 'survivors') { S.poiFound[p.id] = 1; logMsg(S, `정찰대가 갇힌 ${p.n} 생존자를 발견했습니다! 구조대를 보내 그들을 다시 데려오세요.`, 'good'); R.fx.push({ kind: 'poi', id: p.id }); }
          else if (p.kind === 'cache') { S.poiDone[p.id] = 1; const loot = cacheLoot(S, p); for (const k in loot) s.carry.loot[k] = (s.carry.loot[k] || 0) + loot[k]; }
          else if (p.kind === 'spec') { S.poiDone[p.id] = 1; s.carry.spec = p.spec; }
        }
      }
      s.phase = 'back';
    } else {
      home.people += s.n;
      const ad = s.carry.people ? addPeople(S, home, s.carry.people) : null;
      for (const k in s.carry.loot) home.stock[k] = (home.stock[k] || 0) + s.carry.loot[k];
      const lootTxt = Object.keys(s.carry.loot).map(k => `${RES[k].n} ${s.carry.loot[k]}`).join(',');
      if (s.carry.people) logMsg(S, `${s.kind === 'exp' ? '탐험대' : '구조팀'}다시 가져옴${s.carry.people}이름 생존자${ad.wait ? `, 침대가 부족해요.${ad.wait}사람들은 먼저 오두막에서 침대를 기다립니다(Duogai 천막)` : ''}。`, 'good');
      if (lootTxt) logMsg(S, `${s.kind === 'exp' ? '탐험대' : '정찰대'}이(가) 다시 가져왔습니다: ${lootTxt}.`, 'good');
      if (s.carry.hope) bumpMood(home, s.carry.hope, 0);
      if (s.carry.spec) {
        const sp = SPECS.find(x => x.id === s.carry.spec);
        if (!S.meta.specs[sp.id]) { S.meta.specs[sp.id] = { lvl: 1 }; logMsg(S, `전문가「${sp.n}」(${sp.role}) 님이 가입했습니다! ${sp.story} TA를 적합한 건물에 배치하세요.`, 'story'); }
        else { S.meta.specs[sp.id].lvl++; logMsg(S, `"${sp.n}"을(를) 다시 만났는데, 그 사람의 경험이 더 많습니다(${S.meta.specs[sp.id].lvl} 레벨).`, 'good'); }
      }
      S.scouts = S.scouts.filter(x => x !== s);
    }
  }
}
function cacheLoot(S, p) {
  const t = p.tier, r = hash3(p.id, 7, S.runSeed);
  const pool = { 1: ['wood', 'plank', 'food'], 2: ['coal', 'iron', 'plank'], 3: ['steel', 'gear', 'iron'], 4: ['seal', 'tar', 'steel'], 5: ['battery', 'alloy', 'seal'], 6: ['part', 'alloy', 'battery'], 7: ['shard', 'part', 'alloy'] }[t];
  const a = pool[Math.floor(r * pool.length)], b = pool[(Math.floor(r * pool.length) + 1) % pool.length];
  const amt = Math.round(60 * Math.pow(1.3, t - 1) / Math.pow(RES[a].t, 0.5));
  return { [a]: amt, [b]: Math.round(amt / 2) };
}

// ---------- 探险：雾里的地点 ----------
export function siteAt(S, x, y, pad = 0) {
  const w = getWorld(S.runSeed);
  for (const p of w.sites || []) if (Math.abs(p.x - x) <= pad && Math.abs(p.y - y) <= pad) return p;
  for (const g of w.gangs || []) if (Math.abs(g.x - x) <= pad + 1 && Math.abs(g.y - y) <= pad + 1) return g; // 掠夺者营地占得大一点
  return null;
}

// ---------- 掠夺者营地 ----------
// 雾里藏着几处掠夺者营地。被侦察到以后，它会时不时派人到附近的营地索贡：纳贡、做买卖、或者硬顶回去。打赢两次他们就散了
export const GANG_NAMES = ['블랙 플래그 갱', '울프팡 갱', '쇠고리', '얼어붙은 강 갱단', '회색 까마귀', '부러진 칼날'];
export const GANG_MINPPL = 30, GANG_R = 45, GANG_P = 7200, GANG_FIRST = 900, GANG_WAIT = 900, GANG_WINS = 2, GANG_GROW = 6;
const GANG_GOODS = [null, { plank: 60 }, { iron: 30, plank: 30 }, { steel: 20, gear: 6 }, { steel: 30, seal: 8 }, { crystal: 15, battery: 5 }, { part: 8, alloy: 8 }, { part: 12, alloy: 12 }];
export function gangsOf(S) { return getWorld(S.runSeed).gangs || []; }
export function gangOf(S, id) { return gangsOf(S).find(g => g.id === id) || null; }
export const gangName = g => GANG_NAMES[g.id % GANG_NAMES.length];
// 离它最近、在 GANG_R 格以内的营地
export function gangTarget(S, g) {
  let best = null, bd = GANG_R;
  for (const c of S.camps) { if (c.people < GANG_MINPPL) continue; const d = Math.hypot(c.x - g.x, c.y - g.y); if (d <= bd) { bd = d; best = c; } } // 太小的营地他们看不上
  return best;
}
export function gangStr(S, g) {
  const st = (S.gangs || {})[g.id] || {};
  return Math.round(14 * Math.pow(RAID_GROW, tierOfRow(g.y) - 1) * (1 + 0.12 * Math.min(GANG_GROW, Math.max(0, (st.n || 1) - 1))) * Math.pow(0.75, st.wins || 0) * diffOf(S).raid);
}
export function gangTribute(S, g, camp) {
  const tier = tierOfRow(camp.y), m = 1 + 0.5 * (tier - 1);
  return { food: Math.round(20 + camp.people * 1.2), [tier >= 2 ? 'coal' : 'wood']: Math.round(50 * m) };
}
// 做买卖：多给一些吃的和燃料，换回他们抢来的货（只换你已经认得的东西）
export function gangTrade(S, g, camp) {
  const tb = gangTribute(S, g, camp), give = {}, get = {}, st = (S.gangs || {})[g.id] || {};
  for (const k in tb) give[k] = Math.round(tb[k] * 1.5);
  let gi = Math.min(tierOfRow(g.y), S.known);
  while (gi > 1 && Object.keys(GANG_GOODS[gi]).some(k => RES[k].t > S.known)) gi--;
  const m = 1 + 0.1 * Math.min(5, st.rel || 0);
  for (const k in GANG_GOODS[gi]) get[k] = Math.round(GANG_GOODS[gi][k] * m);
  return { give, get };
}
function gangSettle(S, g, st, c, how) {
  const nm = gangName(g);
  st.dem = null; st.next = S.t + GANG_P;
  if (how === 'tribute') {
    const cost = gangTribute(S, g, c); pay(c.stock, cost); st.rel = (st.rel || 0) + 1; st.paid = (st.paid || 0) + 1;
    return `「${c.name}"조의를 표하다(${Object.keys(cost).map(k => `${RES[k].n} ${fmtN(cost[k])}`).join('、')}），「${nm}“그 사람은 물건을 들고 떠났어요.`;
  }
  const T = gangTrade(S, g, c); pay(c.stock, T.give);
  const cap = storeCap(S, c);
  for (const k in T.get) c.stock[k] = Math.min(Math.max(cap, c.stock[k] || 0), (c.stock[k] || 0) + T.get[k]);
  st.rel = (st.rel || 0) + 1; st.trades = (st.trades || 0) + 1;
  return `「${c.name}"그리고"${nm}” 거래를 성사시켰습니다: 대가로${Object.keys(T.get).map(k => `${RES[k].n} ${fmtN(T.get[k])}`).join('、')}。`;
}
// 答复索贡：tribute 纳贡 / trade 做买卖 / fight 顶回去（到期时打过来）
// 做买卖要多给口粮：给完不够大家吃 20 分钟就不让做
export function gangTradeBlock(S, g, c) { const give = gangTrade(S, g, c).give; return (c.stock.food || 0) - (give.food || 0) < c.people * EAT * 20 ? '이 거래를 완료한 후에는 배급만으로는 모든 사람에게 충분하지 않습니다.' : ''; }
export function gangAnswer(S, id, how) {
  const g = gangOf(S, id), st = (S.gangs || {})[id];
  if (!g || !st || !st.dem || st.gone) return { ok: false, reason: '지금은 답장이 없습니다' };
  const c = getCamp(S, st.dem.camp); if (!c) { st.dem = null; return { ok: false, reason: '야영지가 사라짐' }; }
  if (st.dem.fight) return { ok: false, reason: '이미 돌아가기로 결정했어' };
  if (how === 'tribute' || how === 'trade') {
    const cost = how === 'tribute' ? gangTribute(S, g, c) : gangTrade(S, g, c).give;
    if (!canAfford(c.stock, cost)) return { ok: false, reason: '부족: ' + missing(c.stock, cost).join(',') };
    if (how === 'trade' && gangTradeBlock(S, g, c)) return { ok: false, reason: gangTradeBlock(S, g, c) };
    logMsg(S, gangSettle(S, g, st, c, how), 'info');
    return { ok: true };
  }
  if (how === 'fight') {
    st.dem.fight = true;
    logMsg(S, `"${c.name}"이(가) "${gangName(g)}"의 사람들을 다시 몰아냈습니다. 그들은 다음과 같이 말했습니다: ${fmtMin(st.dem.until - S.t)}(강도 ${gangStr(S, g)}, 방어 ${campDefense(S, c)}) 이후에 호출하세요.`, 'warn', { act: 'gang', arg: id, label: '보기' });
    return { ok: true };
  }
  return { ok: false };
}
const fmtMin = s => { s = Math.max(0, Math.round(s)); const m = Math.max(1, Math.round(s / 60)); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };
function gangFight(S, g, st, c) {
  const R = rt(S), nm = gangName(g), str = gangStr(S, g), def = campDefense(S, c);
  st.dem = null; st.next = S.t + GANG_P; S.stats.raids++;
  if (def >= str) {
    st.wins = (st.wins || 0) + 1; S.stats.raidsWon++;
    const loot = gangTrade(S, g, c).get, cap = storeCap(S, c);
    for (const k in loot) { loot[k] = Math.round(loot[k] * 0.8); c.stock[k] = Math.min(Math.max(cap, c.stock[k] || 0), (c.stock[k] || 0) + loot[k]); }
    bumpMood(c, 5, -3);
    R.fx.push({ kind: 'raid', camp: c.id, won: true, str, def, t: S.t, gang: g.id });
    if (st.wins >= GANG_WINS) {
      st.gone = S.t; S.stats.gangs = (S.stats.gangs || 0) + 1; R.gangDirty = true;
      S.meta.embers += 3; S.meta.emberTotal += 3;
      logMsg(S, `「${c.name}"또 거절했다"${nm}」（${def}오른쪽${str}), 압수${Object.keys(loot).map(k => `${RES[k].n} ${loot[k]}`).join('、')}. 약탈자야영지는 헤어졌고 다시는 오지 않을 것입니다. 잔불 +3.`, 'good');
    } else logMsg(S, `「${c.name}"거부됨"${nm}」（${def}오른쪽${str}), 압수${Object.keys(loot).map(k => `${RES[k].n} ${loot[k]}`).join('、')}. 그들은 손실을 입었고 다음에는 그렇게 치열하지 않을 것입니다. 다시 이기면 해산해야합니다.`, 'good');
  } else {
    // 口粮大家会先藏起来：最多被抢一成，别的东西最多四分之一
    const r = 1 - def / str, loss = 0.25 * r;
    for (const k in c.stock) c.stock[k] *= (1 - (k === 'food' ? 0.4 : 1) * loss);
    const kill = Math.min(Math.max(0, c.people - MIN_PEOPLE), Math.round(r * 3 + 0.3));
    c.people -= kill; S.stats.deaths += kill; bumpMood(c, -8, 6); trimWorkers(S, c);
    st.rel = 0;
    R.fx.push({ kind: 'raid', camp: c.id, won: false, str, def, t: S.t, gang: g.id });
    logMsg(S, `「${nm}"급히 들어갔다"${c.name}"(방어${def}오른쪽${str}): 보급품이 약탈당했습니다.${Math.round(loss * 100)}% (배급는 대부분을 숨겼습니다)${kill ? `，${kill}사람이 죽었어요` : ''}. 더 많은 화살탑를 구축하거나 다음 번에 먼저 경의를 표하십시오.`, 'bad');
  }
}
// 贡凑不齐（或者交了就要挨饿）：有多少交多少（口粮最多交三成，还要留够吃的），他们不满意，下回来得早一些
function gangShort(S, g, st, c) {
  const cost = gangTribute(S, g, c), got = {};
  const keep = c.people * EAT * 20; // 口粮至少留够大家吃 20 分钟
  for (const k in cost) { const have = c.stock[k] || 0, a = Math.floor(Math.min(cost[k], k === 'food' ? Math.min(have * 0.3, have - keep) : have)); if (a > 0) { c.stock[k] -= a; got[k] = a; } }
  st.dem = null; st.next = S.t + GANG_P * 0.6; st.short = (st.short || 0) + 1;
  bumpMood(c, -2, 3);
  return `"라고 대답하는 사람은 아무도 없었다.${c.name}"저는 그 사람을 이길 수도 없고 공물을 모을 수도 없어서 그냥 돈을 냈어요.${Object.keys(got).length ? ` ${Object.keys(got).map(k => `${RES[k].n} ${fmtN(got[k])}`).join('、')}` : '산산조각'}。「${gangName(g)}"라며 욕을 하며 다음번엔 일찍 오겠다고 하더군요.`;
}
function gangsStep(S) {
  const w = getWorld(S.runSeed); if (!w.gangs) return;
  S.gangs ||= {};
  for (const g of w.gangs) {
    let st = S.gangs[g.id];
    const nm = gangName(g);
    if (!st) {
      if (S.reveal[idx(g.x, g.y)] !== 1) continue;
      st = S.gangs[g.id] = { seen: S.t, next: S.t + GANG_FIRST, rel: 0, wins: 0, n: 0 };
      logMsg(S, `🏴 정찰대는 위도 ${g.y}에서 약탈자야영지 "${nm}"을(를) 발견했습니다. 울타리 뒤에는 칼을 들고 있는 사람이 20명 정도 있었고, 야영지에는 검은 깃발이 있었습니다. ${gangTarget(S, g) ? '우리 야영지에서 멀지 않은 곳에 있으며 조만간 여러분의 집에 올 것입니다.' : '아직 야영지와는 거리가 멀습니다.'}`, 'story', { act: 'gang', arg: g.id, label: '보기' });
      continue;
    }
    if (st.gone) continue;
    if (st.dem) {
      if (S.t < st.dem.until) continue;
      const c = getCamp(S, st.dem.camp); if (!c) { st.dem = null; continue; }
      if (st.dem.fight) { gangFight(S, g, st, c); continue; }
      // 没人答复：守得住就顶回去，守不住、交得起就先交贡
      const str = gangStr(S, g), def = campDefense(S, c);
      const tb = gangTribute(S, g, c), fine = canAfford(c.stock, tb) && (c.stock.food || 0) - tb.food >= c.people * EAT * 20;
      if (def < str && fine) logMsg(S, `아무도 대답하지 않았습니다. "${c.name}"의 사람들은 그들을 이길 수 없을까 두려워 스스로 조공을 모았습니다. ${gangSettle(S, g, st, c, 'tribute')}`, 'info');
      else if (def < str) logMsg(S, gangShort(S, g, st, c), 'warn'); // 交不起也打不过：能凑多少交多少，免得被抢光
      else gangFight(S, g, st, c);
      continue;
    }
    if (S.t >= st.next) {
      // 一次只来一伙：别的掠夺者还在等答复，就晚点再来
      if (Object.values(S.gangs).some(o => o !== st && o.dem && !o.gone)) { st.next = S.t + 600; continue; }
      const c = gangTarget(S, g);
      if (!c) { st.next = S.t + 600; continue; }
      st.n = (st.n || 0) + 1; st.dem = { camp: c.id, until: S.t + GANG_WAIT, at: S.t };
      logMsg(S, `🏴「${nm}」일손 배치가 「${c.name}」에 도착했습니다. 경의를 표하거나 도둑질을 기다리세요. ${GANG_WAIT / 60}분 이내에 응답하십시오(강도 ${gangStr(S, g)}, 방어 ${campDefense(S, c)}).`, 'warn', { act: 'gang', arg: g.id, label: '회신하다' });
    }
  }
}
// 眼下要答复的索贡（顶栏小标签用）
export function gangDemands(S) {
  const out = [];
  for (const g of gangsOf(S)) { const st = (S.gangs || {})[g.id]; if (st && st.dem && !st.gone) out.push({ g, st, left: st.dem.until - S.t }); }
  return out.sort((a, b) => a.left - b.left);
}
export function siteState(S, p) {
  if (S.siteDone && S.siteDone[p.id]) return 'done';
  const s = S.scouts.find(q => q.kind === 'exp' && q.poi === p.id);
  if (s) return s.phase === 'wait' ? 'wait' : s.phase === 'back' ? 'back' : 'going';
  return S.reveal[idx(p.x, p.y)] ? 'seen' : 'hidden';
}
function coldRisk(S, cid, y) { return Math.max(0, Math.min(0.6, (-baseTempOfRow(y) - 18 - 6 * scoutSlots(S, cid).lvl - 3 * up(S, 'sight')) / 80)); }
const expRiskOf = (risk, sup) => sup === 'full' ? risk * 0.3 : Math.min(0.7, risk + 0.15);
export function expRisk(S, cid, p, sup) { return expRiskOf(coldRisk(S, cid, p.y), sup); }
export function expCost(S, cid, p, sup) {
  const c = scoutCost(S, cid, p.x, p.y, 'rescue');
  const m = sup === 'full' ? 2.4 : 1.2, out = {};
  for (const k in c) out[k] = Math.round(c[k] * m);
  if (sup === 'full' && p.t >= 2) out.coal = Math.round(20 + 4 * Math.hypot(p.x - getCamp(S, cid).x, p.y - getCamp(S, cid).y) / 10);
  return out;
}
export function sendExpedition(S, cid, siteId, sup) {
  const w = getWorld(S.runSeed), p = (w.sites || []).find(q => q.id === siteId);
  if (!p) return { ok: false, reason: '' };
  const st = siteState(S, p);
  if (st === 'done') return { ok: false, reason: '탐색이 여기를 통과했습니다' };
  if (st !== 'seen') return { ok: false, reason: '도로에는 이미 탐험대가 있습니다' };
  const c = getCamp(S, cid), sl = scoutSlots(S, cid);
  if (!sl.n) return { ok: false, reason: '먼저 정찰 막사를 구축하세요' };
  if (sl.used >= sl.n) return { ok: false, reason: '정찰대는 모두 아웃되었으며 업그레이드정찰 막사는 추가 팀을 보낼 수 있습니다' };
  const range = scoutRange(S, cid) + 10;
  if (Math.hypot(p.x + 0.5 - c.x, p.y + 0.5 - c.y) > range) return { ok: false, reason: `너무 멀다: "${c.name}"에서 갈 수 있는 가장 먼 거리는 ${range}제곱입니다.` };
  if (c.people - 4 < MIN_PEOPLE) return { ok: false, reason: '야영지사람이 너무 적어요' };
  const cost = expCost(S, cid, p, sup);
  if (!canAfford(c.stock, cost)) return { ok: false, reason: '부족: ' + missing(c.stock, cost).join(',') };
  pay(c.stock, cost);
  c.people -= 4; trimWorkers(S, c);
  S.scouts.push({ id: S.nextId++, camp: cid, kind: 'exp', poi: p.id, sup, x: c.x, y: c.y, tx: p.x, ty: p.y, phase: 'out', n: 4, carry: { people: 0, loot: {}, spec: null } });
  logMsg(S, `탐험대는 ${sup === 'full' ? '충분한' : '소량'} 보급품을 가져와 "${SITES[p.kind].n}"(으)로 출발합니다.`);
  return { ok: true };
}
const LOOT_POOL = { 1: ['wood', 'plank', 'stone', 'food'], 2: ['coal', 'iron', 'plank', 'ore'], 3: ['steel', 'gear', 'iron', 'lime'], 4: ['seal', 'tar', 'steel', 'engine'], 5: ['battery', 'alloy', 'seal', 'crystal'], 6: ['part', 'alloy', 'battery', 'star'], 7: ['shard', 'part', 'alloy', 'star'] };
function siteLoot(S, p, m, n = 2, prefer) {
  const t = Math.max(1, Math.min(p.t, S.known)), pf = prefer ? prefer.filter(k => RES[k].t <= S.known) : [], pool = pf.length ? pf : LOOT_POOL[t];
  const base = 90 * Math.pow(1.3, t - 1), out = {}, r = hash3(p.id, 31, S.runSeed);
  for (let i = 0; i < Math.min(n, pool.length); i++) { const k = pool[(Math.floor(r * pool.length) + i) % pool.length]; out[k] = Math.round(base * m * (i ? 0.6 : 1) / Math.pow(RES[k].t, 0.5)); }
  return out;
}
const addLoot = (s, l) => { for (const k in l) s.carry.loot[k] = (s.carry.loot[k] || 0) + l[k]; };
const lootTxt = l => Object.keys(l).map(k => `${RES[k].n} ${l[k]}`).join(',');
const bank = (S, n) => { const T = techState(S); T.bank = (T.bank || 0) + n; };
export const bankPts = bank;
function revealNextSite(S, p) {
  const w = getWorld(S.runSeed);
  const nx = (w.sites || []).filter(q => q.y > p.y && !S.reveal[idx(q.x, q.y)]).sort((a, b) => a.y - b.y)[0];
  if (nx) revealCircle(S, nx.x, nx.y, 4);
  return nx;
}
// 每种地点 2～3 个选项；need: 'full' 表示要带足补给才能选
const SITE_OPTS = {
  depot: [
    { t: '움직일 수 있는 것은 움직여라', d: (S, p) => lootTxt(siteLoot(S, p, 1)), go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1)); return '모두가 쓸만한 물건을 들고 돌아갔습니다.'; } },
    { t: '오래된 장부를 뒤져보니', d: (S, p) => `${lootTxt(siteLoot(S, p, 0.4))} · 다음 위치 찾기`, go: (S, s, p) => { addLoot(s, siteLoot(S, p, 0.4)); const nx = revealNextSite(S, p); return nx ? `원장에는 북쪽에 "${SITES[nx.kind].n}"라는 또 다른 위치가 기록되어 있습니다.` : '장부의 단어가 모두 흐려졌습니다.'; } },
    { t: '하룻밤 캠프를 준비하고 창고를 비우세요', need: 'full', d: (S, p) => lootTxt(siteLoot(S, p, 1.9, 3)), go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1.9, 3)); return '가져온 물품에 의지해 밤새도록 창고를 뒤집어 놓았습니다.'; } },
  ],
  camp: [
    { t: '참여하도록 초대하세요', d: (S, p) => `+${5 + 2 * p.t}명 · 희망 +3`, go: (S, s, p) => { s.carry.people += 5 + 2 * p.t; s.carry.hope = 3; return '그들은 물건을 싸고 탐험대를 따라 야영지로 돌아왔습니다.'; } },
    { t: '지도를 배급으로 교체하세요', need: 'full', d: () => '북쪽에서 안개의 대형 조각을 공개하세요', go: (S, s, p) => { revealCircle(S, p.x, Math.min(H - 1, p.y + 24), 11); revealNextSite(S, p); return '그들은 눈 속에서 북쪽으로 길을 따라갔습니다.'; } },
    { t: '그들과 보급품을 교환하다', d: (S, p) => lootTxt(siteLoot(S, p, 0.8)), go: (S, s, p) => { addLoot(s, siteLoot(S, p, 0.8)); return '양측은 원하는 것을 얻었고 헤어질 때 서로 화해했습니다.'; } },
  ],
  train: [
    { t: '트럭 칸을 살짝 열어보세요', d: (S, p) => `${lootTxt(siteLoot(S, p, 1.4))} · 누군가가 부상을 입을 수 있습니다`, go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1.4)); if (hash3(p.id, 77, S.runSeed) < 0.35 && s.n > 1) { s.n--; S.stats.deaths++; return '객차에 있던 화물 더미가 무너져 팀원 한 명이 돌아오지 못했습니다.'; } return '마차에는 구시대의 보급품이 가득 차 있었습니다.'; } },
    { t: '엔진 부품을 제거합니다', d: (S, p) => `${lootTxt(siteLoot(S, p, 0.8, 1, ['gear', 'engine', 'iron', 'steel']))} · ${12 * p.t} 연구 포인트 추첨`, go: (S, s, p) => { addLoot(s, siteLoot(S, p, 0.8, 1, ['gear', 'engine', 'iron', 'steel'])); bank(S, 12 * p.t); return '또한 차 앞쪽에 누렇게 변한 그림이 쌓여 있습니다.'; } },
    { t: '불을 피우고 얼음을 녹여 모든 구역을 수색하세요', need: 'full', d: (S, p) => `${lootTxt(siteLoot(S, p, 1.4))} · ${12 * p.t} 연구 포인트 추첨`, go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1.4)); bank(S, 12 * p.t); return '그들은 며칠 동안 태울 수 있을 만큼의 연료를 가져왔고 열차 전체를 수색했습니다.'; } },
  ],
  shrine: [
    { t: '우리의 이름을 새겨라', d: () => '모두야영지희망 +10', go: (S, s, p) => { for (const c of S.camps) bumpMood(c, 10, 0); return '팀원들은 야영지에 있는 모든 사람의 이름을 얼음 위에 새겼습니다. 그 소식이 돌아왔을 때 모두가 매우 흥분했습니다.'; } },
    { t: '위의 크리스탈을 떼어내세요', d: (S, p) => `${lootTxt(siteLoot(S, p, 1.2, 1, ['crystal', 'shard', 'star', 'iron', 'stone']))} · 모두 야영지희망 −4, 불만 +6`, go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1.2, 1, ['crystal', 'shard', 'star', 'iron', 'stone'])); for (const c of S.camps) bumpMood(c, -4, 6); return '크리스탈을 얻었는데 어떤 사람들은 그것이 불운을 가져올 것이라고 말했습니다.'; } },
  ],
  lab: [
    { t: '도면 복사', d: (S, p) => `${25 * p.t} 연구 포인트 추첨`, go: (S, s, p) => { bank(S, 25 * p.t); return '테이블 위의 그림을 조심스럽게 말아서 배낭에 넣었습니다.'; } },
    { t: '악기 제거', d: (S, p) => lootTxt(siteLoot(S, p, 1, 2, ['gear', 'battery', 'engine', 'seal', 'part'])), go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1, 2, ['gear', 'battery', 'engine', 'seal', 'part'])); return '탈부착 가능한 부품은 모두 제거되었습니다.'; } },
    { t: '여기에 머물면서 가능한 모든 것을 복사하세요.', need: 'full', d: (S, p) => `${45 * p.t} 연구 포인트 추첨`, go: (S, s, p) => { bank(S, 45 * p.t); return '팀원들은 가져온 물품에 의지하여 일주일 내내 관측소에서 일했습니다.'; } },
  ],
  wreck: [
    { t: '합금 프레임 제거', d: (S, p) => lootTxt(siteLoot(S, p, 1.6, 2, ['alloy', 'star', 'steel', 'part'])), go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1.6, 2, ['alloy', 'star', 'steel', 'part'])); return '얼어붙은 뼈대는 한 조각씩 제거되었고, 썰매는 거의 당겨지지 않았습니다.'; } },
    { t: '조종석에서 일지 찾기', d: (S, p) => `북쪽 안개의 넓은 지역을 발견 · ${15 * p.t} 연구 포인트 그리기`, go: (S, s, p) => { revealCircle(S, p.x, Math.min(H - 1, p.y + 26), 12); bank(S, 15 * p.t); return '기록에는 비행선의 최종 경로가 북쪽까지 표시되어 있었습니다.'; } },
  ],
};
export function expPending(S) { return S.scouts.find(s => s.kind === 'exp' && s.phase === 'wait') || null; }
export function siteView(S, s) {
  const w = getWorld(S.runSeed), p = (w.sites || []).find(q => q.id === s.poi);
  if (!p) return null;
  return { p, title: SITES[p.kind].n, text: SITES[p.kind].desc, opts: SITE_OPTS[p.kind].map(o => ({ t: o.t, d: o.d(S, p), ok: !o.need || s.sup === 'full', need: o.need })) };
}
export function resolveSite(S, sid, i) {
  const s = S.scouts.find(q => q.id === sid); if (!s || s.phase !== 'wait') return null;
  const w = getWorld(S.runSeed), p = (w.sites || []).find(q => q.id === s.poi), o = p && SITE_OPTS[p.kind][i];
  if (!o || (o.need && s.sup !== 'full')) return null;
  const msg = o.go(S, s, p);
  S.siteDone = S.siteDone || {}; S.siteDone[p.id] = 1;
  s.phase = 'back';
  S.log.push({ t: S.t, msg: `【${SITES[p.kind].n}】${msg}`, kind: 'story' }); if (S.log.length > 80) S.log.shift();
  rt(S).revealDirty = true; dirty(S);
  return msg;
}

// ---------- 章节 ----------
// ---------- 北境的章节：每站一章，由种子和这一站的地貌决定 ----------
const SPINE_RATE = {}; CHAPTERS.forEach(c => c.tasks.forEach(q => { if (q.k === 'rate') SPINE_RATE[q.r] = q.n; }));
export const TOWER_N = 10;
// 目标以世界之脊那一站为底：每站 +8%（加法），第 10 站 ×1.8，之后每站 +3%，最高 ×2.5
export function northMult(N) { return N <= 10 ? 1 + 0.08 * N : Math.min(2.5, 1.8 + 0.03 * (N - 10)); }
const rnd5 = v => v >= 10 ? Math.round(v) : Math.round(v * 2) / 2;
export function northPair(S, N) { const o = Math.floor(hash3(S.runSeed, 71, 5) * 6), a = (o + N) % 6, b = (a + 2 + (N % 3 === 0 ? 1 : 0)) % 6; return [NORTH_HI[a], NORTH_HI[b]]; }
export const northEmbers = S => Math.round(40 * (1 + relicSum(S, 'ember')) * diffOf(S).ember);
// 北境目标按人手封顶（1.0 理顺）：两条主线加起来要的工人，按 35 级建筑、+80% 加成算，
// 不超过营地人口上限（熔炉 37 级）的一个比例：第 1 站七成，每站 +2.5%，第 10 站约九成三，之后每站 +1%，最多 105%。
// 只削尖峰：本来就不费人的组合（比如星核）照旧
const LAB_L = 35, LAB_BON = 0.8, LAB_CAP = 12 + 6 * 37;
const PROD1 = {}; for (const t in BLD) for (const k in BLD[t].out || {}) if (!PROD1[k]) PROD1[k] = t;
const LPU = {};
export function laborPerUnit(r) {
  if (LPU[r] != null) return LPU[r];
  const t = PROD1[r]; if (!t) return (LPU[r] = 0);
  const d = BLD[t], k1 = levelMul(LAB_L) * (1 + LAB_BON), cnt = 1 / (d.out[r] * k1);
  let w = cnt * maxWorkers(t, LAB_L);
  for (const k in d.in || {}) w += d.in[k] * cnt * k1 * laborPerUnit(k);
  return (LPU[r] = w);
}
export const northBudget = N => (N <= 10 ? 0.70 + 0.025 * (N - 1) : Math.min(1.05, 0.925 + 0.01 * (N - 10))) * LAB_CAP;
function northChapter(S, i) {
  const st = stopOf(S, i); if (!st || !st.north) return null;
  const N = st.north, m = northMult(N), pair = northPair(S, N), name = st.short;
  const pk = pickOf(S, i), dm = pk ? FORK.diff[pk.d] : 1, rf = pk ? FORK.rew[pk.d] : 1; // 1.1 分岔：选的路好走 / 难走
  let rich = null;
  if (st.rule === 'rich' && st.rich) {
    const k = st.rich, r = SPOTS[k].res, g = Object.keys(BLD).find(t => (BLD[t].gather || []).includes(k));
    const rn = dm === 1 ? Math.round(4 * BLD[g].out[r]) : Math.max(1, rnd5(4 * BLD[g].out[r] * dm));
    rich = { t: `${RES[r].n}생산량 지속 ${rn}/분(부광대)`, k: 'rate', r, n: rn };
    const j = pair.indexOf(r); if (j >= 0) pair[j] = NORTH_HI.find(x => !pair.includes(x));
  }
  const raw = pair.map(r => (SPINE_RATE[r] || 6) * m), lab = raw.reduce((a, n, j) => a + n * laborPerUnit(pair[j]), 0);
  const f = lab > 0 ? Math.min(1, northBudget(N) / lab) : 1;
  const tasks = pair.map((r, j) => { const n = Math.max(1, rnd5(raw[j] * f * dm)); return { t: `${RES[r].n}생산량Stable ${n}/분`, k: 'rate', r, n }; });
  if (rich) tasks.push(rich);
  else if (NORTH_TASK[st.rule]) { const q = { ...NORTH_TASK[st.rule] }; if (q.n >= 20 && dm !== 1) { const n = Math.round(q.n * dm / 10) * 10; q.t = q.t.replace(String(q.n), String(n)); q.n = n; } tasks.push(q); }
  if (N <= TOWER_N) tasks.push({ t: `${towerName(N)} 불 켜기`, k: 'tower', tn: N, n: 1 });
  const pick = (L, salt) => L[Math.floor(hash3(S.runSeed, N, salt) * L.length) % L.length].replace('{n}', name);
  return { n: `북방번째 역 ${N} · ${name}`, story: pick(NORTH_STORY, 77), end: pick(NORTH_END, 78), tasks, north: N, rule: st.rule,
    reward: { res: { [pair[0]]: Math.round(30 * rf), [pair[1]]: Math.round(30 * rf) }, hope: 8, people: Math.round(10 * rf), ...(pk && pk.bonus ? { bonus: pk.bonus, bd: pk.d } : {}) }, diff: pk ? pk.d : null };
}
export function chapterDef(S, i) {
  if (i <= SPINE) return CHAPTERS[i];
  const R = rt(S), c = R.nch || (R.nch = {});
  return c[i] !== undefined ? c[i] : (c[i] = northChapter(S, i));
}
// 已经开始的章节：到过的地标，加上北境里走过、奖励还没领的站和现在这一站
export function chapIdx(S) {
  const J = journeyOf(S), C = chapState(S), out = [...S.founded];
  for (let i = SPINE + 1; i <= J.stage; i++) if (i === J.stage || !C.got[i]) out.push(i);
  return out;
}
// ---------- 烽火塔（第十三版）：北境前十站每站一座；地基 → 塔身吃货 → 点火 ----------
export const towerList = S => (S.tower || (S.tower = { list: [] })).list;
export const towerLit = (S, n) => towerList(S).some(t => t.n === n);
export const towersLit = S => towerList(S).length;
export const towerName = n => n >= TOWER_N ? '천화탑' : `${n} 봉화탑 차단`;
export const towerType = n => n >= TOWER_N ? 'skyfire' : 'pyre';
export function towerLitAt(S, camp) { return towerList(S).some(t => t.camp === camp.id); }
// 这一站能不能建塔：北境前十站各一座，第十站是天火塔
export function towerLock(S, type) {
  const N = northN(journeyOf(S).stage);
  if (!N || N > TOWER_N) return '북방상위 10개 스테이션에 각각 봉화탑을 하나씩 건설하세요.';
  if (towerType(N) !== type) return type === 'skyfire' ? '북방 10번째 스테이션 건설 천화탑' : '건설될 역은 천화탑이다';
  if (towerLit(S, N) || S.buildings.some(b => b.tn === N)) return '이 역에 타워가 세워졌습니다.';
  return '';
}
// 这座塔要喂哪几种、每种多少/分钟、喂多久、点火要什么燃料。第一种和这一站的产能目标重叠
export function towerSpec(S, n) {
  const R = rt(S), C = R.tspec || (R.tspec = {});
  if (C[n]) return C[n];
  const j = TOWER_STEPS.findIndex(q => n <= q[0]), [, nk, r0, dur] = TOWER_STEPS[Math.max(0, j)], first = j > 0 ? TOWER_STEPS[j - 1][0] + 1 : 1;
  const rate = r0 + 0.5 * (n - first), pair = northPair(S, n);
  const rest = NORTH_HI.filter(k => k !== pair[0]), o = Math.floor(hash3(S.runSeed, n, 131) * rest.length);
  const kinds = [pair[0], ...rest.map((_, i) => rest[(o + i) % rest.length])].slice(0, nk);
  const fuel = n >= TOWER_N ? { starcore: 60 } : n <= 5 ? { battery: 40 + 10 * n } : { starcore: 12 + 3 * n };
  return (C[n] = { n, kinds, rate, dur, fuel });
}
function towerFeed(S, b, sp, dt, hf, offK, st, R, dem, fuelKeepU = 0) {
  const br = R.b[b.id] || (R.b[b.id] = {}), T = b.tw;
  br.rate = {}; br.inRate = {}; br.want = {}; br.haul = 0; br.act = 0; br.staff = 1;
  if (T.p >= sp.dur) { br.status = '타워가 건설되었으며 조명을 기다리고 있습니다.'; return; }
  if (b.moveT > S.t) { br.status = '움직이는'; return; }
  const f = Math.min(dt * hf * offK * feedMul(S, getCamp(S, b.camp)), sp.dur - T.p), need = sp.rate * f / 60;
  let lim = 1, whyK = null;
  for (const k of sp.kinds) { const have = Math.max(0, (st[k] || 0) - fuelKeep(st, k, fuelKeepU)); if (have < need && have / need < lim) { lim = have / need; whyK = k; } }
  for (const k of sp.kinds) { st[k] = Math.max(0, (st[k] || 0) - need * lim); br.inRate[k] = sp.rate * hf * lim; br.want[k] = sp.rate * hf; }
  if (lim < 0.999 && T.p > 0 && T.p < sp.dur / 2) T.cut = 1; // 塔身开始长了以后、长到一半以前断过货（成就用）
  T.p = Math.min(sp.dur, T.p + f * lim);
  br.act = lim; br.haul = dem * hf * lim;
  br.status = lim < 0.95 ? (fuelKeep(st, whyK, fuelKeepU) > 0 && (st[whyK] || 0) > need ? FUEL_KEEP_WHY : `${RES[whyK].n} 누락됨`) : hf < 0.7 ? '운반꾼 부족' : '탑이 커지고 있어요';
  if (T.p >= sp.dur - 1e-6) { T.p = sp.dur; logMsg(S, `🔥 ${towerName(b.tn)}타워 본체가 건설되었습니다 : 완료${Object.entries(sp.fuel).map(([k, v]) => `${RES[k].n} ${v}`).join('、')}불이 붙을 것입니다.`, 'good', { act: 'spot', arg: b.id, label: '불을 피우다' }); }
}
export function towerIgniteCheck(S, b) {
  if (!b || !BLD[b.type].tower) return { ok: false, reason: '봉화탑 아님' };
  if (b.tw.lit) return { ok: false, reason: '이미 켜져 있음' };
  const sp = towerSpec(S, b.tn); if (b.tw.p < sp.dur) return { ok: false, reason: `타워는 아직 ${Math.ceil((sp.dur - b.tw.p) / 60)}분 거리에 있습니다.` };
  const camp = getCamp(S, b.camp);
  if (!canAfford(camp.stock, sp.fuel)) return { ok: false, reason: '부족: ' + missing(camp.stock, sp.fuel).join(','), fuel: sp.fuel };
  return { ok: true, fuel: sp.fuel };
}
export function igniteTower(S, bid) {
  const b = getB(S, bid), ck = towerIgniteCheck(S, b); if (!ck.ok) return ck;
  const camp = getCamp(S, b.camp), s = BLD[b.type].size;
  pay(camp.stock, ck.fuel);
  b.tw.lit = 1; b.tw.litT = S.t;
  towerList(S).push({ n: b.tn, x: b.x + s / 2, y: b.y + s / 2, t: S.t, camp: camp.id, type: b.type, cut: b.tw.cut ? 1 : 0 });
  towerList(S).sort((a, c) => a.n - c.n);
  S.meta.towerMax = Math.max(S.meta.towerMax || 0, towersLit(S));
  bumpMood(camp, 8, -4);
  revealCircle(S, camp.x, camp.y, heatRadius(S, camp) + 2);
  dirty(S);
  logMsg(S, `🔥 ${towerName(b.tn)}에 불이 들어왔습니다! 빛줄기가 곧장 하늘을 향해 쏘아 올려 남쪽을 바라보는 사람들은 멀리서도 그것을 볼 수 있다. 「${camp.name}」희망 +${TOWER_FX.hope}, 난방권 +${TOWER_FX.warm} 그리드.`, 'story');
  rt(S).fx.push({ kind: 'tower-lit', n: b.tn, x: b.x + s / 2, y: b.y + s / 2, bid });
  if (b.tn >= TOWER_N) skyfireEnd(S);
  return { ok: true };
}
// ---------- 天火塔点亮：这一程的终章 ----------
// 记下「这一路」的数（点亮那一刻的），镜头从北往南把光柱一座座扫过去，最后永恒之炉升起一道最大的光
export const ETERNAL_PT = { x: LANDMARKS[6].x + 0.5, y: LANDMARKS[6].row + 0.5 };
export const skyEnded = S => !!(S.tower && S.tower.end);
// 连成一条的光：点燃天火以后，从永恒之炉连到最北的塔
export function towerChain(S) { const L = towerList(S); return skyEnded(S) ? [{ n: 0, x: ETERNAL_PT.x, y: ETERNAL_PT.y, type: 'eternal' }, ...L] : L; }
export function journeySum(S) {
  const J = journeyOf(S), st = S.stats;
  return { stops: J.stage + 1, north: northN(J.stage) || 0, people: S.camps.reduce((a, c) => a + c.people, 0), arrivals: st.arrivals || 0, deaths: st.deaths || 0,
    furnaces: S.camps.length + (J.ruins || []).length, towers: towersLit(S), t: S.t, runs: S.meta.runs || 1, raidsWon: st.raidsWon || 0, blizzards: st.blizzards || 0 };
}
function skyfireEnd(S) {
  const T = S.tower; if (T.end) return;
  T.end = { t: S.t, sum: journeySum(S) };
  S.meta.skyfire = (S.meta.skyfire || 0) + 1;
  for (const c of S.camps) bumpMood(c, 10, -6);
  // 光照到的地方雾散了：永恒之炉和每座塔周围
  revealCircle(S, ETERNAL_PT.x, ETERNAL_PT.y, 14); for (const t of towerList(S)) revealCircle(S, t.x, t.y, 10);
  logMsg(S, STORY.skyEnd, 'story');
  rt(S).fx.push({ kind: 'skyfire' });
}
// 终章看完了（存档里记着，没看完就关了页面，下次进来再放一遍）
export function skyfireSeen(S) { if (S.tower && S.tower.end) S.tower.end.seen = 1; }
export function chapState(S) { return S.chap || (S.chap = { ok: {}, got: {} }); }
function chapVal(S, q) {
  switch (q.k) {
    case 'flvl': return Math.max(...S.camps.map(c => getB(S, c.furnace).lvl));
    case 'people': return S.camps.reduce((a, c) => a + c.people, 0);
    case 'law': return LAWS.filter(l => lawOn(S, l.id)).length;
    case 'bld': return S.buildings.filter(b => b.type === q.b).length;
    case 'res': return Math.floor(S.camps.reduce((a, c) => a + (c.stock[q.r] || 0), 0));
    case 'tech': return S.tech ? Object.keys(S.tech.done).length : 0;
    case 'site': return S.siteDone ? Object.keys(S.siteDone).length : 0;
    case 'raid': return S.stats.raidsWon || 0;
    case 'hope': return Math.round(Math.max(...S.camps.map(c => c.hope ?? 50)));
    case 'line': return roads(S).filter(roadOn).length;
    case 'calm': return Math.round(Math.max(...S.camps.map(c => c.disc ?? 10)));
    case 'eternal': return S.eternal ? S.eternal.stage : 0;
    case 'rate': return Math.round(prodRate(S, q.r) * 10) / 10;
    case 'veh': { const J = journeyOf(S); return (J.fleet[q.v] || 0) + ((J.trip && J.trip.veh[q.v]) || 0); }
    case 'bldm': { const J = journeyOf(S); return S.buildings.filter(b => b.type === q.b && b.camp === J.main).length; }
    case 'ns': return Math.floor(nsOf(S)[q.f] || 0);
    case 'hhold': return Math.floor((nsOf(S).hh || 0) / 6) / 10;
    case 'tower': return towerLit(S, q.tn) ? 1 : 0;
  }
  return 0;
}
// ---------- 产能：每种材料每分钟做出多少（所有营地加起来，下游拿去用了也照算）----------
export const HOLD = 180; // 速度在目标以上撑满 3 分钟（游戏时间）就算达标；掉下来时按一半的速度往回退
export function prodRate(S, k) { return (S.pr && S.pr[k]) || 0; }
function rateStep(S, dt) {
  const R = rt(S), made = R.made || {};
  R.made = {};
  if (dt <= 0) return;
  const P = S.pr || (S.pr = {}), a = 1 - Math.exp(-dt / 20);
  for (const k of RES_KEYS) {
    const inst = (made[k] || 0) / dt * 60, v = P[k] || 0;
    if (!inst && !v) continue;
    const nv = v + (inst - v) * a;
    if (nv < 0.005) delete P[k]; else P[k] = nv;
  }
}
export function holdOf(S, id) { return (S.hold && S.hold[id]) || { p: 0, done: false }; }
function holdTick(S, id, rate, n, dt) {
  const H = S.hold || (S.hold = {}), h = H[id] || (H[id] = { p: 0, done: false });
  if (h.done) return h;
  h.p = rate >= n - 1e-9 ? h.p + dt : Math.max(0, h.p - dt / 2);
  if (h.p >= HOLD) { h.p = HOLD; h.done = true; }
  return h;
}
// 现在要稳住的产能目标：已开始的章节里还没达标的产能任务，加上永恒之炉这一层
export function rateGoals(S) {
  const out = [];
  const C = chapState(S);
  // 这一站的章节排在最前面（老存档里可能还留着前面没做完的章节）
  const cur = journeyOf(S).stage;
  for (const i of chapIdx(S).sort((a, b) => (b === cur) - (a === cur) || b - a)) {
    const ch = chapterDef(S, i); if (!ch) continue;
    ch.tasks.forEach((q, k) => { if (q.k === 'rate' && !C.ok[i + ':' + k]) out.push({ id: `c${i}:${k}`, r: q.r, n: q.n, t: q.t, ch: i }); });
  }
  if (eternalCamp(S) && S.eternal.stage < ETERNAL_STAGES.length) out.push({ id: `e${S.eternal.stage}`, r: 'heart', n: ETERNAL_STAGES[S.eternal.stage], t: `영원의 용광로 부품안정 ${ETERNAL_STAGES[S.eternal.stage]}/분`, eternal: true });
  return out;
}
function holdStep(S, dt) {
  for (const g of rateGoals(S)) {
    const h = holdTick(S, g.id, prodRate(S, g.r), g.n, dt);
    if (h.done && g.eternal) lightEternal(S);
  }
}
// 已开始的章节（= 这一程到过的地标），最新的在最后
export function chapters(S) {
  const C = chapState(S);
  return chapIdx(S).sort((a, b) => a - b).map(i => {
    const ch = chapterDef(S, i);
    const tasks = ch.tasks.map((q, k) => {
      const cur = chapVal(S, q), rate = q.k === 'rate';
      const ok = !!C.ok[i + ':' + k] || (rate ? holdOf(S, `c${i}:${k}`).done : q.k === 'calm' ? cur <= q.n : cur >= q.n);
      return { t: q.t, cur, n: q.n, ok, low: q.k === 'calm', rate, r: q.r, hold: rate ? holdOf(S, `c${i}:${k}`).p : 0 };
    });
    return { i, ch, tasks, done: tasks.every(t => t.ok), got: !!C.got[i] };
  });
}
function chapterStep(S) {
  const C = chapState(S);
  for (const c of chapters(S)) {
    c.tasks.forEach((t, k) => { if (t.ok && !C.ok[c.i + ':' + k]) { C.ok[c.i + ':' + k] = 1; logMsg(S, `【${c.ch.n}】완료: ${t.t}`, 'good'); } });
    if (c.done && !c.got && !C.told?.[c.i]) { C.told = C.told || {}; C.told[c.i] = 1; logMsg(S, `"${c.ch.n}"의 과제가 완료되었습니다. 가서 보상을 얻으세요.`, 'story'); }
  }
}
export const chapterEmbers = (S, i) => Math.round((10 + 5 * i) * (1 + relicSum(S, 'ember')) * diffOf(S).ember);
export function chapterReward(S, i) {
  const r = chapterDef(S, i).reward, out = i > SPINE ? [] : [`🔥 잔불 ${chapterEmbers(S, i)}`];
  if (r.res) for (const k in r.res) if (RES[k].t <= Math.max(S.known, 1)) out.push(`${RES[k].n} ${r.res[k]}`);
  if (r.people) out.push(`${r.people}명의 신규 회원`);
  if (r.hope) out.push(`전체야영지희망 +${r.hope}`);
  if (r.bank) out.push(`${r.bank} 연구 포인트 추첨`);
  if (r.bonus) out.push(bonusTxt(r.bonus, r.bd));
  return out;
}
export function claimChapter(S, i) {
  const c = chapters(S).find(x => x.i === i);
  if (!c || !c.done || c.got) return null;
  const C = chapState(S), r = c.ch.reward, camp = getCamp(S, S.active) || S.camps[0];
  C.got[i] = 1;
  if (i <= SPINE) { const e = chapterEmbers(S, i); S.meta.embers += e; S.meta.emberTotal = (S.meta.emberTotal || 0) + e; } // 北境的章节不给余烬，只有第一次走到新的站号给
  if (r.res) for (const k in r.res) if (RES[k].t <= Math.max(S.known, 1)) camp.stock[k] = (camp.stock[k] || 0) + r.res[k];
  if (r.people) addPeople(S, camp, r.people);
  if (r.hope) for (const cc of S.camps) bumpMood(cc, r.hope, 0);
  if (r.bank) bank(S, r.bank);
  if (r.bonus) { const m = forkBonus(S, r.bonus, r.bd, camp); if (m) logMsg(S, `【${c.ch.n}】도로가 가져오는 이점: ${m}.`, 'good'); }
  S.log.push({ t: S.t, msg: `【${c.ch.n}】${c.ch.end}`, kind: 'story' }); if (S.log.length > 80) S.log.shift();
  return c.ch.end;
}

// ---------- 袭营 ----------
// ---------- 袭击前的应对：火墙、民兵、收拢物资 ----------
export function raidPrep(S, nr) { const p = S.rprep; return nr && p && p.k === nr.k ? p : null; }
export function prepCost(S, camp, kind) {
  if (kind === 'fire') return Math.round(furnaceBurn(getB(S, camp.furnace).lvl) * 30); // 燃料单位：够熔炉烧半小时
  if (kind === 'mil') return Math.max(10, Math.round(camp.people * 0.5)); // 熟食
  return 0;
}
export function prepGain(S, camp, nr, kind) {
  const d = campDefense(S, camp), str = raidStrength(S, camp, nr);
  return Math.round(kind === 'fire' ? Math.max(d * 0.5, str * 0.35) : kind === 'mil' ? Math.max(d * 0.3, str * 0.25) : 0);
}
export function raidDefense(S, camp, nr) {
  const p = raidPrep(S, nr); let d = campDefense(S, camp);
  if (p && p.fire) d += prepGain(S, camp, nr, 'fire');
  if (p && p.mil) d += prepGain(S, camp, nr, 'mil');
  return d;
}
// 先烧不值钱的燃料
export function burnUnits(st, need) { for (const f of [...FUEL_ORDER].reverse()) { if (need <= 0) break; const take = Math.min(st[f] || 0, need / FUEL[f]); st[f] = (st[f] || 0) - take; need -= take * FUEL[f]; } }
export function doPrep(S, kind, auto) {
  const nr = nextRaid(S); if (!nr || nr.in > RAID_PREP) return { ok: false, reason: '지금은 공격이 들어오지 않습니다' };
  const camp = getCamp(S, nr.camp);
  const p = raidPrep(S, nr) || (S.rprep = { k: nr.k, camp: camp.id, t: nr.t });
  if (p[kind]) return { ok: false, reason: '이미 준비되어 있음' };
  const cost = prepCost(S, camp, kind), until = nr.in + 60;
  if (kind === 'fire') {
    if (fuelUnitsOf(camp.stock) < cost) return { ok: false, reason: `연료로는 충분하지 않습니다. ${cost} 단위가 필요합니다.` };
    burnUnits(camp.stock, cost);
  } else if (kind === 'mil') {
    if ((camp.stock.food || 0) < cost) return { ok: false, reason: `요리로는 충분하지 않습니다. ${cost}이 필요합니다.` };
    camp.stock.food -= cost; addBuff(S, camp, 'prod', -0.2, until, '벽에 민병대');
  } else if (kind === 'hide') addBuff(S, camp, 'prod', -0.1, until, '보급품 모으기');
  else return { ok: false };
  p[kind] = auto ? 2 : 1;
  dirty(S);
  return { ok: true };
}
export function setRaidAuto(S, on) { S.rAuto = !!on; }
function raidsStep(S, dt) {
  const R = rt(S);
  const nr = nextRaid(S);
  if (!nr) return;
  const rw = S.rwarn || (S.rwarn = { prep: -1, warn: R.warnRaid ?? -1 });
  const c = getCamp(S, nr.camp), rn = raiderName(S, c);
  if (nr.in <= RAID_PREP && rw.prep !== nr.k) {
    rw.prep = nr.k;
    logMsg(S, `🐺 정찰 군인이 ${rn}이 "${c.name}" 방향으로 다가오는 것을 발견했으며 약 ${Math.round(nr.in / 60)}분 후에 도착할 예정입니다(강도 ${raidStrength(S, c, nr)}, 방어 ${raidDefense(S, c, nr)}). 벽에 불을 지르고 미리 민병대를 부를 수 있습니다.`, 'warn', { act: 'raidp', label: '전쟁을 준비하세요' });
  }
  // 没人下令：守不住的话，守夜人自己备战（火墙要留够燃料，民兵要留够熟食）
  if (nr.in <= RAID_AUTO && S.rAuto !== false && rw.auto !== nr.k) {
    rw.auto = nr.k;
    const str = raidStrength(S, c, nr), did = [];
    const p0 = raidPrep(S, nr);
    if (!p0 || !(p0.fire || p0.mil || p0.hide)) {
      if (raidDefense(S, c, nr) < str && fuelUnitsOf(c.stock) >= prepCost(S, c, 'fire') * 3 && doPrep(S, 'fire', true).ok) did.push('불의 벽에 불을 붙였다');
      if (raidDefense(S, c, nr) < str && (c.stock.food || 0) >= prepCost(S, c, 'mil') * 3 && doPrep(S, 'mil', true).ok) did.push('민병대가 소집됐다.');
      if (raidDefense(S, c, nr) < str && doPrep(S, 'hide', true).ok) did.push('지하실에 보급품을 모았습니다.');
      if (did.length) logMsg(S, `아무도 명령을 내리지 않았습니다. "${c.name}"의 야간 경비원 ${did.join('、')}입니다. (방어 ${raidDefense(S, c, nr)} 대 강도 ${str})`, 'info');
    }
  }
  if (nr.in <= RAID_WARN && rw.warn !== nr.k) {
    rw.warn = nr.k;
    logMsg(S, `${rn}이(가) "${c.name}"에 접근하고 있습니다! (강도 ${raidStrength(S, c, nr)}, 방어 ${raidDefense(S, c, nr)})`, 'warn', { act: 'raidp', label: '보기' });
  }
  if (nr.t >= S.t && nr.t < S.t + dt) {
    if (nr.x) (S.raidX ||= {})[nr.hk] = nr.j; else S.raidDone = nr.k;
    const camp = getCamp(S, nr.camp), p = raidPrep(S, nr) || {};
    const atMain = camp.id === journeyOf(S).main && !!ruleNow(S), ns = atMain ? nsOf(S) : null;
    const str = raidStrength(S, camp, nr), def = raidDefense(S, camp, nr);
    const helped = [p.fire && '방화벽', p.mil && '시민군'].filter(Boolean);
    S.stats.raids++;
    const name = raiderName(S, camp);
    (S.stats.raidKinds ||= {})[name] = (S.stats.raidKinds[name] || 0) + 1;
    // 巨像守卫：派了人、歇够了，就把整次袭营挡在外面
    const guard = def < str && S.buildings.find(b => b.camp === camp.id && b.type === 'colossus' && b.workers > 0 && !(b.cd > S.t));
    if (guard) {
      guard.cd = S.t + BLD.colossus.guardCd / (1 + 0.15 * (guard.lvl - 1));
      S.stats.raidsWon++; bumpMood(camp, 6, -3);
      if (ns) { ns.raidW = (ns.raidW || 0) + 1; wolfSafe(S, camp, ns); }
      logMsg(S, `🗿 거상 수호자가 일어섰고 ${name}(강도 ${str}) 중 어느 것도 "${camp.name}"를 입력할 수 없습니다. 경비원은 ${Math.round((guard.cd - S.t) / 60)}분 동안 휴식을 취합니다.`, 'good');
      R.fx.push({ kind: 'raid', camp: camp.id, won: true, str, def: str, t: S.t, guard: guard.id });
    } else if (def < str && colossusScare(S)) {
      // 1.1 蒸汽巨像：每天替你吓退一次守不住的袭营
      S.stats.raidsWon++; bumpMood(camp, 4, -2);
      if (ns) { ns.raidW = (ns.raidW || 0) + 1; wolfSafe(S, camp, ns); }
      logMsg(S, `🗿 증기 거상이 휘파람을 불며 커다란 흰 증기 구름을 뿜어냈습니다. ${name}(힘 ${str})은 "${camp.name}"을(를) 다치지 않은 채로 두고 돌아서 도망갔습니다. Colossus는 오늘 더 이상 움직이지 않을 것입니다.`, 'good');
      R.fx.push({ kind: 'raid', camp: camp.id, won: true, str, def: str, t: S.t, scare: 1 });
    } else if (def >= str) {
      S.stats.raidsWon++;
      if (ns) { ns.raidW = (ns.raidW || 0) + 1; wolfSafe(S, camp, ns); }
      const wolf = campRule(S, camp) === 'wolf', g = Math.round(str * 2 * (wolf ? RULE_FX.wolfLoot : 1) * (1 + buffOf(S, camp, 'loot')));
      camp.stock.game = Math.max(camp.stock.game || 0, Math.min(storeCap(S, camp), (camp.stock.game || 0) + g));
      bumpMood(camp, 4, -2);
      logMsg(S, `${helped.length ? '화살탑 및' + helped.join('、') : '화살탑'}이(가) ${name}(${def} 대 ${str})을(를) 이기고 생고기 ${g}${wolf ? '(늑대 무리 영역, 전리품 두 배)' : ''}을(를) 획득했습니다.`, 'good');
      R.fx.push({ kind: 'raid', camp: camp.id, won: true, str, def, t: S.t });
    } else {
      const r = 1 - def / str, loss = 0.3 * r * (p.hide ? 0.5 : 1); // 收拢过物资只丢一半
      for (const k in camp.stock) camp.stock[k] *= (1 - loss);
      let kill = Math.min(Math.max(0, camp.people - MIN_PEOPLE), Math.round(r * 3 + 0.4));
      if (p.hide) kill = Math.floor(kill / 2);
      camp.people -= kill; S.stats.deaths += kill; bumpMood(camp, -8, 6);
      if (ns) { ns.raidL = (ns.raidL || 0) + 1; ns.hurt = (ns.hurt || 0) + kill; }
      trimWorkers(S, camp);
      logMsg(S, `${name}급히 들어갔다"${camp.name}"(방어${def}오른쪽${str}): 보급품이 약탈당했습니다.${Math.round(100 * loss)}%${p.hide ? '(지하실에 갇힌 사람들은 구원받았습니다)' : ''}${kill ? `，${kill}사람이 죽었어요` : ''}. 화살탑를 몇 개 더 만들고 다음 번에는 벽에 불을 붙이고 민병대를 미리 부르세요.`, 'bad');
      R.fx.push({ kind: 'raid', camp: camp.id, won: false, str, def, t: S.t });
    }
  }
}

// ---------- 永恒之炉 ----------
export function eternalCamp(S) {
  const l = LANDMARKS[6];
  return S.camps.find(c => Math.hypot(c.x - l.x, c.y - l.row) <= FOUND_DIST + 2) || null;
}
// 永恒之炉分三层：永恒炉件的产能在目标以上撑满 3 分钟，炉子吃下这段时间的炉件，亮起一层
function lightEternal(S) {
  const c = eternalCamp(S), E = S.eternal, n = ETERNAL_STAGES[E.stage];
  let eat = n * HOLD / 60;
  for (const cc of [c, ...S.camps]) { const t = Math.min(eat, cc.stock.heart || 0); cc.stock.heart = (cc.stock.heart || 0) - t; eat -= t; }
  E.stage++; E.have = 0;
  if (E.stage >= ETERNAL_STAGES.length) {
    const first = !S.meta.graduated;
    S.meta.graduated = true; S.ended = true;
    logMsg(S, STORY.ending, 'story');
    rt(S).fx.push({ kind: 'ending', first });
  } else logMsg(S, `영원의 용광로의 ${E.stage}번째 용광로가 켜졌습니다. 다음 레벨에서는 ${ETERNAL_STAGES[E.stage]}/분으로 안정화하려면 영원의 용광로 부품이 필요합니다.`, 'story');
}
// 老界面的「投入炉件」按钮：现在炉子自己吃，按钮只告诉你还差多少
export function deliverEternal(S) {
  const c = eternalCamp(S);
  if (!c) return { ok: false, reason: '행렬이 아직 도착하지 않았습니다 영원의 용광로' };
  if (S.eternal.stage >= ETERNAL_STAGES.length) return { ok: false, reason: '이미 켜져 있음' };
  const n = ETERNAL_STAGES[S.eternal.stage];
  return { ok: false, reason: `영원의 용광로 부품의 생산량은 3분 동안 ${n}/분으로 안정적이며 스토브가 이 층을 스스로 밝힙니다(현재 ${prodRate(S, 'heart').toFixed(1)}/분).` };
}

// ---------- 北迁（重开）----------
export function emberGain(S) {
  let g = 0;
  for (const c of S.camps) g += 2 * getB(S, c.furnace).lvl;
  for (const i of S.founded) if (i > S.site) g += 12 * Math.pow(2, i - 1);
  let p = 0; for (const k in S.stats.prod) p += S.stats.prod[k] * RES[k].t;
  g += Math.floor(4 * Math.log2(1 + p / 2000));
  if (S.eternal.stage) g += 100 * S.eternal.stage;
  return Math.max(0, Math.floor(g * (1 + relicSum(S, 'ember')) * diffOf(S).ember * (S.t < 1800 ? 0 : 1)));
}
// 不再随时重开：只有点燃永恒之炉（通关）以后，才能开一局新的北行，从灰烬营地重新出发。
// 余烬、强化、专家、收集册和遗物都在 meta 里，跟着走
export function migrate(S) {
  if (!S.meta.graduated) return S;
  const N = newRun(S.meta, 0);
  logMsg(N, `새로운 북쪽 여행이 시작됩니다. 이전 여정에서 남은 ${Math.floor(S.meta.embers)}포인트 잔불은 여전히 뜨겁습니다.`, 'good');
  return N;
}
export function buyEmber(S, key) {
  const lvl = up(S, key);
  if (lvl >= EMBER_UPS[key].max) return { ok: false, reason: '이미 풀 레벨' };
  const c = emberCost(key, lvl);
  if (S.meta.embers < c) return { ok: false, reason: `${c}포인트 필요잔불` };
  S.meta.embers -= c; S.meta.ups[key] = lvl + 1;
  dirty(S);
  return { ok: true };
}

// ---------- 离线结算 ----------
// 离线：时间照常走（暴风雪、袭营、吃饭烧火都照算），但物资的净增长按离开多久分段打折入库——这游戏主要是在线玩
// 前 1 小时 40%，1 到 4 小时 20%，4 到 12 小时 10%；超过 12 小时的部分不算（营地停在第 12 小时的样子，不产也不耗）
// 三星产线做的东西多拿一半；离线入库最多填到仓库的 80%，回来不会满仓卡住
export const OFF_SEG = [[3600, 0.4], [4 * 3600, 0.2], [12 * 3600, 0.1]];
export const OFF_CAP = 12 * 3600, OFF_STAR3 = 1.5, OFF_FILL = 0.8;
export const OFFLINE_RATE = OFF_SEG[0][1];
// 离开 secs 秒，平均按多少入库
export function offlineRate(secs) {
  const n = Math.min(secs, OFF_CAP); if (n <= 0) return OFF_SEG[0][1];
  let got = 0, t = 0;
  for (const [end, r] of OFF_SEG) { got += Math.max(0, Math.min(n, end) - t) * r; t = end; }
  return got / n;
}
export function offlineRateOf(S, k, base) { return Math.min(1, base * (plinesOf(S).some(l => l.r === k && l.star >= 3) ? OFF_STAR3 : 1)); }
export function catchUp(S, secs, flat) {
  const before = snapshot(S);
  const lines0 = plinesOf(S).map(l => ({ r: l.r, main: l.main, star: l.star, made: S.stats.prod[l.r] || 0 }));
  const stage0 = journeyOf(S).stage;
  const camp0 = new Map(S.camps.map(c => [c.id, { ...c.stock }])), ship0 = shipSum(S); // 路上的货不算增长
  const sim = Math.min(secs, OFF_CAP), rate = flat != null ? flat : offlineRate(secs);
  const dt = sim > 3 * 3600 ? 30 : sim > 600 ? 10 : 2;
  let left = sim;
  const R = rt(S), t0 = S.t;
  if (rate < 1) R.histOff = { stock: camp0, rate };
  R.offline = true;
  while (left > 0) { const d = Math.min(dt, left); step(S, d); left -= d; }
  R.histOff = null; R.offline = false;
  if (rate < 1) offlineTrim(S, camp0, k => offlineRateOf(S, k, rate), ship0);
  // 曲线上标出离线的那一段
  if (sim >= 60) for (const c of S.camps) { const H = c.hist || (c.hist = {}); (H.off || (H.off = [])).push([Math.round(t0), Math.round(S.t)]); if (H.off.length > 16) H.off.shift(); }
  const out = diffSnap(before, snapshot(S), secs);
  out.rate = rate; out.sim = sim; out.capped = secs > OFF_CAP;
  // 回来时的报告：每条产线这段时间做了多少（按入库的比例算）、升了几颗星
  out.lines = lines0.map(l => {
    const L = plinesOf(S).find(x => x.r === l.r), made = (S.stats.prod[l.r] || 0) - l.made, rk = rate < 1 ? offlineRateOf(S, l.r, rate) : 1;
    return { r: l.r, main: l.main, made, got: made * rk, rk, per: sim > 0 ? made / sim * 60 : 0, star0: l.star, star: L ? L.star : l.star };
  });
  out.stage0 = stage0; out.stage = journeyOf(S).stage;
  return out;
}
// 按物资种类算全部营地（加上路上的货）的净增长，只留 rate 那一份；多出来的从涨了的营地里按涨幅扣掉（物流网来回搬的不算增长）
function shipSum(S) { const m = {}; for (const s of ships(S)) m[s.k] = (m[s.k] || 0) + s.n; return m; }
function offlineTrim(S, camp0, rateOf, ship0 = {}) {
  const ship1 = shipSum(S);
  for (const k of RES_KEYS) {
    const rate = rateOf(k);
    let net = (ship1[k] || 0) - (ship0[k] || 0), pos = 0;
    const gains = [];
    for (const c of S.camps) {
      const d = (c.stock[k] || 0) - ((camp0.get(c.id) || {})[k] || 0);
      net += d;
      if (d > 0) { pos += d; gains.push([c, d]); }
    }
    if (net <= 0 || pos <= 0) continue;
    const cut = net * (1 - rate);
    for (const [c, d] of gains) c.stock[k] = Math.max(0, c.stock[k] - cut * d / pos);
  }
  // 离线入库最多填到仓库的 80%（本来就比这多的不动）
  for (const c of S.camps) {
    const lim = storeCap(S, c) * OFF_FILL, s0 = camp0.get(c.id) || {};
    for (const k in c.stock) if (c.stock[k] > lim && c.stock[k] > (s0[k] || 0)) c.stock[k] = Math.max(s0[k] || 0, lim);
  }
}
function snapshot(S) {
  const stock = {};
  for (const c of S.camps) for (const k in c.stock) stock[k] = (stock[k] || 0) + c.stock[k];
  for (const s of ships(S)) stock[s.k] = (stock[s.k] || 0) + s.n;
  return { stock, people: S.camps.reduce((a, c) => a + c.people, 0), deaths: S.stats.deaths, arrivals: S.stats.arrivals, raids: S.stats.raids, won: S.stats.raidsWon, bliz: S.stats.blizzards };
}
function diffSnap(a, b, secs) {
  const res = {};
  for (const k of RES_KEYS) { const d = (b.stock[k] || 0) - (a.stock[k] || 0); if (Math.abs(d) >= 1) res[k] = Math.round(d); }
  return { secs, res, people: b.people - a.people, deaths: b.deaths - a.deaths, arrivals: b.arrivals - a.arrivals, raids: b.raids - a.raids, raidsWon: b.won - a.won, blizzards: b.bliz - a.bliz };
}

// ---------- 存档 ----------
export function serialize(S) {
  const o = { ...S };
  o.reveal = rle(S.reveal);
  o.spots = {}; for (const k in S.spots) o.spots[k] = Math.round(S.spots[k] * 10) / 10;
  o.savedAt = Date.now();
  return JSON.stringify(o);
}
export function deserialize(str) {
  const o = JSON.parse(str);
  if (!o || o.v !== VERSION || !o.camps) throw new Error('저장 형식이 잘못되었습니다.');
  o.rows = setRows(o.rows || BASE_H); // 地图往北接到了哪一行：先接好再读迷雾
  o.reveal = unrle(o.reveal, W * H);
  fixMeta(o.meta);
  rt(o);
  loadPicks(o); // 1.1 分岔北境：选过的路先交给地图生成
  growNext(o); // 已经在世界之脊或北境：下一站要用的地图先接上
  if (!o.roads) migrateNet(o); // 1.1 以前的存档：运输线和补给站的路换成物流网
  migrateSpec(o);
  // 1.1 以前的存档：在岗的建筑从熟练 1 级起；第三章以后的，读档后过一天开始报寒潮
  // 1.1 自动机按仓算：老存档营地里的自动机装回各个仓，都是劳工型
  if (!o.bt) { o.bt = 1; for (const c of o.camps) { let left = c.bots || 0; for (const b of o.buildings) if (b.camp === c.id && b.type === 'bay' && left > 0) { const k = Math.min(left, BOT.bay * b.lvl); b.bots = k; left -= k; } } }
  if (!o.sk) { o.sk = 1; for (const b of o.buildings) if (skillable(b) && b.workers > 0 && b.xp == null) { b.xp = SKILL_CUM[0]; b.wRef = b.workers; } }
  if (!o.cold && journeyOf(o).stage >= COLD.from) o.cold = { t0: o.t + Math.max(0, Math.min(OFF_CAP, (Date.now() - (o.savedAt || Date.now())) / 1000)) };
  return o;
}
// 1.1 以前的营地没有特产：北境的站按名字找回那一站的地貌，别的按暖圈里的矿点
function migrateSpec(S) {
  const J = journeyOf(S);
  for (const c of S.camps) {
    if (c.spec) continue;
    let st = null;
    for (let k = SPINE + 1; k <= J.stage + 1 && !st; k++) { const x = stopOf(S, k); if (x && x.n === c.name) st = x; }
    const fb = getB(S, c.furnace);
    c.spec = specForStop(S, c, st, furnaceRadius(fb ? fb.lvl : 1) + 1);
  }
}
function rle(arr) { const out = []; let cur = arr[0], n = 0; for (let i = 0; i < arr.length; i++) { if (arr[i] === cur) n++; else { out.push(n); cur = arr[i]; n = 1; } } out.push(n); return (arr[0] ? '1:' : '0:') + out.join(','); }
function unrle(s, N) { const a = new Uint8Array(N); const [h, body] = s.split(':'); let v = +h, p = 0; for (const n of body.split(',').map(Number)) { if (v) a.fill(1, p, Math.min(N, p + n)); p += n; v = 1 - v; } return a; }
// 地图往北接一段：迷雾数组跟着变长，缓存重算，画面那边收到 mapGrew 再补上新的地形
export function growMap(S, rows) {
  if (rows <= (S.rows || BASE_H) && rows <= H) return false;
  const old = S.reveal, n = setRows(Math.max(rows, S.rows || BASE_H));
  if (old.length < W * n) { S.reveal = new Uint8Array(W * n); S.reveal.set(old); }
  S.rows = n;
  getWorld(S.runSeed);
  const R = rt(S); R.mapGrew = (R.mapGrew || 0) + 1; R.revealN = (R.revealN || 0) + 1; R.revealDirty = true;
  dirty(S);
  return true;
}
// 下一站（和再下一站的路）要用到的地图都得先生成好
export function growFor(S, y) { return growMap(S, rowsFor(y)); }

export { W, H, mulberry32 };

// ---------- 随机事件：只在玩家在线时由界面触发；选择的后果写进库存或营地的临时加成 ----------
// 1.1 全局的临时加成（奇遇给的：研究 ×2、商会收价 +20%……）
export function gBuff(S, k) { let v = 0; if (S.gbuffs) for (const b of S.gbuffs) if (b.k === k && b.until > S.t) v += b.v; return v; }
export function gBuffAdd(S, k, v, secs, n) { S.gbuffs = (S.gbuffs || []).filter(b => b.until > S.t); S.gbuffs.push({ k, v, until: S.t + secs, n }); }
export function buffOf(S, camp, k) { let v = 0; if (camp.buffs) for (const b of camp.buffs) if (b.k === k && b.until > S.t) v += b.v; return v; }
export function addBuff(S, camp, k, v, secs, n) { camp.buffs = (camp.buffs || []).filter(b => b.until > S.t); camp.buffs.push({ k, v, until: S.t + secs, n }); }
const fmtN = x => x >= 100 ? Math.round(x) : Math.round(x * 10) / 10;
const rawOfTier = t => RES_KEYS.filter(k => RES[k].t === t && RES[k].raw && !RES[k].stage);
const EVENTS = [
  { id: 'wander', title: '눈 속의 방랑자', w: 3,
    ctx: (S, c, r) => ({ n: 3 + Math.floor(r() * 5) }),
    text: (S, c, x) => `${x.n}명의 방랑자들이 야영지 밖에서 눈 속에서 방황하고 있었습니다. 너무 추워서 말을 할 수 없었습니다. 지도자는 불에 더 가까이 다가갈 수 있는지 물었습니다.`,
    opts: [
      { t: '그들을 받아들이다', d: (S, c, x) => `+${x.n}명 · 요리 −${x.n * 15} · 희망 +4${freeBeds(S, c) < x.n ? '· 침대가 부족할 경우 먼저 오두막에서 기다리세요.' : ''}`, ok: (S, c, x) => (c.stock.food || 0) >= x.n * 15, go: (S, c, x) => { c.stock.food -= x.n * 15; const a = addPeople(S, c, x.n); bumpMood(c, 4, 0); return `${x.n}노숙자가 머물렀다${a.wait ? `，${a.wait}사람들은 먼저 오두막에서 침대를 기다립니다` : ''}。`; } },
      { t: '음식을 나눠주고 떠나라고 요청하세요', d: (S, c, x) => `요리 −${x.n * 6} · 잔불 +3`, ok: (S, c, x) => (c.stock.food || 0) >= x.n * 6, go: (S, c, x) => { c.stock.food -= x.n * 6; S.meta.embers += 3; S.meta.emberTotal += 3; return '그들은 그에게 감사를 표하고 남쪽으로 걸어갔습니다.'; } },
      { t: '폐쇄하다', d: () => '희망 −3', go: (S, c) => { bumpMood(c, -3, 0); return '그들은 바람과 눈 속에서 천천히 걸어가고 있었고, 누군가는 그들의 뒷모습을 계속 지켜보고 있었다.'; } },
    ] },
  { id: 'cache', title: '얼음 아래 오래된 상자', w: 2, cond: S => S.t > 900,
    ctx: (S, c, r) => ({ lucky: r() < 0.7, t: Math.max(1, Math.min(S.known, tierOfRow(c.y))) }),
    text: () => '노동자들은 얼음 아래에 잠긴 양철 상자를 파냈는데, 거기에는 이해할 수 없는 말이 새겨져 있었습니다.',
    opts: [
      { t: '보기를 들어 올려 열어보세요.', d: () => '좋은 일이 있을 수도 있고, 시간낭비일 수도 있다', go: (S, c, x) => {
        if (!x.lucky) { addBuff(S, c, 'prod', -0.1, 180, '누군가 상자를 들어 올려 손을 베었습니다.'); return '상자는 비어 있었고 누군가 손을 긁어서 모두가 잠시 동안 천천히 작업했습니다.'; }
        const cap = storeCap(S, c), got = [];
        for (const k of rawOfTier(x.t).slice(0, 2)) { const a = Math.round(cap * 0.08); c.stock[k] = Math.max(c.stock[k] || 0, Math.min(cap, (c.stock[k] || 0) + a)); got.push(`${RES[k].n} +${a}`); }
        return `상자에는 소모품 ${got.join('，')}이(가) 들어 있습니다.`; } },
      { t: '정찰 막사연구에게 주세요', d: () => '잔불 +4', go: S => { S.meta.embers += 4; S.meta.emberTotal += 4; return '상자에 적힌 글씨는 북쪽으로 여행하는 사람들이 기억할 옛 길이다.'; } },
    ] },
  { id: 'sick', title: '누군가 아프다', w: 2, cond: (S, c) => (rt(S).c[c.id] || {}).tH < 12 && c.people >= 8,
    ctx: () => ({}),
    text: () => '여러 사람이 열이 나고 천막에서는 기침 소리가 잇달아 들렸습니다.',
    opts: [
      { t: '요리와 뜨거운 국물도 조심하세요', d: (S, c) => `요리 −${Math.ceil(c.people * 0.8)}`, ok: (S, c) => (c.stock.food || 0) >= Math.ceil(c.people * 0.8), go: (S, c) => { c.stock.food -= Math.ceil(c.people * 0.8); return '며칠 동안 뜨거운 국물을 마시고 나니 환자가 좋아졌습니다.'; } },
      { t: '용광로를 조금 더 뜨겁게 굽기', d: () => '바디감 +6°, 연료 소비량 +40% (8분)', go: (S, c) => { addBuff(S, c, 'heat', 6, 480, '용광로가 격렬하게 타오른다'); addBuff(S, c, 'fuel', 0.4, 480, '용광로가 격렬하게 타오른다'); return '야영지는 훨씬 더 따뜻해지는 것을 느꼈고, 환자의 열은 천천히 가라앉았습니다.'; } },
      { t: '그들이 일을 계속하도록 놔두세요', d: () => '생산량 −15% (8분) · 불만 +5', go: (S, c) => { addBuff(S, c, 'prod', -0.15, 480, '아플 때 일하기'); bumpMood(c, 0, 5); return '모두가 열심히 일했고 속도가 느려졌습니다.'; } },
    ] },
  { id: 'caravan', title: '지나가는 썰매 캐러밴', w: 3,
    ctx: (S, c, r) => {
      const cap = storeCap(S, c), ks = RES_KEYS.filter(k => RES[k].t <= S.known);
      const give = ks.filter(k => (c.stock[k] || 0) >= cap * 0.6).sort((a, b) => (c.stock[b] || 0) - (c.stock[a] || 0));
      const want = ks.filter(k => (c.stock[k] || 0) < cap * 0.3 && k !== 'heart' && k !== 'core' && k !== 'starcore');
      if (!give.length || !want.length) return null;
      const g = give[Math.floor(r() * Math.min(2, give.length))], w = want.filter(k => RES[k].t <= RES[g].t + 1);
      if (!w.length) return null;
      const k2 = w[Math.floor(r() * w.length)], a1 = Math.round(cap * 0.25);
      return { g, a1, k2, a2: fmtN(a1 * resValue(g) / resValue(k2) * 0.6) };
    },
    text: (S, c, x) => `썰매 캐러밴이 야영지 외부에 멈췄습니다. 그들은 ${x.a2} ${RES[x.k2].n}를 ${x.a1} ${RES[x.g].n}에 기꺼이 교환하려고 합니다.`,
    opts: [
      { t: '거래를 하다', d: (S, c, x) => `${RES[x.g].n} −${x.a1} · ${RES[x.k2].n} +${x.a2}`, ok: (S, c, x) => (c.stock[x.g] || 0) >= x.a1, go: (S, c, x) => { c.stock[x.g] -= x.a1; c.stock[x.k2] = Math.min(storeCap(S, c), (c.stock[x.k2] || 0) + x.a2); return '캐러밴은 물품 수를 세고 썰매를 동쪽으로 가져갔습니다.'; } },
      { t: '메시지를 구매하세요', d: () => '요리 −30 · 북쪽에서 안개 조각을 발견하세요', ok: (S, c) => (c.stock.food || 0) >= 30, go: (S, c) => { c.stock.food -= 30; revealCircle(S, c.x + 6, c.y + 26, 8); return '캐러밴은 스케치를 그렸습니다. 북쪽에 이전에 아무도 가본 적이 없는 곳이 있습니다.'; } },
      { t: '변경하지 않음', d: () => '아무 일도 일어나지 않을 것이다', go: () => '캐러밴은 오래 머물지 않았습니다.' },
    ] },
  { id: 'howl', title: '밤에 울부짖다', w: 2, cond: S => { const n = nextRaid(S); return n && n.in < 1200 && n.in > 120; },
    ctx: S => ({ camp: nextRaid(S).camp }),
    text: () => '지난 며칠 밤, 야영지 밖에서 늑대 울부짖는 소리가 항상 들리고, 늑대들이 점점 더 가까워지고 있습니다.',
    opts: [
      { t: '야간경비원을 보내라', d: () => '목재 −60 · 방어 +40% (20분)', ok: (S, c) => (c.stock.wood || 0) >= 60, go: (S, c) => { c.stock.wood -= 60; addBuff(S, c, 'def', 0.4, 1200, '야간 경비원'); return '모닥불 주변에는 모닥불과 야간 경비원이 몇 명 더있었습니다.'; } },
      { t: '무시하다', d: () => '아무 일도 일어나지 않을 것이다', go: () => '늑대의 울부짖음은 새벽이 되기 전에 그쳤습니다.' },
    ] },
  { id: 'furnace', title: '용광로의 비정상적인 소음', w: 2, cond: (S, c) => getB(S, c.furnace).lvl >= 2,
    ctx: () => ({}),
    text: () => '용광로 안쪽 깊은 곳에서 둔탁한 노크 소리가 들리고 화로의 불이 깜빡거렸다.',
    opts: [
      { t: '휴전 유지', d: (S, c) => `${S.known >= 2 ? '철괴' : '목판'} −40 · 다음 15분 동안 연료 25% 할인 용광로`, ok: (S, c) => (c.stock[S.known >= 2 ? 'iron' : 'plank'] || 0) >= 40, go: (S, c) => { c.stock[S.known >= 2 ? 'iron' : 'plank'] -= 40; addBuff(S, c, 'fuel', -0.25, 900, '용광로가 정밀 검사되었습니다.'); return '깨진 용광로 벽돌 몇 개를 교체한 후 용광로는 안정적이고 경제적으로 연소되었습니다.'; } },
      { t: '내버려둬', d: () => '10분 후 용광로는 연료를 20% 더 태웁니다.', go: (S, c) => { addBuff(S, c, 'fuel', 0.2, 600, '용광로 공기 누출'); return '용광로는 여전히 평소보다 더 빨리 울리고 불타고 있습니다.'; } },
    ] },
  { id: 'feast', title: '장야모닥불은', w: 2, cond: (S, c) => (c.stock.food || 0) >= c.people * 12 && c.people >= 10,
    ctx: () => ({}),
    text: () => '누군가 모닥불 파티를 열자고 제안했습니다. 노래하고, 바베큐하고, 남부에 대한 이야기를 나누는 것이었습니다.',
    opts: [
      { t: '하나 잡아', d: (S, c) => `요리 −${Math.ceil(c.people * 3)} · 생산량 +12% (10분) · 불만 −5`, ok: (S, c) => (c.stock.food || 0) >= Math.ceil(c.people * 3), go: (S, c) => { c.stock.food -= Math.ceil(c.people * 3); addBuff(S, c, 'prod', 0.12, 600, '모닥불은 회의 후 매우 의욕이 넘쳤습니다.'); bumpMood(c, 0, -5); return '노래는 자정까지 계속됐다. 다음날 모두가 매우 의욕이 넘쳤습니다.'; } },
      { t: '또 다른 날', d: () => '희망 −2', go: (S, c) => { bumpMood(c, -2, 0); return '다들 조금 실망했지만 다시 일을 시작했습니다.'; } },
    ] },
  { id: 'child', title: '북쪽에서 아이', w: 1, cond: S => S.t > 1800,
    ctx: () => ({}),
    text: () => '아이가 눈과 물로 주름진 낡은 지도를 손에 들고 북쪽에서 홀로 걸어왔다.',
    opts: [
      { t: '그녀를 데려가세요', d: () => '+1명 · 북쪽 안개 조각을 발견하세요 · 희망 +3', go: (S, c) => { addPeople(S, c, 1); bumpMood(c, 3, 0); revealCircle(S, c.x - 5, c.y + 30, 9); return '그녀는 북상으로 향하는 도로가 표시된 지도를 정찰 막사에게 건네주었습니다.'; } },
      { t: '그녀에게 길을 물어보고 남쪽으로 보내라', d: () => '북쪽에서 안개 조각을 발견하세요 · 잔불 +2', go: (S, c) => { revealCircle(S, c.x - 5, c.y + 30, 9); S.meta.embers += 2; S.meta.emberTotal += 2; return '그녀는 북쪽을 가리킨 다음 캐러밴 남쪽을 따라갔습니다.'; } },
    ] },
  { id: 'storm', title: '눈보라 이브', w: 4, cond: S => weatherAt(S, S.t).warn,
    ctx: () => ({}),
    text: () => '수평선에 회색 벽이 눌려져 있습니다. 눈보라가 출시됩니다.',
    opts: [
      { t: '집을 강화하다', d: () => '목재 −80 · 이 눈보라의 냉각 성능이 절반으로 줄어듭니다.', ok: (S, c) => (c.stock.wood || 0) >= 80, go: (S, c) => { c.stock.wood -= 80; const w = weatherAt(S, S.t); addBuff(S, c, 'shield', 0.5, (w.slot ? w.slot.end - S.t : 1800) + 60, '집이 강화되었습니다.'); return '모두가 목판을 함께 못으로 박고 틈을 막았습니다.'; } },
      { t: '샤오왕 용광로', d: () => '바디감 +8°, ​​연료 소모량 +50% (15분)', go: (S, c) => { addBuff(S, c, 'heat', 8, 900, '용광로가 격렬하게 타오른다'); addBuff(S, c, 'fuel', 0.5, 900, '용광로가 격렬하게 타오른다'); return '용광로의 불은 하늘의 절반을 붉게 물들였습니다.'; } },
      { t: '평소처럼 일하세요', d: () => '아무 일도 일어나지 않을 것이다', go: () => '모두들 외투를 단단히 감싸고 계속 일했습니다.' },
    ] },
];
export const EVENT_GAP = [600, 1020]; // 两次事件之间 10～17 分钟
// 到时间就抽一个事件（只由在线的界面调用）；返回 null 表示这次没有合适的
// ---------- 在线小惊喜：极光夜一起看极光、走失的驯鹿、流星坠落点（只在玩家在线时出现，点一下就有好处）----------
export const SUR_GAP = [900, 1800], SUR_LIFE = { deer: 240, meteor: 480 };
function surTile(S, camp, rnd) {
  const w = getWorld(S.runSeed), R = rebuild(S), r0 = Math.max(3.5, heatRadius(S, camp) - 1.5), r1 = heatRadius(S, camp) + 3;
  for (let k = 0; k < 160; k++) {
    const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0) * Math.min(1, 0.5 + k / 80), x = Math.floor(camp.x + Math.cos(a) * r), y = Math.floor(camp.y + Math.sin(a) * r);
    if (x < 2 || x > W - 3 || y < 2 || y > H - 3) continue;
    // 周围一圈也要空着：驯鹿绕着走、流星坑有一格多宽，不能压到树、矿、岩石、建筑和蓝图
    let bad = siteAt(S, x, y, 1) || caravanAt(S, x, y);
    for (let dy = -1; dy <= 1 && !bad; dy++) for (let dx = -1; dx <= 1 && !bad; dx++) {
      const xx = x + dx, yy = y + dy, i = idx(xx, yy);
      if (w.terrain[i] !== T_SNOW || S.reveal[i] !== 1 || R.occ[i] || R.beltOcc.has(i) || w.spot[i] >= 0 || landmarkBlock(xx, yy, S)) bad = true;
      else for (const q of S.queue || []) { const s = BLD[q.type].size; if (xx >= q.x && xx < q.x + s && yy >= q.y && yy < q.y + s) { bad = true; break; } }
    }
    if (bad) continue;
    return { x, y };
  }
  return null;
}
export function rollSurprise(S, spawn = true) {
  const R = rt(S);
  if (S.sur && S.t > S.sur.until) { S.sur = null; }
  // 极光夜：每个极光夜可以一起看一次
  const sky = skyAt(S, S.t), night = Math.floor(S.t / DAY_LEN);
  if (sky.aurora > 0.25 && S.aurSeen !== night) { S.aurSeen = night; S.aurOpen = night; R.fx.push({ kind: 'aurora' }); logMsg(S, '🌌 밤하늘이 오로라를 밝혔고, 야영지의 모든 사람들이 달려와 구경했습니다.', 'good', { act: 'aurora', label: '함께 시청하기' }); }
  if (S.aurOpen != null && (S.aurOpen !== night || sky.aurora < 0.15)) S.aurOpen = null;
  if (!spawn) return null;
  if (S.surNext == null) S.surNext = Math.max(S.t + 600, 1200);
  if (S.sur || S.t < S.surNext) return null;
  const rnd = mulberry32((Math.floor(S.t) * 17) ^ (S.runSeed * 92821));
  const c = getCamp(S, S.active) || S.camps[0], met = campRule(S, c) === 'meteor'; // 陨石雨：流星坑多、来得勤
  S.surNext = S.t + (SUR_GAP[0] + rnd() * (SUR_GAP[1] - SUR_GAP[0])) * (met ? 0.55 : 1);
  const kind = S.known >= 2 && rnd() < (met ? 0.85 : 0.45) ? 'meteor' : 'deer';
  const at = surTile(S, c, rnd); if (!at) return null;
  S.sur = { kind, camp: c.id, x: at.x, y: at.y, t0: S.t, until: S.t + SUR_LIFE[kind], id: S.nextId++ };
  R.fx.push({ kind: 'sur', sur: S.sur });
  return S.sur;
}
export function surReward(S, sur) {
  const t = Math.min(S.known, 7);
  if (sur.kind === 'deer') return { res: { food: 30 + 10 * t }, hope: 3 }; // 驯鹿背上的褡裢里有别的营地丢下的干粮
  const k = t >= 6 ? 'star' : t >= 5 ? 'crystal' : t >= 3 ? 'steel' : 'iron';
  const res = { [k]: { star: 25, crystal: 60, steel: 50, iron: 60 }[k] };
  if (sur.camp != null && campRule(S, getCamp(S, sur.camp)) === 'meteor') res.starcore = 12; // 陨石雨的坑底有星核
  return { res, embers: 1 + Math.floor(t / 2) };
}
export function claimSurprise(S) {
  const sur = S.sur; if (!sur) return { ok: false, reason: '이미 사라졌어' };
  const c = getCamp(S, sur.camp) || S.camps[0], rw = surReward(S, sur);
  for (const k in rw.res) c.stock[k] = (c.stock[k] || 0) + rw.res[k];
  if (rw.embers) S.meta.embers = (S.meta.embers || 0) + rw.embers;
  if (rw.hope) c.hope = Math.min(100, (c.hope ?? 50) + rw.hope);
  S.sur = null;
  S.stats.sur = (S.stats.sur || 0) + 1;
  (S.stats.surKinds ||= {})[sur.kind] = (S.stats.surKinds[sur.kind] || 0) + 1;
  if (sur.kind === 'meteor' && c.id === journeyOf(S).main && ruleNow(S)) { const ns = nsOf(S); ns.crater = (ns.crater || 0) + 1; }
  rt(S).fx.push({ kind: 'surdone', sur, camp: c.id });
  const got = Object.keys(rw.res).map(k => `${RES[k].n} +${rw.res[k]}`).concat(rw.embers ? [`잔불 +${rw.embers}`] : [], rw.hope ? [`희망 +${rw.hope}`] : []).join(',');
  logMsg(S, sur.kind === 'deer' ? `🦌 길을 잃은 순록은 모두를 따라 "${c.name}"으로 돌아갔고, 가방에는 여전히 건조식품 ${got}이(가) 남아 있었습니다.` : `☄ 모두가 운석 구덩이에서 좋은 것을 발굴했습니다: ${got}.`, 'good');
  return { ok: true, rw };
}
export function watchAurora(S) {
  if (S.aurOpen == null) return { ok: false, reason: '오로라가 흩어졌습니다' };
  S.aurOpen = null;
  for (const c of S.camps) c.hope = Math.min(100, (c.hope ?? 50) + 4);
  S.meta.embers = (S.meta.embers || 0) + 1;
  S.stats.aurora = (S.stats.aurora || 0) + 1;
  if (ruleNow(S) === 'night') { const ns = nsOf(S); ns.aur = (ns.aur || 0) + 1; if (ns.aur >= 5) flag13(S, 'aur5'); }
  logMsg(S, '🌌 다들 하던 일을 내려놓고 한동안 함께 오로라를 시청했습니다. 모두 야영지희망 +4, 잔불 +1.', 'good');
  return { ok: true };
}

// ---------- 篝火庆典：玩家自己张罗的一场庆典。办的时候大家放下活去跳舞（产量减半），散场后人心大振、干劲十足 ----------
export const FEST_LEN = 90, FEST_CD = 1440, FEST_MIN = 20, FEST_AFTER = 720;
export function festCost(S, c) { return { food: Math.ceil(c.people * 2), wood: 40 + Math.ceil(c.people / 2) }; }
export function festLeft(S, c) { return c.festAt == null ? 0 : Math.max(0, c.festAt + FEST_CD - S.t); }
export function festBlock(S, c) {
  if (c.fest) return '축하행사가 진행되고 있어요';
  if (c.people < FEST_MIN) return `야영지가 활성화되려면 ${FEST_MIN}명의 개인이 필요합니다.`;
  if (weatherAt(S, S.t).blizzard) return '눈보라에서는 축하 행사를 열 수 없습니다.';
  const left = festLeft(S, c); if (left > 0) return `마지막 세션이 방금 완료되었으며 ${Math.ceil(left / 60)}분 동안 다른 세션을 사용할 수 없습니다.`;
  const cost = festCost(S, c), miss = Object.keys(cost).filter(k => (c.stock[k] || 0) < cost[k]);
  if (miss.length) return '부족' + miss.map(k => RES[k].n).join(',');
  if ((c.stock.food || 0) - cost.food < c.people * EAT * 30) return '축하 행사가 끝난 후 배급은 모든 사람이 30분 동안 식사하기에 충분하지 않습니다.';
  return null;
}
export function startFest(S, cid) {
  const c = getCamp(S, cid); if (!c) return { ok: false, reason: '그런 야영지는 없습니다' };
  const why = festBlock(S, c); if (why) return { ok: false, reason: why };
  const cost = festCost(S, c);
  for (const k in cost) c.stock[k] -= cost[k];
  c.fest = { t0: S.t, until: S.t + FEST_LEN };
  c.festAt = S.t;
  if (S.buildings.some(b => b.camp === c.id && b.type === 'icefish')) flag13(S, 'icefest');
  addBuff(S, c, 'prod', -0.5, FEST_LEN, '모닥불 축하 (모두 춤추러 갔습니다)');
  rt(S).fx.push({ kind: 'fest', camp: c.id });
  logMsg(S, `"${c.name}"의 모닥불 축하 행사가 시작되었습니다! 모두들 하던 일을 내려놓고 모닥불 주변에서 춤을 추기 시작했습니다.`, 'good');
  return { ok: true };
}
function endFest(S, c) {
  c.fest = null;
  bumpMood(c, 15, -10);
  addBuff(S, c, 'prod', 0.15, FEST_AFTER, '축하잔열');
  S.stats.fests = (S.stats.fests || 0) + 1;
  rt(S).fx.push({ kind: 'festdone', camp: c.id });
  logMsg(S, `"${c.name}" 축하 행사가 끝났습니다. ${FEST_AFTER / 60}분 후에 희망 +15, 불만 −10, 생산량 +15%입니다.`, 'good');
}

// ---------- 人物委托：营地里有名有姓的人提的小心愿，做到了人心更稳，还有回报（只在玩家在线时冒出来）----------
export const REQ_MAX = 2, REQ_LIFE = 3600, REQ_GAP = [1200, 2400];
const REQ_RES = [null, 60, 40, 30, 20, 15, 10, 4]; // 每层的「关卡物资」给多少
function reqReward(S, c, t) {
  const tt = Math.max(1, Math.min(S.known, t || S.known)), k = GATE[tt];
  return { res: { [k]: REQ_RES[tt] }, hope: 5 };
}
function reqOptions(S, c, rnd) {
  const out = [], bs = campBuildings(S, c.id), cr = rt(S).c[c.id] || {}, cap = cr.cap || storeCap(S, c), fb = getB(S, c.furnace);
  const cnt = t => bs.filter(b => b.type === t).length;
  const cand = Object.keys(BLD).filter(t => t !== 'furnace' && t !== 'tent' && (!BLD[t].gather || t === 'nursery') && BLD[t].t <= S.known && BLD[t].t >= Math.max(1, S.known - 2) && cnt(t) < 2);
  if (cand.length) { const t = cand[Math.floor(rnd() * cand.length)]; out.push({ kind: 'build', type: t, n: cnt(t) + 1, rw: reqReward(S, c, BLD[t].t) }); }
  const ups = bs.filter(b => b.type !== 'furnace' && b.type !== 'tent' && BLD[b.type].out && fb && b.lvl < fb.lvl);
  if (ups.length) { const b = ups[Math.floor(rnd() * ups.length)]; out.push({ kind: 'upgrade', bid: b.id, type: b.type, lvl: b.lvl + (b.lvl < 4 ? 2 : 1), rw: reqReward(S, c, BLD[b.type].t) }); }
  const fl = cr.flow || {}, ks = Object.keys(fl).filter(k => RES[k] && RES[k].t <= S.known && (fl[k].p || 0) > 0.3);
  if (ks.length) { const k = ks[Math.floor(rnd() * ks.length)]; const n = Math.max(30, Math.round(Math.min(cap * 0.35, fl[k].p * 25) / 10) * 10); out.push({ kind: 'stock', k, n, rw: { embers: 1 + RES[k].t, hope: 6 } }); }
  if ((c.wait || 0) > 0 || bedsOf(S, c) - c.people < 3) out.push({ kind: 'beds', n: 5, rw: { hope: 6, disc: -4 } });
  return out;
}
export function rollRequest(S) {
  S.reqs ||= [];
  const R = rt(S);
  for (const r of [...S.reqs]) if (S.t > r.until || (r.kind === 'upgrade' && !getB(S, r.bid))) {
    S.reqs = S.reqs.filter(x => x !== r);
    const c = getCamp(S, r.camp); if (c) c.hope = Math.max(0, (c.hope ?? 50) - 2);
    logMsg(S, `도움을 주기에는 너무 늦었습니다: ${reqTitle(S, r)}.`, 'warn');
  }
  if (S.reqNext == null) S.reqNext = Math.max(S.t + 600, 900);
  if (S.t < S.reqNext || S.reqs.length >= REQ_MAX) return null;
  const rnd = mulberry32((Math.floor(S.t) * 31) ^ (S.runSeed * 104729));
  S.reqNext = S.t + REQ_GAP[0] + rnd() * (REQ_GAP[1] - REQ_GAP[0]);
  const c = getCamp(S, S.active) || S.camps[0];
  const opts = reqOptions(S, c, rnd).filter(o => !S.reqs.some(r => r.kind === o.kind && r.camp === c.id));
  if (!opts.length) return null;
  const r = opts[Math.floor(rnd() * opts.length)];
  Object.assign(r, { id: S.nextId++, camp: c.id, t0: S.t, until: S.t + REQ_LIFE });
  S.reqs.push(r);
  R.fx.push({ kind: 'req', camp: c.id, id: r.id });
  return r;
}
export function reqTitle(S, r) {
  if (r.kind === 'build') return r.n > 1 ? `또 다른 ${BLD[r.type].n} 만들기` : `${BLD[r.type].n} 만들기`;
  if (r.kind === 'upgrade') return `${BLD[r.type].n}을(를) ${r.lvl} 레벨로 업그레이드하세요`;
  if (r.kind === 'stock') return `${r.n} ${RES[r.k].n}을(를) 충분히 저축하여 모두에게 나눠주세요`;
  return `${r.n}개의 빈 침대를 만드세요. 아무도 오두막에서 자지 않을 것입니다.`;
}
export function reqProgress(S, r) {
  const c = getCamp(S, r.camp); if (!c) return { cur: 0, need: 1, done: false };
  let cur = 0, need = 1;
  if (r.kind === 'build') { cur = campBuildings(S, c.id).filter(b => b.type === r.type).length; need = r.n; }
  else if (r.kind === 'upgrade') { const b = getB(S, r.bid); cur = b ? b.lvl : 0; need = r.lvl; }
  else if (r.kind === 'stock') { cur = Math.floor(c.stock[r.k] || 0); need = r.n; }
  else { cur = (c.wait || 0) > 0 ? 0 : Math.max(0, Math.floor(freeBeds(S, c))); need = r.n; }
  return { cur: Math.min(cur, need), need, done: cur >= need };
}
export function claimReq(S, id) {
  const r = (S.reqs || []).find(x => x.id === id); if (!r) return { ok: false, reason: '커미션이 없어졌어요' };
  const p = reqProgress(S, r); if (!p.done) return { ok: false, reason: '아직 완료되지 않음' };
  const c = getCamp(S, r.camp);
  if (r.kind === 'stock') c.stock[r.k] = Math.max(0, (c.stock[r.k] || 0) - r.n);
  const rw = r.rw || {};
  for (const k in rw.res || {}) c.stock[k] = (c.stock[k] || 0) + rw.res[k];
  if (rw.embers) S.meta.embers = (S.meta.embers || 0) + rw.embers;
  if (rw.hope) c.hope = Math.min(100, (c.hope ?? 50) + rw.hope);
  if (rw.disc) c.disc = Math.max(0, (c.disc ?? 10) + rw.disc);
  S.reqs = S.reqs.filter(x => x !== r);
  S.stats.reqs = (S.stats.reqs || 0) + 1;
  logMsg(S, `위임 완료: ${reqTitle(S, r)}.`, 'good');
  rt(S).fx.push({ kind: 'reqdone', camp: c.id });
  return { ok: true, rw };
}
export function dropReq(S, id) { S.reqs = (S.reqs || []).filter(x => x.id !== id); return { ok: true }; }
export function rollEvent(S) {
  if (S.evNext == null) S.evNext = Math.max(S.t + 300, 600);
  if (S.ev || S.t < S.evNext) return S.ev || null;
  const r = mulberry32(Math.floor(S.t) ^ (S.runSeed * 7919));
  S.evNext = S.t + EVENT_GAP[0] + r() * (EVENT_GAP[1] - EVENT_GAP[0]);
  const c = getCamp(S, S.active) || S.camps[0];
  const pool = [];
  for (const e of EVENTS) {
    if (e.cond && !e.cond(S, c)) continue;
    if (S.evLast === e.id) continue;
    const x = e.ctx(S, c, r); if (!x) continue;
    for (let i = 0; i < e.w; i++) pool.push([e, x]);
  }
  if (!pool.length) return null;
  const [e, x] = pool[Math.floor(r() * pool.length)];
  S.ev = { id: e.id, camp: c.id, x };
  return S.ev;
}
export function eventView(S) {
  const v = S.ev; if (!v) return null;
  const e = EVENTS.find(e => e.id === v.id), c = getCamp(S, v.camp);
  if (!e || !c) { S.ev = null; return null; }
  return { title: e.title, text: e.text(S, c, v.x), camp: c.name, opts: e.opts.map(o => ({ t: o.t, d: o.d(S, c, v.x), ok: !o.ok || o.ok(S, c, v.x) })) };
}
export function resolveEvent(S, i) {
  const v = S.ev; if (!v) return null;
  const e = EVENTS.find(e => e.id === v.id), c = getCamp(S, v.camp), o = e && e.opts[i];
  if (!o || !c || (o.ok && !o.ok(S, c, v.x))) return null;
  const msg = o.go(S, c, v.x);
  S.ev = null; S.evLast = e.id;
  S.log.push({ t: S.t, msg: `【${e.title}】${msg}`, kind: 'story' }); if (S.log.length > 80) S.log.shift();
  dirty(S);
  return msg;
}
export function activeBuffs(S, camp) { return (camp.buffs || []).filter(b => b.until > S.t); }

// 生产链：这栋建筑的原料从哪些建筑来、产品送到哪些建筑去（同一营地内，按距离取最近的几栋）
export function chainOf(S, b) {
  const d = bdef(b), ctr = x => { const s = BLD[x.type].size; return [x.x + s / 2, x.y + s / 2]; }, [bx, by] = ctr(b);
  const ins = Object.keys(d.in || {}), outs = Object.keys(d.out || {});
  if (b.type === 'furnace') ins.push(...Object.keys(FUEL));
  if (b.type === 'heater') ins.push('coal');
  const takes = (x, r) => x.id !== b.id && ((bdef(x).in && bdef(x).in[r]) || (x.type === 'furnace' && FUEL[r]) || (x.type === 'heater' && r === 'coal'));
  const pick = (r, ok) => S.buildings.filter(x => x.camp === b.camp && x.id !== b.id && ok(x)).map(x => { const [x0, y0] = ctr(x); return { b: x, res: r, d: Math.hypot(x0 - bx, y0 - by) }; }).sort((p, q) => p.d - q.d);
  const up = [], down = [], missing = [];
  for (const r of ins) {
    const l = pick(r, x => bdef(x).out && bdef(x).out[r]);
    if (!l.length && b.type !== 'furnace') missing.push(r);
    up.push(...l.slice(0, b.type === 'furnace' ? 4 : 6));
  }
  if (b.type === 'furnace' && !up.length) missing.push('wood');
  for (const r of outs) down.push(...pick(r, x => takes(x, r)).slice(0, 6));
  return { up, down, ins, outs, missing };
}

// ---------- 收集册：建筑、物资、地标、人物、风物，外加成就。记在 meta.book 里，北迁后也保留 ----------
export const SIGHTS = [
  { id: 'aurora', n: '오로라 밤', ic: '🌌', d: '북쪽 밤하늘에 흐르는 빛. 오로라가 나오면 야영지의 모든 사람들이 달려가 찾아볼 것입니다.', how: '온라인 상태에서 오로라 밤을 기다리세요' },
  { id: 'icefog', n: '얼음 안개 아침', ic: '🌫', d: '새벽 무렵에는 얼음안개가 생기고, 작은 얼음 결정들이 공중에 반짝거리기 때문에 멀리서 보면 선명하게 보이지 않는다.', how: '일부 아침에는 얼음과 안개가 끼겠습니다' },
  { id: 'blizzard', n: '눈보라', ic: '❄', d: '온도가 수십도나 떨어진 한파. 용광로는 과부하 상태이며 연료 및 요리는 생존을 위해 완벽하게 준비되어 있습니다.', how: '눈보라에서 살아남으세요' },
  { id: 'wx:ice', n: '얼음 폭풍', ic: '🧊', d: '얼어붙는 비가 땅에 닿으면 얼어붙고, 나뭇가지, 나무, 파이프가 모두 반짝이는 얼음 껍질로 덮여 있습니다.', how: '얼음 폭풍을 경험해보세요' },
  { id: 'wx:cold', n: '매우 추운 밤', ic: '🌡', d: '내쉬는 숨마저 얼어붙는 밤. 용광로는 새벽까지 불에 타서 아무도 감히 잠을 자지 못합니다.', how: '매우 추운 밤을 살아남으세요' },
  { id: 'wx:crack', n: '얼음호수 크래킹', ic: '💧', d: '얼음 아래에서 천둥같은 소리가 났고, 검은 도랑이 호수 표면을 가르다가 며칠 후에 다시 얼어붙었습니다.', how: '얼음호수의 크랙이 한 번 발생했습니다.' },
  { id: 'gang', n: '약탈자야영지', ic: '🏴', d: '울타리 주변에는 검은 깃발이 달린 검은 모자가 여러 개 있습니다. 그들은 농사도 사냥도 하지 않고, 남의 야영지에 의존하여 겨울을 살아갑니다.', how: '정찰을 한 곳으로약탈자야영지' },
  { id: 'herd', n: '순록 떼', ic: '🦌', d: '설원에 풀을 뜯고 있는 사슴 떼는 사람이 다가가자마자 도망가곤 했다. 사냥꾼 오두막은 그들에게 의지하여 겨울을 살아갑니다.', how: '사냥꾼 오두막 구축' },
  { id: 'lostdeer', n: '잃어버린 순록', ic: '🦌', d: '다른 동물들과 분리된 순록은 목에 빨간 천과 방울을 묶고, 등에는 마른 먹이를 배낭에 짊어지고 있었다.', how: '온라인일 때 가끔 야영지 옆에 나타납니다.' },
  { id: 'meteor', n: '유성 분화구', ic: '☄', d: '야영지 근처에 떨어진 운석에 의해 만들어진 얕은 분화구에는 자갈이 여전히 뜨겁고, 분화구 바닥에는 금속과 희귀 광물이 묻혀있습니다.', how: '온라인 상태에서 가끔 유성이 떨어지기도 합니다.' },
  { id: 'caravan', n: '썰매 캐러밴', ic: '🛷', d: '야영지 사이를 오가는 캐러밴은 썰매를 데리고 며칠 동안 캠핑을 하며 희귀한 물품을 여분의 보급품으로 교환합니다.', how: '캐러밴은 수시로 지나갈 것입니다.' },
  { id: 'fest', n: '모닥불 축하', ic: '🔥', d: '모닥불 주변에서 춤추고, 피아노를 연주하고, 드럼을 연주해보세요. 쇼가 끝난 후에도 모든 사람들은 며칠 동안 그 이야기를 계속했습니다.', how: '용광로 패널에서 축하 행사를 열어보세요' },
  { id: 'vein', n: '새로운 정맥', ic: '⛏', d: '난방권에서 탐사팀이 발견한 광맥. 광산이 비어 있으면 일손 배치를 다시 찾으십시오.', how: '탐사대를 보내 광산을 찾으세요' },
  { id: '습격:눈늑대 무리', n: '눈늑대 무리', ic: '🐺', d: '극도로 배고픈 늑대들은 눈보라 전후에 야영지의 측면을 가장 자주 만졌습니다.', how: '남쪽 야영지의 야간순찰' },
  { id: '습격:약탈자', n: '약탈자', ic: '🐺', d: '빙상 위를 떠도는 사람들은 다른 야영지를 붙잡고 겨울을 살아남는다.', how: '철령 북쪽에서 하룻밤 묵으세요' },
  { id: '습격:서리 짐승', n: '서리 짐승', ic: '🐺', d: '서리수정 폐허 털에 얼음 결정을 달고 해당 지역에 나타나는 몬스터입니다.', how: '서리수정 폐허 지역에서 하룻밤을 묵으세요' },
  { id: '습격:유적 수호자', n: '유적 수호자', ic: '🐺', d: '구시대 오토마톤은 잔해에서 깨어나 여전히 오랫동안 무의미했던 명령을 수행했습니다.', how: '성철 잔해 북쪽에서 하룻밤 묵으세요' },
  // 1.1 站点奇遇：走完一件记一件
  ...QY_KEYS.map(k => ({ id: 'qy:' + k, n: '기연·' + QY[k].n, ic: QY[k].ic, d: QY[k].d, how: '북방 사이트에서 이 기연을 발견하고 끝까지 봤습니다.' })),
  // 1.1 奇观、城镇
  ...WONDER_KEYS.map(k => ({ id: 'w:' + k, n: WONDERS[k].n, ic: WONDERS[k].ic, d: BLD[k].desc, how: '이 불가사의를 구축' })),
  { id: 'town', n: '첫 번째 마을', ic: '🏘️', d: '천막은 목조주택으로 교체되었고, 길가에는 가로등이 조명을 밝혔습니다.', how: '연구 "도시 계획", 야영지를 마을로 업그레이드하세요.' },
  { id: 'city', n: '대도시', ic: '🏙️', d: '증기 아파트가 연달아 지어지고 거리에는 눈꽃보다 사람이 더 많습니다.', how: '야영지를 대도시로 업그레이드' },
];
const nBuilt = (S, f) => S.buildings.filter(f).length;
const maxFurnace = S => Math.max(0, ...S.camps.map(c => (getB(S, c.furnace) || {}).lvl || 0));
const maxPeople = S => Math.max(0, ...S.camps.map(c => c.people));
const yes = v => (v ? 1 : 0);
// 每个成就：cur(S, B) 现在到多少，need 要多少（是/否的条件 need 为 1）
export const ACH = [
  { id: 'first', n: '첫 번째 불의 광선', d: '첫 번째 건물을 건설하세요', rw: 1, need: 1, cur: S => yes(nBuilt(S, b => b.type !== 'furnace')) },
  { id: 'town', n: '작은 마을의 시작', d: '야영지 한 대는 50명을 수용할 수 있습니다.', rw: 1, need: 50, cur: maxPeople },
  { id: 'city', n: '인구가 급증하고 있어요', d: '야영지 1대는 150명을 수용할 수 있습니다.', rw: 2, need: 150, cur: maxPeople },
  { id: 'busy', n: '모든 산업이 번영한다', d: '한 번의 여정에는 동시에 40개의 건물이 있습니다.', rw: 2, need: 40, cur: S => S.buildings.length },
  { id: 'fire10', n: '활활 타오르는 불', d: '용광로가 레벨 10으로 상승했습니다.', rw: 2, need: 10, cur: maxFurnace },
  { id: 'fire20', n: '불이 한창이다', d: '용광로가 레벨 20으로 상승했습니다.', rw: 3, need: 20, cur: maxFurnace },
  { id: 'camp2', n: '두 번째 집', d: '첫 번째 전초기지 용광로를 밝히세요', rw: 2, need: 2, cur: S => S.camps.length },
  { id: 'camp4', n: '스타파이어컴퍼니', d: '한 번의 여정에는 동시에 4개의 야영지가 있습니다.', rw: 3, need: 4, cur: S => S.camps.length },
  { id: 'north3', n: '북행자', d: '검은 기름 동토 지점 모닥불에서', rw: 2, need: 1, cur: S => yes(S.founded.some(i => i >= 3)) },
  { id: 'north5', n: '성철 아래', d: '성철 잔해 지점 모닥불에서', rw: 3, need: 1, cur: S => yes(S.founded.some(i => i >= 5)) },
  { id: 'eternal', n: '영원의 용광로', d: '리킨들영원의 용광로', rw: 5, need: 1, cur: S => yes(S.meta.graduated) },
  { id: 'far1', n: '거리를 보아라', d: '영원의 용광로 북쪽의 먼 랜드마크 찾기', rw: 2, need: 1, cur: S => yes(((S.far || {}).seen || []).length) },
  { id: 'gang', n: '약탈자 제거', d: '같은 무리의 약탈자를 두 번 처치하고 해산시키세요.', rw: 3, need: 1, cur: S => S.stats.gangs || 0 },
  { id: 'wx3', n: '예상치 못한 일이 발생합니다', d: '얼음 폭풍, 극도로 추운 밤, 도중에 얼음호수 균열 발생', rw: 2, need: 3, cur: S => WXE_KEYS.filter(k => S.stats.wxe && S.stats.wxe[k]).length },
  { id: 'bliz5', n: '바람도 눈도 내리지 않아', d: '한 번의 여정에서 5게임을 생존했습니다눈보라', rw: 2, need: 5, cur: S => S.stats.blizzards },
  { id: 'nodeath', n: '누구도 빠질 수 없어', d: '여행은 3시간 동안 진행됐고 사망자는 없었다.', rw: 3, need: 180, cur: S => S.stats.deaths ? 0 : Math.floor(S.t / 60) },
  { id: 'guard3', n: '야간 경비원', d: '한 번의 여정에서 습격을 3번 격파하세요', rw: 2, need: 3, cur: S => S.stats.raidsWon },
  { id: 'req5', n: '좋은 이웃', d: '한 번의 여정에서 5개의 미션을 완료하세요', rw: 2, need: 5, cur: S => S.stats.reqs || 0 },
  { id: 'req20', n: '요청에 응답', d: '한 번의 여정으로 20개의 커미션을 완료하세요', rw: 3, need: 20, cur: S => S.stats.reqs || 0 },
  { id: 'trade10', n: '일반 고객', d: '한 번의 여행 동안 캐러밴에 10개의 주문을 제출하세요.', rw: 2, need: 10, cur: S => S.stats.carOrders || 0 },
  { id: 'aur3', n: '시계오로라', d: '여행 중에 모두와 함께 오로라를 3번 시청하세요', rw: 2, need: 3, cur: S => S.stats.aurora || 0 },
  { id: 'met3', n: '스타 체이서', d: '길을 따라 3개의 유성 분화구를 파세요', rw: 2, need: 3, cur: S => (S.stats.surKinds || {}).meteor || 0 },
  { id: 'photo', n: '지금 이 순간 얼어붙어', d: '사진 모드에서 야영지의 사진을 찍으세요.', rw: 1, need: 1, cur: S => S.meta.photos || 0 },
  { id: 'dogs12', n: '개 풀 썰매', d: '야영지에는 잘 먹은 썰매 개 12마리가 있습니다.', rw: 2, need: 12, cur: S => Math.floor(Math.max(0, ...S.camps.map(c => dogsOf(S, c.id)))) },
  { id: 'fest3', n: '매일 밤 노래를 틀어', d: '한 번의 여행으로 3개의 모닥불 축하 행사 개최', rw: 2, need: 3, cur: S => S.stats.fests || 0 },
  { id: 'deep', n: '파헤치다', d: '깊은 우물을 파다', rw: 1, need: 1, cur: S => yes(S.buildings.some(b => b.deep)) },
  { id: 'vein3', n: '광부', d: '도중에 새로운 광맥 3개 발견', rw: 2, need: 3, cur: S => (S.veins || []).length },
  { id: 'belt5', n: '조립 라인', d: '한 번의 여행으로 5개의 컨베이어 벨트를 설치하세요', rw: 2, need: 5, cur: S => (S.belts || []).length },
  { id: 'rail', n: '증기 시대', d: '컨베이어 벨트 업그레이드를 증기 트랙으로 전환', rw: 2, need: 1, cur: S => yes((S.belts || []).some(b => b.lvl >= 2)) },
  { id: 'spec5', n: '재능이 다 왔네', d: '주변에 전문가 5개 모으기', rw: 2, need: 5, cur: S => Object.keys(S.meta.specs || {}).length },
  { id: 'allres', n: '모든 것이 준비되었습니다', d: '재료란에 있는 모든 재료를 수집하세요.', rw: 3, need: RES_KEYS.length, cur: (S, B) => RES_KEYS.filter(k => B.r[k]).length },
  { id: 'allbld', n: '건설 마스터', d: '건물 열에서 모두 수집', rw: 5, need: Object.keys(BLD).length, cur: (S, B) => Object.keys(BLD).filter(k => B.b[k]).length },
  { id: 'allsight', n: '잘 알고', d: '풍경란에 모두 모아보세요', rw: 3, need: SIGHTS.length, cur: (S, B) => SIGHTS.filter(x => B.s[x.id]).length },
  // ---------- 第十三版：只换装扮、不给余烬（cat 分类，gift 解锁的东西，hid 做到之前是「？？？」）----------
  { id: 'n1', cat: '북방', n: '얼음을 깨는 자', d: '첫 번째 정류장 북방까지 도보로 이동하세요.', rw: 0, need: 1, cur: S => S.meta.northMax || 0, gift: { title: 'ice', deco: 'icesculpt' } },
  { id: 'n5', cat: '북방', n: '북방의 나그네', d: '5번째 정류장까지 도보 이동 북방', rw: 0, need: 5, cur: S => S.meta.northMax || 0, gift: { title: 'walker', flag: 'star' } },
  { id: 'n10', cat: '북방', n: '10정거장 거리', d: '10번째 정류장까지 도보 이동 북방', rw: 0, need: 10, cur: S => S.meta.northMax || 0, gift: { flame: 'blue' } },
  { id: 'n20', cat: '북방', n: '극북에 닿은 자', d: '20번째 정류장까지 도보 이동 북방', rw: 0, need: 20, cur: S => S.meta.northMax || 0, gift: { title: 'far', frame: 'map' } },
  { id: 'qy1', v: 11, cat: '북방', n: '기연을 들은 사람', d: '북방에서 기연 착용완료', rw: 0, need: 1, cur: S => Object.keys(S.meta.qy || {}).length, gift: { title: 'tale' } },
  { id: 'qy12', v: 11, cat: '북방', n: '열두 기연', d: '기연 12종 완성', rw: 0, need: QY_KEYS.length, cur: S => Object.keys(S.meta.qy || {}).length, gift: { title: 'tales' } },
  { id: 'wolfking', v: 11, cat: '숨기기', hid: 1, n: '늑대왕', d: '기연에서 늑대왕을 처치하세요', rw: 0, need: 1, cur: S => yes((S.meta.f13 || {}).wolfking), gift: { deco: 'wolfrug' } },
  { id: 'wonder', v: 11, cat: '북방', n: '불가사의 건설자', d: '불가사의 구축', rw: 0, need: 1, cur: S => S.meta.wMax || 0, gift: { title: 'wonder' } },
  { id: 'wonders3', v: 11, cat: '북방', n: '세 불가사의', d: '1마일당 3개의 불가사의가 제작되었습니다.', rw: 0, need: 3, cur: S => S.meta.wMax || 0, gift: { title: 'wonders' } },
  { id: 'mayor', v: 11, cat: '야영지', n: '대도시의 주인', d: '야영지를 대도시로 업그레이드', rw: 0, need: 3, cur: S => S.meta.town || 0, gift: { title: 'mayor' } },
  { id: 'peak', v: 11, cat: '생산 라인', n: '불이 한창이다', d: '야영지 생산 라인은 삼성에서 완전히 안정적이며 용광로는 금색으로 연소됩니다.', rw: 0, need: 1, cur: S => S.meta.peakN || 0, gift: { title: 'peak' } },
  { id: 'tide5', v: 11, cat: '북방', n: '영동의 불지킴이', d: '영동조의 5번째 웨이브에서 살아남으세요. (동상은 아무도 없고, 서리 괴물이 침입하지 않았습니다.)', rw: 0, need: 5, cur: S => S.meta.tideBest || 0, gift: { title: 'tide5', flame: 'frost' } },
  { id: 'tide10', v: 11, cat: '북방', n: '열 번의 물결에도 꺼지지 않는 자', d: '영동조의 10번째 웨이브에서 살아남으세요', rw: 0, need: 10, cur: S => S.meta.tideBest || 0, gift: { title: 'tide10', flame: 'eternal' } },
  { id: 'rules', cat: '북방', n: '10가지 지형', d: '북방 지형 10곳을 모두 방문했습니다.', rw: 0, need: 10, cur: S => rulesSeen(S), gift: { deco: 'bonearch' } },
  { id: 'tw1', cat: '봉화탑', n: '불을 켜는 사람', d: '첫 번째 봉화탑을 켜십시오.', rw: 0, need: 1, cur: S => Math.max(S.meta.towerMax || 0, towersLit(S)), gift: { title: 'lamp', deco: 'pyremem' } },
  { id: 'tw5', cat: '봉화탑', n: '줄을 서서', d: '한 번의 여행으로 5인승 봉화탑을 밝히세요', rw: 0, need: 5, cur: S => Math.max(S.meta.towerMax || 0, towersLit(S)), gift: { flag: 'flame' } },
  { id: 'sky', cat: '봉화탑', n: '하늘의 불', d: '북방의 10번째 스테이션에서 천화탑을 점화하세요', rw: 0, need: 1, cur: S => S.meta.skyfire || 0, gift: { title: 'sky', flame: 'gold', deco: 'skymem' } },
  { id: 'nocut', cat: '봉화탑', n: '한숨에', d: '타워가 반쯤 자라기 시작할 때부터 재고가 없어지는 일이 없었습니다.', rw: 0, need: 1, cur: S => yes(towerList(S).some(t => !t.cut) || (S.meta.f13 || {}).nocut), gift: { frame: 'copper' } },
  { id: 'hi3', cat: '생산 라인', n: '별빛나다', d: '첨단소재 6개 생산라인 삼성으로 업그레이드', rw: 0, need: 6, cur: S => NORTH_HI.filter(k => plinesOf(S).some(l => l.r === k && l.star >= 3)).length, gift: { flame: 'purple' } },
  { id: 'wolfsafe', cat: '생존', n: '늑대의 입은 무해하다', d: '늑대 무리 영역에서 습격을 3번 격파했고, 아무도 다치지 않았습니다.', rw: 0, need: 1, cur: S => yes((S.meta.f13 || {}).wolfsafe), gift: { title: 'wolf', flag: 'wolf' } },
  { id: 'storm4', cat: '생존', n: '폭풍우가 내리지 않을 것이다', d: '폭풍 회랑, 눈보라, 아무도 동상의 4 게임에서 살아남았습니다.', rw: 0, need: 4, cur: S => (S.meta.f13 || {}).storm4 ? 4 : ruleNow(S) === 'storm' ? Math.min(4, nsOf(S).blizOk || 0) : 0, gift: { title: 'storm', deco: 'snowman' } },
  { id: 'deco8', cat: '야영지', n: '등불과 꽃줄', d: '하나의 야영지에 8개의 서로 다른 장식을 넣습니다.', rw: 0, need: 8, cur: S => Math.max(0, ...S.camps.map(c => new Set(S.buildings.filter(b => b.camp === c.id && BLD[b.type].cat === 'deco').map(b => b.type)).size)), gift: { deco: 'lanterns' } },
  { id: 'flamec', cat: '야영지', n: '색깔을 바꾸다', d: '야영지 스토브 불의 색상 변경', rw: 0, need: 1, cur: S => yes((S.meta.cos || {}).fc), gift: { title: 'keeper' } },
  { id: 'mover', cat: '야영지', n: '더욱 원활하게 이동하세요', d: '건물 위치를 총 10번 옮겼습니다.', rw: 0, need: 10, cur: S => S.meta.moves || 0, gift: { flag: 'compass' } },
  { id: 'ruins10', cat: '야영지', n: '고성을 분해한 사람', d: '고성 폐허의 총 10개 부품이 제거되었습니다.', rw: 0, need: 10, cur: S => S.meta.ruinsN || 0, gift: { frame: 'ruin' } },
  { id: 'decoall', cat: '야영지', n: '북방 드레스업', d: '8가지 유형의 북방장식이 제작되었습니다.', rw: 0, need: NDECO.length, cur: (S, B) => NDECO.filter(k => B.b[k]).length, gift: { flame: 'aurora' } },
  { id: 'aur5', cat: '숨기기', hid: 1, n: '영야오로라', d: '영야 사이트의 모든 사람과 함께 오로라를 5번 시청하세요.', rw: 0, need: 5, cur: S => (S.meta.f13 || {}).aur5 ? 5 : ruleNow(S) === 'night' ? Math.min(5, nsOf(S).aur || 0) : 0, gift: { deco: 'windchime', flame: 'green' } },
  { id: 'photo20', cat: '숨기기', hid: 1, n: '아무렇지도 않게 사진을 찍는다', d: '사진 20장 찍기', rw: 0, need: 20, cur: S => S.meta.photos || 0, gift: { frame: 'film' } },
  { id: 'icefest', cat: '숨기기', hid: 1, n: '얼음호수 축하', d: '얼음낚시 오두막이 있는 야영지에서 모닥불 축하 행사를 개최하세요.', rw: 0, need: 1, cur: S => yes((S.meta.f13 || {}).icefest), gift: { deco: 'deerstatue' } },
];
export const ACH_CATS = ['북방', '봉화탑', '생산 라인', '생존', '야영지', '숨기기', '여행'];
export const achCat = a => a.cat || '여행';
// 成就里记的一次性条件
function flag13(S, k) { (S.meta.f13 ||= {})[k] = 1; }
// 狼群领地：打退第 3 次袭营的时候，这一站一个人都没伤着
function wolfSafe(S, camp, ns) { if (campRule(S, camp) === 'wolf' && ns.raidW >= 3 && !ns.hurt) flag13(S, 'wolfsafe'); }
// 走过的北境地貌：记在 meta 里（北迁也留着），这一程走过的站也算上（老存档）
export function rulesSeen(S) {
  const M = S.meta.rulesSeen ||= {}, J = journeyOf(S), R = rt(S);
  if (R.rsK !== J.stage) { R.rsK = J.stage; for (let i = SPINE + 1; i <= J.stage; i++) { const st = stopOf(S, i); if (st && st.rule) M[st.rule] = 1; } }
  return Object.keys(M).length;
}
// ---------- 装扮：成就送的东西（从成就记录里推出来，老存档读进来就有）----------
export const GIFT_KINDS = { title: TITLES, flame: FLAMES, flag: FLAGS, frame: FRAMES };
export const GIFT_LABEL = { title: '칭호', flame: '불', flag: '깃발', frame: '사진 프레임', deco: '장식' };
export const GIFT_ICON = { title: '🎖', flame: '🔥', flag: '🚩', frame: '🖼', deco: '🗿' };
export function cosOf(S) { const C = S.meta.cos || (S.meta.cos = {}); C.seen ||= {}; return C; }
export function giftFrom(kind, id) { return ACH.find(a => a.gift && a.gift[kind] === id) || null; }
export function cosHave(S, kind, id) { if (id === 'def' || id === 'none') return true; const a = giftFrom(kind, id); return !!(a && bookOf(S).a[a.id]); }
export function giftList(a) { const g = a.gift || {}, out = []; for (const k in g) out.push([k, g[k]]); return out; }
export function giftName(kind, id) { return kind === 'deco' ? (BLD[id] ? BLD[id].n : id) : (GIFT_KINDS[kind][id]?.n ?? GIFT_KINDS[kind][id] ?? id); }
// 选中的称号（没选过就用最新拿到的那个）
export function titleOf(S) {
  const C = cosOf(S);
  if (C.title === 'none') return '';
  if (C.title && cosHave(S, 'title', C.title)) return TITLES[C.title];
  let best = null, bt = -1; const B = bookOf(S);
  for (const a of ACH) if (a.gift && a.gift.title && B.a[a.id] && (B.a[a.id] >= bt)) { best = a.gift.title; bt = B.a[a.id]; }
  return best ? TITLES[best] : '';
}
export function setTitle(S, id) { if (id !== 'none' && !cosHave(S, 'title', id)) return { ok: false }; cosOf(S).title = id; return { ok: true }; }
// 炉火颜色：全部营地一个默认色（跟着北迁走），单个营地还能另选；换过一次就算「换个颜色」
export function flameOf(S, camp) { const C = S.meta.cos || {}, id = (camp && camp.flame) || C.flame || 'def'; return cosHave(S, 'flame', id) ? id : 'def'; }
export function setFlame(S, cid, id) {
  if (!FLAMES[id] || !cosHave(S, 'flame', id)) return { ok: false };
  const C = cosOf(S);
  if (cid == null) { C.flame = id; for (const c of S.camps) delete c.flame; }
  else { const c = getCamp(S, cid); if (!c) return { ok: false }; if (id === (C.flame || 'def')) delete c.flame; else c.flame = id; }
  C.fc = 1;
  return { ok: true };
}
// 营地旗子的图案（旗杆和车队领头那辆车上都挂这一面）、照片相框的默认值
export function flagOf(S) { const id = (S.meta.cos || {}).flag || 'def'; return cosHave(S, 'flag', id) ? id : 'def'; }
export function setFlag(S, id) { if (!FLAGS[id] || !cosHave(S, 'flag', id)) return { ok: false }; cosOf(S).flag = id; return { ok: true }; }
export function frameOf(S) { const id = (S.meta.cos || {}).frame || 'none'; return cosHave(S, 'frame', id) ? id : 'none'; }
export function setFrame(S, id) { if (!FRAMES[id] || !cosHave(S, 'frame', id)) return { ok: false }; cosOf(S).frame = id; return { ok: true }; }
export const BOOK_BLD = Object.keys(BLD);
export function bookOf(S) {
  const m = S.meta, B = m.book || (m.book = {});
  for (const k of ['b', 'r', 'l', 'p', 's', 'a']) B[k] ||= {};
  B.fresh ||= [];
  return B;
}
export function bookCount(S) {
  const B = bookOf(S), have = (o, ks) => ks.filter(k => o[k]).length;
  const cats = {
    b: [have(B.b, BOOK_BLD), BOOK_BLD.length], r: [have(B.r, RES_KEYS), RES_KEYS.length],
    l: [have(B.l, LANDMARKS.map((_, i) => 'L' + i).concat(FAR_MARKS.map((_, i) => 'F' + i))), LANDMARKS.length + FAR_MARKS.length],
    p: [have(B.p, SPECS.map(x => x.id)), SPECS.length], s: [have(B.s, SIGHTS.map(x => x.id)), SIGHTS.length], a: [have(B.a, ACH.map(x => x.id)), ACH.length],
  };
  let got = 0, all = 0; for (const k of ['b', 'r', 'l', 'p', 's']) { got += cats[k][0]; all += cats[k][1]; }
  return { cats, got, all };
}
export function bookTick(S) {
  const B = bookOf(S), add = [], first = !B.init;
  const mk = (cat, id) => { if (!B[cat][id]) { B[cat][id] = S.meta.runs || 1; add.push([cat, id]); } };
  for (const b of S.buildings) mk('b', b.type);
  for (const c of S.camps) for (const k in c.stock) if (RES[k] && c.stock[k] >= 1) mk('r', k);
  for (const k in S.stats.prod) if (RES[k] && S.stats.prod[k] > 0) mk('r', k);
  for (const i of S.founded) mk('l', 'L' + i);
  for (const i of S.meta.sites || []) mk('l', 'L' + i); // 以前几轮走到过的（能从那里出发）
  const F = S.far || {}; for (const i of F.seen || []) mk('l', 'F' + i);
  for (const i in S.meta.relics || {}) if (S.meta.relics[i]) mk('l', 'F' + i);
  for (const id in S.meta.specs || {}) mk('p', id);
  const sky = skyAt(S, S.t), st = S.stats, sk = st.surKinds || {};
  if (sky.aurora > 0.3) mk('s', 'aurora');
  if (sky.icefog > 0.3) mk('s', 'icefog');
  if (st.blizzards > 0) mk('s', 'blizzard');
  if (st.wxe) for (const k of WXE_KEYS) if (st.wxe[k]) mk('s', 'wx:' + k);
  if (S.gangs && Object.keys(S.gangs).length) mk('s', 'gang');
  if (S.buildings.some(b => b.type === 'hunter')) mk('s', 'herd');
  if (sk.deer) mk('s', 'lostdeer');
  if (sk.meteor) mk('s', 'meteor');
  if (S.car) mk('s', 'caravan');
  if ((S.veins || []).length) mk('s', 'vein');
  if (S.stats.fests || S.camps.some(c => c.fest)) mk('s', 'fest');
  for (const n in st.raidKinds || {}) mk('s', 'raid:' + n);
  for (const k in S.meta.qy || {}) mk('s', 'qy:' + k);
  for (const k in S.meta.wdone || {}) mk('s', 'w:' + k);
  if ((S.meta.town || 0) >= 1) mk('s', 'town');
  if ((S.meta.town || 0) >= 3) mk('s', 'city');
  // 成就：条件达成就记下，余烬只给一次
  let em = 0;
  for (const a of ACH) if (!B.a[a.id] && a.cur(S, B) >= a.need) { B.a[a.id] = S.meta.runs || 1; em += a.rw; add.push(['a', a.id]); }
  if (em) { S.meta.embers = (S.meta.embers || 0) + em; S.meta.emberTotal = (S.meta.emberTotal || 0) + em; }
  B.init = 1;
  if (!add.length) return null;
  for (const [c, id] of add) if (!first) B.fresh.push(c + ':' + id);
  if (B.fresh.length > 60) B.fresh = B.fresh.slice(-60);
  rt(S).fx.push({ kind: 'book', add, first, em });
  return add;
}
export function bookName(cat, id) {
  if (cat === 'b') return BLD[id] ? BLD[id].n : id;
  if (cat === 'r') return RES[id] ? RES[id].n : id;
  if (cat === 'l') return id[0] === 'L' ? LANDMARKS[+id.slice(1)].n : FAR_MARKS[+id.slice(1)].n;
  if (cat === 'p') { const sp = SPECS.find(x => x.id === id); return sp ? sp.n : id; }
  if (cat === 's') { const x = SIGHTS.find(x => x.id === id); return x ? x.n : id; }
  if (cat === 'a') { const a = ACH.find(x => x.id === id); return a ? a.n : id; }
  return id;
}
export function bookSeen(S, cat) { const B = bookOf(S); B.fresh = B.fresh.filter(f => !f.startsWith(cat + ':')); }
