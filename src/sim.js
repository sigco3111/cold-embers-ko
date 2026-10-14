// 寒烬北行 · 模拟内核（纯逻辑，可在 Node 里跑测试）
import {
  RES, RES_KEYS, FUEL, FUEL_ORDER, GATE, GATE_EVERY, SPOTS, SPOT_KEYS, LANDMARKS, BAND_START,
  tierOfRow, baseTempOfRow, ETERNAL_STAGES, BLD, furnaceHeat, furnaceRadius, furnaceBurn,
  SPECS, SPEC_MAX, specBonus, specTrainCost, EMBER_UPS, emberCost, RAIDERS, STORY, DAY_LEN, LAWS, LAW_CD, TECHS, SITES, CHAPTERS, INFRA, LM_R, FAR_MARKS, DIFF, DIFF_KEYS, FOCUS, FOCUS_KEYS, FOCUS_LVL, FOCUS_CD,
} from './data.js';
import { W, H, T_SNOW, T_ICE, getWorld, idx, inMap, hash3, mulberry32 } from './worldgen.js';
import { journeyOf, journeyStep, mainCamp, outpostBlock, outpostKit, moveFuel, fuelUnits, stopOf, depotAuto } from './journey.js';
export * from './journey.js';
import { linesTick, bMax, bStar, lineProd, plinesOf, STAR_PROD } from './lines.js';
export * from './lines.js';

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
  const S = {
    v: VERSION, runSeed, t: 0, savedAt: Date.now(), site, nextId: 1,
    camps: [], buildings: [], belts: [], reqs: [], spots: {}, sap: {}, poiDone: {}, poiFound: {}, scouts: [], lines: [],
    reveal: new Uint8Array(W * H), discovered: [], founded: [], known: 1,
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
  logMsg(S, k === 0 ? STORY.intro : `${STORY.migrate}（从${L.n}出发）`, 'story');
  if (k > 0) {
    const kit = starterKit(S, camp, k);
    S.safeUntil = SAFE_START;
    logMsg(S, `先遣队已经搭好了营地：${kit}。北边的狼群和劫掠者暂时还没发现你们，大约 ${Math.round(SAFE_START / 3600)} 小时内不会遇袭，趁这段时间把防御建起来。`, 'good');
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
  return Object.keys(got).map(t => BLD[t].n + (got[t] > 1 ? ' ×' + got[t] : '')).join('、');
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
    for (let k = S.known + 1; k <= t; k++) logMsg(S, `侦察到更北的土地：解锁「${['', '篝火', '煤与铁', '钢与蒸汽', '油与铁路', '霜晶', '遗迹金属', '炉心'][k]}」一层的建筑。`, 'good');
    S.known = t;
  }
  LANDMARKS.forEach((l, i) => {
    if (S.discovered.includes(i)) return;
    if ((l.x - cx) ** 2 + (l.row - cy) ** 2 <= r * r) {
      S.discovered.push(i);
      if (i > 0) logMsg(S, `发现地标「${l.n}」：${l.desc} 车队北迁到这里时，它就是新的主营地。`, 'story');
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
export function heatRadius(S, camp) { return furnaceRadius(getB(S, camp.furnace).lvl) + (camp.pipe || 0) + (firstLeg(S) ? 2 : 0); }
// 第一程放宽：人口上限 +10，供热圈 +2 格
export function firstLeg(S) { return journeyOf(S).stage === 0; }
// 人口上限：每座营地 12 + 6 × 熔炉等级。帐篷再多，超过上限也没人来；已经超过的不会走
export function popCap(S, camp) { return 12 + 6 * getB(S, camp.furnace).lvl + (firstLeg(S) ? 10 : 0); }
export function popRoom(S, camp) { return popCap(S, camp) - camp.people - awayOf(S, camp); }
// 营地基建
export function infraCost(S, camp, k) { const L = INFRA[k].lv[(camp[k] || 0) + 1]; return L ? L.cost : null; }
export function upgradeInfra(S, cid, k) {
  const camp = getCamp(S, cid), cost = infraCost(S, camp, k);
  if (!cost) return { ok: false, reason: '已经是最高级了' };
  for (const r in cost) if (RES[r].t > S.known) return { ok: false, reason: `需要「${RES[r].n}」——先往北侦察到它所在的纬度` };
  if (!canAfford(camp.stock, cost)) return { ok: false, reason: '缺：' + missing(camp.stock, cost).join('，') };
  pay(camp.stock, cost);
  camp[k] = (camp[k] || 0) + 1;
  const L = INFRA[k].lv[camp[k]];
  if (k === 'pipe') revealCircle(S, camp.x, camp.y, heatRadius(S, camp) + 2);
  dirty(S); rt(S).infraDirty = true;
  logMsg(S, `「${camp.name}」修好了${L.n}：${L.d}。`, 'good');
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
    if (b.type !== 'heater') continue;
    const d = Math.hypot(px - (b.x + 0.5), py - (b.y + 0.5));
    if (d <= BLD.heater.hreach && d < bd) { bd = d; best = b.camp; }
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
  if (getB(S, camp.furnace).lvl < FOCUS_LVL) return `熔炉 ${FOCUS_LVL} 级后才能选专精`;
  if (camp.focus === k) return '已经是这个专精了';
  const left = focusLeft(S, camp);
  if (camp.focus && left > 0) return `刚换过专精，还要等 ${Math.ceil(left / 60)} 分钟`;
  return null;
}
export function setFocus(S, cid, k) {
  const camp = getCamp(S, cid); if (!camp || !FOCUS[k]) return { ok: false };
  const why = focusBlock(S, camp, k); if (why) return { ok: false, reason: why };
  const had = camp.focus;
  camp.focus = k; camp.focusAt = S.t;
  logMsg(S, had ? `「${camp.name}」改成了${FOCUS[k].n}营地。` : `「${camp.name}」定下了方向：${FOCUS[k].n}营地。${FOCUS[k].d}`, 'good');
  rt(S).fx.push({ kind: 'focus', camp: cid, k });
  return { ok: true };
}
export function diffOf(S) { return DIFF[S.meta && S.meta.diff] || DIFF.std; }
function thrift(S) { return (1 - 0.04 * up(S, 'thrift')) * diffOf(S).cost; }
export function buildCost(S, type, cid, y, extra = 0) {
  const d = BLD[type];
  const out = {};
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
export function housingOf(b) { return BLD.tent.housing + 3 * (b.lvl - 1); }
// 床位：帐篷总床位；出门侦察、探险的人床位给他们留着
export function bedsOf(S, camp) { let n = 0; for (const b of S.buildings) if (b.camp === camp.id && b.type === 'tent') n += housingOf(b); return n; }
export function awayOf(S, camp) { let n = 0; for (const s of S.scouts) if (s.camp === camp.id) n += s.n; return n; }
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
  return Math.round(cap * (1 + techSum(S, 'cap')));
}
export function unlocked(S, type) { const d = BLD[type]; return d.t <= S.known && (!d.stage || journeyOf(S).stage >= d.stage); }
// 永恒之炉以北的新东西：走到那一程才解锁
export const stageLock = (S, type) => { const d = BLD[type]; return d.stage && journeyOf(S).stage < d.stage ? `走到「${stopOf(S, d.stage).n}」才能建` : ''; };
export const forecastOf = S => FORECAST * (journeyOf(S).stage >= 9 ? 2 : 1); // 到了极光观测站，天气预报提前一倍
// 加工厂不把基础建材吃光：锯木厂不会把木材全锯成木板、炼钢厂不会把铁锭用完——仓库里留两成（最多 300）给建造。
// 只管前两层的建材；更高层的中间品本来就是为了往下加工，留料会卡住整条链
export const KEEP_FRAC = 0.2, KEEP_MAX = 300, KEEP_WHY = '留料给建造';
const BUILD_MAT = new Set(); for (const t in BLD) for (const k in BLD[t].cost || {}) if (RES[k].t <= 2) BUILD_MAT.add(k);
export function isBuildMat(k) { return BUILD_MAT.has(k); }
export function keepOf(camp, k, cap) { return camp.keep !== false && BUILD_MAT.has(k) ? Math.min(KEEP_MAX, cap * KEEP_FRAC) : 0; }

export function checkPlace(S, type, x, y, selfQ = 0) {
  const d = BLD[type];
  const s = d.size;
  const w = getWorld(S.runSeed);
  const res = { ok: false, reason: '', camp: -1, dist: 0, spots: 0, syn: 0, cost: null };
  if (!Number.isFinite(x) || !Number.isFinite(y)) { res.reason = '超出地图'; return res; }
  if (!unlocked(S, type)) { res.reason = d.t <= S.known ? stageLock(S, type) : `需要先侦察到「${['', '篝火', '煤与铁', '钢与蒸汽', '油与铁路', '霜晶', '遗迹金属', '炉心'][d.t]}」纬度`; return res; }
  if (type === 'furnace') { const why = outpostBlock(S, y + 1.5); if (why) { res.reason = why; return res; } }
  for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) {
    if (!inMap(xx, yy)) { res.reason = '超出地图'; return res; }
    const i = idx(xx, yy);
    if (!S.reveal[i]) { res.reason = '迷雾里不能建造'; return res; }
    if (w.terrain[i] !== T_SNOW) { res.reason = '地形不平（岩石或冰湖）'; return res; }
    if (w.spot[i] >= 0 && spotLeft(S, i) > 0) {
      // 树、碎石、兽群可以顺手清掉（返还一点材料）；矿点不能压
      if (!CLEARABLE[SPOT_KEYS[w.spot[i]]]) { res.reason = '这里是矿点：建在旁边，用对应的采集建筑开采'; return res; }
      res.clears = (res.clears || 0) + 1;
    }
    { const o = occAt(S, xx, yy); if (o && o !== -selfQ) { res.reason = o < 0 ? '这里已经排了一栋等材料的建筑' : '和其他建筑重叠'; return res; } }
    if (landmarkBlock(xx, yy, S)) { res.reason = '地标遗迹占着这里'; return res; }
    if (siteAt(S, xx, yy, 1)) { res.reason = '这里有一处遗迹'; return res; }
    if (caravanAt(S, xx, yy)) { res.reason = '商队的雪橇停在这里'; return res; }
    if (rebuild(S).beltOcc.has(i)) { res.reason = '传送带从这里经过'; return res; }
  }
  if (type === 'furnace') {
    const cx = x + 1.5, cy = y + 1.5;
    for (const c of S.camps) if (Math.hypot(c.x - cx, c.y - cy) < CAMP_GAP) { res.reason = `离「${c.name}」太近（至少 ${CAMP_GAP} 格）`; return res; }
    const act = getCamp(S, S.active), payer = act && !act.depot ? act : mainCamp(S);
    res.camp = payer.id;
    res.cost = buildCost(S, type, payer.id, y);
    if (payer.people < 16) { res.reason = `「${payer.name}」至少要有 16 人才能分出先遣队`; return res; }
    // 先遣队路上和开头要吃要烧：离得越远带得越多
    const kit = res.kit = outpostKit(S, payer, cx, cy);
    const all = { ...res.cost }; all.food = (all.food || 0) + kit.food;
    const short = missing(payer.stock, all);
    if (fuelUnits(payer.stock) < kit.fuel + 1e-9) short.push(`燃料 ${Math.ceil(kit.fuel - fuelUnits(payer.stock))} 份`);
    if (short.length) { res.reason = '缺：' + short.join('，'); res.soft = true; return res; }
    res.ok = true; return res;
  }
  // 普通建筑：整块都要在同一营地的供热区
  let camp = -2;
  for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) {
    const c = warmCampAt(S, xx, yy);
    if (c < 0) { res.reason = '不在熔炉供热区内（太冷）'; return res; }
    if (camp === -2) camp = c; else if (camp !== c) { res.reason = '跨了两个营地'; return res; }
  }
  res.camp = camp;
  const cobj = getCamp(S, camp);
  if (depotAuto(cobj)) { res.reason = `「${cobj.name}」是补给站，自己运转，不盖新房（要盖先「临时接手」）`; return res; }
  res.cost = buildCost(S, type, camp, y);
  res.dist = haulDistOf(S, camp, x, y, s, -1);
  if (d.gather) res.spots = findSpots(S, type, x, y).filter(p => spotLeft(S, p.i) > 0).length;
  res.syn = synergyOf(S, type, x, y, -1);
  if (!canAfford(cobj.stock, res.cost)) { res.reason = '缺：' + missing(cobj.stock, res.cost).join('，'); res.soft = true; return res; }
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
    const name = nearLandmarkName(x + 1.5, y + 1.5) || `第 ${S.camps.length + 1} 营地`;
    const camp = makeCamp(S, x, y, name);
    const move = Math.min(10, payer.people - 6);
    payer.people -= move; camp.people += move;
    trimWorkers(S, payer);
    getB(S, camp.furnace).lvl = 2 + 2 * (tierOfRow(camp.y) - 1); // 越往北，前哨熔炉一开始就要烧得越旺
    // 先遣队带上口粮和燃料，再顺手捎点木板
    payer.stock.food -= c.kit.food; camp.stock.food = (camp.stock.food || 0) + c.kit.food;
    moveFuel(payer.stock, camp.stock, c.kit.fuel);
    { const take = Math.min(payer.stock.plank || 0, 60); payer.stock.plank = (payer.stock.plank || 0) - take; camp.stock.plank = (camp.stock.plank || 0) + take; }
    revealCircle(S, camp.x, camp.y, 8);
    markFounded(S, camp);
    logMsg(S, `前哨营地点燃：「${camp.name}」。${move} 人从「${payer.name}」出发前往，带了 ${c.kit.food} 份口粮和 ${c.kit.fuel} 份燃料。记得用运输线把两座营地连起来。`, 'good');
    S.active = camp.id;
    dirty(S);
    return { ok: true, id: camp.furnace, camp: camp.id };
  }
  const camp = getCamp(S, c.camp);
  pay(camp.stock, c.cost);
  const b = { id: S.nextId++, type, x, y, lvl: 1, workers: 0, camp: c.camp };
  S.buildings.push(b);
  dirty(S);
  // 默认派满人
  b.workers = Math.min(maxWorkers(type, 1), Math.max(0, idleLabor(S, camp)));
  if (b.workers < maxWorkers(type, 1)) autoAssign(S, camp);
  return { ok: true, id: b.id };
}
const CLEARABLE = { tree: { wood: 20 }, rock: { stone: 20 }, herd: { game: 6 } };
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
      logMsg(S, `📍 侦察队在永夜冰原上发现了「${f.n}」！带回 ${e} 点余烬。在它旁边 ${FOUND_DIST} 格内点起熔炉，就能带回遗物「${f.relic.n}」。`, 'story', { act: 'far', arg: i, label: '看看' });
      rt(S).fx.push({ kind: 'far', i, lit: false });
    }
    if (F.seen.includes(i) && !F.lit.includes(i) && S.camps.some(c => Math.hypot(c.x - p.x - 0.5, c.y - p.y - 0.5) <= FOUND_DIST + 1)) {
      F.lit.push(i);
      const had = !!(S.meta.relics && S.meta.relics[i]);
      (S.meta.relics || (S.meta.relics = {}))[i] = 1;
      logMsg(S, had ? `营地的火光照亮了「${f.n}」。遗物「${f.relic.n}」早已带回，大家在这里歇了歇脚。` : `营地的火光照亮了「${f.n}」，带回了遗物「${f.relic.n}」：${f.relic.d}（永久生效，北迁后也保留）。`, 'story', { act: 'far', arg: i, label: '看看' });
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
      if (i > 0) { const e = arriveEmbers(S, i, true); S.meta.embers += e; S.meta.emberTotal = (S.meta.emberTotal || 0) + e; logMsg(S, `第一次抵达「${l.n}」！带来 ${e} 点余烬。`, 'story'); }
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
    if (!fa[j]) { fa[j] = 1; const e = arriveEmbers(S, i, true); S.meta.embers += e; S.meta.emberTotal = (S.meta.emberTotal || 0) + e; logMsg(S, `第一次抵达「${FAR_MARKS[j].n}」！带来 ${e} 点余烬。`, 'story'); if (S.t > 0) for (const c of S.camps) bumpMood(c, 12, -5); }
    S.meta.best = Math.max(S.meta.best || 0, i);
  });
}

// 第一次到达地标给的余烬（新的北行里再到一次只给一点）
export function arriveEmbers(S, i, first) { return Math.round((first ? 15 * i : 5) * (1 + relicSum(S, 'ember')) * diffOf(S).ember); }

