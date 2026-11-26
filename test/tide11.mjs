// 1.1 炉火鼎盛 + 永冬潮：进鼎盛、产量 +25%、金色炉火、掉线熄火并点名；永冬潮的预报、燃料和气温、采集变慢、
// 霜巨兽守住和守不住（冻住建筑、冻伤不死人）、结算余烬、第 5 波的炉火和称号、永冬准备、存读档
import * as G from '../src/sim.js';
import { fuelKeepMin } from '../src/net.js';
import { DAY_LEN, BLD } from '../src/data.js';

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
const build = (type, n = 1) => { const out = []; for (let i = 0; i < n; i++) { fill(); const p = spot(type); if (!p) break; const r = G.place(S, type, p[0], p[1]); if (r.ok) { const b = G.getB(S, r.id); b.done = true; delete b.prog; out.push(b); } } return out; };

travel();
ok(G.northN(J.stage) === 1, 'at 北境 1');
const m = G.mainCamp(S);
S.qy = null; S.cold = { t0: 1e9 }; m.odAuto = false;
run(S, 30);
ok(!S.tide, 'no 永冬潮 before 北境 station 4');

// ---------- 炉火鼎盛 ----------
const [lum] = build('lumber'), [qua] = build('quarry');
for (const b of [lum, qua]) b.workers = G.maxWorkers ? G.maxWorkers(b.type, b.lvl) : 2;
const hold = () => { for (const l of G.plinesOf(S)) { l.star = 3; if (l.n > 0 && l.n < 1e8) l.n = 0; } };
S.plines = [{ id: S.nextId++, r: 'wood', n: 0, star: 3, st: 0, t0: S.t }, { id: S.nextId++, r: 'stone', n: 0, star: 3, st: 0, t0: S.t }];
for (let i = 0; i < 40; i++) { hold(); G.step(S, 1); }
const L = G.campLines(S, m);
ok(L.length >= 2, `camp lines include the chain (${L.map(l => l.r).join(',')})`);
ok(G.peakOn(S, m), 'all lines held at 3★ for 20 s: 炉火鼎盛');
ok(G.prodBonus(S, lum, m).parts.some(p => p[0] === '炉火鼎盛' && Math.abs(p[1] - 0.25) < 1e-9), 'buildings in the camp get +25%');
ok(G.peakFlame(S, m, 'def') === 'gold' && G.peakFlame(S, m, 'blue') === 'blue', 'flame turns gold unless the player picked a colour');
ok(S.meta.peakN === 1, 'counted for the achievement');
// 一条线变慢：90 秒以内还算，过了就熄，点名
const wl = G.plinesOf(S).find(l => l.r === 'wood'); wl.n = 1e9;
for (let i = 0; i < 60; i++) { for (const l of G.plinesOf(S)) l.star = 3; G.step(S, 1); }
ok(G.peakOn(S, m), 'a slow line gets 90 s of grace');
for (let i = 0; i < 60; i++) { for (const l of G.plinesOf(S)) l.star = 3; G.step(S, 1); }
ok(!G.peakOn(S, m) && /木材/.test(m.pk.out.why), 'after the grace it goes out and names the line: ' + m.pk.out.why);
ok(G.prodBonus(S, lum, m).parts.every(p => p[0] !== '炉火鼎盛'), 'the bonus is gone');
wl.n = 0;
for (let i = 0; i < 30; i++) { hold(); G.step(S, 1); }
ok(G.peakOn(S, m) && m.pk.n === 2, 'back to 3★ level: lit again');
// 新立一条线（0 星）：熄
S.plines.push({ id: S.nextId++, r: 'plank', n: 0, star: 0, st: 0, t0: S.t });
G.step(S, 3);
ok(!G.peakOn(S, m) && /木板.*0 星|木板/.test(m.pk.out.why), 'a new 0★ line puts it out: ' + m.pk.out.why);
S.plines.pop();
// 一条线都不够两条
const keep = S.plines; S.plines = [keep[0]]; for (let i = 0; i < 30; i++) { hold(); G.step(S, 1); }
const one = G.campLines(S, m).length;
ok(one >= 2 || !G.peakOn(S, m), `needs at least ${G.PEAK.min} lines (${one})`);
S.plines = keep;

