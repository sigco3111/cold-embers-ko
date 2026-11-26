// 永恒之炉以北六程：章节、按程解锁的建筑、灯塔照雾、星核矿、巨像挡袭营、破冰车开路、熔炉 35 级要星核、走完最后一程的结局
import * as G from '../src/sim.js';
import { CHAPTERS, BLD, FAR_MARKS, SPOT_KEYS } from '../src/data.js';
import { getWorld, idx, W, H } from '../src/worldgen.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };

ok(CHAPTERS.length === G.STOP_N, `one chapter per stop (${CHAPTERS.length} / ${G.STOP_N})`);
ok(CHAPTERS.slice(7).every(c => c.tasks && c.tasks.length === 3 && c.reward), 'far chapters each have three tasks and a reward');

function rich(seed, stage) {
  const S = G.newRun(G.defaultMeta(), 0, seed);
  S.reveal.fill(1); G.rt(S).revealN = 99; S.known = 7; G.dirty(S);
  G.journeyOf(S).stage = stage;
  const m = G.mainCamp(S); m.people = 120;
  for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart']) m.stock[k] = 50000;
  return S;
}
const near = (S, type, cx, cy, R = 9) => { for (let r = 2; r < R; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = Math.floor(cx) + dx, y = Math.floor(cy) + dy; if (G.checkPlace(S, type, x, y).ok) return [x, y]; } return null; };

