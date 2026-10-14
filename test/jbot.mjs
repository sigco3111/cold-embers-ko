// 模拟玩家（第十二版：一路往北）：按老向导和规划器的思路玩，看每一程的节奏和数值规模
// node test/jbot.mjs [天数] [几秒想一次] [-v]
import * as G from '../src/sim.js';
import { BLD, RES, SPOT_KEYS, EMBER_UPS, SPECS, FUEL, TECHS, CHAPTERS, furnaceRadius, furnaceBurn } from '../src/data.js';
import { getWorld, W, H, idx } from '../src/worldgen.js';

{ let a = +(process.env.RSEED || 12345) >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DAYS = +(process.argv[2] || 30);
const THINK = +(process.argv[3] || 120);
const VERBOSE = process.argv.includes('-v');
const OFFLINE = +(process.env.OFFLINE || 0); // 每天离线几小时（模拟玩家下线）
const CHAIN = {
  1: ['lumber', 'hunter', 'kitchen', 'quarry', 'sawmill'],
  2: ['coalmine', 'ironmine', 'smelter', 'coker'],
  3: ['limequarry', 'steelworks', 'gearworks', 'engineworks', 'greenhouse'],
  4: ['shalepit', 'refinery', 'sealworks'],
  5: ['crystalmine', 'batteryworks', 'alloyworks'],
  6: ['salvage', 'partworks', 'coreworks', 'bay'],
  7: ['excavator', 'forge'],
};
let S = G.newRun(G.defaultMeta(), 0, +(process.env.SEED || 777));
if (process.env.NOGANG) { S.gangs = {}; for (const g of G.gangsOf(S)) S.gangs[g.id] = { seen: 1, gone: 1, next: 9e12, rel: 0, wins: 2, n: 0 }; }
const day = () => (S.t / 86400).toFixed(2) + 'd';
const log = (...a) => { if (VERBOSE) console.log(day(), ...a); };

function bestSpot(camp, type) {
  const d = BLD[type], f = G.getB(S, camp.furnace);
  const r = G.heatRadius(S, camp) + 1;
  let best = null, bs = -1e9;
  for (let y = Math.floor(camp.y - r); y <= camp.y + r; y++) for (let x = Math.floor(camp.x - r); x <= camp.x + r; x++) {
    const ck = G.checkPlace(S, type, x, y);
    if (!ck.ok || ck.camp !== camp.id) continue;
    let sc = -ck.dist * 2 + ck.syn * 3;
    if (d.gather) { if (!ck.spots) continue; sc += ck.spots * 4; }
    if (type === 'tower') sc = Math.hypot(x - camp.x, y - camp.y) - Math.abs(Math.hypot(x - camp.x, y - camp.y) - 5);
    if (sc > bs) { bs = sc; best = [x, y]; }
  }
  void f;
  return best;
}
function tryBuild(camp, type) {
  if (!G.unlocked(S, type)) return false;
  S.active = camp.id;
  const p = bestSpot(camp, type);
  if (!p) return false;
  const r = G.place(S, type, p[0], p[1]);
  if (r.ok) log('build', type, camp.name);
  return r.ok;
}
const count = (camp, type) => G.countType(S, camp.id, type);
// 供热圈里没地方了：拆掉多余的（箭塔、多出来的厨房猎屋采石场）给主线腾地方
const SPARE = { tower: 3, kitchen: 2, hunter: 3, quarry: 1, lumber: 3, warehouse: 2, flagpole: 0, lamp: 0, statue: 0, flowerhouse: 0 };
function makeRoom(camp) {
  for (const t in SPARE) {
    const bs = G.campBuildings(S, camp.id).filter(b => b.type === t).sort((a, b) => a.lvl - b.lvl);
    if (bs.length > SPARE[t]) { G.demolish(S, bs[0].id); STAT.demolish = (STAT.demolish || 0) + 1; log('demolish', t); return true; }
  }
  return false;
}
// 采集建筑没地方放（矿点旁边都被房子压住了）：拆掉挡路最少的几座，腾出一个能挖到矿的位置
function clearForSpot(camp, type) {
  const d = BLD[type]; if (!d.gather) return false;
  const w = getWorld(S.runSeed), kinds = d.gather.map(k => SPOT_KEYS.indexOf(k)), r = G.heatRadius(S, camp), sz = d.size;
  let best = null;
  for (let y = Math.floor(camp.y - r); y <= camp.y + r; y++) for (let x = Math.floor(camp.x - r); x <= camp.x + r; x++) {
    if (Math.hypot(x + sz / 2 - camp.x, y + sz / 2 - camp.y) > r - 1) continue;
    const ids = new Set(); let bad = false;
    for (let yy = y; yy < y + sz && !bad; yy++) for (let xx = x; xx < x + sz; xx++) { const o = G.occAt(S, xx, yy); if (o < 0 || (w.spot[idx(xx, yy)] >= 0)) { bad = true; break; } if (o > 0) { const b = S.buildings.find(q => q.id === o); if (!b || b.type === 'furnace' || b.type === type || b.camp !== camp.id) { bad = true; break; } ids.add(o); } }
    if (bad || !ids.size) continue;
    let sp = 0; const cx = x + sz / 2, cy = y + sz / 2, rr = d.reach + sz / 2;
    for (let yy = Math.floor(cy - rr); yy <= cy + rr; yy++) for (let xx = Math.floor(cx - rr); xx <= cx + rr; xx++) { const i = idx(xx, yy); if (kinds.includes(w.spot[i]) && !G.occAt(S, xx, yy) && G.spotLeft(S, i) > 0 && Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) <= rr) sp++; }
    if (!sp) continue;
    const cost = [...ids].reduce((a, id) => a + 1 + (S.buildings.find(q => q.id === id).lvl || 1) * 0.1, 0) - sp * 0.3;
    if (!best || cost < best.cost) best = { x, y, ids: [...ids], cost, sp };
  }
  if (!best) return false;
  for (const id of best.ids) { G.demolish(S, id); STAT.clear = (STAT.clear || 0) + 1; }
  const ok = G.place(S, type, best.x, best.y).ok;
  log('clearForSpot', type, best.ids.length, 'removed', ok ? 'placed' : 'FAILED');
  if (ok) STAT.clearOk = (STAT.clearOk || 0) + 1;
  return ok;
}
function rates(camp) {
  const R = G.rt(S), out = {}, inn = {};
  for (const b of G.campBuildings(S, camp.id)) {
    const br = R.b[b.id]; if (!br || !br.rate) continue;
    for (const k in br.rate) out[k] = (out[k] || 0) + br.rate[k];
    for (const k in br.inRate) inn[k] = (inn[k] || 0) + br.inRate[k];
  }
  return { out, inn };
}
// 派人：吃的 → 主线这条链 → 搬运 → 燃料 → 防御 → 其他；人口有上限，得挑着派
function fillWorkers(camp) {
  const R = G.rt(S), cr = R.c[camp.id] || {}, bs = G.campBuildings(S, camp.id).filter(b => G.bMax(S, b) > 0);
  const line = new Set();
  for (const [r, n] of needs(camp)) for (const x of G.planLine(S, r, n).nodes) if (x.type) line.add(x.type);
  const nr = G.nextRaid(S), raid = nr && nr.camp === camp.id && nr.in < 900;
  const pri = b => {
    const t = b.type, cat = BLD[t].cat;
    if (t === 'hunter' || t === 'kitchen' || t === 'greenhouse') return (cr.foodNet || 0) < 1 || (camp.stock.food || 0) < camp.people * 30 ? 0 : 5;
    if (FOCUS[camp.id] === t) return 0.5;
    if (line.has(t)) return 1;
    if (t === 'warehouse') return (cr.hf || 1) < 0.95 ? 2 : 6;
    if (t === 'lumber' || t === 'coalmine') return (cr.fuelUnits || 0) < (cr.burnPerMin || 1) * 90 ? 2 : 4;
    if (t === 'tower') return raid ? 0 : 9;
    if (t === 'workshop' || t === 'scout') return 3;
    if (t === 'sledshed') return b.vq && b.vq.length ? 1 : 99;
    return cat === 'gather' || cat === 'make' ? 4 : 7;
  };
  bs.sort((a, b) => pri(a) - pri(b) || a.id - b.id);
  for (const b of bs) if (b.workers) G.setWorkers(S, b.id, 0);
  const cap = CAP[camp.id] || {}, used = {};
  for (const b of bs) {
    const free = G.idleLabor(S, camp); if (free <= 0) break; if (pri(b) >= 99) continue;
    let n = Math.min(G.bMax(S, b), free); const c = cap[b.type];
    if (c && S.t - c.t < 1800) n = Math.max(0, Math.min(n, c.n - (used[b.type] || 0)));
    used[b.type] = (used[b.type] || 0) + n; G.setWorkers(S, b.id, n);
  }
}
// 老向导说「被别的建筑吃掉了」「从那边撤几个人」时，给那种建筑定个人数上限（半小时内有效），把人让给最卡的一环
const CAP = {}, FOCUS = {};
const workersOf = (camp, t) => G.campBuildings(S, camp.id).filter(b => b.type === t).reduce((a, b) => a + b.workers, 0);
function shed(camp, t) {
  const cur = workersOf(camp, t), n = cur - (BLD[t].w || 2); if (n < 0 || cur <= 0) return false;
  (CAP[camp.id] ||= {})[t] = { n, t: S.t }; STAT.shed = (STAT.shed || 0) + 1;
  let cut = cur - n; for (const b of G.campBuildings(S, camp.id).filter(b => b.type === t && b.workers > 0)) { const d = Math.min(cut, b.workers); G.setWorkers(S, b.id, b.workers - d); cut -= d; if (cut <= 0) break; }
  return true;
}
function upgradeLowest(camp, type, cap) {
  const bs = G.campBuildings(S, camp.id).filter(b => b.type === type && b.lvl < cap).sort((a, b) => a.lvl - b.lvl);
  return bs[0] ? G.upgrade(S, bs[0].id).ok : false;
}
const STAT = { builds: 0, ups: 0, lineBuild: 0, lineUp: 0 };
// 眼下要做的东西：主线 + 熔炉升级缺的料（铁锭、蒸汽机……），各要每分钟几个
function needs(camp) {
  const out = [];
  if (G.isMain(S, camp)) for (const g of G.rateGoals(S)) out.push([g.r, g.n * 1.25]);
  const fb = G.getB(S, camp.furnace), c = G.upgradeCost(S, fb);
  for (const k in c) if (RES[k].t > 1 && RES[k].t <= S.known && (camp.stock[k] || 0) < c[k] && !out.some(o => o[0] === k)) out.push([k, 3]);
  return out;
}

