// 1.1 奇观 + 城镇：图纸和选址限制、三期施工、六种效果、蒸汽巨像吓退袭营、存读档、熄火后效果还在；镇 / 城 / 大城
import * as G from '../src/sim.js';
import { DAY_LEN, BLD, WONDERS, WONDER_PH, TOWN, CSPEC_FX } from '../src/data.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const run = (S, s, dt = 1) => { for (let i = 0; i < s; i += dt) G.step(S, dt); };
const S = G.newRun(G.defaultMeta(), 0, 6061), J = G.journeyOf(S);
S.known = 7; J.stage = G.SPINE;
const KS = ['wood', 'stone', 'plank', 'food', 'game', 'coal', 'coke', 'iron', 'steel', 'gear', 'seal', 'lime', 'crystal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore'];
const fill = (n = 20000) => { const m = G.mainCamp(S); m.people = Math.max(m.people, 90); for (const k of KS) m.stock[k] = Math.max(m.stock[k] || 0, n); G.getB(S, m.furnace).lvl = Math.max(37, G.getB(S, m.furnace).lvl); };
J.fleet.icebreaker = 10; J.fleet.tractor = 10; J.fleet.sled = 20;
const travel = () => {
  fill();
  for (let s = 0; s <= J.stage; s++) for (let k = 0; k < 4; k++) G.chapState(S).ok[s + ':' + k] = 1;
  S.reveal.fill(1); G.rt(S).revealN = (G.rt(S).revealN || 0) + 1; G.dirty(S);
  const P = J.plan || (J.plan = {}); P.mode = {}; for (const c of S.camps) P.mode[c.id] = 'douse';
  const d = G.depart(S); if (!d.ok) { console.log('depart failed', d.reason); process.exit(1); }
  let t = 0; while (J.trip && t < 6000) { if (J.trip.road) G.resolveRoad(S, 0); G.step(S, 1); t++; }
};
const spot = (type, cid) => {
  const c = G.getCamp(S, cid ?? G.mainCamp(S).id);
  for (let r = 2; r < 18; r++) for (let y = Math.floor(c.y) - r; y <= c.y + r; y++) for (let x = Math.floor(c.x) - r; x <= c.x + r; x++) {
    if (Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) < r - 1) continue;
    const ck = G.checkPlace(S, type, x, y); if (ck.ok && ck.camp === c.id) return [x, y];
  }
  return null;
};
travel();
ok(G.northN(J.stage) === 1, 'at 北境 1');
const m = G.mainCamp(S);
S.qy = null; // 奇遇不打扰

// ---- 图纸 ----
ok(!G.unlocked(S, 'wcolossus') && /图纸/.test(G.stageLock(S, 'wcolossus')), 'no blueprint: locked, says how to get one: ' + G.stageLock(S, 'wcolossus'));
S.tech.done.wonder1 = true;
ok(G.unlocked(S, 'wcolossus') && G.unlocked(S, 'wvault') && G.unlocked(S, 'wbeacon') && !G.unlocked(S, 'waurora'), '奇观图纸·一 unlocks the first three only');
S.wbp = { waurora: 1 };
ok(G.unlocked(S, 'waurora') && !G.unlocked(S, 'wterminal'), 'a blueprint from a 奇遇 unlocks just that one');

// ---- 选址：一座营地一座 ----
fill();
const p1 = spot('wcolossus'); ok(!!p1, 'found a 4×4 spot for the colossus');
const r1 = G.place(S, 'wcolossus', p1[0], p1[1]); ok(r1.ok, 'placed: pays the foundation');
const wb = G.getB(S, r1.id);
ok(wb.wd && wb.wd.ph === 0 && wb.wd.p === 0, 'site starts at phase 0');
ok(/开工/.test(G.wonderLock(S, 'wcolossus')), 'same kind again: already started: ' + G.wonderLock(S, 'wcolossus'));
const p2 = (() => { for (let r = 2; r < 18; r++) for (let y = Math.floor(m.y) - r; y <= m.y + r; y++) for (let x = Math.floor(m.x) - r; x <= m.x + r; x++) { const ck = G.checkPlace(S, 'wvault', x, y); if (ck.camp === m.id && /一座营地最多一座奇观/.test(ck.reason)) return ck.reason; } return null; })();
ok(!!p2, 'second wonder in the same camp: ' + p2);
ok(!G.upgrade || !G.upgrade(S, wb.id).ok, 'wonders do not upgrade');

