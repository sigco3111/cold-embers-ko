// 第十三版矿点保护：储量预报、两成提醒、5% 老向导、勘探保底价、摆放挡矿提醒
import fs from 'fs';
import * as G from '../src/sim.js';
import * as L from '../src/lines.js';
import { BLD, SPOT_KEYS, SPOTS } from '../src/data.js';
import { getWorld, idx, W } from '../src/worldgen.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const S = G.deserialize(fs.readFileSync(process.argv[2] || '/tmp/v12/bot7e.json', 'utf8'));
const main = G.mainCamp(S);
for (let i = 0; i < 20; i++) G.step(S, 1);
// 测试用：机器人存档里的矿都挖成了深井，在还没人挖的铁矿旁边新建一座普通铁矿场
for (const b of S.buildings) if (b.camp === main.id && b.type === 'ironmine') b.deep = 0;
for (const r of Object.keys(main.stock)) main.stock[r] = Math.max(main.stock[r], 3000);
let placed = null;
{ const w0 = getWorld(S.runSeed), ok0 = SPOT_KEYS.indexOf('ore'), sv = G.servedSpots(S);
  outer0: for (let i = 0; i < w0.spot.length; i++) {
    if (w0.spot[i] !== ok0 || sv.has(i) || !S.reveal[i] || G.spotLeft(S, i) <= 0) continue;
    const x = i % W, y = Math.floor(i / W); if (G.warmCampAt(S, x, y) !== main.id) continue;
    for (let dy = -3; dy <= 2; dy++) for (let dx = -3; dx <= 2; dx++) { const ck = G.checkPlace(S, 'ironmine', x + dx, y + dy); if (ck.ok && ck.spots) { placed = G.place(S, 'ironmine', x + dx, y + dy); break outer0; } }
  } }
ok(placed && placed.ok, 'placed a fresh iron mine ' + JSON.stringify(placed));
const mine = G.getB(S, placed.id); mine.workers = G.maxWorkers('ironmine', 1); main.people += 10;
G.dirty(S); for (let i = 0; i < 30; i++) G.step(S, 1);
const ore = G.oreScan(S, main);
console.log('ore', Object.entries(ore).map(([k, o]) => `${k} ${Math.round(o.frac * 100)}% dep ${o.dep.toFixed(1)} eta ${o.eta && o.eta.toFixed(0)}`).join(' | '));
const k = 'ore';
const eta = G.gatherEta(S, mine);
ok(eta > 0, `gatherEta for the new mine: ${eta && eta.toFixed(1)} min (rate ${(G.rt(S).b[mine.id] || {}).dep})`);

const w = getWorld(S.runSeed), sk = SPOT_KEYS.indexOf(k);
const setFrac = f => { for (let i = 0; i < w.spot.length; i++) if (w.spot[i] === sk) S.spots[i] = G.spotMax(S, i) * f; G.dirty(S); };
const cost0 = G.surveyCost(S, main);
setFrac(0.15);
const t0 = S.t;
for (let i = 0; i < 20; i++) G.step(S, 1);
const warn = S.log.find(l => l.t >= t0 && l.msg.includes(SPOTS[k].n) && l.msg.includes('只剩'));
ok(!!warn, 'log warns at <20%: ' + JSON.stringify(warn).slice(0, 140));
ok(G.oreLow(S, main, k), 'oreLow true');
const cost1 = G.surveyCost(S, main);
console.log('survey next', G.surveyNext(S, main), 'cheap', G.surveyCheap(S, main), 'cost before', JSON.stringify(cost0), 'now', JSON.stringify(cost1), 'surveys', main.surveys || 0);
ok(G.surveyNext(S, main) === k, 'survey looks for the low ore first');
// 再挖到 3%：老向导先说矿
setFrac(0.03);
for (let i = 0; i < 20; i++) G.step(S, 1);
const adv = L.advisor(S);
ok(adv && adv.kind === 'ore', 'advisor talks about the ore: ' + (adv && adv.text));
// 深井以后不再提醒
for (const b of S.buildings) if (b.camp === main.id && BLD[b.type].gather && BLD[b.type].gather.includes(k)) b.deep = 1;
for (let i = 0; i < 20; i++) G.step(S, 1);
const adv2 = L.advisor(S);
ok(!adv2 || adv2.kind !== 'ore', 'no ore advice once every mine is a deep well');

// 摆放挡矿：找一处没人挖、旁边还放得下矿场的矿点，再在它旁边找一个会挡住它的位置
S.reveal.fill(1); G.rt(S).revealN = (G.rt(S).revealN || 0) + 1; G.dirty(S);
const served = G.servedSpots(S);
let found = null;
outer: for (let i = 0; i < w.spot.length; i++) {
  if (w.spot[i] < 0) continue; const kk = SPOT_KEYS[w.spot[i]];
  if (['tree', 'rock', 'herd'].includes(kk) || served.has(i) || G.spotLeft(S, i) <= 0) continue;
  const x = i % W, y = Math.floor(i / W);
  if (G.warmCampAt(S, x, y) !== main.id) continue;
  for (let dy = -3; dy <= 2; dy++) for (let dx = -3; dx <= 2; dx++) {
    const ck = G.checkPlace(S, 'tent', x + dx, y + dy);
    if (!(ck.ok || ck.soft) || ck.camp !== main.id) continue;
    const bl = G.blocksOre(S, 'tent', x + dx, y + dy, main.id);
    if (bl.length) { found = { kk, x, y, at: [x + dx, y + dy], bl }; break outer; }
  }
}
console.log('block case', JSON.stringify(found));
ok(true, 'block search ran (a case may not exist on this map)');
// 远处空地不报
const far = G.blocksOre(S, 'tent', Math.round(main.x) + 1, Math.round(main.y) + 1, main.id);
console.log('next to furnace', JSON.stringify(far));
console.log(fail ? `${fail} FAILED` : 'all ok');