function campThink(camp, main) {
  const R = G.rt(S), cr = R.c[camp.id]; if (!cr) return;
  S.active = camp.id;
  const st = camp.stock, { out, inn } = rates(camp), fb = G.getB(S, camp.furnace);
  // 住房：人口上限以内
  if (cr.housing - camp.people < 2 && G.bedsOf(S, camp) < G.popCap(S, camp) + 4 && (cr.foodNet > 0.5 || camp.people < 40)) {
    if (count(camp, 'tent') >= 5 ? !upgradeLowest(camp, 'tent', fb.lvl) : !tryBuild(camp, 'tent')) upgradeLowest(camp, 'tent', fb.lvl);
  }
  // 吃的
  const foodNet = (out.food || 0) - cr.eatPerMin;
  if (foodNet < 0.5 || (st.food || 0) < camp.people * 20) {
    if (S.known >= 3 && count(camp, 'greenhouse') < 6) tryBuild(camp, 'greenhouse');
    if ((out.game || 0) < (inn.game || 0) + 2 && (count(camp, 'hunter') >= 3 || !tryBuild(camp, 'hunter'))) upgradeLowest(camp, 'hunter', fb.lvl);
    if (count(camp, 'kitchen') === 0 || (st.game || 0) > 150) { if (count(camp, 'kitchen') >= 3 || !tryBuild(camp, 'kitchen')) upgradeLowest(camp, 'kitchen', fb.lvl); }
  }
  if ((st.stone || 0) < 300 && count(camp, 'quarry') < 3) tryBuild(camp, 'quarry');
  // 燃料
  if (cr.fuelUnits < cr.burnPerMin * 60) {
    if (S.known >= 2 && count(camp, 'coalmine') < 4) tryBuild(camp, 'coalmine');
    if (count(camp, 'lumber') < 5) tryBuild(camp, 'lumber'); else upgradeLowest(camp, 'lumber', fb.lvl);
  }
  if (cr.hf < 0.85) { if (count(camp, 'warehouse') >= 3 || !tryBuild(camp, 'warehouse')) upgradeLowest(camp, 'warehouse', fb.lvl); }
  // 防御
  const nr = G.nextRaid(S);
  if (nr && nr.camp === camp.id && nr.in < 3600) {
    const str = G.raidStrength(S, camp, nr), def = G.campDefense(S, camp);
    if (def < str * 1.15) { if (count(camp, 'tower') < 3) tryBuild(camp, 'tower'); else upgradeLowest(camp, 'tower', fb.lvl + 2); }
  }
  if (camp !== main) { fillWorkers(camp); return; }
  // 产业链：每样至少一座
  for (let t = 1; t <= S.known; t++) for (const type of CHAIN[t]) {
    if (type === 'coker' && (st.coal || 0) < 400) continue;
    if (count(camp, type) === 0) tryBuild(camp, type);
  }
  if (S.known >= 1 && count(camp, 'scout') === 0) tryBuild(camp, 'scout');
  if (count(camp, 'workshop') === 0 && S.known >= 1) tryBuild(camp, 'workshop');
  // 熔炉先升到这一程要的等级
  const need = G.gateFlvl(G.journeyOf(S).stage);
  if (fb.lvl < need + 2) G.upgrade(S, fb.id);
  // 主线：按规划器找最卡的一环，先加建，没地方就升级
  for (const [gr, gn] of needs(camp)) {
    const P = null;
    for (let i = 0; i < 2; i++) {
      const pl = G.planLine(S, gr, gn), w = pl.worst || pl.nodes.find(x => x.type && !x.count); if (!w || !w.type) break;
      FOCUS[camp.id] = w.comp ? (pl.nodes.find(x => x.k === w.from) || {}).type : w.type;
      if (w.comp) {
        // 总产量够，被别的建筑吃掉了：给吃得最多的那种建筑减人
        const eat = {}, R2 = G.rt(S), from = (pl.nodes.find(x => x.k === w.from) || {}).type;
        for (const b of G.campBuildings(S, camp.id)) { const ir = ((R2.b[b.id] || {}).inRate || {})[w.k]; if (ir > 0 && b.type !== from) eat[b.type] = (eat[b.type] || 0) + ir; }
        const top = Object.keys(eat).sort((a, b) => eat[b] - eat[a])[0];
        if (top && shed(camp, top)) fillWorkers(camp);
        break;
      }
      if (G.idleLabor(S, camp) < (BLD[w.type].w || 0)) {
        const over = pl.nodes.filter(x => x.type && x.workers > 0 && x.ratio > 1.8 && x.k !== gr).sort((a, b) => b.ratio - a.ratio)[0];
        if (over) shed(camp, over.type);
      }
      if (G.idleLabor(S, camp) >= (BLD[w.type].w || 0) && tryBuild(camp, w.type)) { STAT.lineBuild++; fillWorkers(camp); continue; }
      if (BLD[w.type].gather && !bestSpot(camp, w.type) && G.idleLabor(S, camp) >= (BLD[w.type].w || 0) && S.t - (camp.clearT || -1e9) > 600) { camp.clearT = S.t; if (clearForSpot(camp, w.type)) { fillWorkers(camp); continue; } }
      if (upgradeLowest(camp, w.type, fb.lvl)) { STAT.lineUp++; continue; }
      if (!bestSpot(camp, w.type) && !camp.roomT && makeRoom(camp)) { camp.roomT = 1; continue; }
      break;
    }
    void P;
  }
  fillWorkers(camp);
  // 矿快采完：深井、勘探
  for (const b of G.campBuildings(S, camp.id)) if (G.deepable(b.type) && !b.deep && !G.deepBlock(S, b)) G.digDeep(S, b.id);
  if ((camp.surveys || 0) < 4 && G.campBuildings(S, camp.id).some(b => G.deepable(b.type) && G.gatherLeftFrac(S, b) < 0.3) && !G.surveyBlock(S, camp)) G.startSurvey(S, camp.id);
  // 生产建筑轮流升级（不超过熔炉等级）
  const want = new Set(); for (const [r, n] of needs(camp)) for (const x of G.planLine(S, r, n).nodes) if (x.type) want.add(x.type);
  const bs = G.campBuildings(S, camp.id).filter(b => want.has(b.type) || b.type === 'warehouse' || b.type === 'hunter' || b.type === 'kitchen' || b.type === 'greenhouse').sort((a, b) => a.lvl - b.lvl);
  for (const b of bs.slice(0, 3)) if (b.lvl < fb.lvl) { if (G.upgrade(S, b.id).ok) STAT.ups++; }
  // 缺原料就加建上游
  for (const b of G.campBuildings(S, camp.id)) {
    const br = R.b[b.id]; if (!br || !br.status) continue;
    if (br.status.startsWith('缺')) {
      const k = Object.keys(RES).find(k => br.status === '缺' + RES[k].n);
      const t = Object.keys(BLD).find(t => BLD[t].out && BLD[t].out[k] && G.unlocked(S, t));
      if (t && want.has(t) && count(camp, t) < 8 && G.idleLabor(S, camp) >= (BLD[t].w || 0)) tryBuild(camp, t);
    }
    if (br.status === '附近资源点已采空') { G.demolish(S, b.id); tryBuild(camp, b.type); }
  }
  if (cr.tH < 0 && S.known >= 3 && count(camp, 'heater') < 3) tryBuild(camp, 'heater');
}

