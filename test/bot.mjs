// 模拟玩家：用简单规则玩，检查节奏（多少天能毕业）和中后期系统有没有 bug
import * as G from '../src/sim.js';
import { BLD, LANDMARKS, GATE, RES, EMBER_UPS, SPECS, tierOfRow, furnaceRadius, specTrainCost } from '../src/data.js';
import { getWorld, W, H, idx } from '../src/worldgen.js';

{ let a = +(process.env.RSEED || 12345) >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; } // 可复现：同样的设置跑出同样的结果
const DAYS = +(process.argv[2] || 40);
const THINK = +(process.argv[3] || 300); // 玩家多久操作一次（秒）
const VERBOSE = process.argv.includes('-v');
const SKIP_IDLE = new Set(['coker']);
const CHAIN = {
  1: ['lumber', 'hunter', 'kitchen', 'quarry', 'sawmill'],
  2: ['coalmine', 'ironmine', 'smelter', 'coker'],
  3: ['limequarry', 'steelworks', 'gearworks', 'engineworks', 'greenhouse'],
  4: ['shalepit', 'refinery', 'sealworks'],
  5: ['crystalmine', 'batteryworks', 'alloyworks'],
  6: ['salvage', 'partworks', 'coreworks', 'bay'],
  7: ['excavator', 'forge'],
};
const START = +(process.env.START || 0);
const meta0 = G.defaultMeta(); for (let i = 1; i <= START; i++) meta0.sites.push(i);
let S = G.newRun(meta0, START, 777);
const noGang = () => { if (process.env.NOGANG) { S.gangs = {}; for (const g of G.gangsOf(S)) S.gangs[g.id] = { seen: 1, gone: 1, next: 9e12, rel: 0, wins: 2, n: 0 }; } };
noGang();
let day0 = 0, totalT = 0, lastProgressT = 0, lastBest = 0;
const timeline = [];

