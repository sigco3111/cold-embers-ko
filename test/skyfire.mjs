// 天火塔和终章：第 10 站建天火塔（4×4、六种全喂、星核点火）→ 记下「这一路」、终章只放一次 → 往北接着走，不再有塔
import * as G from '../src/sim.js';
import fs from 'fs';
import { BLD } from '../src/data.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const F = '/tmp/v13/tw10x.json';
if (!fs.existsSync(F)) { console.log('FAIL fixture missing: run TOWERS=10 NOLAST=1 node test/mktower.mjs'); process.exit(1); }
const S = G.deserialize(fs.readFileSync(F, 'utf8')), J = G.journeyOf(S), m = G.mainCamp(S);
const fill = () => { const mm = G.mainCamp(S); mm.people = Math.max(mm.people, 120); for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore']) mm.stock[k] = Math.max(mm.stock[k] || 0, 20000); };
function spotFor(type) {
  const c = G.mainCamp(S), r = G.heatRadius(S, c);
  for (let d = 4; d <= r; d++) for (let a = 0; a < 64; a++) { const x = Math.round(c.x + Math.cos(a / 64 * 6.283) * d - 2), y = Math.round(c.y + Math.sin(a / 64 * 6.283) * d - 2); if (G.checkPlace(S, type, x, y).ok) return { x, y }; }
  return null;
}
ok(G.northN(J.stage) === 10 && G.towersLit(S) === 9, 'fixture: north 10, nine towers lit');
ok(G.unlocked(S, 'skyfire') && !G.unlocked(S, 'pyre') && /天火塔/.test(G.stageLock(S, 'pyre')), 'north 10 builds the sky-fire tower, not a beacon: ' + G.stageLock(S, 'pyre'));
ok(BLD.skyfire.size === 4 && BLD.skyfire.tower, 'sky-fire tower is 4×4');
{ const c = G.chapterDef(S, J.stage).tasks.find(t => t.k === 'tower'); ok(c && c.tn === 10 && /天火塔/.test(c.t), 'chapter task: ' + (c && c.t)); }
fill();
const p = spotFor('skyfire'), st0 = { ...m.stock }, r = p && G.place(S, 'skyfire', p.x, p.y), b = r && r.ok && G.getB(S, r.id);
ok(b && b.tn === 10 && Object.entries(BLD.skyfire.cost).every(([k, v]) => Math.abs(st0[k] - m.stock[k] - v) < 1e-6), `placed at (${p && p.x},${p && p.y}), cost paid`);
const sp = G.towerSpec(S, 10);
fill(); for (let t = 0; t < sp.dur + 20; t += 2) { fill(); G.step(S, 2); }
ok(b.tw.p === sp.dur, `body fed in ${sp.dur / 60} min with all six goods`);
const e0 = S.meta.skyfire || 0;
m.stock.starcore = 10; ok(!G.towerIgniteCheck(S, b).ok, 'needs 60 star cores: ' + G.towerIgniteCheck(S, b).reason);
m.stock.starcore = 100; G.rt(S).fx = [];
const ig = G.igniteTower(S, b.id);
const E = S.tower.end;
ok(ig.ok && G.skyEnded(S) && E && !E.seen, 'lit: the run is marked as ended (not seen yet)');
ok(G.rt(S).fx.some(f => f.kind === 'skyfire') && G.rt(S).fx.some(f => f.kind === 'tower-lit' && f.n === 10), 'cinematic queued');
ok(S.meta.skyfire === e0 + 1, 'meta counts the sky fire (titles and rewards hang on it)');
{
  const s = E.sum;
  ok(s.stops === J.stage + 1 && s.north === 10 && s.towers === 10 && s.furnaces >= 11 && s.people > 0 && s.t === S.t && s.runs >= 1, `summary: ${JSON.stringify(s)}`);
}
{ const L = G.towerChain(S); ok(L.length === 11 && L[0].type === 'eternal' && L[0].y === G.ETERNAL_PT.y && L.at(-1).n === 10, 'light chain runs from the eternal furnace to the sky fire'); }
ok(S.log.some(l => /天火塔点着的那一刻/.test(l.msg)), 'ending story in the log');
// 再点一次不会再放终章
{ G.rt(S).fx = []; const again = G.igniteTower(S, b.id); ok(!again.ok && !G.rt(S).fx.some(f => f.kind === 'skyfire'), 'cannot light twice'); }
G.step(S, 1);
{ const c = G.chapters(S).at(-1), t = G.chapterDef(S, J.stage).tasks.findIndex(q => q.k === 'tower'); ok(c.tasks[t].ok, 'chapter task done'); }
// 看完
G.skyfireSeen(S); ok(S.tower.end.seen === 1, 'seen flag set');
{ const T = G.deserialize(G.serialize(S)); ok(G.skyEnded(T) && T.tower.end.seen === 1 && T.tower.end.sum.towers === 10 && G.towerChain(T).length === 11, 'save round trip keeps the ending'); }
// 往北接着走：北境第 11 站没有塔
{
  for (let k = 0; k < 4; k++) G.chapState(S).ok[J.stage + ':' + k] = 1;
  fill(); S.reveal.fill(1); G.rt(S).revealN++; G.dirty(S);
  const P = J.plan || (J.plan = {}); P.mode = {}; for (const c of S.camps) P.mode[c.id] = 'douse';
  const d = G.depart(S); let t = 0; while (d.ok && J.trip && t < 6000) { if (J.trip.road) G.resolveRoad(S, 0); G.step(S, 1); t++; }
  ok(d.ok && G.northN(J.stage) === 11, 'went on to north 11');
  ok(!G.chapterDef(S, J.stage).tasks.some(q => q.k === 'tower') && !G.unlocked(S, 'pyre') && !G.unlocked(S, 'skyfire'), 'north 11: no tower task, no tower to build');
  ok(G.towersLit(S) === 10 && G.skyEnded(S) && !G.rt(S).fx.some(f => f.kind === 'skyfire'), 'all ten still lit, no second ending');
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