// 车队：主营地造一座雪橇棚，按还差的地方排车（排着的车也算上）
function buildSleds(plan) {
  const main = G.mainCamp(S), V = G.VEH, sheds = S.buildings.filter(b => b.type === 'sledshed');
  // 哪个营地的雪橇棚都能造车：挑一座那边料够的，主营地优先
  const shed = sheds.sort((a, b) => (b.camp === main.id) - (a.camp === main.id)).find(b => !G.vehBlock(S, b, 'sled') || !G.vehBlock(S, b, 'tractor')) || sheds[0];
  if (!shed) { if (!tryBuild(main, 'sledshed')) { makeRoom(main); tryBuild(main, 'sledshed'); } return; }
  const P = G.tripPlan(S); if (P.roomOk) return;
  let lack = P.lack - sheds.reduce((s, b) => s + (b.vq || []).reduce((t, q) => t + V[q.v].cap, 0), 0), n = 0;
  while (lack > 0 && n < 10) {
    const v = !G.vehBlock(S, shed, 'tractor') ? 'tractor' : 'sled';
    if (!G.orderVeh(S, shed.id, v, 1).ok) break;
    lack -= V[v].cap; n++;
  }
  if (n) log('vehicles ordered +' + n, JSON.stringify(G.journeyOf(S).fleet), 'queue', shed.vq.length);
  void plan;
}