function bestSpot(camp, type) {
  const d = BLD[type], s = d.size;
  const f = G.getB(S, camp.furnace);
  const r = furnaceRadius(f.lvl) + 1;
  let best = null, bs = -1e9;
  for (let y = Math.floor(camp.y - r); y <= camp.y + r; y++) for (let x = Math.floor(camp.x - r); x <= camp.x + r; x++) {
    const ck = G.checkPlace(S, type, x, y);
    if (!ck.ok || ck.camp !== camp.id) continue;
    let sc = -ck.dist * 2 + ck.syn * 3;
    if (d.gather) { if (!ck.spots) continue; sc += ck.spots * 4; }
    if (type === 'tower') sc = Math.hypot(x - camp.x, y - camp.y) - Math.abs(Math.hypot(x - camp.x, y - camp.y) - 5);
    if (sc > bs) { bs = sc; best = [x, y]; }
  }
  return best;
}
function tryBuild(camp, type) {
  if (!G.unlocked(S, type)) return false;
  const p = bestSpot(camp, type);
  if (!p) return false;
  const r = G.place(S, type, p[0], p[1]);
  if (r.ok && VERBOSE) console.log(day(), 'build', type, camp.name);
  return r.ok;
}
function day() { return ((totalT + S.t) / 86400).toFixed(2) + 'd'; }
function rates(camp) {
  const R = G.rt(S);
  const out = {}, inn = {};
  for (const b of G.campBuildings(S, camp.id)) {
    const br = R.b[b.id]; if (!br || !br.rate) continue;
    for (const k in br.rate) out[k] = (out[k] || 0) + br.rate[k];
    for (const k in br.inRate) inn[k] = (inn[k] || 0) + br.inRate[k];
  }
  return { out, inn };
}
function count(camp, type) { return G.countType(S, camp.id, type); }
function fillWorkers(camp) {
  const bs = G.campBuildings(S, camp.id).filter(b => G.maxWorkers(b.type, b.lvl) > b.workers);
  bs.sort((a, b) => (a.type === 'warehouse' ? 1 : 0) - (b.type === 'warehouse' ? 1 : 0));
  for (const b of bs) { const free = G.idleLabor(S, camp); if (free <= 0) break; G.setWorkers(S, b.id, b.workers + free); }
}
function campThink(camp, frontier) {
  const R = G.rt(S);
  const cr = R.c[camp.id];
  if (!cr) return;
  const st = camp.stock;
  const { out, inn } = rates(camp);
  const fb = G.getB(S, camp.furnace);
  // 住房
  if (cr.housing - camp.people < 2 && (cr.foodNet > 0.5 || camp.people < 40)) {
    const tents = G.campBuildings(S, camp.id).filter(b => b.type === 'tent').sort((a, b) => a.lvl - b.lvl);
    if (!tryBuild(camp, 'tent') && tents[0]) G.upgrade(S, tents[0].id);
  }
  // 食物
  const foodNet = (out.food || 0) - cr.eatPerMin;
  if (foodNet < 0.5) {
    if (S.known >= 3 && count(camp, 'greenhouse') < 6) tryBuild(camp, 'greenhouse');
    if ((out.game || 0) < (inn.game || 0) + 2 && (count(camp, 'hunter') >= 3 || !tryBuild(camp, 'hunter'))) {
      const h = G.campBuildings(S, camp.id).filter(b => b.type === 'hunter')[0]; if (h) G.upgrade(S, h.id);
    }
    if (count(camp, 'kitchen') === 0 || (st.game || 0) > 150) { if (!tryBuild(camp, 'kitchen')) { const k = G.campBuildings(S, camp.id).find(b => b.type === 'kitchen'); if (k) G.upgrade(S, k.id); } }
  }
  if ((st.stone || 0) < 300 && count(camp, 'quarry') < 3) tryBuild(camp, 'quarry');
  // 燃料
  const fuelRate = (out.wood || 0) - (inn.wood || 0) + 3 * ((out.coal || 0) - (inn.coal || 0)) + 10 * ((out.coke || 0)) + 32 * (out.battery || 0) - 32 * (inn.battery || 0);
  if (fuelRate < cr.burnPerMin * 1.3 && cr.fuelUnits < 2000) {
    if (S.known >= 2 && !tryBuild(camp, 'coalmine')) {}
    tryBuild(camp, 'lumber');
  }
  // 搬运
  if (cr.hf < 0.85) { if (!tryBuild(camp, 'warehouse')) { const w = G.campBuildings(S, camp.id).find(b => b.type === 'warehouse'); if (w) G.upgrade(S, w.id); } }
  // 防御
  const nr = G.nextRaid(S);
  if (nr && nr.camp === camp.id && nr.in < 3600) {
    const str = G.raidStrength(S, camp, nr), def = G.campDefense(S, camp);
    if (def < str * 1.15) {
      const tw = G.campBuildings(S, camp.id).filter(b => b.type === 'tower').sort((a, b) => a.lvl - b.lvl);
      if (tw.length < 4) tryBuild(camp, 'tower'); else G.upgrade(S, tw[0].id);
    }
  }
  // 产业链
  for (let t = 1; t <= S.known; t++) for (const type of CHAIN[t]) {
    if (type === 'coker' && (st.coal || 0) < 400) continue;
    if (count(camp, type) === 0) tryBuild(camp, type);
  }
  if (frontier && S.known >= 1 && count(camp, 'scout') === 0) tryBuild(camp, 'scout');
  // 有闲人就扩产：优先最高层的链条
  for (let tries = 0; tries < 3 && G.idleLabor(S, camp) > 3; tries++) {
    const opts = [];
    for (let t = S.known; t >= 1; t--) for (const type of CHAIN[t]) if (BLD[type].w && !SKIP_IDLE.has(type) && count(camp, type) < 2 + (t === 1 && !['kitchen', 'hunter'].includes(type) ? 1 : 0)) opts.push(type);
    if (!opts.length || !tryBuild(camp, opts[Math.floor(Math.random() * Math.min(4, opts.length))])) break;
    fillWorkers(camp);
  }
  fillWorkers(camp);
  // 矿快采完：挖深井；营地缺矿就派勘探队
  for (const b of G.campBuildings(S, camp.id)) if (G.deepable(b.type) && !b.deep && !G.deepBlock(S, b)) { G.digDeep(S, b.id); if (VERBOSE) console.log(day(), 'deep', b.type); }
  if (!process.env.NOSURVEY && (camp.surveys || 0) < 4 && G.campBuildings(S, camp.id).some(b => G.deepable(b.type) && G.gatherLeftFrac(S, b) < 0.3) && !G.surveyBlock(S, camp)) { const r = G.startSurvey(S, camp.id); if (VERBOSE && r.ok) console.log(day(), 'survey', r.kind); }
  // 熔炉升级
  G.upgrade(S, fb.id);
  // 生产建筑轮流升级（留一点）
  const bs = G.campBuildings(S, camp.id).filter(b => BLD[b.type].out || b.type === 'warehouse' || b.type === 'scout').sort((a, b) => a.lvl - b.lvl);
  for (const b of bs.slice(0, 3)) {
    if (b.lvl >= fb.lvl + 2) continue;
    G.upgrade(S, b.id);
  }
  // 原料不够时加建上游
  for (const b of G.campBuildings(S, camp.id)) {
    const br = R.b[b.id]; if (!br) continue;
    if (br.status && br.status.startsWith('缺')) {
      const need = Object.keys(RES).find(k => br.status === '缺' + RES[k].n);
      const prod = Object.keys(BLD).find(t => BLD[t].out && BLD[t].out[need] && G.unlocked(S, t));
      if (prod && count(camp, prod) < 8) tryBuild(camp, prod);
    }
    if (br.status === '附近资源点已采空') { G.demolish(S, b.id); tryBuild(camp, b.type); }
  }
  if (camp.stock.heart >= 1) G.deliverEternal(S);
  // 暖炉：太冷
  if (cr.tH < 0 && S.known >= 3 && count(camp, 'heater') < 3) tryBuild(camp, 'heater');
  if (!process.env.NOV11) v11Think(camp, cr);
}
// 第十一版的新玩法：医务所、装饰、庆典、怪天气准备、掠夺者、专精、犬舍、批量升级、传送带
const V11 = {};
const did = k => { V11[k] = (V11[k] || 0) + 1; if (VERBOSE) console.log(day(), 'v11', k); };
const OFF = new Set((process.env.V11OFF || '').split(',')); const on = k => !OFF.has(k);
function v11Think(camp, cr) {
  const fb = G.getB(S, camp.furnace);
  if (on('ward') && (cr.sick || 0) >= 2 && count(camp, 'infirmary') < 1 && tryBuild(camp, 'infirmary')) did('infirmary');
  if (on('deco') && (camp.hope ?? 50) < 55) { const dk = ['flowerhouse', 'statue', 'flagpole', 'lamp'].find(t => G.unlocked(S, t)); const nd = G.campBuildings(S, camp.id).filter(b => BLD[b.type].cat === 'deco').length; if (dk && nd < 6 && tryBuild(camp, dk)) did('deco:' + dk); }
  if (on('fest') && !G.festBlock(S, camp) && (camp.hope ?? 50) < 65 && G.startFest(S, camp.id).ok) did('fest');
  if (on('wx')) { const e = G.wxeAt(S, S.t); if (e.ev && !e.on && e.inSec <= G.FORECAST && G.wxeMatters(S, camp, e.ev) && !G.wxePrepped(S, camp, e.ev)) { const r = G.wxePrep(S, camp.id); if (r && r.ok) did('wxprep:' + e.ev.kind); } }
  if (on('gang')) for (const d of G.gangDemands(S)) { if (d.st.dem.camp !== camp.id || d.st.dem.fight) continue; const how = process.env.RECKLESS ? ['tribute', 'trade', 'fight'][(d.st.n || 0) % 3] : G.campDefense(S, camp) >= G.gangStr(S, d.g) ? 'fight' : (d.st.n || 0) % 2 && !G.gangTradeBlock(S, d.g, camp) && G.canAfford(camp.stock, G.gangTrade(S, d.g, camp).give) ? 'trade' : 'tribute'; const r = G.gangAnswer(S, d.g.id, how); did('gang:' + how + (r && r.ok === false ? ':no' : '')); }
  if (on('focus') && !camp.focus && fb.lvl >= 5 && !G.focusBlock(S, camp, 'craft') && G.setFocus(S, camp.id, ['mine', 'farm', 'craft', 'fort'][camp.id % 4]).ok) did('focus');
  if (on('kennel') && count(camp, 'scout') && !S.buildings.some(b => b.type === 'kennel') && tryBuild(camp, 'kennel')) did('kennel');
  if (on('bulk') && Math.random() < 0.15) { const b = G.campBuildings(S, camp.id).find(b => b.type === 'lumber' || b.type === 'tent'); if (b) { const r = G.bulkUpgrade(S, b.id); if (r && r.ok) did('bulk'); } }
  if (on('belt') && S.known >= 2 && (S.belts || []).filter(e => e.camp === camp.id).length < 3 && Math.random() < 0.3) {
    for (const b of G.campBuildings(S, camp.id).filter(b => BLD[b.type].cat === 'make')) { const o = G.beltOptions(S, b.id).find(o => o.ck.ok); if (o && G.addBelt(S, o.a, o.b, o.k).ok) { did('belt'); break; } }
  }
}
let wantExplore = false;
function think() {
  const frontier = S.camps.reduce((a, c) => (c.y > a.y ? c : a), S.camps[0]);
  for (const c of S.camps) { S.active = c.id; campThink(c, c === frontier); }
  S.active = frontier.id;
  // 专家安排
  for (const sid in S.meta.specs) {
    if (S.specAt[sid] && G.getB(S, S.specAt[sid])) { G.trainSpec(S, sid); continue; }
    const sp = SPECS.find(s => s.id === sid);
    const b = S.buildings.find(b => sp.aff.includes(b.type) && !G.specIn(S, b.id));
    if (b) G.assignSpec(S, sid, b.id);
  }
  // 侦察：往下一个地标方向
  const next = LANDMARKS.findIndex((l, i) => i > Math.max(...S.founded));
  const sl = G.scoutSlots(S, frontier.id);
  if (sl.n > sl.used) {
    const R = G.rt(S);
    // 救援
    const w = getWorld(S.runSeed);
    const pf = w.pois.find(p => S.poiFound[p.id] && !S.scouts.some(s => s.poi === p.id));
    if (pf) G.sendScout(S, frontier.id, pf.x, pf.y, 'rescue', pf.id);
    else if (wantExplore) { wantExplore = false; const rng = G.scoutRange(S, frontier.id) - 1; const ang = Math.random() * 6.28; G.sendScout(S, frontier.id, Math.round(Math.max(1, Math.min(W - 2, frontier.x + Math.cos(ang) * rng))), Math.round(frontier.y + Math.sin(ang) * rng)); }
    else if (next > 0) {
      const L = LANDMARKS[next];
      const rng = G.scoutRange(S, frontier.id) - 1;
      const ang = Math.atan2(L.row - frontier.y, L.x - frontier.x) + (Math.random() - 0.5) * 0.8;
      const dd = Math.min(rng, Math.hypot(L.row - frontier.y, L.x - frontier.x));
      const tx = frontier.x + Math.cos(ang) * dd, ty = frontier.y + Math.sin(ang) * dd;
      if (!S.discovered.includes(next) || Math.random() < 0.3) G.sendScout(S, frontier.id, Math.round(tx), Math.round(ty));
      else {
        // 找没揭开的兴趣点方向
        const p = w.pois.find(p => !S.poiDone[p.id] && !S.poiFound[p.id] && p.y < frontier.y + 40 && p.y > frontier.y - 20);
        if (p) G.sendScout(S, frontier.id, p.x, p.y);
      }
    }
  }
  if (next > 0 && !S.discovered.includes(next)) { const lo = S.buildings.find(b => b.camp === frontier.id && b.type === 'scout'); if (lo) G.upgrade(S, lo.id); }
  // 建新营地：在发现的下一个地标旁
  if (next > 0 && S.discovered.includes(next)) {
    const L = LANDMARKS[next];
    for (let r = 0; r < 11; r++) {
      let done = false;
      for (let a = 0; a < 16 && !done; a++) {
        const x = Math.round(L.x - 1 + Math.cos(a / 16 * 6.28) * r), y = Math.round(L.row - 1 + Math.sin(a / 16 * 6.28) * r);
        const ck = G.checkPlace(S, 'furnace', x, y);
        if (ck.ok) { G.place(S, 'furnace', x, y); done = true; if (VERBOSE) console.log(day(), 'found', L.n); }
      }
      if (done) break;
    }
  }
  // 资源前哨：缺某种原料而营地里采不到时，在找得到的资源点旁建新营地
  const RAWS = { ore: 'ore', coal: 'coal', lime: 'lime', shale: 'shale', crystal: 'crystal', star: 'star', shard: 'shard' };
  for (const c of [frontier]) {
    if (S.camps.length >= 6) break;
    const R = G.rt(S);
    const short = new Set();
    for (const b of G.campBuildings(S, c.id)) { const st = (R.b[b.id] || {}).status || ''; for (const k in RAWS) if (st === '缺' + RES[k].n) short.add(k); }
    for (const k of short) {
      const gt = Object.keys(BLD).find(t => BLD[t].gather && BLD[t].out[k]);
      if (G.campBuildings(S, c.id).some(b => b.type === gt && ((R.b[b.id] || {}).status || '') !== '附近资源点已采空')) continue;
      if (bestSpot(c, gt)) continue;
      const w = getWorld(S.runSeed); const ki = Object.keys(RAWS).indexOf(k);
      let best = null, bd = 1e9;
      const SK = ['tree','rock','herd','coal','ore','lime','shale','crystal','star','shard'];
      for (let y = Math.max(0, Math.floor(c.y - 45)); y < Math.min(H, c.y + 45); y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y); if (!S.reveal[i] || SK[w.spot[i]] !== k || G.spotLeft(S, i) <= 0) continue;
        const d = Math.hypot(x - c.x, y - c.y); if (d < bd && d > 18) { bd = d; best = [x, y]; }
      }
      if (!best) { wantExplore = true; continue; }
      S.active = c.id;
      let ok = false;
      for (let r = 4; r < 9 && !ok; r++) for (let a = 0; a < 12 && !ok; a++) { const x = Math.round(best[0] + Math.cos(a * 0.52) * r), y = Math.round(best[1] + Math.sin(a * 0.52) * r); if (G.checkPlace(S, 'furnace', x, y).ok) { G.place(S, 'furnace', x, y); ok = true; if (VERBOSE) console.log(day(), 'outpost for', k); } }
    }
  }
  // 运输线：每个新营地连上一个
  for (let i = 1; i < S.camps.length; i++) {
    const b = S.camps[i];
    const a = S.camps.slice(0, i).reduce((p, q) => Math.hypot(q.x - b.x, q.y - b.y) < Math.hypot(p.x - b.x, p.y - b.y) ? q : p);
    let l = S.lines.find(l => (l.a === a.id && l.b === b.id));
    if (!l) { S.active = a.id; G.addLine(S, a.id, b.id); l = S.lines.find(l => (l.a === a.id && l.b === b.id)); }
    if (l) {
      const need = [];
      for (let t = 1; t <= Math.min(S.known, 6); t++) need.push(GATE[t]);
      need.push('coal', 'food', 'engine');
      // 双向：把对方缺、自己多的东西运过去（含原料）
      const all = ['ore', 'coal', 'lime', 'shale', 'crystal', 'star', 'shard', ...need];
      const pairs = [];
      for (const k of all) {
        const da = (a.stock[k] || 0) - (b.stock[k] || 0);
        if (Math.abs(da) > 150) pairs.push({ res: k, from: da > 0 ? 'a' : 'b', keep: 80, d: Math.abs(da) });
      }
      pairs.sort((x, y) => y.d - x.d);
      G.setRoutes(S, l.id, [...pairs.slice(0, 3), { res: 'people', from: (a.people > b.people ? 'a' : 'b') }]);
      G.upgradeLine(S, l.id);
    }
  }
  // 北迁判断
  const best = S.founded.length ? Math.max(...S.founded) : 0;
  const prog = best * 1000 + S.eternal.stage * 100 + S.eternal.have;
  if (prog > lastBest) { lastBest = prog; lastProgressT = S.t; }
  if (S.t - lastProgressT > 4 * 86400 && G.emberGain(S) > 20 && !S.ended) {
    const gain = G.emberGain(S);
    timeline.push(`${day()} 北迁：余烬 +${gain}，最远地标 ${best}`);
    totalT += S.t;
    const site = Math.max(...S.meta.sites);
    S = G.migrate(S, site); noGang();
    lastProgressT = 0; lastBest = site * 1000;
    // 买强化
    let bought = true;
    while (bought) {
      bought = false;
      const keys = Object.keys(EMBER_UPS).sort((a, b) => G.up(S, a) - G.up(S, b));
      for (const k of ['prod', 'heat', 'thrift', 'haul', ...keys]) if (G.buyEmber(S, k).ok) { bought = true; break; }
    }
  }
}

