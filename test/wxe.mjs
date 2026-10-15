// 其他天气：时间表（不撞暴风雪、极寒夜在夜里）、预报、三种效果、提前准备
import * as G from '../src/sim.js';
import { BLD, DAY_LEN } from '../src/data.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const S = G.newRun(G.defaultMeta(), 0, 9090);
// 时间表
const kinds = {}; let clash = 0, night = 0, nCold = 0, order = 0, prevEnd = 0;
for (let k = 0; k < 60; k++) {
  const z = G.wxeSlot(S, k); kinds[z.kind] = (kinds[z.kind] || 0) + 1;
  for (let kb = 0; kb < 80; kb++) { const b = G.blizzardSlot(S, kb); if (z.start < b.end && z.end > b.start) clash++; }
  if (z.kind === 'cold') { nCold++; const p = (z.start / DAY_LEN) % 1; if (Math.abs(p - 0.58) < 1e-6) night++; }
  if (z.start < prevEnd) order++; prevEnd = z.end;
}
ok(clash === 0, `60 场里和暴风雪撞上的：${clash}`);
ok(nCold > 5 && night === nCold, `极寒夜都从天黑开始（${night}/${nCold}）`);
ok(Object.keys(kinds).length === 3, `三种都有：${JSON.stringify(kinds)}`);
ok(order === 0, `前后不重叠（${order}）`);
const z0 = G.wxeSlot(S, 0), again = G.wxeSlot(G.newRun(G.defaultMeta(), 0, 9090), 0);
ok(z0.start === again.start && z0.kind === again.kind, '同一个种子时间表一样');
// 找一场某种天气，把时间拨到它前面
const find = kind => { for (let k = 0; k < 60; k++) { const z = G.wxeSlot(S, k); if (z.kind === kind) return z; } };
const setup = (kind) => {
  const X = G.newRun(G.defaultMeta(), 0, 9090), c = X.camps[0];
  run(X, 6);
  X.known = 3;
  for (const k of ['wood', 'plank', 'stone', 'iron', 'steel', 'gear', 'coal', 'food']) c.stock[k] = 5000;
  const z = find(kind);
  X.t = z.start - G.FORECAST - 5;
  return { X, c, z };
};
// 预报 → 临近 → 开始 → 结束，各一条
{ const { X, c, z } = setup('ice');
  const n0 = X.log.length;
  run(X, 20);
  ok(X.log.slice(n0).some(l => l.msg.includes('气象预报') && l.msg.includes('冰风暴')), '提前一小时预报');
  X.t = z.start - G.WXE_WARN - 3; run(X, 10);
  ok(X.log.some(l => l.msg.includes('冰风暴还有')), '快到时再提醒一次');
  X.t = z.start - 1; run(X, 6);
  ok(X.log.some(l => l.msg.includes('冰风暴来了')), '开始时播报');
  ok(X.stats.wxe && X.stats.wxe.ice === 1, '计数');
  run(X, 6); ok(X.log.filter(l => l.msg.includes('冰风暴来了')).length === 1, '不重复播报');
  X.t = z.end + 1; run(X, 4);
  ok(X.log.some(l => l.msg.includes('冰风暴过去了')), '结束时播报');
  run(X, 4); ok(G.bookOf(X).s['wx:ice'], '进了收集册'); }