function scoutThink(main) {
  const J = G.journeyOf(S), nx = G.stopOf(S, J.stage + 1); if (!nx) return;
  const sl = G.scoutSlots(S, main.id);
  const ri = G.routeInfo(S);
  if (!ri.ok && count(main, 'scout')) { const lo = S.buildings.find(b => b.camp === main.id && b.type === 'scout'); if (lo && Math.random() < 0.3) G.upgrade(S, lo.id); }
  if (sl.n <= sl.used) return;
  const w = getWorld(S.runSeed);
  const pf = w.pois.find(p => S.poiFound[p.id] && !S.poiDone[p.id] && !S.scouts.some(s => s.poi === p.id));
  if (pf) { G.sendScout(S, main.id, pf.x, pf.y, 'rescue', pf.id); return; }
  const rng = G.scoutRange(S, main.id) - 1;
  if (!ri.ok) {
    // 往下一站走，偏一点角度把沿路的雾揭开
    const ang = Math.atan2(nx.y - main.y, nx.x - main.x) + (Math.random() - 0.5) * 0.9;
    const dd = Math.min(rng, Math.hypot(nx.y - main.y, nx.x - main.x) + 4);
    G.sendScout(S, main.id, Math.round(Math.max(1, Math.min(W - 2, main.x + Math.cos(ang) * dd))), Math.round(Math.max(1, Math.min(H - 2, main.y + Math.sin(ang) * dd))));
  } else {
    const p = w.pois.find(p => !S.poiDone[p.id] && !S.poiFound[p.id] && Math.hypot(p.x - main.x, p.y - main.y) < rng);
    if (p) G.sendScout(S, main.id, p.x, p.y);
  }
}