const t0 = Date.now();
let invN = 0, lastLog = null; const CAUSE = {};
const DEATH_RE = [['hunger', /没能熬过去（饥饿/], ['cold', /没能熬过去（严寒/], ['gangLost', /」冲进了「.*人遇难/], ['gangFightLost', /」冲进了「/], ['tribute', /交了贡|纳了贡|交贡/], ['raidLost', /袭击.*人遇难|狼群.*人遇难/]];
let lastDayLog = -1;
const seenLand = new Set();
while (totalT + S.t < DAYS * 86400 && !S.meta.graduated) {
  if (process.argv.includes("-h") && Math.floor(S.t/1800)!==Math.floor((S.t-THINK)/1800)) { const c=S.camps[0]; const cr=G.rt(S).c[c.id]||{}; console.log((S.t/3600).toFixed(1)+"h", "ppl",c.people,"house",cr.housing,"T",Math.round(c.temp),"tH",Math.round(cr.tH),"fuel",Math.round(cr.fuelUnits),"food",Math.round(c.stock.food||0),"game",Math.round(c.stock.game||0),"wood",Math.round(c.stock.wood||0),"hunger",(cr.hunger||0).toFixed(2),"hf",(cr.hf||0).toFixed(2),"assigned",cr.assigned, "bld", S.buildings.map(b=>b.type[0]+b.lvl+"w"+b.workers).join(" ")); }
  for (let i = 0; i < THINK / 10; i++) G.step(S, 10);
  think();
  if (process.env.FOODDBG && Math.floor(S.t / 3600) !== Math.floor((S.t - THINK) / 3600)) { const R = G.rt(S); console.log('F', day(), S.camps.map(c => { const cr = R.c[c.id] || {}; return `${c.name.slice(0, 4)} p${c.people}/${cr.housing} f${Math.round(c.stock.food || 0)} g${Math.round(c.stock.game || 0)} net${(cr.foodNet || 0).toFixed(1)} h${(cr.hunger || 0).toFixed(2)} d${(cr.dogs || 0).toFixed(1)} sick${Math.round(cr.sick || 0)}`; }).join(' | ')); }
  // 死因统计：扫新增的日志
  { const L = S.log; let i = L.length - 1; while (i >= 0 && L[i] !== lastLog) i--; for (let j = i + 1; j < L.length; j++) { const m = L[j].msg; for (const [k, re] of DEATH_RE) if (re.test(m)) { const n = +(m.match(/(\d+) 人遇难/) || [0, 1])[1]; CAUSE[k] = (CAUSE[k] || 0) + (k === 'gangLost' || k === 'raidLost' ? n : 1); } } lastLog = L[L.length - 1]; }
  // 不变量：物资不能是 NaN/负数，人数、心情在范围内
  for (const c of S.camps) {
    for (const k in c.stock) if (!Number.isFinite(c.stock[k]) || c.stock[k] < -0.01) { if (invN++ < 12) console.log('INV', day(), c.name, k, c.stock[k]); }
    if (!Number.isFinite(c.people) || c.people < 0 || (c.hope != null && !Number.isFinite(c.hope)) || c.hope < -0.01 || c.hope > 100.01 || (c.disc != null && !Number.isFinite(c.disc))) { if (invN++ < 12) console.log('INV', day(), c.name, 'people/hope/disc', c.people, c.hope, c.disc); }
  }
  const d = Math.floor((totalT + S.t) / 86400);
  for (const i of S.founded) if (!seenLand.has(`${S.meta.runs}-${i}`)) { seenLand.add(`${S.meta.runs}-${i}`); timeline.push(`${day()} 第${S.meta.runs}轮 到达 ${LANDMARKS[i].n}`); }
  if (d !== lastDayLog) {
    lastDayLog = d;
    const c = S.camps[S.camps.length - 1];
    const fur = S.camps.map(c => G.getB(S, c.furnace).lvl).join('/');
    { const nx = LANDMARKS.findIndex((l, i) => i > Math.max(...S.founded)); const fr = S.camps[S.camps.length-1]; S.active = fr.id;
      if (nx > 0) { const L = LANDMARKS[nx]; let why = ''; for (let dy=-6;dy<=6;dy++) for (let dx=-6;dx<=6;dx++){ const ck = G.checkPlace(S,'furnace',L.x-1+dx,L.row-1+dy); if (ck.ok) why='OK'; else if(!why||ck.soft) why = ck.reason; } console.log('  next', L.n, S.discovered.includes(nx) ? 'seen' : 'unseen', why, 'frontier', JSON.stringify(Object.fromEntries(Object.entries(fr.stock).filter(([k,v])=>v>1).map(([k,v])=>[k,Math.round(v)])))); } }
    console.log('  causes', JSON.stringify(CAUSE));
    console.log(`day ${d} run${S.meta.runs} known=${S.known} camps=${S.camps.length} furnaces=${fur} people=${S.camps.map(c => c.people).join('/')} bld=${S.buildings.length} temp=${S.camps.map(c => Math.round(c.temp)).join('/')} deaths=${S.stats.deaths} raids=${S.stats.raidsWon}/${S.stats.raids} embers=${S.meta.embers} specs=${Object.keys(S.meta.specs).length} eternal=${S.eternal.stage}`);
  }
}
console.log(timeline.join('\n'));
console.log('INVARIANT violations', invN);
console.log('V11', JSON.stringify(V11), 'gangs', JSON.stringify(S.gangs || {}), 'stats', JSON.stringify({ gangs: S.stats.gangs, sick: S.stats.sick }));
console.log('graduated', S.meta.graduated, 'at', day(), 'wall', (Date.now() - t0) / 1000 + 's');
const c = S.camps[S.camps.length - 1];
console.log('frontier stock', Object.fromEntries(Object.entries(c.stock).map(([k, v]) => [k, Math.round(v)])));
console.log(S.log.slice(-15).map(l => l.msg).join('\n'));
console.log('discovered', S.discovered, 'founded', S.founded, 'scouts', S.scouts.length, 'lodges', S.buildings.filter(b=>b.type==='scout').length);
{ const L = LANDMARKS[1]; const ck = G.checkPlace(S,'furnace',L.x-1,L.row-1); console.log('check founding', ck.reason, ck.cost); }
{ const R=G.rt(S); for (const c of S.camps){ console.log('CAMP',c.name,'ppl',c.people, JSON.stringify(R.c[c.id]).slice(0,300)); const agg={}; for(const b of G.campBuildings(S,c.id)){const br=R.b[b.id]||{}; const k=b.type+':'+(br.status||'-'); agg[k]=(agg[k]||0)+1;} console.log(agg);} }
import fs from 'fs';
fs.writeFileSync(process.env.SAVE || '/tmp/save.json', G.serialize(S));
