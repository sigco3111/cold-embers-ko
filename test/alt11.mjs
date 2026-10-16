// 1.1 替代配方 + 营地特产：换配方停工、换了以后吃另一套、规划器按多数算、老向导提醒、特产加成、北境按地貌、老存档补特产
import * as G from '../src/sim.js';
import { BLD, CAMP_SPEC, ALT } from '../src/data.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const run = (S, s) => { for (let i = 0; i < s; i++) G.step(S, 1); };
const put = (S, camp, type) => {
  for (let y = Math.floor(camp.y) - 10; y <= camp.y + 10; y++) for (let x = Math.floor(camp.x) - 10; x <= camp.x + 10; x++) {
    const c = G.checkPlace(S, type, x, y); if (c.ok) { const r = G.place(S, type, x, y); if (r.ok) return G.getB(S, r.id ?? S.buildings[S.buildings.length - 1].id); }
  }
  return null;
};

// ---- 营地特产 ----
const S = G.newRun(G.defaultMeta(), 0, 4242);
S.reveal.fill(1); G.rt(S).revealN = 99; G.dirty(S);
const main = G.mainCamp(S); main.people = 60; S.known = 3; G.getB(S, main.furnace).lvl = 8; G.dirty(S);
const fill = () => { for (const k of ['wood', 'stone', 'food', 'coal', 'iron', 'tar', 'ore', 'coke']) main.stock[k] = 400; main.stock.plank = 100; };
fill();
ok(main.spec && CAMP_SPEC[main.spec], `first camp has a specialty (${main.spec} = ${CAMP_SPEC[main.spec] && CAMP_SPEC[main.spec].n})`);
const seeds = {}; for (let s = 1; s <= 30; s++) { const T = G.newRun(G.defaultMeta(), 0, s); const k = G.mainCamp(T).spec; seeds[k] = (seeds[k] || 0) + 1; }
console.log('first-camp specialties over 30 seeds', JSON.stringify(seeds));
main.spec = 'flat';
const saw = put(S, main, 'sawmill'); saw.workers = G.maxWorkers('sawmill', 1);
ok(!!saw, 'placed a sawmill');
const B0 = G.prodBonus(S, saw, main);
ok(B0.parts.some(p => p[0] === '特产' && Math.abs(p[1] - 0.5) < 1e-9), '平坦雪原 camp: sawmill gets 特产 +50%');
S.tech = S.tech || { done: {}, cur: null, prog: 0 }; S.tech.done.specpro = true;
ok(G.prodBonus(S, saw, main).parts.some(p => p[0] === '特产' && Math.abs(p[1] - 0.75) < 1e-9), '特产精工: +75%');
delete S.tech.done.specpro;
const tw = put(S, main, 'tower'); tw.workers = 1;
const d0 = G.campDefense(S, main); main.spec = 'wolf'; const d1 = G.campDefense(S, main);
ok(d1 > d0, `狼群领地: towers stronger (${d0} → ${d1})`);
main.spec = 'flat';
const ws = put(S, main, 'workshop'); ws.workers = G.maxWorkers('workshop', 1);
S.tech.cur = (await import('../src/data.js')).TECHS[0].id; fill();
run(S, 5); const rp0 = (G.rt(S).c[main.id] || {}).rp; main.spec = 'night'; run(S, 5); const rp1 = (G.rt(S).c[main.id] || {}).rp;
ok(rp1 > rp0 * 1.3, `永夜: research +50% (${rp0 && rp0.toFixed(2)} → ${rp1 && rp1.toFixed(2)})`);
main.spec = 'flat';