// 缺原料、营地里采不到：在这一程范围里找资源点建前哨
function outpostThink(main) {
  if (S.camps.length >= 2 + G.journeyOf(S).stage) return;
  const RAWS = ['ore', 'coal', 'lime', 'shale', 'crystal', 'star', 'shard'];
  const R = G.rt(S), short = new Set();
  for (const b of G.campBuildings(S, main.id)) { const st = (R.b[b.id] || {}).status || ''; for (const k of RAWS) if (st === '缺' + RES[k].n) short.add(k); }
  for (const k of short) {
    const gt = Object.keys(BLD).find(t => BLD[t].gather && BLD[t].out[k]);
    if (!gt || bestSpot(main, gt)) continue;
    const w = getWorld(S.runSeed), SK = ['tree', 'rock', 'herd', 'coal', 'ore', 'lime', 'shale', 'crystal', 'star', 'shard'];
    const rg = G.outpostRange(S);
    let best = null, bd = 1e9;
    for (let y = Math.max(0, Math.floor(rg.y0)); y < Math.min(H, rg.y1); y++) for (let x = 0; x < W; x++) {
      const i = idx(x, y); if (!S.reveal[i] || SK[w.spot[i]] !== k || G.spotLeft(S, i) <= 0) continue;
      const d = Math.hypot(x - main.x, y - main.y); if (d < bd && d > 18) { bd = d; best = [x, y]; }
    }
    if (!best) continue;
    S.active = main.id;
    for (let r = 4; r < 9; r++) for (let a = 0; a < 12; a++) {
      const x = Math.round(best[0] + Math.cos(a * 0.52) * r), y = Math.round(best[1] + Math.sin(a * 0.52) * r);
      if (G.checkPlace(S, 'furnace', x, y).ok) { G.place(S, 'furnace', x, y); log('outpost for', k); STAT.outposts = (STAT.outposts || 0) + 1; return; }
    }
  }
}

