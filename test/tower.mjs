// 烽火塔：地基（只在这一站的主营地、一站一座）→ 塔身吃货（缺一种就停、不倒退、搬运工送）→ 点火 → 希望 +5、暖圈 +1；离线按比例；熄火的营地塔照样亮着
import * as G from '../src/sim.js';
import * as WG from '../src/worldgen.js';
import fs from 'fs';
import { BLD, TOWER_FX } from '../src/data.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const load = f => G.deserialize(fs.readFileSync(f, 'utf8'));
const HI = ['part', 'battery', 'alloy', 'core', 'starcore', 'heart'];
function spotFor(S, type) {
  const m = G.mainCamp(S), r = G.heatRadius(S, m);
  for (let d = 3; d <= r; d++) for (let a = 0; a < 64; a++) {
    const x = Math.round(m.x + Math.cos(a / 64 * 6.283) * d - 1.5), y = Math.round(m.y + Math.sin(a / 64 * 6.283) * d - 1.5);
    if (G.checkPlace(S, type, x, y).ok) return { x, y };
  }
  return null;
}
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };

// 规格：第 1–3 座 2 种，4–6 座 3 种，7–9 座 4 种，天火塔 6 种；第一种和这一站的产能目标重叠
{
  const S = G.newRun(G.defaultMeta(), 0, 6061);
  const sp = n => G.towerSpec(S, n);
  ok([1, 2, 3].every(n => sp(n).kinds.length === 2 && sp(n).dur === 600 && sp(n).rate >= 4 && sp(n).rate <= 5), 'towers 1–3: two goods, 4–5/min, 10 min');
  ok([4, 5, 6].every(n => sp(n).kinds.length === 3 && sp(n).dur === 720 && sp(n).rate >= 5 && sp(n).rate <= 6), 'towers 4–6: three goods, 5–6/min, 12 min');
  ok([7, 8, 9].every(n => sp(n).kinds.length === 4 && sp(n).dur === 900 && sp(n).rate >= 6 && sp(n).rate <= 7), 'towers 7–9: four goods, 6–7/min, 15 min');
  ok(sp(10).kinds.length === 6 && sp(10).rate === 6 && sp(10).dur === 1200 && HI.every(k => sp(10).kinds.includes(k)), 'sky-fire tower: all six, 6/min, 20 min');
  ok([...Array(10)].every((_, i) => new Set(sp(i + 1).kinds).size === sp(i + 1).kinds.length && sp(i + 1).kinds[0] === G.northPair(S, i + 1)[0]), 'no good twice; the first one is a rate target of that stop');
  ok(sp(1).fuel.battery && sp(5).fuel.battery && sp(6).fuel.starcore && sp(10).fuel.starcore, 'fuel: batteries for the early towers, star cores later');
}

