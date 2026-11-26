// 离线收益：分段入库、12 小时封顶、三星产线多拿一半、最多填到仓库八成
import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b) => Math.abs(a - b) < 1e-9;
ok(near(G.offlineRate(1800), 0.4) && near(G.offlineRate(3600), 0.4), '前 1 小时 40%');
ok(near(G.offlineRate(4 * 3600), (0.4 + 0.2 * 3) / 4), '4 小时平均 ' + G.offlineRate(4 * 3600).toFixed(3));
ok(near(G.offlineRate(12 * 3600), (0.4 + 0.6 + 0.8) / 12) && near(G.offlineRate(48 * 3600), G.offlineRate(12 * 3600)), '12 小时封顶 ' + G.offlineRate(12 * 3600).toFixed(3));
// 一局：木板线
function setup() {
  const S = G.newRun(G.defaultMeta(), 0, 777), c = G.mainCamp(S);
  c.people = 30; for (const k of ['wood', 'stone', 'plank', 'food']) c.stock[k] = 3000;
  const spot = type => { const r = G.heatRadius(S, c); let best = null, bs = 1e9; for (let y = Math.floor(c.y - r); y <= c.y + r; y++) for (let x = Math.floor(c.x - r); x <= c.x + r; x++) { const ck = G.checkPlace(S, type, x, y); if (!ck.ok || (BLD[type].gather && !ck.spots)) continue; const d = Math.hypot(x - c.x, y - c.y) - (ck.spots || 0); if (d < bs) { bs = d; best = [x, y]; } } return best; };
  for (const t of ['tent', 'tent', 'tent', 'tent', 'tent', 'tent', 'hunter', 'hunter', 'kitchen', 'lumber', 'lumber', 'lumber', 'sawmill', 'sawmill', 'warehouse']) { const p = spot(t); if (p) G.place(S, t, p[0], p[1]); }
  for (const b of S.buildings) if (b.type === 'sawmill' || b.type === 'lumber') { b.lvl = 3; G.setWorkers(S, b.id, 9); }
  for (const b of S.buildings) if (b.type === 'hunter' || b.type === 'kitchen') G.setWorkers(S, b.id, 9);
  G.dirty(S); c.stock.plank = 0; c.stock.wood = 300;
  for (let i = 0; i < 300; i++) G.step(S, 1);
  return { S, c };
}
{ const { S, c } = setup(); const p0 = c.stock.plank; const m0 = S.stats.prod.plank || 0;
  const A = JSON.parse(G.serialize(S));
  // 在线 20 分钟
  for (let i = 0; i < 1200; i++) G.step(S, 1);
  const on = c.stock.plank - p0;
  const T = G.deserialize(JSON.stringify(A)), tc = G.mainCamp(T);
  const sum = G.catchUp(T, 1200);
  const off = tc.stock.plank - p0;
  console.log('online +', on.toFixed(0), 'offline +', off.toFixed(0), 'rate', sum.rate, JSON.stringify(sum.lines.map(l => ({ r: l.r, got: Math.round(l.got), rk: l.rk }))));
  ok(on > 50 && Math.abs(off - on * 0.4) < Math.max(5, on * 0.08), '离线 20 分钟木板约是在线的 40%');
}
{ const { S, c } = setup(); const L = G.lineOf(S, 'plank'); L.star = 3; G.dirty(S);
  const p0 = c.stock.plank; const sum = G.catchUp(S, 1200);
  ok(near(G.offlineRateOf(S, 'plank', 0.4), 0.6) && near(G.offlineRateOf(S, 'wood', 0.4), 0.4), '三星产线前 1 小时按 60%');
  ok(near(sum.lines.find(l => l.r === 'plank').rk, 0.6), '报告里写三星按 60%');
}
{ const { S, c } = setup(); const cap = G.storeCap(S, c); const t0 = S.t;
  const sum = G.catchUp(S, 30 * 3600);
  ok(S.t - t0 === 12 * 3600 && sum.capped && sum.secs === 30 * 3600, '离开 30 小时只算 12 小时');
  const over = Object.keys(c.stock).filter(k => c.stock[k] > cap * G.OFF_FILL + 1);
  console.log('cap', cap, 'plank', Math.round(c.stock.plank), 'wood', Math.round(c.stock.wood));
  ok(!over.filter(k => k !== 'food' && k !== 'stone').length, '离线入库最多填到仓库八成 ' + over.join(','));
  ok(c.stock.plank > cap * 0.3, '12 小时的木板能攒到不少 ' + Math.round(c.stock.plank));
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