// 章节里的其他任务：律令、研究、探索、希望、运输线、不满
function sideThink(main) {
  const ch = CHAPTERS[G.journeyOf(S).stage];
  if (ch) for (const q of ch.tasks) if (q.k === 'bld' && S.buildings.filter(b => b.type === q.b).length < q.n) { for (const c of S.camps) if (tryBuild(c, q.b)) break; }
  if (!S.laws || !Object.values(S.laws).some(Boolean)) G.toggleLaw(S, 'fires');
  if (main.disc > 40 && !G.lawOn(S, 'patrol') && !G.lawWait(S, 'patrol')) G.toggleLaw(S, 'patrol');
  if (!(S.tech && S.tech.cur)) { const t = TECHS.find(t => G.techCheck(S, t.id).ok); if (t) { S.active = main.id; G.startTech(S, t.id); log('tech', t.n); } }
  const w = getWorld(S.runSeed), pend = G.expPending(S);
  if (pend) G.resolveSite(S, pend.id, 0);
  else if (!S.scouts.some(s => s.kind === 'exp')) {
    const p = (w.sites || []).find(p => G.siteState(S, p) === 'seen' && Math.hypot(p.x - main.x, p.y - main.y) < G.scoutRange(S, main.id));
    if (p) { const r = G.sendExpedition(S, main.id, p.id, 'full'); if (r && r.ok) log('expedition'); }
  }
  if ((main.hope ?? 50) < 66) {
    if (!G.festBlock(S, main)) G.startFest(S, main.id);
    const dk = ['flowerhouse', 'statue', 'flagpole', 'lamp'].find(t => G.unlocked(S, t));
    if (dk && G.campBuildings(S, main.id).filter(b => BLD[b.type].cat === 'deco').length < 4 + S.known) tryBuild(main, dk);
  }
  for (const c of S.camps) if (c.id !== main.id && !S.lines.some(l => (l.a === main.id && l.b === c.id) || (l.b === main.id && l.a === c.id))) { S.active = main.id; G.addLine(S, main.id, c.id); }
  // 运输线：从老营地往主营地运主营地缺的东西（第 9 步做补给站自动送货以前，先手动设）
  for (const l of S.lines) {
    const fromA = l.a !== main.id, other = G.getCamp(S, fromA ? l.a : l.b); if (!other || (l.a !== main.id && l.b !== main.id)) continue;
    const want = Object.keys(other.stock).filter(k => (other.stock[k] || 0) > 600 && (main.stock[k] || 0) < 400 && k !== 'food')
      .sort((x, y) => RES[y].t - RES[x].t).slice(0, 3);
    if ((main.stock.food || 0) < main.people * 40 && (other.stock.food || 0) > 2000) want.unshift('food');
    const routes = want.slice(0, 3).map(k => ({ res: k, from: fromA ? 'a' : 'b', keep: 300 }));
    // 老营地、前哨缺吃的：主营地往那边送
    if ((other.stock.food || 0) < other.people * 40 && (main.stock.food || 0) > main.people * 60) routes.unshift({ res: 'food', from: fromA ? 'b' : 'a', keep: main.people * 40 });
    if (routes.length) G.setRoutes(S, l.id, routes);
    if (Math.random() < 0.2) G.upgradeLine(S, l.id);
  }
}

