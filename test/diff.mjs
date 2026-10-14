// 难度：轻松 / 标准 / 严酷 改变吃饭、烧火、暴风雪、狼群、建造花费、心情和北迁余烬
import * as G from '../src/sim.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const mk = d => { const m = G.defaultMeta(); if (d) m.diff = d; const S = G.newRun(m, 0, 777); for (let i = 0; i < 5; i++) G.step(S, 2); return S; };
const E = mk('easy'), N = mk(), Hd = mk('hard');
ok(G.diffOf(N).n === '标准' && G.diffOf(E).n === '轻松' && G.diffOf(Hd).n === '严酷', '默认标准');
const cr = S => G.rt(S).c[S.camps[0].id];
ok(cr(E).eatPerMin < cr(N).eatPerMin && cr(N).eatPerMin < cr(Hd).eatPerMin, `每分钟吃 ${cr(E).eatPerMin.toFixed(1)} / ${cr(N).eatPerMin.toFixed(1)} / ${cr(Hd).eatPerMin.toFixed(1)}`);
ok(cr(E).burnPerMin < cr(N).burnPerMin && cr(N).burnPerMin < cr(Hd).burnPerMin, `每分钟烧 ${cr(E).burnPerMin.toFixed(2)} / ${cr(N).burnPerMin.toFixed(2)} / ${cr(Hd).burnPerMin.toFixed(2)}`);
const bc = S => G.buildCost(S, 'tent', S.camps[0].id, S.camps[0].y).wood;
ok(bc(E) < bc(N) && bc(N) < bc(Hd), `帐篷 ${bc(E)} / ${bc(N)} / ${bc(Hd)} 木材`);
const slot = { drop: 20, var: 0.5 };
const dr = S => G.slotDrop(S, S.camps[0], slot), rs = S => G.raidStrength(S, S.camps[0], slot);
ok(dr(E) < dr(N) && dr(N) < dr(Hd), `暴风雪降温 ${dr(E)} / ${dr(N)} / ${dr(Hd)}`);
for (const S of [E, N, Hd]) S.t = 86400;
ok(rs(E) < rs(N) && rs(N) < rs(Hd), `狼群强度 ${rs(E)} / ${rs(N)} / ${rs(Hd)}`);
const hf = S => (G.moodFactors(S, S.camps[0], cr(S)).hope.find(x => x[0].startsWith('难度')) || [0, 0])[1];
ok(hf(E) > 0 && hf(N) === 0 && hf(Hd) < 0, `心情 ${hf(E)} / ${hf(N)} / ${hf(Hd)}`);
for (const S of [E, N, Hd]) { S.t = 7200; S.stats.prod.wood = 50000; }
ok(G.emberGain(E) < G.emberGain(N) && G.emberGain(N) < G.emberGain(Hd), `北迁余烬 ${G.emberGain(E)} / ${G.emberGain(N)} / ${G.emberGain(Hd)}`);
// 北迁后难度保留
const M = G.migrate(Hd, 0);
ok(G.diffOf(M).n === '严酷', '北迁后还是严酷');
console.log(fails ? `${fails} FAIL` : 'all ok');
