// 1.0.0 新手前 30 分钟：伐木跟得上熔炉时不报燃料警告；锯木厂在等木材（留料、留燃料）时，老向导说补伐木场，不说再建锯木厂；真断燃料时照样报
import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const S = G.newRun(G.defaultMeta(), 0, 777);
S.meta.tut = true;
const main = () => G.mainCamp(S);
function spot(type) {
  const c = main(), r = G.heatRadius(S, c) + 1; let best = null, bs = -1e9;
  for (let y = Math.floor(c.y - r); y <= c.y + r; y++) for (let x = Math.floor(c.x - r); x <= c.x + r; x++) {
    const ck = G.checkPlace(S, type, x, y); if (!ck.ok || ck.camp !== c.id) continue;
    let sc = -ck.dist * 2; if (BLD[type].gather) { if (!ck.spots) continue; sc += ck.spots * 4; }
    if (sc > bs) { bs = sc; best = [x, y]; }
  }
  return best;
}
const build = t => { const p = spot(t); return p ? G.place(S, t, p[0], p[1]) : { ok: false }; };
for (const t of ['lumber', 'tent', 'hunter', 'kitchen']) ok(build(t).ok, 'tutorial build ' + t);
for (let i = 0; i < 12; i++) G.step(S, 10);
const cr = () => G.rt(S).c[main().id];
ok(main().stock.wood < 2.5 * 30, `wood stock is low (${Math.round(main().stock.wood)}): under 30 min of burn, the old fuel pill showed red`);
ok(G.fuelLeft(cr()) === Infinity, 'lumber keeps up with the furnace: fuelLeft is Infinity');
let a = G.advisor(S);
ok(!a || a.kind !== 'fuel', 'no fuel warning while income covers the burn: ' + (a && a.text));
// 锯木厂在等木材
main().stock.wood += 52; main().stock.stone += 20;
ok(build('sawmill').ok, 'sawmill placed');
for (let i = 0; i < 6; i++) G.step(S, 10);
const sm = S.buildings.find(b => b.type === 'sawmill'), st = G.rt(S).b[sm.id].status;
ok(st === G.KEEP_WHY || st === G.FUEL_KEEP_WHY, 'sawmill waits for wood: ' + st);
a = G.advisor(S);
ok(a && /伐木场/.test(a.text) && /攒过 \d+ 份/.test(a.text) && !/再建 \d+ 座锯木厂/.test(a.text), 'advisor points at lumber camps and the reserve: ' + (a && a.text));
// 木材够了：锯木厂开工，老向导改说别的
main().stock.wood = 300;
for (let i = 0; i < 6; i++) G.step(S, 10);
ok(G.rt(S).b[sm.id].status === '运转中', 'sawmill runs once wood passes the reserve: ' + G.rt(S).b[sm.id].status);
a = G.advisor(S);
ok(a && !/攒过/.test(a.text), 'advice moves on: ' + (a && a.text));
ok(!a || !/再建 \d+ 座，/.test(a.text), 'build advice names the building');
// 真断燃料：伐木场没人，木材见底
for (const b of S.buildings) if (b.type === 'lumber') { b.workers = 0; b.noAuto = true; }
main().auto = false; main().stock.wood = 3; // 闲人还会捡点柴火，所以只剩几份
G.step(S, 1); G.step(S, 1);
const fl = G.fuelLeft(cr());
ok(fl < 10, `fuelLeft drops below 10 min without lumberjacks (${fl.toFixed ? fl.toFixed(1) : fl})`);
a = G.advisor(S);
ok(a && a.kind === 'fuel' && /伐木场/.test(a.text), 'fuel warning when the burn outruns income: ' + (a && a.text));
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