const legs = [];
let legT0 = 0;
function legReport(J) {
  const main = G.mainCamp(S), fb = G.getB(S, main.furnace), R = G.rt(S);
  const prods = G.campBuildings(S, main.id).filter(b => BLD[b.type].out && BLD[b.type].cat !== 'core');
  const avgL = prods.length ? prods.reduce((a, b) => a + b.lvl, 0) / prods.length : 0;
  const bonus = prods.length ? prods.reduce((a, b) => a + G.prodBonus(S, b, main).sum, 0) / prods.length : 0;
  const stocks = S.camps.flatMap(c => Object.entries(c.stock)).filter(([k]) => k !== 'food').map(([k, v]) => v);
  const maxStock = Math.max(...stocks);
  const fuelK = Object.keys(FUEL).filter(f => (G.rt(S).c[main.id]?.burnBy || {})[f]);
  const burn = furnaceBurn(fb.lvl), bestFuel = ['battery', 'coke', 'coal', 'wood'].find(f => (main.stock[f] || 0) > 10) || 'wood';
  const goals = G.rateGoals(S).map(g => `${RES[g.r].n} ${G.prodRate(S, g.r).toFixed(1)}/${g.n}`).join(' ');
  const lines = G.plinesOf(S).map(l => `${RES[l.r].n}${'★'.repeat(l.star)}`).join(' ');
  const upc = prods[0] ? G.upgradeCost(S, prods.sort((a, b) => b.lvl - a.lvl)[0]) : {};
  legs.push(`leg ${J.stage} 用时 ${((S.t - legT0) / 3600).toFixed(1)}h · 熔炉 ${fb.lvl} · 产线建筑平均 ${avgL.toFixed(1)} 级 · 加成 +${Math.round(bonus * 100)}% · 人 ${main.people}/${G.popCap(S, main)} · 建筑 ${S.buildings.filter(b => b.camp === main.id).length} · 最大库存 ${Math.round(maxStock)} · 烧 ${(burn / FUEL[bestFuel]).toFixed(1)} ${RES[bestFuel].n}/分 · 产线 ${lines} · 余烬 ${S.meta.embers} · 最高级升级 ${JSON.stringify(upc)}`);
  void fuelK; void R; void goals;
  legT0 = S.t;
}

function think() {
  const J = G.journeyOf(S), main = G.mainCamp(S);
  if (J.trip) {
    if (J.trip.phase === 'arrive') { const p = G.arriveSpot(S); if (p) { const r = G.arrive(S, p.x, p.y); log('arrive', JSON.stringify(r).slice(0, 80)); } }
    return;
  }
  for (const c of S.camps) { c.roomT = 0; campThink(c, main); }
  S.active = main.id;
  // 专家
  for (const sid in S.meta.specs) {
    if (S.specAt[sid] && G.getB(S, S.specAt[sid])) { G.trainSpec(S, sid); continue; }
    const sp = SPECS.find(s => s.id === sid);
    const b = S.buildings.find(b => b.camp === main.id && sp.aff.includes(b.type) && !G.specIn(S, b.id));
    if (b) G.assignSpec(S, sid, b.id);
  }
  scoutThink(main);
  outpostThink(main);
  sideThink(main);
  // 章节奖励
  for (const c of G.chapters(S)) if (c.done && !c.got) { S.active = main.id; G.claimChapter(S, c.i); log('chapter', c.ch.n); }
  // 北迁
  const g = G.departGate(S);
  if (g) {
    const car = g.items.find(i => i.id === 'car');
    if (g.items.filter(i => i.id !== 'car').every(i => i.ok) && !car.ok) buildSleds(g.plan);
    const g2 = G.departGate(S);
    if (g2.ok) {
      // 小的老营地熄火换余烬，大的留成补给站
      for (const c of S.camps) if (c.id !== main.id) G.setCampMode(S, c.id, c.people < 15 ? 'douse' : 'keep');
      legReport(J);
      const r = G.depart(S);
      if (r.ok) log('depart to', g2.next.n);
      else log('depart fail', r.reason);
    }
  }
  // 余烬强化
  let bought = true;
  while (bought) {
    bought = false;
    for (const k of ['prod', 'heat', 'thrift', 'haul', 'people', 'guard', 'hardy']) if (G.buyEmber(S, k).ok) { bought = true; break; }
  }
}

