// 医务所：病床上的人冷、饿也能好，好得更快；有人守着少病倒；病床上的病人让大家没那么揪心；医生会来投奔
import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';
import { getWorld } from '../src/worldgen.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const mk = (withWard) => {
  const S = G.newRun(G.defaultMeta(), 0, 4242);
  const c = S.camps[0];
  run(S, 6);
  S.known = 2;
  for (const k of ['wood', 'plank', 'stone', 'iron']) c.stock[k] = 999;
  let b = null;
  if (withWard) {
    let at = null;
    for (let y = Math.floor(c.y - 10); y <= c.y + 10 && !at; y++) for (let x = Math.floor(c.x - 10); x <= c.x + 10 && !at; x++) if (G.checkPlace(S, 'infirmary', x, y).ok) at = [x, y];
    b = G.getB(S, G.place(S, 'infirmary', at[0], at[1]).id);
  }
  c.auto = false; c.people = Math.max(c.people, 30);
  if (b) b.workers = G.maxWorkers('infirmary', b.lvl);
  return { S, c, b };
};
// 冷天：体感低于 2°，病人不会自己好
const cold = (S, c) => { S.camps[0].sick = 6; };
const A = mk(true), B = mk(false);
ok(G.wardBeds(1) === 4 && G.wardBeds(5) === 12, `病床 1 级 ${G.wardBeds(1)}、5 级 ${G.wardBeds(5)}`);
for (const X of [A, B]) { X.c.sick = 6; X.c.stock.food = 999; }
// 把外面变冷：让熔炉灭掉（没燃料）
for (const X of [A, B]) X.c.buffs = [{ k: 'heat', v: -30, until: 1e9, n: '测试寒潮' }];
const s0A = A.c.sick, s0B = B.c.sick;
run(A.S, 60); run(B.S, 60);
const tH = G.rt(B.S).c[B.c.id].tH;
ok(tH < 2, `外面冷（体感 ${tH.toFixed(1)}°）`);
ok(A.c.sick < B.c.sick - 1.5 && B.c.sick > s0B, `一分钟后：有医务所 ${A.c.sick.toFixed(2)} 个病人，没有 ${B.c.sick.toFixed(2)} 个`);
ok(G.rt(A.S).c[A.c.id].treated > 0, `病床上有人：${G.rt(A.S).c[A.c.id].treated.toFixed(2)}`);
const st = G.rt(A.S).b[A.b.id].status;
ok(st === '运转中', `医务所状态「${st}」`);
// 少病倒：同样冷，新病倒的人少
const n0 = G.wardOf(A.S, A.c);
ok(Math.abs(n0.guard - 1) < 1e-9 && n0.beds === 4, `值守 ${n0.guard}，病床 ${n0.beds}`);
// 没派人：没有效果
A.b.workers = 0; run(A.S, 2);
ok(G.wardOf(A.S, A.c).beds === 0 && G.rt(A.S).b[A.b.id].status === '没有派人', '没派人就没有病床');
A.b.workers = G.maxWorkers('infirmary', 1);
// 心情：病床上的病人只算一半
{ const C = mk(true), cr = G.rt(C.S).c[C.c.id]; C.c.sick = 4; run(C.S, 2); const m = G.moodFactors(C.S, C.c, G.rt(C.S).c[C.c.id]).hope.find(f => f[0] === '病人');
  const D = mk(false); D.c.sick = 4; run(D.S, 2); const m2 = G.moodFactors(D.S, D.c, G.rt(D.S).c[D.c.id]).hope.find(f => f[0] === '病人');
  ok(m && m2 && m[1] > m2[1], `病人带来的失望：有医务所 ${m && m[1]}，没有 ${m2 && m2[1]}`); }
// 医生：开张、有人守着，3 分钟后来投奔
{ const E = mk(true); ok(!E.S.meta.specs.he, '一开始没有医生');
  run(E.S, G.DOC_AFTER + 4);
  ok(!!E.S.meta.specs.he, '医生来了');
  const logs = E.S.log.filter(l => l.msg && l.msg.includes('何大夫')); ok(logs.length === 1, '日志里有一条');
  // 安排到医务所：康复更快
  G.assignSpec(E.S, 'he', E.b.id);
  ok(G.wardOf(E.S, E.c).care > 1.2, `医生让医护水平 ${G.wardOf(E.S, E.c).care.toFixed(2)}`);
  run(E.S, 200); ok(E.S.log.filter(l => l.msg && l.msg.includes('何大夫')).length === 1, '不会再来一次'); }
// 新地图不多出一个专家点
{ const S = G.newRun(G.defaultMeta(), 0, 4242); ok(!getWorld(S.runSeed).pois.some(p => p.kind === 'spec' && p.spec === 'he'), '地图上没有医生的点'); }
// 存读档
{ const S2 = G.deserialize(G.serialize(A.S)); ok(G.wardOf(S2, S2.camps[0]).beds === 4, '存读档后病床还在'); }
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
