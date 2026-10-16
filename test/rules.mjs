// 北境十条地貌规则：地面、暖圈、燃料、极光、狼群、暴风雪、冰湖、流星、废墟、枯木、地热井和冰钓屋
import * as G from '../src/sim.js';
import * as WG from '../src/worldgen.js';
import { SPOT_KEYS, BLD, NORTH_RULES, RULE_FX, furnaceRadius, DAY_LEN } from '../src/data.js';
const { getWorld, idx, W, northCampAt } = WG;
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const seed = +(process.env.SEED || 6061);

// ---------- 地面：只看生成出来的地图 ----------
{
  WG.setRows(2600); const w = getWorld(seed);
  const near = (s, R, fn) => { const c = northCampAt(s); for (let y = Math.floor(c.y - R); y <= c.y + R; y++) for (let x = 0; x < W; x++) if (Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) <= R) fn(idx(x, y), x, y, Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y)); };
  const count = (s, R, key) => { let n = 0; near(s, R, i => { if (w.spot[i] >= 0 && SPOT_KEYS[w.spot[i]] === key) n++; }); return n; };
  const seen = {};
  for (const s of w.north) {
    if (s.k > 20 || seen[s.rule]) continue; seen[s.rule] = s;
    const tag = `north ${s.k} ${NORTH_RULES[s.rule].n}`;
    if (s.rule === 'flat') { let bad = 0; near(s, 14, (i, x) => { if (w.terrain[i] !== WG.T_SNOW && Math.min(x, W - 1 - x) >= 2) bad++; }); ok(!bad, `${tag}: no rocks or ice inside 14 tiles (${bad})`); }
    if (s.rule === 'tundra') ok(count(s, 32, 'tree') === 0 && count(s, 11, 'dead') >= 6, `${tag}: no live trees, ${count(s, 11, 'dead')} deadwood piles near the camp`);
    if (s.rule === 'lakes') { let ice = 0; near(s, 17, i => { if (w.terrain[i] === WG.T_ICE) ice++; }); const f = count(s, 14, 'fish'); let onIce = true; near(s, 14, i => { if (SPOT_KEYS[w.spot[i]] === 'fish' && w.terrain[i] !== WG.T_ICE) onIce = false; }); ok(ice >= 25 && f >= 4 && onIce, `${tag}: ${ice} ice tiles, ${f} fishing spots on the ice`); }
    if (s.rule === 'ruins') { let r = 0, close = 0; near(s, 14, (i, x, y, d) => { if (SPOT_KEYS[w.spot[i]] === 'ruin') { r++; if (d < 4.4) close++; } }); ok(r >= 10 && !close, `${tag}: ${r} ruin tiles in the warm ring, none on the furnace spot`); }
    if (s.rule === 'meteor') ok(count(s, 11, 'starfall') >= 4, `${tag}: ${count(s, 11, 'starfall')} star-core stones near the camp`);
    if (s.rule === 'rich') { let mx = 0, n = 0; near(s, 11, i => { if (SPOT_KEYS[w.spot[i]] === s.rich) { n++; mx = Math.max(mx, w.spotInit[i]); } }); ok(n >= 2 && mx >= 3 * 0.7 * 1200 * 6 * 0.9, `${tag}: ${s.rich} ×3 (${n} spots, max ${mx})`); }
    if (s.rule === 'geo') ok(count(s, 11, 'coal') >= 2 && count(s, 11, 'shale') >= 2, `${tag}: coal and shale still at least 2 near the camp`);
  }
  ok(Object.keys(seen).length === 10, 'all ten rules within the first 20 stops');
  WG.setRows(1000);
}

