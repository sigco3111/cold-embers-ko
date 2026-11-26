// 篝火庆典：要人要物资，办的时候产量减半，散场后希望涨、不满降、产量 +15%，冷却一天
import * as G from '../src/sim.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const S = G.newRun(G.defaultMeta(), 0, 515);
const c = S.camps[0];
run(S, 10);
c.people = 10;
ok(/人/.test(G.festBlock(S, c) || ''), `人少：「${G.festBlock(S, c)}」`);
c.people = 40; c.stock.food = 0;
ok(/缺/.test(G.festBlock(S, c) || ''), `没物资：「${G.festBlock(S, c)}」`);
const cost = G.festCost(S, c);
for (const k in cost) c.stock[k] = cost[k] + 100;
ok(/口粮/.test(G.festBlock(S, c) || ''), `办完就不够吃：「${G.festBlock(S, c)}」`);
c.stock.food = cost.food + 400; // 留够半小时口粮
// 等到不是暴风雪
for (let i = 0; i < 400 && G.festBlock(S, c); i++) run(S, 10);
ok(!G.festBlock(S, c), '条件够了');
c.hope = 40; c.disc = 30;
const f0 = { ...c.stock };
ok(G.startFest(S, c.id).ok && c.fest, '开办');
ok(Object.keys(cost).every(k => Math.abs(c.stock[k] - (f0[k] - cost[k])) < 1e-6), `付了 ${JSON.stringify(cost)}`);
ok(G.buffOf(S, c, 'prod') <= -0.49, `办的时候产量 ${G.buffOf(S, c, 'prod')}`);
ok(!G.startFest(S, c.id).ok, '不能同时办两场');
const h0 = c.hope, d0 = c.disc;
run(S, G.FEST_LEN + 4);
ok(!c.fest && S.stats.fests === 1, '散场');
ok(c.hope >= h0 + 10 && c.disc <= d0 - 5, `希望 ${h0.toFixed(0)}→${c.hope.toFixed(0)}，不满 ${d0.toFixed(0)}→${c.disc.toFixed(0)}`);
ok(Math.abs(G.buffOf(S, c, 'prod') - 0.15) < 1e-6, `散场后产量 +${G.buffOf(S, c, 'prod')}`);
ok(/分钟后/.test(G.festBlock(S, c) || ''), `冷却：「${G.festBlock(S, c)}」`);
const S2 = G.deserialize(G.serialize(S));
ok(G.festLeft(S2, S2.camps[0]) > 0, '冷却存档后还在');
run(S, 20);
ok(G.bookOf(S).s.fest, '进了收集册');
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
