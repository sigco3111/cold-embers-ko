// 1.1 研究：45 项、五条分支、★ 解锁、分支开放条件、无尽研究、新研究的效果
import * as G from '../src/sim.js';
import { TECHS, TECH_BR, ENDLESS } from '../src/data.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };

// ---- 数据 ----
ok(TECHS.length === 45, `45 techs (${TECHS.length})`);
ok(TECH_BR.join() === '生产,生存,物流,自动化,北境', 'five branches, 后勤 renamed 物流');
ok([10, 10, 10, 7, 8].every((n, i) => TECHS.filter(t => t.br === i).length === n), 'branch sizes 10/10/10/7/8');
ok(TECHS.filter(t => t.star).length === 12, '12 ★ unlock techs');
ok(new Set(TECHS.map(t => t.id)).size === 45, 'ids unique');
ok(TECHS.every(t => (t.req || []).every(r => { const p = TECHS.find(x => x.id === r); return p && p.br === t.br && p.t <= t.t; })), 'prereqs exist, same branch, not a later tier');
for (const id of ['alt1', 'alt2', 'specpro', 'apprentice', 'coldcast', 'thermal', 'guild', 'canteen', 'townplan', 'wideroad', 'dispatch', 'railsched', 'postnet', 'botcal', 'bothaul', 'botmine', 'botshell', 'botbay', 'corerec', 'autofac', 'afterglow', 'fork3', 'guide', 'wonder1', 'wonder2', 'cmd1', 'cmd2', 'wintprep'])
  if (!TECHS.find(t => t.id === id)) ok(false, 'missing tech ' + id);
const cheap = TECHS.filter(t => t.t === 2), dear = TECHS.filter(t => t.t === 7);
ok(Math.max(...cheap.map(t => t.pts)) < Math.min(...dear.map(t => t.pts)), 'tier 2 techs cost far less than tier 7');

const S = G.newRun(G.defaultMeta(), 0, 99);
const main = G.mainCamp(S);
const fill = () => { for (const k of ['wood', 'stone', 'plank', 'iron', 'steel', 'gear', 'seal', 'engine', 'battery', 'alloy', 'part', 'core']) main.stock[k] = 5000; };
fill(); S.active = main.id;

// ---- 分支开放 ----
S.known = 5;
ok(G.techGateWhy(S, 3) && G.techCheck(S, 'botcal').gate, `自动化 closed before tier 6: ${G.techGateWhy(S, 3)}`);
S.known = 7;
ok(!G.techGateWhy(S, 3) && G.techCheck(S, 'botcal').ok, '自动化 opens at tier 6+');
ok(G.techGateWhy(S, 4) && !G.techCheck(S, 'afterglow').ok, `北境 closed before 北境: ${G.techGateWhy(S, 4)}`);
G.journeyOf(S).stage = 13;
ok(!G.techGateWhy(S, 4) && G.techCheck(S, 'afterglow').ok, '北境 opens past the world spine');
ok(G.techCheck(S, 'cmd1').lock && /烽火余晖/.test(G.techCheck(S, 'cmd1').reason), 'prereq lock names the prereq');

// ---- 研究一项 ----
const T = S.tech || (S.tech = { done: {}, cur: null, prog: 0 });
const st0 = main.stock.plank, r = G.startTech(S, 'canteen');
ok(!r.ok && G.techCheck(S, 'canteen').lock, 'canteen needs its chain first');
for (const id of ['felt', 'clinic', 'coldcast']) T.done[id] = true;
ok(G.startTech(S, 'canteen').ok && main.stock.plank === st0 - 180, 'canteen started, materials paid');
T.prog = 999; G.step(S, 1);
ok(T.done.canteen && !T.cur, 'canteen finished');

