// 商队带来的流浪者：口粮撑不住时不收（手动、临走自动交货都一样），口粮够了照常收
import * as G from '../src/sim.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const S = G.newRun(G.defaultMeta(), 0, 4242), c = S.camps[0];
run(S, 6);
const order = () => { S.car = { k: 0, camp: c.id, x: c.x + 5, y: c.y + 5, t: S.t, until: S.t + 5000, orders: [{ kind: 'people', ask: 'wood', n: 50, gn: 3, done: false }] }; };
for (const k of ['wood', 'plank', 'stone']) c.stock[k] = 999;
for (let i = 0; i < 3; i++) { let at = null; for (let y = Math.floor(c.y - 9); y <= c.y + 9 && !at; y++) for (let x = Math.floor(c.x - 9); x <= c.x + 9 && !at; x++) if (G.checkPlace(S, 'tent', x, y).ok) at = [x, y]; G.place(S, 'tent', at[0], at[1]); }
for (const b of S.buildings) if (b.type === 'tent') b.built = 1, b.prog = 1;
run(S, 4); c.stock.wood = 500; ok(G.freeBeds(S, c) >= 3, `空床位 ${G.freeBeds(S, c)}`);
G.rt(S).c[c.id].foodNet = 5; c.stock.food = 2;
order(); ok(/口粮/.test(G.orderBlock(S, 0)), `没口粮：${G.orderBlock(S, 0)}`);
c.stock.food = 500; G.rt(S).c[c.id].foodNet = -1;
order(); ok(/口粮/.test(G.orderBlock(S, 0)), `口粮在往下掉：${G.orderBlock(S, 0)}`);
G.rt(S).c[c.id].foodNet = 5; c.stock.food = 500;
order(); const why = G.orderBlock(S, 0); ok(!why, `口粮够、床位够：${why || "可以收"}`);
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