export function assignedWorkers(S, cid) { let n = 0; for (const b of S.buildings) if (b.camp === cid) n += b.workers; return n; }
export function idleLabor(S, camp) { return camp.people + camp.bots - assignedWorkers(S, camp.id) - scoutsOut(S, camp.id); }
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
  if (depotAuto(camp)) return { ok: false, reason: `「${camp.name}」是补给站，自己运转，不升级（要升先「临时接手」）` };
  const cost = upgradeCost(S, b);
  if (cost.starcore && journeyOf(S).stage < RES.starcore.stage) return { ok: false, reason: `熔炉 35 级以后要用星核：走到「${stopOf(S, RES.starcore.stage).n}」才挖得到` };
  for (const k in cost) if (RES[k].t > S.known) return { ok: false, reason: `需要「${RES[k].n}」——先往北侦察到它所在的纬度` };
  if (!canAfford(camp.stock, cost)) return { ok: false, reason: '缺：' + missing(camp.stock, cost).join('，') };
  pay(camp.stock, cost);
  b.lvl++;
  if (b.hold && b.workers >= maxWorkers(b.type, b.lvl - 1)) b.hold = false;
  dirty(S);
  if (b.type === 'furnace') {
    revealCircle(S, camp.x, camp.y, heatRadius(S, camp) + 2);
    logMsg(S, `「${camp.name}」熔炉升到 ${b.lvl} 级，供热圈扩大到 ${heatRadius(S, camp)} 格。`, 'good');
  }
  return { ok: true };
}
export function demolish(S, bid) {
  const b = getB(S, bid);
  if (!b || b.type === 'furnace') return { ok: false };
  const camp = getCamp(S, b.camp);
  const d = BLD[b.type];
  for (const k in d.cost) camp.stock[k] = (camp.stock[k] || 0) + Math.floor(d.cost[k] * 0.5);
  for (const sid in S.specAt) if (S.specAt[sid] === bid) delete S.specAt[sid];
  S.buildings = S.buildings.filter(x => x.id !== bid);
  S.belts = (S.belts || []).filter(e => e.a !== bid && e.b !== bid);
  dirty(S);
  return { ok: true };
}

// ---------- 传送带 / 蒸汽轨道：挨着的上下游直接供料，省搬运工，下游也快一点 ----------
export const BELT_MAX = 6, BELT_PER = 4;
export const BELT = [null, { n: '传送带', cut: 0.6, bonus: 0.08, tier: 2 }, { n: '蒸汽轨道', cut: 0.85, bonus: 0.15, tier: 3 }];
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
  if (!a || !b || a.id === b.id) { res.reason = '建筑不在了'; return res; }
  if (a.camp !== b.camp) { res.reason = '不在同一个营地'; return res; }
  if (S.known < BELT[1].tier) { res.reason = '侦察到「煤与铁」纬度后才能造传送带'; return res; }
  if (!(BLD[a.type].out || {})[k] || !(BLD[b.type].in || {})[k]) { res.reason = '这两栋之间没有这种物资往来'; return res; }
  if (S.belts.some(e => e.a === aid && e.b === bid && e.k === k)) { res.reason = '已经连上了'; return res; }
  if (beltsOf(S, aid).length >= BELT_PER || beltsOf(S, bid).length >= BELT_PER) { res.reason = `一栋建筑最多连 ${BELT_PER} 条`; return res; }
  const e = beltEnds(a, b);
  res.len = e.len;
  if (e.len > BELT_MAX) { res.reason = `离得太远（最多隔 ${BELT_MAX} 格）`; return res; }
  const w = getWorld(S.runSeed), R = rebuild(S);
  for (const i of beltTiles(a, b)) {
    const x = i % W, y = Math.floor(i / W);
    if (w.terrain[i] !== T_SNOW) { res.reason = '中间有岩石或冰湖'; return res; }
    if (R.occ[i]) { res.reason = '中间有建筑挡着'; return res; }
    if (R.beltOcc.has(i)) { res.reason = '和别的传送带交叉了'; return res; }
    if (w.spot[i] >= 0 && spotLeft(S, i) > 0 && !CLEARABLE[SPOT_KEYS[w.spot[i]]]) { res.reason = '中间有矿点'; return res; }
    if (landmarkBlock(x, y, S) || siteAt(S, x, y, 1)) { res.reason = '中间有遗迹'; return res; }
  }
  res.cost = beltCost(S, e.len, 1);
  const c = getCamp(S, a.camp);
  if (!canAfford(c.stock, res.cost)) { res.reason = '缺：' + missing(c.stock, res.cost).join('，'); res.soft = true; return res; }
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
  logMsg(S, `「${BLD[a.type].n}」到「${BLD[b.type].n}」的传送带接上了：${RES[k].n}直接送过去，少用搬运工。`, 'good');
  return { ok: true };
}
export function beltUpBlock(S, e) {
  if (e.lvl >= 2) return '已经是蒸汽轨道了';
  if (S.known < BELT[2].tier) return '侦察到「钢与蒸汽」纬度后才能升级';
  const a = getB(S, e.a), b = getB(S, e.b), c = getCamp(S, e.camp), cost = beltCost(S, beltEnds(a, b).len, 2);
  if (!canAfford(c.stock, cost)) return '缺：' + missing(c.stock, cost).join('，');
  return '';
}
export function upBelt(S, id) {
  const e = (S.belts || []).find(x => x.id === id); if (!e) return { ok: false, reason: '传送带不在了' };
  const why = beltUpBlock(S, e); if (why) return { ok: false, reason: why };
  pay(getCamp(S, e.camp).stock, beltCost(S, beltEnds(getB(S, e.a), getB(S, e.b)).len, 2));
  e.lvl = 2; dirty(S);
  logMsg(S, `传送带换成了蒸汽轨道：更快、更省人。`, 'good');
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
  const d = BLD[b.type], out = [];
  for (const x of S.buildings) {
    if (x.camp !== b.camp || x.id === b.id) continue;
    const dx = BLD[x.type];
    for (const k in d.out || {}) if ((dx.in || {})[k]) out.push({ a: b.id, b: x.id, k, dir: 'out', other: x });
    for (const k in d.in || {}) if ((dx.out || {})[k]) out.push({ a: x.id, b: b.id, k, dir: 'in', other: x });
  }
  for (const o of out) { o.ck = beltCheck(S, o.a, o.b, o.k); o.len = beltEnds(getB(S, o.a), getB(S, o.b)).len; }
  return out.filter(o => o.len <= BELT_MAX && o.ck.reason !== '已经连上了').sort((p, q) => (q.ck.ok ? 1 : 0) - (p.ck.ok ? 1 : 0) || p.len - q.len);
}

// ---------- 天气与袭营（由种子决定的时间表，在线离线一致）----------
export function blizzardSlot(S, k) {
  const a = hash3(k, 11, S.runSeed), b = hash3(k, 23, S.runSeed), c = hash3(k, 37, S.runSeed);
  const start = BLIZ_FIRST + k * BLIZ_P + a * (BLIZ_P - 3600);
  return { k, start, end: start + 1200 + b * 1500, drop: 14 + c * 10 };
}
export function weatherAt(S, t) {
  const k = Math.max(0, Math.floor((t - BLIZ_FIRST) / BLIZ_P));
  for (const kk of [k - 1, k, k + 1]) {
    if (kk < 0) continue;
    const s = blizzardSlot(S, kk);
    if (t >= s.start && t < s.end) return { blizzard: true, drop: s.drop, until: s.end, slot: s };
    if (t >= s.start - BLIZ_WARN && t < s.start) return { blizzard: false, warn: true, inSec: s.start - t, slot: s };
  }
  let nx = blizzardSlot(S, k);
  if (nx.start <= t) nx = blizzardSlot(S, k + 1);
  return { blizzard: false, next: nx.start - t, slot: nx };
}
// 极光夜、冰雾早晨：只改变画面和气氛，不影响产出。由种子和日子决定，暴风雪时不出现
export function skyAt(S, t) {
  const p = ((t / DAY_LEN) % 1 + 1) % 1, d = Math.floor(t / DAY_LEN);
  const ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const we = wxeAt(S, t), bz = weatherAt(S, t).blizzard || (we.on && we.ev.kind === 'ice'); // 冰风暴时天上也是厚云
  // 第一夜一定有极光，之后大约三夜一次
  const aurDay = d === 0 || hash3(d, 211, S.runSeed) < 0.34;
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
  ice: { n: '冰风暴', ic: '🧊', d: '冻雨把一切裹上一层冰壳：暖炉和暖气管冻住不供热，户外采集慢三成。', prep: '给管道裹保温毡', prepD: '暖炉和暖气管照常供热', cost: { wood: 40, plank: 30 } },
  cold: { n: '极寒夜', ic: '🌡', d: '一夜之间气温再降一截：熔炉要多烧六成燃料，烧够了屋里也会冷几度；燃料不够会冷得更厉害。', prep: '封好门窗缝', prepD: '降温减半', cost: { wood: 50, plank: 10 } },
  crack: { n: '冰湖开裂', ic: '💧', d: '冰湖上裂开一道道水沟，只能绕路：营地附近有冰湖的，搬运慢 35%；侦察队和运输线也慢三成。', prep: '铺木板便道', prepD: '营地里搬运照常', cost: { plank: 60 } },
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
  if (!c || !ev || (!e.on && e.inSec > forecastOf(S))) return { ok: false, reason: '眼下没有这样的天气预报' };
  if (wxePrepped(S, c, ev)) return { ok: false, reason: '已经准备好了' };
  if (!wxeMatters(S, c, ev)) return { ok: false, reason: '这座营地不用准备' };
  const cost = wxePrepCost(S, c, ev);
  if (!canAfford(c.stock, cost)) return { ok: false, reason: '材料不够' };
  for (const k in cost) c.stock[k] -= cost[k];
  S.wxPrep ||= {}; (S.wxPrep[ev.k] ||= {})[c.id] = 1;
  for (const k in S.wxPrep) if (+k < ev.k - 2) delete S.wxPrep[k];
  logMsg(S, `「${c.name}」${WXE[ev.kind].prep}：${WXE[ev.kind].n}来了也不怕，${WXE[ev.kind].prepD}。`, 'good');
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
  if (on && c.odCool > 0) return { ok: false, reason: '炉膛还在降温，等一会儿' };
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
    d += towerPower(b.lvl) * staff * (1 + specOf(S, b) + 0.15 * up(S, 'guard') + ((focusOf(camp) || {}).tower || 0));
  }
  return Math.round(d * (1 + buffOf(S, camp, 'def') + lawSum(S, 'def') + techSum(S, 'def') + relicSum(S, 'def') + ((focusOf(camp) || {}).def || 0)));
}
export function nextRaid(S) {
  const k = Math.max(0, Math.ceil((S.t - RAID_FIRST - RAID_P) / RAID_P));
  for (let kk = k; kk < k + 3; kk++) {
    const s = raidSlot(S, kk);
    if (s.t > S.t && kk > S.raidDone && s.t >= (S.safeUntil || 0)) {
      const camp = S.camps[Math.floor(s.pick * S.camps.length)];
      return { ...s, camp: camp.id, in: s.t - S.t };
    }
  }
  return null;
}

// ---------- 加成：各项百分比先加在一起再乘一次，每样都有上限（全部拉满大约 ×4）----------
// 吃不饱、太冷、希望低、人手不足照旧打折扣，这些不算加成
export const BONUS_CAP = { tech: 0.4, spec: 1, focus: 0.3, star: 0.45, mile: 0.15, ember: 0.6, relic: 0.1, adj: 0.4 };
export const EMBER_PROD = 0.04;
export function prodBonus(S, b, camp, syn, beltB) {
  const R = rt(S);
  if (syn == null) syn = R.adj.get(b.id) || 0;
  if (beltB == null) beltB = (R.b[b.id] || {}).beltB || 0;
  const st = bStar(S, b), stV = Math.min(BONUS_CAP.star, STAR_PROD[st] || 0);
  const mi = Math.min(BONUS_CAP.mile, lineProd(S, b) - (STAR_PROD[st] || 0));
  const parts = [
    ['升星', stV],
    ['里程碑', mi],
    ['研究', Math.min(BONUS_CAP.tech, techBP(S, b.type))],
    ['专家', Math.min(BONUS_CAP.spec, specOf(S, b))],
    ['专精', Math.min(BONUS_CAP.focus, focusProd(camp, b.type))],
    ['相邻、传送带', Math.min(BONUS_CAP.adj, SYN_PER * syn + beltB)],
    ['余烬', Math.min(BONUS_CAP.ember, EMBER_PROD * up(S, 'prod'))],
    ['遗物', Math.min(BONUS_CAP.relic, relicSum(S, 'prod'))],
    ['律令', lawSum(S, 'prod')],
    ['鼓舞', buffOf(S, camp, 'prod')],
  ].filter(p => Math.abs(p[1]) > 1e-9);
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
  if (m.lvl >= SPEC_MAX) return { ok: false, reason: '已经练到顶了' };
  const camp = getCamp(S, S.active) || S.camps[0];
  const cost = specTrainCost(m.lvl);
  for (const k in cost) if (RES[k].t > S.known) return { ok: false, reason: `需要「${RES[k].n}」` };
  if (!canAfford(camp.stock, cost)) return { ok: false, reason: '缺：' + missing(camp.stock, cost).join('，') };
  pay(camp.stock, cost); m.lvl++;
  return { ok: true };
}

