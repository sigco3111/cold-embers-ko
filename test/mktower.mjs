// 做烽火塔测试存档：从北境第 1 站开始，每站立塔、喂满、点亮，熄火往北走，走到第 N 站（TOWERS=n），存到 OUT
import * as G from '../src/sim.js';
import fs from 'fs';
const N = +(process.env.TOWERS || 2), OUT = process.env.OUT || `/tmp/v13/tw${N}.json`;
const S = G.deserialize(fs.readFileSync('/tmp/v13/north1.json', 'utf8')), J = G.journeyOf(S);
const fill = () => { const m = G.mainCamp(S); m.people = Math.max(m.people, 120); for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore']) m.stock[k] = Math.max(m.stock[k] || 0, 20000); };
function spotFor(type) {
  const m = G.mainCamp(S), r = G.heatRadius(S, m);
  for (let d = 4; d <= r; d++) for (let a = 0; a < 64; a++) { const x = Math.round(m.x + Math.cos(a / 64 * 6.283) * d - 1.5), y = Math.round(m.y + Math.sin(a / 64 * 6.283) * d - 1.5); if (G.checkPlace(S, type, x, y).ok) return { x, y }; }
}
for (let n = 1; n <= N; n++) {
  fill();
  const t = G.towerType(n), p = spotFor(t), r = G.place(S, t, p.x, p.y), b = G.getB(S, r.id);
  b.tw.p = G.towerSpec(S, n).dur; const ig = G.igniteTower(S, b.id); if (!ig.ok) { console.log('ignite failed', ig.reason); process.exit(1); }
  if (n === N) break;
  for (let k = 0; k < 4; k++) G.chapState(S).ok[J.stage + ':' + k] = 1;
  S.reveal.fill(1); G.rt(S).revealN++; G.dirty(S);
  const P = J.plan || (J.plan = {}); P.mode = {}; for (const c of S.camps) P.mode[c.id] = 'douse';
  const d = G.depart(S); if (!d.ok) { console.log('depart failed', d.reason); process.exit(1); }
  let tt = 0; while (J.trip && tt < 6000) { if (J.trip.road) G.resolveRoad(S, 0); G.step(S, 1); tt++; }
}
fill(); G.step(S, 1);
S.reveal.fill(0); const m = G.mainCamp(S); G.revealCircle(S, m.x, m.y, 26); for (const l of J.legs) for (const q of l.path) G.revealCircle(S, q[0], q[1], 5);
for (const t of G.towerList(S)) G.revealCircle(S, t.x, t.y, 8);
S.savedAt = Date.now();
fs.writeFileSync(OUT, G.serialize(S));
console.log('saved', OUT, G.stopOf(S, J.stage).n, 'towers', G.towerList(S).map(t => t.n + '@' + t.x + ',' + t.y).join(' '));
