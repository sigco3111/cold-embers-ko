// 燃料留给熔炉：工厂和烽火塔塔身不把营地的燃料吃到熔炉 10 分钟用量以下
import * as G from '../src/sim.js';
import fs from 'fs';
import { FUEL } from '../src/data.js';
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const S = G.deserialize(fs.readFileSync('/tmp/v13/north1.json', 'utf8')), m = G.mainCamp(S);
// 只剩晶体电池当燃料，合金厂、自动机核心厂都要吃电池
for (const k of ['wood', 'coal', 'coke']) m.stock[k] = 0;
m.stock.battery = 150; m.stock.crystal = 9999; m.stock.steel = 9999; m.stock.part = 9999; m.stock.alloy = 0; m.stock.core = 0;
m.people = Math.max(m.people, 120);
const spot = type => { for (let d = 3; d < 14; d++) for (let a = 0; a < 48; a++) { const x = Math.round(m.x + Math.cos(a / 48 * 6.283) * d - 1), y = Math.round(m.y + Math.sin(a / 48 * 6.283) * d - 1); if (G.checkPlace(S, type, x, y).ok) return [x, y]; } return null; };
for (const t of ['alloyworks', 'alloyworks', 'coreworks', 'coreworks']) { const p = spot(t); const r = p && G.place(S, t, p[0], p[1]); if (r && r.ok) G.getB(S, r.id).workers = G.maxWorkers(t, 1); }
G.step(S, 1);
const cr = () => G.rt(S).c[m.id], keepU = () => cr().burnPerMin * G.FUEL_KEEP_MIN;
let minU = 1e9, stopped = null;
for (let t = 0; t < 2400; t++) { G.step(S, 1); const u = G.fuelUnitsOf(m.stock); minU = Math.min(minU, u); const b = S.buildings.find(b => b.camp === m.id && b.type === 'alloyworks'); const st = G.rt(S).b[b.id]?.status; if (st === G.FUEL_KEEP_WHY && !stopped) stopped = { t, u, keep: keepU() }; if (u < 1) break; }
ok(stopped && Math.abs(stopped.u - stopped.keep) < cr().burnPerMin * 0.2, `factories stop at the reserve: ${stopped && Math.round(stopped.u)} units vs keep ${stopped && Math.round(stopped.keep)} (status 「${G.FUEL_KEEP_WHY}」)`);
ok(G.rt(S).c[m.id].fueled > 0.99 || m.stock.battery < 1, 'the furnace keeps burning what is left');
// 有别的燃料兜底时，电池照常给工厂用
{
  const T = G.deserialize(fs.readFileSync('/tmp/v13/north1.json', 'utf8')), n = G.mainCamp(T);
  n.stock.coal = 99999; n.stock.battery = 50;
  ok(G.fuelKeep(n.stock, 'battery', 3000) === 0, 'plenty of coal: batteries are free to use');
  n.stock.coal = 0; n.stock.wood = 0; n.stock.coke = 0;
  ok(Math.abs(G.fuelKeep(n.stock, 'battery', 3000) - 3000 / FUEL.battery) < 1e-6, 'only batteries left: keep 10 minutes of them');
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
