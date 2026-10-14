// 营地专精：熔炉 5 级解锁；矿业/农垦/工坊/要塞各强一样弱一样；换专精要等 30 分钟
import * as G from '../src/sim.js';
import { BLD, FOCUS } from '../src/data.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const S = G.newRun(G.defaultMeta(), 0, 4321);
const c = S.camps[0], f = G.getB(S, c.furnace);
for (let i = 0; i < 3; i++) G.step(S, 2);
ok(G.setFocus(S, c.id, 'mine').reason === `熔炉 ${5} 级后才能选专精`, '熔炉不到 5 级不能选');
f.lvl = 5;
ok(G.setFocus(S, c.id, 'mine').ok && c.focus === 'mine', '5 级选了矿业');
ok(G.focusProd(c, 'quarry') === 0.3 && G.focusProd(c, 'kitchen') === -0.1 && G.focusProd(c, 'sawmill') === 0, `矿业：采石 +${G.focusProd(c, 'quarry')} 厨房 ${G.focusProd(c, 'kitchen')} 锯木 ${G.focusProd(c, 'sawmill')}`);
ok(/还要等 30 分钟/.test(G.setFocus(S, c.id, 'farm').reason), '刚选完不能马上换');
S.t += 1801;
ok(G.setFocus(S, c.id, 'craft').ok && G.focusProd(c, 'sawmill') === 0.25 && G.focusProd(c, 'kitchen') === 0 && G.focusProd(c, 'lumber') === -0.1, '工坊：加工 +25%，厨房不算加工，伐木 −10%');
// 实际产量：一座采石场在矿业营地里多产 30%
const prodOf = (focus) => {
  const T = G.newRun(G.defaultMeta(), 0, 4321), tc = T.camps[0];
  for (let i = 0; i < 3; i++) G.step(T, 2);
  G.getB(T, tc.furnace).lvl = 5; tc.people = 30; tc.stock.wood = 2000; tc.stock.food = 2000;
  let at = null;
  for (let y = Math.floor(tc.y - 9); y <= tc.y + 9 && !at; y++) for (let x = Math.floor(tc.x - 9); x <= tc.x + 9 && !at; x++) { const ck = G.checkPlace(T, 'quarry', x, y); if (ck.ok && ck.spots > 0) at = [x, y]; }
  const b = G.getB(T, G.place(T, 'quarry', at[0], at[1]).id); b.workers = G.maxWorkers('quarry', 1);
  if (focus) G.setFocus(T, tc.id, focus);
  G.step(T, 2);
  return G.rt(T).b[b.id].rate.stone;
};
const p0 = prodOf(null), p1 = prodOf('mine'), p2 = prodOf('farm');
ok(Math.abs(p1 / p0 - 1.3) < 0.02 && Math.abs(p2 / p0 - 0.9) < 0.02, `采石场每分钟 ${p0.toFixed(2)}，矿业 ${p1.toFixed(2)}，农垦 ${p2.toFixed(2)}`);
// 要塞：防御、暴风雪、不满
S.t += 1801;
const d0 = G.campDefense(S, c), drop0 = G.slotDrop(S, c, { drop: 20 });
G.setFocus(S, c.id, 'fort');
ok(G.campDefense(S, c) > d0 && G.slotDrop(S, c, { drop: 20 }) < drop0, `要塞：防御 ${d0}→${G.campDefense(S, c)}，暴风雪 ${drop0}→${G.slotDrop(S, c, { drop: 20 })}`);
const mf = G.moodFactors(S, c, G.rt(S).c[c.id]);
ok(mf.disc.some(x => x[0] === '要塞营地' && x[1] < 0), '要塞营地不满 −4');
ok(G.focusProd(c, 'quarry') === -0.05, '要塞所有产量 −5%');
// 存档
const S2 = G.deserialize(G.serialize(S));
ok(S2.camps[0].focus === 'fort' && G.focusLeft(S2, S2.camps[0]) > 0, '存档后专精和冷却都在');
console.log(fails ? `${fails} FAIL` : 'all ok');