// ---------- 研究 ----------
export function techDone(S, id) { return !!(S.tech && S.tech.done[id]); }
export function techSum(S, k) { let v = 0; if (S.tech) for (const t of TECHS) if (S.tech.done[t.id] && t.fx[k]) v += t.fx[k]; return v; }
function techBP(S, type) { let v = 0; if (S.tech) for (const t of TECHS) if (S.tech.done[t.id] && t.fx.bp && t.fx.bp[type]) v += t.fx.bp[type]; return v; }
function techState(S) { return S.tech || (S.tech = { done: {}, cur: null, prog: 0 }); }
// 能不能开始研究：已完成 / 正在研究 / 缺前置 / 没侦察到 / 缺材料
export function techCheck(S, id) {
  const t = TECHS.find(x => x.id === id), T = techState(S);
  if (!t) return { ok: false, reason: '' };
  if (T.done[id]) return { ok: false, done: true, reason: '已完成' };
  if (T.cur === id) return { ok: false, cur: true, reason: '研究中' };
  const miss = (t.req || []).filter(r => !T.done[r]);
  if (miss.length) return { ok: false, lock: true, reason: '先研究「' + miss.map(r => TECHS.find(x => x.id === r).n).join('」「') + '」' };
  if (t.t > S.known) return { ok: false, lock: true, reason: `侦察到「${['', '篝火', '煤与铁', '钢与蒸汽', '油与铁路', '霜晶', '遗迹金属', '炉心'][t.t]}」纬度后才能研究` };
  if (T.cur) return { ok: false, busy: true, reason: `正在研究「${TECHS.find(x => x.id === T.cur).n}」` };
  const camp = getCamp(S, S.active) || S.camps[0];
  if (!canAfford(camp.stock, t.cost)) return { ok: false, soft: true, reason: '缺：' + missing(camp.stock, t.cost).join('，') };
  return { ok: true };
}
export function startTech(S, id) {
  const ck = techCheck(S, id); if (!ck.ok) return ck;
  const t = TECHS.find(x => x.id === id), T = techState(S), camp = getCamp(S, S.active) || S.camps[0];
  pay(camp.stock, t.cost); T.cur = id; T.prog = 0; T.paidBy = camp.id;
  logMsg(S, `工程站开始研究「${t.n}」。`);
  return { ok: true };
}
export function cancelTech(S) {
  const T = techState(S); if (!T.cur) return;
  const t = TECHS.find(x => x.id === T.cur), camp = getCamp(S, T.paidBy) || S.camps[0];
  for (const k in t.cost) camp.stock[k] = (camp.stock[k] || 0) + t.cost[k];
  logMsg(S, `停止研究「${t.n}」，材料退回了「${camp.name}」。`);
  T.cur = null; T.prog = 0;
}
// 研究点数：各营地工程站每分钟的贡献加起来
function researchStep(S, dt) {
  const R = rt(S), T = techState(S);
  let rate = 0;
  for (const c of S.camps) rate += (R.c[c.id] || {}).rp || 0;
  R.rpRate = rate;
  if (T.cur && T.bank > 0) { T.prog += T.bank; T.bank = 0; } // 探险带回的图纸直接抵研究点数
  if (!T.cur || rate <= 0) { if (T.cur) researchDone(S, T, R); return; }
  T.prog += rate / 60 * dt;
  researchDone(S, T, R);
}
function researchDone(S, T, R) {
  const t = TECHS.find(x => x.id === T.cur);
  if (t && T.prog >= t.pts) {
    T.bank = (T.bank || 0) + (T.prog - t.pts); // 多出来的点数留给下一项
    T.done[t.id] = true; T.cur = null; T.prog = 0;
    logMsg(S, `研究完成「${t.n}」：${t.d}。`, 'good');
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
  const wait = lawWait(S, id); if (wait > 0) return { ok: false, reason: `「${l.n}」刚改过，${Math.ceil(wait / 60)} 分钟后才能再改。` };
  S.laws = S.laws || {}; S.lawT = S.lawT || {};
  const on = !S.laws[id];
  if (on) S.laws[id] = true; else { delete S.laws[id]; for (const c of S.camps) bumpMood(c, 0, 4); }
  S.lawT[id] = S.t;
  logMsg(S, on ? `签署了律令「${l.n}」。` : `废除了律令「${l.n}」。朝令夕改，有人不太高兴。`, on ? 'info' : 'warn');
  return { ok: true, on };
}
// 希望和不满会慢慢走向一个「目标值」；目标值由住处、冷暖、吃饭、病人、律令等决定
export function moodFactors(S, camp, cr) {
  const ppl = Math.max(1, camp.people), u = Math.max(0, camp.people - (cr.housed ?? camp.people)) / ppl;
  const tH = cr.tH ?? 10, hung = cr.hunger || 0, sk = Math.max(0, (cr.sick || 0) - 0.5 * (cr.treated || 0)) / ppl, fueled = cr.fueled ?? 1; // 住进医务所的病人，大家没那么揪心
  const hope = [], disc = [];
  hope.push(['住处', u > 0 ? -30 * u : 8]);
  hope.push(['冷暖', tH >= 10 ? 8 : tH >= 0 ? 0.8 * tH : Math.max(-20, 1.5 * tH)]);
  hope.push(['吃饭', hung > 0.01 ? -25 * Math.min(1, hung * 2) : (cr.foodNet ?? 0) >= 0 ? 6 : -4]);
  if (sk > 0) hope.push(['病人', -40 * sk]);
  if (fueled < 0.99) hope.push(['熔炉断燃', -15 * (1 - fueled)]);
  const fl = S.founded.length - 1; if (fl > 0) hope.push(['北行的进展', 2 * fl]);
  { const D = diffOf(S); if (D.hope) hope.push([`难度：${D.n}`, D.hope]); }
  { const dh = decoHope(S, camp); if (dh.raw > 0) hope.push(['装饰', dh.v]); }
  { const F = focusOf(camp); if (F && F.hope) hope.push([`${F.n}营地`, F.hope]); if (F && F.disc) disc.push([`${F.n}营地`, F.disc]); }
  const glow = (camp.buffs || []).some(b => b.n === '庆典余温' && b.until > S.t);
  if (camp.fest) { hope.push(['篝火庆典', 18]); disc.push(['篝火庆典', -10]); }
  else if (glow) { hope.push(['庆典余温', 10]); disc.push(['庆典余温', -6]); }
  else if (buffOf(S, camp, 'prod') > 0) hope.push(['篝火会', 8]);
  if (u > 0) disc.push(['没有床位', 25 * u]);
  if (hung > 0.01) disc.push(['挨饿', 30 * Math.min(1, hung * 2)]);
  if (tH < 0) disc.push(['太冷', Math.min(20, -tH * 1.2)]);
  if (sk > 0) disc.push(['病人', 20 * sk]);
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
  cr.mood = m;
  // 不满太高：有人趁夜离开（永不全灭）
  if (camp.disc >= LEAVE_AT && camp.people > LEAVE_MIN) {
    camp.leaveAcc = (camp.leaveAcc || 0) + camp.people * 0.003 * (camp.disc - LEAVE_AT) / (100 - LEAVE_AT) / 60 * dt;
    while (camp.leaveAcc >= 1) {
      camp.leaveAcc -= 1;
      if (camp.people <= LEAVE_MIN) { camp.leaveAcc = 0; break; }
      camp.people--; S.stats.left = (S.stats.left || 0) + 1; trimWorkers(S, camp);
      logMsg(S, `「${camp.name}」有人对营地失去了信心，趁夜离开了。`, 'bad');
    }
  } else camp.leaveAcc = 0;
  if (camp.disc >= 70 && !camp.discWarn) { camp.discWarn = true; logMsg(S, `「${camp.name}」的不满在蔓延（${Math.round(camp.disc)}）。超过 85 就会有人离开。看看「人心」面板里是什么让大家不满。`, 'warn'); }
  if (camp.disc < 60) camp.discWarn = false;
  if (camp.hope <= 20 && !camp.hopeWarn) { camp.hopeWarn = true; logMsg(S, `「${camp.name}」的人快没有盼头了（希望 ${Math.round(camp.hope)}），干活越来越没劲。`, 'warn'); }
  if (camp.hope > 30) camp.hopeWarn = false;
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
  if (w.blizzard && wx.last !== w.slot.k) { wx.last = w.slot.k; S.stats.blizzards++; logMsg(S, `暴风雪来了！气温骤降，室外的人会冻伤。${S.camps.some(c => c.odAuto !== false) ? '熔炉已自动超载顶住寒潮。' : ''}`, 'bad'); }
  if (w.warn && wx.warn !== w.slot.k) { wx.warn = w.slot.k; logMsg(S, `暴风雪将在 ${Math.ceil(w.inSec / 60)} 分钟后到来，备足燃料和熟食。`, 'warn', { act: 'wx', label: '备战' }); }
  if (!w.blizzard && !w.warn && w.next <= forecastOf(S) && wx.fc !== w.slot.k) {
    wx.fc = w.slot.k;
    const c = getCamp(S, S.active) || S.camps[0];
    logMsg(S, `❄ 气象预报：约 ${Math.round(w.next / 60)} 分钟后有一场暴风雪，持续约 ${Math.round((w.slot.end - w.slot.start) / 60)} 分钟，「${c.name}」会降温 ${Math.round(slotDrop(S, c, w.slot))}°。看看燃料和熟食撑不撑得住。`, 'warn', { act: 'wx', label: '备战' });
  }
  // 其他天气：预报、临近提醒、开始、结束
  const we = w.ev = wxeAt(S, S.t);
  if (we.ev) {
    const E = WXE[we.ev.kind], k = we.ev.k, c0 = getCamp(S, S.active) || S.camps[0];
    if (we.on && wx.es !== k) {
      wx.es = k; wx.ef = wx.ew = k;
      S.stats.wxe ||= {}; S.stats.wxe[we.ev.kind] = (S.stats.wxe[we.ev.kind] || 0) + 1;
      logMsg(S, `${E.ic} ${E.n}来了！${E.d}`, 'bad', { act: 'wx', label: '看看' });
    } else if (!we.on && we.inSec <= WXE_WARN && wx.ew !== k) {
      wx.ew = k; wx.ef = k;
      const need = S.camps.filter(c => wxeMatters(S, c, we.ev) && !wxePrepped(S, c, we.ev));
      logMsg(S, `${E.ic} ${E.n}还有 ${Math.ceil(we.inSec / 60)} 分钟就到。${need.length ? `还没准备的营地：${need.map(c => `「${c.name}」`).join('')}。` : ''}`, 'warn', { act: 'wx', label: '准备' });
    } else if (!we.on && we.inSec <= forecastOf(S) && wx.ef !== k) {
      wx.ef = k;
      logMsg(S, `${E.ic} 气象预报：约 ${Math.round(we.inSec / 60)} 分钟后有一场${E.n}，持续约 ${Math.round((we.ev.end - we.ev.start) / 60)} 分钟。${wxeMatters(S, c0, we.ev) ? `可以提前「${E.prep}」。` : ''}`, 'warn', { act: 'wx', label: '看看' });
    }
  }
  if (wx.es != null && wx.ee !== wx.es && !(we.on && we.ev.k === wx.es)) {
    wx.ee = wx.es;
    const z = wxeSlot(S, wx.es);
    if (S.t >= z.end && S.t - z.end < 600) logMsg(S, `${WXE[z.kind].ic} ${WXE[z.kind].n}过去了。`, 'good');
  }
  regrow(S, dt);
  for (const camp of S.camps) campStep(S, camp, dt, w);
  rateStep(S, dt);
  holdStep(S, dt);
  researchStep(S, dt);
  linesStep(S, dt);
  scoutsStep(S, dt);
  raidsStep(S, dt);
  journeyStep(S, dt);
  R.chapT = (R.chapT || 0) + dt; if (R.chapT >= 1) { const cdt = R.chapT; R.chapT = 0; chapterStep(S); linesTick(S, cdt); farStep(S); gangsStep(S); }
  R.qT = (R.qT || 0) + dt; if (R.qT >= 2) { R.qT = 0; queueStep(S); caravanStep(S); }
  R.bookT = (R.bookT || 0) + dt; if (R.bookT >= 3) { R.bookT = 0; bookTick(S); }
  S.t += dt;
  histStep(S, dt);
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
  if (type === 'furnace') return { ok: false, reason: '前哨熔炉不能排队' };
  const ck = checkPlace(S, type, x, y);
  if (ck.ok) return place(S, type, x, y);
  if (!ck.soft) return ck;
  S.queue = S.queue || [];
  if (S.queue.filter(q => q.camp === ck.camp).length >= QUEUE_MAX) return { ok: false, reason: `这个营地已经排了 ${QUEUE_MAX} 栋在等材料` };
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
    if (inQ >= QUEUE_MAX) { plan.push({ x, y, st: 'bad', reason: `这个营地已经排了 ${QUEUE_MAX} 栋在等材料` }); bad++; continue; }
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
    if (!ck.ok && !ck.soft) { unqueue(S, q.id); logMsg(S, `排队的${BLD[q.type].n}那块地已经不能建了（${ck.reason}），已取消。`, 'warn'); continue; }
    if (!ck.ok) continue;
    unqueue(S, q.id);
    const r = place(S, q.type, q.x, q.y);
    if (r.ok) { logMsg(S, `材料到齐，排队的${BLD[q.type].n}在「${camp.name}」开工建好了。`, 'good'); rt(S).fx.push({ kind: 'qbuilt', id: r.id }); }
  }
  for (const b of S.buildings) {
    if (!b.qup) continue;
    const camp = getCamp(S, b.camp), cost = upgradeCost(S, b);
    if (Object.keys(cost).some(k => RES[k].t > S.known)) continue;
    if (!canAfford(camp.stock, cost)) continue;
    b.qup = 0;
    if (upgrade(S, b.id).ok && b.type !== 'furnace') logMsg(S, `材料到齐，${BLD[b.type].n}自动升到了 ${b.lvl} 级。`, 'good');
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
  const c = S.car, o = c && c.orders[i]; if (!o) return '没有这张订单';
  if (o.done) return '已经交过货了';
  const camp = getCamp(S, c.camp); if (!camp) return '营地不在了';
  if ((camp.stock[o.ask] || 0) < o.n) return `${RES[o.ask].n}不够（还差 ${Math.ceil(o.n - (camp.stock[o.ask] || 0))}）`;
  if (o.kind === 'people') {
    const beds = Math.floor(freeBeds(S, camp)); if (beds < o.gn) return `床位不够：要空出 ${o.gn} 张，现在空 ${Math.max(0, beds)} 张`;
    // 跟新人自己来投奔一样：口粮撑不住就先别收人，免得大家一起挨饿
    const cr = rt(S).c[camp.id] || {};
    if ((cr.foodNet != null && cr.foodNet < EAT * o.gn) || (camp.stock.food || 0) < (camp.people + o.gn) * EAT * 30) return `口粮不够再养 ${o.gn} 个人了：先多弄点吃的`;
  }
  return '';
}
export function deliverOrder(S, i, auto) {
  const why = orderBlock(S, i); if (why) return { ok: false, reason: why };
  const c = S.car, o = c.orders[i], camp = getCamp(S, c.camp);
  camp.stock[o.ask] -= o.n; o.done = true; S.stats.carOrders = (S.stats.carOrders || 0) + 1;
  let got;
  if (o.kind === 'goods') { camp.stock[o.give] = Math.max(camp.stock[o.give] || 0, Math.min(storeCap(S, camp), (camp.stock[o.give] || 0) + o.gn)); got = `${o.gn} ${RES[o.give].n}`; }
  else if (o.kind === 'ember') { S.meta.embers += o.gn; S.meta.emberTotal = (S.meta.emberTotal || 0) + o.gn; got = `${o.gn} 点余烬`; }
  else { addPeople(S, camp, o.gn); got = `${o.gn} 个跟着商队的流浪者在营地住下`; }
  logMsg(S, `${auto ? '商队临走前，' : ''}「${camp.name}」交了 ${o.n} ${RES[o.ask].n}，换来 ${got}。`, 'good');
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
      logMsg(S, n ? `商队收好货物启程了，这次做成了 ${n} 张订单。` : '商队等不到货，拉着雪橇走了。');
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
  logMsg(S, `🛷 一支雪橇商队在「${camp.name}」外扎营，带来 ${S.car.orders.length} 张订单：拿货换稀缺物资、余烬和人手。大约 ${Math.round((S.car.until - S.t) / 60)} 分钟后启程。`, 'good', { act: 'car', label: '看订单' });
}

// 自动把空闲的人派到缺人的建筑（吃饭、取暖优先）
const AUTO_ORDER = ['kitchen', 'hunter', 'greenhouse', 'lumber', 'nursery', 'coalmine', 'warehouse', 'tower', 'heater'];
function autoPr(t) { const i = AUTO_ORDER.indexOf(t); return i < 0 ? 50 + BLD[t].t : i; }
export function autoAssign(S, camp) {
  if (camp.auto === false && !depotAuto(camp)) return;
  const R = rt(S), FULL = '仓库满了';
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

  // 自动机仓：装入核心
  let botCap = 0;
  for (const b of bs) if (b.type === 'bay') botCap += BLD.bay.bots * b.lvl;
  while (camp.bots + 2 <= botCap && (st.core || 0) >= 1) { st.core -= 1; camp.bots += 2; }
  camp.bots = Math.min(camp.bots, botCap);

  // 燃料：熔炉 + 暖炉
  const od = odActive(S, camp, w, fb), stall = camp.odCool > 0;
  const ev = w.ev && w.ev.on ? w.ev.ev : null, evPrep = !!ev && wxePrepped(S, camp, ev);
  const frozen = !!ev && ev.kind === 'ice' && !evPrep, coldNight = !!ev && ev.kind === 'cold';
  let fuelNeed = furnaceBurn(fb.lvl) * Math.max(0.3, 1 + buffOf(S, camp, 'fuel') + lawSum(S, 'fuel') + techSum(S, 'fuel')) * (od ? OD_FUEL : 1) * (coldNight ? WXE_FUEL : 1) * diffOf(S).fuel / 60 * dt;
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
    if (need > 0) heaterHeat += BLD.heater.heat * (1 + 0.5 * (h.lvl - 1)) * (take / need) * staff * (1 + techSum(S, 'heater'));
  }
  const fSpec = specOf(S, fb);
  const odHeat = od ? odBoost(fb.lvl) * fueled * (1 + fSpec * 0.5) : 0;
  const heat = furnaceHeat(fb.lvl) * (stall ? 0.3 : 0.3 + 0.7 * fueled) * (1 + fSpec * 0.5) + 3 * up(S, 'heat') * fueled + heaterHeat + buffOf(S, camp, 'heat') * fueled + 2 * (camp.pipe || 0) * fueled * (frozen ? 0 : 1) + odHeat; // 断燃或停炉时余烬还剩三成热
  // 炉温：超载时升高（工程师看炉子升得慢），不超载时回落
  if (od) {
    camp.ovh = Math.min(100, (camp.ovh || 0) + OD_UP / (1 + fSpec) * dt);
    if (camp.ovh >= 85 && camp.od && !camp.ovhWarn) { camp.ovhWarn = true; logMsg(S, `「${camp.name}」的熔炉烧得发红了（炉温 ${Math.round(camp.ovh)}%），再不停下超载就要被迫停炉降温。`, 'warn', { act: 'wx', label: '看炉温' }); }
    if (camp.ovh >= 100) {
      camp.od = 0; camp.odA = 0; camp.odCool = OD_STALL; camp.ovh = 75;
      logMsg(S, `「${camp.name}」的熔炉超载过头，炉膛被迫停下降温 ${OD_STALL / 60} 分钟，这段时间只剩三成热量！`, 'bad');
      rt(S).fx.push({ kind: 'odstall', camp: camp.id });
    }
  } else {
    camp.ovh = Math.max(0, (camp.ovh || 0) - OD_DOWN * dt);
    if (camp.odCool > 0) { camp.odCool = Math.max(0, camp.odCool - dt); if (!camp.odCool) logMsg(S, `「${camp.name}」的熔炉降好温了，恢复正常供热。`, 'good'); }
  }
  if (camp.ovh < 70) camp.ovhWarn = false;
  // 极寒夜：燃料烧够了还冷三成五，烧不够冷得更多；封好门窗缝减半
  const evDrop = coldNight ? (8 + 2 * (tierOfRow(camp.y) - 1)) * diffOf(S).cold * (evPrep ? 0.5 : 1) * (0.35 + 0.65 * (1 - fueled)) : 0;
  const drop = blizzDrop(S, camp, w) + evDrop;
  cr.ev = ev ? { kind: ev.kind, prep: evPrep, drop: evDrop, frozen } : null;
  const temp = baseTempOfRow(camp.y) + heat - drop;
  camp.temp = temp;

  // 住房与体感温度
  let housing = 0, insW = 0;
  const tInsul = techSum(S, 'insul');
  for (const b of bs) if (b.type === 'tent') { const h = housingOf(b); housing += h; insW += h * ((insulOf(b) + tInsul) * (1 + specOf(S, b) * 0.5)); }
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
      logMsg(S, `「${camp.name}」有了空床位，${k} 个在窝棚里等着的人住了进来${camp.wait ? `（还有 ${camp.wait} 人在等）` : ''}。`, 'good');
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
  const treated = Math.min(sick, ward.beds);
  if (treated > 0) sick -= treated * WARD_REC * ward.care * recMul / 60 * dt;
  if (sevS === 0 && hung === 0) sick -= Math.max(0.05, Math.max(0, sick - treated) * 0.12) * recMul / 60 * dt;
  camp.sick = Math.max(0, Math.min(camp.people * 0.3, sick));
  cr.treated = Math.min(Math.floor(camp.sick), ward.beds); // 显示和心情都按整人算
  for (const b of bs) if (b.type === 'infirmary') {
    const br = R.b[b.id] || (R.b[b.id] = {}), mx = maxWorkers(b.type, b.lvl), sf = mx ? Math.min(1, b.workers / mx) : 0;
    const share = ward.beds > 0 ? wardBeds(b.lvl) * sf / ward.beds : 0, pts = cr.treated * share;
    br.staff = sf; br.pts = pts; br.act = sf * (pts > 0.05 ? 1 : 0.4); br.rate = {};
    br.status = !b.workers ? '没有派人' : sf < 0.99 ? '人手不足' : '运转中';
  }
  // 医生：医务所开张、有人守着，过一阵何大夫会来投奔
  if (!S.meta.specs.he && ward.guard > 0) {
    S.docT = (S.docT || 0) + dt;
    if (S.docT >= DOC_AFTER) {
      const sp = SPECS.find(x => x.id === 'he');
      S.meta.specs.he = { lvl: 1 };
      logMsg(S, `一位背着药箱的老人走进了「${camp.name}」：专家「${sp.n}」（${sp.role}）加入了！${sp.story} 把 TA 安排进医务所。`, 'story', { act: 'tb', arg: 'specs', label: '去安排' });
      R.fx.push({ kind: 'arrive', camp: camp.id });
    }
  }
  const sickN = Math.floor(camp.sick);
  if (sickN >= 2 && !camp.sickWarn) { camp.sickWarn = true; logMsg(S, `「${camp.name}」有 ${sickN} 人冻病或饿病了，病人不能干活。让大家住进暖和的帐篷、吃饱饭，才会慢慢好起来。`, 'warn'); }
  if (sickN === 0) camp.sickWarn = false;

  // 人手
  const labor = camp.people - sickN + camp.bots;
  let assigned = 0;
  for (const b of bs) assigned += b.workers;
  const lf = assigned > 0 ? Math.min(1, labor / assigned) : 1;
  const workEff = labor ? (camp.people * humanEff + camp.bots) / labor : humanEff;

  // 工程站：产出研究点数
  let rp = 0;
  for (const b of bs) {
    if (b.type !== 'workshop') continue;
    const mx = maxWorkers(b.type, b.lvl), staff = mx ? Math.min(1, b.workers * lf / mx) : 0;
    const r = BLD.workshop.research * (1 + 0.25 * (b.lvl - 1)) * staff * workEff * moodMul(camp) * (1 + specOf(S, b) + ((focusOf(camp) || {}).rp || 0));
    const br = R.b[b.id] || (R.b[b.id] = {});
    br.staff = staff; br.rp = r;
    const cur = S.tech && S.tech.cur;
    br.act = cur ? Math.min(1, staff * workEff) : 0;
    br.status = !b.workers ? '没有派人' : !cur ? '等待研究课题' : staff < 0.99 ? '人手不足' : '研究中';
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
    br.status = !b.workers ? '没有派人' : fed < 0.95 ? '缺生肉' : staff < 0.99 ? '人手不足' : '运转中';
    dogs += br.dogs; dogFood += n * BLD.kennel.feed * fed; dogWant += n * BLD.kennel.feed;
  }
  cr.dogs = dogs; cr.dogFood = dogFood; cr.dogWant = dogWant;
  // 搬运工
  let haulers = 2;
  for (const b of bs) if (b.type === 'warehouse') haulers += b.workers * lf * (1 + specOf(S, b));
  const carry = 2 + 0.4 * (fb.lvl - 1);
  const road = camp.road || 0;
  const speed = HAUL_SPEED * (1 + 0.12 * up(S, 'haul') + techSum(S, 'haul') + relicSum(S, 'haul') + 0.2 * road) * (w.blizzard && road < 3 ? 0.6 : 1) * (ev && ev.kind === 'crack' && !evPrep && campIce(S, camp) > 0 ? WXE_CRACK : 1);

  // 第一遍：期望速率与搬运需求
  const plans = [];
  let demand = 0;
  for (const b of bs) {
    const d = BLD[b.type];
    if (!d.out) continue;
    const mx = bMax(S, b);
    const staff = mx ? Math.min(1, b.workers * lf / mx) : 1;
    const syn = R.adj.get(b.id) || 0;
    const bo = R.beltOut.get(b.id), bi = R.beltIn.get(b.id);
    let beltB = 0;
    if (bi && d.in) { const ks = Object.keys(d.in); for (const k of ks) if (bi[k]) beltB += BELT[bi[k]].bonus / ks.length; }
    const mult = levelMul(b.lvl) * (1 + prodBonus(S, b, camp, syn, beltB).sum) * staff * workEff * prodMul * (ev && ev.kind === 'ice' && BLD[b.type].cat === 'gather' ? WXE_ICE_GATHER : 1);
    const br = R.b[b.id] || (R.b[b.id] = {});
    br.staff = staff;
    if (mult <= 0) { br.act = 0; br.status = b.workers ? '没人干活' : '没有派人'; br.haul = 0; continue; }
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
  const hf = demand > 0 ? Math.min(1, haulers / demand) : 1;

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
      if (left <= 0) { lim = 0; why = young ? (d.gather[0] === 'tree' ? '等树苗长大' : '等猎物回来') : '附近资源点已采空'; }
      else if (want > left) lim = left / want;
      // 深井：地表采空后，往下挖还能按三成五的产量一直出（不消耗资源点）
      deepX = b.deep ? Math.max(0, DEEP_RATE - lim) : 0;
      if (deepX > 0) { spotShare = lim / (lim + deepX); lim += deepX; why = DEEP_WHY; } else spotShare = 1;
    }
    const gLim = lim; // 只受资源点限制时的速率（算「想要多少原料」用）
    if (d.in) for (const k in d.in) {
      const need = d.in[k] * f;
      if (need <= 0) continue;
      const keep = keepOf(camp, k, cap), have = Math.max(0, (st[k] || 0) - keep);
      if (have < need) { const r = have / need; if (r < lim) { lim = r; why = keep && (st[k] || 0) >= keep * 0.5 ? KEEP_WHY : `缺${RES[k].n}`; whyK = k; } }
    }
    // 产出满仓则停（开了「满仓自动兑换」就不停，多出来的拿去换）
    let room = 1;
    if (!camp.trade) for (const k in d.out) {
      const add = d.out[k] * f;
      if (add <= 0) continue;
      const r = Math.max(0, cap - (st[k] || 0)) / add;
      if (r < room) room = r;
    }
    if (room < lim) { lim = room; why = '仓库满了'; }
    lim = Math.max(0, Math.min(1, lim));
    br.avail = lim;
    f *= lim;
    if (d.in) for (const k in d.in) st[k] = Math.max(0, (st[k] || 0) - d.in[k] * f);
    for (const k in d.out) {
      const amt = d.out[k] * f * (k === 'food' ? kitMul : 1);
      const over = (st[k] || 0) + amt - cap;
      if (over > 0 && camp.trade) tradeOverflow(S, camp, k, over, cap, cr, d);
      st[k] = Math.min(cap, (st[k] || 0) + amt);
      S.stats.prod[k] = (S.stats.prod[k] || 0) + amt;
      (R.made || (R.made = {}))[k] = (R.made[k] || 0) + amt;
      if (d.gather) depleteSpots(S, b, amt * spotShare);
    }
    br.act = Math.min(1, br.staff * workEff * hf * lim);
    br.rate = {}; for (const k in d.out) br.rate[k] = d.out[k] * p.mult * hf * lim * (k === 'food' ? kitMul : 1);
    br.inRate = {}; if (d.in) for (const k in d.in) br.inRate[k] = d.in[k] * p.mult * hf * lim;
    // 想要的原料：只有卡住它的那一种按全速算，其它按实际
    br.want = {}; if (d.in) for (const k in d.in) br.want[k] = k === whyK && (why.startsWith('缺') || why === KEEP_WHY) ? d.in[k] * p.mult * hf * Math.max(0, Math.min(1, gLim, room)) : br.inRate[k];
    br.haul = p.dem * hf * lim;
    br.dist = p.dist;
    br.status = lim < 0.05 ? why : hf < 0.7 ? '搬运工不够' : lim < 0.95 ? why : br.staff < 0.99 ? '人手不足' : workEff < 0.9 ? '太冷，干活慢' : '运转中';
    br.deep = deepX > 0;
  }

  // 空闲的人会在营地附近拾柴、设陷阱（保证任何时候都能慢慢恢复）
  let stalled = 0;
  for (const p of plans) stalled += p.b.workers * lf * (1 - (p.br.avail != null ? p.br.avail : 1));
  const idle = Math.max(0, camp.people - Math.min(camp.people, assigned)) + Math.min(camp.people, stalled);
  const forage = w.blizzard ? 0 : idle * workEff / 60 * dt;
  st.wood = Math.min(cap, (st.wood || 0) + forage * 0.35);
  if (tierOfRow(camp.y) >= 2) st.coal = Math.min(cap, (st.coal || 0) + forage * 0.15); // 北方地表能捡到煤块
  st.game = Math.min(cap, (st.game || 0) + forage * 0.12);
  st.stone = Math.min(cap, (st.stone || 0) + forage * 0.06);
  cr.forage = idle;
  // 吃饭
  const eatMul = Math.max(0.3, 1 + lawSum(S, 'food')) * diffOf(S).eat;
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
    logMsg(S, `「${camp.name}」有人没能熬过去（${hunger > 0.05 ? '饥饿' : '严寒'}）。`, 'bad');
  }
  // 新人投奔
  const free = Math.min(housing, popCap(S, camp)) - camp.people - away - (camp.wait || 0);
  const canArrive = free >= 1 && (cr.foodNet == null || cr.foodNet >= EAT * 1.5) && (st.food || 0) > camp.people * EAT * 30 && tH >= -2 && !w.blizzard && hunger === 0;
  if (canArrive) {
    camp.arriveAcc += (0.12 + 0.03 * fb.lvl) * (camp.people < 20 ? 3 : 1) * (1 + 0.15 * up(S, 'people') + ((focusOf(camp) || {}).arrive || 0)) * (0.7 + 0.6 * (camp.hope ?? 50) / 100) / 60 * dt; // 开局人少时来得快；希望越高来得越快
    while (camp.arriveAcc >= 1 && camp.people + away < Math.min(housing, popCap(S, camp))) {
      camp.arriveAcc -= 1; camp.people++; S.stats.arrivals++;
      R.fx.push({ kind: 'arrive', camp: camp.id });
    }
  } else if (camp.people < 10 && free >= 1 && !w.blizzard && hunger === 0 && (st.food || 0) > (camp.people + 1) * EAT * 20) {
    // 营地快撑不住时，附近流浪的人仍会被火光吸引过来（保证总能恢复）；没吃的就不来，免得来一个饿死一个
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
  const fuelWant = furnaceBurn(fb.lvl);
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
    temp, tH, tU, heat, fueled, drop, burnPerMin: dt > 0 ? fuelNeed / dt * 60 : furnaceBurn(fb.lvl), baseBurn: dt > 0 ? fuelNeed / dt * 60 / (od ? OD_FUEL : 1) : furnaceBurn(fb.lvl), fuelUnits: fuelUnitsOf(st),
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
  for (const b of S.buildings) if (b.camp === camp.id && BLD[b.type].in) for (const q in BLD[b.type].in) used.add(q);
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
  let over = assignedWorkers(S, camp.id) - (camp.people + camp.bots);
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
export const REGROW = { tree: 1, herd: 0.5 }, TEND = { tree: 4, herd: 3 };
const TEND_BY = { lumber: 'tree', hunter: 'herd' };
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

// ---------- 运输线 ----------
export function lineCost(S, a, b) {
  const ca = getCamp(S, a), cb = getCamp(S, b);
  const d = Math.hypot(ca.x - cb.x, ca.y - cb.y);
  return { wood: Math.round(150 + d * 4), plank: Math.round(60 + d * 1.5) };
}
export function lineCap(S, l) {
  const ca = getCamp(S, l.a), cb = getCamp(S, l.b);
  const d = Math.hypot(ca.x - cb.x, ca.y - cb.y);
  const base = (l.rail ? 50 : 12) * (1 + 0.5 * (l.lvl - 1)); // 每级 +50%（按 1 级算）
  const ev = wxeAt(S, S.t);
  return base * Math.min(1, 40 / Math.max(20, d)) * (1 + 0.12 * up(S, 'haul') + techSum(S, 'line')) * (1 + dogLine(S, l)) * (ev.on && ev.ev.kind === 'crack' ? WXE_SLOW : 1);
}
// 雪橇犬：每只狗让本营地的侦察队快 5%（最多 +60%），让连着的运输线多运 3%（最多 +45%，蒸汽轨道减半）
export function kennelDogs(lvl) { return BLD.kennel.dogs + 2 * (lvl - 1); }
export function dogsOf(S, cid) { return (rt(S).c[cid] || {}).dogs || 0; }
export function dogScout(S, cid) { return Math.min(0.6, 0.05 * dogsOf(S, cid)); }
export function dogLine(S, l) { return Math.min(0.45, 0.03 * (dogsOf(S, l.a) + dogsOf(S, l.b))) * (l.rail ? 0.5 : 1); }
export function lineUpCost(S, l) {
  if (!l.rail && S.known >= 4 && l.lvl >= 3) return { steel: 150, seal: 40, engine: 10, rail: true };
  const m = Math.pow(1.5, l.lvl);
  if (l.rail) return { steel: Math.round(60 * m), seal: Math.round(15 * m) };
  return { wood: Math.round(100 * m), plank: Math.round(60 * m), ...(l.lvl >= 2 ? { iron: Math.round(10 * m) } : {}) };
}
export function addLine(S, a, b) {
  if (a === b) return { ok: false, reason: '同一个营地' };
  if (S.lines.some(l => (l.a === a && l.b === b) || (l.a === b && l.b === a))) return { ok: false, reason: '已经连通' };
  const cost = lineCost(S, a, b);
  const ca = getCamp(S, a);
  if (!canAfford(ca.stock, cost)) return { ok: false, reason: '缺：' + missing(ca.stock, cost).join('，') };
  pay(ca.stock, cost);
  S.lines.push({ id: S.nextId++, a, b, lvl: 1, rail: false, routes: [] });
  logMsg(S, `雪橇队开通：「${ca.name}」⇄「${getCamp(S, b).name}」。`, 'good');
  return { ok: true };
}
export function upgradeLine(S, lid) {
  const l = S.lines.find(x => x.id === lid); if (!l) return { ok: false };
  const c = { ...lineUpCost(S, l) }; const toRail = !!c.rail; delete c.rail;
  const ca = getCamp(S, l.a);
  if (!canAfford(ca.stock, c)) return { ok: false, reason: '缺：' + missing(ca.stock, c).join('，') };
  pay(ca.stock, c);
  if (toRail) { l.rail = true; l.lvl = 1; logMsg(S, '雪橇线改建成铁路，运量大增！', 'good'); } else l.lvl++;
  return { ok: true };
}
export function setRoutes(S, lid, routes) { const l = S.lines.find(x => x.id === lid); if (l) l.routes = routes.slice(0, 4); }
function linesStep(S, dt) {
  const R = rt(S);
  for (const l of S.lines) {
    const active = l.routes.filter(r => r.res);
    const lr = R.b['L' + l.id] || (R.b['L' + l.id] = {});
    lr.flow = 0;
    if (!active.length) continue;
    const per = lineCap(S, l) / 60 * dt / active.length;
    for (const r of active) {
      const from = getCamp(S, r.from === 'b' ? l.b : l.a), to = getCamp(S, r.from === 'b' ? l.a : l.b);
      if (!from || !to) continue;
      if (r.res === 'people') {
        r.acc = (r.acc || 0) + dt / 90 * Math.min(1, lineCap(S, l) / 12);
        let free = Math.floor(Math.min(freeBeds(S, to), popRoom(S, to)));
        while (r.acc >= 1) { r.acc -= 1; if (free >= 1 && from.people > MIN_PEOPLE + 3) { from.people--; to.people++; free--; trimWorkers(S, from); } }
        continue;
      }
      const keep = r.keep != null ? r.keep : 50;
      const avail = Math.max(0, (from.stock[r.res] || 0) - keep);
      const room = Math.max(0, storeCap(S, to) - (to.stock[r.res] || 0));
      const mv = Math.min(per, avail, room);
      from.stock[r.res] -= mv; to.stock[r.res] = (to.stock[r.res] || 0) + mv;
      lr.flow += mv / dt * 60;
    }
  }
}

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
  if (!sl.n) return { ok: false, reason: '先建一座侦察营' };
  if (sl.used >= sl.n) return { ok: false, reason: '侦察队都出去了，升级侦察营可多派一队' };
  const range = scoutRange(S, cid);
  if (Math.hypot(tx + 0.5 - c.x, ty + 0.5 - c.y) > range) return { ok: false, reason: `太远了：侦察营 ${sl.lvl} 级只能走 ${range} 格，升级侦察营或在更北处建营地` };
  const n = kind === 'rescue' ? 4 : 3;
  if (c.people - n < MIN_PEOPLE) return { ok: false, reason: '营地人太少' };
  const cost = scoutCost(S, cid, tx, ty, kind);
  if (!canAfford(c.stock, cost)) return { ok: false, reason: '缺：' + missing(c.stock, cost).join('，') };
  pay(c.stock, cost);
  c.people -= n;
  trimWorkers(S, c); // 人手不够时从次要岗位上抽人
  S.scouts.push({ id: S.nextId++, camp: cid, kind, poi: poiId, x: c.x, y: c.y, tx: Math.max(0, Math.min(W - 1, tx)), ty: Math.max(0, Math.min(H - 1, ty)), phase: 'out', n, carry: { people: 0, loot: {}, spec: null } });
  return { ok: true };
}
// ---------- 矿挖完的出路：深井 + 勘探新矿脉 ----------
export const DEEP_RATE = 0.35, DEEP_WHY = '深井作业中';
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
  if (!deepable(b.type)) return '只有矿场、采石场能挖深井';
  if (b.deep) return '已经是深井了';
  if (gatherLeftFrac(S, b) > 0.25) return '附近的矿还多，剩下不到四分之一再挖深井';
  const c = getCamp(S, b.camp);
  if (!canAfford(c.stock, deepCost(S, b))) return '缺：' + missing(c.stock, deepCost(S, b)).join('，');
  return '';
}
export function digDeep(S, id) {
  const b = getB(S, id); if (!b) return { ok: false, reason: '建筑不在了' };
  const why = deepBlock(S, b); if (why) return { ok: false, reason: why };
  pay(getCamp(S, b.camp).stock, deepCost(S, b));
  b.deep = 1; dirty(S);
  logMsg(S, `「${getCamp(S, b.camp).name}」的${BLD[b.type].n}挖成了深井：地表采空以后，还能按三成五的产量一直挖下去。`, 'good');
  return { ok: true };
}