// 冰风暴：暖炉冻住、采集慢；准备过的暖炉照常
{ const mk = (prep) => {
    const { X, c, z } = setup('ice');
    let at = null;
    for (let y = Math.floor(c.y - 6); y <= c.y + 6 && !at; y++) for (let x = Math.floor(c.x - 6); x <= c.x + 6 && !at; x++) if (G.checkPlace(X, 'heater', x, y).ok) at = [x, y];
    const h = G.getB(X, G.place(X, 'heater', at[0], at[1]).id); h.workers = G.maxWorkers('heater', 1); c.auto = false;
    run(X, 4);
    if (prep) { X.t = z.start - 600; const r = G.wxePrep(X, c.id); ok(r.ok, `提前「${G.WXE.ice.prep}」：${r.reason || '好了'}`); ok(!G.wxePrep(X, c.id).ok, '不能准备两次'); }
    X.t = z.start + 5; run(X, 4);
    return { X, c, t: G.rt(X).c[c.id].temp };
  };
  const A = mk(false), B = mk(true);
  ok(B.t - A.t > 3, `冰风暴里：没准备 ${A.t.toFixed(1)}°，裹了保温毡 ${B.t.toFixed(1)}°`);
  ok(G.rt(A.X).c[A.c.id].ev.frozen && !G.rt(B.X).c[B.c.id].ev.frozen, '没准备的管子冻住了'); }
{ const { X, c, z } = setup('ice');
  let at = null; for (let y = Math.floor(c.y - 8); y <= c.y + 8 && !at; y++) for (let x = Math.floor(c.x - 8); x <= c.x + 8 && !at; x++) { const ck = G.checkPlace(X, 'lumber', x, y); if (ck.ok && ck.spots > 0) at = [x, y]; }
  const b = G.getB(X, G.place(X, 'lumber', at[0], at[1]).id); b.workers = 2; c.auto = false; c.stock.wood = 10;
  run(X, 6); const r0 = (G.rt(X).b[b.id].rate || {}).wood || 0;
  X.t = z.start + 5; c.stock.wood = 10; run(X, 6); const r1 = (G.rt(X).b[b.id].rate || {}).wood || 0;
  ok(r0 > 0 && Math.abs(r1 / r0 - G.WXE_ICE_GATHER) < 0.08, `伐木：平时 ${r0.toFixed(2)}，冰风暴 ${r1.toFixed(2)}/分`); }
// 极寒夜：多烧燃料、降温；准备过降温减半
{ const mk = (prep) => { const { X, c, z } = setup('cold'); c.auto = false; run(X, 4);
    if (prep) { X.t = z.start - 300; ok(G.wxePrep(X, c.id).ok, '封好门窗缝'); }
    X.t = z.start - 30; run(X, 10); const b0 = G.rt(X).c[c.id].burnPerMin, t0 = G.rt(X).c[c.id].tH;
    X.t = z.start + 30; run(X, 10); const b1 = G.rt(X).c[c.id].burnPerMin, t1 = G.rt(X).c[c.id].tH;
    return { b0, b1, d: t0 - t1, ev: G.rt(X).c[c.id].ev };
  };
  const A = mk(false), B = mk(true);
  ok(Math.abs(A.b1 / A.b0 - G.WXE_FUEL) < 0.05, `熔炉烧得多：${A.b0.toFixed(2)} → ${A.b1.toFixed(2)}/分`);
  ok(A.d > 2 && A.ev && A.ev.kind === 'cold', `屋里冷了 ${A.d.toFixed(1)}°`);
  ok(Math.abs(B.ev.drop - A.ev.drop / 2) < 0.05, `封好门窗缝：降温 ${A.ev.drop.toFixed(2)} → ${B.ev.drop.toFixed(2)}`); }
// 冰湖开裂：附近有冰湖的营地搬运慢；运输线、侦察队慢
{ const { X, c, z } = setup('crack');
  const ice = G.campIce(X, c);
  console.log('     营地附近冰湖格子', ice);
  const l = { id: 1, a: c.id, b: c.id, kind: 'sled', lvl: 1 };
  X.t = z.start - 30; const cap0 = G.roadCap(X, l);
  X.t = z.start + 30; const cap1 = G.roadCap(X, l);
  ok(Math.abs(cap1 / cap0 - G.WXE_SLOW) < 1e-6, `物流网的路 ${cap0.toFixed(1)} → ${cap1.toFixed(1)}`);
  ok(G.wxeMatters(X, c, z) === ice > 0, '附近有冰湖才需要准备');
  if (!ice) { const r = G.wxePrep(X, c.id); ok(!r.ok && r.reason === '这座营地不用准备', '没冰湖不用准备'); } }
// 存读档：准备过的还算数
{ const { X, c, z } = setup('cold'); X.t = z.start - 100; G.wxePrep(X, c.id); const X2 = G.deserialize(G.serialize(X)); ok(G.wxePrepped(X2, X2.camps[0], z), '存读档后准备还在'); }
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