// ---- 替代配方 ----
ok(G.bdef(saw) === BLD.sawmill, 'base recipe by default');
let r = G.setAlt(S, saw.id, true);
ok(!r.ok && /替代配方·一/.test(r.reason), `locked before research (${r.reason})`);
S.tech.done.alt1 = true;
r = G.setAlt(S, saw.id, true);
ok(r.ok && saw.alt && G.bdef(saw).in.tar === 1, 'switched to 木材3+焦油1→木板3');
fill(); run(S, 2);
ok(G.rt(S).b[saw.id].status === '在换配方', 'stopped while switching');
fill(); run(S, 20);
const br = G.rt(S).b[saw.id];
ok(br.status !== '在换配方' && (br.inRate.tar || 0) > 0 && !(br.inRate.wood > 3.01 * 1.6 * 2), `after 20 s it eats tar (${JSON.stringify(br.inRate)}) → ${JSON.stringify(br.rate)}`);
ok(G.setAlt(S, saw.id, true).same, 'switching to the same recipe is a no-op');
const smelt = put(S, main, 'smelter'); smelt.workers = G.maxWorkers('smelter', 1);
ok(G.setAlt(S, smelt.id, true).ok, 'alt1 opens tier 2 too'); G.setAlt(S, smelt.id, false);
const ref = BLD.refinery; ok(G.altTech('refinery') === 'alt2' && G.altTech('steelworks') === 'alt1', 'tiers 1–3 → ·一, 4–7 → ·二');
// 规划器：大多数锯木厂换了，就按替代配方算原料
const P = G.planLine(S, 'plank', 6);
ok(P.nodes.some(n => n.k === 'tar') && P.nodes.find(n => n.k === 'wood').need < 6 * 2 - 0.01, `planner follows the majority recipe (wood need ${P.nodes.find(n => n.k === 'wood').need}, tar ${(P.nodes.find(n => n.k === 'tar') || {}).need})`);
ok(P.nodes.find(n => n.k === 'plank').alt === 1, 'planner node counts buildings on the alt recipe');
G.setAlt(S, saw.id, false); run(S, 25);
ok(!saw.alt && !G.planLine(S, 'plank', 6).nodes.some(n => n.k === 'tar'), 'switched back: planner back to 木材6→木板3');
// 老向导：焦煤坊没煤停了三分钟，替代配方吃木材，木材够 → 提醒换
fill(); const ck = put(S, main, 'coker'); ck.workers = G.maxWorkers('coker', 1);
fill(); main.stock.coal = 0; for (const b of S.buildings) if (b.camp === main.id && b.type === 'coalmine') b.workers = 0;
for (let i = 0; i < 200; i++) { main.stock.coal = 0; main.stock.wood = 400; G.step(S, 1); }
const R = G.rt(S);
ok(R.b[ck.id].status === '缺煤' && R.b[ck.id].stop0 != null, `coker stopped for coal (${R.b[ck.id].status})`);
const tip = G.altTip(S, R, main, 180);
ok(tip && tip.kind === 'alt' && [ck.id, smelt.id].includes(tip.arg) && /替代配方/.test(tip.text), `advisor: ${tip && tip.text}`);
main.stock.wood = 0;
ok(!G.altTip(S, R, main, 180) || G.altTip(S, R, main, 180).arg !== ck.id, 'no tip when the alt inputs are missing too');

// ---- 北境按地貌 / 老存档补特产 ----
const json = G.serialize(S);
const o = JSON.parse(json); for (const c of o.camps) delete c.spec;
const S2 = G.deserialize(JSON.stringify(o));
ok(S2.camps.every(c => c.spec && CAMP_SPEC[c.spec]), `old save: every camp gets a specialty (${S2.camps.map(c => c.spec).join(',')})`);
const st = { rule: 'rich', rich: 'crystal' }, st2 = { rule: 'storm' };
ok(G.specForStop(S, main, st) === 'crystal' && G.specForStop(S, main, st2) === 'storm' && CAMP_SPEC[G.specForStop(S, main, null)], '北境: 富矿带 → that ore, others → the rule, else by nodes');
for (const t in ALT) ok(Object.keys(ALT[t].out).join() === Object.keys(BLD[t].out).join(), `${BLD[t].n}: alt makes the same thing (${G.recipeTxt(G.altDef(t))})`);
console.log(fail ? `FAILED ${fail}` : 'all ok');
