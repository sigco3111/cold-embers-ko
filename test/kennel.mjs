// 雪橇犬舍：喂饱、派满人才有狗；狗让侦察队更快、运输线运得更多；没肉就没狗
import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const S = G.newRun(G.defaultMeta(), 0, 4321);
const c = S.camps[0];
run(S, 6);
for (const k of ['wood', 'plank', 'stone']) c.stock[k] = 999;
let at = null;
for (let y = Math.floor(c.y - 8); y <= c.y + 8 && !at; y++) for (let x = Math.floor(c.x - 8); x <= c.x + 8 && !at; x++) if (G.checkPlace(S, 'kennel', x, y).ok) at = [x, y];
const b = G.getB(S, G.place(S, 'kennel', at[0], at[1]).id);
c.auto = false; b.workers = 0;
run(S, 4);
ok(G.dogsOf(S, c.id) === 0 && G.rt(S).b[b.id].status === '没有派人', '没派人没有狗');
{ for (const x of S.buildings) if (x.type === 'kitchen' || x.type === 'hunter') x.workers = 0; c.stock.game = 200; run(S, 4);
  ok(c.stock.game >= 199.9 && !G.rt(S).c[c.id].dogWant, `没人看的犬舍不吃营地的生肉（剩 ${c.stock.game.toFixed(1)}）`); }
c.people = Math.max(c.people, 20); b.workers = 2;
// 关掉别的吃肉的：只看犬舍
for (const x of S.buildings) if (x.type === 'kitchen' || x.type === 'hunter') x.workers = 0;
c.stock.game = 500; run(S, 4);
ok(G.dogsOf(S, c.id) === 4, `派满人、有肉：${G.dogsOf(S, c.id)} 只狗`);
ok(Math.abs(G.dogScout(S, c.id) - 0.2) < 1e-6, `侦察队 +${G.dogScout(S, c.id)}`);
ok(Math.abs(G.rt(S).b[b.id].inRate.game - 2) < 1e-6 && G.rt(S).c[c.id].flow.game.c >= 2, `每分钟吃生肉 ${G.rt(S).b[b.id].inRate.game}，算进物资流水`);
const feed = BLD.kennel.feed; BLD.kennel.feed = 500; // 喂不起
c.stock.game = 0; run(S, 4);
ok(G.dogsOf(S, c.id) < 0.5 && G.rt(S).b[b.id].status === '缺生肉', `没肉：${G.dogsOf(S, c.id).toFixed(2)} 只，「${G.rt(S).b[b.id].status}」`);
BLD.kennel.feed = feed;
c.stock.game = 500; b.lvl = 5; b.workers = G.maxWorkers('kennel', 5); run(S, 4);
ok(G.dogsOf(S, c.id) === G.kennelDogs(5) && G.kennelDogs(5) === 12, `5 级 ${G.dogsOf(S, c.id)} 只`);
ok(G.dogScout(S, c.id) === 0.6, '侦察加成封顶 60%');
// 侦察队实际走得更快
const sp = (dogs) => { const S2 = G.deserialize(G.serialize(S)); const c2 = S2.camps[0]; if (!dogs) S2.buildings = S2.buildings.filter(x => x.type !== 'kennel'); S2.stock; G.step(S2, 1); return S2; };
const A = sp(true), B = sp(false);
for (const X of [A, B]) { X.scouts.push({ camp: X.camps[0].id, kind: 'scout', phase: 'out', x: X.camps[0].x, y: X.camps[0].y, tx: Math.floor(X.camps[0].x), ty: Math.floor(X.camps[0].y) + 40, n: 2, id: 999 }); G.step(X, 10); }
const dA = A.scouts.find(s => s.id === 999).y - A.camps[0].y, dB = B.scouts.find(s => s.id === 999).y - B.camps[0].y;
ok(dA > dB * 1.4, `带狗的侦察队 10 秒走 ${dA.toFixed(2)} 格，不带 ${dB.toFixed(2)} 格`);
// 物流网的路
const l = { id: 1, a: c.id, b: c.id, kind: 'sled', lvl: 1 };
ok(G.roadDogs(S, l) > 0 && G.roadDogs(S, l) <= 0.45 && G.roadCap(S, l) > G.ROAD.sled.cap, `路运力 +${G.roadDogs(S, l).toFixed(2)}`);
ok(G.roadDogs(S, { ...l, kind: 'rail' }) === G.roadDogs(S, l) / 2, '铁路上狗减半');
run(S, 10);
ok(G.bookOf(S).b.kennel, '进了收集册');
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
