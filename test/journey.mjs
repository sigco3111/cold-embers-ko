// 一路往北：门槛、探路、出发、路上、到达、熄火和补给站、前哨范围（纯逻辑）
import * as G from '../src/sim.js';
import { LANDMARKS } from '../src/data.js';
import { getWorld, idx, W } from '../src/worldgen.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };

const S = G.newRun(G.defaultMeta(), 0, 777);
const J = G.journeyOf(S);
ok(J.stage === 0 && J.main === S.camps[0].id, 'new run starts at stage 0 with the first camp as main');
let g = G.departGate(S);
ok(g && g.items.length === 4 && !g.ok, 'gate has four items and is closed at start');
console.log(g.items.map(i => `${i.ok ? '✓' : '·'} ${i.t}：${i.sub}`).join('\n'));

// 前哨范围：越过下一个地标不能占
const nx = G.stopOf(S, 1);
const main = G.mainCamp(S);
main.people = 40;
for (const k of ['wood', 'stone', 'plank', 'food', 'coal']) main.stock[k] = 5000;
S.reveal.fill(1);
G.rt(S).revealN = 99; G.dirty(S);
const near = G.checkPlace(S, 'furnace', nx.x - 1, nx.y - 3);
ok(!near.ok && /范围/.test(near.reason), 'cannot found a camp at the next landmark: ' + near.reason);
// 找一块合法的前哨位置
let spot = null;
for (let y = 30; y < 40 && !spot; y++) for (let x = 2; x < W - 4; x++) { const c = G.checkPlace(S, 'furnace', x, y); if (c.ok) { spot = [x, y, c]; break; } }
ok(!!spot, 'an outpost spot between the main camp and the next landmark is allowed');
if (spot) {
  const food0 = main.stock.food;
  const r = G.place(S, 'furnace', spot[0], spot[1]);
  ok(r.ok, 'outpost placed');
  ok(food0 - main.stock.food >= spot[2].kit.food, `outpost kit takes food scaled by distance (${spot[2].kit.food} food, ${spot[2].kit.fuel} fuel)`);
  ok(G.journeyOf(S).main === main.id, 'main camp unchanged after an outpost');
  ok(S.founded.length === 1, 'outpost does not count as arriving at a landmark');
}
S.active = main.id;

// 门槛：路、章节、熔炉、车队
const rt = G.routeInfo(S);
ok(rt.ok && rt.len > 30 && rt.path.length >= 2, `route found when map revealed (len ${rt.len.toFixed(1)}, ${rt.path.length} pts)`);
G.getB(S, main.furnace).lvl = 3;
const C = G.chapState(S); for (let k = 0; k < 3; k++) C.ok['0:' + k] = 1;
g = G.departGate(S);
ok(g.items[0].ok && g.items[1].ok && g.items[2].ok && !g.items[3].ok, 'only the caravan is missing: ' + g.items[3].sub);
J.fleet.sled = 20;
g = G.departGate(S);
ok(g.ok, 'gate opens with enough sleds: ' + g.items[3].sub);
const plan = g.plan;
console.log('plan', JSON.stringify({ people: plan.people, veh: plan.veh, load: plan.load, cap: plan.cap, secs: Math.round(plan.secs), need: plan.need }));
ok(plan.secs >= 240 && plan.secs <= 360, 'trip takes 4-6 minutes: ' + Math.round(plan.secs));