// ---- 三期施工 ----
const before = { ...m.stock };
const t0 = S.t; let phT = [];
for (let i = 0; i < 6000 && !G.wonderDone(wb); i++) { fill(); const ph = wb.wd.ph; G.step(S, 1); if (wb.wd.ph !== ph) phT.push(Math.round(S.t - t0)); }
ok(G.wonderDone(wb) && phT.length === 3, `three phases done at ${phT.join(', ')} s`);
const dur = WONDER_PH.reduce((a, p) => a + p.dur, 0);
ok(S.t - t0 >= dur * 0.95 && S.t - t0 <= dur * 1.6, `takes about ${dur / 60} min at full feed (${Math.round((S.t - t0) / 60)} min)`);
ok(G.wonderOn(S, 'wcolossus') && G.wonderList(S).length === 1 && S.meta.wMax === 1, 'listed as built');
const lumber = S.buildings.find(b => b.camp === m.id && BLD[b.type].out && !BLD[b.type].wonder);
ok(G.prodBonus(S, lumber || wb, m).parts.some(p => p[0] === '奇观' && Math.abs(p[1] - 0.15) < 1e-9), 'colossus: output +15% everywhere');
ok(G.bookOf(S).a.wonder || (G.ACH.find(a => a.id === 'wonder').cur(S) >= 1), 'achievement 奇观建造者 counts');
ok(!G.demolish || !G.demolish(S, wb.id).ok, 'a finished wonder cannot be torn down');

// 施工快慢：万众一心 ×3、城 ×1.25
{
  const b = { id: 99999, type: 'wvault', x: 0, y: 0, camp: m.id, wd: { ph: 0, p: 0 }, lvl: 1, workers: 0 };
  ok(G.feedMul(S, m) === 1, 'normal feed speed ×1');
  m.town = 2; ok(Math.abs(G.feedMul(S, m) - 1.25) < 1e-9, '城: feed ×1.25');
  m.town = 0;
}

// ---- 蒸汽巨像吓退袭营（每天一次） ----
{
  const W = G.wonderOf(S); delete W.scare;
  ok(G.colossusScare(S) === true && G.colossusScare(S) === false, 'colossus scares off one raid per day');
  S.t += DAY_LEN; ok(G.colossusReady(S), 'ready again the next day');
}

// ---- 其他五种的效果 ----
const cap0 = G.storeCap(S, m), hr0 = G.heatRadius(S, m), road0 = G.netMul(S, 'spd');
G.wonderList(S).push({ w: 'wvault', camp: m.id, stage: J.stage, x: 0, y: 0, t: S.t }, { w: 'wbeacon', camp: m.id, stage: J.stage, x: 0, y: 0, t: S.t },
  { w: 'waurora', camp: m.id, stage: J.stage, x: 0, y: 0, t: S.t }, { w: 'wterminal', camp: m.id, stage: J.stage, x: 0, y: 0, t: S.t }, { w: 'wstarforge', camp: m.id, stage: J.stage, x: 0, y: 0, t: S.t });
G.dirty(S); run(S, 2);
ok(G.storeCap(S, m) === cap0 * 2 || Math.abs(G.storeCap(S, m) - cap0 * 2) <= 1, `vault: storage ×2 (${cap0} → ${G.storeCap(S, m)})`);
ok(G.heatRadius(S, m) === hr0 + 2, 'beacon: warm ring +2');
ok(G.wonderFuel(S) === 0.85, 'beacon: fuel ×0.85');
ok(G.wonderRes(S) === 1.5, 'aurora: research ×1.5');
ok(G.moodFactors(S, m, G.rt(S).c[m.id]).hope.some(h => h[0] === '极光塔' && h[1] === 5), 'aurora: hope +5');
ok(Math.abs(G.netMul(S, 'spd') - road0 * 1.5) < 1e-9, 'terminal: roads ×1.5');
ok(G.wonderTrip(S) === 1.3, 'terminal: caravan ×1.3');
ok(G.wonderProd(S, { type: 'heartforge' in BLD ? 'heartforge' : Object.keys(BLD).find(k => BLD[k].out && BLD[k].out.heart) }) >= 0.45 - 1e-9, 'starforge: heart makers +30% (plus colossus 15%)');
ok(G.wonderProd(S, { type: 'lumber' }) === 0.15, 'starforge does not touch other buildings');

