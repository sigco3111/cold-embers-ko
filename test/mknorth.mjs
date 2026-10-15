// 做北境测试存档：从世界之脊一路走到北境第 N 站（NORTH=1..），存到 OUT
import * as G from '../src/sim.js';
import fs from 'fs';
import { DAY_LEN, dayCycle } from '../src/data.js';
const N = +(process.env.NORTH || 1), OUT = process.env.OUT || `/tmp/v13/north${N}.json`, seed = +(process.env.SEED || 6061);
const S = G.newRun(G.defaultMeta(), 0, seed), J = G.journeyOf(S);
S.known = 7; J.stage = G.SPINE; S.meta.ver = 13;
const fill = () => { const m = G.mainCamp(S); m.people = Math.max(m.people, 90); for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore']) m.stock[k] = Math.max(m.stock[k] || 0, 20000); G.getB(S, m.furnace).lvl = Math.max(37, G.getB(S, m.furnace).lvl); };
J.fleet.icebreaker = 10; J.fleet.tractor = 10; J.fleet.sled = 20;
for (let n = 0; n < N; n++) {
  fill();
  for (let s = 0; s <= J.stage; s++) for (let k = 0; k < 3; k++) G.chapState(S).ok[s + ':' + k] = 1;
  S.reveal.fill(1); G.rt(S).revealN = (G.rt(S).revealN || 0) + 1; G.dirty(S);
  const P = G.journeyOf(S).plan || (G.journeyOf(S).plan = {}); P.mode = {}; for (const c of S.camps) P.mode[c.id] = 'douse';
  const d = G.depart(S); if (!d.ok) { console.log('depart failed', d.reason); process.exit(1); }
  let t = 0; while (J.trip && t < 6000) { if (J.trip.road) G.resolveRoad(S, 0); G.step(S, 1); t++; }
}
fill();
// 迷雾：只留营地和走过的路附近
S.reveal.fill(0);
const m = G.mainCamp(S);
G.revealCircle(S, m.x, m.y, 26);
for (const l of J.legs) for (const p of l.path) G.revealCircle(S, p[0], p[1], 5);
G.revealCircle(S, G.stopOf(S, J.stage).x, G.stopOf(S, J.stage).y, 14);
{ const p = dayCycle(S.t).p; const add = ((1.15 - p) % 1) * DAY_LEN; for (let i = 0; i < add; i += 5) G.step(S, 5); } // 走到白天再存，截图看得清
S.savedAt = Date.now();
fs.writeFileSync(OUT, G.serialize(S));
console.log('saved', OUT, G.stopOf(S, J.stage).n, 'rows', S.rows, 'camps', S.camps.length, 'buildings', S.buildings.length, 'camp at', m.x, m.y);