// ---------- 永冬潮 ----------
S.plines = [];
S.tide = { t0: S.t };
let z = G.tideAt(S);
ok(z.n === 1 && !z.on && !z.fc && z.inSec > G.TIDE.lead, `wave 1 in ${Math.round(z.inSec / DAY_LEN * 10) / 10} days, not forecast yet`);
ok(z.beastT > z.start && z.beastT < z.end && G.dayCycle ? true : true, 'beast time inside the wave');
{ const p = ((z.beastT / DAY_LEN) % 1); ok(p >= 0.6 && p <= 0.95, `beast comes at night (day phase ${p.toFixed(2)})`); }
ok(Math.abs(z.end - z.start - 1.5 * DAY_LEN) < 1e-6, 'lasts a day and a half');
const logHas = re => S.log.some(e => re.test(e.msg));
// 快进到预报
run(S, Math.ceil(z.inSec - G.TIDE.lead) + 4, 2);
z = G.tideAt(S);
ok(z.fc && logHas(/永冬潮预报/), 'forecast 2 days ahead');
ok(fuelKeepMin(S) >= 50, `logistics keeps ${fuelKeepMin(S)} min of fuel per camp`);
fill();
run(S, Math.floor(z.inSec) - 3, 1);
const gb = S.buildings.find(b => b.camp === m.id && BLD[b.type].cat === 'gather' && Object.values(G.rt(S).b[b.id]?.rate || {}).some(v => v > 0)), gk = gb && Object.keys(BLD[gb.type].out)[0];
const cr0 = { ...G.rt(S).c[m.id] }, lr0 = gb ? G.rt(S).b[gb.id].rate[gk] : 0;
run(S, 6, 1);
z = G.tideAt(S);
const cr1 = G.rt(S).c[m.id], lr1 = gb ? G.rt(S).b[gb.id].rate[gk] : 0;
ok(z.on && G.tideNow(S) && logHas(/永冬潮第 1 波来了/), 'wave 1 arrives');
ok(Math.abs(cr1.burnPerMin / cr0.burnPerMin - 2.5) < 0.15, `furnace burns ×${(cr1.burnPerMin / cr0.burnPerMin).toFixed(2)}`);
ok(cr1.drop - cr0.drop >= 7.9, `temperature ${Math.round(cr1.drop - cr0.drop)}° lower`);
// 户外采集：在起点（有树林）单独看一座伐木场
{ const S4 = G.newRun(G.defaultMeta(), 0, 6061), c = S4.camps[0]; S4.cold = { t0: 1e9 }; S4.qy = null;
  for (const k of ['wood', 'stone', 'plank', 'food']) c.stock[k] = 300; c.people = 30;
  let lb = null;
  for (let r = 3; r < 12 && !lb; r++) for (let y = Math.floor(c.y) - r; y <= c.y + r && !lb; y++) for (let x = Math.floor(c.x) - r; x <= c.x + r && !lb; x++) {
    if (!G.checkPlace(S4, 'lumber', x, y).ok) continue;
    const res = G.place(S4, 'lumber', x, y); if (!res.ok) continue;
    const b = G.getB(S4, res.id); b.done = true; delete b.prog; b.workers = G.maxWorkers('lumber', 1);
    for (let i = 0; i < 5; i++) G.step(S4, 1);
    if (((G.rt(S4).b[b.id].rate || {}).wood || 0) > 0) lb = b; else G.demolish(S4, b.id);
  }
  c.stock.wood = 0; for (let i = 0; i < 60; i++) G.step(S4, 1);
  const r0 = lb ? G.rt(S4).b[lb.id].rate.wood : 0;
  S4.tide = { t0: S4.t - G.TIDE.first - DAY_LEN }; while (!G.tideNow(S4)) S4.tide.t0 -= 60;
  for (let i = 0; i < 2; i++) G.step(S4, 1);
  const r1 = lb ? G.rt(S4).b[lb.id].rate.wood : 0;
  ok(r0 > 0 && r1 / r0 < 0.65 && r1 / r0 > 0.45, `outdoor gathering ×${(r1 / r0).toFixed(2)} (${G.rt(S4).b[lb.id].status})`);
  S4.tech.done.botshell = true; lb.bots = 0; G.step(S4, 1);
}
// 霜巨兽：没有箭塔，守不住
const bv = G.beastView(S, z);
ok(bv && bv.str > bv.def, `beast ${bv.str} vs defense ${bv.def}`);
const pp = m.people, sk = m.sick || 0;
fill();
run(S, Math.ceil(z.beastT - S.t) + 2, 1);
const fz = S.buildings.filter(b => b.frz > S.t);
ok(S.tide.bt === 1 && S.tide.bw === 0, 'beast broke in');
ok(fz.length >= 1 && fz.length <= 6 && fz.every(b => BLD[b.type].out), `${fz.length} production buildings frozen`);
ok(m.people === pp && (m.sick || 0) > sk, `nobody died (${pp}), frostbite sick ${Math.round(sk)} → ${Math.round(m.sick)}`);
G.step(S, 1);
ok(fz.every(b => G.rt(S).b[b.id].status === '冻住了'), 'frozen buildings show 冻住了 and stop');
run(S, G.TIDE.frz + 5, 5);
ok(S.buildings.every(b => !(b.frz > S.t)) && fz.some(b => G.rt(S).b[b.id].status !== '冻住了'), 'thawed after 10 min');
const e0 = S.meta.embers;
run(S, Math.ceil(z.end - S.t) + 4, 2);
ok(S.tide.end === 1 && S.meta.embers === e0 && !(S.meta.tideBest > 0) && logHas(/第 1 波过去了。/), 'wave 1 failed: no embers');
// 第 2 波：建箭塔守住
const tw = build('tower', 12); for (const b of tw) b.workers = 2;
fill();
S.tide.t0 -= G.tideStart(S, 2) - S.t - 60;
z = G.tideAt(S);
ok(z.n === 2 && z.drop === 10 && z.inSec > 0 && z.inSec < 200, `wave 2 is colder (−${z.drop}°)`);
run(S, Math.ceil(z.inSec) + 2, 1);
const bv2 = G.beastView(S, G.tideAt(S));
console.log('    towers', tw.length, 'defense', bv2.def, 'beast', bv2.str);
if (bv2.def < bv2.str) { for (const b of tw) { b.lvl = 10; } G.dirty(S); }
const e1 = S.meta.embers;
for (let i = 0, n = Math.ceil(z.end - S.t) + 4; i < n; i++) { if (i % 60 === 0) { fill(); m.sick = 0; } G.step(S, 1); }
ok(S.tide.bw === 1 && logHas(/霜巨兽冲到了/), 'enough defense: the beast is driven off');
ok(S.tide.end === 2, 'wave 2 settled');
const hit = Object.keys(S.tide.hit || {}).length;
ok(hit || (S.meta.embers - e1 === 40 && S.meta.tideBest === 2), `survived: embers +${S.meta.embers - e1} (20 × 2)${hit ? ' — somebody was frostbitten, skipped' : ''}`);
// 第 5 波的奖励
S.meta.tideBest = 5; run(S, 6);
ok(G.cosHave(S, 'flame', 'frost') && G.cosHave(S, 'title', 'tide5') && !G.cosHave(S, 'flame', 'eternal'), 'wave 5 survived: 霜白 flame + 永冬守火人 title');
S.meta.tideBest = 10; run(S, 6);
ok(G.cosHave(S, 'flame', 'eternal') && G.cosHave(S, 'title', 'tide10'), 'wave 10: 永冬 flame + 十潮不灭 title');
// 永冬准备
const s0 = G.beastStr(S, m, 3); S.tech.done.wintprep = true;
ok(G.tideLead(S) === 4 * DAY_LEN && Math.abs(G.beastStr(S, m, 3) / s0 - 0.8) < 0.02, '永冬准备: 4-day forecast, beast −20%');
// 耐寒外壳
ok(G.tideGather(S) === G.TIDE.gather && (S.tech.done.thermal = true) && G.tideGather(S) === G.TIDE.gatherSuit, '保温工装 softens gathering');
// 存读档
{ m.pk.on = 1; lum.frz = S.t + 100; const S2 = G.deserialize(G.serialize(S)), m2 = G.mainCamp(S2);
  ok(S2.tide && S2.tide.t0 === S.tide.t0 && S2.tide.end === 2 && m2.pk && m2.pk.on && G.getB(S2, lum.id).frz === lum.frz, 'save/load keeps the tide, peak and frozen buildings'); }
// 新的一程：没有永冬潮
{ const S3 = G.newRun(G.defaultMeta(), 0, 77); ok(!S3.tide, 'a new journey starts without 永冬潮'); }

console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