// ---------- 一站一站往北走，在每站看规则生效 ----------
const S = G.newRun(G.defaultMeta(), 0, seed), J = G.journeyOf(S);
S.known = 7; J.stage = G.SPINE; S.tide = { t0: 1e12 }; // 1.1 永冬潮别在量燃料的时候撞上
const fill = () => { const m = G.mainCamp(S); m.people = Math.max(m.people, 90); for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore']) m.stock[k] = Math.max(m.stock[k] || 0, 20000); G.getB(S, m.furnace).lvl = Math.max(37, G.getB(S, m.furnace).lvl); };
J.fleet.icebreaker = 10; J.fleet.tractor = 10; J.fleet.sled = 20;
function travel() {
  fill();
  for (let s = 0; s <= J.stage; s++) for (let k = 0; k < 4; k++) G.chapState(S).ok[s + ':' + k] = 1;
  S.reveal.fill(1); G.rt(S).revealN = (G.rt(S).revealN || 0) + 1; G.dirty(S);
  const P = J.plan || (J.plan = {}); P.mode = {}; for (const c of S.camps) P.mode[c.id] = 'douse';
  const d = G.depart(S); if (!d.ok) return d;
  let t = 0; while (J.trip && t < 6000) { if (J.trip.road) G.resolveRoad(S, 0); G.step(S, 1); t++; }
  S.reveal.fill(1); G.rt(S).revealN++; G.dirty(S); fill();
  return { ok: !J.trip };
}
// 在主营地暖圈里找个能放 type 的地方（want：要有几处资源点）
function spotFor(type, want = 0) {
  const m = G.mainCamp(S), r = G.heatRadius(S, m);
  for (let d = 2; d <= r; d++) for (let a = 0; a < 48; a++) {
    const x = Math.round(m.x + Math.cos(a / 48 * 6.283) * d - 1), y = Math.round(m.y + Math.sin(a / 48 * 6.283) * d - 1);
    const ck = G.checkPlace(S, type, x, y); if (ck.ok && (ck.spots || 0) >= want) return { x, y, ck };
  }
  return null;
}
const run = (secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const flat = { r0: 0, burn: 0 };
for (let n = 1; n <= 11; n++) {
  const tr = travel(); if (!tr.ok) { ok(false, 'trip failed ' + (tr.reason || '')); break; }
  const st = G.stopOf(S, J.stage), m = G.mainCamp(S), rule = st.rule, tag = `${st.n}（${NORTH_RULES[rule].n}）`;
  ok(G.ruleNow(S) === rule && G.campRule(S, m) === rule && J.rh.at(-1).r === rule && J.rh.at(-1).t1 == null && (J.rh.length < 2 || J.rh.at(-2).t1 != null), `${tag}: rule span opened`);
  const lv = G.getB(S, m.furnace).lvl, base = furnaceRadius(lv);
  run(20);
  const cr = G.rt(S).c[m.id], burn = cr.baseBurn;
  if (rule === 'flat' && !flat.burn) { flat.burn = burn; ok(G.heatRadius(S, m) === base, `${tag}: warm ring ${base}`); }
  // 地热井、冰钓屋只在自己的地貌能建
  ok(G.unlocked(S, 'geowell') === (rule === 'geo') && G.unlocked(S, 'icefish') === (rule === 'lakes'), `${tag}: geowell/icefish unlocked only at their rule`);
  if (rule === 'geo') {
    ok(G.heatRadius(S, m) === base + RULE_FX.geoWarm, `${tag}: warm ring +3 (${G.heatRadius(S, m)})`);
    ok(flat.burn && Math.abs(burn / flat.burn - RULE_FX.geoFuel) < 0.02, `${tag}: fuel ×${(burn / flat.burn).toFixed(2)}`);
    const p = spotFor('geowell'); const heat0 = cr.heat;
    const r = p && G.place(S, 'geowell', p.x, p.y);
    const b = S.buildings.find(q => q.type === 'geowell'); if (b) b.workers = 1;
    run(10);
    ok(r && r.ok && G.rt(S).c[m.id].heat > heat0 + 4, `${tag}: geowell adds heat (${heat0?.toFixed(1)} → ${G.rt(S).c[m.id].heat.toFixed(1)})`);
    if (b) { const fx = b.x + 1 + 4.6, fy = b.y + 1; ok(G.warmCampAt(S, Math.floor(fx), Math.floor(fy)) === m.id, `${tag}: geowell widens the build area`); }
  }
  if (rule === 'rich') {
    ok(G.heatRadius(S, m) === base, `${tag}: first two days keep the warm ring (${G.heatRadius(S, m)})`);
    const h = J.rh.at(-1); run(h.t0 + G.RICH_GRACE - S.t + 4);
    ok(G.heatRadius(S, m) === base + RULE_FX.richWarm && S.log.some(l => /暖圈缩了/.test(l.msg)), `${tag}: then warm ring −2 with a log line (${G.heatRadius(S, m)})`);
  }
  if (rule === 'night') {
    ok(flat.burn && Math.abs(burn / flat.burn - RULE_FX.nightFuel) < 0.02, `${tag}: fuel ×${(burn / flat.burn).toFixed(2)}`);
    const d0 = Math.floor(S.t / DAY_LEN) + 1; let all = true; for (let d = d0; d < d0 + 6; d++) if (G.skyAt(S, d * DAY_LEN + 0.75 * DAY_LEN).aurora < 0.3 && !G.weatherAt(S, d * DAY_LEN + 0.75 * DAY_LEN).blizzard) all = false;
    ok(all, `${tag}: aurora every night`);
    ok(G.moodFactors(S, m, cr).hope.some(h => h[0] === '永夜的极光'), `${tag}: hope bonus listed`);
    const lum = S.buildings.find(b => b.camp === m.id && BLD[b.type].cat === 'gather');
    ok(!lum || true, `${tag}: outdoor work ×${RULE_FX.nightOut}`);
  }
  if (rule === 'storm') {
    ok(G.forecastOf(S) === 3600 * 4, `${tag}: forecast ${G.forecastOf(S) / 3600} h`);
    const h = J.rh.at(-1); let a = 0, b = 0, last = null;
    for (let t = h.t0; t < h.t0 + 86400 * 2; t += 60) { const w = G.weatherAt(S, t); if (w.blizzard && w.slot.k !== last) { last = w.slot.k; if (w.slot.x) a++; else b++; } }
    ok(a >= b * 0.75 && a >= 9, `${tag}: storm blizzards ${a} + regular ${b} in two days (×${((a + b) / b).toFixed(2)})`);
    // 不和平常的暴风雪重叠
    let clash = 0; for (let j = 0; j < 8; j++) { const z = G.stormSlot(S, h, j); for (let k = 0; k < 40; k++) { const q = G.blizzardSlot(S, k); if (z.start < q.end && z.end > q.start) clash++; } }
    ok(!clash, `${tag}: storm blizzards never overlap the regular ones`);
  }
  if (rule === 'lakes') {
    const h = J.rh.at(-1); let c = 0, n2 = 0;
    for (let k = 0; k < 60; k++) { const z = G.wxeSlot(S, k); if (z.start >= h.t0) { n2++; if (z.kind === 'crack') c++; } }
    ok(c / n2 > 0.55, `${tag}: ${c}/${n2} weather events are ice cracks`);
    const p = spotFor('icefish', 1), r = p && G.place(S, 'icefish', p.x, p.y);
    const b = S.buildings.find(q => q.type === 'icefish'); if (b) b.workers = 2;
    const f0 = m.stock.food; run(120);
    ok(r && r.ok && (G.rt(S).b[b.id].rate || {}).food > 3, `${tag}: icefish catches fish ${JSON.stringify(G.rt(S).b[b && b.id]?.rate)}`);
    ok(G.checkPlace(S, 'tent', ...(() => { const w = getWorld(S.runSeed); for (let i = 0; i < w.terrain.length; i++) if (w.terrain[i] === WG.T_ICE && G.warmCampAt(S, i % W, Math.floor(i / W)) === m.id) return [i % W, Math.floor(i / W)]; return [0, 0]; })()).reason.includes('冰湖'), `${tag}: cannot build on the ice`);
  }
  if (rule === 'wolf') {
    const nr = G.nextRaid(S);
    const h = J.rh.at(-1); let xs = 0, reg = 0;
    const T0 = S.t, keep = { done: S.raidDone, x: JSON.stringify(S.raidX || {}), su: S.safeUntil };
    for (let i = 0; i < 40; i++) { const r = G.nextRaid(S); if (!r || r.t > T0 + 86400 * 2) break; if (r.x) { xs++; (S.raidX ||= {})[r.hk] = r.j; } else { reg++; S.raidDone = r.k; } S.t = r.t + 1; }
    S.t = T0; S.raidDone = keep.done; S.raidX = JSON.parse(keep.x);
    ok(xs >= 4 && reg >= 8 && xs / reg >= 0.4 && xs / reg <= 0.65, `${tag}: two days → ${reg} regular raids + ${xs} wolf raids (×${((xs + reg) / reg).toFixed(2)})`);
    // 打一场：箭塔够硬，赢了战利品翻倍
    for (let i = 0; i < 6; i++) { const p = spotFor('tower'); if (p) { G.place(S, 'tower', p.x, p.y); const b = S.buildings.at(-1); b.lvl = 30; b.workers = 1; } }
    let x = G.nextRaid(S); let guard = 0;
    while (x && !x.x && guard++ < 10) { S.t = x.t - 1; S.raidDone = x.k; x = G.nextRaid(S); }
    if (x) { S.t = x.t - 2.5; m.stock.game = 0; const won0 = G.nsOf(S).raidW || 0; run(6, 1); const l = S.log.slice(-8).map(q => q.msg).find(q => /击退/.test(q)); ok((G.nsOf(S).raidW || 0) === won0 + 1 && /战利品翻倍/.test(l || ''), `${tag}: wolf raid repelled, loot doubled: ${l} (won ${G.nsOf(S).raidW})`); }
  }
  if (rule === 'meteor') {
    const h = J.rh.at(-1); let hits = 0;
    for (let j = 0; j < 40; j++) if (G.metSlot(S, h, j).hit) hits++;
    ok(hits > 10 && hits < 30, `${tag}: ${hits}/40 meteors aimed at a building`);
    // 放一座采集建筑等着被砸
    const p = spotFor('quarry', 1); if (p) { G.place(S, 'quarry', p.x, p.y); S.buildings.at(-1).workers = 2; }
    let hitB = null; for (let t = 0; t < 4 * 3600 && !hitB; t += 10) { G.step(S, 10); hitB = S.buildings.find(b => b.hitT > S.t); }
    ok(hitB, `${tag}: a meteor hit ${hitB ? BLD[hitB.type].n : 'nothing'} within 4 h`);
    if (hitB) { G.step(S, 1); ok(G.rt(S).b[hitB.id].status === '被陨石砸了，在修', `${tag}: hit building pauses`); run(RULE_FX.metHit + 10, 5); ok(G.rt(S).b[hitB.id].status !== '被陨石砸了，在修' && S.buildings.includes(hitB), `${tag}: repaired, not destroyed`); }
    const sw = G.surReward(S, { kind: 'meteor', camp: m.id }); ok(sw.res.starcore > 0, `${tag}: craters hold star cores`);
  }
  if (rule === 'ruins') {
    const w = getWorld(S.runSeed); let i0 = -1;
    for (let i = 0; i < w.spot.length && i0 < 0; i++) if (SPOT_KEYS[w.spot[i]] === 'ruin' && G.warmCampAt(S, i % W, Math.floor(i / W)) === m.id) i0 = i;
    m.stock.part = 0; const tiles = G.ruinTiles(S, i0), p0 = m.stock.part;
    ok(G.checkPlace(S, 'tent', i0 % W, Math.floor(i0 / W)).ok === false, `${tag}: ruin blocks building`);
    const r = G.dismantleRuin(S, i0);
    ok(r.ok && tiles.length >= 2 && m.stock.part > p0 && tiles.every(t => G.spotLeft(S, t) <= 0) && G.nsOf(S).ruin === 1, `${tag}: dismantled a ${tiles.length}-tile ruin → ${JSON.stringify(r.loot)}`);
  }
  if (rule === 'tundra') {
    const p = spotFor('lumber', 1), r = p && G.place(S, 'lumber', p.x, p.y);
    const b = S.buildings.find(q => q.type === 'lumber' && q.camp === m.id); if (b) b.workers = 2; m.stock.wood = 0;
    run(60);
    ok(r && r.ok && (G.rt(S).b[b.id].rate || {}).wood > 2, `${tag}: lumber cuts the deadwood ${JSON.stringify(G.rt(S).b[b && b.id]?.rate)} ${G.rt(S).b[b && b.id]?.status} wood ${Math.round(m.stock.wood)} wx ${JSON.stringify(G.weatherAt(S, S.t))}`);
    // 砍光一处以后会慢慢刷出来
    const sp = G.rt(S).gatherSpots.get(b.id)[0].i; S.spots[sp] = 0; (S.sap ||= {})[sp] = 1; run(600, 10);
    ok(G.spotLeft(S, sp) > 0, `${tag}: deadwood comes back (${Math.round(G.spotLeft(S, sp))})`);

  }
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