const t0 = Date.now();
let invN = 0, lastLog = null, lastDay = -1, lastOff = -1;
const CAUSE = {};
const DEATH_RE = [['hunger', /没能熬过去（饥饿/], ['cold', /没能熬过去（严寒/], ['gangLost', /」冲进了「.*人遇难/], ['raidLost', /袭击.*人遇难|狼群.*人遇难/]];
const OFFS = [];
while (S.t < DAYS * 86400 && G.journeyOf(S).stage < G.STOP_N - 1) {
  for (let i = 0; i < THINK / 10; i++) G.step(S, 10);
  think();
  // 每天离线一次
  const d = Math.floor(S.t / 86400);
  if (OFFLINE && d !== lastOff && S.t % 86400 > 20 * 3600) {
    lastOff = d; const before = JSON.stringify(G.mainCamp(S).stock);
    const sum = G.catchUp(S, OFFLINE * 3600);
    OFFS.push(`${day()} 离线 ${OFFLINE}h 按 ${Math.round(sum.rate * 100)}%：${Object.entries(sum.res).filter(([k, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => RES[k].n + ' +' + v).join(' ')}`);
    void before;
  }
  { const L = S.log; let i = L.length - 1; while (i >= 0 && L[i] !== lastLog) i--; for (let j = i + 1; j < L.length; j++) { const m = L[j].msg; for (const [k, re] of DEATH_RE) if (re.test(m)) CAUSE[k] = (CAUSE[k] || 0) + 1; if ((VERBOSE && /⭐|🎆|车队|新熔炉/.test(m)) || /饥饿|冻死|严寒/.test(m)) console.log(day(), 'LOG', m); } lastLog = L[L.length - 1]; }
  for (const c of S.camps) {
    for (const k in c.stock) if (!Number.isFinite(c.stock[k]) || c.stock[k] < -0.01) { if (invN++ < 12) console.log('INV', day(), c.name, k, c.stock[k]); }
    if (!Number.isFinite(c.people) || c.people < 0) { if (invN++ < 12) console.log('INV', day(), c.name, 'people', c.people); }
  }
  if (d !== lastDay) {
    lastDay = d;
    const J = G.journeyOf(S), main = G.mainCamp(S), gt = G.departGate(S);
    const goals = G.rateGoals(S).map(g => `${RES[g.r].n} ${G.prodRate(S, g.r).toFixed(1)}/${g.n} hold ${Math.round(G.holdOf(S, g.id).p)}`).join(' ');
    console.log(`day ${d} stage=${J.stage} known=${S.known} camps=${S.camps.length} furnace=${G.getB(S, main.furnace).lvl} people=${S.camps.map(c => c.people).join('/')} bld=${S.buildings.length} deaths=${S.stats.deaths} raids=${S.stats.raidsWon}/${S.stats.raids} embers=${S.meta.embers} | ${goals} | gate ${gt ? gt.items.map(i => (i.ok ? '✓' : '✗') + i.id + (i.ok ? '' : ':' + i.sub)).join(' ') : '-'} ${(G.chapters(S).find(c => c.i === J.stage)?.tasks || []).filter(t => !t.ok).map(t => t.t + ' ' + t.cur).join(',')} | causes ${JSON.stringify(CAUSE)}`);
  }
}
console.log('\n' + legs.join('\n'));
if (OFFS.length) console.log(OFFS.slice(0, 8).join('\n'));
console.log('INVARIANT violations', invN, 'STAT', JSON.stringify(STAT));
console.log('end', day(), 'stage', G.journeyOf(S).stage, 'wall', (Date.now() - t0) / 1000 + 's');
const main = G.mainCamp(S);
console.log('main stock', JSON.stringify(Object.fromEntries(Object.entries(main.stock).map(([k, v]) => [k, Math.round(v)]))));
console.log(S.log.slice(-12).map(l => l.msg).join('\n'));
import fs from 'fs';
fs.writeFileSync(process.env.SAVE || '/tmp/jsave.json', G.serialize(S));