const S = load('/tmp/v13/north1.json'), J = G.journeyOf(S), m = G.mainCamp(S), N = G.northN(J.stage);
ok(N === 1 && G.unlocked(S, 'pyre') && !G.unlocked(S, 'geowell'), 'north 1: the beacon tower is unlocked');
const sp = G.towerSpec(S, 1);
for (const k of HI) m.stock[k] = 0;
m.stock.steel = 5000; m.stock.alloy = 5000; m.stock.part = 5000;
const p = spotFor(S, 'pyre'), st0 = { ...m.stock };
const r = p && G.place(S, 'pyre', p.x, p.y), b = r && G.getB(S, r.id);
ok(r && r.ok && b.tn === 1 && b.tw.p === 0 && Object.entries(BLD.pyre.cost).every(([k, v]) => st0[k] - m.stock[k] === v), `foundation placed at (${p && p.x},${p && p.y}), cost paid`);
ok(!G.unlocked(S, 'pyre') && !G.checkPlace(S, 'pyre', p.x + 5, p.y).ok, 'only one tower per stop: ' + G.stageLock(S, 'pyre'));
ok(G.upgrade(S, b.id).ok === false, 'towers do not upgrade');
// 只有一种材料：一点都不长
for (const k of HI) m.stock[k] = 0;
m.stock[sp.kinds[0]] = 1000;
run(S, 60);
ok(b.tw.p === 0 && /^缺/.test(G.rt(S).b[b.id].status) && m.stock[sp.kinds[0]] === 1000, `one good missing: no progress, nothing eaten (${G.rt(S).b[b.id].status})`);
ok(G.moveBlock(S, b) === '', 'before feeding the tower can still be moved');
// 都有：每秒长一秒，按速度吃
for (const k of sp.kinds) m.stock[k] = 1000;
run(S, 120);
const ir = G.rt(S).b[b.id].inRate, fl = G.rt(S).c[m.id].flow;
ok(b.tw.p > 100 && b.tw.p <= 120.01 && sp.kinds.every(k => Math.abs(ir[k] - sp.rate) < 1e-6 && fl[k].c >= sp.rate - 1e-6), `fed: ${b.tw.p.toFixed(0)} s of body, eating ${sp.kinds.map(k => k + ' ' + ir[k]).join(', ')}/min (shows in the flow panel)`);
ok(G.moveBlock(S, b) !== '' && G.demolish(S, b.id).ok === false, 'once the body grows it cannot be moved or demolished');
// 断一种：停住，不倒退
const p1 = b.tw.p; m.stock[sp.kinds[1]] = 0; run(S, 60);
ok(b.tw.p === p1, `cut off ${sp.kinds[1]}: body stops at ${p1.toFixed(0)} s, no loss`);
ok(b.tw.cut === 1, 'the shortage before half is remembered');
// 产能目标算毛产量：喂塔不影响
for (const k of sp.kinds) m.stock[k] = 5000;
run(S, sp.dur);
ok(b.tw.p === sp.dur && G.rt(S).b[b.id].status === '塔身建好了，等点火', 'body finished, waiting for fire');
ok(S.log.some(l => /塔身建好了/.test(l.msg)), 'log says the body is done');
// 点火
const h0 = G.heatRadius(S, m);
m.stock.battery = 0;
const c0 = G.towerIgniteCheck(S, b); ok(!c0.ok && /缺/.test(c0.reason), 'no fuel: ' + c0.reason);
m.stock.battery = 500;
const ig = G.igniteTower(S, b.id);
ok(ig.ok && b.tw.lit && G.towerLit(S, 1) && G.towersLit(S) === 1 && m.stock.battery === 500 - sp.fuel.battery, 'lit: fuel paid, tower listed');
ok(G.heatRadius(S, m) === h0 + TOWER_FX.warm, `warm ring +1 (${h0} → ${G.heatRadius(S, m)})`);
ok(G.moodFactors(S, m, G.rt(S).c[m.id]).hope.some(([n, v]) => /烽火塔/.test(n) && v === TOWER_FX.hope), 'hope +5 for this camp');
ok(G.rt(S).fx.some(f => f.kind === 'tower-lit' && f.n === 1), 'light pillar animation queued');
G.step(S, 1);
{ const c = G.chapters(S).at(-1), t = G.chapterDef(S, J.stage).tasks.findIndex(q => q.k === 'tower'); ok(c.tasks[t].ok, 'chapter task 「点亮第 1 座烽火塔」 done'); }
// 存档往返
{ const T = G.deserialize(G.serialize(S)), bt = G.getB(T, b.id); ok(bt.tw.lit && bt.tn === 1 && G.towerLit(T, 1) && G.heatRadius(T, G.mainCamp(T)) === h0 + 1, 'save round trip keeps the tower'); }
// 熄火走人：塔还在名单上，废墟里没有它
{
  const C = G.chapState(S); for (let k = 0; k < 4; k++) C.ok[J.stage + ':' + k] = 1;
  const fill = () => { const mm = G.mainCamp(S); mm.people = Math.max(mm.people, 120); for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore']) mm.stock[k] = 20000; };
  fill(); S.reveal.fill(1); G.rt(S).revealN++; G.dirty(S);
  const P = J.plan || (J.plan = {}); P.mode = {}; for (const c of S.camps) P.mode[c.id] = 'douse';
  const d = G.depart(S); let t = 0; while (d.ok && J.trip && t < 6000) { if (J.trip.road) G.resolveRoad(S, 0); G.step(S, 1); t++; }
  ok(d.ok && G.northN(J.stage) === 2, 'went on to north 2 (old camp doused)');
  ok(!G.getB(S, b.id) && G.towerLit(S, 1) && !J.ruins.at(-1).b.some(q => q[0] === 'pyre'), 'tower stays lit in the list, not in the ruins');
  ok(!G.towerLitAt(S, G.mainCamp(S)) && G.unlocked(S, 'pyre') !== undefined, 'the new camp gets no tower bonus');
}
// 离线：塔身按离线比例长
{
  const T = load('/tmp/v13/north2.json'), mm = G.mainCamp(T), q = spotFor(T, 'pyre');
  mm.stock.steel = 5000; mm.stock.alloy = 5000; mm.stock.part = 5000;
  const rr = G.place(T, 'pyre', q.x, q.y), bb = G.getB(T, rr.id), sq = G.towerSpec(T, 2);
  for (const k of sq.kinds) mm.stock[k] = 5000;
  const secs = 400, rate = G.offlineRate(secs), out = G.catchUp(T, secs);
  ok(Math.abs(bb.tw.p - secs * rate) < 3, `offline ${secs}s at ${(rate * 100).toFixed(0)}%: body +${bb.tw.p.toFixed(0)} s (want ${(secs * rate).toFixed(0)})`);
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
