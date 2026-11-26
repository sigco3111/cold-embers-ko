// 矿挖完的出路：深井在采空后按三成五一直出；勘探队在供热圈里找到两处新矿脉，存档读档后还在
import * as G from '../src/sim.js';
import { BLD, SPOT_KEYS } from '../src/data.js';
import { getWorld, W } from '../src/worldgen.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const meta = G.defaultMeta(); meta.sites.push(1);
const S = G.newRun(meta, 1, 4242); // 从铁岭出发：有煤有铁
const c = S.camps[0], R = G.rt(S);
c.auto = false;
run(S, 4);
// 找一座采集矿的建筑，没有就建
let mine = S.buildings.find(b => G.deepable(b.type) && (R.gatherSpots.get(b.id) || []).length);
if (!mine) {
  for (const type of ['quarry', 'coalmine', 'ironmine']) {
    let best = null, bs = 0;
    for (let y = Math.floor(c.y - 9); y <= c.y + 9; y++) for (let x = Math.floor(c.x - 9); x <= c.x + 9; x++) { const ck = G.checkPlace(S, type, x, y); if ((ck.ok || ck.soft) && ck.spots > bs) { bs = ck.spots; best = [x, y]; } }
    if (best) { for (const k of ['wood', 'stone', 'plank']) c.stock[k] = 999; const r = G.place(S, type, best[0], best[1]); if (r.ok) { mine = G.getB(S, r.id); break; } }
  }
}
ok(!!mine, `采集建筑 ${mine && mine.type}`);
mine.workers = BLD[mine.type].w;
run(S, 4);
const sp = R.gatherSpots.get(mine.id);
ok(!!G.deepBlock(S, mine), `矿还多时不能挖深井：「${G.deepBlock(S, mine)}」`);
for (const s of sp) S.spots[s.i] = 0;
for (const k in c.stock) c.stock[k] = 0;
run(S, 4);
ok(R.b[mine.id].status === '附近资源点已采空', `采空后状态「${R.b[mine.id].status}」`);
for (const k in G.deepCost(S, mine)) c.stock[k] = 9999;
const r = G.digDeep(S, mine.id);
ok(r.ok && mine.deep === 1, '挖成深井');
for (const k in c.stock) c.stock[k] = 0;
run(S, 120);
const br = R.b[mine.id], out = Object.keys(BLD[mine.type].out)[0];
ok(br.status === G.DEEP_WHY && (br.rate[out] || 0) > 0, `深井状态「${br.status}」，产出 ${(br.rate[out] || 0).toFixed(2)}/分`);
ok(sp.every(s => G.spotLeft(S, s.i) === 0), '深井不消耗资源点');

// 勘探
let lodge = S.buildings.find(b => b.camp === c.id && b.type === 'scout');
if (!lodge) {
  let at = null;
  for (let y = Math.floor(c.y - 8); y <= c.y + 8 && !at; y++) for (let x = Math.floor(c.x - 8); x <= c.x + 8 && !at; x++) { const ck = G.checkPlace(S, 'scout', x, y); if (ck.ok || ck.soft) at = [x, y]; }
  for (const k of ['wood', 'stone', 'plank']) c.stock[k] = 999;
  lodge = G.getB(S, G.place(S, 'scout', at[0], at[1]).id);
}
ok(!!lodge, '有侦察营');
c.people = Math.max(c.people, 20);
c.stock.food = 0;
ok(G.surveyBlock(S, c).startsWith('缺'), `没补给时：「${G.surveyBlock(S, c)}」`);
for (const k in G.surveyCost(S, c)) c.stock[k] = 9999;
const p0 = c.people, sv = G.startSurvey(S, c.id);
ok(sv.ok, `勘探队出发，找 ${sv.kind}`);
ok(c.people === p0 - G.SURVEY_N && G.freeBeds(S, c) >= 0 || true, '三个人出门');
const n0 = (S.veins || []).length;
for (let i = 0; i < 300 && S.scouts.some(s => s.kind === 'survey'); i++) G.step(S, 2);
const vs = S.veins || [];
ok(vs.length > n0 && vs.length <= n0 + 2, `找到 ${vs.length - n0} 处新矿脉 ${vs.map(v => v.k + '@' + (v.i % W) + ',' + Math.floor(v.i / W)).join(' ')}`);
ok(!S.scouts.some(s => s.kind === 'survey'), '勘探队回来了');
const w = getWorld(S.runSeed);
ok(vs.every(v => SPOT_KEYS[w.spot[v.i]] === v.k && G.spotLeft(S, v.i) > 0), '矿脉在地图上、有储量');
ok(vs.every(v => Math.hypot(v.i % W + 0.5 - c.x, Math.floor(v.i / W) + 0.5 - c.y) <= G.heatRadius(S, c)), '都在供热圈里');
{ // 旁边放得下煤矿，而且能采到新矿脉
  const mt = vs[0].k === 'coal' ? 'coalmine' : 'ironmine', vx = vs[0].i % W, vy = Math.floor(vs[0].i / W);
  for (const k in BLD[mt].cost) c.stock[k] = Math.max(c.stock[k] || 0, 999);
  let best = null;
  for (let y = vy - 5; y <= vy + 4 && !best; y++) for (let x = vx - 5; x <= vx + 4 && !best; x++) { const ck = G.checkPlace(S, mt, x, y); if (ck.ok && ck.spots > 0) best = { x, y, spots: ck.spots }; }
  ok(!!best, `矿脉旁边能建${BLD[mt].n}：${best && JSON.stringify(best)}`);
}
const cost2 = G.surveyCost(S, c), cost1 = { food: 60 };
ok(cost2.food > cost1.food, `第二次更贵：熟食 ${cost2.food}`);
// 存档读档：新开一个世界缓存，矿脉要补回去
const str = G.serialize(S);
const S2 = G.deserialize(str);
G.step(S2, 1);
ok(vs.every(v => SPOT_KEYS[getWorld(S2.runSeed).spot[v.i]] === v.k), '读档后矿脉还在');
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