// 勘探：从侦察营派三个人，在供热圈里找出埋得深的新矿脉（每次两处，越勘越贵）
export const SURVEY_N = 3;
function surveyKinds(S, camp) {
  // 这个纬度有、又不会长回来的矿；最缺的排前面
  const cr = rt(S).c[camp.id] || {}, flow = cr.flow || {};
  const ks = SPOT_KEYS.filter(k => !REGROW[k] && SPOTS[k].from <= camp.y);
  const gap = k => { const f = flow[SPOTS[k].res]; return f ? Math.max(0, f.want - f.p) : 0; };
  const has = k => S.buildings.some(b => b.camp === camp.id && BLD[b.type].gather && BLD[b.type].gather.includes(k));
  return ks.sort((a, b) => gap(b) - gap(a) || (has(b) ? 1 : 0) - (has(a) ? 1 : 0) || SPOTS[b].from - SPOTS[a].from);
}
export function surveyCost(S, camp) {
  const n = camp.surveys || 0, m = Math.pow(1.5, n) * thrift(S), t = tierOfRow(camp.y);
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
function veinRoom(S, type, tiles, cid) {
  const d = BLD[type], s = d.size, r = d.reach + s / 2, avoid = tiles.map(t => t.i);
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
  if (!sl.n) return '先在这个营地建一座侦察营';
  if (S.scouts.some(s => s.camp === camp.id && s.kind === 'survey')) return '勘探队已经出发了';
  if (sl.used >= sl.n) return '侦察队都出去了，等他们回来';
  if (camp.people - SURVEY_N < MIN_PEOPLE) return '营地人太少';
  if (!surveyKinds(S, camp).length) return '这里没有能勘探的矿';
  if (!surveyPick(S, camp)) return '供热圈里没有空地放新矿场了，升级熔炉或管道扩大供热圈';
  const cost = surveyCost(S, camp);
  if (!canAfford(camp.stock, cost)) return '缺：' + missing(camp.stock, cost).join('，');
  return '';
}
export function startSurvey(S, cid) {
  const camp = getCamp(S, cid); if (!camp) return { ok: false, reason: '营地不在了' };
  const why = surveyBlock(S, camp); if (why) return { ok: false, reason: why };
  pay(camp.stock, surveyCost(S, camp));
  const pk = surveyPick(S, camp), kind = pk.kind, [c, c2] = pk.tiles;
  camp.people -= SURVEY_N; trimWorkers(S, camp);
  camp.surveys = (camp.surveys || 0) + 1;
  S.scouts.push({ id: S.nextId++, camp: cid, kind: 'survey', x: camp.x, y: camp.y, tx: c.x, ty: c.y, phase: 'out', n: SURVEY_N, carry: { people: 0, loot: {}, spec: null }, vein: { k: kind, at: [c.i, ...(c2 ? [c2.i] : [])] } });
  logMsg(S, `勘探队出发了，去「${camp.name}」供热圈里找${SPOTS[kind].n}。`);
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
    logMsg(S, `勘探队在「${camp.name}」挖到了 ${got.length} 处埋得很深的${SPOTS[v.k].n}！在旁边建${BLD[Object.keys(BLD).find(t => BLD[t].gather && BLD[t].gather.includes(v.k))].n}就能开采。`, 'good');
    R.fx.push({ kind: 'vein', camp: camp.id, i: got[0] });
  } else logMsg(S, `勘探队到了地方，可那里已经盖了房子，只好空手回来。`, 'warn');
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
    if (d > mv) { s.x += dx / d * mv; s.y += dy / d * mv; if (s.phase === 'out') revealCircle(S, s.x, s.y, 2 + up(S, 'sight')); continue; }
    s.x = tx; s.y = ty;
    if (s.phase === 'out' && s.kind === 'survey') { foundVein(S, s); s.phase = 'back'; continue; }
    if (s.phase === 'out') {
      const r = 5 + up(S, 'sight');
      revealCircle(S, s.x, s.y, r);
      // 风险：越冷越危险
      const risk = coldRisk(S, s.camp, s.ty);
      const risk2 = s.kind === 'exp' ? expRiskOf(risk, s.sup) : risk;
      if (hash3(s.id, 991, S.runSeed) < risk2) { s.n--; S.stats.deaths++; logMsg(S, `一名${s.kind === 'rescue' ? '救援队员' : s.kind === 'exp' ? '探险队员' : '侦察兵'}在严寒中失踪了。${s.kind === 'exp' && s.sup !== 'full' ? '补给带得太少了。' : ''}`, 'bad'); }
      if (s.kind === 'exp') {
        const p = (w.sites || []).find(q => q.id === s.poi);
        s.phase = 'wait'; s.waitAt = S.t;
        logMsg(S, `探险队抵达「${p ? SITES[p.kind].n : '目的地'}」，等你决定怎么做。`, 'story');
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
          if (p.kind === 'survivors') { S.poiFound[p.id] = 1; logMsg(S, `侦察队发现了 ${p.n} 名被困的幸存者！派救援队去接他们回来。`, 'good'); R.fx.push({ kind: 'poi', id: p.id }); }
          else if (p.kind === 'cache') { S.poiDone[p.id] = 1; const loot = cacheLoot(S, p); for (const k in loot) s.carry.loot[k] = (s.carry.loot[k] || 0) + loot[k]; }
          else if (p.kind === 'spec') { S.poiDone[p.id] = 1; s.carry.spec = p.spec; }
        }
      }
      s.phase = 'back';
    } else {
      home.people += s.n;
      const ad = s.carry.people ? addPeople(S, home, s.carry.people) : null;
      for (const k in s.carry.loot) home.stock[k] = (home.stock[k] || 0) + s.carry.loot[k];
      const lootTxt = Object.keys(s.carry.loot).map(k => `${RES[k].n} ${s.carry.loot[k]}`).join('、');
      if (s.carry.people) logMsg(S, `${s.kind === 'exp' ? '探险队' : '救援队'}带回了 ${s.carry.people} 名幸存者${ad.wait ? `，床位不够，${ad.wait} 人先在窝棚里等床位（多盖帐篷）` : ''}。`, 'good');
      if (lootTxt) logMsg(S, `${s.kind === 'exp' ? '探险队' : '侦察队'}带回：${lootTxt}。`, 'good');
      if (s.carry.hope) bumpMood(home, s.carry.hope, 0);
      if (s.carry.spec) {
        const sp = SPECS.find(x => x.id === s.carry.spec);
        if (!S.meta.specs[sp.id]) { S.meta.specs[sp.id] = { lvl: 1 }; logMsg(S, `专家「${sp.n}」（${sp.role}）加入了！${sp.story} 把 TA 安排进合适的建筑。`, 'story'); }
        else { S.meta.specs[sp.id].lvl++; logMsg(S, `又遇见了「${sp.n}」，TA 的经验更丰富了（${S.meta.specs[sp.id].lvl} 级）。`, 'good'); }
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
export const GANG_NAMES = ['黑旗帮', '狼牙帮', '铁钩子', '冻河帮', '灰鸦', '断刃'];
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
    return `「${c.name}」交了贡（${Object.keys(cost).map(k => `${RES[k].n} ${fmtN(cost[k])}`).join('、')}），「${nm}」的人扛着东西走了。`;
  }
  const T = gangTrade(S, g, c); pay(c.stock, T.give);
  const cap = storeCap(S, c);
  for (const k in T.get) c.stock[k] = Math.min(Math.max(cap, c.stock[k] || 0), (c.stock[k] || 0) + T.get[k]);
  st.rel = (st.rel || 0) + 1; st.trades = (st.trades || 0) + 1;
  return `「${c.name}」和「${nm}」做了一笔买卖：换来 ${Object.keys(T.get).map(k => `${RES[k].n} ${fmtN(T.get[k])}`).join('、')}。`;
}
// 答复索贡：tribute 纳贡 / trade 做买卖 / fight 顶回去（到期时打过来）
// 做买卖要多给口粮：给完不够大家吃 20 分钟就不让做
export function gangTradeBlock(S, g, c) { const give = gangTrade(S, g, c).give; return (c.stock.food || 0) - (give.food || 0) < c.people * EAT * 20 ? '做完这笔买卖，口粮就不够大家吃了' : ''; }
export function gangAnswer(S, id, how) {
  const g = gangOf(S, id), st = (S.gangs || {})[id];
  if (!g || !st || !st.dem || st.gone) return { ok: false, reason: '眼下没有要答复的' };
  const c = getCamp(S, st.dem.camp); if (!c) { st.dem = null; return { ok: false, reason: '营地不在了' }; }
  if (st.dem.fight) return { ok: false, reason: '已经决定顶回去了' };
  if (how === 'tribute' || how === 'trade') {
    const cost = how === 'tribute' ? gangTribute(S, g, c) : gangTrade(S, g, c).give;
    if (!canAfford(c.stock, cost)) return { ok: false, reason: '缺：' + missing(c.stock, cost).join('，') };
    if (how === 'trade' && gangTradeBlock(S, g, c)) return { ok: false, reason: gangTradeBlock(S, g, c) };
    logMsg(S, gangSettle(S, g, st, c, how), 'info');
    return { ok: true };
  }
  if (how === 'fight') {
    st.dem.fight = true;
    logMsg(S, `「${c.name}」把「${gangName(g)}」的人赶了回去。他们撂下话：${fmtMin(st.dem.until - S.t)}后打过来（强度 ${gangStr(S, g)}，防御 ${campDefense(S, c)}）。`, 'warn', { act: 'gang', arg: id, label: '看看' });
    return { ok: true };
  }
  return { ok: false };
}
const fmtMin = s => { s = Math.max(0, Math.round(s)); const m = Math.max(1, Math.round(s / 60)); return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分钟` : `${m} 分钟`; };
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
      logMsg(S, `「${c.name}」又一次打退了「${nm}」（${def} 对 ${str}），缴获 ${Object.keys(loot).map(k => `${RES[k].n} ${loot[k]}`).join('、')}。掠夺者营地散伙了，再也不会来了。余烬 +3。`, 'good');
    } else logMsg(S, `「${c.name}」打退了「${nm}」（${def} 对 ${str}），缴获 ${Object.keys(loot).map(k => `${RES[k].n} ${loot[k]}`).join('、')}。他们吃了亏，下次没那么凶了；再赢一次他们就该散了。`, 'good');
  } else {
    // 口粮大家会先藏起来：最多被抢一成，别的东西最多四分之一
    const r = 1 - def / str, loss = 0.25 * r;
    for (const k in c.stock) c.stock[k] *= (1 - (k === 'food' ? 0.4 : 1) * loss);
    const kill = Math.min(Math.max(0, c.people - MIN_PEOPLE), Math.round(r * 3 + 0.3));
    c.people -= kill; S.stats.deaths += kill; bumpMood(c, -8, 6); trimWorkers(S, c);
    st.rel = 0;
    R.fx.push({ kind: 'raid', camp: c.id, won: false, str, def, t: S.t, gang: g.id });
    logMsg(S, `「${nm}」冲进了「${c.name}」（防御 ${def} 对 ${str}）：物资被抢走约 ${Math.round(loss * 100)}%（口粮藏住了大半）${kill ? `，${kill} 人遇难` : ''}。多建箭塔，或者下次先纳贡。`, 'bad');
  }
}
// 贡凑不齐（或者交了就要挨饿）：有多少交多少（口粮最多交三成，还要留够吃的），他们不满意，下回来得早一些
function gangShort(S, g, st, c) {
  const cost = gangTribute(S, g, c), got = {};
  const keep = c.people * EAT * 20; // 口粮至少留够大家吃 20 分钟
  for (const k in cost) { const have = c.stock[k] || 0, a = Math.floor(Math.min(cost[k], k === 'food' ? Math.min(have * 0.3, have - keep) : have)); if (a > 0) { c.stock[k] -= a; got[k] = a; } }
  st.dem = null; st.next = S.t + GANG_P * 0.6; st.short = (st.short || 0) + 1;
  bumpMood(c, -2, 3);
  return `没人答复，「${c.name}」打不过又凑不齐贡，只交了${Object.keys(got).length ? ` ${Object.keys(got).map(k => `${RES[k].n} ${fmtN(got[k])}`).join('、')}` : '一点零碎'}。「${gangName(g)}」骂骂咧咧地走了，说下回早点来。`;
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
      logMsg(S, `🏴 侦察队在纬度 ${g.y} 一带发现了掠夺者营地「${nm}」：栅栏后面二十来个拿刀的人，营地上插着黑旗。${gangTarget(S, g) ? '离咱们的营地不远，他们迟早会找上门。' : '离咱们的营地还远。'}`, 'story', { act: 'gang', arg: g.id, label: '看看' });
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
      if (def < str && fine) logMsg(S, `没人答复，「${c.name}」的人怕打不过，自己凑了贡。${gangSettle(S, g, st, c, 'tribute')}`, 'info');
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
      logMsg(S, `🏴 「${nm}」派人到了「${c.name}」：要么纳贡，要么等着挨抢。${GANG_WAIT / 60} 分钟内答复（强度 ${gangStr(S, g)}，防御 ${campDefense(S, c)}）。`, 'warn', { act: 'gang', arg: g.id, label: '答复' });
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
  if (st === 'done') return { ok: false, reason: '这里已经探索过了' };
  if (st !== 'seen') return { ok: false, reason: '已经有探险队在路上了' };
  const c = getCamp(S, cid), sl = scoutSlots(S, cid);
  if (!sl.n) return { ok: false, reason: '先建一座侦察营' };
  if (sl.used >= sl.n) return { ok: false, reason: '侦察队都出去了，升级侦察营可多派一队' };
  const range = scoutRange(S, cid) + 10;
  if (Math.hypot(p.x + 0.5 - c.x, p.y + 0.5 - c.y) > range) return { ok: false, reason: `太远了：从「${c.name}」最远能走 ${range} 格` };
  if (c.people - 4 < MIN_PEOPLE) return { ok: false, reason: '营地人太少' };
  const cost = expCost(S, cid, p, sup);
  if (!canAfford(c.stock, cost)) return { ok: false, reason: '缺：' + missing(c.stock, cost).join('，') };
  pay(c.stock, cost);
  c.people -= 4; trimWorkers(S, c);
  S.scouts.push({ id: S.nextId++, camp: cid, kind: 'exp', poi: p.id, sup, x: c.x, y: c.y, tx: p.x, ty: p.y, phase: 'out', n: 4, carry: { people: 0, loot: {}, spec: null } });
  logMsg(S, `探险队带着${sup === 'full' ? '充足的' : '少量'}补给，出发去「${SITES[p.kind].n}」。`);
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
const lootTxt = l => Object.keys(l).map(k => `${RES[k].n} ${l[k]}`).join('、');
const bank = (S, n) => { const T = techState(S); T.bank = (T.bank || 0) + n; };
function revealNextSite(S, p) {
  const w = getWorld(S.runSeed);
  const nx = (w.sites || []).filter(q => q.y > p.y && !S.reveal[idx(q.x, q.y)]).sort((a, b) => a.y - b.y)[0];
  if (nx) revealCircle(S, nx.x, nx.y, 4);
  return nx;
}
// 每种地点 2～3 个选项；need: 'full' 表示要带足补给才能选
const SITE_OPTS = {
  depot: [
    { t: '搬走能搬的', d: (S, p) => lootTxt(siteLoot(S, p, 1)), go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1)); return '大家扛着能用的东西往回走。'; } },
    { t: '翻找旧账本', d: (S, p) => `${lootTxt(siteLoot(S, p, 0.4))} · 找到下一处地点`, go: (S, s, p) => { addLoot(s, siteLoot(S, p, 0.4)); const nx = revealNextSite(S, p); return nx ? `账本上记着另一处地点：北边的「${SITES[nx.kind].n}」。` : '账本上的字都糊了。'; } },
    { t: '扎营一晚，把仓库搬空', need: 'full', d: (S, p) => lootTxt(siteLoot(S, p, 1.9, 3)), go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1.9, 3)); return '靠着带来的补给熬了一夜，把仓库翻了个底朝天。'; } },
  ],
  camp: [
    { t: '邀请他们加入', d: (S, p) => `+${5 + 2 * p.t} 人 · 希望 +3`, go: (S, s, p) => { s.carry.people += 5 + 2 * p.t; s.carry.hope = 3; return '他们收拾好东西，跟着探险队回营地。'; } },
    { t: '用口粮换他们的地图', need: 'full', d: () => '揭开北边一大片迷雾', go: (S, s, p) => { revealCircle(S, p.x, Math.min(H - 1, p.y + 24), 11); revealNextSite(S, p); return '他们在雪地上画出了一条往北的路。'; } },
    { t: '和他们交换物资', d: (S, p) => lootTxt(siteLoot(S, p, 0.8)), go: (S, s, p) => { addLoot(s, siteLoot(S, p, 0.8)); return '两边都拿到了想要的东西，分别时互相道了平安。'; } },
  ],
  train: [
    { t: '撬开货车厢', d: (S, p) => `${lootTxt(siteLoot(S, p, 1.4))} · 有人可能受伤`, go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1.4)); if (hash3(p.id, 77, S.runSeed) < 0.35 && s.n > 1) { s.n--; S.stats.deaths++; return '车厢里的货堆塌了下来，一名队员没能回来。'; } return '车厢里塞满了旧时代的物资。'; } },
    { t: '拆下车头的零件', d: (S, p) => `${lootTxt(siteLoot(S, p, 0.8, 1, ['gear', 'engine', 'iron', 'steel']))} · 图纸 ${12 * p.t} 研究点`, go: (S, s, p) => { addLoot(s, siteLoot(S, p, 0.8, 1, ['gear', 'engine', 'iron', 'steel'])); bank(S, 12 * p.t); return '车头里还夹着一叠泛黄的图纸。'; } },
    { t: '生火化冰，一节节搜', need: 'full', d: (S, p) => `${lootTxt(siteLoot(S, p, 1.4))} · 图纸 ${12 * p.t} 研究点`, go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1.4)); bank(S, 12 * p.t); return '带来的燃料够烧好几天，整列车都搜遍了。'; } },
  ],
  shrine: [
    { t: '刻下我们的名字', d: () => '所有营地希望 +10', go: (S, s, p) => { for (const c of S.camps) bumpMood(c, 10, 0); return '队员们在冰上刻下了营地每个人的名字。消息传回去，大家都很振奋。'; } },
    { t: '撬下上面的晶石', d: (S, p) => `${lootTxt(siteLoot(S, p, 1.2, 1, ['crystal', 'shard', 'star', 'iron', 'stone']))} · 所有营地希望 −4、不满 +6`, go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1.2, 1, ['crystal', 'shard', 'star', 'iron', 'stone'])); for (const c of S.camps) bumpMood(c, -4, 6); return '晶石到手了，可有人说这会带来厄运。'; } },
  ],
  lab: [
    { t: '抄下图纸', d: (S, p) => `图纸 ${25 * p.t} 研究点`, go: (S, s, p) => { bank(S, 25 * p.t); return '桌上的图纸被小心地卷起来，塞进了背包。'; } },
    { t: '拆走仪器', d: (S, p) => lootTxt(siteLoot(S, p, 1, 2, ['gear', 'battery', 'engine', 'seal', 'part'])), go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1, 2, ['gear', 'battery', 'engine', 'seal', 'part'])); return '能拆的零件都拆下来了。'; } },
    { t: '住下来，能抄的全抄完', need: 'full', d: (S, p) => `图纸 ${45 * p.t} 研究点`, go: (S, s, p) => { bank(S, 45 * p.t); return '靠着带来的补给，队员们在观测站里抄了整整一周。'; } },
  ],
  wreck: [
    { t: '拆下合金骨架', d: (S, p) => lootTxt(siteLoot(S, p, 1.6, 2, ['alloy', 'star', 'steel', 'part'])), go: (S, s, p) => { addLoot(s, siteLoot(S, p, 1.6, 2, ['alloy', 'star', 'steel', 'part'])); return '冻硬的骨架一节节拆下来，雪橇都快拉不动了。'; } },
    { t: '找驾驶舱里的航行日志', d: (S, p) => `揭开北边一大片迷雾 · 图纸 ${15 * p.t} 研究点`, go: (S, s, p) => { revealCircle(S, p.x, Math.min(H - 1, p.y + 26), 12); bank(S, 15 * p.t); return '日志里画着飞艇最后的航线，一路通往北方。'; } },
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
    case 'line': return S.lines.length;
    case 'calm': return Math.round(Math.max(...S.camps.map(c => c.disc ?? 10)));
    case 'eternal': return S.eternal ? S.eternal.stage : 0;
    case 'rate': return Math.round(prodRate(S, q.r) * 10) / 10;
    case 'veh': { const J = journeyOf(S); return (J.fleet[q.v] || 0) + ((J.trip && J.trip.veh[q.v]) || 0); }
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
  for (const i of [...S.founded].sort((a, b) => (b === cur) - (a === cur) || b - a)) {
    const ch = CHAPTERS[i]; if (!ch) continue;
    ch.tasks.forEach((q, k) => { if (q.k === 'rate' && !C.ok[i + ':' + k]) out.push({ id: `c${i}:${k}`, r: q.r, n: q.n, t: q.t, ch: i }); });
  }
  if (eternalCamp(S) && S.eternal.stage < ETERNAL_STAGES.length) out.push({ id: `e${S.eternal.stage}`, r: 'heart', n: ETERNAL_STAGES[S.eternal.stage], t: `永恒炉件稳住 ${ETERNAL_STAGES[S.eternal.stage]}/分钟`, eternal: true });
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
  return S.founded.slice().sort((a, b) => a - b).map(i => {
    const ch = CHAPTERS[i];
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
    c.tasks.forEach((t, k) => { if (t.ok && !C.ok[c.i + ':' + k]) { C.ok[c.i + ':' + k] = 1; logMsg(S, `【${c.ch.n}】完成：${t.t}`, 'good'); } });
    if (c.done && !c.got && !C.told?.[c.i]) { C.told = C.told || {}; C.told[c.i] = 1; logMsg(S, `「${c.ch.n}」的任务都完成了，去领取奖励吧。`, 'story'); }
  }
}
export const chapterEmbers = (S, i) => Math.round((10 + 5 * i) * (1 + relicSum(S, 'ember')) * diffOf(S).ember);
export function chapterReward(S, i) {
  const r = CHAPTERS[i].reward, out = [`🔥 余烬 ${chapterEmbers(S, i)}`];
  if (r.res) for (const k in r.res) if (RES[k].t <= Math.max(S.known, 1)) out.push(`${RES[k].n} ${r.res[k]}`);
  if (r.people) out.push(`${r.people} 名新成员`);
  if (r.hope) out.push(`所有营地希望 +${r.hope}`);
  if (r.bank) out.push(`图纸 ${r.bank} 研究点`);
  return out;
}
export function claimChapter(S, i) {
  const c = chapters(S).find(x => x.i === i);
  if (!c || !c.done || c.got) return null;
  const C = chapState(S), r = c.ch.reward, camp = getCamp(S, S.active) || S.camps[0];
  C.got[i] = 1;
  { const e = chapterEmbers(S, i); S.meta.embers += e; S.meta.emberTotal = (S.meta.emberTotal || 0) + e; }
  if (r.res) for (const k in r.res) if (RES[k].t <= Math.max(S.known, 1)) camp.stock[k] = (camp.stock[k] || 0) + r.res[k];
  if (r.people) addPeople(S, camp, r.people);
  if (r.hope) for (const cc of S.camps) bumpMood(cc, r.hope, 0);
  if (r.bank) bank(S, r.bank);
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
  const nr = nextRaid(S); if (!nr || nr.in > RAID_PREP) return { ok: false, reason: '眼下没有袭击要来' };
  const camp = getCamp(S, nr.camp);
  const p = raidPrep(S, nr) || (S.rprep = { k: nr.k, camp: camp.id, t: nr.t });
  if (p[kind]) return { ok: false, reason: '已经安排过了' };
  const cost = prepCost(S, camp, kind), until = nr.in + 60;
  if (kind === 'fire') {
    if (fuelUnitsOf(camp.stock) < cost) return { ok: false, reason: `燃料不够：要 ${cost} 单位` };
    burnUnits(camp.stock, cost);
  } else if (kind === 'mil') {
    if ((camp.stock.food || 0) < cost) return { ok: false, reason: `熟食不够：要 ${cost}` };
    camp.stock.food -= cost; addBuff(S, camp, 'prod', -0.2, until, '民兵上墙');
  } else if (kind === 'hide') addBuff(S, camp, 'prod', -0.1, until, '收拢物资');
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
  const c = getCamp(S, nr.camp), rn = RAIDERS[tierOfRow(c.y)];
  if (nr.in <= RAID_PREP && rw.prep !== nr.k) {
    rw.prep = nr.k;
    logMsg(S, `🐺 侦察兵发现${rn}正朝「${c.name}」过来，大约 ${Math.round(nr.in / 60)} 分钟后到（强度 ${raidStrength(S, c, nr)}，防御 ${raidDefense(S, c, nr)}）。可以提前点火墙、召集民兵。`, 'warn', { act: 'raidp', label: '备战' });
  }
  // 没人下令：守不住的话，守夜人自己备战（火墙要留够燃料，民兵要留够熟食）
  if (nr.in <= RAID_AUTO && S.rAuto !== false && rw.auto !== nr.k) {
    rw.auto = nr.k;
    const str = raidStrength(S, c, nr), did = [];
    const p0 = raidPrep(S, nr);
    if (!p0 || !(p0.fire || p0.mil || p0.hide)) {
      if (raidDefense(S, c, nr) < str && fuelUnitsOf(c.stock) >= prepCost(S, c, 'fire') * 3 && doPrep(S, 'fire', true).ok) did.push('点起了火墙');
      if (raidDefense(S, c, nr) < str && (c.stock.food || 0) >= prepCost(S, c, 'mil') * 3 && doPrep(S, 'mil', true).ok) did.push('召集了民兵');
      if (raidDefense(S, c, nr) < str && doPrep(S, 'hide', true).ok) did.push('把物资收进了地窖');
      if (did.length) logMsg(S, `没人下令，「${c.name}」的守夜人自己${did.join('、')}。（防御 ${raidDefense(S, c, nr)} 对强度 ${str}）`, 'info');
    }
  }
  if (nr.in <= RAID_WARN && rw.warn !== nr.k) {
    rw.warn = nr.k;
    logMsg(S, `${rn}正在逼近「${c.name}」！（强度 ${raidStrength(S, c, nr)}，防御 ${raidDefense(S, c, nr)}）`, 'warn', { act: 'raidp', label: '看看' });
  }
  if (nr.t >= S.t && nr.t < S.t + dt) {
    S.raidDone = nr.k;
    const camp = getCamp(S, nr.camp), p = raidPrep(S, nr) || {};
    const str = raidStrength(S, camp, nr), def = raidDefense(S, camp, nr);
    const helped = [p.fire && '火墙', p.mil && '民兵'].filter(Boolean);
    S.stats.raids++;
    const name = RAIDERS[tierOfRow(camp.y)];
    (S.stats.raidKinds ||= {})[name] = (S.stats.raidKinds[name] || 0) + 1;
    // 巨像守卫：派了人、歇够了，就把整次袭营挡在外面
    const guard = def < str && S.buildings.find(b => b.camp === camp.id && b.type === 'colossus' && b.workers > 0 && !(b.cd > S.t));
    if (guard) {
      guard.cd = S.t + BLD.colossus.guardCd / (1 + 0.15 * (guard.lvl - 1));
      S.stats.raidsWon++; bumpMood(camp, 6, -3);
      logMsg(S, `🗿 巨像守卫站了起来，${name}（强度 ${str}）一个都没能进「${camp.name}」。守卫要歇 ${Math.round((guard.cd - S.t) / 60)} 分钟。`, 'good');
      R.fx.push({ kind: 'raid', camp: camp.id, won: true, str, def: str, t: S.t, guard: guard.id });
    } else if (def >= str) {
      S.stats.raidsWon++;
      const g = Math.round(str * 2);
      camp.stock.game = Math.min(storeCap(S, camp), (camp.stock.game || 0) + g);
      bumpMood(camp, 4, -2);
      logMsg(S, `${helped.length ? '箭塔和' + helped.join('、') : '箭塔'}击退了${name}（${def} 对 ${str}），收获生肉 ${g}。`, 'good');
      R.fx.push({ kind: 'raid', camp: camp.id, won: true, str, def, t: S.t });
    } else {
      const r = 1 - def / str, loss = 0.3 * r * (p.hide ? 0.5 : 1); // 收拢过物资只丢一半
      for (const k in camp.stock) camp.stock[k] *= (1 - loss);
      let kill = Math.min(Math.max(0, camp.people - MIN_PEOPLE), Math.round(r * 3 + 0.4));
      if (p.hide) kill = Math.floor(kill / 2);
      camp.people -= kill; S.stats.deaths += kill; bumpMood(camp, -8, 6);
      trimWorkers(S, camp);
      logMsg(S, `${name}冲进了「${camp.name}」（防御 ${def} 对 ${str}）：物资被抢走约 ${Math.round(100 * loss)}%${p.hide ? '（收进地窖的保住了）' : ''}${kill ? `，${kill} 人遇难` : ''}。多建几座箭塔，下次提前点火墙、召集民兵。`, 'bad');
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
  } else logMsg(S, `永恒之炉的第 ${E.stage} 层炉膛亮了起来。下一层要永恒炉件稳住 ${ETERNAL_STAGES[E.stage]}/分钟。`, 'story');
}
// 老界面的「投入炉件」按钮：现在炉子自己吃，按钮只告诉你还差多少
export function deliverEternal(S) {
  const c = eternalCamp(S);
  if (!c) return { ok: false, reason: '车队还没到永恒之炉' };
  if (S.eternal.stage >= ETERNAL_STAGES.length) return { ok: false, reason: '已经点燃' };
  const n = ETERNAL_STAGES[S.eternal.stage];
  return { ok: false, reason: `永恒炉件的产量稳住 ${n}/分钟 3 分钟，炉子会自己点亮这一层（现在 ${prodRate(S, 'heart').toFixed(1)}/分钟）` };
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
  logMsg(N, `新的北行开始了。上一程留下的 ${Math.floor(S.meta.embers)} 点余烬还在发烫。`, 'good');
  return N;
}
export function buyEmber(S, key) {
  const lvl = up(S, key);
  if (lvl >= EMBER_UPS[key].max) return { ok: false, reason: '已满级' };
  const c = emberCost(key, lvl);
  if (S.meta.embers < c) return { ok: false, reason: `需要 ${c} 点余烬` };
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
  const camp0 = new Map(S.camps.map(c => [c.id, { ...c.stock }]));
  const sim = Math.min(secs, OFF_CAP), rate = flat != null ? flat : offlineRate(secs);
  const dt = sim > 3 * 3600 ? 30 : sim > 600 ? 10 : 2;
  let left = sim;
  const R = rt(S), t0 = S.t;
  if (rate < 1) R.histOff = { stock: camp0, rate };
  R.offline = true;
  while (left > 0) { const d = Math.min(dt, left); step(S, d); left -= d; }
  R.histOff = null; R.offline = false;
  if (rate < 1) offlineTrim(S, camp0, k => offlineRateOf(S, k, rate));
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
// 按物资种类算全部营地的净增长，只留 rate 那一份；多出来的从涨了的营地里按涨幅扣掉（运输线来回搬的不算增长）
function offlineTrim(S, camp0, rateOf) {
  for (const k of RES_KEYS) {
    const rate = rateOf(k);
    let net = 0, pos = 0;
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
  if (!o || o.v !== VERSION || !o.camps) throw new Error('存档格式不对');
  o.reveal = unrle(o.reveal, W * H);
  fixMeta(o.meta);
  rt(o);
  return o;
}
function rle(arr) { const out = []; let cur = arr[0], n = 0; for (let i = 0; i < arr.length; i++) { if (arr[i] === cur) n++; else { out.push(n); cur = arr[i]; n = 1; } } out.push(n); return (arr[0] ? '1:' : '0:') + out.join(','); }
function unrle(s, N) { const a = new Uint8Array(N); const [h, body] = s.split(':'); let v = +h, p = 0; for (const n of body.split(',').map(Number)) { if (v) a.fill(1, p, p + n); p += n; v = 1 - v; } return a; }

export { W, H, mulberry32 };

// ---------- 随机事件：只在玩家在线时由界面触发；选择的后果写进库存或营地的临时加成 ----------
export function buffOf(S, camp, k) { let v = 0; if (camp.buffs) for (const b of camp.buffs) if (b.k === k && b.until > S.t) v += b.v; return v; }
function addBuff(S, camp, k, v, secs, n) { camp.buffs = (camp.buffs || []).filter(b => b.until > S.t); camp.buffs.push({ k, v, until: S.t + secs, n }); }
const fmtN = x => x >= 100 ? Math.round(x) : Math.round(x * 10) / 10;
const rawOfTier = t => RES_KEYS.filter(k => RES[k].t === t && RES[k].raw && !RES[k].stage);
const EVENTS = [
  { id: 'wander', title: '雪地里的流浪者', w: 3,
    ctx: (S, c, r) => ({ n: 3 + Math.floor(r() * 5) }),
    text: (S, c, x) => `${x.n} 个流浪者在营地外的雪地里徘徊，冻得说不出话。领头的人问，能不能让他们靠近火堆。`,
    opts: [
      { t: '收留他们', d: (S, c, x) => `+${x.n} 人 · 熟食 −${x.n * 15} · 希望 +4${freeBeds(S, c) < x.n ? ' · 床位不够的先在窝棚里等' : ''}`, ok: (S, c, x) => (c.stock.food || 0) >= x.n * 15, go: (S, c, x) => { c.stock.food -= x.n * 15; const a = addPeople(S, c, x.n); bumpMood(c, 4, 0); return `${x.n} 个流浪者留了下来${a.wait ? `，${a.wait} 人先在窝棚里等床位` : ''}。`; } },
      { t: '分些吃的，请他们离开', d: (S, c, x) => `熟食 −${x.n * 6} · 余烬 +3`, ok: (S, c, x) => (c.stock.food || 0) >= x.n * 6, go: (S, c, x) => { c.stock.food -= x.n * 6; S.meta.embers += 3; S.meta.emberTotal += 3; return '他们道了谢，往南边走了。'; } },
      { t: '拒之门外', d: () => '希望 −3', go: (S, c) => { bumpMood(c, -3, 0); return '他们在风雪里慢慢走远了，有人一直望着他们的背影。'; } },
    ] },
  { id: 'cache', title: '冰层下的旧箱子', w: 2, cond: S => S.t > 900,
    ctx: (S, c, r) => ({ lucky: r() < 0.7, t: Math.max(1, Math.min(S.known, tierOfRow(c.y))) }),
    text: () => '干活的人在冰层下挖到一个上了锁的铁皮箱，箱子上刻着看不懂的字。',
    opts: [
      { t: '撬开看看', d: () => '可能有好东西，也可能白忙一场', go: (S, c, x) => {
        if (!x.lucky) { addBuff(S, c, 'prod', -0.1, 180, '有人撬箱子划伤了手'); return '箱子是空的，还有人划伤了手，大家干活慢了一会儿。'; }
        const cap = storeCap(S, c), got = [];
        for (const k of rawOfTier(x.t).slice(0, 2)) { const a = Math.round(cap * 0.08); c.stock[k] = Math.min(cap, (c.stock[k] || 0) + a); got.push(`${RES[k].n} +${a}`); }
        return `箱子里塞满了物资：${got.join('，')}。`; } },
      { t: '交给侦察营研究', d: () => '余烬 +4', go: S => { S.meta.embers += 4; S.meta.emberTotal += 4; return '箱子上的字是一段旧路线，北行的人会记住它。'; } },
    ] },
  { id: 'sick', title: '有人病倒了', w: 2, cond: (S, c) => (rt(S).c[c.id] || {}).tH < 12 && c.people >= 8,
    ctx: () => ({}),
    text: () => '几个人发起了烧，咳嗽声在帐篷里此起彼伏。',
    opts: [
      { t: '用熟食和热汤照顾', d: (S, c) => `熟食 −${Math.ceil(c.people * 0.8)}`, ok: (S, c) => (c.stock.food || 0) >= Math.ceil(c.people * 0.8), go: (S, c) => { c.stock.food -= Math.ceil(c.people * 0.8); return '喝了几天热汤，病人都好起来了。'; } },
      { t: '把熔炉烧旺一点', d: () => '体感 +6°，燃料消耗 +40%（8 分钟）', go: (S, c) => { addBuff(S, c, 'heat', 6, 480, '熔炉烧旺'); addBuff(S, c, 'fuel', 0.4, 480, '熔炉烧旺'); return '营地暖和了不少，病人慢慢退了烧。'; } },
      { t: '让他们接着干活', d: () => '产量 −15%（8 分钟）· 不满 +5', go: (S, c) => { addBuff(S, c, 'prod', -0.15, 480, '带病干活'); bumpMood(c, 0, 5); return '大家硬撑着干活，速度慢了下来。'; } },
    ] },
  { id: 'caravan', title: '路过的雪橇商队', w: 3,
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
    text: (S, c, x) => `一支雪橇商队在营地外停下。他们愿意用 ${x.a2} ${RES[x.k2].n} 换你 ${x.a1} ${RES[x.g].n}。`,
    opts: [
      { t: '成交', d: (S, c, x) => `${RES[x.g].n} −${x.a1} · ${RES[x.k2].n} +${x.a2}`, ok: (S, c, x) => (c.stock[x.g] || 0) >= x.a1, go: (S, c, x) => { c.stock[x.g] -= x.a1; c.stock[x.k2] = Math.min(storeCap(S, c), (c.stock[x.k2] || 0) + x.a2); return '商队清点完货物，拉着雪橇往东去了。'; } },
      { t: '买条消息', d: () => '熟食 −30 · 揭开北边一片迷雾', ok: (S, c) => (c.stock.food || 0) >= 30, go: (S, c) => { c.stock.food -= 30; revealCircle(S, c.x + 6, c.y + 26, 8); return '商队画了张草图：北边有一片之前没人去过的地方。'; } },
      { t: '不换', d: () => '什么也不会发生', go: () => '商队没多停留。' },
    ] },
  { id: 'howl', title: '夜里的狼嚎', w: 2, cond: S => { const n = nextRaid(S); return n && n.in < 1200 && n.in > 120; },
    ctx: S => ({ camp: nextRaid(S).camp }),
    text: () => '这几天夜里，营地外总能听见狼嚎，而且越来越近。',
    opts: [
      { t: '加派守夜人', d: () => '木材 −60 · 防御 +40%（20 分钟）', ok: (S, c) => (c.stock.wood || 0) >= 60, go: (S, c) => { c.stock.wood -= 60; addBuff(S, c, 'def', 0.4, 1200, '守夜人'); return '营地四周多了几堆篝火和守夜的人。'; } },
      { t: '不理会', d: () => '什么也不会发生', go: () => '狼嚎声在天亮前停了。' },
    ] },
  { id: 'furnace', title: '熔炉的异响', w: 2, cond: (S, c) => getB(S, c.furnace).lvl >= 2,
    ctx: () => ({}),
    text: () => '熔炉深处传来一阵阵沉闷的敲击声，炉膛里的火忽明忽暗。',
    opts: [
      { t: '停火检修', d: (S, c) => `${S.known >= 2 ? '铁锭' : '木板'} −40 · 之后 15 分钟熔炉省 25% 燃料`, ok: (S, c) => (c.stock[S.known >= 2 ? 'iron' : 'plank'] || 0) >= 40, go: (S, c) => { c.stock[S.known >= 2 ? 'iron' : 'plank'] -= 40; addBuff(S, c, 'fuel', -0.25, 900, '熔炉检修过'); return '换掉几块裂开的炉砖，熔炉烧得又稳又省。'; } },
      { t: '先不管它', d: () => '之后 10 分钟熔炉多烧 20% 燃料', go: (S, c) => { addBuff(S, c, 'fuel', 0.2, 600, '熔炉漏风'); return '熔炉还在响，烧得比平时快。'; } },
    ] },
  { id: 'feast', title: '长夜篝火会', w: 2, cond: (S, c) => (c.stock.food || 0) >= c.people * 12 && c.people >= 10,
    ctx: () => ({}),
    text: () => '有人提议办一场篝火会：唱歌、烤肉、讲南方的故事。',
    opts: [
      { t: '办一场', d: (S, c) => `熟食 −${Math.ceil(c.people * 3)} · 产量 +12%（10 分钟）· 不满 −5`, ok: (S, c) => (c.stock.food || 0) >= Math.ceil(c.people * 3), go: (S, c) => { c.stock.food -= Math.ceil(c.people * 3); addBuff(S, c, 'prod', 0.12, 600, '篝火会之后干劲十足'); bumpMood(c, 0, -5); return '歌声一直唱到半夜。第二天大家干劲十足。'; } },
      { t: '改天吧', d: () => '希望 −2', go: (S, c) => { bumpMood(c, -2, 0); return '大家有点失望，但还是回去干活了。'; } },
    ] },
  { id: 'child', title: '北方来的孩子', w: 1, cond: S => S.t > 1800,
    ctx: () => ({}),
    text: () => '一个孩子从北方独自走来，手里攥着一张被雪水泡皱的旧地图。',
    opts: [
      { t: '收留她', d: () => '+1 人 · 揭开北边一片迷雾 · 希望 +3', go: (S, c) => { addPeople(S, c, 1); bumpMood(c, 3, 0); revealCircle(S, c.x - 5, c.y + 30, 9); return '她把地图交给了侦察营，上面标着一条北上的路。'; } },
      { t: '问清路，送她去南边', d: () => '揭开北边一片迷雾 · 余烬 +2', go: (S, c) => { revealCircle(S, c.x - 5, c.y + 30, 9); S.meta.embers += 2; S.meta.emberTotal += 2; return '她指了指北边，然后跟着商队往南去了。'; } },
    ] },
  { id: 'storm', title: '暴风雪前夕', w: 4, cond: S => weatherAt(S, S.t).warn,
    ctx: () => ({}),
    text: () => '天边压过来一道灰白的墙。暴风雪就要到了。',
    opts: [
      { t: '加固房屋', d: () => '木材 −80 · 这场暴风雪的降温减半', ok: (S, c) => (c.stock.wood || 0) >= 80, go: (S, c) => { c.stock.wood -= 80; const w = weatherAt(S, S.t); addBuff(S, c, 'shield', 0.5, (w.slot ? w.slot.end - S.t : 1800) + 60, '房屋加固过'); return '所有人一起钉木板、堵缝隙。'; } },
      { t: '烧旺熔炉', d: () => '体感 +8°，燃料消耗 +50%（15 分钟）', go: (S, c) => { addBuff(S, c, 'heat', 8, 900, '熔炉烧旺'); addBuff(S, c, 'fuel', 0.5, 900, '熔炉烧旺'); return '熔炉的火光把半边天都映红了。'; } },
      { t: '照常干活', d: () => '什么也不会发生', go: () => '大家裹紧外套，继续干活。' },
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
  if (sky.aurora > 0.25 && S.aurSeen !== night) { S.aurSeen = night; S.aurOpen = night; R.fx.push({ kind: 'aurora' }); logMsg(S, '🌌 夜空亮起了极光，营地里的人都跑出来看。', 'good', { act: 'aurora', label: '一起看' }); }
  if (S.aurOpen != null && (S.aurOpen !== night || sky.aurora < 0.15)) S.aurOpen = null;
  if (!spawn) return null;
  if (S.surNext == null) S.surNext = Math.max(S.t + 600, 1200);
  if (S.sur || S.t < S.surNext) return null;
  const rnd = mulberry32((Math.floor(S.t) * 17) ^ (S.runSeed * 92821));
  S.surNext = S.t + SUR_GAP[0] + rnd() * (SUR_GAP[1] - SUR_GAP[0]);
  const c = getCamp(S, S.active) || S.camps[0];
  const kind = S.known >= 2 && rnd() < 0.45 ? 'meteor' : 'deer';
  const at = surTile(S, c, rnd); if (!at) return null;
  S.sur = { kind, camp: c.id, x: at.x, y: at.y, t0: S.t, until: S.t + SUR_LIFE[kind], id: S.nextId++ };
  R.fx.push({ kind: 'sur', sur: S.sur });
  return S.sur;
}
export function surReward(S, sur) {
  const t = Math.min(S.known, 7);
  if (sur.kind === 'deer') return { res: { food: 30 + 10 * t }, hope: 3 }; // 驯鹿背上的褡裢里有别的营地丢下的干粮
  const k = t >= 6 ? 'star' : t >= 5 ? 'crystal' : t >= 3 ? 'steel' : 'iron';
  return { res: { [k]: { star: 25, crystal: 60, steel: 50, iron: 60 }[k] }, embers: 1 + Math.floor(t / 2) };
}
export function claimSurprise(S) {
  const sur = S.sur; if (!sur) return { ok: false, reason: '已经不见了' };
  const c = getCamp(S, sur.camp) || S.camps[0], rw = surReward(S, sur);
  for (const k in rw.res) c.stock[k] = (c.stock[k] || 0) + rw.res[k];
  if (rw.embers) S.meta.embers = (S.meta.embers || 0) + rw.embers;
  if (rw.hope) c.hope = Math.min(100, (c.hope ?? 50) + rw.hope);
  S.sur = null;
  S.stats.sur = (S.stats.sur || 0) + 1;
  (S.stats.surKinds ||= {})[sur.kind] = (S.stats.surKinds[sur.kind] || 0) + 1;
  rt(S).fx.push({ kind: 'surdone', sur, camp: c.id });
  const got = Object.keys(rw.res).map(k => `${RES[k].n} +${rw.res[k]}`).concat(rw.embers ? [`余烬 +${rw.embers}`] : [], rw.hope ? [`希望 +${rw.hope}`] : []).join('，');
  logMsg(S, sur.kind === 'deer' ? `🦌 走失的驯鹿跟着大家回了「${c.name}」，褡裢里还有干粮：${got}。` : `☄ 大家从流星坑里挖出了好东西：${got}。`, 'good');
  return { ok: true, rw };
}
export function watchAurora(S) {
  if (S.aurOpen == null) return { ok: false, reason: '极光已经散了' };
  S.aurOpen = null;
  for (const c of S.camps) c.hope = Math.min(100, (c.hope ?? 50) + 4);
  S.meta.embers = (S.meta.embers || 0) + 1;
  S.stats.aurora = (S.stats.aurora || 0) + 1;
  logMsg(S, '🌌 大家放下手里的活，一起看了一会儿极光：所有营地希望 +4，余烬 +1。', 'good');
  return { ok: true };
}

// ---------- 篝火庆典：玩家自己张罗的一场庆典。办的时候大家放下活去跳舞（产量减半），散场后人心大振、干劲十足 ----------
export const FEST_LEN = 90, FEST_CD = 1440, FEST_MIN = 20, FEST_AFTER = 720;
export function festCost(S, c) { return { food: Math.ceil(c.people * 2), wood: 40 + Math.ceil(c.people / 2) }; }
export function festLeft(S, c) { return c.festAt == null ? 0 : Math.max(0, c.festAt + FEST_CD - S.t); }
export function festBlock(S, c) {
  if (c.fest) return '庆典正在进行';
  if (c.people < FEST_MIN) return `营地要有 ${FEST_MIN} 个人才热闹得起来`;
  if (weatherAt(S, S.t).blizzard) return '暴风雪里办不了庆典';
  const left = festLeft(S, c); if (left > 0) return `上一场刚办完，${Math.ceil(left / 60)} 分钟后才能再办`;
  const cost = festCost(S, c), miss = Object.keys(cost).filter(k => (c.stock[k] || 0) < cost[k]);
  if (miss.length) return '缺' + miss.map(k => RES[k].n).join('、');
  if ((c.stock.food || 0) - cost.food < c.people * EAT * 30) return '办完庆典，口粮就不够大家吃半小时了';
  return null;
}
export function startFest(S, cid) {
  const c = getCamp(S, cid); if (!c) return { ok: false, reason: '没有这个营地' };
  const why = festBlock(S, c); if (why) return { ok: false, reason: why };
  const cost = festCost(S, c);
  for (const k in cost) c.stock[k] -= cost[k];
  c.fest = { t0: S.t, until: S.t + FEST_LEN };
  c.festAt = S.t;
  addBuff(S, c, 'prod', -0.5, FEST_LEN, '篝火庆典（大家都去跳舞了）');
  rt(S).fx.push({ kind: 'fest', camp: c.id });
  logMsg(S, `「${c.name}」的篝火庆典开始了！大家放下手里的活，围着篝火跳起舞来。`, 'good');
  return { ok: true };
}
function endFest(S, c) {
  c.fest = null;
  bumpMood(c, 15, -10);
  addBuff(S, c, 'prod', 0.15, FEST_AFTER, '庆典余温');
  S.stats.fests = (S.stats.fests || 0) + 1;
  rt(S).fx.push({ kind: 'festdone', camp: c.id });
  logMsg(S, `「${c.name}」的庆典散场了：希望 +15，不满 −10，之后 ${FEST_AFTER / 60} 分钟产量 +15%。`, 'good');
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
    logMsg(S, `没来得及帮上忙：${reqTitle(S, r)}。`, 'warn');
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
  if (r.kind === 'build') return r.n > 1 ? `再建一座${BLD[r.type].n}` : `建一座${BLD[r.type].n}`;
  if (r.kind === 'upgrade') return `把${BLD[r.type].n}升到 ${r.lvl} 级`;
  if (r.kind === 'stock') return `攒够 ${r.n} ${RES[r.k].n}交给大家`;
  return `腾出 ${r.n} 张空床，没人睡窝棚`;
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
  const r = (S.reqs || []).find(x => x.id === id); if (!r) return { ok: false, reason: '委托不在了' };
  const p = reqProgress(S, r); if (!p.done) return { ok: false, reason: '还没做到' };
  const c = getCamp(S, r.camp);
  if (r.kind === 'stock') c.stock[r.k] = Math.max(0, (c.stock[r.k] || 0) - r.n);
  const rw = r.rw || {};
  for (const k in rw.res || {}) c.stock[k] = (c.stock[k] || 0) + rw.res[k];
  if (rw.embers) S.meta.embers = (S.meta.embers || 0) + rw.embers;
  if (rw.hope) c.hope = Math.min(100, (c.hope ?? 50) + rw.hope);
  if (rw.disc) c.disc = Math.max(0, (c.disc ?? 10) + rw.disc);
  S.reqs = S.reqs.filter(x => x !== r);
  S.stats.reqs = (S.stats.reqs || 0) + 1;
  logMsg(S, `委托完成：${reqTitle(S, r)}。`, 'good');
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
  const d = BLD[b.type], ctr = x => { const s = BLD[x.type].size; return [x.x + s / 2, x.y + s / 2]; }, [bx, by] = ctr(b);
  const ins = Object.keys(d.in || {}), outs = Object.keys(d.out || {});
  if (b.type === 'furnace') ins.push(...Object.keys(FUEL));
  if (b.type === 'heater') ins.push('coal');
  const takes = (x, r) => x.id !== b.id && ((BLD[x.type].in && BLD[x.type].in[r]) || (x.type === 'furnace' && FUEL[r]) || (x.type === 'heater' && r === 'coal'));
  const pick = (r, ok) => S.buildings.filter(x => x.camp === b.camp && x.id !== b.id && ok(x)).map(x => { const [x0, y0] = ctr(x); return { b: x, res: r, d: Math.hypot(x0 - bx, y0 - by) }; }).sort((p, q) => p.d - q.d);
  const up = [], down = [], missing = [];
  for (const r of ins) {
    const l = pick(r, x => BLD[x.type].out && BLD[x.type].out[r]);
    if (!l.length && b.type !== 'furnace') missing.push(r);
    up.push(...l.slice(0, b.type === 'furnace' ? 4 : 6));
  }
  if (b.type === 'furnace' && !up.length) missing.push('wood');
  for (const r of outs) down.push(...pick(r, x => takes(x, r)).slice(0, 6));
  return { up, down, ins, outs, missing };
}

// ---------- 收集册：建筑、物资、地标、人物、风物，外加成就。记在 meta.book 里，北迁后也保留 ----------
export const SIGHTS = [
  { id: 'aurora', n: '极光夜', ic: '🌌', d: '北方夜空里流动的光。极光出来时，营地里的人都会跑出来抬头看。', how: '在线时等一个极光夜' },
  { id: 'icefog', n: '冰雾早晨', ic: '🌫', d: '天亮前后升起的冰雾，空气里闪着细小的冰晶，远处看不太清。', how: '某些早晨会起冰雾' },
  { id: 'blizzard', n: '暴风雪', ic: '❄', d: '气温骤降几十度的寒潮。熔炉超载、燃料和熟食备足才撑得过去。', how: '挺过一场暴风雪' },
  { id: 'wx:ice', n: '冰风暴', ic: '🧊', d: '冻雨落地就结冰，树枝、帐篷、管道全裹上一层亮晶晶的冰壳。', how: '经历一场冰风暴' },
  { id: 'wx:cold', n: '极寒夜', ic: '🌡', d: '连呼出的气都会冻成冰碴的一夜。熔炉要烧到天亮，谁都不敢睡死。', how: '熬过一个极寒夜' },
  { id: 'wx:crack', n: '冰湖开裂', ic: '💧', d: '冰面下传来闷雷似的响声，一道道黑水沟把湖面切开，几天后才重新冻上。', how: '遇上一次冰湖开裂' },
  { id: 'gang', n: '掠夺者营地', ic: '🏴', d: '栅栏围着几顶黑帐篷，营地上插着黑旗。他们不种地也不打猎，靠别人的营地过冬。', how: '侦察到一处掠夺者营地' },
  { id: 'herd', n: '驯鹿群', ic: '🦌', d: '在雪原上低头吃草的鹿群，人一走近就跑开。猎人小屋靠它们过冬。', how: '建一座猎人小屋' },
  { id: 'lostdeer', n: '走失的驯鹿', ic: '🦌', d: '从别的营地走散的驯鹿，脖子上系着红布和铃铛，背上的褡裢里还有干粮。', how: '在线时偶尔会出现在营地边上' },
  { id: 'meteor', n: '流星坑', ic: '☄', d: '落在营地附近的流星砸出的浅坑，碎石还在发烫，坑底埋着金属和稀有矿物。', how: '在线时偶尔会有流星落下' },
  { id: 'caravan', n: '雪橇商队', ic: '🛷', d: '在营地之间来回的商队，拉着雪橇扎营几天，用稀罕货换你多余的物资。', how: '商队会不时路过' },
  { id: 'fest', n: '篝火庆典', ic: '🔥', d: '围着篝火跳舞、拉琴、敲鼓。散场以后，大家好几天都还在说这件事。', how: '在熔炉面板里办一场庆典' },
  { id: 'vein', n: '新矿脉', ic: '⛏', d: '勘探队在供热圈里找到的矿脉。矿挖空了，就派人再找。', how: '派勘探队找一次矿' },
  { id: 'raid:雪狼群', n: '雪狼群', ic: '🐺', d: '饿极了的狼群，暴风雪前后最常摸到营地边上。', how: '在南方的营地守一次夜' },
  { id: 'raid:掠夺者', n: '掠夺者', ic: '🐺', d: '在冰原上游荡的人，靠抢别的营地过冬。', how: '在铁岭以北守一次夜' },
  { id: 'raid:霜兽', n: '霜兽', ic: '🐺', d: '霜晶废墟一带出没的怪兽，皮毛上结着冰晶。', how: '在霜晶废墟一带守一次夜' },
  { id: 'raid:遗迹守卫', n: '遗迹守卫', ic: '🐺', d: '残骸里醒过来的旧时代自动机，还在执行早就没有意义的命令。', how: '在星铁残骸以北守一次夜' },
];
const nBuilt = (S, f) => S.buildings.filter(f).length;
const maxFurnace = S => Math.max(0, ...S.camps.map(c => (getB(S, c.furnace) || {}).lvl || 0));
const maxPeople = S => Math.max(0, ...S.camps.map(c => c.people));
const yes = v => (v ? 1 : 0);
// 每个成就：cur(S, B) 现在到多少，need 要多少（是/否的条件 need 为 1）
export const ACH = [
  { id: 'first', n: '第一缕火', d: '建起第一栋建筑', rw: 1, need: 1, cur: S => yes(nBuilt(S, b => b.type !== 'furnace')) },
  { id: 'town', n: '小镇初成', d: '一座营地住下 50 人', rw: 1, need: 50, cur: maxPeople },
  { id: 'city', n: '人丁兴旺', d: '一座营地住下 150 人', rw: 2, need: 150, cur: maxPeople },
  { id: 'busy', n: '百业兴旺', d: '一程里同时有 40 栋建筑', rw: 2, need: 40, cur: S => S.buildings.length },
  { id: 'fire10', n: '熊熊炉火', d: '熔炉升到 10 级', rw: 2, need: 10, cur: maxFurnace },
  { id: 'fire20', n: '炉火冲天', d: '熔炉升到 20 级', rw: 3, need: 20, cur: maxFurnace },
  { id: 'camp2', n: '第二个家', d: '点起第一座前哨熔炉', rw: 2, need: 2, cur: S => S.camps.length },
  { id: 'camp4', n: '星火连营', d: '一程里同时有 4 座营地', rw: 3, need: 4, cur: S => S.camps.length },
  { id: 'north3', n: '北行者', d: '在黑油冻原点起营火', rw: 2, need: 1, cur: S => yes(S.founded.some(i => i >= 3)) },
  { id: 'north5', n: '星铁之下', d: '在星铁残骸点起营火', rw: 3, need: 1, cur: S => yes(S.founded.some(i => i >= 5)) },
  { id: 'eternal', n: '永恒之炉', d: '重新点燃永恒之炉', rw: 5, need: 1, cur: S => yes(S.meta.graduated) },
  { id: 'far1', n: '看见远方', d: '找到永恒之炉以北的一处远方地标', rw: 2, need: 1, cur: S => yes(((S.far || {}).seen || []).length) },
  { id: 'gang', n: '赶走掠夺者', d: '打退同一伙掠夺者两次，让他们散伙', rw: 3, need: 1, cur: S => S.stats.gangs || 0 },
  { id: 'wx3', n: '天有不测', d: '一程里遇上冰风暴、极寒夜和冰湖开裂', rw: 2, need: 3, cur: S => WXE_KEYS.filter(k => S.stats.wxe && S.stats.wxe[k]).length },
  { id: 'bliz5', n: '风雪不倒', d: '一程里挺过 5 场暴风雪', rw: 2, need: 5, cur: S => S.stats.blizzards },
  { id: 'nodeath', n: '一个都不能少', d: '一程走过 3 小时，没有一个人遇难', rw: 3, need: 180, cur: S => S.stats.deaths ? 0 : Math.floor(S.t / 60) },
  { id: 'guard3', n: '守夜人', d: '一程里击退 3 次袭营', rw: 2, need: 3, cur: S => S.stats.raidsWon },
  { id: 'req5', n: '好邻居', d: '一程里完成 5 个委托', rw: 2, need: 5, cur: S => S.stats.reqs || 0 },
  { id: 'req20', n: '有求必应', d: '一程里完成 20 个委托', rw: 3, need: 20, cur: S => S.stats.reqs || 0 },
  { id: 'trade10', n: '老主顾', d: '一程里给商队交 10 张订单', rw: 2, need: 10, cur: S => S.stats.carOrders || 0 },
  { id: 'aur3', n: '守望极光', d: '一程里和大家一起看 3 次极光', rw: 2, need: 3, cur: S => S.stats.aurora || 0 },
  { id: 'met3', n: '追星人', d: '一程里挖开 3 个流星坑', rw: 2, need: 3, cur: S => (S.stats.surKinds || {}).meteor || 0 },
  { id: 'photo', n: '定格此刻', d: '在拍照模式里拍下一张营地的照片', rw: 1, need: 1, cur: S => S.meta.photos || 0 },
  { id: 'dogs12', n: '狗拉雪橇', d: '一座营地养着 12 只喂饱的雪橇犬', rw: 2, need: 12, cur: S => Math.floor(Math.max(0, ...S.camps.map(c => dogsOf(S, c.id)))) },
  { id: 'fest3', n: '夜夜笙歌', d: '一程里办 3 场篝火庆典', rw: 2, need: 3, cur: S => S.stats.fests || 0 },
  { id: 'deep', n: '往下挖', d: '挖一口深井', rw: 1, need: 1, cur: S => yes(S.buildings.some(b => b.deep)) },
  { id: 'vein3', n: '勘探家', d: '一程里找到 3 处新矿脉', rw: 2, need: 3, cur: S => (S.veins || []).length },
  { id: 'belt5', n: '流水线', d: '一程里铺好 5 条传送带', rw: 2, need: 5, cur: S => (S.belts || []).length },
  { id: 'rail', n: '蒸汽时代', d: '把一条传送带升级成蒸汽轨道', rw: 2, need: 1, cur: S => yes((S.belts || []).some(b => b.lvl >= 2)) },
  { id: 'spec5', n: '群贤毕至', d: '身边聚齐 5 位专家', rw: 2, need: 5, cur: S => Object.keys(S.meta.specs || {}).length },
  { id: 'allres', n: '万物皆备', d: '物资一栏全部收集', rw: 3, need: RES_KEYS.length, cur: (S, B) => RES_KEYS.filter(k => B.r[k]).length },
  { id: 'allbld', n: '营造大师', d: '建筑一栏全部收集', rw: 5, need: Object.keys(BLD).length, cur: (S, B) => Object.keys(BLD).filter(k => B.b[k]).length },
  { id: 'allsight', n: '见多识广', d: '风物一栏全部收集', rw: 3, need: SIGHTS.length, cur: (S, B) => SIGHTS.filter(x => B.s[x.id]).length },
];
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