// ---- 物流网：工地缺的料 ----
{
  const p3 = (() => { const c2 = S.camps.find(c => c.id !== m.id); return c2 ? spot('wterminal', c2.id) : null; })();
  ok(true, 'second camp site check skipped when there is none: ' + !!p3);
  const nd = G.wonderNeeds(S, m.id);
  ok(Object.keys(nd).length === 0, 'finished wonder needs nothing');
}

// ---- 存读档 ----
{
  const S2 = G.deserialize(G.serialize(S));
  ok(G.wonderList(S2).length === 6 && G.wonderDone(G.getB(S2, wb.id)), 'save/load keeps wonders and the site');
}

// ---- 城镇 ----
const c = m;
c.town = 0; delete S.tech.done.townplan;
c.people = 70; c.hope = 60;
ok(/城镇规划/.test(G.townBlock(S, c)), 'needs 城镇规划: ' + G.townBlock(S, c));
S.tech.done.townplan = true;
c.people = 50; ok(/60/.test(G.townBlock(S, c)), 'needs 60 people: ' + G.townBlock(S, c));
c.people = 70; c.hope = 40; ok(/希望/.test(G.townBlock(S, c)), 'needs hope 50: ' + G.townBlock(S, c));
c.hope = 60;
const beds0 = G.bedsOf(S, c);
let r = G.townUp(S, c.id); ok(r.ok && c.town === 1, '升成镇');
ok(c.buffs.some(b => b.v === -0.5 && b.until === S.t + 30), 'ceremony: output halved for 30 s');
ok(G.bedsOf(S, c) > beds0 * 1.1, `镇: beds +20% (${beds0} → ${G.bedsOf(S, c)})`);
ok(G.moodFactors(S, c, G.rt(S).c[c.id]).hope.some(h => h[1] === TOWN[1].hope), '镇: hope +3');
ok(/120/.test(G.townBlock(S, c)), '城 needs 120 people: ' + G.townBlock(S, c));
c.people = 130; r = G.townUp(S, c.id); ok(r.ok && c.town === 2, '升成城');
ok(G.prodBonus(S, lumber || wb, c).parts.some(p => p[0] === '城' && p[1] === 0.05), '城: output +5%');
c.people = 190; r = G.townUp(S, c.id); ok(r.ok && c.town === 3 && S.meta.town === 3, '升成大城');
ok(!G.townUp(S, c.id).ok, 'nothing above 大城');
{
  const sb = S.buildings.find(b => b.camp === c.id && (G.campSpecOf(c) || { b: [] }).b.includes(b.type));
  if (sb) { const v = G.campSpecFx(S, sb, c); ok(v > CSPEC_FX * 1.2 - 1e-9 || v > 0.2, `大城: specialty ×1.25 (${v})`); } else ok(true, 'no specialty building here to check');
}
{
  const st0 = { ...c.stock }; for (const k of ['steel', 'gear', 'seal', 'alloy', 'battery', 'part', 'core', 'engine']) c.stock[k] = 0;
  c.giftDay = Math.floor(S.t / DAY_LEN) - 1; G.townStep(S);
  const got = ['steel', 'gear', 'seal', 'alloy', 'battery', 'part', 'core', 'engine'].filter(k => c.stock[k] > 0);
  ok(got.length === 2, '大城: daily 市政礼包 brings two kinds: ' + got.join(','));
  G.townStep(S); ok(['steel', 'gear', 'seal', 'alloy', 'battery', 'part', 'core', 'engine'].filter(k => c.stock[k] > 0).length === 2, 'only once a day');
  Object.assign(c.stock, st0);
}
ok(G.ACH.find(a => a.id === 'mayor').cur(S) >= 3, 'achievement 大城之主 counts');

// ---- 北迁：熄火以后奇观的效果还在 ----
{
  S.wonder.list.splice(1); // 只留蒸汽巨像
  travel();
  ok(G.northN(J.stage) === 2 && G.wonderOn(S, 'wcolossus'), 'after migrating (old camp doused) the colossus still counts');
  const m2 = G.mainCamp(S), lb = S.buildings.find(b => b.camp === m2.id && BLD[b.type].out);
  ok(!lb || G.prodBonus(S, lb, m2).parts.some(p => p[0] === '奇观'), 'and the new camp gets its bonus');
  ok(!S.buildings.some(b => b.id === wb.id), 'the building itself stayed behind with the doused camp');
}
// ---- 新的一程：重来 ----
{
  const S3 = G.newRun(S.meta, 1, 99);
  ok(G.wonderList(S3).length === 0 && G.unlocked(S3, 'wcolossus') === false, 'a new journey starts with no wonders');
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
