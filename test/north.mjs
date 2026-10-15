// 北境：地图按段往北接（同一个种子每次一样、世界之脊以南不变）、站点和站名、地标挡建造、从世界之脊一路往北走
import * as G from '../src/sim.js';
import * as WG from '../src/worldgen.js';
import { NORTH_RULE_KEYS, SPOT_KEYS, SPOTS, SPINE_ROW } from '../src/data.js';
const { getWorld, idx, W, northStop, northCampAt, BASE_H, setRows } = WG;

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };

// 站点：第 1 站平坦雪原，十条规则在第 2～11 站各出现一次，连着两站不重复，站名不重复
{
  const L = Array.from({ length: 40 }, (_, i) => northStop(4711, i + 1));
  ok(L[0].rule === 'flat', 'north stop 1 is 平坦雪原');
  ok(new Set(L.slice(1, 11).map(s => s.rule)).size === NORTH_RULE_KEYS.length, 'stops 2–11 cover all ten rules: ' + L.slice(1, 11).map(s => s.rule).join(','));
  ok(L.every((s, i) => !i || s.rule !== L[i - 1].rule), 'no rule twice in a row');
  ok(new Set(L.map(s => s.name)).size === 40, 'forty different names: ' + L.slice(0, 6).map(s => s.name).join(' '));
  ok(L.every((s, i) => Math.abs(s.y - (SPINE_ROW + 80 * (i + 1))) <= 5 && s.x >= 14 && s.x <= 34), 'stops every ~80 rows, away from the map edge');
  ok(L.every(s => [BASE_H, BASE_H + 400, BASE_H + 800, BASE_H + 1200, BASE_H + 1600, BASE_H + 2000].every(b => Math.abs(s.y - b) >= 30)), 'no stop sits on a segment seam');
}
// 按段生成：同一个种子接两次结果一样；世界之脊以南和接之前完全一样
{
  setRows(BASE_H); const a = getWorld(5150), t0 = a.terrain.slice(0, W * 860), s0 = a.spot.slice(0, W * 860), i0 = a.spotInit.slice(0, W * 860);
  setRows(BASE_H + 800); const b = getWorld(5150);
  ok(b.rows === BASE_H + 800 && b.terrain.length === W * (BASE_H + 800), 'world grew by two segments');
  ok(b.terrain.slice(0, W * 860).every((v, i) => v === t0[i]) && b.spot.slice(0, W * 860).every((v, i) => v === s0[i]) && b.spotInit.slice(0, W * 860).every((v, i) => v === i0[i]), 'rows south of 860 unchanged by growing');
  const snap = { t: b.terrain.slice(), s: b.spot.slice(), si: b.spotInit.slice(), sites: JSON.stringify(b.sites), pois: JSON.stringify(b.pois) };
  getWorld(99); setRows(BASE_H + 800); const c = getWorld(5150); // 换个种子再回来：从头生成
  ok(c !== b && c.terrain.every((v, i) => v === snap.t[i]) && c.spot.every((v, i) => v === snap.s[i]) && c.spotInit.every((v, i) => v === snap.si[i]), 'regenerating from scratch gives the same map');
  ok(JSON.stringify(c.sites) === snap.sites && JSON.stringify(c.pois) === snap.pois, 'same sites and points of interest');
  ok(new Set(c.sites.map(s => s.id)).size === c.sites.length && new Set(c.pois.map(s => s.id)).size === c.pois.length, 'site and poi ids stay unique');
  ok(c.north.length === c.north.filter(s => s.y < c.rows).length && c.north.length >= 9, `${c.north.length} north stops inside the generated rows`);
  // 储量不膨胀：北边的资源点和世界之脊一样大
  let mx = 0, my = 0; for (let i = W * 820; i < W * c.rows; i++) if (c.spot[i] >= 0 && SPOT_KEYS[c.spot[i]] === 'ore') { const y = Math.floor(i / W); if (y > 1300) mx = Math.max(mx, c.spotInit[i]); else if (y < 900) my = Math.max(my, c.spotInit[i]); }
  ok(mx > 0 && mx <= 1200 * 1.3 * 6 + 1, `iron reserves stay at the spine level (max ${mx}, near the spine ${my})`);
  // 每站：营地附近每种原料至少两处，营地那块没有石头，地标上不能盖
  for (const s of c.north.slice(0, 9)) {
    const cc = northCampAt(s), have = {};
    for (let y = Math.floor(cc.y - 11.5); y <= cc.y + 11.5; y++) for (let x = 0; x < W; x++) { if (Math.hypot(x + 0.5 - cc.x, y + 0.5 - cc.y) > 11.6) continue; const k = c.spot[idx(x, y)]; if (k >= 0) have[SPOT_KEYS[k]] = (have[SPOT_KEYS[k]] || 0) + 1; }
    const short = SPOT_KEYS.filter(k => !SPOTS[k].nw && !(k === 'tree' && s.rule === 'tundra') && (have[k] || 0) < 2).concat(s.rule === 'tundra' && (have.dead || 0) < 6 ? ['dead'] : []);
    let rocks = 0; for (let y = Math.floor(cc.y - 3); y <= cc.y + 3; y++) for (let x = Math.floor(cc.x - 3); x <= cc.x + 3; x++) if (c.terrain[idx(x, y)] === WG.T_ROCK) rocks++;
    ok(!short.length && !rocks, `north ${s.k} ${s.name}（${s.rule}）: every raw kind near the camp${short.length ? ' — short ' + short : ''}${rocks ? `, ${rocks} rocks at the camp` : ''}`);
  }
  setRows(BASE_H);
}
// 从世界之脊往北走：门槛不再涨，到了北境第 1 站地图接上一段，存档带着行数
function rich(seed, stage) {
  const S = G.newRun(G.defaultMeta(), 0, seed);
  S.reveal.fill(1); G.rt(S).revealN = 99; S.known = 7; G.dirty(S);
  const J = G.journeyOf(S); J.stage = stage;
  const m = G.mainCamp(S); m.people = 120;
  for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore']) m.stock[k] = 50000;
  G.getB(S, m.furnace).lvl = 37;
  J.fleet.icebreaker = 10; J.fleet.tractor = 10; J.fleet.sled = 20;
  for (let s = 0; s <= stage; s++) for (let k = 0; k < 3; k++) G.chapState(S).ok[s + ':' + k] = 1;
  return S;
}
function travel(S) {
  const J = G.journeyOf(S), m = G.mainCamp(S);
  m.people = Math.max(m.people, 120);
  for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore']) m.stock[k] = 50000;
  const d = G.depart(S); if (!d.ok) return d;
  let n = 0;
  while (J.trip && n < 6000) { if (J.trip.road) G.resolveRoad(S, 0); G.step(S, 1); n++; S.reveal.fill(1); }
  return { ok: !J.trip, n };
}
{
  const S = rich(6061, G.SPINE), J = G.journeyOf(S);
  ok(G.gateFlvl(G.SPINE) === G.gateFlvl(G.SPINE - 1) && G.gateFlvl(G.SPINE + 5) === 37, `furnace gate frozen at ${G.gateFlvl(G.SPINE)}`);
  const nx = G.stopOf(S, G.SPINE + 1);
  ok(nx && nx.north === 1 && /北境第 1 站·/.test(nx.n) && nx.rule === 'flat', 'next stop after the spine: ' + (nx && nx.n));
  const g = G.departGate(S);
  ok(g && g.ok, 'gate open at the spine: ' + (g && g.items.filter(i => !i.ok).map(i => i.t + ' ' + i.sub).join('; ')));
  const r = travel(S);
  ok(r.ok && J.stage === G.SPINE + 1, `arrived at ${G.stopOf(S, J.stage).n} after ${r.n}s`);
  const m = G.mainCamp(S), st = G.stopOf(S, J.stage);
  ok(Math.hypot(m.x - st.x, m.y - st.y) < 12 && m.y < st.y, `new camp south of the landmark (${m.x.toFixed(1)},${m.y.toFixed(1)})`);
  ok(S.rows === BASE_H + 400 && WG.H === BASE_H + 400 && S.reveal.length === W * S.rows && getWorld(S.runSeed).rows === S.rows, `map grew to ${S.rows} rows for the next stop`);
  ok(G.landmarkBlock(Math.floor(st.x), Math.floor(st.y), S), 'cannot build on the north landmark');
  ok(!G.checkPlace(S, 'tent', Math.floor(st.x) - 1, Math.floor(st.y) - 1).ok, 'placement refuses the landmark tiles');
  // 存档：行数和迷雾都带着
  S.reveal.fill(0); for (let i = W * 1200; i < W * 1210; i++) S.reveal[i] = 1;
  const str = G.serialize(S); setRows(BASE_H);
  const S2 = G.deserialize(str);
  ok(S2.rows === S.rows && WG.H === S.rows && S2.reveal.length === W * S.rows && S2.reveal[W * 1205] === 1 && S2.reveal[W * 1195] === 0, 'save keeps the rows and the fog up north');
  // 再走五站：到第 6 站以后地图接到 1800
  S.reveal.fill(1);
  for (let i = 0; i < 5; i++) { for (let k = 0; k < 3; k++) G.chapState(S).ok[J.stage + ':' + k] = 1; const q = travel(S); if (!q.ok) { ok(false, 'trip failed ' + (q.reason || '')); break; } }
  ok(J.stage === G.SPINE + 6 && S.rows === BASE_H + 800, `at ${G.stopOf(S, J.stage).n}, map ${S.rows} rows`);
  const nx2 = G.stopOf(S, J.stage + 1);
  ok(nx2.y + 50 < S.rows, `next stop ${nx2.n} at row ${Math.round(nx2.y)} is inside the map`);
  // 新的北行：地图回到 1000 行
  const N = G.newRun(G.defaultMeta(), 0, 7777);
  ok(WG.H === BASE_H && N.rows === BASE_H && N.reveal.length === W * BASE_H, 'a new run starts with 1000 rows again');
}
// 老存档（第十二版）照常读
{
  const fs = await import('fs');
  for (const f of ['/tmp/save_full.json', '/tmp/v12/bot7e.json']) {
    if (!fs.existsSync(f)) continue;
    const S = G.deserialize(fs.readFileSync(f, 'utf8'));
    ok(S.rows === BASE_H && S.reveal.length === W * BASE_H, `${f}: loads with ${S.rows} rows`);
  }
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