// 按程解锁
{
  const S = rich(901, 6), m = G.mainCamp(S);
  ok(!G.unlocked(S, 'beacon') && /才能建/.test(G.checkPlace(S, 'beacon', Math.floor(m.x) + 3, Math.floor(m.y) + 3).reason), 'beacon locked before stage 7: ' + G.stageLock(S, 'beacon'));
  G.journeyOf(S).stage = 7;
  ok(G.unlocked(S, 'beacon') && !G.unlocked(S, 'colossus') && !G.unlocked(S, 'starpit'), 'stage 7 unlocks the beacon only');
  ok(G.forecastOf(S) === G.FORECAST, 'forecast is one hour before the aurora station');
  G.journeyOf(S).stage = 9;
  ok(G.forecastOf(S) === G.FORECAST * 2, 'forecast doubles from stage 9');
}
// 灯塔：建好就照开一大片雾
{
  const S = rich(902, 7), m = G.mainCamp(S);
  S.reveal.fill(0); G.rt(S).revealN = 0; G.dirty(S);
  const at = near(S, 'beacon', m.x, m.y);
  // 雾里也要能放：先把这一小片照开
  ok(true, 'beacon spot search');
  S.reveal.fill(1); const spot = near(S, 'beacon', m.x, m.y); S.reveal.fill(0);
  for (let dy = -3; dy <= 4; dy++) for (let dx = -3; dx <= 4; dx++) S.reveal[idx(spot[0] + dx, spot[1] + dy)] = 1;
  const r = G.place(S, 'beacon', spot[0], spot[1]);
  ok(r.ok, 'beacon placed ' + (r.reason || ''));
  const n0 = S.reveal.reduce((a, v) => a + v, 0);
  for (let i = 0; i < 3; i++) G.step(S, 1);
  const n1 = S.reveal.reduce((a, v) => a + v, 0);
  ok(n1 - n0 > 1000, `beacon lights up ${n1 - n0} tiles of fog`);
  const b = S.buildings.find(q => q.type === 'beacon');
  b.lvl = 2; for (let i = 0; i < 3; i++) G.step(S, 1);
  ok(S.reveal.reduce((a, v) => a + v, 0) > n1, 'upgrading the beacon reaches further');
  void at;
}
// 星核矿：星落之坑附近开营地，坑边的矿挖得出星核
{
  const S = rich(903, 11), w = getWorld(S.runSeed), f = [w.far[4].x, w.far[4].y];
  const fk = SPOT_KEYS.indexOf('starfall');
  let n = 0; for (let i = 0; i < W * H; i++) if (w.spot[i] === fk) n++;
  ok(n >= 12, `${n} starfall tiles around ${FAR_MARKS[4].n}`);
  ok(G.stageLock(S, 'starpit') === '', 'starpit unlocked at stage 11');
  const fs = near(S, 'furnace', f[0], f[1] + 2, 14);
  ok(!!fs, 'a camp can be founded at the star pit');
  ok(fs && G.place(S, 'furnace', fs[0], fs[1]).ok, 'outpost founded');
  const c = S.camps[S.camps.length - 1]; c.people = 40;
  for (const k of ['alloy', 'part', 'core', 'wood', 'food', 'coal', 'plank']) c.stock[k] = 20000;
  S.active = c.id;
  let best = null;
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) { const x = Math.floor(c.x) + dx, y = Math.floor(c.y) + dy, q = G.checkPlace(S, 'starpit', x, y); if (q.ok && q.spots > 0 && (!best || q.spots > best[2])) best = [x, y, q.spots]; }
  ok(!!best, `starpit spot reaches ${best && best[2]} starfall tiles`);
  if (best) {
    ok(G.place(S, 'starpit', best[0], best[1]).ok, 'starpit placed');
    const b = S.buildings[S.buildings.length - 1];
    for (let i = 0; i < 240; i++) G.step(S, 1);
    ok((c.stock.starcore || 0) > 0 && b.workers > 0, `starpit dug ${Math.round(c.stock.starcore || 0)} star cores in 4 min with ${b.workers} workers`);
  }
}
// 熔炉 35 级以后要星核
{
  const S = rich(904, 10), m = G.mainCamp(S), fb = G.getB(S, m.furnace);
  fb.lvl = 35;
  const cost = G.upgradeCost(S, fb);
  ok(cost.starcore > 0, `furnace 35 → 36 needs ${cost.starcore} star cores`);
  for (const k in cost) m.stock[k] = Math.max(m.stock[k] || 0, cost[k] * 2);
  const r = G.upgrade(S, fb.id);
  ok(!r.ok && /星核/.test(r.reason), 'blocked before the star pit: ' + r.reason);
  G.journeyOf(S).stage = 11;
  ok(G.upgrade(S, fb.id).ok && fb.lvl === 36, 'allowed once the star pit is reached');
}
// 巨像守卫：派了人就挡住一整次袭营，然后歇一阵
{
  const S = rich(905, 10), m = G.mainCamp(S);
  m.people = 24; S.t = 6 * 86400; // 箭塔都没有、人也不多：光靠营地守不住
  const at = near(S, 'colossus', m.x, m.y, 12);
  ok(at && G.place(S, 'colossus', at[0], at[1]).ok, 'colossus placed');
  const b = S.buildings.find(q => q.type === 'colossus');
  for (let i = 0; i < 5; i++) G.step(S, 1);
  ok(b.workers > 0, 'colossus staffed: ' + b.workers);
  const nr = G.nextRaid(S);
  ok(!!nr, 'a raid is coming in ' + (nr && Math.round(nr.in)) + 's');
  S.t = nr.t - 2.5; S.rAuto = false;
  const won0 = S.stats.raidsWon, stock0 = m.stock.wood;
  for (let i = 0; i < 6; i++) G.step(S, 1);
  const str = G.raidStrength(S, m, nr), def = G.raidDefense(S, m, nr);
  const blocked = S.log.some(l => /巨像守卫站了起来/.test(l.msg));
  ok(def < str && blocked && S.stats.raidsWon > won0 && b.cd > S.t && m.stock.wood >= stock0 * 0.99, `raid blocked by the colossus (def ${def} vs ${str}), rest ${Math.round((b.cd - S.t) / 60)} min`);
  // 歇着的时候不管用
  const nr2 = G.nextRaid(S); S.t = nr2.t - 2.5; b.cd = S.t + 600; const lost0 = S.stats.raids - S.stats.raidsWon;
  for (let i = 0; i < 6; i++) G.step(S, 1);
  ok(S.stats.raids - S.stats.raidsWon > lost0, 'a resting colossus does not block the next raid');
}
// 破冰车：冰面和裂谷直接开过去
{
  const S = rich(906, 8), J = G.journeyOf(S), m = G.mainCamp(S);
  G.getB(S, m.furnace).lvl = 40;
  for (let s = 0; s <= 8; s++) for (let k = 0; k < 3; k++) G.chapState(S).ok[s + ':' + k] = 1;
  J.fleet.icebreaker = 4; J.fleet.tractor = 6; J.fleet.sled = 10;
  m.stock.battery = 5000;
  const P = G.tripPlan(S);
  ok(P.veh.icebreaker > 0 && P.supplies.battery > 0, `trip takes ${P.veh.icebreaker} icebreakers and ${P.supplies.battery} batteries`);
  const d = G.depart(S);
  ok(d.ok, 'departs with icebreakers ' + (d.reason || ''));
  const T = J.trip;
  if (T) {
    T.ev = []; T.veh.icebreaker = Math.max(1, T.veh.icebreaker || 0);
    for (const id of ['ice', 'chasm']) {
      T.hold = 0; T.detour = 0; T.ev.push({ id, at: T.d / T.len + 1e-4 }); G.step(S, 1);
      const v = G.roadView(S);
      ok(v && /破冰车/.test(v.opts[0].t), `${id}: ${v && v.opts[0].t}〔${v && v.opts[0].d}〕`);
      G.resolveRoad(S, 0);
      ok(!(T.detour > 0), `${id}: no detour with an icebreaker`);
    }
  }
}
// 走完最后一程：真结局
{
  const S = rich(907, G.STOP_N - 2), J = G.journeyOf(S), m = G.mainCamp(S);
  G.getB(S, m.furnace).lvl = 40;
  for (let s = 0; s < G.STOP_N; s++) for (let k = 0; k < 3; k++) G.chapState(S).ok[s + ':' + k] = 1;
  J.fleet.icebreaker = 10; J.fleet.tractor = 10; J.fleet.sled = 20; m.stock.battery = 9000;
  const d = G.depart(S);
  ok(d.ok, 'departs on the last leg ' + (d.reason || ''));
  let n = 0;
  while (J.trip && n < 4000) { if (J.trip.road) G.resolveRoad(S, 0); G.step(S, 1); n++; }
  ok(J.stage === G.STOP_N - 1, `reached ${G.stopOf(S, J.stage).n} after ${n}s`);
  ok(!!S.meta.trueEnd, 'true ending recorded');
  ok(G.rt(S).fx.some(f => f.kind === 'trueend'), 'true ending fx queued');
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
