// 收集册 + 成就：开局静默补记，之后新东西进册、成就给一次余烬，存档读档和北迁后都还在
import * as G from '../src/sim.js';
import { BLD, RES_KEYS, SPECS } from '../src/data.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 3) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const meta = G.defaultMeta();
const S = G.newRun(meta, 0, 2024);
const R = G.rt(S), c = S.camps[0];
run(S, 6);
const fx0 = R.fx.filter(f => f.kind === 'book'); R.fx = [];
const B = G.bookOf(S);
ok(fx0.length === 1 && fx0[0].first && B.b.furnace && B.l.L0, `开局补记：${fx0[0] && fx0[0].add.map(a => a.join(':')).join(' ')}`);
ok(B.fresh.length === 0, '补记的不算「新」');
// 建一栋伐木场 → 进册 + 成就「第一缕火」
for (const k of ['wood', 'stone', 'plank']) c.stock[k] = 999;
let at = null;
for (let y = Math.floor(c.y - 6); y <= c.y + 6 && !at; y++) for (let x = Math.floor(c.x - 6); x <= c.x + 6 && !at; x++) if (G.checkPlace(S, 'kitchen', x, y).ok) at = [x, y];
const e0 = S.meta.embers;
ok(G.place(S, 'kitchen', at[0], at[1]).ok, '建厨房');
run(S, 4);
const fx1 = R.fx.filter(f => f.kind === 'book'); R.fx = [];
const add1 = fx1.flatMap(f => f.add.map(a => a.join(':')));
ok(add1.includes('b:kitchen') && add1.includes('a:first'), `新进册：${add1.join(' ')}`);
ok(S.meta.embers === e0 + 1, `成就给余烬 ${e0}→${S.meta.embers}`);
ok(B.fresh.includes('b:kitchen') && B.fresh.includes('a:first'), '标成「新」');
run(S, 6);
ok(S.meta.embers === e0 + 1 && !R.fx.some(f => f.kind === 'book' && f.add.some(a => a[1] === 'first')), '不重复给');
G.bookSeen(S, 'b');
ok(!B.fresh.some(f => f.startsWith('b:')) && B.fresh.includes('a:first'), '看过建筑一栏就清掉建筑的「新」');
// 风物：流星
S.stats.surKinds = { meteor: 1 }; run(S, 4);
ok(B.s.meteor, '流星坑进风物');
// 统计
const n = G.bookCount(S);
ok(n.got > 5 && n.all === BLD && true || n.all === Object.keys(BLD).length + RES_KEYS.length + 13 + SPECS.length + G.SIGHTS.length, `收集 ${n.got}/${n.all}，成就 ${n.cats.a[0]}/${n.cats.a[1]}`);
// 存档读档
const S2 = G.deserialize(G.serialize(S));
ok(S2.meta.book && S2.meta.book.b.kitchen && S2.meta.book.a.first, '存档里有收集册');
// 北迁：新一轮还保留
const S3 = G.newRun(S2.meta, 0, 99);
G.step(S3, 3); G.step(S3, 3);
ok(S3.meta.book.b.kitchen && S3.meta.book.a.first && !G.rt(S3).fx.some(f => f.kind === 'book' && f.first), '北迁后还在，不再补记');
// 全部成就的条件都能跑（不抛错）
let bad = 0; for (const a of G.ACH) { try { if (!(a.cur(S, B) >= 0)) throw new Error('cur ' + a.cur(S, B)); } catch (e) { bad++; console.log(a.id, e.message); } }
ok(!bad, `${G.ACH.length} 个成就条件都能算`);
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