// ---- 效果 ----
const eat = () => { G.step(S, 1); return G.rt(S).c[main.id].eatPerMin; };
const e1 = eat(); delete T.done.canteen; G.dirty(S); const e0 = eat(); T.done.canteen = true;
ok(Math.abs(e1 / e0 - 0.9) < 1e-6, `集体食堂: food use ×0.9 (${e0.toFixed(2)} → ${e1.toFixed(2)})`);
const c0 = G.roadCost(S, main.id, main.id); T.done.wideroad = true; const c1 = G.roadCost(S, main.id, main.id);
ok(Math.abs(c1.wood / c0.wood - 0.7) < 0.02, `宽雪橇道: road cost ×0.7 (${c0.wood} → ${c1.wood})`);
ok(G.netMul(S, 'tick') === 1 && G.netBatch(S) === 10, 'dispatch: 10 s, batch 10 before');
T.done.dispatch = true; ok(G.netMul(S, 'tick') === 0.5 && G.netBatch(S) === 5, '调度站: 5 s, batch 5');
const rr = { kind: 'rail', lvl: 1, a: main.id, b: main.id }; const v0 = G.roadSpd(S, rr); T.done.railsched = true;
ok(v0 === 8 && G.roadSpd(S, rr) === 12, '铁路调度: rail sleds 8 → 12');
const l0 = G.techSum(S, 'line'); T.done.postnet = true; ok(Math.abs(G.techSum(S, 'line') - l0 - 0.25) < 1e-9, '驿站网: roads +25%');
S.reveal.fill(1); G.rt(S).revealN = 99; G.dirty(S); fill();
let b0 = null;
for (let y = Math.floor(main.y) - 9; y <= main.y + 9 && !b0; y++) for (let x = Math.floor(main.x) - 9; x <= main.x + 9 && !b0; x++) if (G.checkPlace(S, 'sawmill', x, y).ok) { const pr = G.place(S, 'sawmill', x, y); if (pr.ok) b0 = G.getB(S, pr.id); }
G.towerList(S).push({ n: 1, camp: main.id }, { n: 2, camp: main.id });
ok(!G.prodBonus(S, b0, main).parts.some(p => p[0] === '烽火余晖'), 'no 烽火余晖 before research');
T.done.afterglow = true;
ok(G.prodBonus(S, b0, main).parts.some(p => p[0] === '烽火余晖' && Math.abs(p[1] - 0.06) < 1e-9), '烽火余晖: +3% per lit tower (2 → +6%)');
G.towerList(S).length = 0;

// ---- 无尽研究 ----
ok(!G.techCheck(S, 'endless').ok && /五条分支/.test(G.techCheck(S, 'endless').reason), 'endless locked until everything is done');
for (const t of TECHS) T.done[t.id] = true; T.cur = null;
ok(G.allTechDone(S), 'all done');
const d1 = G.techDef(S, 'endless'); ok(d1.pts === ENDLESS.pts && d1.cost.alloy === ENDLESS.cost.alloy, 'endless level 1 base cost');
fill(); const a0 = main.stock.alloy; ok(G.startTech(S, 'endless').ok && main.stock.alloy === a0 - ENDLESS.cost.alloy, 'endless started');
G.cancelTech(S); ok(main.stock.alloy === a0 && !T.cur, 'cancel refunds the endless cost');
G.startTech(S, 'endless'); T.prog = d1.pts + 5; G.step(S, 1);
ok(G.endlessLvl(S) === 1 && !T.cur, 'endless level 1 done');
ok(G.prodBonus(S, b0, main).parts.some(p => p[0] === '无尽研究' && Math.abs(p[1] - 0.02) < 1e-9), 'endless: +2% all output');
const d2 = G.techDef(S, 'endless'); ok(d2.pts === Math.round(ENDLESS.pts * 1.25) && d2.cost.part === Math.round(ENDLESS.cost.part * 1.25), 'endless level 2 costs ×1.25');
T.endless = 10; ok(G.techDef(S, 'endless').pts === Math.round(ENDLESS.pts * Math.pow(1.25, 10)), 'level 11 costs ×1.25^10');
ok(G.prodBonus(S, b0, main).parts.some(p => p[0] === '无尽研究' && Math.abs(p[1] - 0.2) < 1e-9), 'no cap: 10 levels = +20%');

// ---- 老存档：17 项照旧 ----
const S2 = G.newRun(G.defaultMeta(), 0, 5);
S2.tech = { done: { axe: true, felt: true, sled: true, shelf: true, rail: true, xbow: true }, cur: 'drill', prog: 10 };
const S3 = G.deserialize(G.serialize(S2));
ok(S3.tech.cur === 'drill' && S3.tech.done.rail && G.techSum(S3, 'line') === 0.3, 'old save: done techs and current research kept');
ok(Object.keys(S3.tech.done).every(id => TECHS.find(t => t.id === id)), 'old ids still exist');

console.log(fail ? `\n${fail} FAILED` : '\nall ok');
process.exit(fail ? 1 : 0);