// 老主营地熄火，前哨留守
const out = S.camps.find(c => c.id !== main.id);
G.setCampMode(S, main.id, 'douse');
const ppl0 = S.camps.reduce((a, c) => a + c.people, 0);
const emb0 = S.meta.embers;
const d = G.depart(S);
ok(d.ok, 'depart ok ' + (d.reason || ''));
ok(J.trip && J.trip.phase === 'go', 'trip on the road');
ok(main.people === G.CREW, 'doused main keeps a crew of ' + G.CREW + ' until arrival: ' + main.people);
// 路上
let n = 0;
while (J.trip && J.trip.phase === 'go' && n < 2000) { G.step(S, 1); n++; }
ok(J.trip && J.trip.phase === 'arrive', `caravan arrived after ${n}s`);
const spotA = G.arriveSpot(S);
ok(!!spotA, 'a recommended furnace spot exists ' + JSON.stringify(spotA));
for (let i = 0; i < 100 && J.trip; i++) G.step(S, 1);
ok(!J.trip && J.stage === 1, 'auto-placed after waiting; stage is 1');
const nm = G.mainCamp(S);
ok(nm.name === LANDMARKS[1].n && G.getB(S, nm.furnace).lvl === 3, 'new main at 铁岭 with furnace lvl 3');
ok(!S.camps.find(c => c.id === main.id), 'doused camp removed');
ok(J.ruins.length === 1, 'ruin left on the map');
ok(S.meta.embers > emb0, `embers gained ${S.meta.embers - emb0}`);
ok(out ? out.depot === true : true, 'kept outpost becomes a supply depot');
ok(S.founded.includes(1), 'chapter 2 started');
const ppl1 = S.camps.reduce((a, c) => a + c.people, 0);
ok(Math.abs(ppl1 - ppl0) <= 3, `people preserved (${ppl0} → ${ppl1})`);
ok(S.buildings.some(b => b.camp === nm.id && b.type === 'tent'), 'tents pitched on arrival');
// 新营地范围跟着往北挪
const r2 = G.outpostRange(S);
ok(r2.y1 === G.stopOf(S, 2).y - G.FOUND_DIST - 2, 'outpost range moved to the next leg');
// 存档来回
const S2 = G.deserialize(G.serialize(S));
ok(S2.journey.stage === 1 && S2.journey.main === nm.id, 'journey survives save/load');
// 离线也能到
const T = G.newRun(G.defaultMeta(), 0, 778);
T.reveal.fill(1); G.rt(T).revealN = 5;
const m2 = G.mainCamp(T); m2.people = 30; for (const k of ['wood', 'stone', 'plank', 'food', 'coal']) m2.stock[k] = 5000;
G.getB(T, m2.furnace).lvl = 3; for (let k = 0; k < 3; k++) G.chapState(T).ok['0:' + k] = 1;
T.journey.fleet.sled = 15;
ok(G.depart(T).ok, 'second run departs (old main kept as depot)');
G.catchUp(T, 1200);
ok(T.journey.stage === 1 && !T.journey.trip, 'offline catch-up finishes the trip and places the furnace');
ok(T.camps.find(c => c.id === m2.id)?.depot === true && T.camps.find(c => c.id === m2.id).people >= G.DEPOT_MIN, 'old main stays as depot with ≥10 people');
// 老存档转换
const O = G.newRun(G.defaultMeta(), 0, 779);
delete O.journey; O.t = 100;
ok(G.journeyOf(O).stage === 0 && G.journeyOf(O).main === O.camps[0].id, 'old save converts');
// 没通关不能重开
ok(G.migrate(S) === S, 'no reset before graduation');
// 雪橇棚：排队、派人才造、撤单退料、存档带着队列
{
  const V = G.newRun(G.defaultMeta(), 0, 780); V.reveal.fill(1); G.rt(V).revealN = 5;
  const c = G.mainCamp(V); c.people = 30; for (const k of ['wood', 'stone', 'plank', 'food', 'coal']) c.stock[k] = 5000;
  let at = null; for (let y = Math.floor(c.y) - 6; y <= c.y + 6 && !at; y++) for (let x = Math.floor(c.x) - 6; x <= c.x + 6 && !at; x++) if (G.checkPlace(V, 'sledshed', x, y).ok) at = [x, y];
  ok(at && G.place(V, 'sledshed', at[0], at[1]).ok, 'sled shed can be placed');
  const b = V.buildings[V.buildings.length - 1]; b.workers = 0;
  for (let i = 0; i < 12; i++) G.step(V, 1);
  ok(b.workers === 0, 'an empty shed gets no workers from auto staffing');
  c.auto = false;
  const w0 = c.stock.wood, f0 = V.journey.fleet.sled || 0;
  ok(G.orderVeh(V, b.id, 'sled', 3).n === 3 && c.stock.wood === w0 - 180, 'three sleds queued and paid');
  ok(/拖车|以后/.test(G.vehBlock(V, b, 'tractor')), 'tractor locked before stage 2: ' + G.vehBlock(V, b, 'tractor'));
  for (let i = 0; i < 120; i++) G.step(V, 1);
  ok((V.journey.fleet.sled || 0) === f0 && b.vq.length === 3, 'no workers, no progress');
  c.auto = true; for (let i = 0; i < 6; i++) G.step(V, 1);
  ok(b.workers === G.maxWorkers(b.type, b.lvl), 'auto staffing fills a shed with orders');
  const p0 = b.vq[0].p;
  const V2 = G.deserialize(G.serialize(V));
  ok(G.getB(V2, b.id).vq.length === 3, 'queue survives save/load');
  for (let i = 0; i < 100 - Math.round(p0 * 45); i++) G.step(V, 1);
  ok((V.journey.fleet.sled || 0) === f0 + 2 && b.vq.length === 1, 'full crew builds a sled every 45 s: fleet ' + V.journey.fleet.sled);
  const w1 = c.stock.wood; G.cancelVeh(V, b.id, 0);
  ok(b.vq.length === 0 && c.stock.wood === w1 + 60, 'cancel refunds the materials');
  { c.stock.wood = c.stock.plank = 5000; const r = G.orderVeh(V, b.id, 'sled', 20); ok(r.n === G.VQ_MAX && /最多/.test(r.reason), 'queue capped at ' + G.VQ_MAX + ': ' + r.n + ' ' + r.reason); }
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
